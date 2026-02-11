---
name: reprompter
description: Transform messy dictated or rough prompts into well-structured, effective prompts. Use when you say "reprompt", "reprompt this", "clean up this prompt", "structure my prompt", "reprompter", or paste rough text and want it refined into a proper prompt with XML tags and best practices.
version: 6.1.2
---

# Reprompter Skill v6.1.2

> **Prompt engineering skill for Claude Code, OpenClaw, and any LLM. Your prompt sucks. Let's fix that.**

## Purpose

Turn rough prompts into well-engineered, structured prompts via smart interview with clickable options.

---

## Process (4 Steps)

### Step 1: Receive Raw Input
Accept the user's rough prompt (dictated, typed messily, or incomplete).

### Step 2: Quick Mode Detection
**Auto-detect simple prompts** (< 20 words, single clear action):
- Skip interview, generate immediately
- User can say "expand" for full interview

**Complex prompts** → proceed to Step 3.

### Step 3: Smart Interview (Using AskUserQuestion)
Use the `AskUserQuestion` tool with multiple-choice options. Batch related questions to minimize back-and-forth.

### Step 4: Generate + Score
Apply the template and show quality improvement metrics. For team modes, generate a team brief and per-agent prompts.

---

## ⚠️ CRITICAL: MUST GENERATE AFTER INTERVIEW

**After AskUserQuestion completes, you MUST immediately:**

1. **Select the appropriate template** based on task type from interview
2. **Generate the full polished prompt** using that template
3. **If Team mode is selected, generate team brief + per-agent sub-prompts** (not a single combined prompt)
4. **Show the quality score** (before/after comparison table)
5. **Ask if user wants to execute or copy** the generated prompt(s)

**DO NOT stop after the interview. The interview is just step 3 - step 4 (generation) is REQUIRED.**

```
❌ WRONG: Ask interview questions → stop
✅ RIGHT: Ask interview questions → generate prompt → show score → offer to execute
```

---

## Smart Interview (AskUserQuestion Integration)

**CRITICAL: Use the `AskUserQuestion` tool instead of free-form questions.**

> **Platform Note:** `AskUserQuestion` is a Claude Code tool. On platforms without this tool, fall back to numbered free-text questions in a single message and ask the user to reply with their choices.

### Interview Questions (Batched)

Ask 2-5 questions maximum using `AskUserQuestion` with options:

```json
{
  "questions": [
    {
      "question": "What type of task is this?",
      "header": "Task Type",
      "options": [
        {"label": "Build Feature", "description": "Create new functionality"},
        {"label": "Fix Bug", "description": "Debug and resolve an issue"},
        {"label": "Refactor", "description": "Improve existing code structure"},
        {"label": "Multi-Agent/Swarm", "description": "Coordinate multiple agents"}
      ],
      "multiSelect": false
    },
    {
      "question": "How should this be executed?",
      "header": "Execution Mode",
      "options": [
        {"label": "Single Agent", "description": "One Claude Code instance handles everything"},
        {"label": "Team (Parallel)", "description": "Split into 2-4 specialized agents working simultaneously"},
        {"label": "Team (Sequential)", "description": "Pipeline: one agent's output feeds the next"},
        {"label": "Let Reprompter decide", "description": "Auto-detect based on complexity"}
      ],
      "multiSelect": false
    },
    {
      "question": "Why does this matter? (helps the model understand priorities)",
      "header": "Motivation",
      "options": [
        {"label": "User-facing feature", "description": "End users will see/use this directly"},
        {"label": "Internal tooling", "description": "For developer/team productivity"},
        {"label": "Bug fix / urgent", "description": "Something is broken and needs fixing"},
        {"label": "Exploration / research", "description": "Investigating options, not committing yet"},
        {"label": "Skip", "description": "No additional context needed"}
      ],
      "multiSelect": false
    },
    {
      "question": "What's the target for this prompt?",
      "header": "Target",
      "options": [
        {"label": "Claude Code (Recommended)", "description": "Main Claude Code agent"},
        {"label": "Subagent/Task", "description": "Spawned agent via Task tool"},
        {"label": "External LLM", "description": "GPT, Gemini, or other API"},
        {"label": "Documentation", "description": "For human readers"}
      ],
      "multiSelect": false
    },
    {
      "question": "Output format preference?",
      "header": "Format",
      "options": [
        {"label": "XML Tags (Recommended)", "description": "Best for Claude, structured parsing"},
        {"label": "Markdown", "description": "Good for docs and readability"},
        {"label": "Plain Text", "description": "Simple, minimal structure"},
        {"label": "JSON", "description": "For programmatic use"}
      ],
      "multiSelect": false
    }
  ]
}
```

