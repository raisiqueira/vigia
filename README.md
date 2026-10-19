# Vigia

Vigia is an [OpenCode](https://opencode.ai) plugin that finds, proves, and helps fix security vulnerabilities in web applications. It runs on open weights models, such as GLM 5.3 and Mistral Large 4.

"Vigia" is Portuguese for "lookout".

> [!WARNING]
> Vigia is in early development. It has run end to end on test projects, but not yet on many real projects. Expect changes.

## Why Vigia

Many security tools report every possible bug. Developers get long reports that are mostly noise, and they stop reading them. Vigia follows three rules:

1. **A finding needs proof.** A finding becomes a vulnerability only after a proof of concept (PoC) ran and showed the bug. Until then, it is a hypothesis.
2. **Ask the real parser.** Many web vulnerabilities are parser differentials: a security check reads the input one way, and the browser reads it a different way. Vigia gives the model tools that run the real parsers, so the model does not have to guess.
3. **Keep the code local.** The Vigia agents cannot search the web or contact hosts other than `localhost`. You choose the model provider.

Vigia supports JavaScript, TypeScript, and Python web code.

## Quick start

You need OpenCode 2.0 or later, Node.js 22 or later, and an API key for a model provider, for example [OpenRouter](https://openrouter.ai).

1. Copy the Vigia agents into your project:

   ```sh
   npx opencode-vigia init
   ```

2. Add the plugin and a model to `opencode.jsonc` in your project. Copy the provider settings from [`examples/opencode.jsonc`](examples/opencode.jsonc). The host pin in that file is important. See [Configuration](docs/configuration.md).

   ```jsonc
   {
     "plugins": ["opencode-vigia"],
     "model": "openrouter/z-ai/glm-5.3"
   }
   ```

3. Make sure that your project is a git repository with at least one commit. OpenCode loads project plugins only in that case.

4. Start a scan:

   ```sh
   opencode --agent vigia
   ```

   Then ask, for example, "Scan the project" or "Scan `src/server/`". To run without the interactive interface:

   ```sh
   opencode run --agent vigia --auto "Scan src/"
   ```

   With `--auto`, OpenCode does not ask before it runs PoCs. Read [Safety](#safety) first.

## What you get

Vigia writes its results to `.vigia/` in your project. It does not change your code unless you ask.

```text
.vigia/
├── surface.md          the attack surface map
├── findings/           one JSON file for each finding
├── pocs/<ID>/          the proof of concept for each finding
└── report.md           the report
```

The report lists the proven findings first, with the PoC command, the observed output, a score, and a proposed fix with a regression test. The hypotheses that a PoC could not prove are listed apart, with the reason. Add `.vigia/` to `.gitignore` if you do not want to commit the results.

A summary from a scan of a small test project:

```text
Proven (reproduced, with runnable PoCs):
- VIGIA-002 P1: "http:evil.com" passes the regex (no "//"), and the WHATWG parser reads it as http://evil.com/.
- VIGIA-003 P1: " //evil.com" and "\t//evil.com": the regex cannot see leading whitespace, and the browser removes it.
- VIGIA-001 P1: "/\evil.com": the WHATWG parser reads "\" as "/" for special schemes.
Rejected: 6. No hypotheses remain open.
```

## How it works

The `vigia` agent maps the project. It then starts `vigia/hunter` subagents that find possible bugs, and one `vigia/verifier` subagent for each possible bug. A verifier writes a PoC, runs it, and records the result. See [How it works](docs/how-it-works.md).

## Safety

- Scan only code that you own or have permission to test.
- The verifier runs PoCs on your machine. The scope guard in Vigia is a guard rail, not a sandbox. Scan code that you do not trust in a container.
- The model provider receives the code that the agents read. Choose a provider whose data policy you accept.

See [SECURITY.md](SECURITY.md) to report a vulnerability in Vigia.

## Documentation

- [How it works](docs/how-it-works.md)
- [Configuration](docs/configuration.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Evaluations](evals/README.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) @ Raí Siqueira
