# U6 recipe-runtime の論理部品

## Sources

`performance-design.md`（P1–P6）、`security-design.md`（S1–S9）、`../nfr-requirements/security-requirements.md`、`../nfr-requirements/performance-requirements.md`、`../functional-design/functional-spec.md`（W1–W6）、`../../../inception/contract-design/contract-summary.md`（C03・C05・C07・C08・C10・C11）。内部の責任分けの設計で、新しい常時稼働の service は作らない。

## Components

| 内部責任 | 所有と置き場 | 入力→出力 | 失敗域 | 設計 |
|---|---|---|---|---|
| RecipeDeclarationCheck | vivarium、schema と `generate-recipes-index.ts` | recipe.json → active/pending と理由 | PR の CI と site build の index 生成 | S1 |
| FormicariumPin | vivarium、`src/layer1_wasm/formicarium.pin.json` | 人の PR → 版・digest・sourceCommit・一覧 | 0.3.0 の公開前は無い（pending） | S2・S5・S6 |
| AssetStager | vivarium、`docs/scripts/` の新しい bun の script（`pin` と `local` の mode） | pin・accepted（又はローカルの tarball と guest）→ 照合済みの staging の dir と `assets.json` | PR の repro-regression（merge の前に失敗を出す）と deploy-docs の build の job（失敗は deploy 全体を止める）。どちらも token を使わない | S2・S5・P1 |
| CoiPin | vivarium、`docs/scripts/` の共有 module | coi-serviceworker.js の版と SHA256 | CoiPinTest と AssetStager が import する | S4 |
| LayerOneBundler | vivarium、`scripts/bundle-layer1-pages.sh`（小さく直す） | staging の dir・recipe の dir → `docs/doc_build` | build の job | P1・S8 |
| CoiPinTest | vivarium、docs の bun test | tree の coi-serviceworker.js の写し → 合否 | test-docs（すべての PR） | S4 |
| ReproServer | vivarium、`serve-repro.ts`・`repro-dev-middleware.ts` | 同じ置き場の形で file を返す | 回帰試験と受入の時だけ | P1・S8 |
| TerminalPane | vivarium、Layer1 の共有 module（tsc で1対1） | 同じ origin の ELF・build-info → 照合・登録・command session | page の中の端末1つ。他の pane に波及させない | S3・S7・P3・P4 |
| ReproScript | vivarium、recipe の repro | 2つの端末の結果 → verdict と Result v1 | page | BR4.x |
| FormicariumRuntime | formicarium の npm package（変えない） | session・Worker・wasm | 端末ごとの Worker | C03・C05 |
| FixedGuestRelease | 上流 vivarium の U5 の経路 | build 入力の commit → Release | U6 の外。U6 は `accepted.buildKey` の tag を読むだけ | C07 |
| AcceptanceRecorder | main session の受入の task | 3ブラウザ × en・ja の結果 → C10 の証拠 | 受入の時だけ。製品から import しない | S9 |

## Isolation and Integration

テキスト構成：人の PR（recipe・pin・accepted）→ RecipeDeclarationCheck → AssetStager（npm・Release から取得と照合）→ LayerOneBundler → GitHub Pages。訪問者の page → TerminalPane（baseline）→ TerminalPane（fix）→ ReproScript → verdict。TerminalPane は FormicariumRuntime の公開 API だけを使い、formicarium の内部に依存しない。

- 失敗域：site build の失敗は deploy 全体を止めるが、前回の site は残る（爆発半径は「新しい公開が止まる」まで）。page の中では、端末の失敗はその pane の error で、判定にしない。もう1つの pane は続けて状態を示す。
- 共有資源：同じ origin の ELF（en の dir に1か所）と formicarium の一組（S8 の候補1なら site に1組、候補2なら en と ja の dir に1組ずつ）。page の中では2つの Worker と2つの wasm の memory（各上限 1GB）。
- 信頼の境界：npm・Release から取った bytes は、AssetStager の照合まで信用しない。site 上の file は、TerminalPane の照合まで実行しない。

## Infrastructure Handoff

Infrastructure Design で確かめること：

- GitHub Pages の公開 site の大きさの上限、1 file の上限、転送量の上限を公式情報で確かめ、P1 の記録（ELF 1つ・formicarium の一組・site 全体）と比べる。足りなければ止めて報告する（NFR6.4）。
- deploy-docs の job で AssetStager の step を `repro:i18n` の直後（Layer 2 の公開の前）に置けることと、その step の `env` に secret を渡さないこと（NFR8.4）。
- repro-regression が branch 保護で必須の check かどうか（`security-design.md` の S2 の「PR での照合」）。
- S8 の観測の環境（deployed-shape の server、可能なら deploy 後の Pages）。

## Assumptions & Open Questions

None.
