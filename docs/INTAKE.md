# Dependency and reference review

## REA

Reference URL: https://github.com/morluto/rea

Reviewed commit: `499e2f54efc65aff427978613284c3e429398d44`.

The isolated checkout was reviewed without running project scripts, installing dependencies, importing modules, or executing binaries. Microsoft Defender antivirus and real-time protection remained enabled. Canonical ownership matched, the repository was active and unarchived, and the license was MIT.

Three scanner findings were inspected manually:

- `README_fa.md:7`: U+200C is Persian typography in translated documentation.
- `bridge/ghidra/ReaGhidraBridge.java:1666`: the apparent SQL concatenation is an error message, not a query.
- `docs/installation.md:50`: a documented optional shell installer, which was not executed.

REA preparation installs Husky hooks and prepack runs builds. Its lockfile contains optional macOS `fsevents` and `esbuild` install hooks. This review did not certify the full runtime or dependency tree, so REA was not installed or run.

Its documented browser structure, scripts, network, and screenshot observation sequence informs the MVP review. No existing app was specified for replication. The interface is original and does not claim to reproduce a third-party design.

## PDF parser

Dependency: `unpdf@1.8.1`, https://github.com/unjs/unpdf

Reviewed tag commit: `4bc3080080febbcd62ad67d59f43cf535e75c4b7`. Canonical repository, active and unarchived, MIT. The trusted source scan covered 47 text files with zero findings. No lifecycle hooks or runtime dependencies were declared.

The packed artifact was downloaded with scripts disabled. Its 157 archive members contained no unsafe paths, symbolic links, or native binaries. All runtime JavaScript, including the full PDF.js bundle, was statically scanned with zero findings. Registry SHA-512 integrity matched `sha512-xkURhy2SoGpOIH0a1gLHNkASPIQYonadDJs2AQwPEfUakafeD9EA1WTWWsaR++gfTCXJpV27W7tU1nXuk82UKQ==`.

The bundle contains PDF.js 6.1.200, a version listed in [CVE-2026-16633](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j). The [reported exploit chain](https://bugzilla.mozilla.org/show_bug.cgi?id=2055885) requires viewer scripting and annotation-editor DOM behavior. This application admits only core text extraction in a separate bounded process and does not instantiate those viewer paths. Applicability assessment is an inference from the reviewed call path, not a claim that the dependency has no advisories.

Admission requires a 4 MB input cap, a 10-page cap, sequential page extraction, bounded output and concurrency, a parent-enforced timeout, disabled dynamic string code generation, and disabled external resource/font/WASM fetching. V8's old-space cap does not limit total process memory. The server's parser tests and operational boundaries are recorded in `TESTING.md`.

## Mobile packages

Mobile dependencies use the official Expo, React, and React Native projects, React Native Web, and Safe Area Context. Version metadata and lifecycle scripts were inspected before installation. Versions are locked; installation uses `--ignore-scripts`. Expo bundling and checks are invoked deliberately afterward. The actual npm audit result belongs in `TESTING.md`.

The server uses Node HTTP, crypto, and SQLite. AI credentials remain server-side. Coding submissions are reviewed as text and never executed.
# Additional design guidance and final dependency check

Master Repo Use README was inspected at exact commit `4769c456315dae84f03b84b0052d33ae66d7157c`, repository `https://github.com/Charlesganu2004/Master-Repo-Use`. Only its task-relevant design guidance was read; no installer, shipped code, or third-party library from that repository was executed or imported. Existing installed architecture, design, interface, review, and verification skills were used. The supplied local-index benchmark page was fetched as static text and no embedded script was executed.

Final npm audit after Expo dependency alignment and the UUID override reports 15 high-severity transitive dependency entries, 0 moderate, and 0 critical. The remaining roots are the documented `braces` and `node-forge` advisories and affected Expo/Metro build dependencies. Audit recommends incompatible downgrades; those were not applied. This is not a clean dependency audit. Recheck before public deployment and update compatible patched packages when released.

Rechecked October 10, 2026: the audit remains at 15 high and 0 critical. Registry latest versions `braces@3.0.3` and `node-forge@1.4.0` have no compatible patched release for the reported advisories. No override, dependency addition, or incompatible Expo downgrade was applied. Expo's dependency check reports "Dependencies are up to date." See [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
