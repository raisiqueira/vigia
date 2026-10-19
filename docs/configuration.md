# Configuration

Vigia uses the OpenCode configuration. Put the settings in `opencode.jsonc` in your project, or in `~/.config/opencode/opencode.jsonc` for all projects.

## Install the plugin

```jsonc
{
  "plugins": ["opencode-vigia"]
}
```

To use a local checkout, run `pnpm build` in the checkout and use its absolute path:

```jsonc
{
  "plugins": ["/path/to/vigia"]
}
```

Then copy the agents with `npx opencode-vigia init`, or with `node /path/to/vigia/dist/init.js init`. The command does not replace agent files that exist. Use `--force` to replace them, and `--global` to copy them to `~/.config/opencode/agents/`.

## Models

Vigia works with any model that OpenCode supports. It was built for open weights models:

| Model | OpenCode model ID on OpenRouter |
| --- | --- |
| GLM 5.3 | `openrouter/z-ai/glm-5.3` |
| GLM 5.3 Flash | `openrouter/z-ai/glm-5.3-flash` |
| Mistral Large 4 | `openrouter/mistralai/mistral-large-4-0` |

### OpenRouter: pin the host

OpenRouter sends each request for an open weights model to one of many hosts. For GLM 5.3 there are more than 40, and many use 4-bit weights. The hosts parse tool calls in different ways. If a host fails to parse one tool call, the agent turn ends and the scan stops early. A pinned host also sends your code to fewer companies.

This setting pins GLM 5.3 to the host of Z.AI, which makes the model:

```jsonc
{
  "model": "openrouter/z-ai/glm-5.3",
  "providers": {
    "openrouter": {
      "models": {
        "z-ai/glm-5.3": {
          "limit": { "output": 65536 },
          "body": { "provider": { "order": ["z-ai"], "allow_fallbacks": false } }
        }
      }
    }
  }
}
```

- Put `body` on the model, not on the provider. A provider-level `body` also changes the requests for other models, such as the title model, and Z.AI does not serve those models.
- Keep `limit.output`. OpenCode asks for the output limit from the model catalog, which is 256,000 tokens for GLM 5.3. OpenRouter removes each host that allows less output, and Z.AI allows 131,072. Without the lower limit, the request fails with "No endpoints found".
- With `allow_fallbacks: false`, the scan fails when the pinned host is down. It does not move to another host.

### Infron.ai

Infron.ai has an OpenAI-compatible API. Set `INFRON_API_KEY`, and check the model IDs in the [Infron catalog](https://infron.ai/models).

```jsonc
{
  "model": "infron/glm-5.3",
  "providers": {
    "infron": {
      "env": ["INFRON_API_KEY"],
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": { "baseURL": "https://llm.onerouter.pro/v1" },
      "models": {
        "glm-5.3": { "modelID": "z-ai/glm-5.3" }
      }
    }
  }
}
```

### Your own endpoint

Any OpenAI-compatible server works, for example vLLM or SGLang. Use the same form as Infron.ai, with your `baseURL` and model IDs. Use the tool-call parser that the model maker recommends for the server.

## A different model for each agent

The agent files are in `.opencode/agents/`. Add `model` to the frontmatter of an agent. For example, use a smaller model for the hunters:

```markdown
---
description: Reads one area of the code and records possible vulnerabilities as hypotheses
mode: subagent
model: openrouter/z-ai/glm-5.3-flash
...
---
```

## Permissions

By default, OpenCode asks before each shell command of a Vigia agent. The verifier needs shell commands to run its PoCs.

- `opencode run --auto` approves all requests that are not denied. Use it in a container or for code that you trust.
- To approve fewer commands, change the `permissions` list of the verifier in `.opencode/agents/vigia/verifier.md`. The last rule that matches wins.

## Browser tools

OpenCode has `browser_*` tools, but it turns them off by default. When they are on, the verifier can use them for bugs that need a real browser. It uses them only with `localhost`.
