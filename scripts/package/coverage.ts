import { randomUUID } from 'node:crypto';
import {
  copyFile,
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, parseExpression } from '@babel/parser';
import * as babel from '@babel/types';
import type { FileCoverageData } from 'istanbul-lib-coverage';
import coverageLibrary from 'istanbul-lib-coverage';
import type { CounterRow, DigestRow, Realm } from '../coverage-types.js';
import { compiledTestConfig } from '../playwright-build-config.js';
import { FIRST_PARTY_JS, PACKAGE_FILES, sha256 } from './stage-package.js';
import {
  buildWorkerBundle,
  WORKER_BUNDLE,
  WORKER_BUNDLE_ENTRY,
  workerBundleSources,
} from './worker-bundle.js';

const { createCoverageMap } = coverageLibrary;

import instrumentLibrary from 'istanbul-lib-instrument';

const { createInstrumenter } = instrumentLibrary;
const babelGenerator = createRequire(
  import.meta.resolve('istanbul-lib-instrument'),
)('@babel/generator') as { default: (node: babel.Node) => { code: string } };

export function counterLayout(metadata: FileCoverageData[]): CounterRow[] {
  let offset = 1;
  return metadata.map((file) => {
    const keys = Object.keys(file.s);
    const row = { path: file.path, registeredOffset: offset++, offset, keys };
    offset += keys.length;
    return row;
  });
}
export function createRealm(layout: CounterRow[], name: string): Realm {
  const last = layout.at(-1)!;
  const size = last.offset + last.keys.length;
  return { name, buffer: new SharedArrayBuffer(size * 4) };
}
export function bridgeSource(layout: CounterRow[]) {
  // Coverage needs zero/nonzero statements, not unbounded execution frequency.
  // Saturate raw signed Int32 counters before storage so hot SHA loops cannot
  // wrap into negative/zero counts. Never repair previously collected evidence.
  // A saturated count is a lower bound, not an exact execution frequency.
  return `(()=>{const writers=new Map();globalThis.__coverageStatementWriter=path=>{const writer=writers.get(path);if(!writer)throw Error('unregistered coverage statement writer');return writer;};globalThis.__coverage__=new Proxy({}, {set(object,key,file){
const row=${JSON.stringify(layout)}.find(row=>row.path===key);
if(!row)throw Error('unexpected coverage file');
if(JSON.stringify(Object.keys(file.s))!==JSON.stringify(row.keys))throw Error('coverage statement map mismatch');
Atomics.store(globalThis.__coverageCounters,row.registeredOffset,1);
const latest=row.keys.map((_,i)=>Atomics.load(globalThis.__coverageCounters,row.offset+i));
for(let i=0;i<row.keys.length;i++){const index=row.offset+i;Object.defineProperty(file.s,row.keys[i],{enumerable:true,get(){return latest[i]},set(value){if(!Number.isSafeInteger(value)||value<0)throw Error('coverage counter requires nonnegative safe integer');const bounded=Math.min(value,2147483647);Atomics.store(globalThis.__coverageCounters,index,bounded);latest[i]=bounded}});}
writers.set(key,(id,prefix)=>{if(!Number.isInteger(id)||id<0||id>=row.keys.length||row.keys[id]!==String(id))throw Error('unsupported coverage statement id');const before=latest[id],value=before+1,bounded=Math.min(value,2147483647);Atomics.store(globalThis.__coverageCounters,row.offset+id,bounded);latest[id]=bounded;return prefix?value:before;});
object[key]=file;return true;}}); Atomics.store(globalThis.__coverageCounters,0,1);})();`;
}

