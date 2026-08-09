# Prompt Redundancy Assistant for ComfyUI

An always-on, lightweight prompt linter for ComfyUI. It watches editable prompt fields, highlights unnecessary repetition, explains its redundancy score, and offers conservative cleanup without adding a node to the workflow.

There are no API calls, telemetry, model downloads, visible workflow nodes, or third-party runtime dependencies. Analysis happens locally in the browser and a prompt changes only after the user clicks **Apply optimized prompt**.

## Features

- Watches likely prompt and multiline text widgets across ComfyUI nodes.
- Adds a small issue badge only when editable text contains known redundancy.
- Highlights exact duplicates, conservative meaning overlap, and repeated words.
- Explains the score as separate exact, meaning, and repeated-word components.
- Offers a cleaned preview, clipboard copy, direct apply, and **Undo last apply**.
- Preserves paragraph organization when applying an optimized prompt.
- Detects and removes standalone creator handles such as `@chxrrygxg` while leaving emails and prose mentions untouched.
- Detects contradictory standalone hair and eye colors, keeps the first declaration, and removes only the conflicting color from later tags.
- Converts tag lists into compact natural-language captions and captions back into concise tags.
- Detects the current prompt format and always previews a conversion before applying it.
- Keeps up to ten previous applied values per prompt field for the current browser session.
- Preserves weighted groups, LoRA tags, embeddings, wildcards, and ComfyUI control syntax.
- Detects likely positive and negative prompt fields and avoids semantic cleanup of negative prompts.
- Includes General, SDXL, Pony, Illustrious, and Flux analysis profiles.
- Supports a custom comma-separated ignored-term list.
- Shows an optional, explicitly approximate prompt token count.

Highlight colors:

- Yellow: an exact repeated top-level concept.
- Purple: conservative meaning overlap, such as `masterpiece` with `best quality`.
- Blue: an ordinary word repeated at least the configured number of times.
- Red: a standalone creator handle that will be removed by optimization.
- Orange: conflicting hair or eye colors that need resolution.

## Installation

From `ComfyUI/custom_nodes`:

```bash
git clone https://github.com/v74199506-cyber/PromptRedundancyAssistant.git
```

Restart ComfyUI and refresh the browser. Nothing needs to be added to the canvas.

For a ZIP installation, extract the repository directly inside `ComfyUI/custom_nodes`. The resulting folder must contain `__init__.py` and `web` directly, without an extra nested repository folder.

## Usage

Continue building workflows normally. When an editable prompt contains a known repetition:

1. Click the small score badge in the node title area, or the contextual helper beside a multiline field.
2. Review the highlighted prompt, score components, model profile, role, and suggestions.
3. Expand the optimized preview.
4. Copy it or apply it to the current field.
5. Use **Undo last apply** if the change is not useful.

### Tags and caption converter

The assistant is also available on clean prompt fields through the small blue **↔** badge. Open it and choose:

- **Tags → Caption** to turn comma-separated tags into structured natural-language art direction.
- **Caption → Tags** to extract concise comma-separated concepts from prose.

Review the conversion preview, then copy it or click **Apply conversion**. Applying a conversion uses the same session undo history as prompt cleanup. Conversion is deterministic and local; it does not contact an LLM or external service.

Example tags:

```text
Moni, very long black hair, purple eyes, black dress, sitting, rainy street, cinematic lighting
```

Example caption:

```text
Create an image of Moni. The subject has very long black hair and purple eyes. The subject is wearing a black dress. Show the subject sitting. Set the scene on a rainy street. Use cinematic lighting.
```

Example:

```text
masterpiece, best quality, portrait, portrait, highly detailed, ultra detailed, soft window light
```

Conservative result under the General/SDXL profile:

```text
masterpiece, portrait, highly detailed, soft window light
```

Semantic cleanup removes only later isolated tags from a known group. Descriptive phrases and protected ComfyUI syntax remain unchanged.

Paragraphs and line breaks are retained, so prompts organized into subject, appearance, clothing, pose, environment, and style blocks remain organized after cleanup.

## Settings

Open ComfyUI Settings and search for `PromptRedundancyAssistant` or `Prompt Assistant`.

- **Enable invisible prompt assistant**
- **Show issue badges on prompt nodes**
- **Show converter button on clean prompt nodes**
- **Show contextual help while typing**
- **Detect overlapping meaning groups**
- **Repeated-word threshold** (2 to 10)
- **Prompt model profile** (`general`, `sdxl`, `pony`, `illustrious`, or `flux`)
- **Ignored terms** (comma separated)
- **Show approximate token count**

Pony and Illustrious profiles deliberately preserve quality-tag combinations because those model families may depend on them. Flux uses a larger length-warning threshold and reminds users that many Flux workflows use a short or empty negative prompt. These are conservative profiles, not automatic checkpoint detection.

## Score meaning

The displayed value is a **redundancy score**, not an image-quality score:

- 20 points per later exact duplicate.
- 12 points per additional term from a known semantic group.
- 3 points per repeated-word excess above the configured threshold.
- 10 points per standalone creator handle.
- 12 points per detected attribute contradiction.
- Total capped at 100.

A score of zero means only that no configured redundancy rule fired. It does not guarantee a better prompt or image.

## Protected syntax

Cleanup splits only at top-level commas, semicolons, and newlines. It preserves structures such as:

```text
(character, red hair, green eyes:1.2)
{red dress|blue dress}
<lora:model:0.8>
embedding:my_embedding
BREAK
```

Duplicate protected control segments are reported conservatively or left unchanged rather than automatically removed.

## Important limitations

- The extension can inspect editable widget text. It cannot see a value that exists only at runtime, such as an LLM-generated STRING arriving through a connection, until that value appears in an editable widget.
- Semantic groups are small, static English dictionaries. Add legitimate trigger words to the ignored-term setting when necessary.
- Tags/caption conversion is heuristic and English-oriented. It reorganizes prompt concepts but does not replace an LLM translator or guarantee identical model output.
- Contradiction cleanup is deliberately limited to clear standalone hair-color and eye-color tags. Heterochromia and explicit multicolor-hair terms disable the corresponding automatic cleanup.
- The token count is a rough cross-tokenizer estimate. The tokenizer used by the selected model is authoritative.
- Model profiles are selected manually and do not inspect checkpoint internals.
- Repetition may be intentional. The checkpoint or LoRA author's recommendations take priority.
- Version 2.x is frontend-only and intentionally registers no workflow node.

## Privacy and performance

Analysis uses deterministic JavaScript in the browser. The extension does not send prompts anywhere, load an AI model, inspect saved images, or alter workflow execution. Results are cached per node, prompt value, and analysis settings.

## Development and tests

The runtime has no npm or Python dependencies. Node.js is used only for development tests:

```bash
npm test
```

The test suite covers cleanup behavior, protected syntax, ignored terms, model profiles, negative prompts, score breakdown, HTML escaping, and package metadata.

## License

MIT - see [LICENSE](LICENSE).
