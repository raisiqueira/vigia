# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- OpenCode 2.0 plugin with the `vigia_url`, `vigia_html`, `vigia_finding_save`, `vigia_finding_list`, and `vigia_report` tools.
- The `vigia-method` skill: stages, places to look in JavaScript, TypeScript, and Python code, PoC rules, and the exploitability score.
- The `vigia`, `vigia/hunter`, and `vigia/verifier` agents, and the `vigia init` command that copies them.
- A scope guard that keeps Vigia agents on `localhost`.
- A hook that runs Vigia subagents in the foreground, so that `opencode run` waits for them.
- An evaluation runner in `evals/`.
