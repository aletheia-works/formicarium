# U2 品質・安全性要件

## 根拠と適用範囲
ドキュメント根拠：承認済みrequirements.md、contract-summary.md C02/C03/C06/C11、U2 functional-spec.mdとrules.md。実装と試験は未検証。本単位はローカルのNode/ブラウザライブラリであり、認証サービス・DB・運用SLA・新規法令適合の対象を追加しない。

## 検証可能な要求
| ID | 要求 | 拒否・受入れの観測 |
|---|---|---|
| NFR2.1 | 既存probe 600秒・8項目、aube browser 840秒・native完全一致、1worker/retry0、wasm上限1GB、waitAsync削除を維持 | 同一候補のNode・3ブラウザ回帰。欠落・skipを成功にしない |
| NFR2.2 | 統合前CI、固定第一者配布JSの全realm合算line coverage≥80%。新API配布ファイルを一覧へ追加し未収集を分母から除外しない | source/pack/inventory対応、Worker/別process/realm収集。U2は暫定証拠、U4でB1全チェック |
| NFR3.1 | validateGuestは私有byte copyに対してSHA256、ELF64 little-endian x86_64・static・program header/segment範囲・PT_INTERP不在と期待identityを検証する | 改竄、動的ELF、truncated/overflow、identity違いでINVALID_INPUT、登録・FS・cwd不変 |
| NFR3.2 | handleはpackage instance内の非公開brandを持ち、私有byteとmetadataを保有。入力と公開metadataの後続変更は実行内容を変えない | forged/別instance handle拒否、変更前byteの実行結果、独立sessionへの共有で状態分離 |
| NFR3.3 | fixtureは全entryのguest絶対path・正規化重複・NUL・root escape・symlink escape/loop・mode/inode/hardlink整合を検証後にcopyする | 各不正fixtureと末尾不正entryを拒否、入力変更非伝播、hardlinkの意味維持 |
| NFR3.4 | ELF≤134217728 bytes、fixture合計≤268435456 bytes、entry≤4096、path≤4096 UTF8 bytes、metadata≤1048576 bytes。累積加算と範囲を安全整数で扱う | 上限値と+1、マルチbyte path、overflowを試験 |
| NFR3.5 | metadataのschema・必須identityを検証し、互換な未知fieldもcanonical hashへ含める。canonical文字列は孤立surrogateを拒否 | 未知field改変でhash変化、schema/identity欠落・非安全数拒否。raw JSON取得境界では重複key/escaped aliasをparse前に拒否 |
| NFR4.1 | C02によりrun/install/fsは単一予約、queueなし。reset/disposeはepoch更新・cancel・cleanup待機、古いcommit/releaseは新操作を壊さない | busy、signal cancel、reset中操作、dispose中操作、遅い旧commit/release、reset/dispose重複の決定的競合試験 |
| NFR4.2 | 失敗時に登録・FS・cwdは原子的に保持。取消はABORTED、dispose開始後はDISPOSED、非対応環境はUNSUPPORTED_ENVとする | 失敗直前/commit競合とcleanup完了を観測。raw runの既存結果・エラー契約を維持 |
| NFR6.1 | same-origin Worker、SAB/COI、既存CSP blob/wasm条件とNode/browser境界を保持 | NodeとChromium/Firefox/WebKitの正・拒否試験。実機Safariは未検証と記載 |
| NFR8.1 | U2 API exports/types/inventory/Node・browser consumerを同一source/packへ対応づける | C06の暫定u2-provisional証拠とU4 b1-integratedの完全証拠を区別。省略・失敗・未検証を完全受入れにしない |
| NFR8.2 | 秘密をエラー/ログへ出さず、noticesを保持。公開・新規費用は既存の人間承認境界に従う | public pack inventory/notices、エラーredaction確認、版ごとの公開承認。切戻しはU2変更をjjで戻し再pack/回帰 |

## 脅威・責任境界
不正ELF/metadata/fixture、TOCTOU、偽handle、古い予約、別session状態混入をU2で防ぐ。アーカイブ解凍・HTTP/redirect・stream制限・fetch120000ms/install180000msと非同期CPUの取消確認はU3の取得境界で実装し、U2予約/commitと結合する。同期validateGuestの契約を非同期へ変更しない。raw JSONのduplicate拒否はrawを所有する入口で実施し、objectになって消失した重複を復元できるとは主張しない。

## 可観測性と検証
エラーcode、operation完了/cleanup、source/pack/guest digestをテスト証拠で対応づける。外部監視や集中ログは追加しない。ゲスト内容・取得元秘密・host私有pathを公開証拠へ混入させない。U1の3000ms中央値基準は承認済み事前検証の条件であり、U2同期API単独へ別の未承認SLOを割り当てない。