#### Auto-Detect Complexity Rules (when user selects "Let Reprompter decide")

| Task Signal | Recommended Execution Mode |
|-------------|----------------------------|
| 2+ distinct systems (frontend + backend, API + dashboard) | **Team (Parallel)** |
| Pipeline work (data fetch → transform → deploy) | **Team (Sequential)** |
| Single file/component change | **Single Agent** |
| Research + implement combination | **Team (Parallel)** (Researcher + Implementer) |
| Cross-layer work (DB + API + UI) | **Team (Parallel)** |
| Task mentions "audit", "review", or "analyze" across multiple areas | **Team (Parallel)** |

### Adaptive Questions (Ask only if needed)

| Question | Ask When |
|----------|----------|
| Task type | Always (first question) |
| Execution mode | Always for non-Quick Mode prompts |
| Motivation (why this matters) | Ask unless user intent/priority is already explicit |
| Target model | Unclear from context |
| Output format | User hasn't specified preference |
| Constraints | Task is open-ended, could go wrong |
| Success criteria | Verification is ambiguous |
| Examples needed | Output format is complex |

### ⚠️ Task-Specific Follow-up Questions (CRITICAL)

**After standard questions, add 1-2 TASK-SPECIFIC questions based on what the prompt mentions.**

This is NOT optional. If the prompt mentions specific systems, features, or integrations, you MUST ask clarifying questions about them.

#### How to Generate Task-Specific Questions

1. **Identify keywords** in the original prompt (systems, features, verbs)
2. **Create options** relevant to THAT specific system/feature
3. **Add to the AskUserQuestion call** alongside standard questions

#### Examples of Task-Specific Questions

**If prompt mentions "telegram":**
```json
{
  "question": "What Telegram features should be included?",
  "header": "Telegram",
  "options": [
    {"label": "Alerts only", "description": "Send notifications when conditions trigger"},
    {"label": "Interactive commands", "description": "Bot responds to user commands"},
    {"label": "Dashboard summaries", "description": "Periodic status reports"},
    {"label": "Trade execution", "description": "Execute actions via Telegram"}
  ],
  "multiSelect": true
}
```

**If prompt mentions "tracking" or "track":**
```json
{
  "question": "What should the tracking system record?",
  "header": "Tracking",
  "options": [
    {"label": "Performance metrics", "description": "Win rate, P&L, returns"},
    {"label": "Signal history", "description": "All generated signals with outcomes"},
    {"label": "Execution logs", "description": "When/what was acted upon"},
    {"label": "Paper vs live", "description": "Simulate without real execution"}
  ],
  "multiSelect": true
}
```

**If prompt mentions "data" or "update":**
```json
{
  "question": "What data sources should be used?",
  "header": "Data",
  "options": [
    {"label": "Fresh/live data", "description": "Fetch latest from APIs"},
    {"label": "Cached data", "description": "Use existing stored data"},
    {"label": "Both with fallback", "description": "Try fresh, fall back to cache"},
    {"label": "Historical backfill", "description": "Include historical data"}
  ],
  "multiSelect": false
}
```

**If prompt mentions "signals" or "alerts":**
```json
{
  "question": "What signal delivery preferences?",
  "header": "Signals",
  "options": [
    {"label": "Real-time push", "description": "Instant notifications"},
    {"label": "Batched summaries", "description": "Periodic digests"},
    {"label": "Threshold-based", "description": "Only above certain confidence"},
    {"label": "All signals logged", "description": "Record all, alert selectively"}
  ],
  "multiSelect": true
}
```

### Interview Question Template (Updated)

```json
{
  "questions": [
    // STANDARD QUESTIONS (always include relevant ones)
    {
      "question": "What type of task is this?",
      "header": "Task Type",
      "options": [...],
      "multiSelect": false
    },
    {
      "question": "How should this be executed?",
      "header": "Execution Mode",
      "options": [...],
      "multiSelect": false
    },
    {
      "question": "Why does this matter? (helps the model understand priorities)",
      "header": "Motivation",
      "options": [...],
      "multiSelect": false
    },
    {
      "question": "Output format preference?",
      "header": "Format",
      "options": [...],
      "multiSelect": false
    },

    // TASK-SPECIFIC QUESTIONS (based on prompt keywords)
    {
      "question": "[Generated based on prompt keywords]",
      "header": "[System/Feature name]",
      "options": [...],  // Relevant to that system
      "multiSelect": true/false
    }
  ]
}
```

### Skip Questions When:
- Context makes answer obvious
- User already provided the information
- Simple prompt (Quick Mode)
- **But NEVER skip task-specific questions for compound prompts**

