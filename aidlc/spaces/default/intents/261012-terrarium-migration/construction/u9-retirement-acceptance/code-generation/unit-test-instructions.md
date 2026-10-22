# U9 retirement-acceptance の単体試験の手順

U9 は新しい試験を作らない。terrarium だけの code と試験（`scripts/terrarium/`・`tests/terrarium/`・`integration/terrarium/`）は対象と一緒に消す。それを参照する試験だけを直す。

試験の方針（team.md の Testing Posture）：

- 新しい実装は test-after。
- 不具合の修正は、再現の失敗を先に観測してから直す。
- coverage の行 80% と、統合前の CI を守る。基準は下げない。
- 実行は main session で1つずつ行い、重い並行の処理はしない。
- aube は再 build しない。

## Commands

すべて formicarium の repository の root で実行する。

型・build・lint：

```bash
mise run typecheck
```

```bash
mise run build
```

```bash
mise run lint:all
```

本体の軽い試験（node:test と bun test。第一者の配布 JS の coverage を含む）：

```bash
mise run test:light
```

showcase と site（showcase の file を変えたとき）：

```bash
mise run showcase:unit
```

```bash
mise run showcase-site:unit
```

```bash
mise run showcase:boundary
```

言及の残りの確認（`aidlc/` の外で0件になること）：

```bash
jj file list | grep -v '^aidlc/' | xargs rg -il terrarium
```

pack に入る file の確認（変更の前と後）：

```bash
"$(mise which npm)" pack --dry-run --json
```

## Expected coverage

- 第一者の配布 JS の固定の一覧の行 coverage が 80% 以上（既存の基準）。terrarium だけの code を消して分母の file が変わるときは、理由を示して人の承認を受ける。
- showcase の script の行 coverage 80% 以上、site の固定の分母の行 coverage 80% 以上（変えた場合）。

## CI だけで確かめるもの

- probe（600秒・8項目）、aube のブラウザ（840秒）、移行の受入、site の3ブラウザの受入：PR の CI の必須の check で確かめる。手元では実行しない。
