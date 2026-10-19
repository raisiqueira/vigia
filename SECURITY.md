# Security policy

## Supported versions

Vigia is in early development. Security fixes go to the latest release and the `main` branch.

## Report a vulnerability

Report vulnerabilities in Vigia privately through [GitHub Security Advisories](https://github.com/raisiqueira/vigia/security/advisories/new). Do not open a public issue.

Include these items:

- The version of Vigia and of OpenCode.
- The steps to reproduce the problem, and a minimal project if possible.
- The impact that you expect.

We will acknowledge your report within seven days. We will agree on the disclosure date with you before we publish a fix.

## Scope

These are vulnerabilities in Vigia:

- A Vigia tool writes outside `.vigia/` in the scanned project.
- The scope guard lets a Vigia agent fetch or open a host other than `localhost` without a prompt, in the default configuration.
- A Vigia tool runs code from the scanned project. The tools only parse strings. The verifier agent runs PoCs, and that is expected behavior.
- Text in the scanned project makes a Vigia tool do something that the tool description does not allow.

These are not vulnerabilities in Vigia:

- A model that follows instructions in the scanned code (prompt injection) and requests a permitted action. OpenCode asks before shell commands, unless you use `--auto`.
- Results that are wrong: a missed bug or a false positive. Open a normal issue.
- Problems in OpenCode or in a model provider. Report them to that project.

## Security model

- **The scope guard is a guard rail, not a sandbox.** It checks the URLs in permission requests. It cannot see what a PoC program does when it runs.
- **The verifier runs code on your machine.** It writes PoCs and runs them with the shell tool. Scan code that you do not trust in a container or a virtual machine. Do not use `--auto` outside a container.
- **The model provider receives your code.** The agents send the files that they read to the model. Choose a provider and a host whose data policy you accept, or run the model yourself.
- **Scan only code that you own or have permission to test.**