### Skip Context Detection When:
- User says "no context", "generic", or "manual context"
- Working directory is home (`~`) or root (`/`)
- No recognizable project structure in pwd

### Edge Case Handling

| Edge Case | Behavior |
|-----------|----------|
| **Empty input** | Ask user to provide a prompt. Do not generate. |
| **Non-English input** | Proceed normally; detect language and generate prompt in the same language. |
| **Input contains code blocks** | Treat code as context, not as the prompt itself. Extract intent from surrounding text. |
| **Very long prompts (500+ words)** | Summarize key points, ask user to confirm before generating. Flag as complex. |
| **Conflicting interview choices** | Ask a single clarifying follow-up (e.g., "You chose Bug Fix but also Team Parallel - is this a multi-service bug?"). |

---

## Project-Scoped Context Detection

**Auto-detects tech stack from current working directory (pwd) only. Session-isolated.**

### ⚠️ Context Scope & Isolation (CRITICAL)

**Rules to prevent cross-project contamination:**

| Rule | Description |
|------|-------------|
| **PWD Only** | ONLY scan files in the current working directory |
| **Session Scoped** | Context is tied to this session's working directory |
| **No Parent Scanning** | Never look in parent directories or `~` |
| **No Cross-Project** | Different pwd = completely fresh context |
| **Explicit Source** | Always show where context was detected from |

```
✅ CORRECT: Scan /Users/x/ProjectA/ when pwd is /Users/x/ProjectA/
❌ WRONG: Scan /Users/x/ProjectB/ from ProjectA session
❌ WRONG: Scan /Users/x/ (parent directory)
❌ WRONG: Use cached context from previous project
```

### Opt-Out Keywords

Users can skip auto-detection by saying:
- `"no context"` - Skip all auto-detection
- `"generic"` - Use generic context only
- `"manual context"` - I'll provide context myself

### Auto-Detection (PWD-Scoped)

**Only scan these files IN THE CURRENT WORKING DIRECTORY:**

```markdown
| File | Detect | Include in Context |
|------|--------|-------------------|
| `./package.json` | Framework, dependencies | "Using Next.js 14, React 18, Prisma" |
| `./tsconfig.json` | TypeScript project | "TypeScript project with strict mode" |
| `./prisma/schema.prisma` | Database setup | "Prisma ORM with PostgreSQL" |
| `./.github/workflows/` | CI/CD | "GitHub Actions CI/CD configured" |
| `./tailwind.config.js` | Styling | "Using Tailwind CSS" |
| `./vitest.config.ts` | Testing | "Vitest for unit tests" |
| `./playwright.config.ts` | E2E testing | "Playwright for E2E tests" |
```

**Note the `./` prefix - all paths are relative to pwd.**

### Context Generation (With Source Transparency)

If project files detected, auto-populate WITH source indication:
```xml
<context>
<!-- Auto-detected from: [WORKING_DIRECTORY] -->
<!-- Session: [SESSION_ID] | Cached: [YES/NO] -->
- Framework: [detected] (from ./package.json)
- Language: [detected] (from ./tsconfig.json)
- Database: [detected] (from ./prisma/schema.prisma)
- Testing: [detected] (from ./vitest.config.ts)
- CI/CD: [detected] (from ./.github/workflows/)
- Working directory: [pwd]
</context>
```

### Session Isolation Protocol

```
SESSION START in /ProjectA:
  1. Get working directory from Claude Code env
  2. Scan ONLY /ProjectA/ for config files
  3. Cache detected context for this session
  4. Tag context with source path

SESSION SWITCH to /ProjectB:
  1. Detect new working directory
  2. DISCARD /ProjectA context completely
  3. Fresh scan of /ProjectB/ only
  4. New cache for new session

NEVER:
  - Carry context between different working directories
  - Scan directories outside current pwd
  - Assume context from previous sessions
```

### No Project Detected

If no recognizable project files found in pwd:
1. Note: "No project context detected in [pwd]"
2. Ask user: "What's your tech stack?" OR
3. Use generic context (no framework assumptions)

### Test Scenarios (Verification)

**Scenario 1: Normal Project Detection**
```
pwd: /Users/x/MyNextApp/
Files: package.json (Next.js), tsconfig.json, prisma/schema.prisma

Result: ✅ Detects "Next.js + TypeScript + Prisma"
Context shows: "Auto-detected from: /Users/x/MyNextApp/"
```

**Scenario 2: Session Switch (No Leakage)**
```
Session 1 pwd: /Users/x/ProjectA/ (React app)
Session 2 pwd: /Users/x/ProjectB/ (Python API)

Result: ✅ Session 2 has ZERO knowledge of React/ProjectA
Context shows: "Auto-detected from: /Users/x/ProjectB/"
```

