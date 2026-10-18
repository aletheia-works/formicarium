# Integration Test Instructions

## Sources and Scope

現在の各Unitの検証手順を優先し、historical節の旧候補作成・計測コマンドは再実行しない。buildは共通3段階を一回実行する。mainのみ、1worker、retry0、probe600秒/aube840秒/pitchfork600秒・Node120秒/wasm1GBを維持する。

## Current Unit Checks

U1はrunner-readyと保存証拠のread-only照合。U2はmanifest/fixtures/resolver/stage/integrationの5Node files、self-test、consumer型検査と三browser15件。U2_ACTUAL_SITEは `.artifacts/u2-guest-distribution/site-repair-v1` の絶対pathで統一する。

U3はadapter/assets/coverage/acceptance/current-candidateの5Node files、read-only照合、現v9-v2のbridge三browser6件。TERRARIUM_ROOTは `.artifacts/u3-current-v9-v2/terrarium`、TERRARIUM_SITEは `.artifacts/u3-current-v9-v2/site`、U3_PITCHFORK_REF=v2.30.1。新browser出力は `.artifacts/build-and-test-20261010-v1/u3-browser` とし旧出力を保持する。

U4はrelease/evidence、decision、collectの3Node filesを一回実行する。2filesだけのコマンドはこの3filesに包含されるため重複実行しない。模擬RC/承認を実公開・実承認に置き換えない。

全Unitで同じコマンドは一回だけとし、含まれる同じtestを件数に二重加算しない。各Unitの現source/candidateへのbinding、保存coverage、Safariの採用は新しい再実行と明確に区別する。

## Coverage and Fixtures

固定24ファイル、80%以上、未import0/未収集realm失敗/skip0を維持。U1 v14、U2 repair-v3、U3 current-v9-v2の保存reportと現source/source-map/candidate/receiptを照合する。保存測定に差分がある場合は成功採用しない。root外path・symlink・改変fixtureは専用一時directoryのみで扱い、外部ownerの証拠を変更しない。

## Cross-Unit Gate

requirementsの全FR/NFRとstoriesの全ACを列挙し、全Unitのtraceability.jsonにOKと実在targetがあるかをcross-unit-traceability.mdへ記録する。Deferredの外部公開条件はローカル成功でOKにしない。


## 再開後の検証 — 2026-10-10 v2

正確なmain逐次実行手順はverification/resume-20261010-v2/run.mjsとresults.json。Node実体はmise ls/where nodeで解決した24.21.0。製品/test tsc→emit→runner→Unit証拠照合→U2/U3/U4/CIの限定Node回帰。browserは既存configとv9候補、1worker/retry0、出力.artifacts/build-and-test-resume-20261010-v2/{u2-browser,u3-browser}。旧成功と新実行を合算しない。最新collectorを含む遠隔CIはUnverifiedでありU4へ修復を戻す。閾値・固定分母・既存期限は不変。

## Current Verification — Publication Boundary and Public Candidate

検証済みの境界コマンドはU4のCurrent Verification — Loop-back4と同じ7ファイル74件。正式tsc/test tsc/emit後にmainで成功済み。承認済みsource12a92eab/input07be6a46のrun38040455333でも同じ境界コマンドを実行し、ログci-publication-boundary.txtを成果物へ保存する。既存runnerのrelease35件と重なるため、両suite件数を単純加算してunique総数を主張しない。

新public candidate8334d7f1については `verification/public-candidate-coverage-v1/run.mjs` をmainの直接Node実体で実行する。未使用のprivate tmp領域にinstrumented copyを作り、Node、Chromium/Firefox/WebKit、terrarium Node/browserを逐次測定し、固定24files/80%/46receipt/全realm/sealを既存validateCoverageで検査する。旧rawを新generationへ転用しない。threshold、timeouts、worker1/retries0、pack/core/guestの元bytesを維持する。実CIの完了後に実行し、計測を重ねない。実行前は未検証。実npm/Release/設定変更を行わない。
