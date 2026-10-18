# Security Test Instructions

## Sources and Targets

security-requirements.md NFR4.1–4.4/5.1/7.2とsecurity-design.md SD1–SD5、U4 R-01修正を根拠とする。

## Checks

Unitの入力/path/symlink/ELF/protocol/copy/snapshot試験、検証済みloader bytesと評価対象の結合、cleanup、release原artifact bytes/SHA結合を確認する。正常・欠落・改変・同size改変・root外・symlink・version不一致の負例を保持する。秘密入りstdoutを公開証拠へ無条件転記しない。

## External Release Conditions

遠隔CI、Trusted Publisher実設定、公開RCの実consumer受入れ、実配信/Pages/service-workerは未検証。実権限や外部承認をfixtureで代替しない。公開先作成・push・publishは実施しない。これらを必要とするtargetはローカル試験だけでMetにしない。


## 再開後の検証 — 2026-10-10 v2

正確なmain逐次実行手順はverification/resume-20261010-v2/run.mjsとresults.json。Node実体はmise ls/where nodeで解決した24.21.0。製品/test tsc→emit→runner→Unit証拠照合→U2/U3/U4/CIの限定Node回帰。browserは既存configとv9候補、1worker/retry0、出力.artifacts/build-and-test-resume-20261010-v2/{u2-browser,u3-browser}。旧成功と新実行を合算しない。最新collectorを含む遠隔CIはUnverifiedでありU4へ修復を戻す。閾値・固定分母・既存期限は不変。
