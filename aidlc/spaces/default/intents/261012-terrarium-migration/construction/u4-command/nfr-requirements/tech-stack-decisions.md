# commandの技術選択

## Sources

`aidlc/spaces/default/codekb/formicarium/technology-stack.md` の宣言（Node 24.21.0、Bun 1.4.2、Playwright 1.63.0）は、2026-10-17の人間の指示（ツールは常に最新版を使う）で古くなった。現在のrepositoryは、Node.js 26.12.0、Bun 1.4.3、@playwright/test 1.64.1（Chromium 1248、Firefox 157.0、WebKit 2370）、TypeScript 7.0.2、Biome 2.5.15、Istanbul（coverage 3.2.2、instrument 6.0.3）である（U3のtoolchain更新commit 7c7ceaf4、CI run 38948209404 successで確認済み）。根拠は `../functional-design/functional-spec.md`、`../functional-design/rules.md`、`../../../inception/requirements-analysis/requirements.md`、`../../../inception/contract-design/contract-summary.md` のC02/C04/C05。宣言値は、配布互換の成功証拠ではない。

## Decisions

- 既存のTypeScript strict/ESMの配布とNode>=24/browserの公開entryを使い、commandを独立した論理moduleにする。公開APIはC05の `createCommandSession` と `CommandSession.execute` だけを root export に追加する。
- Tokenizerは依存を追加せず、機能設計W2の5状態機械として自前で実装する。shell-quoteなどのライブラリは、拒否する記号の集合とescape規則（Q1/Q2=A）を正確に満たす保証がなく、配布footprintとlicense確認も増えるため採用しない。
- builtinのcat/rm/cdはC02のport.builtin、lsは公開listEntries、installは内部Installer（C04）、guest runはport.runInstalledを使う。U4は状態・取得・検証の副本を持たない。
- 試験は既存の node:test、Playwright、Istanbulの全realm計測を使う。runner・候補・consumer・CI・正式受入はmain sessionで逐次実行する。U3までの完了確認コマンドはU4の証拠として再利用せず、U4（とB1統合）用の新しい結果を作って承認を得る。
- 開発toolchainは最新版の方針に従う。Code Generationの開始時点で、Node/Bun/Playwright/Biome/TypeScriptが最新版かを確認し、古ければ更新を計画に含めて承認を得る。

## Alternatives and Risks

shell互換の完全な実装（glob、変数展開、パイプ）は契約外で、guestにshellを与えない方針（FR3）にも反するため採用しない。terrariumの `splitArgs` は正規表現で、未閉引用の検出や二重引用内のescapeを扱えないため、そのままは移植しない。互換の参照としてだけ使う。

Node 26はLTSではなくCurrentである。Node専用の挙動差は、U3のtoolchain更新で全回帰が通ったことを確認済みだが、U4の新しいコードでも同じ回帰とconsumer試験で確認する。

## Compatibility and Rollback

追加する公開API・型・生成JS・配布一覧をコード計画へ対応付ける。既存の公開 `Session` API と U2/U3 の公開APIは変更しない。terrarium互換のexit 1/127とメッセージへの変換は、U6のadapter（C08）の責任とする。jjでU4に限った変更を戻せるようにし、既存の公開版は保持する。

## Assumptions & Open Questions

None.
