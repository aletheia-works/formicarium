# 修正案：`resolvePath` をC02契約とU2の機能設計に書く（review-08 R-08〜R-10）

作成：2026-10-17。状態：人間の承認待ち。この案は、承認されるまで実行しない。

## 1. 背景

- U4の追加Step項目3で、`SessionPort` に `resolvePath(path: string): string` が入った。U2はStep 16で、この変更をU2の変更として引き受けた。
- review-08（U2、READY）は、次の3件を出した。
  - R-08（Major）：共有契約C02の `interface SessionPort`（`inception/contract-design/contract-summary.md` 106–120行）には5つのmethodしかない。U2の機能設計（`functional-spec.md`・`rules.md`・`entities.md`）とtraceabilityにも、`resolvePath` の規則がない。U3の模擬port（`tests/migration-install/lifecycle.test.ts`）が実際に影響を受けている。
  - R-09（Minor）：`runtime/session-port.ts` の `resolvePath` のJSDocに、「呼出し時点のcwdの値」「dispose・reset・abortを検査しない」「同期で投げる」が書かれていない。
  - R-10（Minor）：`current-recovery-verification.md` に「U2の製品コードは変わっていない」が残っている。
- 人間の指示（2026-10-17）：R-09とR-10は今U2の中で直し、2回目のレビューを受ける。R-08は、contract-designとU2のfunctional-designを開き直して直す修正案を作り、実行前に承認を受ける。

## 2. 調べて分かった制約（読取りで確認）

- U2のcode-generationの計画は、review-08の後で凍結されている（review-freeze hookが編集を拒否した）。R-09・R-10を直すにも、U2のcode-generationを開き直す必要がある。
- `aidlc engine jump resolve --stage contract-design` の結果：contract-designへ戻るjumpは、全Unitに対して、delivery-planningと、Constructionの全stage（functional-design〜code-generation、build-and-test、ci-pipeline）と、Operationのstageを戻す。Unitごとに開き直す方法はない（`jump reopen` はUnitを指定する必要があり、Construction stage用である）。
- `aidlc engine jump reopen --target functional-design --stages functional-design,code-generation --units u2-session-guest-api` で、U2だけのfunctional-designとcode-generationを開き直せる（エンジンの使い方の表示で確認。未実行）。ほかのUnitの完成した作業・レビュー・承認は残る。
- レビューの指紋は、各stageのproduces（出力文書）とsourceにだけ結び付いている（`.claude/tools/aidlc-lib.ts` の `reviewArtifactEntries` を読んで確認）。そのため、`contract-summary.md` を書き換えても、U1・U3・U4のcode-generationのレビューはそれだけでは無効にならない見込みである（推測。実際の判定はエンジンが行う）。
- contract-designは完了済み（`[x]`）なので、`contract-summary.md` は凍結の対象外である。ただし、stageを開かずに書き換えると、その変更はcontract-designのレビューを受けない。

## 3. 選択肢

### 案A（推奨）：U2のfunctional-designとcode-generationを開き直し、C02の追記をU2のfunctional-designの中で行う

1. `aidlc engine jump reopen --target functional-design --stages functional-design,code-generation --units u2-session-guest-api` を実行する（開き直しは人間の承認後）。
2. U2 functional-design：
   - `rules.md` に `resolvePath` の規則を1件加える。内容：相対pathは現在のcwdに付けて `normalizePath` で正規化する。空・`..`・NUL・文字列でない値は `INVALID_INPUT` を同期で投げる。cwdを読むだけで状態を変えず、予約を取らない。戻り値は呼出し時点のcwdにもとづく。dispose・reset・abortは検査しない。呼出し側は予約を保持している間か、同じtickのうちに値を使う。
   - `functional-spec.md` のC02の節と `entities.md` の `SessionPort` に、このmethodを加える。
   - `contract-summary.md` のC02の `interface SessionPort` に1行を加え、本文に上の規則を1文で加える。この変更はU2のfunctional-designの変更として記録し、U2のfunctional-designのレビューで、契約との整合を確かめてもらう。追記であり、既存の5つのmethodと、BUSY・ABORTED・DISPOSEDの規則は変えない。
   - 独立レビューを受け、unit checkpointの前提をそろえる。
3. U2 nfr-requirements・nfr-design・infrastructure-designは、`resolvePath` で変わる内容がないため開き直さない（`--stages` に含めない）。
4. U2 code-generation：
   - 計画に追加Stepを書く：R-09（JSDocの追記だけで、振る舞いは変えない）とR-10（検証記録への1行の参照）。traceability.jsonに、新しい規則と `session-port.ts`・`reservation.test.ts` の対応の行を加える。
   - 計画の承認を受ける。そのあと、mainで `mise run build` と `reservation.test.js` を逐次実行する。
   - 独立レビューを受け、intentの検証コマンドでcheckpointを確かめる。
5. U3の模擬portの追加（`tests/migration-install/lifecycle.test.ts`）は、予定どおりU3のやり直しで引き受ける。U3のレビューでは、更新後のC02と照合する。

- 利点：U2の中で、契約・機能設計・コードの文書がそろう。開き直しは1回で済み、R-09・R-10の修正と同じレビューの流れに入る。ほかのUnitの承認は残る。
- 欠点：contract-designのstage自体は開き直さない。C02への追記は、contract-designのレビューではなく、U2 functional-designのレビューで確かめる。

### 案B：contract-designへ戻るjump

`aidlc engine orchestrate next --stage contract-design` が示すjumpで、contract-designを開き直す。

- 利点：AI-DLCの順序どおりに、契約のstageでレビューを受ける。
- 欠点：全Unit（U1〜U4）のdelivery-planning以降が戻る。U1〜U3の承認済みのcheckpointとU4の途中の作業を、すべてやり直すことになる。成果物は残るが、各stageのレビューと承認をやり直す。今回の変更（1つのmethodの追記）に対して重すぎる。

### 案C：U2のcode-generationだけを開き直し、R-09・R-10だけを直す

R-08は持ち越しとし、U4の後の最終ラウンドで扱う。

- 利点：今すぐ最小の作業で済む。
- 欠点：R-08を後で直すとき、U2をもう一度開き直すことになる。

## 4. 推奨と承認事項

案Aを推奨する。次の3点の承認を求める。

1. 案Aの手順1のとおり、U2のfunctional-designとcode-generationを開き直す。
2. `contract-summary.md` のC02に `resolvePath` を追記する（既存の規則は変えない）。この追記を、U2のfunctional-designの変更として扱う。
3. R-09・R-10の修正を、開き直したU2 code-generationの追加Stepで行う。その計画は、書いた後に改めて承認を受ける。

## 5. 変えないこと

- AI-DLC本体、品質基準（180秒期限、非download中央値3000ms、coverage 80%、容量上限、worker 1・retry 0）。
- `resolvePath` の振る舞いとほかのmethodの振る舞い。SessionPortをpackageから公開しないこと。
- U1・U3・U4の完成した作業と承認（U3の模擬portは予定どおりU3のやり直しで扱う）。
- v10は変更前のsourceの履歴であり、変更後のsourceの成功証拠としない。最終的なsourceでのU1〜U4のまとめた確認は、U4の後に行う。
