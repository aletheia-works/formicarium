# Modernization CI Inputs

検証専用の固定入力。source `7fc23afedef9a2296cb24026c0f19998a6933da7`、repository `aletheia-works/formicarium` に対応する。

- archive SHA256: `78bc6e0a9624124a79bc7ce9fbe85c5ebd2721759f1578cca8d1efcef63007fe`
- archive bytes: 104592600
- payload: 1373 files / 229169203 bytes
- source pins: 222 files
- private test tarball SHA256: `742e1c368bd913d786c6baa3c5d1e1e82cbc252e38e0cc78429f9f1098bc30ca`
- owner baseline: `60dd0dc448f3a67d226dc8a3c6b3afcf4709823d`

現在のformicarium候補を新規packし、site/consumerに同じ24ファイルを配置した。guest/owner入力は変更せず保存し、以前のCI結果を現在の実行結果へ読み替えない。全1374 archive membersのkind/path/byte/digestを照合済み。既知のprivate key・GitHub/npm token形式は検出0（全秘密検出の保証ではない）。旧RC・公開入力branch・公開変数へ書き込まない。

実CI、全realm coverage80%以上、native/browser回帰は実行前で未検証。npm公開・GitHub Releaseの承認を含まない。
