# Changelog

## [0.4.0](https://github.com/aletheia-works/formicarium/compare/v0.3.0...v0.4.0) (2026-10-21)


### Features

* **infra:** add a main ruleset next to the classic protection ([#48](https://github.com/aletheia-works/formicarium/issues/48)) ([6d28dc7](https://github.com/aletheia-works/formicarium/commit/6d28dc7cd02e75d12f9f6dd86df5806859cca0af))
* **infra:** drop the github-pages reviewer after the first deployment ([#55](https://github.com/aletheia-works/formicarium/issues/55)) ([8dd0e4a](https://github.com/aletheia-works/formicarium/commit/8dd0e4a4688165a4459644f45efbd2fcb5f2c02f))
* **infra:** enable GitHub Pages for the showcase site ([#40](https://github.com/aletheia-works/formicarium/issues/40)) ([2aca919](https://github.com/aletheia-works/formicarium/commit/2aca91975eb5c2e591ffce526b666cceda0f6427))
* **infra:** manage the About box: description, website and topics ([#56](https://github.com/aletheia-works/formicarium/issues/56)) ([68b7142](https://github.com/aletheia-works/formicarium/commit/68b7142173aec94f25e991fb53db4481a25e3238))
* **infra:** remove the classic main protection ([#49](https://github.com/aletheia-works/formicarium/issues/49)) ([4aad181](https://github.com/aletheia-works/formicarium/commit/4aad18135184698648b5d3b98cee0120ba0c67f3))
* **infra:** require showcase-site-required on main ([#46](https://github.com/aletheia-works/formicarium/issues/46)) ([42676b3](https://github.com/aletheia-works/formicarium/commit/42676b3a1c4cb1b2306a4f296ad96be428c750f6))
* **migration:** add the formal U4/B1 acceptance workflow on main ([#50](https://github.com/aletheia-works/formicarium/issues/50)) ([22b662d](https://github.com/aletheia-works/formicarium/commit/22b662d2e98cacba6d465e7300aa267fe9644305))
* remove terrarium from formicarium ([#58](https://github.com/aletheia-works/formicarium/issues/58)) ([5735433](https://github.com/aletheia-works/formicarium/commit/5735433de9a1af3df2ccc0db4973110dde5a3c29))
* **showcase-site:** deploy when the site changes on main, drop the daily run ([#54](https://github.com/aletheia-works/formicarium/issues/54)) ([94970a9](https://github.com/aletheia-works/formicarium/commit/94970a9ecd375f7c67b9635a4ca115e4ebcbad70))
* **showcase:** add the formicarium showcase site (U8) ([#43](https://github.com/aletheia-works/formicarium/issues/43)) ([c140ca9](https://github.com/aletheia-works/formicarium/commit/c140ca9a73f0627ebd0f18bb41f97a6613375316))
* **showcase:** point b1-pack.json at the B1 acceptance pack ([#52](https://github.com/aletheia-works/formicarium/issues/52)) ([c9b37c4](https://github.com/aletheia-works/formicarium/commit/c9b37c4a95849f3323544333bf158f4134853117))


### Bug Fixes

* **migration:** refuse a malformed guest build-info as input and remove the temporary assets ([#59](https://github.com/aletheia-works/formicarium/issues/59)) ([d9772f8](https://github.com/aletheia-works/formicarium/commit/d9772f84be3d5a64b84d0f7c1e405aef37e72c03))
* **migration:** refuse non-object guest catalogs and dependencies as input ([#62](https://github.com/aletheia-works/formicarium/issues/62)) ([2faec36](https://github.com/aletheia-works/formicarium/commit/2faec369bc1cd9631fdce0966f6a44bc11eec54b))
* **migration:** take pitchfork from main's CI in the acceptance workflow ([#51](https://github.com/aletheia-works/formicarium/issues/51)) ([2e0358a](https://github.com/aletheia-works/formicarium/commit/2e0358a213681cc493d2665bdccabc761d59ccbe))
* **showcase-site:** gate deploy on the candidate and fix the maintenance steps ([#57](https://github.com/aletheia-works/formicarium/issues/57)) ([c849713](https://github.com/aletheia-works/formicarium/commit/c8497135e10b57ff0349a3e4c6156a285c2757dd))
* **showcase:** run the site acceptance and add a required check ([#44](https://github.com/aletheia-works/formicarium/issues/44)) ([9a35348](https://github.com/aletheia-works/formicarium/commit/9a35348fdf93f3444c166c9c77ba9848d3cfdabe))

## [0.3.0](https://github.com/aletheia-works/formicarium/compare/v0.2.1...v0.3.0) (2026-10-18)

### Features

- **package:** ship a single-file browser package Worker ([#38](https://github.com/aletheia-works/formicarium/issues/38)) ([227a6cf](https://github.com/aletheia-works/formicarium/commit/227a6cf9321b6e39cdbf2bc8a1b1755b77e8542e))
- **runtime:** add guest validation, install and command APIs ([#29](https://github.com/aletheia-works/formicarium/issues/29)) ([f5bc078](https://github.com/aletheia-works/formicarium/commit/f5bc078c6c0b1460e92497c222c864c3ae71c5a1))
- **showcase:** add the U5 fixed guest check and the U7 showcase guests ([#31](https://github.com/aletheia-works/formicarium/issues/31)) ([880cfd4](https://github.com/aletheia-works/formicarium/commit/880cfd4ad913fbd10d0c58d73fb158af7c5c2042))


### Bug Fixes

- **migration:** compare the U2 coverage report with the distribution inventory ([#35](https://github.com/aletheia-works/formicarium/issues/35)) ([2a79860](https://github.com/aletheia-works/formicarium/commit/2a79860351b7bdeabff8b3424393694943a6a6bb))

## [0.2.1](https://github.com/aletheia-works/formicarium/compare/v0.2.0...v0.2.1) (2026-10-11)

### Bug Fixes

- **release:** prepare main-bound RC candidates after release merge ([#25](https://github.com/aletheia-works/formicarium/issues/25)) ([d8e5127](https://github.com/aletheia-works/formicarium/commit/d8e5127816ba63cadfdbdeb1a74c9f43151b06ef))
- **release:** publish stable packages from verified release tags ([#27](https://github.com/aletheia-works/formicarium/issues/27)) ([3e94eb4](https://github.com/aletheia-works/formicarium/commit/3e94eb4ce99786979b0caf150f6e261e87c3fa6f))

## [0.2.0](https://github.com/aletheia-works/formicarium/compare/v0.1.0...v0.2.0) (2026-10-11)

### Features

- add npm runtime ([a8a21da](https://github.com/aletheia-works/formicarium/commit/a8a21dab3e51d39178c77b0c5d9159aa0e9bf5d7))
- add npm runtime ([b3d7b19](https://github.com/aletheia-works/formicarium/commit/b3d7b1974af767202ff66b8dc8f686e266482ef7))
- **ci:** add guarded release PR and weekly tagging automation ([#19](https://github.com/aletheia-works/formicarium/issues/19)) ([9a406a0](https://github.com/aletheia-works/formicarium/commit/9a406a00da8dee900845647bc0ede40b6a278fb1))
- **ci:** add shared state seeding and release preflight ([#20](https://github.com/aletheia-works/formicarium/issues/20)) ([5ffbb4e](https://github.com/aletheia-works/formicarium/commit/5ffbb4ea37cf1516c05b35e0528bd065322f1e34))
- **ci:** verify release PR candidates automatically ([#24](https://github.com/aletheia-works/formicarium/issues/24)) ([a2226d9](https://github.com/aletheia-works/formicarium/commit/a2226d9f4035a472c47f3b4e0943ba35b1f365c1))


### Bug Fixes

- **ci:** allow release version updates and retain enabled automation ([#23](https://github.com/aletheia-works/formicarium/issues/23)) ([306c73f](https://github.com/aletheia-works/formicarium/commit/306c73f82ef5261c8269a4a0fdbd3c24d05cc4e6))
- **ci:** pin seeded state workflow to merged shared commit ([#21](https://github.com/aletheia-works/formicarium/issues/21)) ([457ae42](https://github.com/aletheia-works/formicarium/commit/457ae42a5246812aa4893537fdbd2f3306598181))
- handle GitHub artifact storage shards safely ([#7](https://github.com/aletheia-works/formicarium/issues/7)) ([1abbf54](https://github.com/aletheia-works/formicarium/commit/1abbf5404ac28e2918fa315c64ebb6984c7f95e0))
- **release:** integrate stable publication verification ([#18](https://github.com/aletheia-works/formicarium/issues/18)) ([6dccd22](https://github.com/aletheia-works/formicarium/commit/6dccd223a2fc4cb5237db2456403f710cd4dbf8a))
