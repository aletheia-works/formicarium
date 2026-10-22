# U6 recipe-runtime NFR Requirements の質問

## 前提（確認したこと）

- 固定 guest の Biome の ELF は 1つ 114,647,744 bytes（約109MiB。旧題材の Release `guest-biome-15432368…` の保存済みのfile で確認）。新しい題材も同じ規模と見込む（推測）。C11 の ELF 上限 128MiB には収まる。
- U6 の page は baseline と fix の2つの ELF（合計約220MiB）を、site build 時に同じ origin（GitHub Pages）へ置き、訪問者のブラウザが取得する（Functional Design の Q5=A、BR2.2）。GitHub Pages の1 file あたりの上限と転送量の上限が、この大きさで足りるかは未確認。
- 旧 biome-12265 の Playwright 試験は、1回の上限が 180秒、判定を待つ上限が 120秒だった（`04a8724^:src/layer1_wasm/tests/biome-12265.spec.ts`）。vivarium の Layer1 の既定の試験 timeout は 90秒。
- vivarium の toolchain は mise で `node`・`bun` が latest、Playwright `^1.64.1`、TypeScript `^7.0.2`（`mise.toml`、`src/layer1_wasm/package.json`）。

## 質問

### Q1. 約109MiB の ELF 2つを site に置くこと

A. 設計どおり、ELF をそのまま GitHub Pages に置く。GitHub Pages の1 file の上限と転送量を Infrastructure Design で公式情報と実際の deploy で確かめ、足りなければ止めて報告する。
B. site には gzip などで圧縮した ELF を置き、ブラウザで展開してから C03 で照合する（取得量が減る。展開の処理と上限の確認が U6 に増える）。
C. Functional Design の Q5 を見直し、ブラウザが Release から直接取得する形にする（COEP・CORS で動くかの確認が先に要る）。
X. Other (please specify)

[Answer]: A

### Q2. U6 の page の性能の目標

A. 旧 biome-12265 と同じ上限を使う：回帰試験は1ブラウザ1回 180秒以内、2つの端末の ready の後に判定まで 120秒以内。初回と取得の時間を記録する。訪問者向けの新しい数値目標は置かない。
B. 訪問者向けの数値目標も置く（例：page の読込みから判定まで、取得を除いて○秒以内）。値は回答で示す。
X. Other (please specify)

[Answer]: A

## review の後の確認（2026-10-19）

review-01 の R-01 により、NFR6.1 は Q2=A の文面（1ブラウザ1回、ready の後に120秒）ではなく、旧 spec と同じ数え方（ブラウザ×en・ja の組ごとに180秒、page の読込みから判定まで120秒）にした。人間の回答「旧specと同じ数え方でよいです。」

## 回答の分析

- 曖昧な回答・矛盾はない。Q1=A は Functional Design の Q5=A（同じ origin に置く）と一致する。Pages の上限の確認は Infrastructure Design の作業で、足りなければ止めて報告する（ここで代わりの方式を決めない）。
- Q2=A の 180秒・120秒は回帰試験の上限で、品質基準として緩めない。取得の時間（約220MiB）はこの上限に含まれるので、初回と取得の時間を記録し、超えたら原因を報告する（上限を上げて通さない）。
- Functional Design の review-02 の Minor 5件（diary の Open questions）のうち、NFR に関わるもの（pin file が無い間の検査主体、U6 の最終受入が 0.3.0 公開後になること、Worker の置き場と service worker の scope）は、ここで要件にする。