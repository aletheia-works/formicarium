# 0004. blink の wasm ビルドはコンテナで行う

- 状態：採用（2026-10-04）
- 決めた人：コード生成（実装中の判断）

## Context（背景）

計画では、ローカルの emsdk（`~/AppData/Local/emsdk`）でビルドする予定だった。しかし Windows では
`emconfigure ./configure` が `WinError 193` で止まり、GNU make もない。blink の configure と Makefile は、POSIX の sh と GNU make を前提にしている。

## Decision（決定）

既定では、ローカルの emsdk と同じ版のコンテナ（`emscripten/emsdk:6.0.10`）でビルドする。ゲスト（probe、aube）も
コンテナ（`rust:alpine`）でビルドする。コンテナは wslc を優先し、動かなければ Docker を使う。
sh と GNU make がある環境では、`FORMICARIUM_BUILD=host` でローカルの emsdk も使える（Windows では未検証）。

## Consequences（結果）

- Windows でも 1 コマンドでビルドできる。
- Docker Desktop（または wslc）が前提になる。このマシンでは wslc が動かず、Docker で代用している（U-3）。

## Alternatives Rejected（退けた案）

- **Windows のローカルの emsdk でビルドする**：configure と make が動かない。
- **MSYS2 などで GNU の環境を整える**：開発者ごとの環境の差が大きくなる。

## 参照

`scripts/build-blink-wasm.sh`、`scripts/lib/container.sh`
