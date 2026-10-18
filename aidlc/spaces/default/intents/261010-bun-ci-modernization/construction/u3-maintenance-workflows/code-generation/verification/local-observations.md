# U3 ローカル観測

実行者はmain session `/root`。作業場所は `/Users/mutoakio/Documents/formicarium`。2026-10-10 UTCに逐次実行した。固定実体はBun 1.4.2、Node 24.21.0、Biome 2.5.15。外部GitHubへの書込み・設定変更は行っていない。

## 取得層（検証済み）

`mise run install-frozen && mise run typecheck && mise run build` はexit 0。Bunの固定依存導入は58 installs、84 packages、変更なし。

初回の `mise run build` はexit 1。archive.tsとgithub.tsのconstructor parameter propertiesが既存 `erasableSyntaxOnly` に対しTS1294となった。通常field宣言とconstructor代入へ局所修正し、設定を変更せず同commandを再実行してexit 0。

`/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test .build/tests/tooling/maintenance-acquisition.test.js` はexit 0、トップレベル8項目、subcase込み41 pass、0 fail、0 skip、785.627 ms。

HTTP headers・redirectでのBearer非転送、10秒/60秒のbudget・最大2 retry、8 MiB境界とZIP不正形式、独立したreceipt 2 jobsからAPI 3 checksへの照合、偽producer・CI hash・PR状態等の拒否を観測した。

## 再現層（検証済み）

`mise run build` はexit 0。

`/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test .build/tests/tooling/maintenance-reproduction.test.js` はexit 0、トップレベル8項目、subcase込み28 pass、0 fail、0 skip、1205.139 ms。

実Biomeの整形bytes、実Bunによる固定loopback package/tarballのpatch・minor更新、manifest/lockの完全一致、候補lockとreceiptの照合を観測した。range・major・prerelease・0/2件・追加削除・Actions・不関連lock等の拒否、PR scripts/configの非実行、実U2判定とlint失敗拒否を観測した。

## 書込み層（検証済み）

初回 `mise run build` はexit 1、maintenance-operations.test.tsの拒否tableにTS2345（readonly fixtureとmutable型の不整合）が出た。fixture tableの型を明示する局所修正後、同commandはexit 0。既存tsconfigは変更していない。

`/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test .build/tests/tooling/maintenance-operations.test.js` はexit 0、トップレベル8項目、subcase込み22 pass、0 fail、0 skip、137.030 ms。

模擬HTTPで実際のGraphQL expectedHeadOid/fileChanges additions、REST sha指定squash mergeを捕捉した。head/fork/保護不明/queue等でwrite 0回、正常操作で最大1回、HTTP200 errors・403・409の失敗、未知結果のread照合のみで再送0回、parent/tree照合による成功確認、重複イベント・cancel等を観測した。

## Workflow接続層（検証済み）

承認済み固定Bun commandでbundle生成後、buildはexit 0。初回wiring試験は7 pass、1 fail（BUNDLE_MISMATCH）。BunがU3の相対 `.js` importから隣接するignored生成JSを取り込み、後続buildでその内容が変わっていた。U3の相対importを既存rewriteRelativeImportExtensions対応の `.ts` へ局所修正し、U1/U2 providerを変更せず同生成command（13 modules、87.75 KB）とbuildを再実行してexit 0。

`/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test .build/tests/tooling/maintenance-wiring.test.js` 再実行はexit 0、8 pass、0 fail、0 skip、220.989 ms。固定Bunのtracked bundle完全一致・改変拒否、Node単独起動、writer初期無効・不完全identity拒否、Renovate分離、metadata labels、writer実行境界を観測した。

actionlint 1.7.12で `.github/workflows/maintenance.yml` と `.github/workflows/pr-labels.yml` をshellcheckの固定実体PATH付きで検査し、exit 0、診断なし。

## 結合層（検証済み）

初回buildのTS2345/TS2339は、試験fixture内のreplacementBytesから送信用replacementBase64への明示変換を修正して、同build exit 0となった。

