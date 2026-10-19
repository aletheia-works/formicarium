import assert from 'node:assert/strict';
import test from 'node:test';
import { redactUrls, withoutQuery } from '../../scripts/common.ts';
import { jobResults, summarize } from '../../scripts/summary.ts';

const NOW = new Date('2026-10-19T04:30:00Z');
const jobs = jobResults(
  JSON.stringify({
    build: { result: 'success' },
    deploy: { result: 'skipped' },
    'accept-webkit': { result: 'failure' },
    coverage: { result: 'cancelled' },
  }),
);

test('job results are read from needs and failed jobs are named', () => {
  assert.deepEqual(
    jobs.map((job) => job.name),
    ['accept-webkit', 'build', 'coverage', 'deploy'],
  );
  const result = summarize({
    distribute: false,
    lastDeployAt: null,
    now: NOW,
    jobs,
  });
  assert.deepEqual(result.failedJobs, ['accept-webkit', 'coverage']);
  assert.match(result.markdown, /失敗した job: accept-webkit, coverage/);
  assert.throws(() => jobResults('{'), /needs JSON invalid/);
});

test('a distribute run fails only when an earlier deployment is two days old or more', () => {
  const at = (days: number) =>
    new Date(NOW.getTime() - days * 86400000).toISOString();
  assert.equal(
    summarize({ distribute: true, lastDeployAt: at(1.9), now: NOW, jobs: [] })
      .fail,
    false,
  );
  const stale = summarize({
    distribute: true,
    lastDeployAt: at(2),
    now: NOW,
    jobs: [],
  });
  assert.equal(stale.fail, true);
  assert.equal(stale.days, 2);
  assert.match(stale.markdown, /日次の配布が 2 日止まっている/);
});

test('a verify run only shows the days, whatever their number', () => {
  const result = summarize({
    distribute: false,
    lastDeployAt: '2026-09-01T00:00:00Z',
    now: NOW,
    jobs,
  });
  assert.equal(result.fail, false);
  assert.match(result.markdown, /最後に deploy した run からの日数: 48日/);
});

test('without any deployment yet the summary only says so', () => {
  const result = summarize({
    distribute: true,
    lastDeployAt: null,
    now: NOW,
    jobs: [],
  });
  assert.equal(result.fail, false);
  assert.equal(result.days, null);
  assert.match(result.markdown, /まだ deploy していない/);
});

test('URLs in logs and summaries lose their query and fragment', () => {
  assert.equal(
    withoutQuery('https://x.test/a/b.zip?sig=secret&token=t#frag'),
    'https://x.test/a/b.zip',
  );
  assert.equal(withoutQuery('not a url?x=1'), 'not a url');
  assert.equal(
    redactUrls('fetched https://x.test/a?sig=1 and http://y.test/b#c done'),
    'fetched https://x.test/a and http://y.test/b done',
  );
});
