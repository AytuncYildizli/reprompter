# RePrompter Team Execution (Reality-Based)

This document explains what actually works for RePrompter team execution today, what is fragile, and which strategy should be used by default.

**TL;DR:**
- Default to **sessions_spawn (solo agents)** for production reliability.
- Use **Claude Code PTY Agent Teams (tmux)** only when you explicitly need teammate-to-teammate coordination.
- Use **`claude --print --model opus` (single agent)** when you want fastest simple execution and can avoid true team orchestration.

---

## Current Reality (What Works vs What Breaks)

### Works reliably
- Running multiple **independent solo agents in parallel** and merging results in the lead session.
- Single-agent execution with `claude --print --model opus`.
- Interactive Claude Code team sessions in PTY/tmux can start and run.

### Fragile / frequently failing
- Claude Code Agent Teams in `--print` mode (**not supported**).
- PTY/tmux Agent Teams end-to-end reliability (teammates sometimes skip file writes, lead synthesis may be incomplete).
- Teamwide model control (teammates may default to Sonnet even when lead is Opus).
- Enterprise/OAuth billing auth continuity (token expiration can break long runs).

---

## Execution Strategies (Ordered by Reliability)

### 1) sessions_spawn (solo agents) — **DEFAULT / MOST RELIABLE**

Run N independent agents in parallel (OpenClaw `sessions_spawn` pattern), each with a clear scoped task and explicit output file. The lead session waits, reads outputs, and synthesizes the final answer.

### Reliability note
**High** (best current option for reproducible execution).

### When to use
- You need dependable completion over “autonomous collaboration”.
- Tasks can be split into independent workstreams (audit slices, module-level tasks, research tracks).
- You need deterministic artifacts on disk before synthesis.
- You want easier retries per failed slice.

### When NOT to use
- You truly need live teammate-to-teammate negotiation/coordination during execution.
- The task depends on shared evolving state that must be jointly planned in real time.

### Cost estimate
- **Low to Medium** (scales mostly linearly with number of agents).
- Usually cheaper than PTY Agent Teams because each worker prompt is narrow and bounded.

### Practical pattern
1. Lead creates a shared brief file + per-agent task files.
2. Spawn parallel solo sessions (`sessions_spawn`) with strict scope.
3. Each agent writes to a required output path (e.g. `/tmp/run/agent-1.md`).
4. Lead verifies file existence/content.
5. Lead synthesizes final output.

### Why default
- Fewer hidden runtime dependencies.
- Better observability (file-per-agent artifacts).
- Better recovery (rerun only failed slices).

---

### 2) Claude Code PTY Agent Teams (tmux) — **MEDIUM RELIABILITY**

Run interactive Claude Code with PTY (`tmux` or equivalent), enable agent teams, and ask lead to orchestrate teammates.

### Reliability note
**Medium** (works, but brittle in real workloads).

### When to use
- You explicitly need native teammate communication.
- You are experimenting and can supervise execution.
- You can tolerate occasional incomplete writes/synthesis.

### When NOT to use
- Production-critical flows where missing output is unacceptable.
- Unattended automation expecting deterministic file artifacts.
- Tight budget/time windows where reruns are expensive.

### Cost estimate
- **Medium to High** (often higher than sessions_spawn due to orchestration overhead and retries).

### Observed failure modes
- Teammates may report done but not write expected files.
- Lead may fail to synthesize all teammate results.
- Some runs silently degrade quality without hard errors.

### Mitigations (if you must use it)
- Force explicit output contracts (`must write /tmp/...`).
- Add verification step after run (check expected files).
- Add a lead “final synthesis checklist”.
- Keep team size small (2–3) and scope strict.

---

### 3) Claude Code `--print` (single agent) — **FASTEST SINGLE-AGENT FALLBACK**

Use one strong prompt and run:

```bash
claude --print --model opus
```

This is not a true team run. It is a single-agent shortcut that can still solve many “team-like” briefs in one pass.

### Reliability note
**High for single-agent tasks**, but **no real team orchestration**.

### When to use
- You want fastest turnaround.
- Task can be solved by one strong agent pass.
- You want predictable CLI behavior without PTY orchestration complexity.

### When NOT to use
- You need actual teammate spawning/coordination.
- You need independent parallel outputs from multiple workers.

### Cost estimate
- **Low to Medium** (usually cheapest for small/medium tasks).

---

## Execution Strategy Selection (Reliability-First)

1. **sessions_spawn (solo agents)** → default for RePrompter team execution.
2. **PTY Agent Teams (tmux)** → advanced/experimental for collaborative behavior.
3. **`--print` single agent** → fast fallback when true team execution is unnecessary.

---

## Known Issues (Must Be Documented)

1. **Teammate model default may be Sonnet**
   - Even if lead session is Opus, teammate model overrides may not propagate from `settings.json` as expected.

2. **`--print` mode does not support Agent Teams**
   - Agent Teams require interactive PTY; non-interactive print mode cannot run team toolchain.

3. **File-writing reliability is inconsistent in Agent Teams**
   - Teammates may skip expected writes; lead may not fully synthesize.

4. **Billing/Auth fragility**
   - Enterprise OAuth/token expiration can interrupt long or complex runs.

---

## Operational Guardrails

- Always define **required output files** per worker.
- Always run a **post-run verification** step before final synthesis.
- Prefer **narrow scoped prompts** over broad autonomous instructions.
- Add **retry-at-slice-level** for failed agents (not full rerun when possible).

---

## Integration Guidance for RePrompter

When user selects Team mode:
- RePrompter should generate team brief + per-agent prompts as usual.
- Execution default should route to **sessions_spawn**.
- PTY Agent Teams should be labeled **advanced/experimental**.
- If user asks for fastest path or “single pass”, offer `claude --print --model opus` fallback.

This keeps behavior realistic, debuggable, and usable by non-expert users.