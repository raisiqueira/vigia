# Contributing

Thank you for your help. This guide tells you how to set up the project and what we expect in a pull request.

## Set up

You need Node.js 22 or later, pnpm 11, and OpenCode 2.0 or later.

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

## Try your change in OpenCode

1. Run `pnpm build`.
2. Make a test project. It must be a git repository with at least one commit.
3. Add the absolute path of your checkout to `plugins` in the `opencode.jsonc` of the test project.
4. Run `node /path/to/vigia/dist/init.js init --force` in the test project.
5. Run `opencode run --agent vigia "Scan src/"`.

## Project layout

| Path | Contents |
| --- | --- |
| `src/index.ts` | The plugin: tools, skill, and hooks |
| `src/oracles/` | The URL and HTML parser tools |
| `src/findings/` | The finding schema, the store, and the report |
| `src/scope.ts`, `src/orchestration.ts` | The permission hook and the subagent hook |
| `agents/` | The agent prompts that `vigia init` copies |
| `skills/vigia-method/SKILL.md` | The method that all agents load |
| `evals/` | The evaluation runner. See [evals/README.md](evals/README.md). |

## Pull requests

- Add a test for each change in `src/`.
- Run `pnpm typecheck` and `pnpm test` before you open the pull request.
- If you change a prompt in `agents/` or `skills/`, say which scan you ran to check it, and what changed in the result.
- Keep one topic in each pull request.

## Release

Only maintainers release. Each pull request with a change for users adds a line under `## [Unreleased]` in `CHANGELOG.md`.

1. On a clean `main`, run `pnpm release <version>`, for example `pnpm release 0.2.0`. The script moves the Unreleased notes under the new version, sets the version in `package.json`, commits, and makes the tag `v<version>`.
2. Check the commit and the tag. Then push them: `git push origin main v<version>`.
3. The `release` workflow runs the tests and the package checks, publishes to npm with provenance, and creates the GitHub release with the notes from `CHANGELOG.md`. A version with a suffix, such as `0.2.0-beta.1`, gets the npm tag `next` and is marked as a pre-release.

To check a release without publishing, run the `release` workflow by hand from the Actions tab. It does all the checks and an `npm publish --dry-run`. Locally, run `pnpm build && pnpm verify:package`.

## Write simple text

Many users and models read the prompts and the documentation, and many of them are not native English speakers. Write short sentences and use active voice. Use one word for one idea.

## Vulnerability data

- Do not put details of unpublished vulnerabilities in issues, pull requests, or eval cases. Keep those eval cases in `evals/private/`. Git ignores that folder.
- To report a vulnerability in Vigia, see [SECURITY.md](SECURITY.md).
