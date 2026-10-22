# U8 showcase-site のentity

## Sources

- `functional-design-questions.md`（Q1–Q7、人間の回答 2026-10-19）
- `../../../inception/units-generation/unit-of-work.md`（U8）、`../../../inception/units-generation/unit-of-work-story-map.md`（FR15 の主担当が U8）、`../../../inception/requirements-analysis/requirements.md`（FR15、NFR5–NFR8）、`../../../inception/domain-design/components.md`（Showcase、ShowcaseCandidate）
- `../../../inception/contract-design/contract-summary.md`（C03・C04・C05・C09・C10 の U8 の profile と SiteEvidenceIdentity・C11）
- formicarium の `showcase/`（U7 の実装の読取り、2026-10-19）：`README.md`、`tools.json`、`trusted-callers.json`、`scripts/{candidate,paths,catalog,accept-server}.ts`、`fixtures/`
- terrarium の読取り調査（upstream main `2caa5706`、2026-10-19）：`docs/astro.config.mjs`、`docs/src/content/docs/`、`docs/src/pages/demos/{index,[tool]}.astro`、`packages/terrarium/src/terminal.ts`、`.github/workflows/pages.yml`

この資料は設計で、実装・動作の主張ではない。U8 は kind=ui だが、配布の境界（候補の受取り・site の inventory・証拠）を持つので entities.md と rules.md も作る（unit-of-work の「U8 は ui でも配布境界を含む」）。

## Entity model

