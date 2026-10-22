# U2 実装計画

## Summary

- Builds: 今回の再開（2026-10-19、追加Step 25–31）：WebKit でも分離の下で動くように、browser の package Worker を import の無い1つの file（`runtime/web/package-worker.bundle.js`）にして配布物に入れ、browser API の既定の Worker の URL をそれに替える（U6 の観測と人間の回答 A）。下の各行は、それより前の要約（履歴）である。新しい土台（upstreamのmain `bbf97ba6`）への合わせ（追加Step 20–24）。`scripts/migration-session/completion.ts` のcoverageの件数の固定（16件）を、配布一覧 `FIRST_PARTY_JS` の件数と比べる形に直す。U2の記録（traceability・code-summary・計画の古い記述）を、mainにあるものだけを根拠にするよう直す。
- Touches: 今回：formicarium の build の最後の段階（`.build/scripts/emit.js` の元の `scripts/emit.ts`、又は同じ段階の新しい script）、`runtime/web/api.ts` の既定の Worker の URL、`package.json` の files、`scripts/package/stage-package.ts`・`verify-package` の一覧、coverage の一覧（`coverage-inventory.json`）、試験（`tests/package/`・`tests/migration-session/`）。履歴：`scripts/migration-session/completion.ts`（と、件数を確かめる試験 `tests/migration-session/completion.test.ts`。どちらもmainへのPR）と、U2の記録（traceability.json・code-summary.md・source-manifest.json）。
- Tests: 今回：bundle の形の試験（静的な import と `import.meta` が無い、同じ入力から同じ bytes、配布一覧と pack に入る）を5–8件と、既存の consumer・browser の試験を3ブラウザで1つずつ実行する。WebKit を含む3ブラウザの分離の確認は U6 の Step 3 の観測をやり直して行う。履歴：先に、completionが件数の不一致で拒否されることを再現する試験を書いて失敗を観測し、直したあと成功を確かめる。`lint:all`・`typecheck`・`build`・`test:light`・`migration-session-unit` を1つずつ実行し、独立レビューとintentの検証コマンドによるcheckpointの確認を行う。

## 対象と前提
FR2/FR5/FR6、BR2.1–BR2.11、U2 NFR2.1/2.2/3.1–3.5/4.1/4.2/6.1/8.1/8.2を実装する。User Storiesは省略されており、直接FR/BR/NFRで追跡する。
U1の実36試行と固定Biome CIの通過証拠を事前条件として保持する。U1の承認済みsource/evidenceを編集しない。U3取得・install、U4コマンドと最終B1、実公開はこの単位の実装対象外。
調査時private0.1.0-rc.1の作業sourceを公開基準とみなさず、公開0.2.1との差分を確認する。U2候補はstaging内0.3.0として暫定証拠に明示し、rootの公開状態やタグを変更しない。