**Scenario 3: Home Directory (No Scanning)**
```
pwd: /Users/x/ (home directory)

Result: ✅ No scanning attempted
Message: "No project context - working directory is home"
```

**Scenario 4: Opt-Out Respected**
```
pwd: /Users/x/MyNextApp/
User says: "reprompt no context - add a button"

Result: ✅ No auto-detection despite project files existing
Context: Generic only
```

---

## Output Templates

### Template Selection

Choose template based on task type detected in interview:

| Task Type | Template | Key Sections |
|-----------|----------|--------------|
| Build Feature | `feature-template` | role, context, task, requirements, constraints, output_format, success_criteria |
| Fix Bug | `bugfix-template` | role, context, symptoms, investigation, constraints, success_criteria |
| Refactor | `refactor-template` | role, context, current_state, target_state, constraints, success_criteria |
| Write Tests | `testing-template` | role, context, coverage_requirements, constraints, output_format |
| API Work | `api-template` | role, context, endpoints, validation, error_handling, success_criteria |
| UI Component | `ui-template` | role, context, component_spec, styling, accessibility, success_criteria |
| Security | `security-template` | role, context, scope, threat_model, constraints, success_criteria |
| Documentation | `docs-template` | role, context, audience, structure, examples, success_criteria |
| Multi-Agent/Swarm | `swarm-template` | role, context, agents, coordination, handoffs, success_criteria |
| Team Execution Brief | `team-brief-template` | overall_task, agent_roles, per_agent_subtasks, coordination_rules, success_criteria |
| Research/Analysis | `research-template` | role, context, questions, thinking, sources, output_format |

See `resources/templates/` for full templates.

**Template Priority (when multiple match):** Most specific template wins. Priority order:
1. `api-template` — if prompt mentions REST, API, endpoints, routes
2. `security-template` — if prompt mentions audit, vulnerability, pentest
3. `ui-template` — if prompt mentions component, UI, frontend, page
4. `testing-template` — if prompt mentions test, coverage, spec
5. `bugfix-template` — if prompt mentions fix, bug, error, debug
6. `refactor-template` — if prompt mentions refactor, clean up, migrate
7. `docs-template` — if prompt mentions docs, documentation, README
8. `research-template` — if prompt mentions research, analyze, compare
9. `swarm-template` — if execution mode is Multi-Agent/Swarm
10. `feature-template` — default fallback for "Build Feature" tasks

### Team Brief Generation (`team-brief-template`)

When execution mode is `Team (Parallel)`, `Team (Sequential)`, or auto-detect resolves to a team mode:

1. Generate a team brief that defines the shared mission and boundaries.
2. Write the brief to: `/tmp/reprompter-brief-{timestamp}.md`
3. Return the file path and include a short summary in chat.

**Template structure:**

```markdown
# Reprompter Team Brief

- Generated: {timestamp}
- Execution Mode: {Team (Parallel)|Team (Sequential)}
- Overall Task: {high-level objective}

## Agent Roles (2-4)
1. **Frontend Agent** - {scope}
2. **Backend Agent** - {scope}
3. **Tests Agent** - {scope}
4. **Research Agent** - {scope}

## Per-Agent Sub-Tasks
### Frontend Agent
- Task(s): {specific deliverables}
- Constraints: {must/must-not}
- Inputs/Dependencies: {what must exist first}

### Backend Agent
- Task(s): {specific deliverables}
- Constraints: {must/must-not}
- Inputs/Dependencies: {what must exist first}

## Coordination Rules
- Shared files/modules: {list}
- Ordering dependencies: {A before B, parallel-safe items}
- Integration checkpoint: {when/how outputs are merged}

## Success Criteria
- Frontend Agent: {measurable outcomes}
- Backend Agent: {measurable outcomes}
- Tests Agent: {measurable outcomes}
- Research Agent: {measurable outcomes}
```

### Per-Agent Sub-Prompt Generation (Team Mode)

When team mode is selected, generate **N sub-prompts** (one per agent) instead of one combined polished prompt.

- N should match the selected plan (2-4 agents).
- Each sub-prompt must use the same XML format (`<role>`, `<context>`, `<task>`, optional `<motivation>`, `<requirements>`, `<constraints>`, optional `<uncertainty_handling>`, `<output_format>`, `<success_criteria>`).
- Scope each sub-prompt strictly to that agent's responsibilities.
- Include coordination context (dependencies, handoff expectations, shared files) in each agent's `<context>` or `<constraints>`.

### agent-teams Skill Integration

