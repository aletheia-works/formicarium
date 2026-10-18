# U7 u7-showcase-guests NFR Requirements の質問

根拠：requirements.md の FR13・FR14、NFR2・NFR3・NFR4・NFR5・NFR6・NFR8、契約 C03（公開guest検証）・C05（公開コマンド）・C09（showcase候補の供給）・C11（取得・時間・サイズの境界）、unit-of-work の U7、現行terrariumの最新版ビルド（`terrarium/integration/latest-tool-builds.md`、`.github/workflows/build-latest-guests.yml`）。U7 は packaging の Unit なので、この stage で作るのは security-requirements・tech-stack-decisions・traceability である。

U5で決めた方針（自分たちの開発のtoolは最新版、検証対象のsource buildはupstreamのbuild設定に従う、patchを使う場合はrepo内のfileとSHA256で固定）は、U7のsource build（pitchforkなど）にも同じく当てはめる。以下は、U7に固有で、まだ決まっていない点だけを聞く。

## Q1. [CI/運用] showcase専用CIを動かす契機と権限

U7の専用CI（最新版の解決・取得/source build・検証・catalog生成・Node/3ブラウザの `--version` 受入）を、formicariumのどの契機で動かし、どの権限を与えるか。重い本体CI（probe・aube browser回帰・coverage）は複製しない（FR14）。

A. `showcase/` か公開APIの配布物が変わるPR・mainへのpush、手動実行、U8の日次buildからの呼出しで動かす。jobは `contents: read` だけにし、最新releaseの解決にはworkflowの読取り用tokenを使う。候補の保存や配布への書込みは、このCIに持たせない（U8と、承認後の既存executorが持つ）。
B. A に加えて、U7自身も毎日の定期実行を持つ（U8とは別に、最新版の変化を早く検知するため）。
C. 手動実行とU8からの呼出しだけにする（PRでは動かさない）。
X. Other (please specify)

[Answer]: A

## Q2. [開発] 「最新の安定版」の決め方

FR13 は「latest stable の aube/pitchfork/Biome」を解決するとしている。どの規則で1つの版に決めるか。現行terrariumはGitHubの「latest release」を使っている。

A. 各upstream repositoryのGitHub「latest release」（draft・prereleaseを除いたもの）を使い、そのtagと40桁のcommitを一度だけ解決して固定する。tagの形がツールごとに違う場合は、設定に書いた規則で照合する。
B. tagをsemverとして並べ、prereleaseを除いた最大の版を使う（GitHubの「latest」の印に頼らない）。
C. A で解決し、B の規則でも同じ版になることを確かめる。食い違えば候補を作らずに失敗させる。
X. Other (please specify)

[Answer]: A

## Q3. [セキュリティ] 公式musl資産の出所の確かめ方

aubeとBiomeは公式のx86-64 static musl資産を使う予定である。現行terrariumは、release付属のSHA256とサイズを確かめ、release URLと資産digestを記録している（publisherのbinaryの再現性の証明ではない）。U7ではどこまで求めるか。

A. 現行と同じ：releaseが公開するSHA256（checksum file又はrelease API のdigest）とサイズの一致、ELF・build-infoの検証（C03）を必須とし、資産URL・digest・tag・commitを記録する。publisherのattestation（GitHubのartifact attestation等）は、あれば記録するが必須にしない。
B. A に加えて、upstreamがGitHubのartifact attestationを公開しているツールでは、その検証を必須にする（公開していないツールはAのまま）。
C. 公式資産を使わず、3ツールともsource buildにする。
X. Other (please specify)

[Answer]: A

## Q4. [開発] showcaseが使うformicarium本体

FR14 は、専用CIが「受入済み/構築済み本体資産」を利用するとしている。0.3.0はまだ公開していない（個別承認の後）。showcaseはどのformicarium本体を使うか。

A. 同じcommitの本体CIが作った `npm pack` のtarball（とそのSHA256）を使う。C09の `formicariumPackSha256` にその値を記録する。公開後も、候補に記録した値で同一性を確かめる。
B. npmに公開済みの版だけを使う（0.3.0の公開まではU7の受入を完了できない）。
C. PRとmainの検証は A、配布する候補（U8の日次build）は公開済みの版を使う。
X. Other (please specify)

[Answer]: A

## Q5. [CI/運用] 受入済み候補の保存場所

C09は、失敗した候補を配布せず、前回の候補を保つとしている。U7が受入した候補（catalog・guest資産・manifest・受入log）を、U8が使えるようにどこに保存するか。

A. 受入したCI runのActions artifactに置き、U8は同じworkflowの中（呼出し元）でそれを受け取る。前回の配布はPages側にそのまま残るので、U7では候補を長期保存しない。
B. formicariumのGitHub Releaseに、candidateIdごとに保存する（書込みは承認後の別job）。
C. A に加えて、配布した候補だけをRelease（又は別の保存先）に残し、配布物と照合できるようにする。
X. Other (please specify)

[Answer]: A
