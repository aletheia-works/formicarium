# commandのentity

## Sources

根拠は承認済みFR3/FR5/NFR3/NFR7、C02/C04/C05/C11、`../../../inception/units-generation/unit-of-work.md` のU4境界、`../../../inception/domain-design/components.md` のCommandSession/CommandRequest、本stageの `functional-design-questions.md` のQ1–Q4=Aである。User Storiesは未生成のため、要件IDに直接対応させる。以下はドキュメント根拠で、実行は未検証。

## Entity Model

```yaml
entities:
  - name: CommandSession
    description: "1つの公開Sessionに結びつくcommand解釈器。状態は持たず、FS/cwd/登録guestはExecutionSession（U2）、取得はInstallCoordinator（U3）が所有する"
    attributes:
      - { name: session, type: reference, required: true, references: "Session (ExecutionSession)", constraints: "同package factory由来のみ。偽造はINVALID_INPUT" }
      - { name: installer, type: reference, required: true, references: "Installer (InstallCoordinator)", constraints: "factoryで1つだけ内部生成し外へ出さない" }
      - { name: catalogSnapshot, type: reference, required: true, references: "GuestCatalog", constraints: "C04のcopy済みsnapshot。U4は複製・変更しない" }
    constraints:
      - "cwd・FS・登録guestの副本を持たない"
      - "一度に1つの予約だけを取得し、待ち行列を持たない"
    relationships:
      - { to: Session, cardinality: "N..1", direction: "CommandSession -> Session" }
      - { to: Installer, cardinality: "1..1", direction: "CommandSession -> Installer" }
  - name: CommandRequest
    description: "execute 1回分の入力と解釈結果。呼出しの間だけ存在する"
    attributes:
      - { name: commandId, type: identifier, required: true, unique: true, constraints: "U2予約のoperationIdを使う。empty入力では予約しないためundefined" }
      - { name: input, type: string, required: true, constraints: "UTF-8で1..65536 bytesまたは空白だけ。65537 bytes以上はINVALID_INPUT" }
      - { name: argv, type: "list<string>", required: true, constraints: "Tokenizerの結果。要素は空文字を含み得る。NULを含まない" }
      - { name: kind, type: enum, required: true, allowed: [empty, builtin, install, guest] }
      - { name: signal, type: "AbortSignal | none", required: false }
    relationships:
      - { to: SessionState, cardinality: "N..1", direction: "CommandRequest -> SessionState（参照のみ、ExecutionSession所有）" }
  - name: Token
    description: "Tokenizerが作る1引数。引用の有無は保持しない"
    attributes:
      - { name: value, type: string, required: true, constraints: "引用除去・escape解決後のliteral。非ASCII・NBSP・全角空白を変形しない" }
  - name: CommandResult
    description: "C05のresolve値。原本bytesは呼出しごとに新しいcopy"
    attributes:
      - { name: kind, type: enum, required: true, allowed: [empty, builtin, install, guest] }
      - { name: exitCode, type: integer, required: true, constraints: "empty/builtin/installは0。guestはRunResult.exitCode（非0も含む）" }
      - { name: stdout, type: bytes, required: true }
      - { name: stderr, type: bytes, required: true }
      - { name: runId, type: string, required: false, constraints: "guestのときだけ" }
      - { name: installation, type: InstallResult, required: false, constraints: "installのときだけ" }
  - name: ListingLine
    description: "lsのstdout 1行。表示はU4が決め、entry原本はU2のlistEntriesが返す"
    attributes:
      - { name: name, type: string, required: true, constraints: "pathの最後の要素" }
      - { name: suffix, type: string, required: true, allowed: ["", "/", " -> <target>"], constraints: "dirは/、symlinkは -> target、fileは空" }
```

## Summary

CommandSessionは公開Sessionと、内部で1つだけ作るInstallerへの参照だけを持ち、状態を複製しない。CommandRequestはexecute 1回分の入力と解釈結果で、U2予約のoperationIdを識別子に使う。Tokenは引用除去後のliteral、CommandResultはC05の結果、ListingLineはlsの表示1行である。
