# 固定Biome baseline入力の確認

2026-10-12、main Node24 fetchで固定commit `2405c7620169bd0719166af09a8d89cc76fb37fb` のGitHub raw応答を読み、SHA256を計算（各HTTP200）。これはビルド成功の証拠ではない。

| 入力 | bytes | SHA256 |
|---|---:|---|
| rust-toolchain.toml | 234 | bd7b06458e86e1606ce6f793b95b4ede16832ad87ce9e7262e42d66b6a54a257 |
| Cargo.lock | 177991 | 09a29db28021791e2b6f56ca4ef4b84e662d751d65ead621f6df6c6ea8b0d3c9 |
| .cargo/config.toml | 1933 | 55e1096e26df831c9aca829c83fe9383d913a402dccc0b8a3c4920ff44769ab7 |
| Cargo.toml | 17172 | cb98a39bf77ec6183540bc198338bcc3bcc539ec3d5fba10c165426702e51667 |

rust-toolchain.tomlのchannelは1.98.1、profile default、targets wasm32-unknown-unknown。native musl試行のtoolchain選択は具体CI案で明示する。

固定codeload URL `https://codeload.github.com/biomejs/biome/tar.gz/2405c7620169bd0719166af09a8d89cc76fb37fb`：HTTP200、16101277 bytes、SHA256 `381892c937d19ed53759ecd0f60f5418a211085bbf8dd2a93f10b5436a83a15c`。gzip展開186449920 bytes、root `biome-2405c7620169bd0719166af09a8d89cc76fb37fb/`。header走査でregular31941、symlink21、directory3374、global PAX1、per-entry PAX5を観測。先頭global PAXは固定commitのcomment。これは形式の観測で、全entry安全性の受入成功は未検証。guest ELF専用parserの制限を緩めず、source専用の安全検査が必要。

上記archiveは承認済みNFR4.1の4096entryを超えるため今回の取得経路に採用しない。CI案は固定SHAのactions/checkoutで固定FR9commitを専用source-dirへ取得し、controllerはread-only Git inspectionで実HEADとclean状態、固定4入力digestを検査する。Git必須のcheckout Action利用とread-only inspectionはAGENTSの例外範囲で、追加git cloneやGitによるlocal変更操作は行わない。guest取得制限は維持する。

Docker Registry v2のlibrary/rust:1.98.1-alpine index、linux/amd64 manifest、configの各取得HTTP200（匿名pull tokenは記録しない）。

- index digest: sha256:7cc1c22d77d9432f7fe012a70e6d3e555af54c2a6832700ed7d553f1769ae89f
- linux/amd64 manifest: sha256:6d9066cf04ed2cc9d1a406016f4c9b2574bafda23f9e88bcad8e5d24fa6aec8e
- config: sha256:68bd64fbb5e3f8b9fd5d0982a21f8aa53de6cb74957318d31766601c3c40be91
- base image annotation: alpine:3.24 / sha256:d56c381f961d307a21b3ca004cf1e3910f106644aefb1f43e654c8a56c4fd395
- source annotation: rust-lang/docker-rust commit4dc5209f5e720a3d6b5eb336cabb69a424a822c1、stable/alpine3.24。

config ENVにRUST_VERSION=1.98.1、historyにca-certificates/musl-dev/gccとnative musl minimal toolchainの導入がある（文書根拠）。コンテナ内rustc実行とこのcommitのcompile・ELF・同key再利用は未検証。tagの変化を許容する入力として扱わず、CI案では上記platform manifest digestを固定する。