/** Rewrite only the instrumenter's statement updates; unknown shapes fail closed. */
export function directStatementSource(
  text: string,
  file: FileCoverageData,
): string {
  const source = parse(text, { sourceType: 'module' });
  const coverageNames = new Set<string>();
  for (const statement of source.program.body)
    if (
      babel.isFunctionDeclaration(statement) &&
      statement.id &&
      /^cov_[a-zA-Z0-9_]+$/.test(statement.id.name)
    )
      coverageNames.add(statement.id.name);
  if (
    coverageNames.size === 0 &&
    Object.keys(file.s).length === 0 &&
    Object.keys(file.f).length === 0 &&
    Object.keys(file.b).length === 0
  )
    return text;
  if (coverageNames.size !== 1)
    throw Error('unsupported coverage getter declaration');
  const name = [...coverageNames][0]!;
  const hit = name + '_statementHit';
  if (text.includes(hit))
    throw Error('coverage statement writer name collision');
  const isCoverageCall = (node: babel.Node) =>
    babel.isCallExpression(node) &&
    babel.isIdentifier(node.callee, { name }) &&
    node.arguments.length === 0;
  const isStatements = (node: babel.Node) =>
    babel.isMemberExpression(node) &&
    !node.computed &&
    babel.isIdentifier(node.property, { name: 's' }) &&
    isCoverageCall(node.object);
  let bootstrap = 0,
    updates = 0;
  const visit = (node: babel.Node): babel.Node => {
    if (
      babel.isUpdateExpression(node) &&
      babel.isMemberExpression(node.argument) &&
      isStatements(node.argument.object)
    ) {
      if (
        node.operator !== '++' ||
        !node.argument.computed ||
        !babel.isNumericLiteral(node.argument.property)
      )
        throw Error('unsupported coverage statement update');
      const id = String(node.argument.property.value);
      if (!Object.hasOwn(file.s, id))
        throw Error('unsupported coverage statement id');
      updates++;
      return babel.callExpression(babel.identifier(hit), [
        babel.numericLiteral(Number(id)),
        babel.booleanLiteral(node.prefix),
      ]);
    }
    if (isStatements(node))
      throw Error('unsupported coverage statement access');
    if (
      babel.isMemberExpression(node) &&
      node.computed &&
      babel.isStringLiteral(node.property, { value: 's' }) &&
      isCoverageCall(node.object)
    )
      throw Error('unsupported coverage statement access');
    if (
      babel.isMemberExpression(node) &&
      !node.computed &&
      babel.isIdentifier(node.property, { name: 's' }) &&
      babel.isCallExpression(node.object) &&
      babel.isIdentifier(node.object.callee) &&
      /^cov_/.test(node.object.callee.name)
    )
      throw Error('unsupported coverage getter mismatch');
    for (const key of babel.VISITOR_KEYS[node.type] ?? []) {
      const child: unknown = Reflect.get(node, key);
      if (Array.isArray(child))
        Reflect.set(
          node,
          key,
          child.map((item: unknown) =>
            babel.isNode(item) ? visit(item) : item,
          ),
        );
      else if (babel.isNode(child)) Reflect.set(node, key, visit(child));
    }
    return node;
  };
  visit(source);
  source.program.body = source.program.body.flatMap((statement) => {
    if (
      !babel.isExpressionStatement(statement) ||
      !isCoverageCall(statement.expression)
    )
      return [statement];
    bootstrap++;
    // A realm without the coverage bridge (for example a page that imports the
    // instrumented module directly) keeps its counts local and discards them,
    // as stock istanbul does there; a bridged realm still uses the shared writer.
    const writer = parseExpression(
      '(globalThis.__coverageStatementWriter ?? (() => { const counts = []; return (id, prefix) => { const before = counts[id] ?? 0; counts[id] = before + 1; return prefix ? before + 1 : before; }; }))',
    );
    return [
      statement,
      babel.variableDeclaration('const', [
        babel.variableDeclarator(
          babel.identifier(hit),
          babel.callExpression(writer, [babel.stringLiteral(file.path)]),
        ),
      ]),
    ];
  });
  if (bootstrap !== 1 || (Object.keys(file.s).length > 0 && updates === 0))
    throw Error('unsupported coverage statement bootstrap');
  return babelGenerator.default(source).code;
}
export function mergeRealms(
  metadata: FileCoverageData[],
  layout: CounterRow[],
  realms: Realm[],
  expectedNames: string[],
) {
  if (
    metadata.length !== FIRST_PARTY_JS.length ||
    JSON.stringify(metadata.map((file) => file.path).sort()) !==
      JSON.stringify([...FIRST_PARTY_JS].sort())
  )
    throw new Error('coverage inventory differs');
  if (new Set(realms.map((realm) => realm.name)).size !== realms.length)
    throw new Error('duplicate coverage realm');
  for (const name of expectedNames) {
    const realm = realms.find((item) => item.name === name);
    if (!realm || Atomics.load(new Int32Array(realm.buffer), 0) !== 1)
      throw new Error(`missing coverage realm: ${name}`);
  }
  for (const realm of realms)
    if (Atomics.load(new Int32Array(realm.buffer), 0) !== 1)
      throw new Error(`unregistered coverage realm: ${realm.name}`);
  const map = createCoverageMap({});
  // Zero maps are registered first, including never-imported distribution files.
  for (const file of metadata) map.addFileCoverage(structuredClone(file));
  for (const realm of realms) {
    const counters = new Int32Array(realm.buffer);
    for (let index = 0; index < counters.length; index++)
      if (Atomics.load(counters, index) < 0)
        throw new Error(`negative coverage counter: ${realm.name}:${index}`);
    for (const file of metadata) {
      const row = layout.find((item) => item.path === file.path)!;
      const measured = structuredClone(file);
      measured.s = Object.fromEntries(
        row.keys.map((key, index) => [
          key,
          Atomics.load(counters, row.offset + index),
        ]),
      );
      map.merge({ [file.path]: measured });
    }
  }
  const lines = map.getCoverageSummary().lines;
  return {
    map,
    lines,
    passed: typeof lines.pct === 'number' && lines.pct >= 80,
  };
}

