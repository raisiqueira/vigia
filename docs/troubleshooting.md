# Troubleshooting

## The Vigia agent or tools are missing

- Make sure that the project is a git repository with at least one commit. OpenCode does not load project plugins in a repository without commits, and it does not log a message.
- Make sure that the agent files are in `.opencode/agents/`. Run `npx opencode-vigia init`.
- Make sure that your OpenCode configuration files are valid JSONC. OpenCode ignores a file that it cannot parse. Run `opencode run --print-logs --log-level warn "hi"` and look for `configuration normalization diagnostic`.

## The scan stops after the map or in the middle

- **Tool-call parse error.** The model wrote a tool call as text, and the host did not read it as a tool call. The turn ends with `finish: stop`. On OpenRouter, pin the host. See [Configuration](configuration.md#openrouter-pin-the-host).
- **No credits.** Look for "This request would exceed your available credits" in the output.

To see where a scan stopped, export the session:

```sh
opencode session list
opencode session export <session-id> > session.json
```

## "No endpoints found" on OpenRouter

OpenRouter removed every host. Read the error. "Filter by Context Length" usually means that the requested output is larger than the pinned host allows. Set `limit.output` for the model. See [Configuration](configuration.md#openrouter-pin-the-host).

## OpenCode asks before every command

The verifier must run shell commands for its PoCs. Approve them, use `--auto` in a container, or change the permissions of the verifier. See [Configuration](configuration.md#permissions).

## A finding file is damaged

`vigia_finding_list` and `vigia_report` skip a finding file that is not valid JSON, and list it as `unreadable`. Remove the file, or save the finding again.
