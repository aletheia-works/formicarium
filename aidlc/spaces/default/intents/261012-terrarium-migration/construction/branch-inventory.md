# ローカルとGitHubに残っている作業の一覧

## Sources

2026-10-18に `jj git fetch` の後、`jj log`・`jj bookmark list --all-remotes`・`git worktree list`・`gh api repos/Marukome0743/formicarium/branches` で確かめた（検証済み）。同じ日に、人間の承認を受けて不要なものを消した（下の「消したもの」）。

## 正

| 名前 | commit | 中身 |
|---|---|---|
| `main`（= `main@upstream`・`main@origin`） | `4e3482bb` | upstreamの最新（#28）。ここが土台 |
| 作業のchange（`@`） | 先端は都度変わる | `main@upstream` の上で、移管の作業を移し直す場所。いまは対応表 `upstream-alignment-plan.md` だけ |

## 移し直しの元（移し終わったら消す）

| 名前 | commit | 中身 | 土台 |
|---|---|---|---|
| `codex/terrarium-migration-u4`（forkにもある） | `9722db3e` | U2〜U4の正本。U3の最初のcommit `ccbd9321` にU1・U2の変更も入っている。7 commit（`ccbd9321`〜`9722db3e`） | `74dd4477`（古い） |
| `codex/terrarium-migration-u3`（forkにもある） | `7c7ceaf4` | 上の列の途中（U3まで） | `74dd4477` |
| `codex/terrarium-migration-u2`（forkにもある） | `d9beae83` | U2のCIの証拠用の別の列（4 commit）。中身はU4の列と大きく違う。U2のCI入力の固定と、有限symlinkの再利用の修正を含む。移し直しで要る修正があるかを確かめる | `567799f5`（0.2.1） |
| WIP change `mtmplvwk` | `196d57b7` | U5（固定guest build）とU7（showcase）の作業。pushしない | `93dc2a8e` の上 |
| `93dc2a8e`（LOCAL ONLY） | `93dc2a8e` | U4を中断していた間に混ざった、他のintent（261006・261010）の記録、active-memory、codekb、AGENTS.md、OUTCOMES.md、package-lock.jsonの削除。pushしない。記録として残す価値があるかを確かめてから扱う | U4の列の上 |

## GitHub側の固定入力（触らない）

CIや過去の証拠が、固定commitのURL（`raw.githubusercontent.com/.../<sha>/...`）で入力のarchiveを参照している。branchを消すとcommitが辿れなくなるおそれがあるので残す。

| branch | commit | 入力 |
|---|---|---|
| `codex/release/rc1-inputs`（upstream） | `f469d782` | `release-inputs/rc1-approved.tgz` |
| `codex/inputs/stable-0.1.0-v1`（upstream） | `edd43c9e` | `release-inputs/stable-v1.tgz` |
| `codex/inputs/stable-0.1.0-approved-v1`（upstream） | `9695f66b` | `release-inputs/stable-0.1.0-approved.tgz` |
| `codex/ci-inputs/u4-publication-boundary`（fork） | `07be6a46` | `ci-inputs/u4-release-assurance.tar.gz` |

`58100994`「fix(release): handle GitHub artifact storage account rotation」とその下の3 commit（0.1.0の公開の準備）は、上の入力用branchの系統にあり、jjが変更不可として守っているので残した。中身はupstreamの #18 で取り込み済み。

## 消したもの（2026-10-18、ローカルだけ）

- folderが無くなったgit worktreeの登録13個（`/private/tmp/formicarium-*`）と、それを指すjjのworkspace14個。
- `.artifacts/migration-session/ci-checkout`（U2のCI用checkout、変更なし、384MB）。
- `.claude/worktrees/aidlc-unclaimed-sources-fix-309e43`（変更なし、130MB）とbookmark `claude/aidlc-unclaimed-sources-fix-309e43`。
- upstreamの #3〜#14 のmerge前の下書き（Bun移行、CI・保守workflow、task配置、pitchfork patchの削除など）27 commitと、bookmark `codex/bun-ci-u1`。中身はsquash mergeで置き換え済み。固定入力のcommit `674a7f0a`・`0ef760c9`・`0cb57c28` はGitHub側にあることを確かめてから、ローカルの写しだけを消した。

消したcommitは、`jj op log` から戻せる。