When team mode is selected **and user confirms execution**, use the `agent-teams` skill to spawn and coordinate the team.

- Reference: `skills/agent-teams/SKILL.md` (if installed)
- Do not duplicate agent-teams internals in this skill; only hand off with the generated team brief and sub-prompts.

### Default XML Template

```xml
<role>
{Expert role assignment matching task domain - be specific}
</role>

<context>
{Auto-detected + user-provided context}
- Working environment (codebase, tools, frameworks)
- Available resources (files, docs, APIs)
- Current state (what exists, what's broken)
</context>

<task>
{Clear, unambiguous single-sentence task description}
</task>

<motivation>
{Optional: Why this task matters, priority context, user/business impact}
</motivation>

<requirements>
- {Requirement 1 - specific and measurable}
- {Requirement 2}
- {Requirement 3}
</requirements>

<constraints>
- {What NOT to do}
- {Boundaries and limits}
- {Things to preserve/protect}
</constraints>

<uncertainty_handling>
If any requirement is ambiguous or you lack sufficient information to proceed confidently, say so rather than guessing. Ask for clarification on specific points rather than making assumptions.
</uncertainty_handling>

<output_format>
{Based on user's format preference}
- File type (code, markdown, JSON, etc.)
- Structure (list, narrative, diff, etc.)
- Length guidance if relevant
</output_format>

<success_criteria>
{How to verify the output is correct}
- Testable conditions
- Expected behaviors
- Validation steps
</success_criteria>
```

### Extended Thinking Guidance (Claude 4.x)

When extended thinking is enabled, prompts should be **less prescriptive about how** to solve the problem.

- Focus on **what** you want: clear task, requirements, constraints, and success criteria.
- Let the model determine the best execution path.
- Overly detailed step-by-step instructions can reduce performance when extended thinking is active.
- **Tip:** If using extended thinking, remove or soften the `<thinking>` section — the model's own reasoning will often be superior.

### Advanced Sections (Use When Needed)

#### Chain-of-Thought Section
**Use for:** Complex reasoning, multi-step analysis, architectural decisions

The XML `<thinking>` section remains a valid prompting technique:

```xml
<thinking>
Before implementing, analyze:
1. {What needs to be understood first}
2. {Dependencies and implications}
3. {Trade-offs to consider}
Think through each step before writing code.
</thinking>
```

For Claude 4.x models, consider using the dedicated 'think' tool instead of XML thinking tags. The think tool provides a separate reasoning space that doesn't count toward output tokens and produces better results for multi-step reasoning, policy-heavy decisions, and agentic tool-use scenarios.

Reference: https://www.anthropic.com/engineering/claude-think-tool

#### Response Prefilling
**Use for:** Enforcing output format in API workflows

For API users, you can prefill the first tokens of the assistant response to strongly guide output shape.

- Prefill with `{` to force JSON responses.
- Prefill with `## Analysis` to skip generic preambles and start directly in the requested structure.
- This is an API-only technique and is not available in Claude Code interactive mode.
- Reprompter can still generate a **suggested prefill** alongside the prompt for API users.

#### Reference Section (RAG)
**Use for:** Tasks requiring external knowledge, documentation lookup, API specs

```xml
<reference>
Relevant documentation/context:
- {Document 1}: {key points}
- {Document 2}: {key points}
- {API spec}: {relevant endpoints}
Use these references to inform your implementation.
</reference>
```

#### Multi-Agent Coordination Section
**Use for:** Swarm tasks, parallel execution, agent handoffs

```xml
<coordination>
Agent roles:
- {Agent 1}: {responsibility}
- {Agent 2}: {responsibility}

Handoff protocol:
- {When to pass work}
- {What to communicate}
- {Shared memory keys}
</coordination>
```

### Alternative Formats

**Markdown Format:**
```markdown
## Role
[Expert role]

## Context
[Background information]

## Task
[Clear task description]

## Requirements
- Requirement 1
- Requirement 2

## Constraints
- Constraint 1
- Constraint 2

## Expected Output
[Format and structure]

## Success Criteria
- Criterion 1
- Criterion 2
```

**Plain Text Format:**
```
ROLE: [Expert role]

CONTEXT: [Background]

TASK: [Clear task]

REQUIREMENTS:
1. [Requirement 1]
2. [Requirement 2]

CONSTRAINTS:
- [Constraint 1]
- [Constraint 2]

OUTPUT: [Expected format]

SUCCESS: [How to verify]
```

---

## Quality Scoring

**Always show before/after quality metrics:**

### Scoring Dimensions

