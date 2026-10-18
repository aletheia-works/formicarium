# 修正案：U3の受入入口のU4への依存（review-05 R-10・R-11）

作成：2026-10-17。状態：人間の判断待ち。判断を受けるまで実行しない。

## 指摘

- R-10（Major）：U3の受入入口（`scripts/migration-install/completion.ts`・`coverage.ts`・`measure.ts`）が、U4の `scripts/migration-command/stage.ts` から `INSTALL_REGRESSION_UNITS` と `candidateSourceInventory` をimportしている。`stage.ts` はU3の `installSourceInventory` をimportするので、U3とU4のmoduleが循環する。また、U3がU4に依存する向きは、単位のDAG（U4がU3に依存する）と逆である。さらに、`installSourceInventory` は `scripts/migration-command/` を含まない。そのため、U3の受入を決める規則が、U3のsourceIdentityの外にある。
- R-11（Minor）：U4の候補を渡しても、U3のreportの `unit` は `u3-install` に固定され、`laterUnits` も「U4未受入」のままになる。
- 拒否の条件そのもの（ほかのunit・欠落・skip・不一致・sourceIdentity・80%・分母）は弱まっていない（review-05で確認済み）。

## 選択肢

### 案A（推奨）：規則をU3側に置き、U4の一覧はU4から渡す

1. U3の `scripts/migration-install/stage.ts` に、受け入れるunitの一覧（`u3-install`・`u4-command`）を置く。U3の候補には、従来どおり `installSourceInventory` を使う。
2. U4の候補に使うsource一覧は、U3の入口の引数（またはoption）として受け取る。U4の入口（`scripts/migration-command/*`）が自分の `commandSourceInventory` を渡す。U3の入口は、U4の候補で一覧が渡されなければ拒否する。
3. U3の入口から `scripts/migration-command/` へのimportをなくし、循環を解く。U4の `stage.ts` は、従来どおりU3の `installSourceInventory` を使う（U4→U3の正しい向き）。
4. R-11：reportに `candidate.unit` を記録し、`laterUnits` の文言を候補のunitに合わせる。
5. 試験：先に、「U3の入口がU4のmoduleをimportしない」「U4の候補で一覧が渡されなければ拒否する」「reportに候補のunitが入る」の試験を書いてfailを観測する。そのあとに直して、passを確かめる。既存のacceptance・lifecycleの試験は維持する。
6. 手順：U3のcode-generationを開き直し、計画に追加Stepを書いて承認を受ける。U4側の呼出しの変更は、U4の計画（再承認を受ける予定のもの）に1項目として加える。U3のやり直しのレビューは今回の試行で使っているので、2回目のレビューはまた人間の依頼として記録する必要がある。

- 利点：依存の向きが単位のDAGに合い、U3の受入規則がU3のsourceIdentityに入る。
- 欠点：U3をもう一度やり直す。U4の計画にも1項目が加わる。

### 案B：U3のsource一覧に `scripts/migration-command/stage.ts` を含める

規則がU3のsourceIdentityに入る。しかし、循環と逆向きの依存は残る。U4の `stage.ts` が変わるたびに、U3の受入も変わる。

### 案C：持ち越し、U4の後の最終ラウンドで直す

U3のcheckpointを今すぐ確かめて先へ進む。R-10・R-11は記録して持ち越す。最終ラウンドで直すときには、U3をもう一度開き直すことになる。

## 変えないこと

AI-DLC本体、品質基準（180秒、非download中央値3000ms、coverage 80%、容量上限、worker 1・retry 0）、U3の製品コード、拒否の条件。過去の受入結果は履歴として扱い、変更後のsourceの成功証拠にしない。