```yaml
entities:
  - name: SiteCandidateInput
    description: >-
      site build が受け取る、U7 の受入済みの候補。showcase.yml の workflow_call の
      Actions artifact `showcase-candidate` と、job の出力 candidate-id・distributable。
    attributes:
      - { name: candidateId, type: sha256, required: true, constraints: "manifest.json から計算し直した値と一致" }
      - { name: distributable, type: boolean, required: true,
          constraints: "配布の build は true だけを受け付ける。verify の候補は false" }
      - { name: manifest, type: ShowcaseCandidateManifest, required: true, constraints: "C09 と U7 の付加 field" }
      - { name: catalog, type: GuestCatalog, required: true,
          constraints: "manifest.catalogSha256 と一致。entry の url は same-origin の相対 path" }
      - { name: guests, type: "list<file>", required: true,
          constraints: "site/guests/<tool>/<version>/ の ELF と build-info。manifest.assets の SHA256・bytes と一致" }
      - { name: formicariumPackSha256, type: sha256, required: true,
          constraints: "同じ run の artifact showcase-work-resolve の pack（pack.json と tarball）の SHA256 と一致。pack は候補の artifact には入らない" }
      - { name: fixtureInventorySha256, type: sha256, required: true,
          constraints: "build する checkout（manifest.sourceCommit）の showcase/fixtures を U7 の fixtureInventorySha256 で計算し直した値と一致" }
      - { name: acceptanceLog, type: file, required: true,
          constraints: "acceptance-log.json。SHA256 が acceptanceLogSha256 と一致し、3ツール × node・3ブラウザの12行がすべて passed" }
    relationships:
      - { to: ToolCard, cardinality: "1:3", direction: "SiteCandidateInput -> ToolCard" }
      - { to: SiteBuild, cardinality: "1:1", direction: "SiteCandidateInput -> SiteBuild" }

  - name: ToolCard
    description: >-
      /tools/ のカードと個別ページの元。tool と版は manifest.resolvedTools、
      repository と fixture は showcase/tools.json、説明文は site の i18n の文言から作る。
    attributes:
      - { name: tool, type: enum, required: true, allowed: [aube, pitchfork, biome], unique: true }
      - { name: version, type: string, required: true, constraints: "resolvedTools[].version。site で latest を解決しない" }
      - { name: repository, type: url, required: true }
      - { name: fixture, type: string, required: true, constraints: "showcase/fixtures/<fixture>/app" }
      - { name: label, type: localized-text, required: true }
      - { name: summary, type: localized-text, required: true }
      - { name: hints, type: "list<command>", required: true, constraints: "個別ページの案内に出す command 列" }
    relationships:
      - { to: SitePage, cardinality: "1:2", direction: "ToolCard -> SitePage（en・ja の個別ページ）" }

  - name: SitePage
    description: 配布する1つの page。Starlight の文書 page か、Astro の page（/tools/・個別・端末）。
    attributes:
      - { name: path, type: string, required: true, unique: true, constraints: "base /formicarium の下。ja は /ja/ の下" }
      - { name: locale, type: enum, required: true, allowed: [en, ja] }
      - { name: kind, type: enum, required: true, allowed: [top, guide, tools, tool, terminal] }
      - { name: loadsTerminal, type: boolean, required: true, constraints: "tool と terminal だけ true" }
    constraints:
      - "en と ja の page の組は同じ path の形を持つ（/x/ と /ja/x/）"

  - name: TerminalSession
    description: >-
      1つの端末の page の中の、formicarium の Session と CommandSession の組。
      page を開くたびに作り、page を離れると dispose する。状態は functional-spec の状態機械。
    attributes:
      - { name: mode, type: enum, required: true, allowed: [empty, preinstalled] }
      - { name: tool, type: enum, required: false, allowed: [aube, pitchfork, biome], constraints: "preinstalled のとき必須" }
      - { name: state, type: enum, required: true,
          allowed: [isolating, loading, installing, ready, ready_failed_install, running, failed, disposed] }
      - { name: cwd, type: path, required: true, default: /work/app }
      - { name: history, type: "list<string>", required: false, constraints: "この page の中だけ。保存しない" }
      - { name: inputBytes, type: integer, required: true, max: 65536, constraints: "C11 maxCommandBytes" }

  - name: SiteBuild
    description: 1回の site の build（日次・手動・PR の検証）。
    attributes:
      - { name: mode, type: enum, required: true, allowed: [verify, distribute] }
      - { name: runNumber, type: integer, required: true, constraints: "古い run の拒否に使う（BR6.2）" }
      - { name: sourceCommit, type: commit, required: true }
      - { name: identityFile, type: file, required: true,
          constraints: "site に置く run_number・sourceCommit・candidateId・siteInventorySha256 の JSON。inventory の計算からは除く" }
      - { name: candidateId, type: sha256, required: true }
      - { name: siteInventory, type: SiteInventory, required: true }
      - { name: result, type: enum, required: true, allowed: [deployed, built-not-deployed, failed] }
    constraints:
      - "distribute かつ全受入の合格のときだけ deployed"

  - name: SiteInventory
    description: build した site の全 file の正規化した一覧（path 順、各 SHA256・bytes）。
    attributes:
      - { name: files, type: "list<{path, sha256, bytes}>", required: true, constraints: "dotfile を含む。重複 path なし" }
      - { name: sha256, type: sha256, required: true, constraints: "files の正規化 JSON の digest（C10 siteInventorySha256）" }

  - name: SiteAcceptanceEvidence
    description: C10 の AcceptanceEvidence（unit=u8-showcase-site、identity=SiteEvidenceIdentity）。
    attributes:
      - { name: identity, type: SiteEvidenceIdentity, required: true }
      - { name: checks, type: "list<CheckRow>", required: true, constraints: "C06/C10 の U8 の profile の必須行" }
      - { name: deployedIdentity, type: sha256, required: false,
          constraints: "配布したときは必須。deploy した artifact の inventory の SHA256 を代入した値（配布先の全 bytes の観測ではない）" }

  - name: FixtureIndex
    description: site に置く demo の fixture の一覧。page がこれから FsEntry を作る。
    attributes:
      - { name: fixture, type: string, required: true, constraints: "showcase/tools.json の fixture の名前" }
      - { name: entries, type: "list<{path, type, mode, sha256?, bytes?}>", required: true,
          constraints: "path 順。type は dir か file だけ。file は bytes（base64）と SHA256 を持つ。symlink・特殊 file は build の失敗" }
```

## Summary

| entity | 役割 |
|---|---|
| SiteCandidateInput | U7 の受入済み候補。site はこれだけを入力にし、latest を解決し直さない |
| ToolCard | カードと個別ページの元。版は候補、説明文は site の文言 |
| SitePage | en・ja の page。端末を読み込むのは個別と空の端末の page だけ |
| TerminalSession | page の中の Session と CommandSession の組と、その状態 |
| SiteBuild・SiteInventory | 1回の build と、その全 file の一覧の digest |
| SiteAcceptanceEvidence | C10 の U8 の証拠 |
| FixtureIndex | demo の fixture を site に置く形。mode を保ち、SHA256 で照合する |