/**
 * The generated Worker bundle is rebuilt from the instrumented originals, so the
 * statements it runs count for those runtime/*.js files. Its source map must name
 * only fixed-inventory files, and the package Worker when that entry has code.
 */
async function instrumentWorkerBundle(source: string, out: string) {
  buildWorkerBundle({ root: out });
  const sources = await workerBundleSources(out);
  if (sources.some((path) => !FIRST_PARTY_JS.includes(path)))
    throw Error('Worker bundle includes a module outside the fixed inventory');
  if (
    (await readFile(resolve(source, WORKER_BUNDLE_ENTRY))).length > 0 &&
    !sources.includes(WORKER_BUNDLE_ENTRY)
  )
    throw Error('Worker bundle source map omits the package Worker');
}

/** Produce a separate instrumented copy; real archive bytes are never modified. */
export async function instrumentPackage({
  source,
  out,
}: {
  source: string;
  out: string;
}) {
  const metadata = [];
  const digests = [];
  for (const path of PACKAGE_FILES) {
    const destination = resolve(out, path);
    await mkdir(dirname(destination), { recursive: true });
    if (FIRST_PARTY_JS.includes(path)) {
      const bytes = await readFile(resolve(source, path));
      const instrumenter = createInstrumenter({
        esModules: true,
        compact: false,
        coverageGlobalScope: 'globalThis',
        coverageGlobalScopeFunc: false,
      });
      const instrumented = instrumenter.instrumentSync(
        bytes.toString('utf8'),
        path,
      );
      const file = instrumenter.lastFileCoverage();
      const text = directStatementSource(instrumented, file);
      metadata.push(file);
      digests.push({
        path,
        sourceSha256: sha256(bytes),
        instrumentedSha256: sha256(text),
        statementMapSha256: sha256(JSON.stringify(file.statementMap)),
      });
      await writeFile(destination, text);
    } else if (path !== WORKER_BUNDLE)
      await copyFile(resolve(source, path), destination);
  }
  await instrumentWorkerBundle(source, out);
  const layout = counterLayout(metadata);
  const bridge = bridgeSource(layout);
  const workerSize = createRealm(layout, 'size').buffer.byteLength;
  await writeFile(
    resolve(out, 'coverage-node-worker.mjs'),
    `import {parentPort,workerData} from 'node:worker_threads';
globalThis.__coverageCounters=new Int32Array(workerData.buffer);${bridge}
const queue=[];const collect=value=>queue.push(value);parentPort.on('message',collect);
await import(workerData.target);parentPort.off('message',collect);for(const message of queue)parentPort.emit('message',message);`,
  );
  await writeFile(
    resolve(out, 'coverage-browser-worker.mjs'),
    `const pending=[];const collect=event=>pending.push(event.data);self.addEventListener('message',collect);
self.addEventListener('message',async function bootstrap(event){if(event.data.type!=='coverage-bootstrap')return;self.removeEventListener('message',bootstrap);
globalThis.__coverageCounters=new Int32Array(event.data.buffer);${bridge}
const NativeWorker=globalThis.Worker;
globalThis.Worker=class extends NativeWorker {constructor(target,options){
const buffer=new SharedArrayBuffer(${workerSize});
super('/coverage-browser-worker.mjs',options);
this.addEventListener('message',event=>{if(event.data?.type==='coverage-descendant'){event.stopImmediatePropagation();self.postMessage(event.data);}});
self.postMessage({type:'coverage-descendant',buffer});
super.postMessage({type:'coverage-bootstrap',target:String(new URL(target,location.href)),buffer});}};
await import(event.data.target);self.removeEventListener('message',collect);
for(const data of pending)if(data.type!=='coverage-bootstrap')self.dispatchEvent(new MessageEvent('message',{data}));});`,
  );
  await writeFile(
    resolve(out, 'coverage-metadata.json'),
    `${JSON.stringify({ metadata, layout, digests }, null, 2)}\n`,
  );
  const generation = {
    version: 1,
    id: randomUUID(),
    out: resolve(out),
    metadataSha256: sha256(JSON.stringify({ metadata, layout, digests })),
  };
  await writeFile(
    resolve(out, 'coverage-playwright-generation.json'),
    JSON.stringify(generation),
    { flag: 'wx' },
  );
  for (const suite of ['package', 'session', 'install']) {
    await writeFile(
      resolve(out, `coverage-playwright-node-${suite}.mjs`),
      `import {closeSync,mkdirSync,openSync,writeFileSync,writeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {isMainThread} from 'node:worker_threads';
if(!isMainThread)throw Error('Playwright runner bootstrap cannot replace product Worker wrapper');
const generation=${JSON.stringify(generation)},suite=${JSON.stringify(suite)};
if(dirname(fileURLToPath(import.meta.url))!==generation.out)throw Error('Playwright generation output mismatch');
if(globalThis.__coverageCounters||globalThis.__coverageStatementWriter)throw Error('Playwright runner already bootstrapped');
const directory=new URL('./coverage-playwright-node/'+suite+'/',import.meta.url);mkdirSync(directory,{recursive:true});
const identity={...generation,suite,pid:process.pid,ppid:process.ppid};
{const launch=Buffer.from(JSON.stringify(identity)+'\\n');const ledger=openSync(new URL('launches.jsonl',directory),'a');
try{if(writeSync(ledger,launch,0,launch.length,null)!==launch.length)throw Error('Playwright launch ledger partial write');}finally{closeSync(ledger);}}
globalThis.__coverageCounters=new Int32Array(new SharedArrayBuffer(${workerSize}));${bridge}
writeFileSync(new URL(process.pid+'.begin.json',directory),JSON.stringify(identity),{flag:'wx'});
let abnormal=false;process.on('uncaughtExceptionMonitor',()=>{abnormal=true;});
process.on('exit',exitCode=>writeFileSync(new URL(process.pid+'.end.json',directory),JSON.stringify({...identity,exitCode,abnormal,counts:[...globalThis.__coverageCounters]}),{flag:'wx'}));
`,
      { flag: 'wx' },
    );
  }
  return { metadata, layout, digests, bridge };
}

