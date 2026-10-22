# terrarium からの移行：目的・要件・全体設計（2026-10-12〜）

terrarium を廃止し、機能を formicarium と vivarium へ移す計画の記録。フェーズごとの手順と受入条件は、git の commit `c8ddd83c` の `docs/terrarium-migration-plan-summary.md` にある。ここでは、その要約にない要件の数値、作業単位の分け方、決定の理由、後から変えた点をまとめる。初期試行の結果は、同じ commit の `docs/results/terrarium-migration-preflight.md` にある。

## 目的と範囲

terrarium を挟む構成のため、ビルドと検証が重複していた。依存を vivarium → formicarium の一方向に揃え、重複を減らす。

対象者は3者。デモの閲覧者（移管後も aube・pitchfork・Biome のデモを使える）、vivarium の再現利用者（Biome の再現結果が変わらない）、各リポジトリの保守者（重複が減る）。範囲・優先順位・公開の最終判断は依頼者が行い、ほかの承認者は置かない。固定の期限と追加の予算はなく、新しい費用は事前に相談する。追加の規制要件はない。

完了の目標は6つ：再現結果の互換、3ツールのデモの移管、固定したゲスト成果物の再利用、旧入力アーカイブ（個人アカウントの `inputs.tar.gz`）への依存の解消、利用を移した後の terrarium の廃止、既存の品質限界を緩めないこと。

範囲は S0〜S7 の8成果（判断材料の試行、公開 API、固定ビルド、再現、契約と文書、showcase のゲスト、サイト、退役）で、すべて必須。S1（formicarium だけでゲストを検証・操作・導入できる）だけでは完了としない。

対象外：C fork の JIT（[ADR 0002](../decisions/0002-interpreter-only-jit-deferred.md)）、paludarium へのコアの置き換え、動的リンク、ゲスト内のネットワーク・シェル・パッケージマネージャ、任意 URL からの install、パイプ・変数展開・リダイレクト、showcase の別リポジトリ化、3ツールを超えるデモ、npm/JSR の既存版の削除、移行完了前の terrarium の停止、別の作業（一般の CI 改善や既知のコアの問題）を混ぜること。

## 要件の要点

機能要件は FR1〜FR16、非機能要件は NFR1〜NFR8。すべて必須。
- **初期試行（FR1、FR9）**：大規模な移管の前に、aube の公式 musl tar.gz と Biome の musl ELF を Chromium・Firefox・WebKit で取得・実行し、CORS、最終 URL、工程ごとの時間、出力と終了コードを記録する。Biome の baseline 1件を vivarium の CI でビルドし、2回目に再利用できることも確かめる。CORS が通らないか NFR1 を満たさなければ、代わりの方法を確認するまで先へ進まない。
- **公開 API（FR2〜FR6）**：guest の検証（SHA256、静的 x86-64 ELF64、program header の境界、`PT_INTERP` の拒否、build-info）、共通コマンド（[`../command-api.md`](../command-api.md)）、install（[`../install-api.md`](../install-api.md)）。install 中の reset・dispose・abort では保留中の処理を止め、遅れた応答を登録しない。実行と install の重なりは busy で拒否する。再 install は検証が通ってから置き換え、失敗したら前の登録を残す。0.3.0 を個別の承認の後に公開し、旧入力アーカイブを npm の公開 API に置き換える。
- **固定ビルドと再現（FR7〜FR12）**：recipe の `guests` に tool・repository・40桁の commit・fixture を書く。branch や PR は作成時に commit へ解決する参考情報。build key は tool・repository・commit・builder のハッシュを含み、同じ key の2回目はコンパイルを省いて同じ digest になる。成果物は GitHub Release に置く。build-info に source URL・commit・target・rustc・sourcePatches を書き、pitchfork の UI が使う aube も固定する。builder の合否は ELF と build-info だけで決め、verdict の期待値は recipe 側が持つ。vivarium は formicarium の browser 用ファイルを bundle して同じ origin から配り、実行前に commit と digest を recipe の固定値と照合する。
- **showcase（FR13〜FR15）**：最新安定版の3ツールの解決・取得・検証・カタログ化を持ち、公式の musl 資産がなければソースからビルドする。公開 API だけを import し、runtime 内部の import、本体から showcase への依存、回帰用 fixture の共有を機械的に拒否する。サイトは毎日ビルドし、受入の後に Pages へ配る。失敗した候補は配らず前のサイトを残す。
- **退役（FR16）**：両経路の受入の後に、npm/JSR のダウンロード数と GitHub の dependents を調べて案内し、個別の承認の後に最終版・deprecation・案内ページ・archive・OpenTofu の state と ruleset を整理する。全関連リポジトリで `inputs.tar.gz` の参照がないことを検索で確かめる。

