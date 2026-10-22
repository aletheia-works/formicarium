# pitchfork を formicarium で動かす PoC（2026-10-05〜2026-10-06）

最初の PoC（[261003-blink-wasm-poc](261003-blink-wasm-poc.md)）に続く 2 つ目の PoC の要約。probe と aube 以外の実在の Rust 製 CLI で formicarium が動くかを確かめた。

## 目的と範囲

- 目的は 2 つ。
  - terrarium のツールごとの wasm ビルドを、formicarium に置き換えられるかの判断材料を得る。
  - 前の PoC の formicarium が、実際の Rust 製 CLI でも動くかを確かめる。
- 対象：jdx/pitchfork v2.29.0 を x86-64 static-musl でビルドし、Node.js と 3 ブラウザ（Chromium・Firefox・WebKit）で動かす。
- 手順は terrarium の `fixtures/sessions/pitchfork-basic.txt` と同じ、スーパーバイザーを要しない 8 コマンド：`--version`、`daemons`、`daemons add`、`daemons remove`、`cat pitchfork.toml`、`status`、`settings set`、`settings get`。
- 範囲外：デーモンの起動と監視、スーパーバイザー、IPC、stderr の比較。terrarium への組み込みそのものも別作業とし、今回は調査メモだけを残す。

## 主な決定

- **合格の基準を「バイト単位の完全一致」から緩めた。** 最初は完全一致を求めた。しかし terrarium の手順ファイルにはコマンドだけで期待出力がなかった。そこで、同じ fixture と手順を native の Linux x86-64 で実行した結果を正解とした。比べ方は aube と同じで、改行と行末の空白をそろえてから stdout と終了コードを比べる。
- **`cat` は JS 側の手順にした。** `rm -rf` と同じく blink を通さず、ファイルの中身を出す。ゲストに cat を持ち込まずに済む。
- **手順の引数は `sh -c` と同じ規則で分ける。** native と同じ argv になることを単体テストで確かめる。
- **ゲストと手順の一覧を 1 か所の表にまとめた。** 当時の formicarium は aube 1 つを前提にしていたため。aube の既存テストが合格のままであることも、合格条件に入れた。
- **fixture は terrarium から写し、出どころは記録しない。**
- **不一致は blink の fork か formicarium 側を直して一致させる。** pitchfork のソースは変えない。直せなければ、1 件でも不合格として記録する。
- **pitchfork に 1 行のパッチを当てた（人間の判断）。** v2.29.0 は musl ではコンパイルできない（`src/supervisor/lifecycle.rs:1219` の `libc::ioctl` の request が `c_ulong`、musl は `c_int`）。型だけを `as _` に直し、`patches/pitchfork-2.29.0-musl-ioctl.patch` に残した。動作は変わらない。公式の release に musl 版はなかった。
- **release ビルドの前に web UI をビルドする（人間の判断）。** pitchfork の `build.rs` は `ui/dist/index.html` がないと止まる。`dist/guests/aube` を使い、コンテナで `aube install --frozen-lockfile && aube run build` を実行する。
- **wslc が `E_FAIL` で動かないときは Docker に切り替えた**（`FORMICARIUM_CONTAINER=docker`）。同じ busybox イメージとネットワークなしの条件で、aube の基準値を作り直しても差分がないことで、条件が同じことを確かめた。
- コア、ネットワーク、メモリの扱いは前の PoC の ADR のまま（[0003](../decisions/0003-core-boundary.md)、[0007](../decisions/0007-no-guest-network-in-browser.md)、[0010](../decisions/0010-wasm-memory-1gb.md)）。

## 仕様・設計の要点

| ID  | 内容                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR1 | pitchfork を `rust:alpine` で `--locked --target x86_64-unknown-linux-musl` でビルドし、`dist/guests/pitchfork` に置く。タグとコミットを記録する                |
| FR2 | `fixtures/sessions/pitchfork-basic.txt` と `fixtures/pitchfork-basic/` を写す                                                                                   |
| FR3 | 手順の `cat <相対パス>` と、`sh -c` と同じ引数の分割。aube-1645 の手順は同じ steps に解釈される                                                                 |
| FR4 | ゲスト・環境変数・手順の表を 1 か所に置き、Node.js、`runtime/web/sessions.mjs`、`native-baseline.sh`、`build-guests.sh` がそれを参照する                        |
| FR5 | native の基準値 `fixtures/baseline/pitchfork-basic.native.txt` を busybox のコンテナ（ネットワークなし）で作る                                                  |
| FR6 | 4 環境で 8 コマンドを順に実行し、手順の間で状態が引き継がれる（`daemons add db` と `daemons remove worker` の後の `cat`、`settings set` の後の `settings get`） |
| FR8 | terrarium への組み込み方の調査メモを 1 本残す                                                                                                                   |