/**
 * Reads one suite's independent launch ledger, written before any receipt, so a
 * runner that lost both begin and end receipts is still expected.
 */
async function readPlaywrightLaunchLedger(
  folder: string,
  generation: Record<string, unknown>,
  suite: string,
) {
  const path = resolve(folder, 'launches.jsonl');
  const stat = await lstat(path).catch((error: unknown) => {
    throw Error('Playwright launch ledger missing', { cause: error });
  });
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0)
    throw Error('Playwright invalid launch ledger file');
  const text = await readFile(path, 'utf8');
  if (!text.endsWith('\n'))
    throw Error('Playwright incomplete launch ledger record');
  const launches: { pid: number; ppid: number }[] = [];
  for (const line of text.slice(0, -1).split('\n')) {
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw Error('Playwright invalid launch ledger record', { cause: error });
    }
    const { pid, ppid } = (record ?? {}) as { pid?: unknown; ppid?: unknown };
    if (
      typeof pid !== 'number' ||
      !Number.isSafeInteger(pid) ||
      pid <= 0 ||
      typeof ppid !== 'number' ||
      !Number.isSafeInteger(ppid) ||
      ppid <= 0 ||
      JSON.stringify(record) !== line ||
      line !== JSON.stringify({ ...generation, suite, pid, ppid })
    )
      throw Error('Playwright launch ledger identity mismatch');
    if (launches.some((launch) => launch.pid === pid))
      throw Error('Playwright duplicate launch ledger pid');
    launches.push({ pid, ppid });
  }
  return launches;
}

