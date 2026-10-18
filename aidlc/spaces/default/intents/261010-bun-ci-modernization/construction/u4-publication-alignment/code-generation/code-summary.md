# U4 Code Summary

将来の厳密な RC / stable 版を、既存の署名済み入力・人の版別承認・独立 candidate CI 証拠に結び付けて公開する境界を実装しました。固定した過去の RC tag、入力 branch、registry dist-tag、外部設定は変更していません。

## Implementation

- `version.ts` は leading zero、range、metadata、任意 prerelease を拒否し、RC→next、stable→latest、tag と source を照合します。stable は同じ基底版の RC 受け入れと差分検査を保持します。
- C2 adapter は GitHub run/attempt/workflow/check producer と artifact SHA256 を独立取得し、U1 の実 acceptance/report 形式、9 必須検査、署名済み coverage report bytes の完全一致を要求します。ordinary CI の自己申告を公開候補の証拠へ転用しません。
- Node builtin bootstrap は正確な tag SHA checkout の trusted policy/manifest から transfer runner を検査し、API digest と run/attempt を照合してから起動します。passive input、固定 npm archive の容量・展開容量・member・type/path・integrity を実行前に検査します。
- 開発用 Bun 1.4.2→Biome 2.5.15 の固定生成を temp 全 bytes 比較で再現します。公開 writer は install/build せず、Node 24.21.0 で検証済み npm 11.19.0 の固定 CLI path を実行します。unknown write result は再送しません。
- publish.yml の readonly verify→OIDC publish→contents-write Release 依存、30分、tag concurrency cancel=false を検査します。README に用途・証拠・拒否・部分成功の手動復旧を記しました。

## Observed Verification — Step1–13 の旧観測

実行者は全て main session。詳細なコマンド、失敗と修正の経緯は [local-observations.md](verification/local-observations.md) を参照してください。

| 対象 | 検証済み結果 |
|---|---|
| U4 6 suites | 39 top-level / 50 total、50 pass、0 fail、0 skip、11,124.5185 ms |
| 既存 release 6 suites | 61 pass、0 fail、0 skip、11,291.241 ms |
| 承認済み 5 tasks | install-frozen / check / typecheck / build / test-light 全 exit 0 |
| test-light | 既存179 total=177 pass/既存2 skip、新 tooling206 pass/0 skip |
| bundle | 固定生成・独立 temp 再現検査成功、Node builtin imports のみ |
| workflow | actionlint と explicit shellcheck exit 0 |
| 固定 npm 実資産 | SHA512一致、safe archive、実 Node CLI --version=11.19.0 |

正常 fixture は実 tracked policy の形を使い、fake HTTP の独立 producer IDs を局所設定したものです。公開 executor は fake で捕捉し、実外部 write はありません。Step7 の正常転送試験が実 runner bytes を必要とするため、承認範囲内で Step8 の初回生成を Step7 前に main が行い、Step9 で正式な再現試験を完了しました。

## Individual JSON Bound 修正 — Step14–18

入力JSONごとの8MiB上限を追加した。TARはmemberの宣言非圧縮サイズをcopy前に検査し、ZIPは宣言サイズの検査に加えてinflate自体の最大出力を制限する。総archive展開512MiBで個別上限を代替しない。bootstrapはこの入力検査を転送runner起動前に行う。

直接CLIはO_NOFOLLOWで開いたregular fileを64KiBずつ読み、上限+1byteで中止・closeする。stat sizeだけを信頼せず、読込中に増えた入力も拒否する。request/publication/envelopeだけでなくreport/inventory/publisher/index/diffとtrusted policy/manifestも、JSON parse前のbounded readerへ接続した。拡張子によらないJSON消費callsiteは明示cap、一般artifactの`.json`は既定cap、非JSON binary/sourceの既存動作は保持する。署名・API・candidateの照合は省略しない。

mainは旧挙動の3file commandで36total/24pass/12failを観測し、9個の超過受理subcaseを再現した。初回bootstrapの再検査は古いtracked bundleを使ったため修正のGreen根拠にせず、固定生成後の38/38成功で確認した。追加report/inventory/publisher/index試験では46total/42pass/4failとなり、inventory/publisher/indexの超過受理を再現した。reportは既存remote artifact側で拒否されていたので、このRedをlocal readerの成功証拠にはしない。全JSON読込境界への接続後、同3files46/46pass・0fail/0skip（24073.245417ms）をmainが確認した。

境界の正常例は実8MiB、超過は+1byte、正しい更新digestと既存署名/API照合を保持する。虚偽ZIP宣言サイズ、虚偽Content-Length、network source増加に加え、狭いread portで決定的にfilesystem readerへ8MiB+1を供給し、最大読込budgetとcloseを検査した。超過bootstrap runner0回、超過CLI executor0回、正常allow最大1回を維持する。

現修正attemptのU4全6fileは39top/76total、76pass・0fail・0skip（25468.767167ms）。承認済み5tasks全exit0：frozen58installs/84packages変更なし、既存light179total=177pass/既存2skip・0fail（3974.638334ms）、tooling234pass/0fail/0skip（29507.654875ms）。既存release6filesは61pass/0fail/0skip（13039.271333ms）、actionlint1.7.12＋explicit shellcheck0.11.0のpublish.yml検査exit0。固定Bun→Biome生成とtemp全bytes比較はmain成功確認済み。生成hash/sizeはgenerated-artifacts.jsonにtracked4資産とignored JS/mapsを分離して記録した。詳細の全commandとRed→Greenはmain所有 local-observations.md に記録されている。独立review/checkpointはmainの次の手順であり、完了済みとはしていない。

## Limits and Handoff（現修正attemptも維持）

実 GitHub CI・OIDC・npm 公開・GitHub Release、実公開候補の runtime 回帰 / 全 realm coverage は未検証です。既存固定分母・全 realm / 80%・600/840秒・1worker・retry0・wasm1GB を弱めていません。trusted policy の null IDs と writerEnabled=false は fail-closed の未設定状態です。U3 の旧 Major 2 は別 unit の修正・review READY・checkpoint ae1219d2…approved で解消済みです（main の通知根拠）。外部権限・実 CI の成功とは区別します。

source-manifest.json は実 source/config/workflow/README と tracked bundles を path-only で所有宣言します。生成物の hash/size は generated-artifacts.json に分離しています。独立レビューと正式 checkpoint は main が行います。

main の固定 Biome 整形で既存 tests/release/publication.test.ts に整形差分が生じたため、所有 manifest に含めています。main の 12a92eab との read-only diff では collect.ts / collect.test.ts / decision.test.ts / evidence.test.ts に差分はありません。品質基準と試験の意味は保持しました。
