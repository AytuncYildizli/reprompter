# Test Scenarios

Use these to verify RePrompter works correctly after changes.

## Scenario 1: Simple Prompt → Quick Mode
```
Input: "add a logout button"
Expected: Quick Mode activates (no interview)
Reason: Single action, single target, no complexity indicators
```

## Scenario 2: Compound Task → Interview (NOT Quick Mode)
```
Input: "update telegram signals with fresh data"
Expected: Interview runs (NOT Quick Mode)
Reason: "with" + "fresh" + integration = complexity indicators
Questions should include: Task type + data source + signal delivery specifics
```

## Scenario 3: Multiple Systems → Interview with Task-Specific Questions
```
Input: "change our alerts and add tracking"
Expected: Interview with task-specific questions
Reason: "and" + "our" + two distinct systems (alerts + tracking)
Questions should include: Alert preferences + Tracking requirements
```

## Scenario 4: Vague Modifier → Interview
```
Input: "improve the performance"
Expected: Interview runs
Reason: "improve" is vague - needs definition
```

## Scenario 5: Short but Complex → Interview
```
Input: "sync API with dashboard" (5 words)
Expected: Interview runs (NOT Quick Mode)
Reason: Integration work, even though only 5 words
```

## Scenario 6: Team Parallel Auto-Detect
```
Input: "audit our API, dashboard, and DB access patterns"
Interview Choice: Execution Mode → Let Reprompter decide
Expected: Recommends Team (Parallel)
Reason: Audit/analyze across multiple areas + cross-layer scope
Output: team-brief-template + per-agent sub-prompts (2-4 agents)
```

## Scenario 7: Team Sequential Auto-Detect
```
Input: "fetch partner data, normalize it, then deploy the report generator"
Interview Choice: Execution Mode → Let Reprompter decide
Expected: Recommends Team (Sequential)
Reason: Explicit pipeline (fetch → transform → deploy)
Output: Team brief with ordered dependencies and handoffs
```

## Scenario 8: Single Agent Auto-Detect
```
Input: "rename the ProfileCard title prop in one component"
Interview Choice: Execution Mode → Let Reprompter decide
Expected: Recommends Single Agent
Reason: Single-file/component change
Output: One polished prompt, no team brief
```

## Scenario 9: Research + Implement Split
```
Input: "research rate-limit strategies and implement one for our API"
Interview Choice: Execution Mode → Let Reprompter decide
Expected: Recommends Team mode (Researcher + Implementer)
Reason: Combined research + implementation workflow
Output: Team brief + two scoped XML sub-prompts
```

## ❌ Anti-Pattern: False Quick Mode Activation
```
Input: "lets put that a pause and change our telegram signals with updated data"
WRONG: Quick Mode (because counting words)
RIGHT: Interview (detects "and", "our", "with", "updated")
```

This anti-pattern was the bug fixed in v4.1.
