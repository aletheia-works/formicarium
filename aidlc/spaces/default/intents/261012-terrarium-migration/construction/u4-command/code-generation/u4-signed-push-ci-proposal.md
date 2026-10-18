# 提案：U4の署名付きpushとCI 1回（U4 Step 9）

作成：2026-10-17。状態：人間の承認待ち。承認を受けるまで、どれも実行しない。

## 1. 前提（確認済み）

- 最後のまとめた確認は、すべて今のsourceで成功した。
  - U1の36試行：36件pass。
  - U3の受入：completion-7da35e2a。coverage 86.42%、正式36試行pass。
  - U4の受入：completion-028df58c。22工程pass、coverage 92.16%、正式36試行pass、B1の31 checkはすべてpass。
  - U1のv11：20工程pass、verifyで `currentSourceVerified:true`。
- U1〜U3のcheckpointは承認済み。
- U4の受入で残る条件は、署名付きCIを独立に確かめることだけ（blocker：「new U4 signed CI not independently verified」）。
- workflow `.github/workflows/migration-command-u4.yml` は、`codex/terrarium-migration-u4` へのpushでだけ動く。権限は `contents: read`、timeoutは360分。
- U4のCIは `ci/migration-command/inputs.bundle.json` を使う。このbundleは、まだ作っていない。
- U3のbranch `codex/terrarium-migration-u3@origin` は 7c7ceaf4 である。

## 2. 見つけた問題：WIPのcommitに、関係のないfileが入っている

U4の作業を一時的に外したときのcommit `ooykonwq`（WIP: U4 command Steps 1-7）には、次も入っている。
- 別のintent `261006-npm-terrarium-release` の記録：2774 file。
- 別のintent `261010-bun-ci-modernization` の記録：197 file。
- `package-lock.json` の削除。7c7ceaf4にはあり、main@originにはない。

これらはU4の変更ではない。そのままpushすると、関係のないfileを公開することになる。そこで、U4のcommitに入れるfileを選ぶ。

## 3. 手順（承認後に、この順で1つずつ実行する）

1. U4のCI入力bundleを作り、検査する。

   ```bash
   export PATH=/Users/mutoakio/.local/share/mise/installs/node/26.12.0/bin:$PATH
   node scripts/migration-command/ci-inputs.js prepare ci/migration-command
   node scripts/migration-command/ci-inputs.js inspect ci/migration-command/inputs.bundle.json
   ```

   payloadのbytesは、U3のbundle（`ci/migration-install/payload/`）と同じ見込みである（同じ入力の一覧を使うため。推測）。gitは同じ中身を1つにまとめて保存する。違う場合は、大きさを報告して止める。

2. bundleだけを追跡する。jjは1MiBより大きい新しいfileを自動では追跡しない。このコマンドに限って上限を上げ、ほかのfileは自動で追跡しないようにする（別のintentの大きなzipを入れないため）。

   ```bash
   jj --config 'snapshot.auto-track=none()' --config snapshot.max-new-file-size=300MiB file track ci/migration-command
   ```

3. U4のcommitを作る。working copyをWIPに合わせ、入れるpathだけを最初のcommitに分ける。残り（別のintentの記録と、`package-lock.json` の削除）は、その上のcommitとしてローカルに残し、pushしない。

   ```bash
   jj squash --from @ --into ooykonwq
   jj split -r ooykonwq -m "Complete the U4 command API, fix blink.log and align U1-U3 with the 23-file distribution" \
     runtime scripts tests types docs .github README.md package.json bun.lock mise.toml tsconfig.json tsconfig.tests.json \
     integration ci/migration-command \
     aidlc/spaces/default/intents/261012-terrarium-migration aidlc/active-memory aidlc/spaces/default/codekb
   ```

   入れるpathは、上のとおりである。U4の変更、U1〜U3の引受け、このintentの記録、記憶file、codekbを含む。入れないのは、`aidlc/spaces/default/intents/261006-*`・`261010-*` と `package-lock.json` である。分けたあとに、次を確かめて報告する。
   - U4のcommitのfile一覧。
   - 親が7c7ceaf4であること。
   - 入れないfileが含まれていないこと。

   `aidlc/active-memory` と codekb の変更を入れるかどうかは、中身を見てから判断する。迷うものは入れずに、報告する。

4. bookmarkを作り、署名付きでpushする。

   ```bash
   jj bookmark create codex/terrarium-migration-u4 -r <U4のcommit>
   jj git push --remote origin --bookmark codex/terrarium-migration-u4
   ```

   署名はpushのときに行う（`git.sign-on-push`）。SSH agentが空なら `ssh-add --apple-load-keychain` を実行し、もう一度pushする。署名は無効にしない。

5. CIは1回だけ。pushで自動的に始まる。runが終わったら、次を取得して保存する。
   - GitHub REST（run・jobs・commit・artifacts）。
   - artifactのZIPと、そのdigest・size。

   ```bash
   gh run list --repo Marukome0743/formicarium --branch codex/terrarium-migration-u4 --limit 1 --json databaseId,headSha,status,conclusion
   gh api repos/Marukome0743/formicarium/actions/runs/<RUN_ID>
   gh api repos/Marukome0743/formicarium/actions/runs/<RUN_ID>/jobs
   gh api repos/Marukome0743/formicarium/commits/<HEAD_SHA>
   gh run download <RUN_ID> --repo Marukome0743/formicarium --dir .artifacts/migration-command/ci-<RUN_ID>
   ```

   取得したら、独立に照合する。照合する項目：
   - 署名がVerified であること。
   - headのSHAがU4のcommitと一致すること。
   - packが同じであること。
   - 生の証拠（runner台帳、B1 JSON）がそろっていること。
   - 同じ候補であること。

   失敗したら、基準を変えずに止め、出力を示して相談する。再試行は、別に承認を受ける。

## 4. この承認に含めないもの

- mainへのmerge、PRの作成、公開。
- U4 Step 10：最終レビューと、U1〜U4を覆う新しい読取り専用の検証コマンド。CIのあとに、実コマンドを示して承認を受ける。
- 別のintentの記録をどう扱うか。ローカルのcommitとして残すだけで、pushはしない。

## 5. 注意

- CIは、push後の最初の1回だけを使う。
- U4の正式36試行のうち、biome/firefoxの中央値は2838.9msで、基準まで約160msしかない。CIの機械（ubuntu-24.04）では、超える可能性がある。前のU3のCIでは3006.24msで不合格になったことがある（推測ではなく過去の記録）。超えたら、基準を変えずに止めて相談する。