## 順序と変更対象
Step 1–8は既存実装の履歴であり、再開による再実装を指示しない。今回実施する範囲はStep 9–11。
- [x] Step 1: 既存runner・型・build設定を確認する。mise run build/typecheck、既存tests/package/runner-ready.test.jsをmainで実行する。U2専用tests/migration-session/とPlaywright設定、miseのmigration-session-unit/browser taskを整備する。DB/repository/UI層は本単位に存在しない。
- [x] Step 2: GuestValidation層をruntime/guest-validation.tsへ実装する。共通同期SHA256・canonical metadata・static ELF64検証、C11上限、private WeakMap handleとfixture全件検証/copyを実装する。既存純粋処理が適合すれば再利用し、Node専用importやU1開発コードを配布runtimeへ依存させない。（FR2、BR2.1/2.2/2.3/2.9、NFR3.1–3.5）
- [x] Step 3: Step 2実装後、tests/migration-session/guest-validation.test.ts・fixture.test.tsを作成しmainで実行する。digest vector/metadata未知field、ELF不正/overflow、上限/+1、後続mutation、偽/別instance handle、symlink loop/escape、hardlink整合を含む。（FR2、安全性要件）
- [x] Step 4: runtime/lifecycle.ts・state.tsにsession所有予約token/epochとguest registryを統合し、必要ならruntime/session-port.tsに非公開C02 portを置く。run/readFile/remove/listEntries/setCwdも同一予約、内部継続は再acquireなし。reset/disposeの取消・cleanup・初期状態復帰/終端、atomic commit・旧release拒否を実装する。既存Worker cleanupの有限待機とraw run意味を維持する。（FR5、BR2.4–2.8、NFR4.1/4.2）
- [x] Step 5: Step 4実装後、tests/migration-session/reservation.test.tsを作成しmainで実行する。制御可能なspawn/cleanupでbusy、取消、旧commit/release、reset/reset・reset/dispose、失敗時FS/cwd/登録不変、2session分離を再現する。（FR5）
- [x] Step 6: runtime/public.tsとtypes/index.d.tsへC03の4関数とGuestHandle/GuestBuildInfo/期待値型を追加し、Node/browser Sessionへ接続する。package.json files、scripts/package/stage-package.ts・coverage-inventory.jsonに新配布JSを登録する。C02はpackage exportへ公開しない。（FR2/FR6、BR2.10/2.11）
- [x] Step 7: Step 6実装後、tests/migration-session/public.test.ts・consumer.test.ts・types-valid.ts/types-invalid.ts・consumer.spec.tsを作成し実行する。既存実guest/wasmを使い同一packをNodeと3ブラウザから利用し、検証後copy・fixture・session競合とexports/typesを確認する。実機Safari未検証を保持する。（FR2/FR5/FR6、NFR6.1/8.1）
- [x] Step 8: scripts/migration-session/stage.ts・completion.tsと専用taskを作成する。新source/pack/inventoryへbindしたU2暫定候補、全realm coverage、既存consumer/probe/aube回帰を逐次実行し、欠落/skip/未検証は成功にしない。既存package coverage収集処理を拡張する必要がある場合はU2配布変更と対応づけ、80%/timeout/worker/retryを維持する。U1の固定14ファイル証拠をU2候補の証拠として使わない。統合前CI成功は別途実観測し、未承認push/外部適用を行わない。（NFR2/8）
- [x] Step 9: 既存C02/C03実装と契約、v8固定入力・結果・source/pack/inventory・consumer・配信元の結合を照合する。2026-10-16T10:18:42.073Z–10:42:13.335Zにmainで観測した21工程の原ログを用い、今回のU2再開で新たに全工程を実行したとは記載しない。currentSource394件・全証拠435件・独立consumer31ファイルと全realm生カウントを確認する。共有SHA256と生記録照合の変更は現在の検証対象として確認し、本計画で再実装しない。（FR2/FR5/FR6、NFR8）
- [x] Step 10: U2のcode-summary.md・traceability.json・source-manifest.jsonとcurrent-recovery-verification.mdを現在の証拠へ整合させる。個別パスの主張を保持し、旧16JS/26pack・署名付きCIおよび旧v4/v5/v6/v7の履歴と、現在21JS/31packのv8ローカル証拠を区別する。封印された過去の入力・結果・証拠、U1承認済み成果物と完了承認は変更しない。（NFR8）
- [x] Step 11: 独立レビューを受け、指摘を検証する。主担当が承認済みverification-command.txtのコマンドでU2の正式完了確認を実行し、成功時は通常の単位完了承認を自動で進める。新しい実装・検証入力・コマンドが必要なら先に確認する。（NFR2/8）

## 追加Step：最新toolchainでの再確認（2026-10-17、Code Generationの再開）

人間の方針（2026-10-17）：古い版のtoolで作った記録は、今のtoolchainの根拠にしない。最新版で実行した成否だけで確かめる。Steps 1–11と、下の「検証と停止条件」に書いたv8の記述は、古いtoolchain（Node 24.21.0）での履歴として残す。今の判定には使わない。

U2がclaimするfileのうち、toolchain更新（commit 7c7ceaf4）とU3のcoverage collectorの変更（launches.jsonlの起動台帳）で12件が変わった。そのため、U2のレビューは今のsourceに結び付かなくなった。U2の製品コードは変わっていない。U1の承認済み修正案に沿って、mainはU1/U2共通のcurrent completionを最新版だけでやり直した（v10）。人間は、その読取り専用の検証コマンドを承認した。