| Dimension | Weight | Criteria |
|-----------|--------|----------|
| **Clarity** | 20% | Is the task unambiguous? |
| **Specificity** | 20% | Are requirements concrete? |
| **Structure** | 15% | Proper sections, logical flow? |
| **Constraints** | 15% | Boundaries defined? |
| **Verifiability** | 15% | Can success be measured? |
| **Decomposition** | 15% | How well is the task split into parallel sub-tasks? |

### Score Calculation

```
Clarity:       0-10 (vague=1-3, moderate=4-6, clear=7-10)
Specificity:   0-10 (generic=1-3, moderate=4-6, specific=7-10)
Structure:     0-10 (none=1-3, partial=4-6, complete=7-10)
Constraints:   0-10 (none=1-3, some=4-6, comprehensive=7-10)
Verifiability: 0-10 (unclear=1-3, moderate=4-6, testable=7-10)
Decomposition: 0-10 (unclear split=1-3, partial split=4-6, clean independent split=7-10)

Overall = weighted average

Single-agent tasks: score Decomposition on step breakdown quality.
Team tasks: score Decomposition on agent role clarity + sub-task independence.
```

### Display Format

```markdown
## Prompt Quality Score

| Dimension | Before | After | Change |
|-----------|--------|-------|--------|
| Clarity | 3/10 | 9/10 | +200% |
| Specificity | 2/10 | 8/10 | +300% |
| Structure | 1/10 | 10/10 | +900% |
| Constraints | 0/10 | 7/10 | +∞ |
| Verifiability | 2/10 | 8/10 | +300% |
| Decomposition | 0/10 | 8/10 | +∞ |
| **Overall** | **1.45/10** | **8.35/10** | **+476%** |

✅ Prompt improved from Poor to Excellent
```

### Self-Assessment Bias Note

> **Disclosure:** Quality scores are self-assessed by the same model that generates the prompt. This creates an inherent bias toward higher "After" scores. Treat scores as directional indicators of improvement, not absolute quality measures. For objective evaluation, have a different model or human review the generated prompt.

---

## Quick Mode

### Detection Criteria

Enable Quick Mode when ALL of these are true:
- Raw input is < 20 words
- Single clear action verb (add, fix, update, create, delete)
- Single target (one file, one function, one component)
- No ambiguity in scope
- **NO complexity indicators present** (see below)

### ⚠️ Complexity Indicators (FORCE Interview)

**ALWAYS run interview (NOT Quick Mode) if ANY of these are detected, regardless of word count:**

| Indicator | Examples | Why Interview |
|-----------|----------|---------------|
| **Multiple systems** | "telegram AND tracking", "API AND dashboard" | Each system needs clarification |
| **Compound tasks** | "update X and add Y", "change signals with fresh data" | Multiple requirements to specify |
| **Integration work** | "connect A to B", "sync X with Y" | Integration points need definition |
| **State management** | "track", "persist", "remember", "sync" | State scope is ambiguous |
| **"with" clause** | "update X with Y data" | Relationship needs clarification |
| **Vague modifiers** | "better", "improved", "updated", "fresh" | Requires definition |
| **Reference to existing** | "our X", "the current Y", "existing Z" | Context-dependent |

### Quick Detection Logic (Pseudocode)

```python
def count_distinct_systems(prompt: str) -> int:
    """Count mentions of distinct systems/domains in the prompt."""
    systems = [
        "frontend", "backend", "api", "database", "ui", "dashboard",
        "telegram", "webhook", "auth", "payment", "email", "storage",
        "cache", "queue", "cdn", "search", "notification", "analytics",
    ]
    return sum(1 for s in systems if s in prompt.lower())

def should_use_quick_mode(prompt: str) -> bool:
    words = prompt.split()

    # Basic checks
    if len(words) > 20:
        return False  # Too long

    # Complexity indicators that FORCE interview
    complexity_keywords = [
        "and", "plus", "also",  # Compound tasks
        "track", "tracking", "sync", "persist", "remember",  # State
        "our", "existing", "fresh", "updated",  # References (removed "the current" — too many false positives)
        "better", "improved", "enhanced", "optimized",  # Vague
        "integrate", "connect", "combine", "merge",  # Integration
        "dashboard", "system", "platform", "service", "pipeline",  # Broad scope nouns
    ]

    # "build"/"create" only trigger when followed by broad-scope nouns
    broad_scope_patterns = [
        r'\b(build|create)\s+(a\s+)?(dashboard|app|system|platform|service|pipeline|api|backend|frontend)\b',
        r'\bwith\b.*\b(and|plus|also)\b',  # "with" only when connecting multiple items
    ]

    import re
    prompt_lower = prompt.lower()
    for keyword in complexity_keywords:
        if re.search(r'\b' + re.escape(keyword) + r'\b', prompt_lower):
            return False  # Force interview (whole-word match only)

    for pattern in broad_scope_patterns:
        if re.search(pattern, prompt_lower):
            return False  # Broad-scope build/create or compound "with"

    # Count distinct systems/targets mentioned
    system_count = count_distinct_systems(prompt)
    if system_count > 1:
        return False  # Multiple systems = interview

    return True  # Simple enough for Quick Mode
```

