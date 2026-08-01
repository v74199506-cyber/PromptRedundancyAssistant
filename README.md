# Prompt Redundancy Assistant for ComfyUI

An always-on, lightweight ComfyUI frontend extension that watches prompt fields, detects unnecessary repetition, and offers contextual suggestions without adding a node to the workflow.

It stays out of the way until it finds something useful. There are no visible workflow nodes, API calls, telemetry, model downloads, or third-party runtime dependencies.

## What it does

- Watches likely prompt and multiline text widgets across ComfyUI nodes.
- Adds a small `✦ score` badge only to nodes whose editable prompt contains redundancy.
- Shows a discreet `Prompt help` pill while you edit a redundant multiline prompt.
- Opens a contextual panel with highlighted terms and practical suggestions.
- Offers user-initiated buttons to copy a cleaned prompt or remove exact duplicates.
- Never rewrites or changes a prompt automatically.
- Works with positive prompts, negative prompts, CLIP text nodes, primitive strings, and prompt fields provided by many custom nodes.

Highlight colors:

- Yellow: an exact repeated comma-separated concept.
- Purple: conservative meaning overlap, such as `masterpiece` with `best quality`.
- Blue: an ordinary word repeated at least the configured number of times.

## Installation

From `ComfyUI/custom_nodes`:

```bash
git clone https://github.com/v74199506-cyber/ComfyUI-Prompt-Redundancy-Highlighter.git
```

Restart ComfyUI and refresh the browser. Nothing needs to be added to the canvas.

For a ZIP installation, extract the repository directly inside `ComfyUI/custom_nodes`. The resulting folder must contain `__init__.py` and `web` directly, without an additional nested repository folder.

## Usage

Continue building workflows normally. When an editable prompt has a meaningful repetition:

1. A small score appears in the title area of that node.
2. Click the score to inspect the highlighted prompt and suggestions.
3. Optionally copy the cleaned version or remove only exact duplicate concepts.

While editing a multiline text box, the contextual helper appears near the field when an issue is detected.

Example:

```text
masterpiece, best quality, portrait, portrait, highly detailed, ultra detailed, soft window light
```

The assistant identifies the repeated `portrait`, suggests choosing fewer overlapping quality/detail terms, and offers this exact-duplicate cleanup:

```text
masterpiece, best quality, portrait, highly detailed, ultra detailed, soft window light
```

Semantic terms are suggestions only. They are never removed automatically.

## Settings

Open ComfyUI Settings and search for `PromptRedundancyAssistant` or `Prompt Assistant`.

Available settings:

- Enable invisible prompt assistant.
- Show issue badges on prompt nodes.
- Show contextual help while typing.
- Detect overlapping meaning groups.
- Repeated-word threshold, from 2 to 10.

The extension itself can also be disabled from ComfyUI's Extensions settings panel. A page reload may be required after disabling or enabling a frontend extension.

## Important limitations

- The assistant can inspect editable widget text. It cannot see a prompt that exists only at runtime, such as an LLM-generated string arriving through a connection, until that text is displayed in an editable widget.
- Suggestions are general prompt-quality guidance. The checkpoint author's prompting recommendations should take priority.
- Repetition can be intentional. Cleanup is always initiated by the user.
- Version 2.0 is frontend-only. It intentionally registers no workflow node.

## Privacy and performance

Analysis runs locally in the browser with small deterministic JavaScript rules. The extension does not send text anywhere, load an AI model, inspect saved images, or change workflow execution.

Results are cached per node and prompt value so unchanged prompts are not repeatedly re-analyzed.