# Publishing checklist

Target release: `2.1.0`

## One-time setup

- Publisher ID: `v74199506-cyber` (do not include `@` in `pyproject.toml`).
- GitHub repository: `https://github.com/v74199506-cyber/PromptRedundancyAssistant`.
- Create a Comfy Registry API key under the `CherryBoyHunter` publisher.
- Add it to the GitHub repository as an Actions secret named `REGISTRY_ACCESS_TOKEN`.

Never commit the Registry key to the repository or paste it into a workflow file.

## Release steps

1. Make the GitHub repository public.
2. Ensure the local source changes are copied into the Git repository.
3. Run `npm test`.
4. Confirm `pyproject.toml` contains a new semantic version and no placeholder.
5. Commit and push the release to `main`.
6. In GitHub, open **Actions > Publish to Comfy Registry > Run workflow**.
7. Confirm the published package page and install it in a clean ComfyUI environment.

The workflow is manual by design, which prevents an ordinary code push from publishing an accidental Registry release.

## Suggested release commit

```text
Release 2.1.0: model profiles, protected syntax, undo, and score details
```

## Suggested release notes

```text
Prompt Redundancy Assistant 2.1.0 adds undo history, explainable redundancy scoring,
manual SDXL/Pony/Illustrious/Flux profiles, ignored terms, negative-prompt handling,
an approximate token-length indicator, and syntax-aware cleanup that protects LoRA,
wildcard, embedding, weighted-group, and control syntax. It remains frontend-only,
local, deterministic, dependency-free, and never edits prompts automatically.
```