- [x] Step 12: U2の記録をv10へ揃える。code-summary.mdとcurrent-recovery-verification.mdの先頭に、v10の結果を書く。書く内容は次のとおり。
  - 入力 `.artifacts/migration-preflight/current-recovery-input-20261017-v10.json`（SHA256 56c78183f6b1af91f9e1de7a1179c6d9ba416ff2be584834d4f5931a050d6fb9）
  - report `.artifacts/migration-preflight/current-completion-7de2263f-2f39-4236-8895-82b7f32b55a8/current-local-verification-report.json`（SHA256 e7760ddbe0e943d0830e8a7093c30a5898cfc86f8d49ed5d94f7e55dab197a01）
  - 20工程exit0、coverage 1768/1929行＝91.65%、skip0、1495 realm
  - 承認済みの検証コマンド `verification/verification-command-u1u2-v10.txt` と、その `verified:true`
  - v8・v4〜v7は、古いtoolchainの履歴であること

  U2のアプリケーションコード・試験・traceability.json・source-manifest.json・封印済みの過去の証拠は変更しない。（NFR8）
- [x] Step 13: 独立レビューを受ける。そのあと、intentに記録された検証コマンドでU2のcheckpointを確認し、通常の単位完了承認を自動で進める。新しい実装・入力・コマンドが必要になったら、先に確認する。（NFR2/8）

## 追加Step：U4の作業を戻した後の再確認（2026-10-17、2回目の再開）

U2のレビュー（review-06）の後、U2がclaimする共有fileが次の2つの理由で変わった。U2の製品コード（runtime/guest-validation.ts、session-port.ts、lifecycle.ts、state.tsなど）は変わっていない。
- 一時的に外していたU4の作業（Steps 1–7）を戻した。これにより、`package.json`（files、@types/node 26.6.5）、`runtime/public.ts`（`createCommandSession` のexportを追加）、`types/index.d.ts`（C05の型を追加）、`scripts/package/stage-package.ts`・`coverage-inventory.json`（配布JSが23件に）、`README.md`、`mise.toml`（U4のtask）が変わった。
- AI-DLCを2.11.1-preview.20261016.1に更新した（人間の承認済み。`mise.toml` のpinを変更）。

intentの検証コマンドは、人間の承認により、U1の試験を今のsourceで実行するコマンドに置き換わった。U2の受入（v10の照合）は、作業開始時のsourceに結び付いている。U4の変更を含む最終的なsourceでのU1〜U4のまとめた確認と、新しい検証コマンドは、U4の作業がすべて終わった後に行う。

- [x] Step 14: U2の記録（code-summary.md、current-recovery-verification.md）に、今回の変更（U4によるexport・型・配布一覧の追加、AI-DLCの更新）と、U2の製品コードが変わっていないことを書く。追加されたexportと型が、既存のU2のAPI（C02/C03）を変えないことも確かめて書く。最終的なsourceでの確認はU4の後に行うことと、それまではv10を変更後のsourceの成功証拠として扱わないことを明記する。（NFR8）
- [x] Step 15: 独立レビューを受ける。そのあと、intentに記録された検証コマンドでU2のcheckpointを確かめ、通常の単位完了承認を自動で進める。（NFR2/8）

## 追加Step：U4の変更のうち、U2のfileに当たるものを引き受ける（2026-10-17、3回目の再開）

U4の追加Step項目3・4で、U2がclaimするfileが変わった。人間の判断で、その変更をU2の変更として引き受け、U2をこの1回だけやり直す。変更はmainのworking copyにすでにある。Step 14の「U2の製品コードは変わっていない」は、この変更より前の記述として残す。
- 項目3（製品コード）：`runtime/session-port.ts` の `SessionPort` に `resolvePath(path: string): string` を加えた。`runtime/lifecycle.ts`（と生成した `lifecycle.js`）がこれを実装する。相対pathは現在のcwdに付けて、既存の `normalizePath` の規則で正規化する。空・`..`・NUL・文字列でない値は `INVALID_INPUT`。cwdを読むだけで、session状態を変えず、予約も取らない。
- 項目3（試験）：`tests/migration-session/reservation.test.ts` に2件を加えた（相対・`.`・絶対pathの解決と、cd・resetの後の解決／不正な値の拒否、状態不変、予約を取らないこと）。
- 項目4（試験）：`tests/package/public.test.ts` のroot exportの一覧に `createCommandSession` を加えた。`pack.test.ts`・`package/coverage.test.ts`・`terrarium/coverage.test.ts` の件数（23件・33件）と名前の一覧は、U1のStep 18で確かめた内容と同じである。
- `tests/migration-install/lifecycle.test.ts` の模擬portへの `resolvePath` の追加はU3のfileなので、U3のやり直しで引き受ける。

