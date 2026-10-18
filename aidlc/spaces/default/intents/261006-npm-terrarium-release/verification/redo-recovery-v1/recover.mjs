import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, lstatSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
export const digest = data => createHash('sha256').update(data).digest('hex');
export function repair(text) {
  const blocks = text.split('\n---\n');
  const removed = [];
  const kept = blocks.filter(block => {
    if (!block.includes('**Timestamp**: 2026-10-10T01:51:21Z')) return true;
    const jump = block.includes('**Event**: STAGE_JUMPED') && block.includes('**Direction**: REDO') && block.includes('**Source**: code-generation') && block.includes('**Target**: code-generation') && !block.includes('**Unit**:');
    const start = block.includes('**Event**: STAGE_STARTED') && block.includes('**Stage**: code-generation') && block.includes('**Agent**: aidlc-developer-agent');
    if (!jump && !start) throw new Error('Unexpected event at correction timestamp');
    removed.push({ event: jump ? 'STAGE_JUMPED' : 'STAGE_STARTED', sha256: digest(block) });
    return false;
  });
  if (removed.length === 0) return { text, removed };
  if (removed.length !== 2 || new Set(removed.map(x => x.event)).size !== 2) throw new Error('Correction requires exactly one REDO and one associated start');
  return { text: kept.join('\n---\n'), removed };
}
export function apply(path, expectedSha, reportPath) {
  path = resolve(path);
  if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw new Error('Audit must be a regular file');
  const lock = path + '.recovery-lock';
  const fd = openSync(lock, 'wx');
  const temp = path + '.recovery-tmp';
  try {
    const before = readFileSync(path);
    if (digest(before) !== expectedSha) throw new Error('Audit changed; refusing correction');
    const result = repair(before.toString('utf8'));
    if (result.removed.length === 0) throw new Error('Correction already applied');
    writeFileSync(temp, result.text, { flag: 'wx', mode: lstatSync(path).mode });
    if (digest(readFileSync(path)) !== expectedSha) throw new Error('Concurrent audit write; refusing correction');
    renameSync(temp, path);
    const report = { beforeSha256: expectedSha, afterSha256: digest(readFileSync(path)), removed: result.removed, allOtherBlocksUnchanged: true, restoredApprovalCreated: false, appliedAt: new Date().toISOString() };
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    return report;
  } finally {
    closeSync(fd); unlinkSync(lock);
    try { unlinkSync(temp); } catch {}
  }
}
if (process.argv[1] && import.meta.url === new URL('file://' + resolve(process.argv[1])).href) {
  console.log(JSON.stringify(apply(...process.argv.slice(2)), null, 2));
}
