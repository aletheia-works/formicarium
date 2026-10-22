# U6 recipe-runtime の品質・安全要件

## Sources

`nfr-requirements-questions.md`（Q1=A、Q2=A）、`../functional-design/functional-spec.md`・`rules.md`（BR1.x–BR8.1）・`functional-design-questions.md`（Q1–Q12）、`../../../inception/requirements-analysis/requirements.md`（NFR1–NFR8 と 2026-10-18 の改訂節）、`../../../inception/contract-design/contract-summary.md`（C03・C05・C07・C08・C10・C11 と改訂節）、`aidlc/spaces/default/codekb/formicarium/technology-stack.md`。Functional Design の review-02（READY、Minor 5件）のうち品質に関わるものと、この stage の review-01（NOT-READY、R-01〜R-11）を反映した。vivarium の `deploy-docs.yml`（`push` to main と `workflow_dispatch` だけ、`contents: read`・`pages: write`・`id-token: write`・`packages: write`）、`playwright.config.ts`、`mise.toml` を読んだ（2026-10-19、読取り）。設計の要件で、U6 の動作は未検証。

## Requirements

| ID | 分類 | 合格条件 | 検証 |
|---|---|---|---|
| NFR2.1 | 品質 | vivarium の既存の回帰（Layer1・Layer2 の Playwright、docs の bun test、fixed-guest-builder の試験）を、U6 の変更の後も通す。skip や欠落を合格にしない。U6 の Playwright の試験は retry 0、180秒の timeout、Chromium・Firefox・WebKit で実行し、CI の retry 1 で通った結果を U6 の証拠にしない（設定の差は小さい変更で直す）。formicarium 側の既存の上限（probe 600s、aube 840s、1 worker、retry 0、native 一致、wasm 1GB）は U6 で変えない。 | vivarium の CI と main session の逐次実行の記録 |
| NFR2.2 | coverage | U6 で vivarium に足す第一者の TS の行 coverage を、受入の前に固定した分母で測り 80% 以上（BR5.4）。site build の取込み・照合の script は bun test の coverage、ブラウザで動く FormicariumTerminal の共有 module と recipe の repro は Playwright の Chromium の page 内の coverage を source へ対応させて測る（方式は未検証。Firefox・WebKit は coverage を測らず、動作の受入だけ）。未実行の file を分母から外さない。U6 の PR の CI（統合前）で実行する。 | 分母の一覧・測定の command・report を受入の証拠に残す |
| NFR3.1 | 固定入力 | recipe の guests[] を、role の一意、上流の宣言規則（正規 URL・allowlist・40桁 commit）、`accepted` の5 field が揃うか無いか、で検証する（BR1.1–BR1.4）。`accepted` が一部だけなら検証失敗。guest の repository を変える PR は `accepted` を消す。消し忘れは site build の build-info の照合（NFR3.2）で検出する。 | index 生成の試験：role 重複・baseline 欠落・不正 URL・allowlist 外・40桁でない commit・一部だけの accepted の拒否 |
| NFR3.2 | 取込み | site build は pin file の tarball の SHA256、entry の path（../・絶対 path・symlink・重複の拒否）、各 file の SHA256 を照合する。Release の ELF・build-info・catalog は `accepted.buildKey` の tag だけから取り、ELF と build-info の digest、build-info の commit・buildKey を `accepted` と、tool・repository を guest と照合する（BR2.1・BR2.2）。CDN・latest・別の tag で代わりにしない。active の recipe の照合・取得の失敗は、site の deploy 全体を止め、前回の site を保つ（改変の可能性がある入力を公開しないため。その recipe だけを外して公開を続けることはしない）。 | 改変・欠落・別 tag・別 repository（accepted を残した repository の変更を含む）・上限 +1 の拒否試験 |
| NFR3.3 | 実行前 | ブラウザは同じ origin の ELF と build-info を取り直し、C03 の validateGuest で照合してから登録する。build 後の置換や途中の改変で、照合しない bytes を実行しない（BR3.2）。照合・起動の失敗は判定ではなく、baseline_error に原因を入れる（BR4.5）。 | ELF を差し替えた page で、実行されず原因が出る試験 |
| NFR3.4 | pin が無い間 | formicarium 0.3.0 の公開前は pin file を置かず、formicarium の recipe は pending（BR1.7）。その間の確認は、ローカル tarball を同じ照合（NFR3.2）にかける試験だけで行い、公開 site に載せない。U6 の最終受入（C10 の証拠）は 0.3.0 の公開と pin file の後に行う。 | pending の記録、ローカル tarball の試験の記録 |
| NFR3.5 | 分離の file | coi-serviceworker.js（v0.1.7）の SHA256 は、pin file とは別に固定し、docs の bun test（test-docs、すべての PR で動く）が tree にあるすべての写しの digest を照合する。recipe が pending の間も検査する。不一致は試験の失敗。 | 写しを1 byte 変えた場合の拒否試験 |
| NFR3.6 | 出所 | pin file を更新する PR では、tarball が pin の sourceCommit から作られたことを、npm の provenance（あれば）で確かめる。provenance が無い、又は確かめられないときは、その旨を PR に未検証と書く。 | pin を更新する PR の確認項目 |
| NFR4.1 | 取得の上限 | site build の各取得（npm の tarball、Release の ELF・build-info・catalog）は C11 の deadline（120秒）と大きさの上限（tarball・ELF 128MiB、metadata 1MiB、catalog 4MiB）で止め、HTTP の非2xx・offline・429・不正な body を原因付きで失敗にする。自動 retry と別 URL への fallback はしない。 | deadline 超過・各失敗・上限 +1 の試験、retry しないことの試験 |
| NFR4.2 | 取消 | ブラウザで端末の要素が外れたら、取得中の ELF・build-info の取得を取り消し、session を dispose する（BR3.7）。取り消した後の応答を表示・登録しない。 | 取得中に要素を外す試験 |
| NFR6.7 | 互換 | Chromium・Firefox・WebKit（Playwright の latest。今は 1.64.1）で、同じ page・同じ guest・同じ fixture の結果を、en と ja の page で受入する。COI・SharedArrayBuffer・同じ origin の Worker・waitAsync の削除（formicarium 側）を保つ。page に CSP を置く場合は、formicarium の既存の要件（wasm・blob の Worker）を満たす（vivarium は今 CSP を置いていない）。実際の browser の版・OS・host の負荷を受入の記録に残す。実機 Safari は別の証拠が無ければ unverified。 | 3ブラウザ × en・ja の受入（W5）、C10 の profile |
| NFR6.8 | 分離 | coi-serviceworker.js で分離された en と ja の page から、formicarium の module・Worker・wasm を同じ origin の置き場から読み、Worker が分離の下で起動することを3ブラウザで観測する（BR2.4・BR3.1）。観測は deployed-shape の server（`docs/scripts/serve-repro.ts`）で行い、可能なら deploy 後の Pages でも確かめる。置き場と service worker の scope の関係は、この観測で Infrastructure Design・Code Generation に確定する。 | browser-coi の check（3ブラウザ × en・ja） |
| NFR7.1 | 表示 | guest の出力・metadata・入力を文字として表示し、HTML・code として解釈しない。非ASCII・空白・引用の入力をそのまま保つ（BR7.1）。表示 buffer は 1MiB 又は 10000行で先頭を捨て、判定は原本の output から行う（BR3.5）。 | escape の試験（HTML の記号を出す guest 出力）、上限の前後（1048575/1048576/1048577 bytes、9999/10000/10001 行）の試験 |
| NFR7.2 | 操作 | 状態（読込み中・実行中・空の出力・失敗）を文字で示し、色だけに頼らない。keyboard だけで入力・実行・移動できる（BR7.2）。判定の command 列の間は入力を受け付けない（BR3.4）。 | keyboard 操作と状態表示の試験、列の途中の入力が無視される試験 |
| NFR7.3 | 進捗 | ELF の取得中の表示は、全体の大きさが分からないとき（unknown）と、まだ0 byte のとき（0）を区別する。時刻は offset 付き、期間は ms で記録する。 | 進捗の表示の試験 |
| NFR8.1 | 証拠 | C10 の AcceptanceEvidence（unit=u6-recipe-runtime）に、pin file の formicarium の source commit と pack の SHA256、baseline と fix の `accepted`、catalog・fixture・command の digest を結び付け、必須 check（reproduction-comparison など）の欠落・重複・failed・unverified を拒否する（BR5.2・BR5.3）。別の候補のログを混ぜない。 | 証拠の照合の試験 |
| NFR8.2 | 外部操作 | 旧題材の Release 2件の削除、bump の dispatch、build・Release の起動、pin file の更新、formicarium の recipe を active にする PR の merge（deploy-docs で公開になる）は、それぞれ対象を示して人の承認を受けてから、書込み権限のある人が行う（BR1.6・BR6.3）。秘密や response の全文をログに出さない。新しい費用は事前に相談する。 | 承認と実行の記録 |
| NFR8.3 | notices | site に置く formicarium の LICENSE と THIRD_PARTY_NOTICES.md、coi-serviceworker.js の MIT の注記、Biome の ELF の license の出所を、site から読めるようにする（BR8.1）。 | site build の検査（notices の欠落で失敗） |
| NFR8.4 | CI の権限 | U6 の取込み・照合の script は、deploy-docs の build の job の中で token を使わずに公開の asset だけを取る（credential を送らない、C11）。公開は main への push と workflow_dispatch だけで、PR や fork からは公開しない（今の deploy-docs の起動条件を保つ）。U6 で job の権限を広げない。回帰試験の workflow（repro-regression）は `contents: read` のまま。 | workflow の起動条件・権限の確認、script が token を読まないことの試験 |
| NFR8.5 | 切戻し | 問題が出たら、formicarium の recipe・pin file・`accepted` を変えた PR を revert して、前の site に戻せる。site build の照合失敗では前回の site が保たれる（NFR3.2）。 | 切戻しの手順の記録と、revert した tree の site build の確認 |