- [x] Step 16: 上の変更をU2の変更として確かめ、U2の記録（code-summary.md、source-manifest.json、traceability.json）に書く。`resolvePath` が既存のC02/C03の振る舞いと公開API（package exportにSessionPortを出さないこと）を変えないこと、`normalizePath` の拒否条件を緩めていないこと、試験の期待値は実際の配布一覧に合わせただけで判定条件を緩めていないことを、file を読んで確かめる。mainで `tests/migration-session/reservation.test.js` と `tests/package/public.test.js` を逐次実行し、件数とfail・skip 0を記録する。最終的なsourceでのU1〜U4のまとめた確認はU4の後に行い、それまではv10を変更後のsourceの成功証拠として扱わない。（FR5/NFR8）
- [x] Step 17: 独立レビューを受ける。そのあと、intentに記録された検証コマンドでU2のcheckpointを確かめ、通常の単位完了承認を自動で進める。（NFR2/8）

## 追加Step：review-08の指摘の修正（2026-10-17、4回目の再開）

review-08（READY）のR-08〜R-10を直す。人間が承認した修正案 `u2-resolvepath-contract-proposal.md`（案A）に従い、U2のfunctional-designとcode-generationを開き直した。R-08（C02とU2の機能設計への `resolvePath` の追記）は、functional-designでBR2.12・WF2.6として直し、そのレビュー（READY）を受けた。上のStep 17は、この修正より前の流れとして残す。

- [x] Step 18: R-09とR-10を直し、BR2.12をcode-generationの記録へつなぐ。コードの振る舞いは変えない。
  - R-09：`runtime/session-port.ts` の `resolvePath` のJSDocに、次の点を書く。戻り値は呼出し時点のcwdにもとづく値であること。dispose・reset・abortの検査をしないこと。不正な値では同期で `INVALID_INPUT` を投げること（ほかのmethodのようにPromiseのrejectにはしない）。呼出し側は予約を保持している間か、同じtickのうちに値を使うこと（BR2.12）。interfaceのJSDocだけの変更で、生成JSは変わらない。
  - R-10：`current-recovery-verification.md` の冒頭に、3回目の再開で `session-port.ts`・`lifecycle.ts` の製品コードが変わったこと（詳細はcode-summary.md）への1行の参照を加える。
  - `traceability.json` に、BR2.12と `runtime/lifecycle.ts`・`tests/migration-session/reservation.test.ts` の対応の行を加える。`code-summary.md` に、この修正を書く。
  - mainで `mise run build` と `node --test --test-concurrency=1 tests/migration-session/reservation.test.js` を逐次実行し、件数とfail・skip 0を記録する。
Step 18はmainで実施済み（build exit 0、reservation試験12件pass、fail・skip 0）。前の試行ではreview-08でレビューを使い切っていたため、エンジンがレビューの依頼を拒否した。人間の判断で、レビューのためにcode-generationをもう一度開き直した（2026-10-17）。計画の内容は変えていない。

- [x] Step 19: 2回目の独立レビューを受ける。そのあと、intentに記録された検証コマンドでU2のcheckpointを確かめ、通常の単位完了承認を自動で進める。（NFR2/8）（このレビューとcheckpointは、下の「新しい土台への合わせ」のStep 24で行う。Step 17のcheckpointの確認も、ここに含める。）

## 追加Step：新しい土台（upstreamのmain）への合わせ（2026-10-18、5回目の再開）

人間の指示（「upstream/mainの変更に合わせて下さい」）で、U1〜U4のコードをupstreamのmainへ移した（PR aletheia-works/formicarium#29、merge `f5bc078c`）。その後、#31・#32・#33がmergeされ、mainは `bbf97ba6` になった。#32で、U2の受入workflow（`.github/workflows/migration-session-u2.yml`）・CI専用の `scripts/migration-session/ci.ts`・`tests/migration-session/ci.test.ts` のCI専用の試験を消した。`ci-core.ts`・`ci-inputs.ts`・`ci/migration-session/` は、showcaseのworkflowが使うので残る。upstreamのmainでは、生成JSと `.github/publication/` を追跡せず、taskはpackage.jsonの `migration:session:*` と `mise-tasks/migration/session-*.sh` に置く。intentの検証コマンドは、人間の承認で `mise run typecheck && mise run build && mise run test:light && mise run migration-preflight-unit && mise run migration-preflight-current-unit && mise run migration-guest-build-unit && mise run showcase-unit` に変えた。

