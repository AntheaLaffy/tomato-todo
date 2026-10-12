# codemap-skill

[中文](README.md) | **English**

Generate and maintain hierarchical `CODEMAP.md` indexes so agents locate code by task and functional domain. Files over 1000 lines can have `<filename>.analysis.md` companions that map intents to line ranges.

## Usage

Ask a skill-capable agent to “index this project” or “refresh the affected CODEMAPs.” Learning keeps source read-only; maintenance inherits current scope/format and updates maps incrementally. Ask about mode or scope only when unresolved. Parallel agents depend on authorization and actual benefit.

Install the complete folder from the repository root, for example:

```bash
mkdir -p ~/.claude/skills
cp -a codemap ~/.claude/skills/
```

For Codex, the destination can be `~/.codex/skills/`. Keep `references/`; the skill loads format and protocol details when needed.

## Navigation and maintenance

- Match Task Guide Target first. Read Also Check only for task relevance, evidence from current code, or public-contract impact.
- Otherwise descend by Domain; large files use Feature Index line ranges.
- Read imports for a needed interface contract, consumers for public signature/semantics changes. Deduplicate and filter before batch reads.
- Root declares scope, exclusions and boundary-only directories. Included source entities have unique local inventory entries, including re-export files.
- Evaluate addition, deletion and modification after changes. Check responsibilities, interfaces, dependencies and ranges before leaving a map intact. Retirement follows current requirements, replacement and consumer migration evidence.

Git and rg supply changes/text candidates; ast-grep can extract structure or preview uniform rewrites; language servers resolve symbol relationships. Agents judge responsibilities and impact. Keep raw results on the tool side and return paths, lines and necessary snippets first.

## Working with project-maintenance

codemap owns map structure, scope and navigation. project-maintenance owns implementation/test/document/build-route retirement, product verification and reviewed-state tracking. Routine maintenance reuses current maps and loads only task-relevant guidance.

- [Skill entry point](SKILL.md)
- [Map and large-file format](references/format.md)
- [Project navigation protocol](references/protocol.md)

[MIT License](LICENSE)