構造の要点：
- 表は `runtime/registry.mjs`。シェルからは `scripts/session-info.mjs` を通して読む。ビルド手順はシェルに残し、表のゲストがすべてビルド対象に入ることをテストで確かめる。
- `splitShellWords` は、sh が分割以外の意味に読む文字を拒否する。引用符の外の `[`・`(`・`)`、語の先頭の `#` と `~`、二重引用符の中のエスケープしていない `$` と `` ` `` が対象。引用符の閉じ忘れも失敗にする。
- `cat` は、引き継いだ通常のファイルだけを読む。symlink、ディレクトリ、存在しないファイル、`persist` の外は Error にする。
- 書き込み先は native で調べた（`scripts/pitchfork-probe-paths.sh`）。`/work/app/pitchfork.toml` と `/root/.local/state/pitchfork/logs/pitchfork/pitchfork.log` で、どちらも `persist`（`['/work', '/root']`）の中にある。範囲の外は毎回作り直す `/tmp/fslock/<hash>` だけ。環境変数は空のままにした。
- `pitchfork status api` はスーパーバイザーがなくても `Name: app/api` と `Status: available` を出し、終了コードは 0 だった。

## 品質の目標と結果

| 目標                                                                   | 結果                                                                                                                                         | 判定 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 8 コマンド × 4 環境が native と一致                                    | 最初から全環境で一致。fork や formicarium の修正は要らなかった                                                                               | 合格 |
| 既存テストが合格のまま（NFR1。変更前は Node.js 41 件、ブラウザ 33 件） | Node.js 50/50（追加 9 件を含む）、ブラウザ 36/36（pitchfork 3 件を含む）                                                                     | Met  |
| 上限を緩めない（NFR2）                                                 | 既存の上限は変えていない。新しい上限は実測の最大の 3 倍を 60 秒単位で切り上げた。Node.js は 32.7 秒から 120 秒、ブラウザは 3.1 分から 600 秒 | Met  |
| 安全（NFR3）                                                           | 取得元の照合、frozen install、パッチの変更行 2、入口の検証、`--network none`、秘密情報 0 件（S1〜S8）                                        | Met  |
| 要件ごとのテスト                                                       | 不一致が起きなかった FR7 を除き、すべてにテストか確認手順がある                                                                              | Met  |
- 繰り返し：Node.js は 3 回とも 3/3。ブラウザは 3 ブラウザ × 3 回で 9/9。
- 基準値は 2 回作って一致を確かめた（`--check-reproducible`）。aube の基準値も差分なし。
- 時間：pitchfork-basic は Chromium 11.1 秒、Firefox 11.4 秒、WebKit 20.0 秒、Node.js 12.1 秒。
- サイズ：コア 455,584＋132,512 バイト、pitchfork 40,223,816 バイト、aube 31,471,776 バイト。
- pitchfork のビルドは 35 分 38 秒。行カバレッジは測っていない（数値目標なし）。

## 成果

- `dist/guests/pitchfork`（v2.29.0、コミット `cfdea79f1d52b8449c0b99b29a03d9e771cd8ec3`。GitHub API の `v2.29.0` と一致）。
- `patches/pitchfork-2.29.0-musl-ioctl.patch`、`runtime/registry.mjs`、`scripts/session-info.mjs`、`scripts/pitchfork-probe-paths.sh`。
- fixture と基準値、`tests/node/session.test.mjs`、`tests/node/pitchfork-basic.test.mjs`、`tests/browser/pitchfork-basic.spec.mjs`、`tests/shared/pitchfork-basic.mjs`。
- 調査メモ `docs/terrarium-integration.md`。今の `docs/` にはない。その後の移管の計画は、git の commit `c8ddd83c` の `docs/terrarium-migration-plan-summary.md` にある。
- 変更ファイルは 27 件。PR 番号は記録にない。

## 残った課題

- terrarium のツールごとの wasm のサイズと実行時間は測っていない。
- 1 行のパッチを上流で直してもらえるかは確認していない。
- 記録の時点でのレビューの軽微な指摘 3 件（受け入れたが未対応）：
  - `runtime/registry.mjs` に「Step 4 で見直す」という古いコメントが残っている。
  - `pitchfork.commit` に上流のコミットしかなく、パッチの記録がない。
  - UI のビルドが node の版を固定していない。
- SAST と依存の脆弱性スキャン（`cargo audit` など）は行っていない。配布しない PoC だったため。

現在の README は pitchfork v2.30.1 をビルドし、UI の node の版と成果物の sha256 を `pitchfork.build-info` に記録すると書いている。v2.29.0 とこの指摘は当時の記録である。

## 元の記録

git のコミット `8096c7b4` の `aidlc/spaces/default/intents/261005-pitchfork-on-blink/` にある。
