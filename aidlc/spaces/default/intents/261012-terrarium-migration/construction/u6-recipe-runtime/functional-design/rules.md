# U6 recipe-runtime の業務規則

## Sources

`entities.md` と同じ。人間の回答は `functional-design-questions.md`（Q1–Q12、2026-10-18）。review-01（NOT-READY、Major 4・Minor 8）の指摘 R-01〜R-12 を反映した。この資料は設計で、実装・動作の主張ではない。

## Rules

```yaml
rules:
  # BR1: recipeと固定入力
  - id: BR1.1
    statement: formicarium runtime のrecipeは expected_runtime=formicarium を宣言し、guests[] を必須とする。
    category: validation
    applies_to: Recipe
    trigger: recipe.json の検証（schema検証と recipes index の生成）
    logic: IF expected_runtime=formicarium AND guests が無い又は空 THEN 拒否する。guests なしの他のruntimeのrecipeは従来どおり受理する。expected_runtime は schema では文字列で、受理する値の集合は試験側の SUPPORTED_RUNTIMES と schema の説明文で決まる。
    violation: index生成を失敗させ、原因（slug と欠けたfield）を示す。latestで補わない。
    source: FR10, FR12
  - id: BR1.2
    statement: guests[] の role は baseline と fix のどちらかで、recipe内で一意。baselineは必ず1件、fixは0〜1件。
    category: validation
    applies_to: RecipeGuest
    trigger: recipe.json の検証、上流の fixed-guest-bump・fixed-guest-build
    logic: IF role が重複 OR baseline が無い OR 未知のrole THEN 拒否する。上流の fixed-guest-bump は入力・PRのbranch名（fixed-guest-bump/<slug>-<role>）・titleに role を含め、role で対象を選ぶ。
    violation: 検証失敗。
    source: FR10
  - id: BR1.3
    statement: guestの repository・commit・tool は、上流builderの宣言の規則（https://github.com/<owner>/<repo> の小文字の正規形、allowlist、40桁commit）に従う。
    category: validation
    applies_to: RecipeGuest
    trigger: recipe.json の検証、fixed-guest-build
    logic: IF repository が正規形でない OR allowlist外 OR commit が40桁小文字hexでない THEN 拒否する。branch・PR（reference）は説明専用で、buildの入力にしない。
    violation: 検証失敗。
    source: FR10
  - id: BR1.4
    statement: guest の commit は build の入力で、受入済みの成果物は accepted に別に持つ。site と実行は accepted だけを使う。
    category: constraint
    applies_to: RecipeGuest
    trigger: recipe.json の検証、bump、site build
    logic: accepted = {commit, versionOrName, buildKey, elfSha256, buildInfoSha256}。5つが揃っていなければ accepted は無いものとする。bump は commit だけを動かし、accepted は変えない（Q12=A）。accepted.commit と commit が違う間も、site は accepted の成果物で動き続ける。
    violation: accepted の field が一部だけなら検証失敗。
    source: FR10
  - id: BR1.5
    statement: baselineの commit は、recipeを作る時点の biomejs/biome main の先頭を40桁へ解決した値とし、以後は上流の fixed-guest-bump の PR で main の先頭を追う。bump の実行は今のとおり人が dispatch する。
    category: policy
    applies_to: RecipeGuest(role=baseline)
    trigger: recipe作成、fixed-guest-bump
    logic: bump は main の先頭を直接解決し、commit だけを更新する。新しい commit の build が失敗したら accepted は前のままにし、失敗を記録して人の判断に回す（自動で古い commit へ戻さない）。
    violation: なし（accepted が残るので site は止まらない）。
    source: FR10, FR11
  - id: BR1.6
    statement: accepted の置き換えは、そのbuildKeyのReleaseを受け入れた後に、人が確認する PR だけで行う。
    category: policy
    applies_to: RecipeGuest
    trigger: fixed-guest-build・release の後
    logic: PR は accepted を、Release の build-info の commit・buildKey・ELF と build-info の digest で書き換える。build-info の commit が guest の commit と同じことを確かめる。
    violation: 一致しなければ PR を作らない。
    source: FR10
  - id: BR1.7
    statement: recipe の状態は active（全guestに accepted があり、formicarium の pin がある）と pending（どれかが無い）の2つ。pending の recipe は他の recipe の index生成・site build・回帰試験を止めず、公開siteに載せない。
    category: policy
    applies_to: Recipe
    trigger: index生成、site build、回帰試験
    logic: IF pending THEN そのrecipeを site と回帰試験の対象から外し、index生成の出力に「pending（理由）」と記録する。合格とも扱わない。最初の recipe の PR（accepted が無い）と、formicarium 0.3.0 の公開前（pin が無い）は pending になる。
    violation: なし。
    source: FR10
  - id: BR1.8
    statement: formicarium runtime のrecipeは fix_candidate を宣言しない。terrarium の builds.json を読んで fix_candidate を進める処理と、その試験は消す。
    category: policy
    applies_to: Recipe
    trigger: recipe作成、upstream-bump
    logic: IF expected_runtime=formicarium AND fix_candidate がある THEN index生成で拒否する（固定入力を guests[] に一本化、Q3=A）。他のruntimeの fix_candidate は従来どおり。
    violation: 検証失敗。
    source: FR12

  # BR2: site build時の取込みと照合
  - id: BR2.1
    statement: formicarium の browser用fileは、vivarium の pin file に書いた npm の固定版 tarball から取り出し、site の同じ origin の1か所に置く。
    category: constraint
    applies_to: FormicariumBundle
    trigger: site build
    logic: pin file は packageVersion・tarballSha256・sourceCommit（その版の tag の commit）・取り出すfileの一覧と各SHA256 を持つ。IF tarballのSHA256が違う OR 一覧外のfileを使う OR entry の path が ../・絶対path・symlink・重複 OR 各fileのSHA256が違う THEN build失敗。CDNから読まない。pin file が無い間は、formicarium の recipe は pending（BR1.7）。pin の更新は人が確認するPRで行う。
    violation: build失敗。前回のsiteを保つ。
    source: FR10
  - id: BR2.2
    statement: guestの成果物は、accepted.buildKey の tag guest-<tool>-<buildKey> の Release から ELF・build-info・catalog を取り、digest と build-info の identity が accepted と一致したものだけを同じoriginへ置く。
    category: validation
    applies_to: StagedGuestAsset
    trigger: site build
    logic: tag は recipe の accepted.buildKey から作り、builder の key 計算を site build でやり直さない。IF 取れない OR ELF・build-info の digest 不一致 OR build-info の tool・repository・commit・buildKey が accepted と違う OR catalog の entry が build-info と違う THEN build失敗。別のtagやlatestを代わりに使わない。
    violation: build失敗（原因と tag を示す）。前回のsiteを保つ。
    source: FR10
  - id: BR2.3
    statement: 取得の時間とサイズは C11 の上限に従う（取得120s、ELF 128MiB、metadata 1MiB、catalog 4MiB、tarball の download 128MiB）。
    category: constraint
    applies_to: StagedGuestAsset, FormicariumBundle
    trigger: site build
    logic: IF 上限を超える THEN 取得を止めて失敗。自動retryしない。
    violation: build失敗。
    source: FR10
  - id: BR2.4
    statement: 分離のための coi-serviceworker.js（v0.1.7、MIT）を、固定した digest で recipe の dir と ja の page 用の写しに置く。
    category: constraint
    applies_to: RecipePage
    trigger: recipe作成、site build
    logic: 入手元は npm の coi-serviceworker@0.1.7 で、file の SHA256 を pin file に固定する。file 先頭の license の注記を残す。今の main には実体が無いので、recipe ごとに新しく置く（今の .gitignore の例外行と bundle-layer1-pages.sh の写しの仕組みを使う）。
    violation: digest 不一致は build失敗。
    source: FR10, NFR8

  # BR3: ブラウザでの実行
  - id: BR3.1
    statement: 端末は crossOriginIsolated の下でだけ起動する。分離されていなければ coi-serviceworker で1回だけ再読込し、15秒で分離されなければ失敗とする。formicarium の module・Worker・wasm は、recipe page が読む同じ origin の置き場から読み、3ブラウザで Worker が分離の下で起動することを試験で確かめる。
    category: constraint
    applies_to: TerminalPane
    trigger: page読込み
    logic: IF crossOriginIsolated=false AFTER 再読込と15秒の待機 THEN state=failed、ready を reject。
    violation: 判定しない（BR4.5）。
    source: FR10, NFR6
  - id: BR3.2
    statement: 各端末は、同じoriginのELFとbuild-infoを取り直し、formicarium の公開API（C03 validateGuest）で accepted の digest と identity を照合してから登録する。
    category: validation
    applies_to: TerminalPane
    trigger: 端末の起動
    logic: IF digest 又は build-info の tool・repository・commit・buildKey が accepted と違う THEN 登録・実行しない。state=failed、ready を reject。
    violation: 判定しない（BR4.5）。
    source: FR10, NFR3
  - id: BR3.3
    statement: fixture は recipe の dir の file から C03 の FsEntry に変え、session の初期FSにする。command は C05 の command session で1行ずつ実行する。
    category: policy
    applies_to: TerminalPane, Fixture, CommandScript
    trigger: 端末の起動・実行
    logic: FsEntry は、/work と /work/app を dir（mode 0o755）、各 file を file（mode 0o644、inodeId は fixture:<path>）とし、fixtureToFsEntries で検証する。command session の catalog は、その guest の Release の catalog.json。検証済みguestを registerValidatedGuest で tool 名 biome に登録する（install は使わない）。cwd は /work/app。
    violation: 変換・登録の失敗は ready を reject。
    source: FR10
  - id: BR3.4
    statement: 1つの端末の run は呼ばれた順に逐次実行する。guest の非0終了は ExitDetail で resolve し、host・core・取消の失敗は reject する。判定の command 列の実行中は、訪問者の入力を受け付けない。
    category: policy
    applies_to: TerminalPane
    trigger: run
    logic: ready の前の run は ready を待つ。command 列が終わってから入力を有効にする。disconnect 後は保留中の run も reject し、古い応答を表示しない。
    violation: reject された run は、その session の結果を error にする。
    source: FR10, NFR7
  - id: BR3.5
    statement: transcript の表示bufferは UTF-8 1048576 bytes 又は 10000行の早い方で、古い先頭を捨てる。判定は各 run の原本 output から行う。
    category: constraint
    applies_to: TerminalPane
    trigger: 出力の表示
    logic: IF 上限を超える THEN UTF-8の文字境界で先頭を捨て、捨てた量を別の通知で示す。run の output は切り詰めない。
    violation: なし（表示だけの制限）。
    source: FR10, NFR7
  - id: BR3.6
    statement: 端末要素は ready・run・transcript だけを提供し、その形（ReadyDetail・ExitDetail）は旧 terrarium の端末と同じにする。terrarium-* のDOM event と iframe の postMessage bridge は作らない。
    category: policy
    applies_to: TerminalPane
    trigger: 設計
    logic: ReadyDetail = {tool, ref, commit, seconds}。ref は guest の reference.branch（表示用）、commit は検証済み build-info の40桁。新しい名前の event も足さない（使う人がいない）。
    violation: なし。
    source: FR10, FR12
  - id: BR3.7
    statement: 2つの端末は baseline、fix の順に起動する。要素が外れたら session を dispose し、Worker と wasm を解放する。
    category: policy
    applies_to: TerminalPane
    trigger: 端末の起動、要素の取り外し
    logic: baseline の ready（又は失敗）の後に fix を起動する。2つを同時に動かせるかは3ブラウザで観測し、失敗（メモリ不足など）はその pane の error として示す。
    violation: なし。
    source: FR10, NFR6

  # BR4: 判定
  - id: BR4.1
    statement: 実行前の確認として、cat .prettierrc が fixture と同じ内容、cat biome.json が {} であることを確かめる。
    category: validation
    applies_to: ReproductionSession
    trigger: 各session
    logic: IF 内容が違う OR exitが0でない THEN そのsessionを error にする。
    violation: そのsessionは判定しない。
    source: FR11
  - id: BR4.2
    statement: biome migrate prettier --write の exit が0でなければ、そのsessionは error。
    category: validation
    applies_to: ReproductionSession
    trigger: 各session
    logic: IF code≠0 THEN error。
    violation: そのsessionは判定しない。
    source: FR11
  - id: BR4.3
    statement: migrate 後の biome.json（ANSI除去、JSON解析）で、includes=["*.js"] の override に bracketSpacing:false があるかを読む。formatter.bracketSpacing 又は javascript.formatter.bracketSpacing のどちらかが false なら corrected、どちらにも無ければ reproduced。
    category: calculation
    applies_to: ReproductionSession
    trigger: 各session
    logic: overrideBracketSpacing = 該当overrideの formatter.bracketSpacing、無ければ javascript.formatter.bracketSpacing、どちらも無ければ null。corrected = (overrideBracketSpacing = false)、reproduced = NOT corrected。該当overrideが無い、又はJSONが解析できなければ error。合否はこの field で決め、設定全体の digest の差では決めない（baseline は main を追うので、fix 以外の変更も差に入る）。
    violation: 解析失敗は error。
    source: FR11
  - id: BR4.4
    statement: verdict は baseline の session だけで決める。fix の結果は fix の pane の状態（ok / error）として示す。
    category: calculation
    applies_to: ReproductionResult
    trigger: 両sessionの完了
    logic: verdict = baseline.reproduced ? reproduced : unreproduced。fix pane = fix.corrected ? ok : error。
    violation: なし。
    source: FR11
  - id: BR4.5
    statement: 起動・照合・実行・解析の失敗は判定ではない。Contract v1 の verdict に error の値が無いので DOM と global の verdict は unreproduced にするが、baseline_error（fix は fix_error）に原因を入れ、page の文に「照合・実行に失敗したため判定していない」と出す。baseline_error がある結果は、回帰試験でも受入でも合格にしない。
    category: policy
    applies_to: ReproductionResult
    trigger: baselineの失敗
    logic: 旧 terrarium の recipe と同じ扱い（失敗時は unreproduced と baseline_error）。FR10 の「不一致時は verdict を算出しない」は、reproduced・corrected の判定を行わないことと読む。
    violation: なし。
    source: FR10, FR11
  - id: BR4.6
    statement: Result v1 envelope の runtime.name は formicarium、version は pin file の packageVersion。bug.issue は issue番号が無い間 0。
    category: policy
    applies_to: ReproductionResult
    trigger: 判定の完了
    logic: extras に fixture の digest、baseline・fix の commit と buildKey、pack の SHA256 を入れる。DOM の verdict と global の値を一致させる。
    violation: なし。
    source: FR10, FR12

  # BR5: 比較の証拠と受入
  - id: BR5.1
    statement: Chromium・Firefox・WebKit で、同じ fixture・command・guest（同じ accepted）を使い、before（baseline）と after（fix）の stdout・設定・exit・verdict と override の bracketSpacing を比べた証拠を作る。
    category: policy
    applies_to: ReproductionComparison
    trigger: U6の受入
    logic: 合格は baseline=reproduced かつ fix=corrected が3ブラウザで同じこと。stdout・設定の digest は記録するが、main の移動を含むので合否には使わない。baseline が corrected なら「最新の main では直っている」と記録し、合格扱いにせず人間の判断に回す。
    violation: 受入不合格。
    source: FR11
  - id: BR5.2
    statement: 受入の証拠は C10 の AcceptanceEvidence（unit=u6-recipe-runtime、RecipeEvidenceIdentity）にまとめ、U6 の profile の必須check（比較の check 名は reproduction-comparison）を満たす。
    category: policy
    applies_to: ReproductionComparison
    trigger: U6の受入
    logic: identity の field の出どころ：sourceCommit=vivarium の commit、formicariumSourceCommit・formicariumPackSha256=pin file、catalogSha256=baseline と fix の catalog.json の SHA256 を {baseline, fix} の正規化JSONにした digest、fixtureSha256・commandSha256=BR5.3、baseline*・fix*=各 accepted。必須checkの欠落・重複・failed・unverified を拒否。実機Safariは別の証拠が無ければ unverified。
    violation: 受入不合格。
    source: FR11, FR12, NFR8
  - id: BR5.3
    statement: fixtureSha256 は fixture の各 file の {path, sha256} を path 順に並べた正規化JSONの digest、commandSha256 は command 列の正規化JSONの digest とする（正規化は C03 の build-info と同じ規則）。
    category: calculation
    applies_to: Fixture, CommandScript
    trigger: 受入、Result v1 の extras
    logic: 同じ入力から同じ digest になることを試験で確かめる。
    violation: なし。
    source: FR11
  - id: BR5.4
    statement: U6 profile の coverage-80（host）は、U6 で vivarium に足す第一者のTS（FormicariumTerminal の共有module、recipe の repro、site build の取込み・照合の script）の行 coverage を固定した分母で測り、80%以上とする。
    category: constraint
    applies_to: vivarium の新しいsource
    trigger: U6の受入
    logic: 分母の file 一覧を受入の前に固定し、未実行の file を分母から外さない。
    violation: 受入不合格。
    source: NFR2

  # BR6: terrariumと旧題材の整理
  - id: BR6.1
    statement: vivarium の terrarium の現役参照を消す。対象は loader（_shared/terrarium_loader.ts）、proxy（docs/scripts/terrarium-proxy.ts と、それを使う src/layer1_wasm/scripts/serve.ts・docs/scripts/repro-dev-middleware.ts）、page-templates.ts の runtime集合、generate-repro-pages・generate-repro-i18n・bundle-layer1-pages.sh の terrarium 用の分岐、bump-upstream.ts の builds.json 分岐、試験（terrariumPins.test.ts、reproPreload.test.ts の terrarium 部分、Playwright spec 3本の SUPPORTED_RUNTIMES）、style.css の要素名、文書（.claude/rules/recipe-authoring.md の terrarium の節、src/layer1_wasm/README.md・_shared/README.md、docs/site/_data/projects.json の aube と biome の説明、Contract v1 と schema の説明）。
    category: policy
    applies_to: vivarium の source
    trigger: U6のcode generation
    logic: coi-serviceworker の写しの仕組み（generate-repro-i18n・bundle-layer1-pages.sh）は formicarium runtime が使うので、terrarium の名前から切り離して残す。歴史の説明（CHANGELOG・過去の revision・retire の記録）は残す。互換の adapter は作らない。最後に terrarium を検索し、残りが歴史の説明だけであることを確かめる。
    violation: 現役参照が残れば受入不合格（active-reference-cleanup）。
    source: FR12
  - id: BR6.2
    statement: recipe schema と Contract v1（en/ja）は、同じページの revision で、expected_runtime の説明と runtime の表に formicarium を加え、terrarium を現役の値から外す（歴史の注記だけ残す）。schema に guests（BR1.2–BR1.4 の形）を任意fieldとして加える。
    category: policy
    applies_to: recipe.schema.json, contract-v1（en/ja）
    trigger: U6のcode generation
    logic: AGENTS.md §4.9 に従い、任意fieldの追加は同じページの revision。terrarium の値の削除は、使うrecipeが0件で、互換を作らない人間の決定（Q6）による。
    violation: なし。
    source: FR12
  - id: BR6.3
    statement: 旧題材 biome-12265 の固定guestの上流 Release 2件と tag、vivarium の build残骸を消す。formicarium の U5 の証拠と記録は残す。
    category: policy
    applies_to: vivarium の Release・working tree
    trigger: U6のcode generation
    logic: 対象は guest-biome-15432368d2a44c6717f5347369f607655a4327dd1cc969041661fb2895a66321（baseline、biomejs/biome 2405c762）と guest-biome-4751f68d885a6fceb94c4dad85913ddbbbbc57fe36a9a6b7799b8512ef3dd24d（fix、JamBalaya56562/biome f79f85d5）。新しい題材の accepted の buildKey と違うことを確かめ、削除する tag の一覧を示して個別の承認を得てから、書込み権限のある人が消す。承認と実行の記録を残す。
    violation: 取り違え・未承認なら消さない。
    source: FR12

  # BR7: 画面の条件
  - id: BR7.1
    statement: guest の出力・metadata・入力は文字として表示し、HTML やコードとして解釈しない。
    category: constraint
    applies_to: TerminalPane, RecipeMeta
    trigger: 表示
    logic: 表示は text として扱う。非ASCII・空白・引用を含む入力をそのまま保つ。
    violation: なし。
    source: NFR7
  - id: BR7.2
    statement: 状態（読込み中・実行中・空の出力・失敗）を文字で区別して示し、色だけに頼らない。端末は keyboard だけで入力・実行・移動できる。
    category: constraint
    applies_to: TerminalPane, VerdictBadge
    trigger: 表示・操作
    logic: 失敗は原因の文字を出す。focus の移動は Tab、実行は Enter。
    violation: なし。
    source: NFR7

  # BR8: license と notices
  - id: BR8.1
    statement: site に置く formicarium の file（tarball の LICENSE と THIRD_PARTY_NOTICES.md）、coi-serviceworker.js の license 注記、Biome の ELF の license（Release の出所）を、site から読めるようにする。
    category: policy
    applies_to: site
    trigger: site build
    logic: formicarium の notices は bundle の置き場に一緒に置き、recipe page から辿れるようにする。Biome は build-info の source（repository・commit）から license を示す。
    violation: notices が欠ければ build失敗。
    source: NFR8
```