新しい土台で取り直したレビュー（review-10、READY、Major 1・Minor 5）の指摘を、人間の指示（「U2のコード生成を開き直して、計画を新しい土台に合わせて承認を取り、completion.tsの修正をPRにして、記録を直して」）で直す。

- [x] Step 20: `scripts/migration-session/completion.ts` の251行目 `report.files.length !== 16` を、`FIRST_PARTY_JS.length`（いまは23件）と比べる形に直す（R-06）。先に `tests/migration-session/completion.test.ts` に、coverageのreportの件数が配布一覧と違うときに `U2 current candidate coverage incomplete` で拒否し、同じときに受け付けることを確かめる試験を加え、直す前の失敗を観測する。直したあと同じ試験が成功することを確かめる。
- [x] Step 21: `traceability.json` のNFR8.2の対象を、消した `scripts/migration-session/ci.ts` から、mainにありnoticesの同梱を決める `scripts/package/stage-package.ts` に直す（review-10のMajor）。ほかの対象がすべてmainにあることを確かめる。
- [x] Step 22: `code-summary.md` の、`ci.ts`・`migration-session-u2.yml`・`.github/publication/`・16JSの記述を、古い土台の履歴として区別し、新しい土台での状態（いまのfileで確かめられること）を書く（review-10のMinor）。上の「検証と停止条件」のv8の証拠と旧verification-command.txtは、古い土台・古いtoolchainの履歴であり、新しい土台での確認はintentの新しい検証コマンドで行うと書く（R-05）。
- [x] Step 23: `source-manifest.json` に、Step 20で変えたfileが含まれていることを確かめる。U2の内容がない `mise.toml` を外し、U2のtaskの実体の `mise-tasks/migration/session-*.sh` を加える。
- [x] Step 24: main sessionで1つずつ、`mise run lint:all`、`mise run typecheck`、`mise run build`、`mise run test:light`、`mise run migration-session-unit`（候補・consumerの準備が要るなら、その準備と、準備できない場合は未検証として記録する）とStep 20の試験を実行する。そのあと独立レビューを受け、intentの検証コマンドでcheckpointを確かめる。Step 20のコードの変更は、mainへのPRにする（push・PRの作成は人間の指示に含まれる）。

## 追加Step：WebKit のための1つの file の package Worker（2026-10-19、6回目の再開）

U6（recipe-runtime）の Code Generation の Step 3 の観測で、vivarium の recipe page（coi-serviceworker で分離）から formicarium の browser Worker を起動すると、WebKit 27.2 では基準を満たさなかった。追加調査で、coi-serviceworker の `coepCredentialless` を false に固定し、package Worker を import の無い1つの file にまとめると、Chromium・Firefox・WebKit × en・ja × 初回・再訪問の24組すべてで、page・Worker・子 Worker の分離と SAB、2端末の ready を満たした（検証済み。観測用の bundle は `bun build runtime/web/package-worker.js --target browser --format esm --external 'node:*'`。記録は U6 の code-summary の Step 3）。Worker の import の一部が service worker を通らずに COEP で拒否されることが原因と読んでいる（推測）。人間の回答（2026-10-19）：1つの file の Worker は formicarium の package に入れる（A）、U2 の Code Generation を開き直す。

方針：今の `runtime/web/package-worker.js`（module の Worker）は配布物に残し、別に `runtime/web/package-worker.bundle.js` を足す。browser API の既定の Worker の URL（`createSession` の `options.assets` が無いときの `packageAssets(...)`）を bundle に替える。子 Worker（`em-pthread`）は `child-create` で同じ `workerURL` を使うので、子も bundle になる。Node の Worker は変えない。公開 API・型・C02/C03 の振る舞いは変えない。0.3.0 は未公開なので、版の番号は変えない（公開の手順は U2〜U4 の範囲の別の作業）。

