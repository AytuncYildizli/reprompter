# RePrompter team — settings reference

> Part of `reprompter-team` (`../SKILL.md`). Verbatim from root SKILL.md lines 1832-1922.

## Settings (for Repromptverse mode)

> Note: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is an experimental flag that may change in future Claude Code versions. Check [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code) for current status.

In `~/.claude/settings.json`:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "preferences": {
    "teammateMode": "tmux",
    "model": "opus"
  }
}
```

| Setting | Values | Effect |
|---------|--------|--------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `"1"` | Enables agent team spawning |
| `teammateMode` | `"tmux"` / `"default"` | `tmux`: each teammate gets a visible split pane. `default`: teammates run in background |
| `model` | `"opus"` / `"sonnet"` | Teammates default to Haiku. Always set `model: opus` explicitly in your prompt — do not rely on runtime defaults. |

`/goal` preflight on Claude Code requires CLI v2.1.139+ (no config flag needed). `/goal` depends on Claude Code's hooks layer: if `disableAllHooks` or `allowManagedHooksOnly` is set in `settings.json`, `/goal` is unavailable on any version. v2.1.139 silently hung in that case; v2.1.140 surfaces a clear error message instead, but neither version runs `/goal` under hook-blocking settings — you must permit hooks for the lane to work. See the `/goal` preflight lane near the top of this skill for the full Card + command flow.

### Codex CLI

Install the skill under `~/.codex/skills/reprompter/` (same structure as `~/.claude/skills/`). Codex reads config from `~/.codex/config.toml`:

```toml
# ~/.codex/config.toml
model = "gpt-5.4"          # default model for agent runs
approval_policy = "never"  # for interactive Codex TUI only; `codex exec` already defaults to never in headless

[features]
multi_agent = true         # enables native subagents (Option D1, Codex 0.121.0+)
goals = true               # enables /goal preflight flow when the CLI release gates it
codex_hooks = false        # experimental; leave off unless you need hook events

[agents]
max_threads = 6            # concurrent subagent workers (default)
max_depth = 1              # no sub-subagents by default
job_max_runtime_seconds = 1800

[reprompter]
default_mode = "parallel"  # parallel | sequential — Phase 1 picks Option D vs E
artifact_root = "/tmp"     # override if your runtime sandboxes /tmp
```

| Setting | Values | Effect |
|---------|--------|--------|
| `model` | any Codex-supported id | Default model when `--model` is omitted from `codex exec`. |
| `approval_policy` | `"untrusted"` / `"on-request"` / `"never"` | Applies to the interactive Codex TUI. `codex exec` runs headless and defaults to `never`, so Option D2 workers never need this key set. |
| `features.multi_agent` | `true` / `false` | Enables native subagents (Option D1). Default-enabled in current Codex releases (0.121.0+); set explicitly only if your config disabled it. |
| `features.goals` | `true` / `false` | Enables Codex `/goal` when the installed CLI exposes the experimental goals feature. Use RePrompter first, then run its exact `/goal <summary of expanded prompt>` command. Claude Code CLI v2.1.139+ and Hermes Agent expose the same `/goal` surface natively, without a Codex feature flag — see the `/goal` preflight lane near the top of this skill for supported runtimes. |
| `agents.max_threads` | integer, default `6` | Concurrent subagent worker cap. |
| `agents.max_depth` | integer, default `1` | Spawn nesting depth (1 = subagents only, no grandchildren). |
| `reprompter.default_mode` | `"parallel"` / `"sequential"` | Skill-defined hint consumed by Phase 1. |
| `reprompter.artifact_root` | absolute path | Override `/tmp` when needed. |

If Codex CLI is the only runtime available, skip the Claude Code block above — Single and Repromptverse modes do not require Claude Code to be installed.

### Hermes Agent

Install the skill under Hermes' default skill directory. Run this from the parent directory that contains the RePrompter checkout as `reprompter/`:

```bash
mkdir -p ~/.hermes/skills
cp -R reprompter ~/.hermes/skills/
```

Hermes also supports external skill directories through its skills configuration. RePrompter only needs the skill directory to be visible to Hermes; no JS adapter or npm dependency is required.

Useful Hermes config knobs for Repromptverse and `/goal`:

```toml
[delegation]
max_concurrent_children = 3
max_spawn_depth = 1

[goals]
max_turns = 20
```

| Setting | Values | Effect |
|---------|--------|--------|
| `delegation.max_concurrent_children` | integer, default `3` | Max concurrent children for `delegate_task` batch runs (Option G1). Larger teams should split batches or use G2/G3. |
| `delegation.max_spawn_depth` | integer, default `1` | Spawn nesting depth. Keep at 1 for normal Repromptverse so workers do not create uncontrolled subteams. |
| `goals.max_turns` | integer, default `20` | Bounded continuation budget for Hermes `/goal` runs. |

Hermes `/goal` accepts the same `/goal <objective>` command shape used by Codex CLI and Claude Code CLI. For Repromptverse, the native path is Option G: G1 `delegate_task`, G2 shell-level `hermes -z` / `hermes chat -q`, or G3 Kanban when durable orchestration is explicitly requested. See `references/runtime/hermes-agent-runtime.md`.