非機能要件の数値：

| 項目                     | 条件                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 導入の速さ（NFR1）       | aube・Biome × 3ブラウザで、ダウンロード以外の工程（展開、SHA256、ELF・build-info の検証、登録、`--version`）の合計が連続5回の中央値で 3000ms 以下。初回と最大値も報告し、fetch は別に測る                                                                                                               |
| 品質限界（NFR2）         | probe 600秒以内・8項目、aube のブラウザ 840秒以内、worker 1・retry 0、native の出力と完全一致、wasm 1GB（[ADR 0010](../decisions/0010-wasm-memory-1gb.md)）、`Atomics.waitAsync` の削除（[ADR 0009](../decisions/0009-disable-atomics-waitasync.md)）。第一者の配布 JS の固定一覧で行 coverage 80% 以上 |
| 入力と取得（NFR3・4）    | archive の逸脱・ループ・重複・破損・上限超過を拒否し、実行には検証した copy だけを使う。取得とビルドに有限の期限と取消を持たせる                                                                                                                                                                        |
| 重なり（NFR5）           | 同じ key のビルドと公開を直列にし、古い応答で受入済みの成果物を壊さない                                                                                                                                                                                                                                 |
| ブラウザと UI（NFR6・7） | 同じ origin の Worker・COI・既存の CSP を保つ。実機の Safari は別の証拠がなければ未検証と書く。guest の出力を HTML として実行しない                                                                                                                                                                     |
| 配布（NFR8）             | source・pack・guest の digest と受入済みの版を対応づける。CI は最小権限で、信頼できない PR から公開させない。PR ごとに戻せるようにする                                                                                                                                                                  |

取得とサイズの上限は [`../install-api.md`](../install-api.md) の表にある。そこにないものとして、コマンド 64KiB、ビルド全体 4時間（依存の取得を含む）を決めた。

## 全体の設計

リポジトリの役割：formicarium は汎用のエミュレータ、guest の検証、コマンド層と install を持ち、同じリポジトリの `showcase/` に最新安定版のデモを置く。コア固有の知識は `runtime/core` に閉じる（[ADR 0003](../decisions/0003-core-boundary.md)）。vivarium は recipe で固定したゲストのビルド、再現の UI、verdict を持つ。terrarium は移行完了まで動かし、最後に案内を出して archive する。新しい常駐サービスは作らず、外部の置き場は GitHub Release と Pages だけ。

部品は8つ。ExecutionSession（FS・cwd・登録した guest・実行中の操作の唯一の持ち主）、GuestValidation（状態を持たない検証）、InstallCoordinator（カタログの選択・取得・展開・進捗・取消）、CommandSession（入力の解釈と振り分け）、vivarium の FixedGuestBuilder と RecipeRunner、Showcase、MigrationAcceptance（計測・照合・退役準備。製品の本体からは参照しない）。依存は一方向で、RecipeRunner が builder を使うのはサイトのビルド時だけ。

作業単位：

| 単位                    | 置き場所                  | 届けるもの                                                             |
| ----------------------- | ------------------------- | ---------------------------------------------------------------------- |
| U1 移行前の試行         | formicarium・vivarium     | 既存の API での3ブラウザ計測と、Biome baseline 1件の固定ビルドと再利用 |
| U2 session と guest API | formicarium               | 状態の一元管理、busy・取消・原子的な登録、guest 検証と fixture 変換    |
| U3 install              | formicarium               | カタログからの install                                                 |
| U4 command              | formicarium               | 共通コマンド層と、U2〜U4 の統合受入（B1）                              |
| U5 固定ゲストビルド     | vivarium                  | build key、Release への保存と再利用、カタログ、上流の bump             |
| U6 recipe と再現 UI     | vivarium                  | recipe・端末・比較、Contract v1 と schema・文書、旧依存の整理          |
| U7 showcase のゲスト    | formicarium/showcase      | 最新安定版3ツールのビルドとカタログ、専用 CI                           |
| U8 showcase のサイト    | formicarium/showcase/site | Astro/Starlight のサイト、空の端末からの install、毎日のビルド         |
| U9 退役の受入           | 関連リポジトリと infra    | 両経路の証拠の照合、利用調査、案内、切り戻し                           |

U2〜U4 は同じ npm パッケージに入るが、モジュールと検証は分ける。U1 は新しい API に頼らず、試行の間だけ旧入力アーカイブを使ってよい。試行用の builder は U5 に引き継ぎ、二重に保たない。

順序は U1 → U2 → U3 → U4 → U5 → U6 → U7 → U8 → U9。U5 は B1 の後、U9 は U6 と U8 の両方の後。U5 と U7 は並行できるが、計測の負荷と証拠の混同を避けるため順番に進めた。