## Threats and Boundaries

recipe.json・fixture・command は vivarium の作者が書き、PR の review を通る。それでも build と実行の入力は digest で固定し、名前（branch・tag の latest）では選ばない。Release の asset・npm の tarball・site 上の file・coi-serviceworker.js は、取得・照合の後まで信用しない。coi-serviceworker.js は page の全 fetch の応答を書き換えられるので、pending の間も digest を検査する（NFR3.5）。ブラウザでは、site の file が build の後に置き換わっても、C03 の照合で実行を止める。

guest は検証済みの Biome の ELF だけで、formicarium の session の中で動く（host の FS・network には触れない。formicarium の既存の境界）。page は guest の出力を文字として扱い、HTML として解釈しない。公開は main への push からだけで、PR の内容は公開されない。U6 は認証・個人データ・課金を持たない。

## Applicability

NFR1 は U6 の範囲外（install を使わない）。照合・登録の時間は NFR6.2 で記録する。NFR4 は、U6 が足す取得の経路（site build の取得とブラウザの取り直し）について NFR4.1・NFR4.2 で扱う。build の deadline は U5 の範囲。NFR5（同 key の直列化・原子的受入）は U5 の範囲で、U6 は `accepted` を人の PR だけで置き換えること（BR1.6）で受ける。ui の Unit なので、scalability・reliability・observability の文書は作らない。

## Assumptions & Open Questions

None.