### Examples: Quick Mode vs Interview

| Prompt | Mode | Reason |
|--------|------|--------|
| "add a loading spinner" | Quick | Single target, single action |
| "fix the login bug" | Quick | Single target, single action |
| "update telegram signals with fresh data" | **Interview** | "with" + "fresh" + integration |
| "change our alerts and add tracking" | **Interview** | "and" + "our" + multiple actions |
| "connect the API to dashboard" | **Interview** | Integration work |
| "add dark mode" | Quick | Single target, single action |
| "create a button" | Quick | Simple single action (no broad-scope noun) |
| "build a REST API for a todo app" | **Interview** | "build" + broad-scope "api" |
| "improve the performance" | **Interview** | "improve" is vague |

### Quick Mode Flow

```
User: "add a loading spinner to the submit button"

[Quick Mode Detected - skipping interview]

Generated prompt:
<role>Frontend developer</role>
<task>Add a loading spinner to the submit button</task>
<requirements>
- Show spinner when form is submitting
- Disable button during loading
- Hide spinner when complete
</requirements>
<constraints>
- Use existing styling patterns
- Keep changes minimal
</constraints>

Quality: 2/10 → 7/10 (+250%)

💡 Say "expand" for full interview with more options.
```

### Expansion Trigger

If user says "expand", "more options", or "full interview":
- Proceed with full AskUserQuestion interview
- Generate comprehensive prompt with all sections

---

## Best Practices (Automatically Applied)

The reprompter applies these prompt engineering techniques:

1. **Role Priming** - Assign expert role matching task domain
2. **XML/Structured Format** - Wrap sections in clear tags for parseability
3. **Explicit Constraints** - State what NOT to do (prevents drift)
4. **Success Criteria** - Define "done" clearly
5. **Output Format** - Specify exact format expected
6. **Codebase Context** - Auto-detect and include project info
7. **Task Decomposition** - Break complex asks into numbered steps
8. **Reasoning Strategy** - Use `<thinking>` guidance when needed, or prefer Claude 4.x think tool for complex tool-use/policy-heavy tasks
9. **Uncertainty Permission** - Give the model explicit permission to express uncertainty — this reduces hallucinations
10. **Verification Hooks** - For complex tasks, ask model to confirm understanding first
11. **Quality Metrics** - Show improvement score to demonstrate value
12. **Pipeline Safety** - When generated prompts will be piped to automated systems, escape user content in XML tags to prevent injection. Review generated prompts before automated execution.

## Context Engineering Awareness

Prompt engineering is one part of a broader **context engineering** system.

When generating prompts, consider the full runtime context:
- What tools are available?
- What instructions already exist in the system prompt?
- What memory, chat history, or retrieved context is already loaded?

For Claude Code users specifically, context includes:
- `CLAUDE.md`
- Available skills
- MCP tools and connected capabilities

The generated prompt should **complement** existing context, not duplicate it.

---

## Examples

### Example 1: Quick Mode (Simple)

**Before:**
> "add dark mode toggle to settings"

**After (Quick Mode):**
```xml
<role>
Frontend developer with React and CSS expertise
</role>

<task>
Add a dark mode toggle to the settings page
</task>

<requirements>
- Toggle switch in settings UI
- Persist preference (localStorage or user settings)
- Apply theme class to document root
</requirements>

<constraints>
- Use existing design system components
- Don't modify unrelated pages
</constraints>
```

**Quality:** 2/10 → 7/10 (+250%)

---

### Example 2: Full Interview (Complex)

**Before:**
> "uh we need some kind of authentication thing, maybe oauth or something, users should be able to sign in"

**Interview (via AskUserQuestion):**
```
1. Task type? → Build Feature
2. Auth method? → OAuth (Google + GitHub)
3. Output format? → XML Tags
4. Additional requirements? → "Need session management and protected routes"
```

