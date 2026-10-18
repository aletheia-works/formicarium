# terrarium移管の着手・引継ぎ概要

## 目的と判断者

`../intent-capture/intent-statement.md`の目的はビルド・検証の重複を減らし、vivariumがformicariumを直接利用する構成へ移すこと。`../intent-capture/stakeholder-map.md`に従い、デモ閲覧者・再現利用者・保守者の利用を維持する。範囲・優先順位・公開の最終判断はユーザーが行い、このチャットの節目で報告する。

## 承認済み範囲と順序

`../scope-definition/scope-document.md`のS0–S7と`../scope-definition/intent-backlog.md`のB0–B7はすべて必須。最初は計測とBiome baseline1件の試行。その後、公開API・共通操作・install、固定ビルド、再現UI、契約/文書整理を進める。公開API後にlatest3ツールデモとサイトを移管し、再現・デモの両経路が通った後にterrariumを退役する。

順序はB0→B1→B2→B3→B4、B1→B5→B6、B4/B6→B7。試行中は旧入力を一時利用できるが、全体完了時には関連repoの個人inputs.tar.gz依存を解消する。各作業を個別受入できるPRへ分割する。

## 実現性と残るリスク

`../feasibility/feasibility-assessment.md`は条件付きで実行可能と評価している（推測）。CORS・工程別時間・baselineビルドと再利用は未検証。`../feasibility/raid-log.md`のR01–R06を維持し、まずB0で不確実性を確認する。CORS不可なら同originミラー、導入が遅い場合は設計見直し又は事前導入を検討し、結果を確認してから大規模移管へ進む。

作業checkoutと公開版の整合、完全commitのremote存在、CI権限/容量、ライセンスとinfra stateは各作業前に確認する。過去の試験成功を今回の合格として扱わない。

## 制約・リソース・対象外

`../feasibility/constraint-register.md`のC01–C12を引き継ぐ。固定期限・追加予算は設定せず既存環境で進め、新費用は事前相談する。既存品質限界・互換性を維持し、測定と重い処理は直列実行する。追加の人員・定期報告・外部通知は設定しない。作業責任は後続配送計画で具体化する。

JIT、コア置換、動的リンク、guestネットワーク/シェル/パッケージマネージャ、任意URL install、showcase独立化、デモ追加は対象外。既存版を削除せず、移行完了までterrariumを維持する。

## Go / No-Goと引継ぎ

推奨は、承認済み範囲を維持して現状確認・要件・設計へ進むこと。これは移管成功や公開の承認ではない。B0通過までは大規模移管を開始しない。未達条件は解消又は代替方式の具体化・確認を行う。公開・deprecation・archive・infra変更は具体的内容をユーザーへ提示して承認を得る。

後続は導入時間の数値閾値、比較入力/結果、完全source、再利用の判定証拠、各品質試験、公開基点を要件と配送計画へ対応付ける。初期整合の確認は`../../verification/phase-check-ideation.md`、既存判断は`decision-log.md`を参照する。