初回integration試験は8 pass、1 fail。mixed source/dependency拒否caseがexpected rejectに対しactual successだった。writerが独立して再取得した全PR filesの分類・初回取得との完全一致を確認し、serialized additionsがPR filesに含まれる条件を追加した。拒否期待値を変更せず、同bundle生成・build・対象試験を再実行した。

`/Users/mutoakio/.local/share/mise/installs/node/24.21.0/bin/node --test .build/tests/tooling/maintenance-integration.test.js` 再実行はexit 0、トップレベル7項目、subcase込み9 pass、0 fail、0 skip、907.772 ms。実ZIP・実Biome/Bun・実U1/U2判定・再取得・atomic writerを通す正常2操作、mixed変更のreject/write 0回、古いhead・producer/archive改変・未知結果再送なし・後続delivery拒否を観測した。

## 最終検査の現状（検証済み）

U3 source/config限定のBiome check --writeは、初回に試験内optional chaining 3 errorsとunused import 1 warningを検出した。該当fixtureのassertとimportを局所修正し、同scoped commandはexit 0（useTemplate infosのみ）。

bundle再生成後の承認済み `mise run install-frozen && mise run check && mise run typecheck && mise run build && mise run test-light` はinstall成功、check exit 1。3 errorsは全てtracked bundleで、noAssignInExpressions、organizeImports、format。既存品質規則の変更や生成物除外は行っていない。最終5 tasks全体は未達。

影響されない `mise run typecheck && mise run build && mise run test-light` はexit 0。tooling 156 pass、0 fail、0 skip、3357.402 ms。既存の実配布物不足による2 skipを保持した。

U3全5ファイルの承認済みcombined commandはexit 0、39トップレベル、subcase込み108 pass、0 fail、0 skip、1279.843 ms。bundle一致を含む局所機能は成功したが、全体lint失敗の代替にはしない。

## 承認された生成手順修正後（検証済み）

ユーザーがbundle-repair-proposal.mdの計画・生成手順修正と再試行を承認した。plan Step9/10/12と試験手順だけを更新し、Testing Contract・39トップレベル・既存lint設定を維持した。metadataを静的importへ変更し、固定Bun生成後に固定Biome `check --write --config-path=biome.json .github/maintenance/runner.mjs` で正規化した。同じ正規化をtemp再生成にも適用した。

mainがscoped整形、固定Bun生成（13 modules、88.71 KB）、固定Biome正規化を逐次実行して全てexit 0。

承認済み `mise run install-frozen && mise run check && mise run typecheck && mise run build && mise run test-light` は今度は全体exit 0。install 58 installs/84 packages、変更なし。Biome全体checkはerrors 0（既存warning 6、info 13を保持）。toolingは156 pass、0 fail、0 skip、3519.662 ms。既存実配布物不足による2 skipを維持した。

同U3 combined commandを再実行しexit 0、39トップレベル、subcase込み108 pass、0 fail、0 skip、1136.938 ms。固定Bun→固定Biomeによるbundle全bytes一致、改変拒否、Node単独起動を含む。新2 workflowのactionlint再実行もexit 0。

この最新結果により上記の最終lint未達は解消した。外部稼働の未検証範囲は引き続き維持する。

## 公式Action確認（ドキュメント根拠）

`actions/create-github-app-token` のv3.2.0はGitHub commits APIでfull SHA `bcd2ba49218906704ab6c1aa796996da409d3eb1`、verification trueを確認した。固定SHAのaction.ymlでNode24、client-id、private-key、repo限定入力、個別permission入力、既定のtoken revokeを確認した。

- https://github.com/actions/create-github-app-token/releases/tag/v3.2.0
- https://api.github.com/repos/actions/create-github-app-token/commits/v3.2.0
- https://raw.githubusercontent.com/actions/create-github-app-token/bcd2ba49218906704ab6c1aa796996da409d3eb1/action.yml

## 限界（未検証）

