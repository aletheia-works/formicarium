# Unit Test Instructions — U3

## Status and Runner

計画段階、U3未実装・未検証。Plan Approval後main sessionだけが全install/build/testを逐次実行する。既存Bun1.4.2/Node24.21.0/Biome2.5.15とstrict TypeScript/node:test、U1 tasksを使う。新tests/toolingは既存test:light globで取り込むためprovider設定を編集しない。直接実行実体はmise ls/設定から解決しshim/mise execを使わない。Node builtin依存の実行とBun開発/再現を分ける。

## Preparation Commands

層ごとmainが既存build成功を確認してから対応生成JSを実行する。source test作成前に欠落JSを実行しない。declared tasksはmise runで実行する。

```sh
mise run install-frozen
mise run typecheck
mise run build
```

tracked bundle生成・正規化（bunとbiomeはmise管理の固定Bun1.4.2・Biome2.5.15実体へ解決）：

```sh
bun build scripts/maintenance/runner.ts --target=node --format=esm --packages=bundle --outfile=.github/maintenance/runner.mjs
biome check --write --config-path=biome.json .github/maintenance/runner.mjs
```

新依存なし。runnerのmetadataを静的importにしてBun dynamic import helperを不要にする。生成入口bundle.tsも同じ固定版/引数を配列で使い、temp出力へ同じ固定Biome check --writeとtrusted baseの既存biome.jsonを明示して正規化した後、全bytesをtracked runnerへ照合する。lint設定・U1 tasksは変更しない。writer側ではこのcommandもinstallも実行しない。

## Scoped Layer Commands

```sh
node --test .build/tests/tooling/maintenance-acquisition.test.js
node --test .build/tests/tooling/maintenance-reproduction.test.js
node --test .build/tests/tooling/maintenance-operations.test.js
node --test .build/tests/tooling/maintenance-wiring.test.js
node --test .build/tests/tooling/maintenance-integration.test.js
```

順に8/8/8/8/7トップレベル試験、各拒否表はnamed subcaseとして全境界をassertする。実装→試験作成→mainの同層Green→次層を守る。layer単体importで他testが登録されないようfixtureはその試験に閉じる又は非test moduleの適切なsource helperを使う。

最終U3限定command：

```sh
node --test .build/tests/tooling/maintenance-acquisition.test.js .build/tests/tooling/maintenance-reproduction.test.js .build/tests/tooling/maintenance-operations.test.js .build/tests/tooling/maintenance-wiring.test.js .build/tests/tooling/maintenance-integration.test.js
```

新workflowだけの静的検査：

```sh
actionlint .github/workflows/maintenance.yml .github/workflows/pr-labels.yml
```

actionlintとshellcheckもmise管理実体を解決する。既存全suite commandへ対象commandを差替えない。既存5tasksと既存light成功はmainの完了検査で別途確認する。

## Acquisition Fixtures — 8 Cases

正常REST/GraphQL requests・headers・variablesを捕捉するfake fetch/transport、有限時計・AbortSignal、実ZIP header/deflate/CRC fixtureを使う。compressed/展開/JSON/source/diff 8MiB丁度と+1、member16/17、500filesと超過を固定bytesで試験し、超過streamはcancelされcopy/hash/parserへ進まないことをassertする。虚偽Content-Length、長さ未申告、redirect、zip path/symlink/duplicate/CRC/未知形式を含む。

read10秒/全60秒/retry最大2回はfake clockで観測しreal sleepを使わない。権限403、rate-limit、timeout、cancel、pagination打切りは成功としない。run/attempt/repo/head/PR/producer AppID/workflow path・hash、artifact actual digest、receipt2job→API3check、toolchain/lockを独立objectで作り個別改変を拒否する。

## Reproduction Fixtures — 8 Cases

実Bun/Biomeの小さいtemp fixtureをmain test実行内で逐次呼ぶ。trusted configとtrusted manifestだけを実行環境へ渡す。敵対PR scripts/config/registry、UTF8以外、symlink/delete/rename/binary、公開境界変更のfixtureで実行0回又は拒否を確認する。整形完全bytes/digestとno-op矛盾、stable唯一直接dev更新・resolved from/to・lock bytes完全一致を検証する。range/major/pre/0/2/追加削除/Actions/mixed・不関連transitive lockは拒否する。

Bun/network再現のfixtureはローカル固定package metadata/assetを使い外部registry通信・外部writeを行わない。実installを使うfixtureは受動データだけ、ignore-scriptsと無credentialを確認する。無変更guestの再buildは行わない。実U2 adapter/policyを通し必要3checksのlint失敗整形拒否を維持する。

## Operations Fixtures — 8 Cases

外部API形式と原子的head引数の試験はfixed fake HTTPで実requestを捕捉する。GraphQL expectedHeadOid/fileChanges additions、REST PUT merge sha/merge_method=squash、固定Conventional Commitをassertする。事前GETだけで成功とするfakeは禁止する。直前再GETでhead/open/sameRepo/checks/保護/botが変わるcase、queue/stacked/削除branchを拒否する。

全reject/no-opでwrite0回、各allowで最大1回。HTTP200 GraphQL errors、403/409、timeout/cancel、結果照合success/failure/unknown、重複イベントはnamed tableで検証しwrite再送0回をassertする。ログ/Attemptにcredential/API本文/任意PR本文がないことも確認する。

## Wiring and Integration Fixtures — 8 + 7 Cases

設定・workflowは実ファイルを読み、Renovate周期/bun/actions分離/単一更新/自身automerge無効、label複数カテゴリ/fork/無関連/敵対本文、必要3checks/producer/actor immutable設定、trigger/timeout/権限/concurrency/artifact7日をassertする。write jobのinstall/build/PRcheckout無し、trusted SHA固定・bundle供給を拒否境界として確認する。Node builtinだけのbundleを固定Bunでtemp再生成し、固定Biome check --writeで同じtrusted configに正規化してtracked全bytes一致・改変拒否とNodeの無依存実行を観測する。Action SHAは公式repo tag/release/action.ymlの確認結果と対応させる。

結合7件はfake HTTPの実取得→実bounded decode→U1 receipt正規化→小さい無権限再現→実U2→再GET→固定APIの経路を通す。C2/C3をallow stubへ置換しない。正常2操作と主要拒否表で起動回数を観測し、byte/CI改変/偽producer/古いhead/依存件数/通信不明/重複を網羅する。

## Pass and Records

U3限定39トップレベル件、fail0/skip0、named拒否表全合格が局所条件。build/type失敗なら古いJSを結果に使わない。不具合はmainが同一再現試験Redを観測してから修正し同commandのGreenを確認する。Plan Approval後は本手順書・計画内容を書換えず、結果はverification/local-observations.mdへmain実行者/日時/checkout/実体版/command/exit/pass/fail/skipと記録する。

実GitHub CI・当該SHA固定配布JS80%coverage/全realm receipts・real atomic競合・App/token/保護適用・format後CI起動・定期更新稼働は別途未検証として記録する。局所fake試験成功を外部稼働成功と報告しない。