/** The same fail-closed reader serves collection preflight and final merging. */
export async function readPlaywrightNodeRealms(
  out: string,
  expectedSuites: string[],
) {
  const allowed = ['package', 'session', 'install', 'command'];
  if (
    !expectedSuites.length ||
    new Set(expectedSuites).size !== expectedSuites.length ||
    expectedSuites.some((suite) => !allowed.includes(suite))
  )
    throw Error('invalid Playwright expected suites');
  for (const name of [
    'coverage-playwright-generation.json',
    'coverage-metadata.json',
  ]) {
    const stat = await lstat(resolve(out, name));
    if (!stat.isFile() || stat.isSymbolicLink())
      throw Error('invalid Playwright generation file');
  }
  const generation = JSON.parse(
    await readFile(resolve(out, 'coverage-playwright-generation.json'), 'utf8'),
  );
  const metadata = JSON.parse(
    await readFile(resolve(out, 'coverage-metadata.json'), 'utf8'),
  );
  if (
    generation.version !== 1 ||
    generation.out !== resolve(out) ||
    typeof generation.id !== 'string' ||
    generation.metadataSha256 !== sha256(JSON.stringify(metadata))
  )
    throw Error('Playwright generation boundary mismatch');
  const size = createRealm(metadata.layout, 'shape').buffer.byteLength / 4;
  const directory = resolve(out, 'coverage-playwright-node');
  if ((await lstat(directory)).isSymbolicLink())
    throw Error('Playwright registry symlink');
  const suites = await readdir(directory);
  if (
    JSON.stringify([...suites].sort()) !==
    JSON.stringify([...expectedSuites].sort())
  )
    throw Error('Playwright suite registry mismatch');
  const realms: Realm[] = [];
  for (const suite of suites) {
    const folder = resolve(directory, suite);
    if (
      !(await lstat(folder)).isDirectory() ||
      (await lstat(folder)).isSymbolicLink()
    )
      throw Error('invalid Playwright suite directory');
    const launches = await readPlaywrightLaunchLedger(
      folder,
      generation,
      suite,
    );
    const names = await readdir(folder);
    const required = [
      'launches.jsonl',
      ...launches.flatMap(({ pid }) => [
        `${pid}.begin.json`,
        `${pid}.end.json`,
      ]),
    ].sort();
    if (JSON.stringify([...names].sort()) !== JSON.stringify(required))
      throw Error('Playwright missing or extra process receipt');
    for (const launch of launches) {
      const name = `${launch.pid}.begin.json`;
      const endName = `${launch.pid}.end.json`;
      for (const file of [name, endName])
        if (
          !(await lstat(resolve(folder, file))).isFile() ||
          (await lstat(resolve(folder, file))).isSymbolicLink()
        )
          throw Error('invalid Playwright receipt file');
      const begin = JSON.parse(await readFile(resolve(folder, name), 'utf8'));
      const end = JSON.parse(await readFile(resolve(folder, endName), 'utf8'));
      const { pid, ppid } = launch;
      const identity = { ...generation, suite, pid, ppid };
      if (JSON.stringify(begin) !== JSON.stringify(identity))
        throw Error('Playwright begin identity mismatch');
      const { exitCode, abnormal, counts, ...endIdentity } = end;
      if (
        JSON.stringify(endIdentity) !== JSON.stringify(identity) ||
        exitCode !== 0 ||
        abnormal !== false ||
        !Array.isArray(counts) ||
        counts.length !== size ||
        counts[0] !== 1 ||
        counts.some(
          (value) =>
            !Number.isInteger(value) || value < 0 || value > 2147483647,
        )
      )
        throw Error('Playwright invalid final receipt');
      for (const row of metadata.layout as CounterRow[]) {
        if (
          ![0, 1].includes(counts[row.registeredOffset]) ||
          (counts[row.registeredOffset] === 0 &&
            row.keys.some((_, index) => counts[row.offset + index] !== 0))
        )
          throw Error('Playwright unregistered statement counts');
      }
      realms.push({
        name: `playwright:${suite}:${pid}`,
        buffer: Int32Array.from(counts).buffer,
      });
    }
  }
  return realms;
}

