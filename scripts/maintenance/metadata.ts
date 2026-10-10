import { BoundaryError } from './archive.ts';
import type { GitHubApi } from './github.ts';
import { canonicalPath } from './input.ts';

export interface LabelRule {
  label: string;
  paths: string[];
}
export function labelsForPaths(
  paths: readonly string[],
  rules: readonly LabelRule[],
): string[] {
  if (paths.length > 500 || rules.length > 100)
    throw new BoundaryError('METADATA_LIMIT');
  for (const path of paths) canonicalPath(path);
  for (const rule of rules) {
    if (
      !/^[a-z][a-z0-9-]{0,49}$/.test(rule.label) ||
      !Array.isArray(rule.paths) ||
      rule.paths.length > 100
    )
      throw new BoundaryError('INVALID_LABEL_RULE');
    for (const path of rule.paths) canonicalPath(path);
  }
  return [
    ...new Set(
      rules
        .filter((rule) =>
          paths.some((path) =>
            rule.paths.some(
              (allowed) => path === allowed || path.startsWith(`${allowed}/`),
            ),
          ),
        )
        .map((rule) => rule.label),
    ),
  ].sort();
}
export async function labelPullRequest(
  api: GitHubApi,
  repository: string,
  prNumber: number,
  rules: readonly LabelRule[],
) {
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
    !Number.isSafeInteger(prNumber) ||
    prNumber < 1
  )
    throw new BoundaryError('INVALID_METADATA');
  const pr = (await api.json(`/repos/${repository}/pulls/${prNumber}`)) as {
    state?: unknown;
  };
  if (pr.state !== 'open') return { status: 'no-op', labels: [] };
  const files = await api.pages(
    `/repos/${repository}/pulls/${prNumber}/files?per_page=100`,
    '',
  );
  const labels = labelsForPaths(
    files.map((file) => (file as { filename: string }).filename),
    rules,
  );
  if (labels.length)
    await api.writeJson(
      `/repos/${repository}/issues/${prNumber}/labels`,
      'POST',
      { labels },
    );
  return { status: labels.length ? 'success' : 'no-op', labels };
}
