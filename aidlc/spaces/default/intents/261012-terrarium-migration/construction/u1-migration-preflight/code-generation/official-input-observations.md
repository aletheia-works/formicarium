# 公式入力の照合

2026-10-12、main sessionのNode fetchでGitHub RESTの公開情報を読取り。以下はHTTP200で観測済み。実byte取得・ELF検査・CORS・性能は未検証。実guestに既存ローカルbuildを代用しない。

| Tool | Release | Commit | Asset / byte size | GitHubのasset digest |
|---|---|---|---|---|
| aube | v2.7.0 | d36fec01764689ef6d99a5e43de98925b571d67f | asset619364159 / 22235806 | fc2384d58c560415f6afdfdc7c0f2d10b10f464da608bf1d8be5c8936db68666 |
| Biome | @biomejs/biome@2.5.15 | 0b4c11f553a7e702f9851af139662e1de45dc131 | asset601227631 / 66123120 | 42b6fd3662fc1fc3075a370414478aa3ed82fd43d28430bbfb81ebd02cbde656 |

aubeは `/repos/aubepkg/aube/releases/latest`、`git/ref/tags/v2.7.0`、annotated tag `git/tags/786fed036d5ae1ec434a7b597a49dc171fb5b802` を順に照合。Biomeは `/repos/biomejs/biome/releases/latest` とtag refを照合。release.target_commitish=mainはcommit証拠として使わず、tagのobjectから完全commitを取る。

- aube: https://github.com/aubepkg/aube/releases/download/v2.7.0/aube-v2.7.0-x86_64-unknown-linux-musl.tar.gz
- Biome: https://github.com/biomejs/biome/releases/download/%40biomejs/biome%402.5.15/biome-linux-x64-musl

FR9固定source `biomejs/biome@2405c7620169bd0719166af09a8d89cc76fb37fb` は `/repos/biomejs/biome/commits/<sha>` がHTTP200で同SHAを返した。上の公式releaseとCI固定baselineは別入力。

## CI案に使うAction

各repoの `/releases/latest` と `/git/ref/tags/<tag>` を読み、object.type=commitと完全SHAを確認済み。workflow実行は未実施。

| Action | Version | SHA |
|---|---|---|
| actions/checkout | v7.0.1 | 3d3c42e5aac5ba805825da76410c181273ba90b1 |
| actions/cache | v6.1.0 | 55cc8345863c7cc4c66a329aec7e433d2d1c52a9 |
| actions/upload-artifact | v7.0.2 | cf430e030ddbb5b0abf93d22962f4752f3646cd9 |

公開APIのdigest表示を取得byteのSHA検査で裏付ける必要がある。archive内ELFのdigestはarchive全体digestと区別して実測する。費用・runner容量・実CI再利用は未検証。

## aubeの既存取得byteの再照合（検証済み）

mainで既存 `.artifacts/u2-release-inputs/aube-v2.7.0-x86_64-unknown-linux-musl.tar.gz` を読み、新assets.jsのsha256が上記GitHub公開digestと一致することを確認。gunzip後 `extractTar(bytes, 'aube')` の全entry検査は成功した。選択ELFは36948544 bytes、SHA256 `c7d7d13692d01c5f6adc5511c40adc6b3769080b7c433b44c411a3e52ebcd99e`。既存unpacked `.artifacts/u2-release-inputs/aube-v2.7.0/aube` と一致する。browser経由の新規取得・工程性能の証拠ではなく、試行入力のpinを裏付ける観測である。