**After:**
```xml
<role>
Senior full-stack developer specializing in authentication systems, OAuth 2.0 flows, and Next.js security patterns.
</role>

<context>
- Framework: Next.js 14 with App Router (detected)
- Current auth: None
- Requirements: Google OAuth, GitHub OAuth, session management
</context>

<task>
Implement OAuth authentication with Google and GitHub providers, including session management and protected route middleware.
</task>

<requirements>
1. OAuth Integration:
   - Google OAuth 2.0 sign-in
   - GitHub OAuth sign-in
   - Proper redirect handling
2. Session Management:
   - Secure session tokens
   - Session persistence across page reloads
   - Logout functionality
3. Protected Routes:
   - Middleware for auth-required pages
   - Redirect unauthenticated users to login
   - Preserve intended destination after login
</requirements>

<constraints>
- Use NextAuth.js or similar established library
- Do not store sensitive tokens in localStorage
- Follow OAuth 2.0 security best practices
- Keep credentials in environment variables
</constraints>

<output_format>
1. Auth configuration files
2. Provider setup (Google, GitHub)
3. Session management hooks
4. Middleware for protected routes
5. Login/logout UI components
</output_format>

<success_criteria>
- Users can sign in with Google
- Users can sign in with GitHub
- Sessions persist across browser refresh
- Protected pages redirect to login when unauthenticated
- Logout clears session completely
</success_criteria>
```

**Quality Score:**

| Dimension | Before | After |
|-----------|--------|-------|
| Clarity | 2/10 | 9/10 |
| Specificity | 1/10 | 9/10 |
| Structure | 0/10 | 10/10 |
| Constraints | 0/10 | 8/10 |
| Verifiability | 1/10 | 9/10 |
| Decomposition | 0/10 | 8/10 |
| **Overall** | **0.75/10** | **8.85/10** |

✅ **+1080% improvement**

---

## Tips for Best Results

- **More context = fewer questions** - Mention tech stack, framework, or files
- **State the "why"** - Even briefly mentioning why helps role assignment
- **Mention constraints early** - "but don't change X" or "keep it simple"
- **Examples are gold** - Even a rough example of desired output helps
- **Say "expand"** - If Quick Mode gives too simple a result
- **Say "quick"** - To skip interview for simple tasks
- **Say "no context"** - To skip auto-detection and use generic context
- **Context is per-project** - Switching directories = fresh context detection

### Cost Estimates (API Calls per Mode)

| Mode | Estimated API Calls | Notes |
|------|-------------------|-------|
| Quick Mode | 1 | Direct generation, no interview |
| Full Interview | 2 | 1 AskUserQuestion + 1 generation |
| Team Mode | 5-8 | Interview + brief + N sub-prompts |
| Team + Closed-Loop + Retry | 8-15 | Full loop with up to 2 retries per agent |

These are approximate. Actual usage depends on interview depth and retry count.

---

## v6.0: Closed-Loop Quality (Execute → Evaluate → Retry)

### Overview
v6.0 adds a **post-execution quality loop**. Instead of just improving prompts, RePrompter now evaluates the output and retries if quality is insufficient.

### How It Works

**Phase 1: IMPROVE** (existing v5.1 behavior)
- Score raw prompt → improve → generate structured prompt
- Auto-detect execution mode (single/team parallel/team sequential)
- Define success criteria from the task

**Phase 2: EXECUTE**
- Route to optimal model: coding → Codex, research → Gemini, analysis → Claude
- Single agent or tmux team based on complexity
- Collect output

**Phase 3: EVALUATE + RETRY**
- Score output against success criteria (0-10)
- Score ≥ 7 → ACCEPT and deliver
- Score 4-6 → RETRY with targeted delta prompt (address specific gaps)
- Score < 4 → RETRY with full rewrite approach
- Max 2 retries (3 total attempts)
- Each retry includes previous output as context + specific gap analysis

### Success Criteria Generation

When generating the improved prompt, also generate machine-checkable success criteria:

```xml
<success_criteria>
  <criterion type="completeness">All 5 requested sections present</criterion>
  <criterion type="accuracy">File paths and function names verified</criterion>
  <criterion type="actionability">Each finding has severity + fix suggestion</criterion>
  <criterion type="quality">Minimum 3 findings per category</criterion>
</success_criteria>
```

### Delta Prompt Pattern

Retries use a delta prompt, not a full re-prompt:

```
Previous attempt scored 5/10.
✅ Good: Sections 1-3 complete, well-structured
❌ Missing: Section 4 empty, Section 5 has only 2 items (need 5+)
❌ Issue: Line references in Section 2 don't match actual file

This retry: Focus on Sections 4 and 5. Verify all line numbers with actual file reads.
Previous output for context:
<previous_output>...</previous_output>
```

### Trigger Words
- "reprompter teams" → full orchestration loop
- "run with quality" → single agent with evaluate+retry
- "smart run" → auto-detect best approach

---

## Test Scenarios

See [TESTING.md](TESTING.md) for full verification scenarios (9 scenarios + anti-pattern examples).
