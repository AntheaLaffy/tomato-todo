# Project navigation protocol

Read when first installing the protocol or changing navigation rules. Use `AGENTS.md`, or the project's existing `CLAUDE.md`; create `AGENTS.md` when neither exists. Replace the existing CODEMAP protocol section in place and preserve surrounding instructions. Keep one block, with the selected mode and links to the actual root map.

The following compact block is a template. Set Mode to the selected mode; adjust root paths for package-level maps.

```markdown
## CODEMAP Navigation Protocol

Mode: maintenance. Start navigation at `CODEMAP.md`.

- Match Task Guide first; Target is the initial read set. Also Check requires task relevance, evidence from target code, or public-contract impact.
- Without a match, descend through matching Domain routes and local Task Guides. Maintenance expansion needs a concrete reason.
- For large files, use companion `.analysis.md` Feature Index ranges; Logical Sections is the fallback.
- Read imports for a needed interface contract, consumers for public signature/return/semantics changes. Search and filter large result sets before reading; extend dependencies for unresolved contract gaps.
- Batch independent targeted reads. Verify stale paths/ranges against current source.
- Maintenance evaluates addition, deletion and modification: update affected canonical entries, parent routes, exports and ranges. Check current source ↔ map within root Scope and Exclusions; each included file/directory has one local owner. Excluded/boundary-only interiors follow the declared scope.
- Retire confirmed superseded paths within the authorized task after checking real consumers and replacement; retain compatibility only with a current contract and removal condition. Use the project maintenance workflow for product verification and linked resources.
- Learning keeps source read-only. Report incomplete scope or verification explicitly.
```

This block points agents into current maps. Keep schema details in the skill's format reference and current project scope in the root map.
