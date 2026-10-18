# terrarium廃止と機能移管：実行用要約

2026-10-12。詳細原文：`/Users/mutoakio/.codex/attachments/fdf6a7c0-5d64-49d9-81f5-94aa4753f484/貼り付けたテキスト.txt`。原文の現状記述は再確認が必要。正式公開はGitHub・npmで0.2.1まで確認済み。

## 目的と境界

依存をvivarium → formicariumの一方向にする。formicariumは汎用Linuxエミュレータ、ゲスト検証API、コマンド層とinstallを提供。最新安定版のCLIデモは隔離したshowcase/に置く。vivariumは再現UI・verdictとrecipeで固定したゲストのビルドを持つ。terrariumは移行完了後に案内ページを配布してアーカイブする。フェーズ7まで既存terrariumを維持する。

## 決定事項と未決事項

- 最新安定版ビルドはformicarium/showcase、固定refビルドはvivarium。回帰用ゲスト・fixtureは固定版のまま、デモと分離する。
- コマンド分割、ls/cat/rm -rf/cd、ゲスト検証とfixture変換はformicariumの公開APIに集約。シェル構文のパイプ・変数展開・リダイレクトは明示的に拒否。
- install <tool>[@<versionまたは名前>]はホストJSで処理。検証済みカタログだけを使用し、任意URLを拒否。取得・必要な展開・SHA256・静的x86-64 ELF・build-infoを検証しセッションに登録。進捗コールバック、原因のあるエラー、reset/dispose時の消去を提供。失敗時の別URL切替・再試行はしない。
- ゲスト内部はネットワーク・シェル・パッケージマネージャを提供しない。エミュレータコア固有知識はruntime/coreに限定し、C forkのJITは対象外。
- Contract v1にruntime.name=formicariumを追加しterrariumはdeprecated互換として残す案。固定ref成果物はGitHub Release保存を推奨（Actions cache案との選択は確認）。npm/JSR既存版は削除せず最終版でdeprecate。
- GitHub Release直接fetchはフェーズ0でCORSを確認できた場合のみカタログURLとして使用。不可なら同originのPagesへミラー。installが遅い場合は設計変更または事前導入方式へ戻す。
- 推奨・候補は確定扱いにせず、必要な意思決定を質問する。公開・deprecation・アーカイブ等は具体的内容を提示して人間承認を得る。

## フェーズと受入条件

0. formicariumでaube公式musl tar.gzとBiome muslバイナリをChromium/Firefox/WebKitで測定。fetch→展開（DecompressionStream）→SHA256→ELF検証→--versionの工程時間と、GitHub Releaseリダイレクト込みのCORSをdocs/resultsに記録。非ダウンロード工程が数秒を超える場合は設計を見直す。
1. 公開guest API（ELF/build-info検証、fixture→FsEntry）、共通コマンド層、installを実装。terrariumの既存unitを移植し、不正digest・動的ELFの拒否とinstallをNode/3ブラウザで試験。README/AGENTSの古い公開状況を訂正。0.3.0を公開しterrariumを追従させ、個人アカウントのinputs.tar.gz依存をnpm公開APIへ置換して既存チェックを通す。
2. vivarium recipeのguestsでtool/repository/40桁commit/fixtureを宣言。branchやPRは参考情報で、作成時にcommitへ解決する。nativeビルダーを移し、(tool,repository,commit,ビルダーハッシュ)で成果物を保存・再利用。build-infoにsource URL/commit/target/rustc/sourcePatchesを記録。pitchfork UIのaube等も固定。ELF/build-infoだけをCIで検証し、verdict期待値はrecipeテストへ移す。同じinstallカタログ形式を出力。Biomeのbaseline/fixをビルドし2回目は再利用。bump-upstreamはブランチcommitを直接参照。
3. vivariumがformicarium/browserをbundleしWorker/資産を同originから配布。既存COIとCSP要件を維持。xterm端末はready/run/transcript互換を保ちコマンド層を利用。biome-migrate-prettier fixtureをrecipe配下へ移し、実行前にcommit/SHA256を固定値と照合。before=asNeeded/single、after=always/doubleの検証をrecipeに移す。biome-12265が3ブラウザでreproducedとなり旧verdictと一致すること。
4. vivariumのloader/proxy/middleware/builds.json依存と旧テストを整理。Contract/schema（guests含む）・en/ja文書・テンプレート・説明を更新。deprecated互換記述以外のterrarium参照が残らないこと。
5. formicarium/showcase/{tools.json,builders,scripts,fixtures,site,tests}へ最新安定版ビルドを移管。aube/pitchfork/Biomeの解決・取得・検証・カタログ化、公式musl資産が無い場合のソースビルドを移す。ツール固有条件は設定データへ。showcaseは公開APIだけを使用しruntime内部import禁止、本体からshowcase依存禁止、fixture非共有を機械検査する。専用CIは公開済み/ビルド済み本体資産を利用し重い本体CIと分離。Node/3ブラウザで全3ツールの--version成功。
6. Astro/StarlightのCLIカード・デモをshowcase/siteへ移す。空の端末からinstallできる導線（個別ページは事前導入可）。Pagesトップはエミュレータ説明、一覧は/tools/。毎日のビルドと受入後のデプロイ、失敗時は前回サイト維持。Pagesで全3ツールを実行できること。
7. 利用者・npm/JSRダウンロード・GitHub dependentsを確認。承認後に最終版/deprecation、Pages案内、README更新、terrariumアーカイブ、OpenTofu state/組織ruleset等を整理。個人inputs.tar.gz参照が全関連リポジトリからなくなること。

依存順序：0→1→2→3→4、1→5→6、4と6→7。各フェーズは単独でマージ可能なPRに分割。最初にフェーズ0と、Biome baseline commit 2405c762…の1件だけをvivarium CIでビルドしてformicariumで--versionする小さな試行を行う。試行は公開API完成前に旧入力アーカイブを一時利用可。完全commitはrecipe等から確認し、省略値でビルドしない。複数作業の実行は必要な依存確認後に行い、測定中は重い並行負荷を避ける。

## 品質と将来の切り出し

既存品質限界（probe600秒、aube browser840秒、1worker/retry0、1GBメモリ、native完全一致）を緩和しない。計測は実測・未検証を区別し、Safari実機の未検証をWebKit成功で置き換えない。installカタログに動的ELFを載せない。移行切替はPR単位で戻せるようにする。

showcase独立化は、ツール十数個超・CIが本体開発を妨げる・外部利用者が増える・独立したリリース/保守が必要、の2条件以上で検討。移動対象をshowcaseと専用workflowに限定できる境界を維持する。