部品間の受け渡しは契約 C01〜C12 で決めた。ライブラリの境界は TypeScript の関数と型、リポジトリ間の成果物は版つきの JSON schema。公開・退役の操作計画（C12）に承認の参照を書いても承認にはならず、本人の具体的な承認と現在の digest の一致を確かめてから実行する。

## 主な決定

- **依存を一方向にし、本体から showcase に依存しない**。全 builder を本体に集める案は汎用 API にツール固有の条件が入るので、全機能を vivarium に置く案はデモに recipe の責任が広がるので退けた。
- **固定成果物は vivarium の GitHub Release に置く**。Actions cache と Pages に置く案は採らなかった。
- **command と install を別の部品にする**。取得の失敗や取消を単独で試験できるため。一つにまとめる案は、取得と検証の責任まで command 側に集まるので退けた。
- **状態の持ち主は ExecutionSession だけ**。install が独自の登録表を持つと reset が二つの状態にまたがり、command 側だけで排他すると直接の API 呼び出しで迂回できるため。
- **カタログは呼び出し元が渡す**。本体にツールの一覧を固定しないため。install API がカタログの取得・更新まで持つ案は退けた。
- **導入時間の基準は 3秒**。5秒の案もあった。
- **固定の再現を先に、デモを後に進める**。再現の互換と固定成果物の再利用のリスクを先に確かめるため。
- **移管の計測と照合のコードを製品から分ける**。手順書だけの案は機械的に照合できず、常駐の承認サービスを作る案は範囲が広がるので退けた。
- **自動の再試行と別 URL への切り替えをしない**。ブラウザで redirect の各段を検査できないときは、Release からの直接取得を成功とせず、redirect しない同じ origin のミラー URL をカタログに固定する。
- **外部の操作は一件ずつ承認を得る**。計画の承認で公開・deprecation・archive・infra の変更まで承認したとは扱わない。

2026-10-18 に変えた点：
- vivarium の biome-12265 の recipe が #518（`04a8724`）で削除済みで、terrarium を使う recipe が0件だと分かった。再現の題材を `JamBalaya56562/biome` の branch `fix/migrate-prettier-override-bracket-spacing`（`25e3e2c2`）に変えた。Prettier の override の `bracketSpacing:false` が、baseline（作成時点の biomejs/biome main を40桁に解決した値）では移らず、fix では `formatter.bracketSpacing:false` として移ることを、3ブラウザで before/after として比べる。旧 verdict との比較はしない。baseline でも移るなら「最新の main で直っている」と記録して判断を仰ぐ。
- terrarium は完全に削除する予定なので、Contract v1 の `runtime.name` は `formicarium` だけを現役の値とし、terrarium の deprecated 互換は作らない。端末は `ready`・`transcript`・`run` だけを提供し、`terrarium-*` の DOM イベントと iframe の bridge は作らない（vivarium が使っていない）。
- recipe の guest に `role`（`baseline` か `fix`）を加え、ビルドの入力の `commit` と受入済みの `accepted` を分けた。bump は `commit` だけを動かし、`accepted` は Release を受け入れた後の人の PR だけが置き換える。
- 旧題材の baseline `2405c762`・fix `f79f85d5` は U5 の証拠として済んだので、その Release と tag は消し、formicarium 側の記録は残す。
- 作業を upstream の main（`4e3482bb`）の上に移し直し、upstream の規約に合わせた（生成 JS を追跡しない、task は `mise-tasks/` の file task、Conventional Commits、公開は release-please と `publish.yml`）。U2〜U4 は1つの PR にまとめ、B1 の受入は merge の前にやり直す。
- CI と過去の証拠が固定 commit の URL で入力 archive を参照しているため、入力用の branch（`codex/release/rc1-inputs`、`codex/inputs/stable-0.1.0-v1`、`codex/inputs/stable-0.1.0-approved-v1`、fork の `codex/ci-inputs/u4-publication-boundary`）は消さない。

## 用語

| 用語             | 意味                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| showcase         | formicarium の中に置く最新安定版3ツールのデモ。回帰用のゲストとは分ける          |
| recipe / verdict | vivarium の再現の定義と、その before/after の比較から決める判定                  |
| baseline / fix   | 再現で比べる修正前と修正後のゲスト                                               |
| build key        | 固定ビルドの再利用の判定に使う値（tool・repository・commit・builder のハッシュ） |
| B1               | U2〜U4 を合わせた公開 API の統合受入。U5 の開始条件                              |

## 元の記録

元の記録は git の commit `8096c7b4` の `aidlc/spaces/default/intents/261012-terrarium-migration/` にある。