- [x] Step 25: 構成と tool の確認。formicarium の upstream の main を fetch して比べ、最新の Bun・TypeScript・Playwright を確かめる。bundle を作る道具は `bun build`（Bun の latest）とし、同じ入力から同じ bytes になるかを2回の build で確かめる。ならない場合は止めて報告する。既存の試験 `tests/package/public.test.js` と `tests/migration-session/consumer.spec.js` が main で動くことを確かめ、command を code-summary に書く。
- [x] Step 26: 実装。build の最後の段階で `runtime/web/package-worker.js` から `runtime/web/package-worker.bundle.js` を作る（`--target browser --format esm`、`node:*` は外部のまま、source map を一緒に出す）。`runtime/web/api.ts` の既定の Worker の URL を bundle に替える。`package.json` の files、`scripts/package/stage-package.ts` と `verify-package` の一覧に bundle（と map を配る場合は map）を足す。coverage の一覧では、bundle を「生成物（元は既存の第一者の JS）」として理由付きで対象外にし、bundle の中で動いた行は source map で元の `runtime/*.js` に対応させる。元の file を分母から外さない。（BR2.10/2.11、NFR2.2、NFR8.1）
- [x] Step 27: Step 26 の後の試験。`tests/package/worker-bundle.test.ts`（新しい file）に、bundle に静的な `import`・`export ... from`・`import.meta` が無いこと、`node:*` 以外の動的 import が無いこと、2回の build で同じ SHA256 になること、pack と配布一覧に入ること、既定の Worker の URL が bundle を指すこと、`options.assets` で別の Worker を渡したときは従来どおりそれを使うことを確かめる5–8件を書き、実行する。既存の `tests/package/public.test.js` も実行する。
- [x] Step 28: browser の試験。既存の `tests/migration-session/consumer.spec.js` を Chromium・Firefox・WebKit で1つずつ実行し、bundle の Worker で session・guest の検証・run が今までどおり動くことを確かめる。coverage の収集が bundle の source map で元の file に対応し、分母の file がすべて report に出ることを確かめる。
- [x] Step 29: U6 の観測のやり直し。新しい pack を作り（U6 の Step 1 と同じ手順）、U6 の Step 3 の観測の写し（`.artifacts/u6-recipe-runtime/s8-observation/`）で、候補2の置き場、`coepCredentialless` を false に固定、配布物の bundle の Worker で、3ブラウザ × en・ja × 初回・再訪問を観測する。24組すべてで基準（page・Worker・子 Worker の `crossOriginIsolated === true` と SAB、2端末の ready）を満たすことを確かめ、U2 と U6 の code-summary に書く。満たさなければ止めて報告する。
- [x] Step 30: 記録と回帰。U2 の code-summary.md・traceability.json・source-manifest.json に今回の変更を書く。main session で1つずつ `mise run lint:all`、`mise run typecheck`、`mise run build`、`mise run test:light`、`mise run migration-session-unit` を実行する。U3・U4 の試験のうち browser の Worker を使うもの（install・command の browser の試験）も1つずつ実行し、影響が無いことを確かめる。影響があれば止めて報告する。
- [x] Step 30a: review-01（NOT-READY）の指摘を直す（2026-10-19）。R-01：bundle の Worker の中で `Atomics.waitAsync` が `undefined` であることを3ブラウザで確かめる browser の試験を足す（project の必須の規則）。R-02：`tests/package/worker-bundle.test.ts` が一時の dir を作る前に `.artifacts` を作るように直す（先に `.artifacts` の無い状態での失敗を観測する）。R-03：試験の手順の文を、人間が認めた差（coverage の数え方、残る動的 import）に合わせた。R-04：配布する bundle が、元の file から build し直した結果と同じ bytes であることを `worker-bundle.test.ts` で確かめ、使った Bun の版を code-summary に書く。R-05：子 Worker の script の URL が既定の Worker の URL と同じことを、R-01 の試験で記録する。R-06：U2 の試験だけの coverage は参考の値として記録する（人間の判断で根拠はまとめた収集）。直した後、`mise run build`、`worker-bundle.test.js`、`public.test.js`、browser の試験（3ブラウザを1つずつ）、`mise run lint:all`、`mise run typecheck`、`mise run test:light` を1つずつ実行する。
- [x] Step 31: 独立レビューを受ける。そのあと、intent の検証コマンドで U2 の checkpoint を確かめる。formicarium の変更は main への PR にする（push・PR の作成は、実際の内容を示して承認を受けてから行う）。

