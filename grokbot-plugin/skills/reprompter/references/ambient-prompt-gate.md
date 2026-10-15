# Ambient Prompt Gate

> Verbatim from root SKILL.md lines 1756-1830. The hook scripts (`scripts/prompt-gate.js`, `scripts/stop-gate.js`) are bundled in `../scripts/`; `/absolute/path/to/skills/reprompter` below is this plugin's `skills/reprompter` directory.

## Ambient Prompt Gate (Claude Code, Codex CLI, and Hermes Agent)

The Ambient Prompt Gate scores every incoming prompt with the same six RePrompter quality dimensions (clarity, specificity, structure, constraints, verifiability, decomposition). It runs as a Claude Code `UserPromptSubmit` hook, a Codex CLI `UserPromptSubmit` hook, or a Hermes Agent `pre_llm_call` hook. It stays silent for slash commands, acknowledgements, short prompts, non-task prompts, concise direct atomic tasks, prompts that already mention reprompting, and prompts above the configured threshold. For task-shaped prompts below threshold, it injects one line of model-facing context suggesting a one-time offer to structure the request via RePrompter before proceeding.

Local-only, nothing ever leaves the machine. The hook NEVER blocks a prompt. It is fail-soft: malformed stdin, unreadable state, telemetry errors, or any internal failure produce empty stdout and exit 0. It never writes prompt text to telemetry or state; telemetry contains only score, weakest dimensions, whether it nudged, the reason, runtime, and a hashed session correlation id. The same script, heuristics, cooldowns, kill switches, and local-only privacy contract apply on all three runtimes.

The Claude Code plugin also registers a `Stop` hook that measures whether a nudged session later accepted the nudge. It reads the local transcript only inside the hook process, derives a boolean, and records at most one `gate_outcome` event per session with `metadata.accepted: true|false`. It never prints output, never exits 2, never blocks stopping, and never persists transcript text. Stop-hook acceptance recording remains Claude Code-only for now.

Recommended Claude Code install: install the plugin. The plugin registers the `/reprompter:reprompter` skill namespace plus both Ambient Prompt Gate hooks automatically:

```text
/plugin marketplace add AytuncYildizli/reprompter
/plugin install reprompter@reprompter
```

For copy-based installs only, add both hooks in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node /absolute/path/to/skills/reprompter/scripts/prompt-gate.js" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node /absolute/path/to/skills/reprompter/scripts/stop-gate.js" } ] }
    ]
  }
}
```

Plugin hooks can still be globally disabled by Claude Code's `disableAllHooks`; use `REPROMPTER_AMBIENT=0` for the granular per-feature off switch while keeping the plugin skill installed.

For Codex CLI copy-based installs, add a hook definition to `~/.codex/hooks.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/skills/reprompter/scripts/prompt-gate.js --format=codex",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Review and trust the hook via `/hooks`. Codex keys trust to the SHA-256 of the hook definition, so editing the command requires re-trusting it. Keep an explicit short timeout; Codex's default hook timeout is much longer than this gate needs. Codex's `[features] hooks = false` disables all hooks; `REPROMPTER_AMBIENT=0` remains the RePrompter-specific off switch.

For Hermes Agent, use a git clone or copied RePrompter checkout that includes `scripts/` (Hermes installs ship no `scripts/` helpers), then add the shell hook in `~/.hermes/config.yaml`:

```yaml
hooks:
  pre_llm_call:
    - command: "node /absolute/path/to/skills/reprompter/scripts/prompt-gate.js --format=hermes"
      timeout: 5
```

Hermes `pre_llm_call` cannot block, which matches this gate's never-block design. Hermes asks for first-use interactive approval per `(event, command)` and persists it to `~/.hermes/shell-hooks-allowlist.json`; non-TTY runs need `HERMES_ACCEPT_HOOKS=1` or `hooks_auto_accept: true`, otherwise the hook may stay unregistered. Malformed output and timeouts are ignored by Hermes.

| Env flag | Values | Effect |
|----------|--------|--------|
| `REPROMPTER_AMBIENT` | `"0"` / unset | Kill switch. `"0"` disables all nudges. |
| `REPROMPTER_AMBIENT_THRESHOLD` | number | Overall score threshold for nudging. Default `5`. |
| `REPROMPTER_AMBIENT_COOLDOWN_MIN` | number | Per-session cooldown after a nudge. Default `15`. |
| `REPROMPTER_TELEMETRY` | `"0"` / unset | `"0"` disables privacy-safe `gate_prompt` and `gate_outcome` telemetry events. |

State lives under the user's cache directory (`$XDG_CACHE_HOME/reprompter/ambient-gate.json`, or `~/.cache/reprompter/ambient-gate.json`) and stores only session ids plus last-nudge timestamps. Telemetry, when enabled, is written under that same cache root, never into the user's project cwd; `gate_outcome` events contain only the accepted boolean.

---
