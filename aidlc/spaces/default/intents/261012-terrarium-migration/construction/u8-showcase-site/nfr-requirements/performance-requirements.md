# U8 showcase-site の性能要件

## Sources

`nfr-requirements-questions.md`（Q1=A、2026-10-19）、`../functional-design/functional-spec.md`・`rules.md`（BR3.2・BR3.3・BR3.8・BR5.1・BR5.4・BR7.1）、`../../../inception/requirements-analysis/requirements.md`（NFR1・NFR2・NFR6・NFR7）、`../../../inception/contract-design/contract-summary.md`（C11、「Transcript の表示と原本」）、`aidlc/spaces/default/codekb/formicarium/technology-stack.md`（wasm の上限 1 GB、COI の前提）、U6 の受入の数え方（1件 180秒、goto から判定まで 120秒。U6 の nfr-requirements の NFR6.1 と同じ）。設計の要件で、U8 の動作・性能は未計測。

## Requirements

| ID | 分類 | 合格条件 | 検証 |
|---|---|---|---|
| NFR6.1 | 時間 | site の受入（BR7.1）の各1件を 180秒以内に終える。page を開いてから準備完了（個別ページは自動の install の完了、空の端末は準備完了の表示）まで 120秒以内。空の端末の試験は tool ごとに1件に分け、1件で install するのは1ツール（Q1=A）。retry 0、1 worker。上限を上げて通さない。件の割当て（ブラウザごと16件）：空の端末で install と `--version`（3ツール × en・ja の6件、BR7.1 の (1)）、個別ページ（3ツール × en・ja の6件、(2) と (4) の分離・再訪問を含む）、状態の表示と keyboard（en・ja の2件、(3)）、端末の page の後の文書の page（1件、(5)）、敵対的な出力の harness（1件、(6)）。受入の job はブラウザごとに分け、各 job の timeout は 60 分（16件 × 180秒 = 48 分の上限に余裕を持たせ、U7 の受入の job と同じ値）。超えたら失敗（review-01 R-14）。 | Playwright を retry 0 で実行し、件ごとの総時間・page を開いてから準備完了まで・install の時間を記録する |
| NFR6.2 | 取得 | guest の取得は公開 API の上限（C11 の fetchDeadlineMs 120秒、C04 の installDeadlineMs 180秒）に従う。page の code が行う catalog・fixture の index の取得の上限は `security-requirements.md` の NFR4.1。取得した bytes と時間を記録する。 | 受入の記録と NFR4.1 の単体試験 |
| NFR6.3 | 資源 | 1つの page で動かす端末は1つ。wasm の上限 1 GB（既存）を緩めない。表示の buffer は 1048576 bytes か 10000 行の早い方（BR3.8）。 | 単体試験の境界値（1048575・1048576・1048577 bytes、9999・10000・10001 行、multi-byte の文字の境界）と受入の観測 |
| NFR6.4 | 大きさ | site 全体を 1073741824 bytes 未満にする（BR5.4。GitHub の Pages の制限の文書の値、vivarium の check-site と同じ）。guest は site に1か所だけ置き、en と ja の page は同じ guest を参照する。site の大きさ・guest ごとの大きさを site build で記録する。Pages の1 file の上限と転送量の確認は Infrastructure Design で公式情報と実際の deploy で行う。 | site build の記録、Infrastructure Design の確認 |
| NFR6.5 | 文書の page | 文書の page と /tools/ は guest・formicarium を取得しない（BR4.3）。端末の page を訪れた後もそれが成り立つ。 | 受入（BR7.1 の (5)）で取得の一覧を記録する |

## Test environment

受入は、Pages の artifact を展開した site を、header を付けない静的 server（base `/formicarium`、job 専用の CA の HTTPS）で配って行う（BR7.1）。Pages からの実際の取得時間は deploy の後の記録で、受入の合否には使わない。実機 Safari は別の証拠が無ければ未検証。

## Applicability

NFR1（install の非DL工程の中央値 3000ms）の受入は U1・U3・U9 の範囲で、U8 は数値目標を持たない。ただし U8 の受入は install の時間を NFR6.1 で記録する。訪問者向けの新しい性能の目標は置かない。scalability・reliability・observability の文書は ui の Unit では作らない（stage の produces_kinds）。日次 build と配布の失敗の検知は `security-requirements.md` の NFR8.9 と NFR8.10 に置く。

## Assumptions & Open Questions

None.
