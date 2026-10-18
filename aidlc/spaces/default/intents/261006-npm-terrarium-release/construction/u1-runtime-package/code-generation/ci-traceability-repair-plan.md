# CI and Traceability Repair Plan — U1

## Sources

人間の指示「遠隔CIと要件対応記録の不足も対応して下さい。」とU1計画へのRequest Changes。requirements.md、unit-of-work.md、U1 functional-spec/rules、Build and Test cross-unit-traceability.md/test-results.md、verification/additional-20261010-v1/requirement-gap-assessment.mdが根拠。今回の文書作成は修復実行・工程承認の証拠ではない。

## Loop-back 1 Diagnosis

保存記録による検証済み：正式build3段階exit0、Node125/browser21成功に加え、追加Node192/browser159（351件）成功。U1 package追加Node138/browser123、core追加Node54/browser36。全体は遠隔CI未検証と95要件中exact OK56/不足39により不合格。39は試験失敗件数ではなく、直接FR/親NFR対応不足31と外部Deferred8。現在の同HEAD全event CI照会はfork/upstream各0件。

主セッションからの引継ぎ：既存成果Keepの正式Code Generation再開始を実行済み、Build and Test Loop-back1 ledgerの追記は未保存。承認前の書込み制限があるため本U1 recordへ診断を保存し、許可成立後に主セッションが元Build and Test記録へ追記する。記録上の旧0/3を事実に反して現在回数として再使用しない。Stopは主セッションが無効化済みとして引継ぎ、ここから変更しない。

## Bounded Mapping Repair

| U1 exact ID | 照合する実装/試験 | 必須の根拠 |
|---|---|---|
| FR1, FR1.1 | runtime/public.ts、runtime/node/api.ts、runtime/web/api.ts、tests/package/consumer.test.ts/consumer.spec.ts | 公開入口、空consumer、repo外参照なし、Worker/資産ロード |
| FR1.2, FR1.3 | tests/package/pack.test.ts/types.test.ts、scripts/package/verify-package.ts | tgz固定24file、exports/型/LICENSE/notices/build-info、guest非同梱 |
| FR2, FR2.1, FR2.2 | runtime/validation.ts/protocol.ts/core.ts、tests/package/validation.test.ts/protocol.test.ts/core.test.ts/consumer.test.ts | static ELF、argv/env/cwd/bytes、stdout/stderr/exit、失敗分類と入力拒否 |
| FR3, FR3.1, FR3.2 | runtime/state.ts/guest-io.ts/lifecycle.ts、tests/package/state.test.ts/guest-io.test.ts/lifecycle.test.ts/consumer.test.ts | snapshot、公開FS操作、reset/コピー/分離、rollbackと全子条件 |
| FR4, FR4.1 | runtime/worker-execution.ts/lifecycle.ts、tests/package/worker-execution.test.ts/node-worker.test.ts/nested-worker.test.ts/browser-worker.spec.ts/nested-worker.spec.ts | 実Worker/子Worker終了、timeout/abort/dispose、late/BUSY、次run無汚染 |
| NFR2 | U1公開consumer結果＋U4/core回帰結果への参照 | probe600/aube browser840/pitchfork600・120秒、1worker/retry0、probe8/native/1GBの全条件 |
| NFR6 | runtime/core.ts/web/package-worker.ts、tests/package/core.test.ts/browser-worker.spec.ts | core境界、waitAsync削除維持、guest変更による製品JS変更不要 |

これは候補対応表でありOK判定ではない。試験名/ログを個別確認してからtraceabilityへ登録する。既存57対応と逆対応を保持する。U1だけの証拠で全体NFR2を満たせない場合は明示的DeferredとU4根拠待ちを残す。FR7総合受入れ、FR5/UI、FR6供給、FR8–FR10公開は各所有Unitへ引き継ぐ。外部8ACは必要操作と証拠が揃うまでDeferredを保持する。

## Evidence Keep and CI Handoff

現候補v9 tgz SHA256 `dfcc3e6384b5ed14ddefbccd4806b9f1be2d858129e74216f116668142571f6d`、core `a882fb2f3df14115b7e46f6812fb296eef5934d7`、固定14JS、v14 coverage862/982=87.78%/1253realm、installed24fileを保持。保存済みSafari5caseは再照合対象、過去接続失敗の原因や恒久解消は未検証のまま。pitchforkの対象はv2.30.1で、旧patchファイル名は旧版の実行指定ではない。

U4が遠隔CIを所有する。U1引継ぎはunit-test-instructions.mdの現行コマンド、固定inventory/除外理由/未import0/realm欠落拒否、同tgz空consumer、raw/coverage-report/candidate digestsを含む。古いverify.workflow.ymlのcore-only成功ではnpm候補/coverage/terrarium/全release条件を満たさない。

遠隔runには送信可能なcoreの最終署名SHA、lock/clean source/正式build同一性、guest builder入力固定又は承認済み新guest検証、正式workflow/具体送信commit/送信先が必要。これらをU4計画で具体化し、既存指示に従い外部送信の必要承認を得る。Plan Approvalだけでpush/dispatch/PR/publish/Releaseを実行しない。遠隔成功はrun URL/head SHA/jobs/steps/artifact tupleを照合して初めて記録する。

## Impact and Completion Conditions

推測：要件記録修復と照合1–2時間、追加サービスなし・製品bytes変更なし。正式Unit再レビューで新attemptの完了手続きが必要。遠隔CI工数はcold build/送信権限/guest再現性に依存し未確定、計画書だけで解消したと扱わない。

U1完了条件：14 exact IDsに個別根拠付きOK又は理由付きGAP/Deferredを明示、既存対応/tuple不変、runner成功、新正式レビューと正式完了手続き。全体完了条件はU2–U4の修復・遠隔CI・cross-unit gate再判定が別に必要。未検証をN/Aへ置換せず、95/95を保証しない。実装不具合・identity不一致が出たら新記録を保持して正式停止する。