## Rules summary

| ID | 区分 | 要点 |
|---|---|---|
| BR1.1–BR1.8 | recipe・固定入力 | guests[] 必須、role で区別、宣言の規則、build 入力の commit と受入済みの accepted を分ける、baseline は main を bump で追う、accepted の置き換えは人の PR、active と pending、fix_candidate を使わない |
| BR2.1–BR2.4 | build時の取込み | pin file の固定版tarballから同じoriginへ、accepted.buildKey の Release を照合、C11 の上限、coi-serviceworker の固定 |
| BR3.1–BR3.7 | ブラウザ実行 | COI、実行前の再照合、fixture の FsEntry 変換と command、run の逐次化と入力の無効化、transcript の上限、ready/run/transcript だけ、起動の順と dispose |
| BR4.1–BR4.6 | 判定 | 事前確認、exit、override の bracketSpacing（2か所）、baseline だけで verdict、失敗は判定ではない、Result v1 |
| BR5.1–BR5.4 | 証拠 | 3ブラウザの比較、C10 の identity、digest の正規化、coverage-80 の分母 |
| BR6.1–BR6.3 | 整理 | terrarium の現役参照の除去（一覧）、schema・Contract v1 の revision、旧題材の Release の削除（個別承認） |
| BR7.1–BR7.2 | 画面 | 出力の escape と入力の保持、状態の文字表示と keyboard |
| BR8.1 | notices | formicarium・coi-serviceworker・Biome の license |
