# Map and analysis format

Read when generating maps or changing their schema. Section names below describe the roles; translate prose/headings into the user's language while keeping paths and identifiers unchanged.

## CODEMAP.md

```yaml
---
mode: maintenance
commit: abc1234f
ignore: See Scope and Exclusions
generated_at: YYYY-MM-DD
stats:
  total_files: 114
  total_lines: 18200
  total_size: 4.2 MB
---
```

Use `mode: learning` for study maps and omit `commit`. `commit` records the base revision, not proof of a clean worktree. `ignore` and `stats` belong to root only; date and measurements describe the actual generation.

Use this section order, omitting empty sections except the root scope record:

| Section | Placement | Columns / content |
| --- | --- | --- |
| Summary | Every map | One sentence about this directory |
| Scope and Exclusions | Root | Path / pattern · Treatment · Reason / basis |
| Task Guide | Every functional map | Task · Domain · Target · Also Check |
| Subdirectories | Maps with included children | Dir · Domain · Depends On · Purpose |
| Key Exports | Where cross-directory users need entry points | Symbol · Source · Line |
| Files | Maps with included immediate files | File · Domain · Deps (if useful) · Function |
| File Dependencies | Where same-directory relationships help | File · Imports (in-dir) · Exposed To (in-dir) |

A container with no immediate source files needs Summary, Task Guide and Subdirectories; root also records scope. Excluded and boundary-only interiors need no maps.

### Scope and Exclusions

Patterns are root-relative. Treatment is **Excluded** or **Boundary only**. For the latter, mark the retained Subdirectories entry **Internals not indexed**. Group routine defaults and `.gitignore` by their rule sources; name project-specific omissions, reasons and included exceptions. Root is the single authoritative scope record.

### Task Guide and domains

Use concrete study/modification scenarios. **Target** names the primary read set; **Also Check** lists short conditional candidates, using the navigation gates in SKILL.md. Cover functional subdirectories and common tasks; missing scenarios fall back to Domain and Key Exports.

Domains identify meaningful functional areas and agree with local Files/Subdirectories values. Mark trivial re-exports with `—` where no domain helps. A large flat directory may group Files rows by domain.

### Canonical inventory and exports

Files/Subdirectories hold one row per included immediate entity. Preserve pure re-export files. Describe responsibilities in one concise sentence; large-file rows link their companion analysis. Parent inventories contain child routes rather than child files or symbols.

Key Exports is a selective view of immediate-source symbols used from other directories. Use `L:<number>` locations and keep the important entry points, typically about 15 or fewer. Navigation references do not replace canonical inventory rows.

### Dependencies

Subdirectories uses directory-level internal/external dependencies. File Dependencies contains only relationships between immediate files in the same directory. Cross-directory relationships belong to Files **Deps**:

- `← path`: a file this source imports.
- `→ path`: a consumer of this source.
- More than five consumers: use a count and scoped search command, e.g. `→ N files (foundational); rg -l "SymbolName" src`.
- Omit the Deps column when it adds no cross-directory information; use `—` for empty cells otherwise. Escape literal pipes inside Markdown cells.

Consumers may span domains; inspect them when public contract changes justify it. Lists and search commands must match current source and configuration.

## Large-file companion

Place `<filename>.analysis.md` beside source files over 1000 lines within the agreed analysis coverage:

```markdown
---
source: filename.py
lines: 1842
generated_at: YYYY-MM-DD
---

> One-sentence summary.

## Feature Index

| Intent | Lines | Notes |
| --- | --- | --- |

## Symbols

| Symbol | Type | Line |
| --- | --- | --- |

## Logical Sections

| Lines | Content |
| --- | --- |
```

Feature Index maps concrete intents to current line ranges; Notes describe same-file coupling. Symbols lists useful top-level public classes, functions and constants. Logical Sections provides about 5–10 broad segments as fallback. Add Class Hierarchy only when depth greater than two helps navigation. Keep analysis focused on location and intent; omit code snippets and duplicated implementation/API descriptions.
