# Modernization実CIの実行承認

## 対象

公開先 `aletheia-works/formicarium` の検証専用新規ブランチ2本へ、署名済みローカル候補をpushし、今回専用変数を設定した後、既存のworkflow ID `380467087`（`.github/workflows/verify.yml`）をソースブランチ指定でmanual dispatchする。

| 用途 | Branch | Commit |
|---|---|---|
| 検証ソース | codex/verify/bun-ci-modernization-v1 | 7fc23afedef9a2296cb24026c0f19998a6933da7 |
| 固定入力 | codex/inputs/bun-ci-modernization-v1 | 0cb57c28d00933dbb67c25ba41df659749102419 |

ソースは公開済みmain `12a92eabf70f6772f11e33f698e3db5088992270` を基点とする1コミット、76ファイル変更。4単位のmanifestにある74現存ファイルは元作業コピーと全byte一致、package-lock.json削除を含む。単位外の変更は0。例外は検証専用に既存 `verify.yml` を現在の `candidate-verify.yml` と同じread-only/manual-only内容へ配置した1ファイル。過去の診断・フック修正はコミットと履歴から除外した。検証用配置は統合対象の選定時に区別する。

入力ブランチはmain基点の1コミット、`MODERNIZATION-INPUTS.md` と `modernization-inputs.tar.gz` の2ファイル。

## 固定入力と変数

- archive: 104592600 bytes
- SHA256: `78bc6e0a9624124a79bc7ce9fbe85c5ebd2721759f1578cca8d1efcef63007fe`
- source pins: 222 files
- payload: 1373 files / 229169203 bytes
- archive members: manifestを含む1374、展開229532041 bytes
- 新private検証tarball: `742e1c368bd913d786c6baa3c5d1e1e82cbc252e38e0cc78429f9f1098bc30ca`

設定するrepo変数は今回専用の2件だけ。

`FORMICARIUM_MODERNIZATION_INPUT_URL`:
`https://raw.githubusercontent.com/aletheia-works/formicarium/0cb57c28d00933dbb67c25ba41df659749102419/modernization-inputs.tar.gz`

`FORMICARIUM_MODERNIZATION_INPUT_SHA256`:
`78bc6e0a9624124a79bc7ce9fbe85c5ebd2721759f1578cca8d1efcef63007fe`

旧RC用変数・旧rc1-inputsブランチを変更しない。新候補の24ファイルをsite/consumerにも配置し、guest・ownerの固定入力は保存した。旧CIの成功結果は今回の証拠に使わない。

## 検証済み

- U4: 39top/76pass、既存release61pass、独立レビューREADY/R-01 Fixed、正式checkpoint 76ce3e39-7ef5-43a2-8bfe-b6f7f35a6d60 exit0/evidence unchanged=true。
- Bun frozen導入・lint・型検査・build・軽量試験の承認済み5tasks成功。対象外ソースを除いた隔離候補でもexit0、tooling234pass/0fail/0skip（26704.4275ms）。既存lightのskip2件は成功へ変換していない。
- 新候補の外部Node consumer統合189pass/0fail/0skip。
- workflow5本および検証用verify.ymlのactionlint成功。
- archiveの全member kind/path/byte/digestと固定source pinsを照合。macOS AppleDouble混入を検出して除去し、最終再照合成功。private key/GitHub/npm tokenの既知形式は0件（全秘密検出の保証ではない）。
- JamBalaya56562で公開先のadmin/push権限をread-only確認。

## 実行内容・費用・境界

jjでupstreamへ上記bookmarkだけをpushする。署名を維持し、GitHub上のVerifiedとhead SHAを確認してから固定URLを照合する。変数を設定し、既存workflowを検証ソースrefで1回起動する。ジョブはcontents readのみ、最大360分。Node/native/browser回帰・固定配布JS24ファイルの全realm receiptsと行coverage80%以上を実測する。GitHub Actions料金は契約と消費枠に依存する。

main更新・PR作成/merge・タグ・npm publish・GitHub Release・保守App/secretの適用は含まない。これらの外部操作は承認前に行わない。実CIと全realm coverageは現時点で未検証で、Build and Test全体の成功判定は実結果確認後とする。

今回の外向きpushはAGENTS.mdの事前承認条件に該当する。以前のRC検証・公開承認は別intent/別SHAであり、本操作への承認として流用しない。
