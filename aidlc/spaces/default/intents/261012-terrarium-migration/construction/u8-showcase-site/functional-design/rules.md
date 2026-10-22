# U8 showcase-site の業務規則

## Sources

`entities.md` と同じ。人間の回答は `functional-design-questions.md`（Q1–Q7、2026-10-19）。規則の根拠は `../../../inception/requirements-analysis/requirements.md` の FR15・NFR5–NFR8、`../../../inception/contract-design/contract-summary.md` の C03・C04・C05・C09・C10・C11、`../../../inception/units-generation/unit-of-work.md` の U8、`../../../inception/domain-design/components.md` の Showcase。この資料は設計で、実装・動作の主張ではない。

## Rules

```yaml
rules:
  # BR1: 候補の受取り
  - id: BR1.1
    statement: site は U7 の受入済み候補（showcase-candidate）だけを入力にし、ツールの latest を解決し直さない。
    category: constraint
    applies_to: SiteCandidateInput
    trigger: site build の開始
    logic: IF 候補の artifact が無い OR candidate job が成功していない THEN build しない。ツールの版・URL・digest は manifest と catalog の値だけを使い、GitHub の release を site build から読まない。
    violation: build を失敗にし、前回の配布物を変えない。
    source: FR15, NFR5
  - id: BR1.2
    statement: 候補の各 file は manifest と照合してから使う。
    category: validation
    applies_to: SiteCandidateInput
    trigger: site build の取込み
    logic: >-
      次のどれかが成り立たなければ取り込まない。
      (1) candidateId：U7 が export する同じ関数（showcase/scripts/candidate.ts の computeCandidateId）で manifest から計算し直した値が manifest.candidateId と一致する（定義を複製しない）。
      (2) job の出力 candidate-id・distributable が manifest の candidateId・distributable と一致する。
      (3) site/ の全 file が manifest.assets と過不足なく一致し（path・SHA256・bytes）、catalog.json の SHA256 が catalogSha256 と一致する。
      (4) acceptance-log.json の SHA256 が acceptanceLogSha256 と一致し、log の12行（3ツール × node・chromium・firefox・webkit）がすべて passed で、各行の版が resolvedTools の版と一致する。
      (5) catalog の defaults[tool] が resolvedTools の同じ tool の version と一致する（`install <tool>` が受け入れた版を入れる）。
      (6) formicarium の pack（BR5.1）の SHA256 が formicariumPackSha256 と一致する。
      (7) demo の fixture（BR3.2）の inventory を U7 が export する fixtureInventorySha256 で計算し直した値が manifest と一致する。
    violation: build を失敗にし、違った項目・path・期待値を示す。
    source: FR15, NFR5, NFR8
  - id: BR1.3
    statement: 配布の build は distributable が true の候補だけを使う。
    category: authorization
    applies_to: SiteBuild
    trigger: distribute の build
    logic: IF mode=distribute AND distributable が true でない THEN 配布しない。mode は U7 の mode.ts と同じ規則で決まる：main からの schedule と workflow_dispatch だけが distribute、PR・push・main 以外からの手動は verify。verify は build と受入をしても配布しない。
    violation: deploy の job を動かさない。
    source: FR15, NFR5, NFR8

  # BR2: page と言語
  - id: BR2.1
    statement: site は formicarium の GitHub Pages（base /formicarium）に置き、トップ・/tools/・ツールごとの個別ページ・空の端末のページ・guides を持つ。
    category: constraint
    applies_to: SitePage
    trigger: site build
    logic: トップはエミュレータの説明（formicarium が何か、ブラウザの中で動くこと、データがブラウザの外へ出ないこと）と、/tools/・空の端末・guides への導線。/tools/ は候補の3ツールのカード。個別ページは /tools/<tool>/、空の端末は /terminal/。
    violation: page の欠落は build 後の検査で失敗。
    source: FR15
  - id: BR2.2
    statement: すべての page は英語と日本語の両方を持ち、同じ形の path に置く。
    category: constraint
    applies_to: SitePage
    trigger: site build
    logic: 英語は base の直下、日本語は /ja/ の下。Starlight の言語の切替えで行き来できる。guest の出力・command・file の名前は翻訳しない。片方の言語にしか無い page があれば失敗。
    violation: build 後の検査で失敗。
    source: FR15
  - id: BR2.3
    statement: カードと個別ページは候補の resolvedTools から作り、tool の一覧を site に重複して書かない。
    category: constraint
    applies_to: ToolCard
    trigger: site build
    logic: tool と版は manifest、repository と fixture は showcase/tools.json、説明文と案内の command は site の文言 file から取る。文言 file に候補に無い tool がある、又は候補の tool の文言が無い場合は失敗。
    violation: build を失敗にする。
    source: FR15
  - id: BR2.4
    statement: guides は terrarium の6ページを formicarium 向けに書き直したもので、端末の要素と iframe は扱わない。
    category: policy
    applies_to: SitePage
    trigger: 文書の作成
    logic: getting-started（site の使い方）、embedding（公開 API の createSession・createCommandSession の組込み、同じ origin の Worker・wasm、COI）、source-builds（U7 の source build）、releases（formicarium の公開と showcase の配布）、architecture、maintenance（日次 build・切戻し）。terrarium の package・CI の説明は移さない。guides が書く API と導入の手順は、候補が使う pack の版（npm に公開済みの版）に実在するものだけにし、版を明記する。未公開の版や予定の API を公開済みのように書かない。embedding の code の例は、その版の型で型検査を通す。
    violation: code の例の型検査の失敗で build を失敗にする。その他の記述はレビューで指摘する。
    source: FR15

  # BR3: 端末
  - id: BR3.1
    statement: 端末は formicarium の公開 API（browser の createSession と root の createCommandSession）だけを使い、本体の内部を import しない。
    category: constraint
    applies_to: TerminalSession
    trigger: site の code と build
    logic: import は @aletheia-works/formicarium・/browser の公開 export と、xterm（最新の安定版）と fit addon だけ。Worker・wasm の URL は公開の assets の指定で渡す。本体の内部の path を import したら境界の検査で失敗。
    violation: build を失敗にする。
    source: FR15, FR14
  - id: BR3.2
    statement: 個別ページは、開くと demo の fixture を置き、そのツールを install した状態で始める。
    category: policy
    applies_to: TerminalSession
    trigger: 個別ページの読込み
    logic: >-
      fixture の元は、site を build する checkout（manifest.sourceCommit と同じ commit）の showcase/fixtures/<fixture>/app だけ。
      site build はこの dir を、path・type（dir・file）・mode・各 file の bytes と SHA256 を持つ fixture の index（JSON、path 順）として site に置き、BR1.2(7) で照合する。symlink・特殊 file があれば build を失敗にする（U7 の fixture は通常の file と dir だけ）。
      page はこの index を取得して各 file の SHA256 を確かめ、file ごとに一意の inodeId を付けた FsEntry にし、公開の fixtureToFsEntries を通して /work/app に置いて Session を作る。cwd を /work/app にしてから、端末に `install <tool>` を表示して CommandSession で実行する。成功したら案内の command を示す。
    violation: install の失敗は端末と状態欄に原因を示し、再試行の操作（同じ command を打つ）を残す。
    source: FR15
  - id: BR3.3
    statement: 空の端末は fixture も guest も無い Session で始まり、利用者が `install <tool>` で3ツールを導入して実行できる。
    category: policy
    applies_to: TerminalSession
    trigger: /terminal/ の読込み
    logic: cwd /work/app の空の dir で始め、案内に3ツールの install の command を示す。install できるのは catalog の tool と版だけ（C04）。
    violation: catalog に無い tool・版は CommandSession の原因（NOT_FOUND など）を表示する。
    source: FR15
  - id: BR3.4
    statement: 入力は1行ずつ CommandSession に渡し、実行中は次の入力を受け付けない。
    category: constraint
    applies_to: TerminalSession
    trigger: Enter
    logic: Enter で行を確定して実行する。実行中の打鍵は捨てる。空行は何もしない（kind=empty）。1行の上限は UTF-8 で 65536 bytes（C11）で、超える打鍵は受け付けない。↑↓ で page の中の履歴を辿る。
    violation: 上限の超過は入力を止め、文字で知らせる。
    source: FR15, NFR7
  - id: BR3.5
    statement: Ctrl-C は、入力中なら行を捨て、実行中なら AbortSignal で command を取り消す。
    category: policy
    applies_to: TerminalSession
    trigger: Ctrl-C
    logic: 入力中 THEN 行を捨てて新しい prompt。実行中と install 中（個別ページの自動の install を含む） THEN CommandOptions.signal を abort し、ABORTED の結果を表示して prompt に戻る。取消の後に遅れて来た出力・登録は表示・反映しない（C04・C05）。
    violation: なし。
    source: FR15, NFR7
  - id: BR3.6
    statement: guest の出力と metadata は文字として表示し、HTML・code として解釈しない。
    category: constraint
    applies_to: TerminalSession
    trigger: 出力の表示
    logic: >-
      出力は結果の kind ごとに1回だけ書く。kind=guest は onOutput の chunk だけを書き、result.stdout・stderr は書かない（同じ内容の二重の表示を避ける）。kind=builtin（ls・cat など）と kind=install は onOutput が呼ばれないので、result.stdout・stderr を書く。kind=empty は何も書かない。
      bytes は UTF-8 の stream decoder で decode して xterm に書く（ANSI の色・カーソルは xterm が端末の規則で扱う）。xterm が端末の問合せ（DSR など）への応答を入力として返しても、その escape 列は行に入れない。OSC 8 の link は開かない。page の状態欄・カードは textContent と Astro の escape で表示する。非 ASCII・空白・引用を含む入力はそのまま CommandSession に渡す。
    violation: BR7.1 の受入（敵対的な出力）で失敗。
    source: NFR7
  - id: BR3.7
    statement: page を離れるか再読込みすると、端末の Session を dispose する。状態はブラウザに保存しない。
    category: constraint
    applies_to: TerminalSession
    trigger: pagehide
    logic: どの状態でも pagehide で signal を abort し、Session・CommandSession・xterm を破棄する。back-forward cache から戻った（pageshow の persisted）ときは page を読み直して新しい Session を作る。履歴・file を localStorage などに書かない。
    violation: なし。
    source: FR15

  - id: BR3.8
    statement: 端末の表示の buffer は UTF-8 で 1048576 bytes か 10000 行の早く達する方を上限とし、古い先頭を捨て、捨てたことを別の通知で示す。
    category: constraint
    applies_to: TerminalSession
    trigger: 出力の表示
    logic: 表示した bytes と行を数え、上限を超えたら先頭から UTF-8 の文字境界で捨てて、残りで表示を作り直す。捨てた bytes 数と行数を、端末の外の通知「以前の出力を省略」に示し、guest の出力には混ぜない。CommandResult の原本の bytes は切り詰めない（契約の「Transcript の表示と原本」）。
    violation: なし。境界値（1048575・1048576・1048577 bytes、9999・10000・10001 行、multi-byte の文字の境界）を単体試験で確かめる。
    source: NFR7

  # BR4: 状態の表示と操作
  - id: BR4.1
    statement: 端末の page は、状態を文字の状態欄（role=status）で示し、色だけに頼らない。
    category: policy
    applies_to: TerminalSession
    trigger: 状態の変化
    logic: 分離の準備中・読込み中・install 中（工程と bytes）・準備完了・実行中・失敗（原因）を区別して示す。空の出力は「出力なし」と示す。install の進捗は全体の大きさが分からないとき（unknown）と、まだ0 byte のとき（0）を区別する。
    violation: なし。
    source: NFR7
  - id: BR4.2
    statement: 端末は keyboard だけで使え、keyboard の罠を作らない。
    category: policy
    applies_to: TerminalSession
    trigger: 操作
    logic: 端末に focus を移して打鍵できる。Tab と Shift+Tab は端末に渡さず、page の focus の移動に使う。xterm の screen reader の mode を有効にする。390px 幅で横に scroll しない。
    violation: 受入試験で失敗。
    source: NFR7
  - id: BR4.3
    statement: 文書の page と /tools/ は formicarium・guest を取得せず、service worker を登録しない。site の全 page は cross-origin の副資源を読まない。
    category: constraint
    applies_to: SitePage
    trigger: 文書・一覧の page の読込み
    logic: >-
      端末を読み込み、coi-serviceworker を登録するのは個別ページと /terminal/ だけ。文書の page と /tools/ は検索（Starlight の pagefind）を含めて formicarium・guest を取得しない。
      coi-serviceworker の scope は site の root（/formicarium/）になるので（BR5.2）、端末の page を一度訪れた後は、文書の page と /tools/ も service worker に制御され COEP が付く。それで壊れないよう、site のどの page も cross-origin の script・style・画像・font などの副資源を読まない（外部への link の `<a>` は可）。build 後の検査で、HTML と CSS に外部の副資源の URL があれば失敗にする。
    violation: 受入試験と build 後の検査で失敗。
    source: FR15, NFR6

  # BR5: 配置と分離
  - id: BR5.1
    statement: formicarium の browser 用 file、guest、catalog、fixture は site と同じ origin に置き、外部の CDN から読まない。
    category: constraint
    applies_to: SiteBuild
    trigger: site build
    logic: >-
      formicarium：同じ workflow の run の artifact `showcase-work-resolve` の pack（pack.json と tarball）を取り、U7 の pack.ts と同じ手順で SHA256 を確かめて展開する（BR1.2(6)）。site の `_formicarium/<version>/` に、公開 export の `.` と `./browser` から辿れる module、単一 file の Worker（runtime/web/package-worker.bundle.js）、assets（blink.mjs・blink.wasm・build-info.json）、LICENSE と THIRD_PARTY_NOTICES.md を、pack の bytes のまま置く。page は site の Vite の bundle に formicarium を入れず、この置き場の module を実行時に import し、公開の Assets（loaderURL・wasmURL・workerURL・buildInfoURL）にこの置き場の URL を渡す。置く file の正確な一覧は Code Generation で import の graph から決め、site の inventory に記録する。
      guest と catalog：候補の site/ を bytes のまま site の root に置く。catalog.json は書き換えない（catalogSha256 を保つ）。page は catalog を取得して SHA256 を確かめ、各 entry の url を site の root の URL を基準に解決した写しを createCommandSession に渡す。en・ja の、深さの違う page（/terminal/、/tools/<tool>/、/ja/ の下）のどれでも同じ guest の URL になる。
      fixture：BR3.2 の fixture の index を site の固定の path に置く。
    violation: build を失敗にする。
    source: FR15, NFR6
  - id: BR5.2
    statement: 端末の page は coi-serviceworker（版と SHA256 を固定）で分離を得て、COEP は require-corp にする。
    category: constraint
    applies_to: SitePage
    trigger: 端末の page の読込み
    logic: >-
      Pages は HTTP の header を付けられない（ドキュメント根拠：terrarium の reference/architecture.md）。coi-serviceworker の写しを site の root に1つだけ置き（scope /formicarium/。en と ja の両方の端末の page を覆う）、端末の page だけが登録する。COEP は require-corp にする（coepCredentialless を使わない）。根拠：U6 で、coepCredentialless を false にしないと WebKit の Worker が分離されなかった（検証済み：u6-recipe-runtime の code-generation/code-summary.md の Step 3 の追加調査）。設定の書き方は Code Generation で決める。分離ができないときは guest を実行せず、文字で理由と再読込みの案内を示す。
    violation: 分離の無い page で guest を動かさない。
    source: NFR6
  - id: BR5.3
    statement: 端末の page は CSP で、同じ origin・blob・wasm の実行だけを許す。
    category: constraint
    applies_to: SitePage
    trigger: 端末の page の build
    logic: >-
      script・worker・connect は self と blob（必要な範囲）だけ、wasm は wasm-unsafe-eval、外部の origin は許さない。具体の指令と置き方（meta）は NFR Design で決める。
      未検証の危険（NFR Design の入力）：U7 の受入 server の方針（default-src 'none'、style-src 'self'）をそのまま使うと、分離の設定の inline script、Starlight の inline の script・style、xterm が実行時に入れる style が止められ、端末が表示されない恐れがある。外部 file に出す、hash を使う、style-src の扱いを決める必要がある。
    violation: CSP に外部の origin があれば build 後の検査で失敗。
    source: NFR6, NFR8
  - id: BR5.4
    statement: Pages の artifact は site の全 file（dotfile を含む）を含め、site の inventory と一致させる。site 全体は 1 GB 未満とし、site の third-party の notices を含める。
    category: validation
    applies_to: SiteInventory
    trigger: upload の前
    logic: >-
      site の全 file の一覧（inventory）を作る。upload の設定が `.` で始まる file を外さないことを確かめる（根拠：vivarium の aletheia-works/vivarium#544。upload-pages-artifact の既定は dotfile を外し、U6 の fixture が Pages で 404 になった）。
      site 全体の大きさは 1073741824 bytes 未満（ドキュメント根拠：GitHub の Pages の制限の文書の「1 GB」。vivarium の check-site と同じ値）。
      site の THIRD_PARTY_NOTICES に、guest と formicarium の notices（候補と pack の file）に加えて、site が配る第三者の code（xterm と fit addon、coi-serviceworker、Astro・Starlight が出力に入れる code）の license を含める。欠ければ失敗。
    violation: build を失敗にする。
    source: FR15, NFR8

  # BR6: 日次 build と配布
  - id: BR6.1
    statement: 配布は main の .github/workflows/showcase-site.yml が、毎日の schedule と main からの手動の実行で行う。
    category: policy
    applies_to: SiteBuild
    trigger: schedule・workflow_dispatch
    logic: showcase.yml を workflow_call で呼び、mode は BR1.3 の規則で決まる。distribute のとき、候補・site の build・site の受入・証拠がすべて成功したときだけ Pages へ deploy する。PR と push は verify で build と受入だけを行う。最初の deploy は、Pages の `github-pages` environment に人間の承認者を置いて止め、人間が承認してから行う（Pages の有効化と environment の設定は、具体の内容を示して承認を受けてから。後の工程）。承認者を外して日次の自動の配布にするかは、人間がその後に決める。
    violation: どこかが失敗すれば deploy しない。
    source: FR15, NFR5, NFR8
  - id: BR6.2
    statement: 失敗した候補や site は配布せず、前回の配布物を残す。配布は直列にし、古い run が新しい配布物を上書きしない。
    category: policy
    applies_to: SiteBuild
    trigger: 失敗・同時の run
    logic: >-
      deploy は最後の job で、前の job がすべて成功したときだけ動く。Pages の今の配布物を消す・置き換える処理は deploy の他に持たない。
      deploy の job は1つの concurrency の group で直列にし、走っている run を取り消さない。site に、その site を作った run の番号（run_number）・sourceCommit・candidateId を書いた identity の file を置く。deploy の前に今の配布先の identity の file を読み、その run_number が自分より大きければ deploy しない（古い run の拒否）。
    violation: deploy しない（job は失敗として記録する）。
    source: FR15, NFR5
  - id: BR6.3
    statement: 配布する site は受入した site そのもので、受入の後に作り直さない。
    category: constraint
    applies_to: SiteBuild
    trigger: deploy
    logic: >-
      build の job が1回だけ Pages の artifact（upload-pages-artifact）を作り、その inventory を記録する。受入の job はその同じ artifact を取って展開し、inventory を計算し直して一致を確かめてから配って受け入れる。deploy の job はその同じ artifact を deploy する。deploy の前に artifact から inventory を計算し直し、受入の証拠の siteInventorySha256 と一致しなければ deploy しない。どの job も build し直さない。
      deployedIdentity は、deploy した artifact の inventory の SHA256 を代入した値で、配布先の bytes を全部観測した値ではない（証拠にそう書く）。deploy の後に、配布先の identity の file を取得して、自分の run_number・candidateId・siteInventorySha256 と一致することだけを確かめる。
    violation: inventory が違えば deploy しない。deploy の後の不一致は job の失敗として通知する。
    source: FR15, NFR8
  - id: BR6.4
    statement: deploy の権限は deploy の job だけに与え、build の job は token を使わない。
    category: authorization
    applies_to: SiteBuild
    trigger: workflow の定義
    logic: build・受入の job は contents read だけ（showcase.yml の呼出しに要る権限は U7 の定義のとおり）。pages write と id-token write は deploy の job だけ。fork の PR からは配布しない。
    violation: workflow の試験で失敗。
    source: NFR8

  # BR7: 受入と証拠
  - id: BR7.1
    statement: site の受入は、Pages の artifact の site を Pages と同じ形で HTTPS で配り、3ブラウザ × en・ja で行う。
    category: validation
    applies_to: SiteAcceptanceEvidence
    trigger: site build の後
    logic: >-
      配り方：COOP・COEP の header を付けない静的 server を新しく作り（U7 の受入 server は header を付けるので使わない）、base /formicarium で配る。C11 の HTTPS の規則に合わせ、U7 の受入と同じく job 専用の CA を作ってブラウザに信頼させる（U7 の showcase/scripts/tls.ts の手順を共有する）。
      項目：(1) /terminal/ と /ja/terminal/ の空の端末で3ツールを install して --version を実行する。(2) /tools/<tool>/ と /ja/tools/<tool>/ が導入済みで始まり、案内の command（ls・cat を含む）が動く。builtin・install・guest の出力が1回ずつ出る（BR3.6）。(3) 状態の表示と keyboard の操作（BR3.4・BR3.5・BR4.1・BR4.2）。(4) 分離（page・Worker・子 Worker）と再訪問。(5) 端末の page を訪れた後の文書の page と /tools/ が壊れず、guest を取得しない（BR4.3）。(6) 敵対的な出力：試験だけの harness の page（配布しない）で、HTML（`<script>`・`<img onerror>`）、ANSI の端末への問合せ、OSC 8 の link、巨大な1行を、端末の出力の経路と状態欄に流し、HTML として解釈されず、応答が入力にならないことを確かめる。
      Chromium・Firefox・WebKit を1つずつ、1 worker、retry 0。実機 Safari は別の証拠が無ければ unverified。
    violation: 1件でも失敗すれば配布しない。
    source: FR15, NFR6, NFR7
  - id: BR7.2
    statement: C10 の U8 の証拠を、候補と site の identity に結び付けて作る。
    category: validation
    applies_to: SiteAcceptanceEvidence
    trigger: 受入の後
    logic: >-
      identity（SiteEvidenceIdentity）は sourceCommit・formicariumSourceCommit・formicariumPackSha256・candidateId・catalogSha256・fixtureInventorySha256・siteInventorySha256 で、その正規化 JSON の SHA256 を identity の digest とする。必須の行ごとに、identity の digest・元の log の path と SHA256・その log から読んだ事実を持つ check の記録を作る（U6 と同じ形）。
      行と確かめ方：
      - tool-aube-version・tool-pitchfork-version・tool-biome-version（node・chromium・firefox・webkit の各4行）：U7 の acceptance-log.json の該当の行を引用する。U7 の log は固定済みなので書き換えず、U8 の check の記録が acceptanceLogSha256 と行の内容を束ねる。
      - empty-terminal-install・ui-states-keyboard・browser-coi（chromium・firefox・webkit の各1行）：BR7.1 の (1)・(2)〜(3) と (6)・(4)〜(5) の Playwright の結果。
      - public-import-boundary（host）：U7 の境界の検査（showcase/scripts/boundary.ts）を showcase/site の source にも掛けた結果。本体の内部の import と、本体から showcase への依存が0件。
      - fixture-isolation（host）：site の fixture の index が showcase/fixtures だけから作られ（回帰用の fixture を含まない）、BR1.2(7) の照合が通った記録。
      - candidate-identity（host）：BR1.2 の (1)〜(7) の照合の log。
      - previous-site-preserved（host）：workflow の試験（deploy が前の job の成功だけを条件にすること、concurrency、古い run の拒否、verify で deploy が動かないこと）の結果と、BR6.2 の配布先の identity の照合の log。
      - site-inventory（host）：build・受入・deploy の前の3回の inventory の計算が一致した log。
      - coverage-80（host）：showcase/site の第一者の code の行 coverage 80% 以上。分母は Code Generation の前に file の一覧で固定し（端末の部品、状態の表示、文言の検査、fixture の index、build・検査の script。生成物・xterm・formicarium の pack・第三者の code は理由付きで除く）、未実行の file を0%として残す。bun・node の coverage と Chromium の V8 の coverage を合わせる（U6 と同じ方式）。
      配布したときは deployedIdentity を BR6.3 の値にする。証拠は Actions artifact（`showcase-site-evidence-<run_id>`、保持 90 日）に置き、U9 はそこから取る。
    violation: 必須の行の欠落・重複・failed・unverified があれば配布しない。
    source: FR15, NFR8
```

## Rules summary

| group | 内容 |
|---|---|
| BR1.1–BR1.3 | 候補だけを入力にし、U7 と同じ関数で manifest と7項目を照合し、distributable の候補だけを配布する |
| BR2.1–BR2.4 | formicarium の Pages、en・ja の page、候補から作るカード、公開済みの版に合わせた formicarium 向けの guides |
| BR3.1–BR3.8 | 公開 API だけの端末、fixture の index と事前導入、空の端末、1行ずつの実行、Ctrl-C、kind ごとの出力、dispose と bfcache、表示の上限 |
| BR4.1–BR4.3 | 文字の状態欄、keyboard、文書の page は guest を読まず、site は cross-origin の副資源を読まない |
| BR5.1–BR5.4 | pack・候補・fixture の same-origin の配置と catalog の URL の解決、coi-serviceworker、CSP、inventory・大きさ・notices |
| BR6.1–BR6.4 | 日次と main からの手動、最初の deploy の承認、直列の配布と古い run の拒否、同じ artifact の受入と配布、deploy の job だけの権限 |
| BR7.1–BR7.2 | HTTPS の Pages と同じ形の受入（敵対的な出力を含む）、C10 の U8 の証拠と各行の確かめ方 |