export async function copySharedTestHelpers(root: string, out: string) {
  await cp(resolve(root, 'tests/shared'), resolve(out, 'tests/shared'), {
    recursive: true,
  });
}

export async function prepareCoverage({
  source,
  out,
  root = fileURLToPath(new URL('../../', import.meta.url)),
}: {
  source: string;
  out: string;
  root?: string;
}) {
  const result = await instrumentPackage({ source, out });
  const size = createRealm(result.layout, 'size').buffer.byteLength;
  await cp(resolve(root, 'tests/package'), resolve(out, 'tests/package'), {
    recursive: true,
  });
  await copySharedTestHelpers(root, out);
  await cp(resolve(root, 'scripts/package'), resolve(out, 'scripts/package'), {
    recursive: true,
  });
  await cp(
    resolve(root, '.artifacts/u1-fixture'),
    resolve(out, '.artifacts/u1-fixture'),
    { recursive: true },
  );
  await cp(resolve(root, 'dist/guests'), resolve(out, 'dist/guests'), {
    recursive: true,
  });
  await cp(resolve(source, 'assets'), resolve(out, 'dist/blink'), {
    recursive: true,
  });
  await cp(
    resolve(root, 'scripts/playwright-build-config.js'),
    resolve(out, 'scripts/playwright-build-config.js'),
  );
  const configPath = resolve(out, 'tests/package/playwright.config.ts');
  await writeFile(
    configPath,
    `import '../../coverage-playwright-node-package.mjs';\n${compiledTestConfig(await readFile(configPath, 'utf8'))}`,
  );
  const nodePreload = `import {createRequire,syncBuiltinESMExports} from 'node:module';
import {writeFileSync} from 'node:fs';
const realms=[{name:'node-host',buffer:new SharedArrayBuffer(${size})}];
globalThis.__coverageCounters=new Int32Array(realms[0].buffer);${result.bridge}
const threads=createRequire(import.meta.url)('node:worker_threads');const Original=threads.Worker;
threads.Worker=class extends Original{constructor(target,options={}){if(options.workerData==='em-pthread'){super(target,{...options,execArgv:[]});return;}const realm={name:'node-worker-'+realms.length,buffer:new SharedArrayBuffer(${size})};realms.push(realm);super(new URL('./coverage-node-worker.mjs',import.meta.url),{...options,execArgv:[],workerData:{target:String(target),buffer:realm.buffer}});}};syncBuiltinESMExports();
process.on('exit',()=>writeFileSync(new URL('./coverage-node.json',import.meta.url),JSON.stringify(realms.map(realm=>({name:realm.name,counts:[...new Int32Array(realm.buffer)]})))));`;
  await writeFile(resolve(out, 'coverage-node-preload.mjs'), nodePreload);
  const browserInit = `const realms=[{name:'browser-host',buffer:new (typeof SharedArrayBuffer==='function'?SharedArrayBuffer:ArrayBuffer)(${size})}];
globalThis.__coverageRealms=realms;globalThis.__coverageCounters=new Int32Array(realms[0].buffer);${result.bridge}
const Original=globalThis.Worker;if(Original)globalThis.Worker=class extends Original{constructor(target,options){if(new URL(target,location.href).pathname.endsWith('/assets/blink.mjs')){super(target,options);return;}const realm={name:'browser-worker-'+realms.length,buffer:new SharedArrayBuffer(${size})};realms.push(realm);super('/coverage-browser-worker.mjs',options);
this.addEventListener('message',event=>{if(event.data?.type==='coverage-descendant'){event.stopImmediatePropagation();realms.push({name:'browser-worker-'+realms.length,buffer:event.data.buffer});}});
super.postMessage({type:'coverage-bootstrap',target:String(new URL(target,location.href)),buffer:realm.buffer});}};`;
  await writeFile(resolve(out, 'coverage-browser-init.js'), browserInit);
  for (const spec of [
    'browser-api.spec.js',
    'browser-worker.spec.js',
    'browser-broker.spec.js',
    'consumer.spec.js',
  ]) {
    const path = resolve(out, 'tests/package', spec);
    let text = await readFile(path, 'utf8');
    if (spec === 'consumer.spec.js') {
      const start = text.indexOf('const candidate =');
      const end = text.indexOf('const guest =');
      text = `${text.slice(0, start)}const packageRoot = ${JSON.stringify(out)};\n${text.slice(end)}`;
    }
    const hook = `test.beforeEach(async({context})=>context.addInitScript(await coverageRead(new URL('../../coverage-browser-init.js',import.meta.url),'utf8')));
test.afterEach(async({page},info)=>{const rows=await page.evaluate(()=>globalThis.__coverageRealms?.map(realm=>({name:realm.name,counts:[...new Int32Array(realm.buffer)]})));if(!rows)throw Error('missing browser page coverage');await coverageWrite(info.outputPath('coverage-realms.json'),JSON.stringify({project:info.project.name,title:info.title,rows}));});`;
    // Init registration precedes each original navigation hook.
    await writeFile(
      path,
      `import {readFile as coverageRead,writeFile as coverageWrite} from 'node:fs/promises';\n${text.replace('test.beforeEach(async ({ page })', `${hook}\ntest.beforeEach(async ({ page })`)}`,
    );
  }
  const consumerPath = resolve(out, 'tests/package/consumer.test.js');
  let consumerText = await readFile(consumerPath, 'utf8');
  const start = consumerText.indexOf('const candidate =');
  const end = consumerText.indexOf('const { createSession }');
  consumerText = `${consumerText.slice(0, start)}const installed = ${JSON.stringify(out)};\n${consumerText.slice(end)}`;
  await writeFile(consumerPath, consumerText);
  return result;
}

export async function reportCoverage({
  out,
  browserResults,
  candidatePath,
  session,
  runnerSuites = session ? ['package', 'session'] : ['package'],
  extraNodeWorkers = 0,
}: {
  out: string;
  browserResults: string;
  candidatePath: string;
  session?: { nodeWorkers: number; browserCases: Record<string, number> };
  runnerSuites?: string[];
  /** Planned Workers of suites run in the same Node process beyond the inventory. */
  extraNodeWorkers?: number;
}) {
  if (!Number.isSafeInteger(extraNodeWorkers) || extraNodeWorkers < 0)
    throw new Error('extra Node Worker count must be a nonnegative integer');
  const { metadata, layout, digests } = JSON.parse(
    await readFile(resolve(out, 'coverage-metadata.json'), 'utf8'),
  ) as {
    metadata: FileCoverageData[];
    layout: CounterRow[];
    digests: DigestRow[];
  };
  const candidate = JSON.parse(await readFile(candidatePath, 'utf8'));
  for (const row of digests) {
    const expected = candidate.files.find(
      (entry: { path: string; sha256: string }) => entry.path === row.path,
    );
    if (!expected || expected.sha256 !== row.sourceSha256)
      throw new Error(`baseline source digest differs: ${row.path}`);
    if (
      sha256(await readFile(resolve(out, row.path))) !== row.instrumentedSha256
    )
      throw new Error(`instrumented digest differs: ${row.path}`);
    if (
      sha256(
        JSON.stringify(
          metadata.find((file) => file.path === row.path)?.statementMap,
        ),
      ) !== row.statementMapSha256
    )
      throw new Error(`statement map differs: ${row.path}`);
  }
  const nodeRows = JSON.parse(
    await readFile(resolve(out, 'coverage-node.json'), 'utf8'),
  ) as { name: string; counts: number[] }[];
  const realms: Realm[] = nodeRows.map((row) => ({
    name: row.name,
    buffer: Int32Array.from(row.counts).buffer,
  }));
  const inventory = JSON.parse(
    await readFile(
      new URL('./coverage-inventory.json', import.meta.url),
      'utf8',
    ),
  ) as {
    node: { workers: number; host: number };
    browserCases: Record<string, number>;
  };
  const expected = [
    'node-host',
    ...Array.from(
      { length: inventory.node.workers + extraNodeWorkers },
      (_, index) => `node-worker-${index + 1}`,
    ),
  ];
  const runnerRealms = await readPlaywrightNodeRealms(out, runnerSuites);
  realms.push(...runnerRealms);
  expected.push(...runnerRealms.map((realm) => realm.name));
  if (
    nodeRows.length !==
    inventory.node.workers + extraNodeWorkers + inventory.node.host
  )
    throw new Error('Node planned Worker realms were not all retained');
  if (session) {
    const rows = JSON.parse(
      await readFile(resolve(out, 'coverage-session-node.json'), 'utf8'),
    ) as { name: string; counts: number[] }[];
    if (rows.length !== session.nodeWorkers + 1)
      throw Error('session planned Node Worker realms were not all retained');
    for (const row of rows)
      realms.push({
        name: `session:${row.name}`,
        buffer: Int32Array.from(row.counts).buffer,
      });
    expected.push(
      'session:node-host',
      ...Array.from(
        { length: session.nodeWorkers },
        (_, index) => `session:node-worker-${index + 1}`,
      ),
    );
    for (const [title, workers] of Object.entries(session.browserCases)) {
      if (Object.hasOwn(inventory.browserCases, title))
        throw Error('session coverage case duplicates package case');
      inventory.browserCases[title] = workers;
    }
  }
  const files: string[] = [];
  async function scan(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await scan(path);
      else if (entry.name === 'coverage-realms.json') files.push(path);
    }
  }
  await scan(browserResults);
  const groups = new Map<
    string,
    {
      project: string;
      title: string;
      rows: { name: string; counts: number[] }[];
    }
  >();
  for (const path of files) {
    const item = JSON.parse(await readFile(path, 'utf8')) as {
      project: string;
      title: string;
      rows: { name: string; counts: number[] }[];
    };
    const key = `${item.project}:${item.title}`;
    if (groups.has(key)) throw new Error('duplicate browser coverage case');
    groups.set(key, item);
    for (const row of item.rows)
      realms.push({
        name: `${key}:${row.name}`,
        buffer: Int32Array.from(row.counts).buffer,
      });
  }
  for (const project of ['chromium', 'firefox', 'webkit']) {
    const cases = [...groups.values()].filter(
      (item) => item.project === project,
    );
    if (cases.length !== Object.keys(inventory.browserCases).length)
      throw new Error(`missing planned browser case: ${project}`);
    if (
      cases.reduce((sum, item) => sum + item.rows.length, 0) !==
      Object.values(inventory.browserCases).reduce(
        (sum, workers) => sum + workers + 1,
        0,
      )
    )
      throw new Error(`missing planned browser Worker realm: ${project}`);
    for (const [title, workers] of Object.entries(inventory.browserCases)) {
      const item = groups.get(`${project}:${title}`);
      if (!item || item.rows.length !== workers + 1)
        throw new Error(`missing planned case realm: ${project}:${title}`);
      expected.push(`${project}:${title}:browser-host`);
      for (let index = 1; index <= workers; index++)
        expected.push(`${project}:${title}:browser-worker-${index}`);
    }
  }
  const result = mergeRealms(metadata, layout, realms, expected);
  const report = {
    candidateSha256: candidate.tarball.sha256,
    threshold: 80,
    lines: result.lines,
    passed: result.passed,
    realmNames: realms.map((realm) => realm.name),
    digests,
    files: metadata.map((file) => ({
      path: file.path,
      lines: result.map.fileCoverageFor(file.path).getLineCoverage(),
    })),
    exclusions: {
      generatedBlink:
        'third-party generated loader/wasm; separately verified by digest and real consumers',
      types: 'declarations; strict type fixtures',
      guests: 'external ELF/native oracle',
      development: 'scripts/tests; outside fixed product inventory',
    },
  };
  await writeFile(
    resolve(out, 'coverage-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (!result.passed)
    throw new Error(
      `fixed inventory line coverage ${result.lines.pct}% is below 80%`,
    );
  return report;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command, first, second, third] = process.argv.slice(2);
  if (command === 'prepare' && first && second) {
    const result = await prepareCoverage({
      source: resolve(first),
      out: resolve(second),
    });
    console.log(
      JSON.stringify({
        files: result.metadata.length,
        digests: result.digests,
      }),
    );
  } else if (command === 'report' && first && second && third) {
    const result = await reportCoverage({
      out: resolve(first),
      browserResults: resolve(second),
      candidatePath: resolve(third),
    });
    console.log(
      JSON.stringify({
        lines: result.lines,
        realms: result.realmNames.length,
        passed: result.passed,
      }),
    );
  } else
    throw new Error(
      'usage: coverage.js prepare <installed-package> <copy> | report <copy> <browser-results> <candidate-manifest>',
    );
}
