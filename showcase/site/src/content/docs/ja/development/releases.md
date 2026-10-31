---

title: パッケージの公開
description: formicarium の版が、リリース PR から npm に届くまで。
---

公開は vivarium と同じく自動化しています。release-please が Conventional Commits からリリース PR を作り、
必須のチェックが通った後のマージが、その版の承認です。マージすると、対応する `v<version>` のタグと GitHub Release ができます。
`publish.yml` が、検証したパッケージを trusted publishing（OIDC）で npm に公開します。
vivarium や paludarium と同じく、プレリリースの版（RC）は出しません。どの版も安定版として npm の `latest` に
公開します。CI の「リリース候補」は公開する tarball の検証のことで、プレリリースの版ではありません。

## 版と契機

`package.json` と release-please の manifest は同じ版を持ち、安定版のタグと GitHub Release も同じ版です。
リポジトリの root の開発用パッケージは private のままで、stage した配布物が public です。

showcase（`showcase/`、`mise-tasks/showcase/`、`mise-tasks/showcase-site/`）だけを変えるコミットは、次の版の計算に入りません。
サイトは単独で配布され、npm のパッケージは変わらないからです。release-please は `exclude-paths` でそのコミットを飛ばします。
`exclude-paths` はディレクトリしか照合しないので、`showcase*.yml` のワークフローも変えるコミットは数えられます。

release-please は変数 `RELEASE_AUTOMATION_ENABLED` で有効にします。`release-merge.yml` は毎週月曜の 00:23 UTC に、待っているリリース PR の auto-merge を有効にしますが、変数 `WEEKLY_RELEASE_MERGE_ENABLED` も `true` のときだけです。今は `false` なので、リリース PR は手でマージします。
タグは organization の bot（`BOT_CLIENT_ID`、`BOT_PRIVATE_KEY`）が作るので、Actions を起動できます。
npm が信頼するのは、リポジトリ `aletheia-works/formicarium`、ワークフロー `publish.yml`、環境 `release` の組だけです。

## 公開前のチェック

リリース PR では、CI のすべてのグループが動きます。lint・型検査・軽いテスト、native の基準値と Node.js・Chromium・
Firefox・WebKit の回帰テスト、macOS と iOS Simulator の実際の Safari、そしてリリース候補の検証です。候補の検証では実際の tarball を作り、配布する
23 個の JavaScript ファイルの行カバレッジが 80% 以上であることを求めます。候補は 1 回だけ作り、Node.js と各ブラウザが
並行するジョブでその同じバイト列を検証します（どのジョブも 1 ワーカー・再試行なし）。最後のジョブが結果とカバレッジを
まとめ、同じ入力と同じ計測用コードで測ったものだけを数えます。

`publish.yml` は GitHub API を自分で読みます。同じリポジトリの `aletheia-works-bot` によるリリース PR がちょうど 1 つ
マージされていること、`main` の上のそのマージ commit、その head の CI の成功を求めます。手動のタグ、fork、
失敗した CI や古い CI、`v0.2.0-rc.1` のようなプレリリースのタグは拒否します。

その後、タグのソースで再利用可能な `ci.yml` を、同じビルド・回帰テスト・カバレッジでもう一度動かします。
タグを付けた commit は PR の head とは別なので、PR の結果は使い回しません。パッケージは、この実行の wasm のビルド・
ソース・版・試行から作り、何かを書き込む前に `ci-required` が通っている必要があります。失敗したジョブだけを
再実行すると、候補は前の試行で通ったパートと再実行したパートをまとめたものになります。GitHub は持ち越したジョブを
新しい試行のものとして返すので、公開はこの候補を受け入れます。どのパートも同じ候補のバイト列を検証しています。
バイト列は `prepare` だけが作り、`prepare` を再実行するとすべてのパートも再実行されるためです。

## 公開

実行が成功すると、候補の digest と artifact の名前を出力します。npm への公開の手順はその tarball だけを受け取り、
SHA-256 を確かめてから `bunx npm@latest publish --provenance --access public --tag latest` を実行します。
npm の token による代替はありません。

公開の前に registry を問い合わせます。まだない版は公開し、すでにある版は、取得したバイトの SHA-256 が同じときだけ
飛ばします。バイトが違う場合や registry のエラーでは、公開を止めます。検証した tarball は、既存の資産や説明を
置き換えずに、release-please の GitHub Release に添付します。結果が分からない公開を、確かめずに送り直すことはありません。

公開した版に不具合があれば、次の patch の版で直します。それ以上の公開は止め、最後に問題のなかった版を案内します。

## テスト

ワークフローの shell の手順は、偽の GitHub・registry の応答と、偽の書き込み先でテストしています。リリース・head・
ソースの識別、CI の失敗、版のずれ、tarball の改変、カバレッジによる拒否、同じ版からの回復を確かめます。
リリース PR と、候補の検証そのものを変える PR の CI では、実際の候補の準備・回帰テスト・カバレッジが動きます。npm の OIDC とタグの承認は、実際のリリースの
タグでしか確かめられません。

`scripts/release/` には、保存してある 0.1.0 の証拠を確かめる道具も残っています。公開はできず（`writerEnabled` が
`false`）、上の公開の流れには関わりません。
