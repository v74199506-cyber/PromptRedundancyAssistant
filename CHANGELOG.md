# Changelog

## 2.2.1 - 2026-08-05

- Fixed **Undo last apply** restoring a stale or whitespace-normalized widget value after format conversion.
- The visible text editor is now the primary source for history snapshots.
- Restoration synchronizes both the ComfyUI widget and its text editor while preserving the original string exactly.

## 2.2.0 - 2026-08-05

- Added an offline, deterministic **Tags → Caption** converter.
- Added an offline, deterministic **Caption → Tags** converter.
- Added automatic prompt-format detection and a visible format indicator.
- Added conversion preview, copy, apply, and undo support without changing prompts automatically.
- Added an optional blue conversion badge to clean prompt nodes, so the assistant remains accessible even when no redundancy is detected.
- Preserved LoRA references, weighted groups, embeddings, wildcards, and control syntax during conversion.
- Added converter regression tests and updated the documentation.

## 2.1.0 - 2026-08-02

- Added a ten-entry per-field undo history for applied cleanup.
- Added explainable score components for exact duplicates, overlapping meaning, and repeated words.
- Added General, SDXL, Pony, Illustrious, and Flux analysis profiles.
- Added user-configurable ignored terms.
- Added positive/negative prompt role detection; semantic cleanup is conservative for negative prompts.
- Resolves DOM-backed text widgets to their owning node when possible so negative-role detection also works in the typing helper.
- Added an explicitly approximate token-length indicator and profile-specific warnings.
- Added syntax-aware top-level parsing that preserves weighted groups, wildcards, LoRA tags, embeddings, and control tokens.
- Expanded the semantic dictionary with a conservative lighting group.
- Added package metadata tests.
- Kept the extension frontend-only, dependency-free, local, and user-controlled.

All notable changes use semantic versioning.

## 2.0.1 - 2026-08-02

- Fixed copying in browsers that deny the modern Clipboard API by adding a local fallback.
- Replaced the misleading exact-only action with **Apply optimized prompt**.
- Added conservative removal of later standalone tags from the same semantic group.
- Added an optimized-prompt preview and visible copy/apply status messages.
- Re-analyzes immediately after applying and displays the score transition.
- Updated repository links to `v74199506-cyber/PromptRedundancyAssistant`.

## 2.0.0 - 2026-08-01

- Rebuilt the project as an always-on frontend extension with no workflow node.
- Added automatic discovery of likely prompt widgets across node types.
- Added compact node badges and contextual help while editing.
- Added a global suggestions panel with safe, user-initiated cleanup and copy actions.
- Added ComfyUI settings for enablement, badges, typing help, semantic overlap, and word thresholds.
- Moved the deterministic analyzer to a reusable JavaScript module with Node.js tests.
- Removed the Python processing node and example workflow because neither is needed by the extension.

## 1.0.0 - 2026-07-31

- Initial release.
- Added live highlighting for exact concepts, overlapping meaning groups, and repeated words.
- Added deterministic exact-duplicate cleanup.
- Added reports, prompt-style suggestions, and a redundancy score.
- Added an example workflow, unit tests, and GitHub/Comfy Registry automation.
