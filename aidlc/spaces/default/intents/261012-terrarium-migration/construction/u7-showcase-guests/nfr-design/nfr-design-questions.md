# U7 u7-showcase-guests NFR Design の質問

根拠：`../nfr-requirements/security-requirements.md`（NFR3.1・NFR3.4・NFR4.1・NFR5.3）、`../nfr-requirements/tech-stack-decisions.md`、`../nfr-requirements/reviews/review-01.md` の指摘、契約 C06・C07・C09・C11。U7 は packaging の Unit なので、この stage で作るのは security-design と traceability である。

source build の Rust と、pitchfork の UI に使う Node・aube の版は、U5 で人間が決めた方針（検証対象の build は upstream の build 設定に従い、宣言がなければ最新の安定版）で決め、ここでは聞かない。資産 URL・最終 URL・attestation の記録先は、manifest の付加 field（契約で許された未知 field）として設計で決める。

## Q1. [開発] 配布する候補が使う本体の pack の取り方

NFR5.3 は、配布する候補の pack の SHA256 が B1 受入（C06）の `packSha256` と一致することを必須にしている。U7 の CI が毎回 pack を作り直すと、byte が同じになる保証がなく、main が B1 受入の commit より進むと一致しなくなる。

A. 配布する候補（U8 の日次 build）は、B1 受入で固定した pack そのものを取得して使う（保存先は B1 受入の証拠の置き場所に合わせる）。SHA256 を `packSha256` と照合し、一致しなければ配布しない。PR と main の検証では、同じ commit で作った pack を使い、配布しない候補として記録する。
B. 毎回同じ commit から pack を作り直し、byte が再現することを要件にする。main が B1 受入の commit より進んだ日は、配布しないことを正常な結果として記録する。
C. 0.3.0 を npm に公開するまでは、配布する候補を作らない（PR と main の検証だけを行う）。
X. Other (please specify)

[Answer]: A

## Q2. [セキュリティ] PR で変えられる設定と source build

ツールの条件（repository の許可一覧を含む）は設定 data（`showcase/tools.json` 仮）にあり、PR で変えられる。fork の PR が設定を書き換えて、別の repository の source build を CI で動かせてしまう（secret と書込み権限は使えないので、影響は CI の資源に限られる）。

A. 許可する repository の一覧は、設定とは別の file に固定し、CODEOWNERS でレビュー必須にする。PR の CI は、main の一覧にない repository を拒否する。
B. A に加えて、fork の PR では source build を動かさず、公式資産のツールだけを検証する（source build の行は未検証として記録し、候補は作らない）。
C. 一覧は設定のままにし、CODEOWNERS でレビュー必須にするだけにする。
X. Other (please specify)

[Answer]: A

## Q3. [CI/運用] PR での source build の時間と回数

source build（現行では pitchfork）は、契約上 4 時間まで許される。現行 terrarium の job の timeout は 180 分で、PR の更新では古い実行を取り消している。

A. job の timeout は 180 分にし、同じ PR の古い実行は取り消す。source build は、設定・builder・解決した commit が変わったときだけ動かし、変わっていなければ main の直近の受入 run の Actions artifact（保存期限内のもの）から ELF を取得し、digest と build-info を検証して再利用する。期限切れなどで取得できなければ source build を動かす。
B. A と同じ timeout と取消にし、source build は毎回動かす（再利用しない）。
C. PR では source build を動かさず、main と U8 の日次 build だけで動かす。
X. Other (please specify)

[Answer]: A

## Q4. [セキュリティ] 再利用のための読取り権限（追加の質問）

NFR要件の Q1 では、showcase の CI の権限を `contents: read` だけと決めた。Q3=A の「main の直近の受入 run の Actions artifact から ELF を再利用する」には、他の run の artifact を読む `actions: read` が必要になる。どうするか。

A. `actions: read` を加える。再利用元は、`main` branch の `push` か `schedule`／U8 からの呼出しで動いた、同じ workflow file の成功した run だけに限り、PR や fork の run は使わない。ELF と build-info は、その run の manifest の値だけでなく、`resolutions.json` から計算し直した buildKey とも照合する。
B. `contents: read` だけのままにし、run をまたぐ再利用はしない。同じ PR の中で古い実行を取り消し、source build は設定・builder・commit が変わったときだけ PR で動かし、変わっていなければ PR では source build の行を「main で検証済み」として記録しない（未検証のまま、候補は作らない）。
C. `contents: read` だけのままにし、source build は毎回動かす（Q3=B と同じ）。
X. Other (please specify)

[Answer]: A
