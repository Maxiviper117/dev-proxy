# Changelog

## [0.26.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.25.0...devproxy-v0.26.0) (2026-05-10)


### Features

* add local web dashboard ([#77](https://github.com/Maxiviper117/dev-proxy/issues/77)) ([3c08db6](https://github.com/Maxiviper117/dev-proxy/commit/3c08db6d4e7351bfdc96def7dc335c47163eacdf))

## [0.25.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.24.0...devproxy-v0.25.0) (2026-05-10)


### Features

* add doctor Caddy config validation, duplicate port detection, sitemap support, and standardized elevated permission warnings ([#74](https://github.com/Maxiviper117/dev-proxy/issues/74)) ([f7059ea](https://github.com/Maxiviper117/dev-proxy/commit/f7059ea3f5c7bb985785ed45b281fe4476e6a190))

## [0.24.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.23.0...devproxy-v0.24.0) (2026-05-10)


### Features

* add devproxy update command and keep docs in sync ([#72](https://github.com/Maxiviper117/dev-proxy/issues/72)) ([68ab210](https://github.com/Maxiviper117/dev-proxy/commit/68ab21030510859e21e1df25139a0b4afaadb5b0))

## [0.23.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.22.0...devproxy-v0.23.0) (2026-05-10)


### Features

* add devproxy doctor --fix ([#70](https://github.com/Maxiviper117/dev-proxy/issues/70)) ([e7355df](https://github.com/Maxiviper117/dev-proxy/commit/e7355df51b146ee86516fecc6897e15973e4c670))

## [0.22.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.21.1...devproxy-v0.22.0) (2026-05-09)


### Features

* interactive service removal with searchable checkbox prompt ([#68](https://github.com/Maxiviper117/dev-proxy/issues/68)) ([de97db1](https://github.com/Maxiviper117/dev-proxy/commit/de97db164dc1d38bf7f210bec4469e9341fe5a7e))

## [0.21.1](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.21.0...devproxy-v0.21.1) (2026-05-09)


### Bug Fixes

* use local file URI for config  instead of GitHub raw URL ([#66](https://github.com/Maxiviper117/dev-proxy/issues/66)) ([bf80554](https://github.com/Maxiviper117/dev-proxy/commit/bf8055428db8fce39595aef977c3288f793996e9))

## [0.21.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.20.0...devproxy-v0.21.0) (2026-05-09)


### Features

* add open targets, config re-use init, and JSON schema ([#64](https://github.com/Maxiviper117/dev-proxy/issues/64)) ([ea604bf](https://github.com/Maxiviper117/dev-proxy/commit/ea604bf7909a3af3dcf5cb6a021e50c8375d2d22))

## [0.20.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.19.0...devproxy-v0.20.0) (2026-05-08)


### Features

* add sync-hosts command and hosts drift detection ([#62](https://github.com/Maxiviper117/dev-proxy/issues/62)) ([042ecd0](https://github.com/Maxiviper117/dev-proxy/commit/042ecd09187aa1618edd505b13cc915b1c51cf46))

## [0.19.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.18.0...devproxy-v0.19.0) (2026-05-08)


### ⚠ BREAKING CHANGES

* Exported service functions like addService(context, input)

### Features

* refactor command services into domain-specific classes ([#60](https://github.com/Maxiviper117/dev-proxy/issues/60)) ([ba21ad0](https://github.com/Maxiviper117/dev-proxy/commit/ba21ad02bd58468dad38f2d87a6faf7a3816f313))

## [0.18.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.17.0...devproxy-v0.18.0) (2026-05-08)


### Features

* warn for missing vite allowed hosts ([#58](https://github.com/Maxiviper117/dev-proxy/issues/58)) ([3fb74b2](https://github.com/Maxiviper117/dev-proxy/commit/3fb74b29593f6857d6cdf99fb7410bd22b2ff942))

## [0.17.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.16.0...devproxy-v0.17.0) (2026-05-08)


### Features

* add integration test mode with temp paths and stub Caddy ([#56](https://github.com/Maxiviper117/dev-proxy/issues/56)) ([4967aec](https://github.com/Maxiviper117/dev-proxy/commit/4967aecd35232c3373bb93124148ed73bad543f9))

## [0.16.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.15.0...devproxy-v0.16.0) (2026-05-07)


### Features

* lazy load CLI context ([#55](https://github.com/Maxiviper117/dev-proxy/issues/55)) ([817fdaf](https://github.com/Maxiviper117/dev-proxy/commit/817fdaf2dc0e8856a2e9d854f2398dd854ec49a9))
* simplify CLI rendering ([#53](https://github.com/Maxiviper117/dev-proxy/issues/53)) ([67261d7](https://github.com/Maxiviper117/dev-proxy/commit/67261d7399d1d338ce60338303e3de1cbededb40))

## [0.15.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.14.0...devproxy-v0.15.0) (2026-05-07)


### Features

* auto-run caddy trust during add/init when elevated ([#51](https://github.com/Maxiviper117/dev-proxy/issues/51)) ([cbe93b6](https://github.com/Maxiviper117/dev-proxy/commit/cbe93b6fec3863012f1e51a2c4799a630ee6daca))

## [0.14.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.13.1...devproxy-v0.14.0) (2026-05-04)


### Features

* migrate CLI rendering to Ink and React ([#49](https://github.com/Maxiviper117/dev-proxy/issues/49)) ([67dbeff](https://github.com/Maxiviper117/dev-proxy/commit/67dbeffd82eee778b54aca196b29139957320eb5))

## [0.13.1](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.13.0...devproxy-v0.13.1) (2026-05-04)


### Bug Fixes

* hide doctor caddyfile preview ([#47](https://github.com/Maxiviper117/dev-proxy/issues/47)) ([b6ae491](https://github.com/Maxiviper117/dev-proxy/commit/b6ae4911d7c079a873075be085a97932cb9b4280))

## [0.13.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.12.2...devproxy-v0.13.0) (2026-05-03)


### Features

* warn before starting when Caddy root CA is missing ([#45](https://github.com/Maxiviper117/dev-proxy/issues/45)) ([7e7a322](https://github.com/Maxiviper117/dev-proxy/commit/7e7a3224d4684a0af12e1c8a7c74b367d819b6a6))

## [0.12.2](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.12.1...devproxy-v0.12.2) (2026-05-03)


### Bug Fixes

* preserve app data ownership under sudo ([#43](https://github.com/Maxiviper117/dev-proxy/issues/43)) ([bfa7a19](https://github.com/Maxiviper117/dev-proxy/commit/bfa7a1928a366483a926bdcd03d6d6215c548863))

## [0.12.1](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.12.0...devproxy-v0.12.1) (2026-05-03)


### Bug Fixes

* run cli through package bin symlinks ([#41](https://github.com/Maxiviper117/dev-proxy/issues/41)) ([d9a8362](https://github.com/Maxiviper117/dev-proxy/commit/d9a83620ecf314443dd65d8e55885508ea7875e0))

## [0.12.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.11.0...devproxy-v0.12.0) (2026-05-03)


### Features

* add cross-platform support ([#38](https://github.com/Maxiviper117/dev-proxy/issues/38)) ([6d6b2ed](https://github.com/Maxiviper117/dev-proxy/commit/6d6b2ed6bef6cbb3f261a5f4b94cb51811668dab))

## [0.11.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.10.0...devproxy-v0.11.0) (2026-05-03)


### Features

* add overwrite confirmation prompt on service re-registration ([#36](https://github.com/Maxiviper117/dev-proxy/issues/36)) ([ecd6b10](https://github.com/Maxiviper117/dev-proxy/commit/ecd6b10e81dbeda6e01d27e8aceb0f60ce77cc18))

## [0.10.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.9.0...devproxy-v0.10.0) (2026-05-03)


### Features

* add devproxy init command with project config, make open name optional ([#34](https://github.com/Maxiviper117/dev-proxy/issues/34)) ([a0c1ac1](https://github.com/Maxiviper117/dev-proxy/commit/a0c1ac1bc8711e26bc127a57ea66dc93fe643736))

## [0.9.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.8.0...devproxy-v0.9.0) (2026-05-02)


### Features

* improve local domain loopback handling ([#31](https://github.com/Maxiviper117/dev-proxy/issues/31)) ([d5e7ff2](https://github.com/Maxiviper117/dev-proxy/commit/d5e7ff284fbe19a62b35727e9e5d84bef1c4058b))

## [0.8.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.7.0...devproxy-v0.8.0) (2026-05-01)


### Features

* generalize WSL-specific messaging to reflect broader Windows support ([#29](https://github.com/Maxiviper117/dev-proxy/issues/29)) ([d2d42b7](https://github.com/Maxiviper117/dev-proxy/commit/d2d42b76af0f1431d59aa7b34aad0185be0fded0))

## [0.7.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.6.2...devproxy-v0.7.0) (2026-05-01)


### Features

* add --json output for list, doctor, and status commands ([#27](https://github.com/Maxiviper117/dev-proxy/issues/27)) ([dab5aee](https://github.com/Maxiviper117/dev-proxy/commit/dab5aee1d053eb469f69e778f7a74bb694ccdec3))

## [0.6.2](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.6.1...devproxy-v0.6.2) (2026-05-01)


### Bug Fixes

* use Node 24 and remove explicit --provenance for trusted publishing ([9c70cad](https://github.com/Maxiviper117/dev-proxy/commit/9c70cad86d39295b630d2aa5ecbaedfe799b9e26))

## [0.6.1](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.6.0...devproxy-v0.6.1) (2026-05-01)


### Bug Fixes

* add explicit --access public to npm publish and clean bin path ([e07f69c](https://github.com/Maxiviper117/dev-proxy/commit/e07f69c20dc6d290a3a8c09551b327d16c8e38a4))

## [0.6.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.5.2...devproxy-v0.6.0) (2026-05-01)


### Features

* automate npm publishing with Trusted Publishing via Release Please CI ([#22](https://github.com/Maxiviper117/dev-proxy/issues/22)) ([1a3765b](https://github.com/Maxiviper117/dev-proxy/commit/1a3765b534d759bf1cb1db7d644d544056f7cec6))

## [0.5.2](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.5.1...devproxy-v0.5.2) (2026-05-01)


### Bug Fixes

* generalize messaging to clarify WSL is one of several supported targets ([#18](https://github.com/Maxiviper117/dev-proxy/issues/18)) ([27ae81f](https://github.com/Maxiviper117/dev-proxy/commit/27ae81fa6841839949b535a2ed962cbda9bfa844))

## [0.5.1](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.5.0...devproxy-v0.5.1) (2026-05-01)


### Bug Fixes

* replace static unpublished badge with dynamic npm version shield ([#17](https://github.com/Maxiviper117/dev-proxy/issues/17)) ([1c241eb](https://github.com/Maxiviper117/dev-proxy/commit/1c241eb314b084f0a1a1ae379f3756bc91e5dd84))

## [0.5.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.4.1...devproxy-v0.5.0) (2026-05-01)


### Features

* add devproxy certs command to print Caddy root CA information ([#15](https://github.com/Maxiviper117/dev-proxy/issues/15)) ([50e75fb](https://github.com/Maxiviper117/dev-proxy/commit/50e75fb8a70c1ab0d87fdac4904b78beef1f85eb))

## [0.4.1](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.4.0...devproxy-v0.4.1) (2026-05-01)


### Bug Fixes

* Add branded help banner and version output ([#11](https://github.com/Maxiviper117/dev-proxy/issues/11)) ([efe2cc4](https://github.com/Maxiviper117/dev-proxy/commit/efe2cc45ac5b36eccce41e67885e66893888151f))

## [0.4.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.3.1...devproxy-v0.4.0) (2026-04-30)


### Features

* add open command ([#9](https://github.com/Maxiviper117/dev-proxy/issues/9)) ([4adc75c](https://github.com/Maxiviper117/dev-proxy/commit/4adc75c947733e2ebb4b7a8d615a6eb71efd711f))

## [0.3.1](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.3.0...devproxy-v0.3.1) (2026-04-30)

### Bug Fixes

- sync cli version ([#7](https://github.com/Maxiviper117/dev-proxy/issues/7)) ([d79e218](https://github.com/Maxiviper117/dev-proxy/commit/d79e21855356a313d25f91572a258fd01d1d098a))

## [0.3.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.2.1...devproxy-v0.3.0) (2026-04-30)

### Features

- add devproxy status ([#5](https://github.com/Maxiviper117/dev-proxy/issues/5)) ([e5f10d8](https://github.com/Maxiviper117/dev-proxy/commit/e5f10d870d5bae435a5bf46064220f795b6d9908))

## [0.2.1](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.2.0...devproxy-v0.2.1) (2026-04-30)

### Bug Fixes

- **release-please:** add missing step ID for release action ([b09ed14](https://github.com/Maxiviper117/dev-proxy/commit/b09ed141a603d5dda5cfc8e79c19b683c871d4dd))

## [0.2.0](https://github.com/Maxiviper117/dev-proxy/compare/devproxy-v0.1.0...devproxy-v0.2.0) (2026-04-30)

### Features

- scaffold DevProxy CLI ([f090ff6](https://github.com/Maxiviper117/dev-proxy/commit/f090ff62aec952c5da2dbdc41272636f78048790))

## Changelog

Release notes are managed by [release-please](https://github.com/googleapis/release-please).
