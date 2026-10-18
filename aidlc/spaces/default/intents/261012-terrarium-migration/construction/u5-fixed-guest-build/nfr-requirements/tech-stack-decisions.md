# 固定guest buildの技術選択

## Sources

`aidlc/spaces/default/codekb/formicarium/technology-stack.md` の版の宣言は、2026-10-17の人間の方針（自分たちの開発の tool は最新版。検証対象の build は upstream の設定に従う）で古くなった。U1のbaselineの試行（`integration/vivarium/preflight/`、CI run 38990951678）と、人間の回答 Q1–Q6 を根拠にする。以下はドキュメント根拠であり、U5の動作は未検証。

## Decisions

- 実行場所：vivariumのGitHub Actions。buildのjobは `contents: read`、Releaseへの書込みは承認後の別のjob（Q1=A）。U1のbaselineのworkflowを、正式な経路へ引き継ぐ（二重に残さない）。
- toolchain：Rustとtargetは、各upstreamのbuild設定（`rust-toolchain` など）に従う。builder自身が使うtool（Node、Bun、containerの基盤image、make など）は最新版にし、版とdigestをbuilder hashに含める（Q3=A）。U1で使ったRust 1.98.1 imageとAlpine make 4.4.1は、U1のbaselineの履歴として扱う。正式な経路で使う版は、Code Generationの開始時点で最新版を確かめて決める。
- 成果物の保存：vivariumのGitHub Releaseに、keyごとにELF・build-info・catalogを一組で保存し、正本とする（Q4=A）。
- Rustのcompileの中間cache：mr-boxington（`mbx`、jdxによるRustのbuild cache。mise経由で導入し、cargoを包む）を候補とする（Q4への人間の追記）。公式の文書（https://mr-boxington.jdx.dev/ のFAQ・limits）によると、最終のlinkはcacheしない、Rustの版を変えるとcacheの大半が無効になる、sccacheとは併用できない（どちらも `RUSTC_WRAPPER` を使う）。採用する場合は、mbxの版をbuilder hashに含める。CIで使う場合は、cacheの保存場所（GitHub Actionsのcacheなど）とkeyが必要になる。採否はNFR Designで決める（未検証）。
- sourcePatches：repoの中のfileとして固定し、file名とSHA256をbuild-infoに記録する。patchの変更は別のkeyにする（Q5=A）。
- builderのscript：vivariumの既存の構成（BunとTypeScript）に合わせる。TypeScriptがそのまま使えない所（container内で動かすscriptなど）は、mjsを使ってよい（Q6=B、人間の追記）。vivariumの構成は、vivariumのセッションで確かめてから決める。
- 開発の進め方：formicariumの側で、変更の案を `integration/vivarium/` に用意し、vivariumのセッションで反映してもらう。結果はformicariumの側で照合する（U1と同じ形）。

## Alternatives and Risks

- buildとReleaseへの書込みを同じjobで行う案（Q1=B）は、buildの途中で書込み権限を使えるため採らない。
- 任意のrepositoryを受け付ける案（Q2=B）は、改変されたsourceを防げないため採らない。commitの署名を必須にする案（Q2=C）は、upstreamのcommitの多くが署名されていないため、今は採らない。
- すべての版を最新にそろえる案（Q3=B）は、upstreamが前提にするRustの版と合わず、buildが壊れる可能性があるため採らない。
- GitHub Actionsのcacheだけに保存する案（Q4=B）は、期限切れで消えるため正本にしない。
- リスク：mbxを使うと、builder hashにmbxの版が入り、cacheの状態によってbuildの時間が変わる。ELFの正しさはdigestの検証で守るので、cacheの有無で結果が変わらないことを試験で確かめる。

## Compatibility and Rollback

U1のbaselineの試行（workflow・controller・build script）は、正式な経路へ移したあとに整理する。整理するまでは、U1の証拠を壊さない。vivariumへの変更はPR単位にし、切り戻せるようにする。Releaseの既存の成果物は削除しない（C12）。

## Assumptions & Open Questions

- vivariumの既存のtoolingの構成は、まだ確かめていない。
- mbxの採否とCIのcacheの方法は、NFR Designで決める。
