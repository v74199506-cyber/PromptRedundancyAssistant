# Changelog

All notable changes use semantic versioning.

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
