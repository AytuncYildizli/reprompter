# Contributing to RePrompter

Thanks for your interest in contributing! RePrompter is a prompt engineering skill/tool, so contributions look a bit different from typical code projects.

## Ways to Contribute

### 🐛 Bug Reports
- Found a case where the interview produces bad output? [Open an issue](https://github.com/aytuncyildizli/reprompter/issues/new?template=bug_report.md)
- Include your rough input and the generated output
- Describe what you expected vs. what you got

### 💡 Feature Requests
- New template ideas? Quality dimension suggestions? Interview flow improvements?
- [Open a feature request](https://github.com/aytuncyildizli/reprompter/issues/new?template=feature_request.md)

### 📝 Template Contributions
Templates live in `docs/examples/`. To add one:
1. Fork the repo
2. Create your template in `docs/examples/{type}-template.md` following the Base XML Structure in SKILL.md
3. Add the new type to the Task Types table in SKILL.md (with name, filename, and "Use when")
4. Open a PR with a before/after example

### 📖 Documentation
- README improvements, typo fixes, better examples — always welcome
- If you've used RePrompter in an interesting workflow, share it

## Development Setup

```bash
# Clone
git clone https://github.com/aytuncyildizli/reprompter.git
cd reprompter

# That's it — it's a skill file, not a compiled project
# Test by copying to your Claude Code skills/ directory
cp -R . /path/to/your-project/skills/reprompter/
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-template`)
3. Make your changes
4. Test with at least 3 different rough prompts **and** run the relevant scenarios from `TESTING.md` (minimum: one Quick Mode, one Full Interview, one Repromptception/Team scenario when applicable)
5. Open a PR with:
   - What you changed
   - Before/after examples showing the improvement
   - Which quality dimensions are affected

## Code of Conduct

Be excellent to each other. That's it.

## Questions?

Open an issue or start a discussion. We're friendly.
