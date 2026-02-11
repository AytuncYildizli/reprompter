# Reprompter v5.1

> Voice-to-prompt engineering for Claude Code. Turn rough, dictated prompts into well-structured, effective prompts with 200-400% quality improvement.

## What is Reprompter?

Reprompter is a [Claude Code skill](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/skills) that transforms messy, hastily-typed, or voice-dictated prompts into polished, well-engineered prompts. It works inside Claude Code as an interactive skill — just say "reprompt" and it guides you through the process.

## Features

### Core
- **Smart Interview** — Interactive questions via `AskUserQuestion` to understand your task
- **Quick Mode** — Auto-detects simple prompts and skips the interview
- **10 Templates** — Feature, bugfix, refactor, testing, API, UI, security, docs, swarm, research
- **Quality Scoring** — 6-dimension before/after comparison (clarity, specificity, structure, constraints, verifiability, decomposition)
- **Project Context Detection** — Auto-detects tech stack from your working directory

### v5.0 — Team-Aware Execution
- **Execution Mode** — Single agent or team (parallel/sequential)
- **Auto-detect Complexity** — Recommends team execution for multi-system tasks
- **Team Brief Generation** — Produces coordination docs with per-agent sub-prompts
- **Decomposition Scoring** — Measures how well tasks are split for parallel work

### v5.1 — Modern Prompt Engineering
- **Think Tool Support** — Claude 4.x's dedicated reasoning tool alongside XML `<thinking>` tags
- **Context Engineering** — Prompts that complement (not duplicate) system context
- **Extended Thinking Guidance** — Adapts prompts for models with extended thinking enabled
- **Response Prefilling** — Suggested assistant prefills for API users
- **Uncertainty Handling** — Explicit permission for the model to express doubt
- **Motivation Capture** — Interview question for task priority/context

## Installation

### Claude Code (recommended)

Copy the `reprompter` folder into your project's skills directory:

```bash
# From your project root
mkdir -p skills/reprompter
cp -r /path/to/reprompter/* skills/reprompter/
```

Claude Code will auto-discover the skill from `skills/reprompter/SKILL.md`.

### OpenClaw

Copy to your OpenClaw workspace skills:

```bash
cp -r /path/to/reprompter ~/your-workspace/skills/reprompter
```

## Usage

In Claude Code, just say any of these:
- `"reprompt"` or `"reprompter"`
- `"reprompt this: [your rough text]"`
- `"clean up this prompt"`
- `"structure my prompt"`

### Example

**Input:**
> "uh we need some kind of auth thing, maybe oauth, users should sign in"

**Output:**
```xml
<role>
Senior full-stack developer specializing in authentication systems and OAuth 2.0
</role>

<context>
Framework: Next.js 14 with App Router (detected from ./package.json)
Current auth: None
</context>

<task>
Implement OAuth authentication with Google and GitHub providers,
including session management and protected route middleware.
</task>

<requirements>
1. Google OAuth 2.0 + GitHub OAuth sign-in
2. Secure session tokens with persistence across reloads
3. Protected route middleware with redirect to login
4. Logout functionality
</requirements>

<constraints>
- Use established auth library (NextAuth.js or similar)
- No sensitive tokens in localStorage
- Credentials in environment variables only
</constraints>

<success_criteria>
- Users can sign in with Google and GitHub
- Sessions persist across browser refresh
- Protected pages redirect unauthenticated users
- Logout clears session completely
</success_criteria>
```

**Quality:** 0.8/10 → 9.0/10 (+1025% improvement)

## Templates

| Template | Use Case |
|----------|----------|
| `feature-template` | Building new functionality |
| `bugfix-template` | Debugging and fixing issues |
| `refactor-template` | Improving existing code |
| `testing-template` | Writing tests |
| `api-template` | API design and implementation |
| `ui-component-template` | Frontend components |
| `security-template` | Security audits and hardening |
| `documentation-template` | Writing docs |
| `swarm-template` | Multi-agent coordination |
| `research-template` | Research and analysis |
| `team-brief-template` | Team execution briefs (v5.0+) |

## Quality Dimensions

| Dimension | Weight | What it measures |
|-----------|--------|------------------|
| Clarity | 20% | Is the task unambiguous? |
| Specificity | 20% | Are requirements concrete? |
| Structure | 15% | Proper sections and flow? |
| Constraints | 15% | Boundaries defined? |
| Verifiability | 15% | Can success be measured? |
| Decomposition | 15% | Task split quality? |

## License

MIT

## Credits

Built for [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code) and [OpenClaw](https://github.com/openclaw/openclaw).
