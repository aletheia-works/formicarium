#!/usr/bin/env node
// usage: node scripts/serve.js [--port 8787] [--host 127.0.0.1]
// 開発用の静的ファイルサーバー（依存なし）。プロジェクトのルートを配信し、すべての
// 応答に COOP/COEP（と CORP）を付けて、ページを crossOriginIsolated にする（FR2.2）。
// SharedArrayBuffer（Emscripten の pthread に必要）はこの状態でしか使えない。
import { createReadStream, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { errorText } from '../runtime/contracts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

/** COOP/COEP/CORP。crossOriginIsolated にするためのヘッダー。 */
export const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function parseArgs(argv: string[]) {
  const options = { port: 8787, host: '127.0.0.1' };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === '--port') {
      const port = Number(value);
      if (!Number.isInteger(port) || port <= 0 || port > 65535)
        throw new Error(`bad --port: ${value}`);
      options.port = port;
    } else if (flag === '--host') {
      if (!value) throw new Error('--host needs a value');
      options.host = value;
    } else {
      throw new Error(`unknown option: ${flag}`);
    }
  }
  return options;
}

/** URL のパスを、ルートの中のファイルパスに変える。ルートの外を指すものは null。 */
function resolvePath(urlPath: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]!);
  } catch {
    return null;
  }
  const target = path.resolve(root, `.${decoded}`);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

function send(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...ISOLATION_HEADERS,
  });
  res.end(body);
}

function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return send(res, 405, 'method not allowed\n');
  let file = resolvePath(req.url ?? '/');
  if (!file) return send(res, 403, 'forbidden\n');
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(file);
    if (stat.isDirectory()) {
      file = path.join(file, 'index.html');
      stat = statSync(file);
    }
  } catch {
    return send(res, 404, 'not found\n');
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-store',
    ...ISOLATION_HEADERS,
  });
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(file);
  stream.on('error', (error) => {
    console.error(`serve: read failed for ${file}: ${errorText(error)}`);
    res.destroy(error);
  });
  stream.pipe(res);
}

let options: ReturnType<typeof parseArgs>;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`serve: ${errorText(error)}`);
  process.exit(2);
}
const server = createServer(handle);
server.on('error', (error) => {
  console.error(`serve: ${errorText(error)}`);
  process.exit(1);
});
server.listen(options.port, options.host, () => {
  console.log(
    `serving ${root} at http://${options.host}:${options.port}/web/index.html`,
  );
});
