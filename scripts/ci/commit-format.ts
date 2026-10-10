import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CONVENTIONAL_COMMIT =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9][a-zA-Z0-9._/-]*\))?!?: [^\s].*$/;
export function validateCommitSubject(subject: string) {
  if (
    subject.includes('\n') ||
    subject.includes('\r') ||
    !CONVENTIONAL_COMMIT.test(subject)
  )
    throw Error(
      'commit subject must use type(scope)!: subject Conventional Commits',
    );
}
export function commitRange(base: string, head: string) {
  if (!/^[a-f0-9]{40}$/.test(head) || !/^[a-f0-9]{40}$/.test(base))
    throw Error('40 digit base/head SHA required');
  return /^0{40}$/.test(base) ? `${head}^!` : `${base}..${head}`;
}
export function checkCommits(base: string, head: string) {
  const commits = execFileSync(
    'git',
    ['log', '--format=%s', commitRange(base, head)],
    {
      encoding: 'utf8',
      shell: false,
    },
  )
    .trim()
    .split('\n');
  if (!commits[0]) throw Error('commit range has no commits');
  for (const subject of commits) validateCommitSubject(subject);
  return commits.length;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [base, head, ...extra] = process.argv.slice(2);
  if (!base || !head || extra.length)
    throw Error('usage: commit-format.ts <base-sha> <head-sha>');
  console.log(`Validated ${checkCommits(base, head)} Conventional Commits`);
}
