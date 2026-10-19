# Evaluations

An eval case is a repository at a known vulnerable commit, plus the bugs that a good scan must prove.

## Run a case

```sh
pnpm build
node evals/run.ts prepare evals/private/<case>/case.json
cd evals/private/<case>/work && opencode run --agent vigia --auto "Scan <scope>"
node evals/run.ts score evals/private/<case>/case.json
```

`prepare` does these steps:

1. It copies the files of one commit with `git archive` into `work/`, and makes a new repository with one commit. The agents cannot read later commits, so they cannot learn the fix from a commit message.
2. It writes `opencode.jsonc` with the Vigia plugin, the model, and the host pin for OpenRouter.
3. It copies the Vigia agents and runs the install command of the case.

`score` matches each expected bug with a finding. A finding matches when it has an anchor in one of the expected files and contains the most keywords. One finding matches at most one bug.

## Case file

```json
{
  "name": "example",
  "source": "/path/to/repository",
  "commit": "abc1234",
  "scope": "src",
  "install": "pnpm install --frozen-lockfile",
  "model": "openrouter/z-ai/glm-5.3",
  "expected": [
    { "id": "short-name", "files": ["src/file.ts"], "keywords": ["word", "other word"] }
  ]
}
```

## Measures

- **Recall:** the expected bugs that the scan proved.
- **Missed or rejected:** an expected bug that the verifier rejected is a false negative of the verifier. An expected bug without a finding is a miss of the hunters.
- **Other proven findings:** review each one. It is a new bug or a false positive.
- **Cost and time:** read them from the OpenCode session (`opencode session export`).

## Cases

Keep cases with unpublished vulnerabilities in `evals/private/`. Git ignores that folder. Move a case to `evals/cases/` only after its advisories are published.

## Public cases to add

- Go `html/template` context confusion: CVE-2023-24539 and CVE-2023-24540.
- mustache.js CVE-2015-8862.
- Open redirect and SSRF filters in Python web apps that use `urlsplit`.