## 追加Step：terrarium の削除（PR #58）の後の確認（2026-10-21、7回目の再開）

U9 の PR aletheia-works/formicarium#58（merge `5735433d`）で、terrarium を消した。U2 に関係するのは次の3つ。

- `scripts/migration-session/stage.ts` の `sessionSourceInventory`：消した3件（`docs/terrarium-integration.md`、`tests/terrarium/current-candidate.test.{ts,js}`）を外した。
- guest の配布の部品：`integration/terrarium/guest-distribution/` から `integration/guest-distribution/` へ移した。
- release の判定：terrarium の consumer の受入を外した。

U2 の Code Generation は、レビューの回数を使い切っていた。そのため、人間の判断（2026-10-21「はい、開き直して下さい」）で開き直した。U2 の製品コード（`runtime/`・`types/`）と公開 API は変えていない。Step 1〜31 は履歴として残す。

- [x] Step 32: #58 の影響を確かめる。
  - `jj diff -r u9-remove-terrarium` のうち、U2 の source-manifest.json の path に当たる file を読み、U2 の振る舞い（C02・C03、候補の inventory、coverage の分母）を変えていないことを確かめる。
  - 次を main session で1つずつ実行し、件数と fail・skip を記録する：`mise run typecheck`、`mise run build`、`mise run test:light`、`mise run migration:session-unit`
  - `consumer.test.js` などで、stage した候補の環境変数（`FORMICARIUM_CANDIDATE` など）が要るものは、準備できなければ未検証として記録する。
  - 影響があれば止めて報告する。（FR2/FR5/FR6、NFR2、NFR8）
- [x] Step 33: U2 の記録を、#58 の後の状態に合わせる。
  - `traceability.json` と `source-manifest.json` の対象の path のうち、移した file・消した file を指すものを直す。
  - `code-summary.md` にこの再開の節を足し、#58 で変わった file と Step 32 の結果を書く。
  - 開いている指摘（R-15〜R-18）は、この再開で直せる記録の部分だけを直し、残りはそう書く。
  - 製品コードは変えない。（NFR8）
- [x] Step 34: 独立レビューを受ける。そのあと、intent の検証コマンドで U2 の checkpoint を確かめる。

### 2026-10-21 の Request Changes について

Code Generation の段階を閉じるとき、どの Unit も一覧に持たない変更が 178 件あると AI-DLC が止めた。そのうち `ci/migration-session/payload/*.bin` の 18 件は U2 の固定の入力なので、人間の判断（2026-10-21「1でお願いします。」、その後「A」）で U2 の `source-manifest.json` に足した。そのためのレビューを受けるために、人間が Request Changes を選んだ（2026-10-21）。計画の Step と内容、製品コードは変えない。

- [x] Step 35: `source-manifest.json` に足した 18 件（`ci/migration-session/payload/*.bin`）が、`ci/migration-session/inputs.bundle.json` の `files` の SHA256 と1対1で対応することを読取りで確かめ、code-summary に書く。そのあと独立レビューを受け、intent の検証コマンドで U2 の checkpoint を確かめる。（NFR8）
- [x] Step 36: `scripts/ci/run.ts` を U2 の `source-manifest.json` に足す（2026-10-22、人間の指示「はい、その形で進めて下さい。」）。PR #29（`f5bc078c`）が足した migration の coverage の suite（`MIGRATION_COVERAGE_SUITES`：migration-session・migration-install・migration-command と、その試験の一覧）は、Code Generation の間の変更で、どの Unit の一覧にも無かった。U2 の session・guest-validation の試験を含むので U2 が持つ。#29 の差分を読んで、今の file に U2 の内容（suite の一覧）が残っていることを確かめ、code-summary に書く。同じ判断で、この intent の変更ではない148件（intent の開始前に main に入った変更と、ほかの作業の変更）と `.aidlc-source-paths.json` を、file の名前で `.aidlc-source-paths.json` の `exclude` に足したことを記録する（一覧は formicarium の `.artifacts/u9-retirement/uncovered-report.md`）。code は変えない。独立レビューを受け、intent の検証コマンドで U2 の checkpoint を確かめる。（NFR8）