実GitHub CI、当該SHA配布JSの80% coverage・全realm receipts、実APIでの原子的競合、App/token/保護設定の適用、整形後のCI起動、Renovateの定期稼働は未検証。ローカルfake HTTP試験を外部稼働成功とは扱わない。

miseのcache書込み権限warningとNode stripTypeScriptTypes experimental warningが出たが、成功と記したcommandのexitは0だった。

## Build and Testからの修正再現（2026-10-10、main実行、検証済み）

新attemptで追加回帰を生成後、`mise run build` はexit 0。Node24.21.0実体で `node --test .build/tests/tooling/maintenance-wiring.test.js .build/tests/tooling/maintenance-reproduction.test.js .build/tests/tooling/maintenance-integration.test.js` を実行しexit 1、48 tests、42 pass、6 fail（親test失敗も件数に含む）、0 skip、1857.888875 msを観測した。

実tracked policyに外部IDだけを補った正常経路は `INVALID_POLICY` で失敗した。prepare専用read-only App tokenが存在しない検査とformat writerのAdministration read不足も失敗した。親の秘密情報が再現childへ転送されない既存allowlist境界は成功した。

protection-permission subcaseは期待rejectに対してsuccessだった。fake transportが実際のprotection endpointへ403を返したかを先に確認し、この結果だけでproductionの不具合と断定しない。修正後は同じ3file commandでGreenを確認する。旧attemptの成功記録は新追加回帰の成功を示さない。

fixture確認でformat操作は保護APIを呼ばず、依存操作のprepare/mergeで読むことが判明した。403試験を実依存取得→observeProtectionへ移し、保護read 1回・拒否・write 0回を検証した。format writerへのAdministration read要求は過剰なので追加しない。

production修正前、再build exit 0後の同3file commandはexit 1、47 tests、43 pass、4 fail（2subcase＋2親）、0 skip、1255.436167 ms。失敗はtracked policy正常化とprepare専用read-only認証不足の2件に限定された。正しい403経路とchild秘密非転送は成功。この再現を修正根拠にする。

## 修正後の再検証（main実行、検証済み）

tracked policyへci.ymlの完全pathを追加し、prepareへrepo限定read-only App（contents/actions/checks/pull-requests/administration read）をtrustedツール導入後に取得するstepを追加した。format writerへAdministration権限は追加しない。外部設定は適用せずwriter無効を維持した。

最初の修正後buildはexit 0、同3file試験は46 pass/1 fail。旧未設定IDの期待INVALID_POLICYに対し、path不備の解消後は既存positive(null)のINVALID_APIで拒否された。拒否を維持し旧試験の期待名のみ正確に訂正した。

- 固定Biome2.5.15の変更3試験/policy限定check --writeはexit 0。固定Bun1.4.2生成（13modules、88.71KB）→固定Biome正規化もexit 0。
- 再build exit 0後、同3file commandはexit 0、47 pass/0 fail/0 skip、1403.20825 ms。Redで失敗した実policy正常化・prepare認証供給が成功し、403拒否/write 0・child秘密非転送も成功した。
- 承認済み `mise run install-frozen && mise run check && mise run typecheck && mise run build && mise run test-light` は全体exit 0。toolingは208 pass/0 fail/0 skip、15070.983125 ms。既存lightの177 pass/2既存skipを維持した。lintの既存warning/infoを成功件数へ置換しない。
- U3全5file commandはexit 0、39トップレベル、110 pass/0 fail/0 skip、1373.634166 ms。固定bundle全bytes一致・単独Node起動・改変拒否を含む。
- actionlint1.7.12（shellcheck0.11.0明示）によるmaintenance.yml/pr-labels.ymlはexit 0。

今回の修正でruntime TS変更は不要だった。既存isolatedEnvironmentのallowlistを追加回帰で検証した。局所結果は実GitHub App設定・保護API権限・実CI・80%配布coverage・全realm receiptsの外部受入れ成功を示さない。
