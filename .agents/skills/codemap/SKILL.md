---
name: codemap
description: Use when indexing a codebase for agent navigation, generating or refreshing CODEMAP.md files, mapping large project structure, or adding CODEMAP guidance for learning/maintenance workflows.
---

# CODEMAP

Maintain hierarchical navigation maps so agents reach relevant code through **Task Guide → Domain → targeted reads**. Keep one current map per indexed directory and use `<filename>.analysis.md` for files over 1000 lines. Generated prose follows the user's language; identifiers and paths retain their spelling.

## Mode and responsibility

- **Learning**: source remains read-only; maps guide study.
- **Maintenance**: preserve existing scope, format and navigation settings; update only affected maps and routes. Infer the mode from the task, asking only when the distinction matters and is unresolved.
- This skill owns map structure, scope and navigation. For implementation/test/document retirement, product verification and reviewed-state tracking, use available `$project-maintenance` guidance or the project's existing maintenance workflow. Load only guidance needed for the current task.

## Navigate before reading

1. Start at root Task Guide. A matching **Target** is the initial read set; **Also Check** is conditional on the task, evidence from target code, or public-contract impact.
2. Without a task match, filter by **Domain** and descend through local maps. Maintenance reads outside the chosen domain need a concrete reason; learning may use other domains as study context.
3. For large files, read the matching **Feature Index** line ranges; use **Logical Sections** as fallback. Verify ranges against current source.
4. Read imported code when its contract is needed. Inspect consumers when changing public signatures, return types or semantics. Search and filter large consumer sets before reading; expand dependencies only for a remaining contract gap.
5. Deduplicate and batch independent targeted reads. A missing or stale route calls for a scoped source query and map repair.

## Inventory and scope

Every included immediate source file belongs to exactly one local **Files** row, including pure re-exports; every included immediate child directory belongs to exactly one **Subdirectories** row. Each map describes its own level. Task Guide, exports and dependency links may reference the same entity without creating duplicate ownership. Maps and companion analyses are index artifacts, excluded from recursive source inventory.

Root **Scope and Exclusions** is authoritative: record root-relative paths/patterns, treatment (**Excluded** or **Boundary only**), reason and included exceptions. Boundary-only directories retain one marked route; their interiors need no inventory or child maps. Routine defaults and `.gitignore` may be grouped by identifiable rule source; project-specific omissions need explicit paths and reasons.

Use defaults for VCS/dependency/cache/build directories, logs, lockfiles, minified/binary/assets and IDE files, then apply project and user rules. Include generated code when navigation requires it and mark it generated. Reconsider scope when work touches excluded code or depends on its contract; exclusion supplies no deletion or correctness evidence. Maintenance scan exclusions remain separate from map scope.

Check the working tree both ways: source → map for missing/duplicate ownership; map → source for ghost paths and stale responsibilities, symbols, dependencies or ranges. Scope changes require a current rationale; widening exclusions to conceal omissions does not complete maintenance.

## Tools and agent judgment

Use Git and `rg` for changes, paths and text candidates. For structural queries or uniform rewrites, use available **ast-grep**; for symbol identity/references, use a configured language server. Check local capabilities before choosing a command. Tools extract facts; the agent decides domains, intent, responsibilities and affected contracts.

Return counts, paths, symbols and necessary ranges before full content. Keep large raw results on the tool side and disclose truncation. Reuse project helpers; a temporary script can normalize a known map format or compare scoped sets. Unknown formats and read/parse errors must remain visible. Text/AST matches alone cannot prove retirement or a complete call graph.

## Create or update maps

- New maps: read lightweight project context (README or package metadata), collect filtered topology and source sizes with tools, then inspect only code needed to establish responsibilities. Mark unverified inferences.
- Read [map and analysis format](references/format.md) when generating maps or changing their schema. Existing-format maintenance can use local tables directly.
- Generate maps for fully indexed directories; parent maps route to children without copying child inventories. Monorepos may use package roots and a top-level package index. If many large files need analyses, agree on their coverage when task scope does not resolve it.
- Add/delete/move/rename: update local canonical entries, affected parent routes and Task Guides; remove index artifacts for retired sources/directories. Interface, responsibility or dependency changes also update exports, consumers and large-file ranges.
- Evaluate **addition, deletion and modification** within the authorized maintenance task. Recheck replacement and consumer migration before retiring old paths and exclusive resources. Retained compatibility paths need current consumers/contracts and a checkable removal condition; age or no local text references is insufficient.
- Pure internal equivalent changes may leave maps intact after checking indexed meaning and ranges. Completion reports applicable operations, evidence and remaining gaps; timestamps and successful builds alone do not establish freshness.
- First generation installs one short navigation block following [project protocol](references/protocol.md); later edits update it only when navigation rules change. Preserve other project instructions.

Parallel agents are optional when authorized: assign independent directory ownership and pass only needed context. Use the task's existing configuration; choose delegation when its coordination cost is justified.
