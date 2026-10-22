<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-10-19T11:40:00Z [unit u8-showcase-site] — review-01（NOT-READY、Major 4・Minor 10）を受けて、Functional Design の凍結した記述を置き換える箇所を security-requirements の「Functional Design との関係」の表に集めた。U9 の Functional Design への申し送り：U8 の C10 の証拠は2つの artifact（deploy の前の `showcase-site-evidence-<run_id>` と、deployedIdentity 入りの `showcase-site-evidence-<run_id>-deployed`）で、U9 は `-deployed` があればそれを、無ければ前者を非配布の候補の証拠として取る（NFR8.1）。
- 2026-10-19T11:20:00Z [unit u8-showcase-site] — Functional Design の review-02 の残り（R-16・R-19〜R-24）と fixture の app/ の外の dir を、人間の回答（B）により security-requirements の各行に割り当てた（各行の末尾に ID）。U6 と同じく NFR1–NFR8 を全部挙げ、U8 が持たない NFR1・NFR3・NFR4 は N/A にした。古い run の拒否は、Pages の CDN の cache を避けるため配布先の file ではなく Actions の API で行うことにした。
2026-10-17T13:00:00Z — [unit u5-fixed-guest-build] packagingのUnitなので、producesはsecurity-requirements・tech-stack-decisions・traceabilityだけと解釈した。機能設計の文書はなく、要件（FR7–FR9、NFR2・3・4・5・8）、契約C07・C11・C12、U1のbaselineの試行を根拠にした。人間の回答：Q1〜Q5はA（Q4にmr-boxington（mbx）の検討の追記）、Q6はB（BunとTypeScript、使えない所はmjs）。mbxの採否とvivariumの構成の確認はNFR Designへ持ち越す。
- 2026-10-16T20:31:04Z [unit u4-command] — library種別なのでsecurity-requirementsに品質条件を集約した。機能設計レビューで後工程扱いとしたMinorのうち、取消（事前abortはABORTED、同期builtinは中断しない）、timeout（Session.runの既定値）、予約名を、NFR4.1/4.2/7.2として要件化した。technology-stack.mdの版は古いため、toolchain更新後の値（Node 26.12.0、Bun 1.4.3、Playwright 1.64.1）を記した。
- 2026-10-13T19:38:06Z [unit u3-install] — library種別でも性能・信頼性・通知の条件をsecurity-requirementsへ保持した。Nodeのoriginなし相対URLは暗黙補完せず拒否し、公開shape変更なしで環境差を明示する。
- 2026-10-18T01:28:44Z [unit u7-showcase-guests] — packagingのUnitなので、producesはsecurity-requirements・tech-stack-decisions・traceabilityだけと解釈した。機能設計の文書はなく、FR13・FR14、NFR2/3/4/5/6/8、契約C03・C05・C06・C09・C11と、移管元の現行terrariumの最新版ビルドを根拠にした。U5で人間が決めたtoolchainの方針はU7のsource buildにも当てはめ、再質問しなかった。人間の回答はQ1〜Q5すべてA。
2026-10-12T23:18:28Z — [unit u2-session-guest-api] libraryの適用文書にNFR2/3/4/6/8を集約。同期検証と非同期取得境界、U2暫定証拠とU4完全B1証拠を区別し、新しいSLOや認証サービスを導入しない。
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-10-19T11:35:00Z [unit u8-showcase-site] — review-02 READY（Minor 8件）。要件は凍結のまま、NFR Design 以降で扱う：(1) `_formicarium` の module の実行時の import の書き方と、boundary.ts の subpath の一致の規則。(2) showcase.yml の `biome check showcase` が showcase/site に掛かること、`**/types/**` の制限と `.astro/` の生成 dir の扱い。(3) Chromium の V8 coverage は受入の後にしか得られないので、coverage-80 の行を作る job を受入の後に置く（NFR2.3 の「build の job」を直す）。(4) deploy 後の確認（NFR8.10）で失敗した run を、NFR5.2 の「deploy が成功した run」に数えるか（数えないと古い run の Re-run で上書きされ得る）。deploy の step の成功で数える案。(5) NFR8.9 の summary を書く job と actions read の権限。(6) NFR8.5 (b) の切戻しの後に main から手動で distribute を動かして確かめる手順。(7)「Functional Design との関係」の表に、BR7.2 の coverage の bun と BR6.1 の承認者の扱いを足す。(8) NFR8.3 の notices の範囲（production の依存の推移すべて）が過大で、license の file の無い package で日次の配布が止まり得る。範囲を build の出力に入る package に絞る案。NFR8.11 の dependency-review が bun.lock を扱えるかは未検証。
- 2026-10-19T00:40:00Z [unit u6-recipe-runtime] — review-02 READY（Minor 3件）。設計は凍結のまま、後続で扱う：(1) NFR6.1 は review-01 R-01 により、人間が選んだ Q2=A の文面（1ブラウザ1回、ready の後に120秒）ではなく、旧 spec と同じ数え方（ブラウザ×en・ja の組ごとに180秒、goto から判定まで120秒）にした。人間に報告して確かめた（2026-10-19、人間の回答「旧specと同じ数え方でよいです」）。(2) NFR3.5 の coi-serviceworker.js の digest の固定値の置き場と更新手順は Code Generation の計画で決める。(3) NFR6.6 は欠番（性能側の NFR6.5 と重ならないように安全側を NFR6.7・NFR6.8 にした）。
- 2026-10-16T20:33:00Z [unit u4-command] — レビューREADY（Minor 3件）。設計段階と同じ扱いで凍結のままとし、U4 Code Generation計画へ反映する：(1) NFR7のうちU6/U8の責任となるUI条件（loading/empty/error、keyboard、進捗unknownと0、時刻offset）の受渡しを明記する。(2) 入力の孤立surrogateはUTF-8へ変換できないためINVALID_INPUTとし、byte数はTextEncoder後の長さで数える。(3) 同梱browserのbuild番号は固定記録にせず、Playwrightの版と実行時に観測した値で記録する。
- 2026-10-18T01:28:44Z [unit u7-showcase-guests] — 実行計画はU6の後にU7の順だったが、人間の指示でU6より先にU7を始めた（U7の直接依存はU2・U4だけ）。公式musl資産の有無（pitchforkはglibcのみ）とBiomeのELFがstaticかは、実行時点の最新releaseで確かめる。境界の機械検査の方法と `showcase/` の構成はNFR Designで決める。
- 2026-10-18T01:31:00Z [unit u7-showcase-guests] — レビューREADY（Major 2件、Minor 3件）。凍結のままとし、U7のNFR Designで扱う：(1) NFR5.3：packの調達元（B1受入のartifactを取得するか、再buildならbyte再現の条件）と、日次buildのcommitがB1受入commitより進んだ場合の扱い。(2) NFR3.4：source buildの出所記録（Cargo.lock・rustc・dependencies・builderHash）と、Rustの選び方（現行terrariumは自前のRustでupstreamのwrapperを避けている）、pitchfork UIのNode・aubeの版の扱い。Minor：repository許可一覧がPRで変えられる設定であること、PRでのsource build（最大4h）の費用と並行、資産URL・最終URL・attestationのC09 manifest上の置き場所。
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