## 検証と停止条件
各層のtest-after順序、main sessionでの逐次実行、既存品質基準を維持する。今回の変更は記録の整合であり、新規の実装追従テストは追加しない。
現在の証拠は `.artifacts/migration-preflight/current-recovery-input-20261016-v8.json`（SHA256 25d44cb9c6def3cdc65317d76add2ecb90b5010fc05f4e097f982cdf98655bd0）と `.artifacts/migration-preflight/current-completion-8c15f728-80d1-40e4-90e6-cea86c413cb8/current-local-verification-report.json`（SHA256 fe0d5a01fe5e193258f10371d9cd7c3a446b8b820f3005dabcaeca0300b63079）に固定する。全21工程exit0、coverage1768/1929行（91.65%）、skip0を既存の原ログから照合する。短時間verifyで現在sourceと封印済み証拠の一致を再確認する。既に承認・設定済みのverification-command.txt（command SHA256 10098116c484c2f62527bd65045c06cab2b0a5433e1c312fb7ff6c3322623bef）を変更せず使用し、旧migration-session-completionの16JS入口を現在21JSの完了根拠へ転用しない。U1の現在の完了承認は保持する。AI-DLC本体、180秒期限、非download中央値3秒、coverage80%、容量上限、worker1/retry0を維持する。
証拠不一致、検証失敗、機能上の欠陥、封印対象の変更が必要になった場合は停止して具体的な修正・再検証を確認する。21工程の自動再実行、push、CI試行は本再開計画に含めない。実装計画・試験指示を変えた場合はstrictの再承認を受ける。
U3 installと共有SHA256性能改善は実装済みであり、U3の正式受入れは未完了。文書更新前候補の36試行成功は履歴として保持し、現在の候補への付替えはしない。U3のCI実配信入力修正・再検証は承認済みの後続作業とし、U2再開の記録整合へ混ぜない。現在のローカル証拠だけで統合前CI、U3受入れ、U4の完全C06チェック、U5開始、公開を許可しない。実機Safariは未検証。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: 通常の新規実装は各テスト可能な層を実装した後にその層のテストを作成・実行し、不具合修正は再現テストの失敗を先に観測してから修正し同じテストの成功を確認する。（人間の回答 Q3）\n- node:test と Playwright の既存結合テストを利用する（検証済み：package.json scripts、code-quality-assessment.md）。今回の成功結果・coverage 値は未検証。\n- classic の追加条件は行 coverage 80%以上と統合前 CI 実行（ドキュメント根拠：org.md Testing Posture）。基準を下げて通過させない。\n- coverage の技術提案（未実装・未検証）：第一者が保守する配布 JS 全体（既存 runtime の未変更ファイル、共通処理、公開 API、Node/browser Worker adapter を含む）の一覧を事前に固定し、未実行ファイルも分母に含める。tests、生成 blink JS/wasm、第三者/vendor、ゲスト ELF、.d.ts、デモ・開発専用 scripts は理由を明示して対象外とし、資産・型・回帰検証を別途行う。設計で配布対象を確定し、閾値達成のために除外を変更しない。\n- Worker/ブラウザ内の計測を収集・マージし、対象一覧と照合して欠落を検出する。未収集ファイルを分母から外さず0%または未測定として失敗／未検証を報告する。計測方式は担当者が未importファイル・別process/realmを含む試験を観測して選ぶ。対象一覧、除外理由、行数、レポート、実行コマンドを CI 成果物へ残す。ブランチ coverage の新しい数値条件は追加しない。\n- 既存上限は probe 600秒、aube ブラウザ840秒、1worker、retryなし、probe 8項目全通過、native 出力一致、wasm 1GB。テストは main session が逐次実行する（人間の指示：AGENTS.md）。\n- aube はソースが変わっていなければ再ビルドしない。計測は重い並行処理なしで行う。新しいコア不具合の回帰 probe は native Linux でも確認する。\n- npm tarball の import/Worker/型/wasm・notices・build-info の同梱確認は設計候補（推測・未検証）。ゲストと fixture は terrarium 側の ref 別配布という既存意図を維持する。"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:dd7d634a9c475bfe0b7fdd87b1566bd3f238a9b0ead389ae268b08de9bf333f2",
  "contract_sha256": "sha256:ce013e1551c9c06de1a756c04942d606c8dffe82caf0ae8422f95df28968c638"
}
```
