import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzePrompt,
  captionToTags,
  detectPromptFormat,
  estimatePromptTokens,
  highlightedPromptHtml,
  splitPromptSegments,
  tagsToCaption,
} from "../web/js/analyzer.js";

test("removes only later exact concepts", () => {
  const result = analyzePrompt("portrait, soft light, portrait, blue eyes");
  assert.equal(result.cleanedPrompt, "portrait, soft light, blue eyes");
  assert.deepEqual(result.exact, [{ term: "portrait", count: 2 }]);
});

test("matching is case insensitive", () => {
  assert.equal(analyzePrompt("Portrait, portrait").cleanedPrompt, "Portrait");
});

test("reports semantic overlap without deleting it", () => {
  const prompt = "masterpiece, best quality, portrait";
  const result = analyzePrompt(prompt);
  assert.equal(result.optimizedPrompt, "masterpiece, portrait");
  assert.equal(result.semantic[0].group, "quality");
  assert.deepEqual(result.removedSemantic, ["best quality"]);
});

test("preserves semantic terms embedded in descriptive phrases", () => {
  const prompt = "photorealistic portrait, lifelike skin texture";
  const result = analyzePrompt(prompt);
  assert.equal(result.optimizedPrompt, prompt);
});

test("supports weighted standalone semantic tags", () => {
  const result = analyzePrompt("(masterpiece:1.2), best quality, portrait");
  assert.equal(result.optimizedPrompt, "(masterpiece:1.2), portrait");
});

test("clean prompt has no issue score", () => {
  const result = analyzePrompt("red fox, snowy forest, morning light");
  assert.equal(result.score, 0);
  assert.equal(result.hasIssues, false);
});

test("highlighter escapes user HTML", () => {
  const prompt = "<script>alert(1)</script>, portrait, portrait";
  const result = analyzePrompt(prompt);
  const html = highlightedPromptHtml(prompt, result);
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("&lt;script&gt;"), true);
});

test("semantic analysis can be disabled", () => {
  const result = analyzePrompt("masterpiece, best quality", { checkSemanticOverlap: false });
  assert.equal(result.semantic.length, 0);
});

test("preserves commas inside weighted groups and wildcards", () => {
  const prompt = "(character, red hair, green eyes:1.2), {red dress|blue dress}, portrait, portrait";
  const result = analyzePrompt(prompt);
  assert.deepEqual(splitPromptSegments(prompt), [
    "(character, red hair, green eyes:1.2)",
    "{red dress|blue dress}",
    "portrait",
    "portrait",
  ]);
  assert.equal(result.optimizedPrompt, "(character, red hair, green eyes:1.2), {red dress|blue dress}, portrait");
});

test("never removes LoRA, wildcard or control syntax", () => {
  const prompt = "<lora:add_detail:0.8>, <lora:add_detail:0.8>, __location__, BREAK, portrait";
  const result = analyzePrompt(prompt);
  assert.equal(result.optimizedPrompt, prompt);
  assert.equal(result.exact.length, 0);
});

test("ignored terms do not affect score or cleanup", () => {
  const prompt = "portrait, portrait, portrait";
  const result = analyzePrompt(prompt, { ignoredTerms: "portrait" });
  assert.equal(result.score, 0);
  assert.equal(result.optimizedPrompt, prompt);
});

test("negative prompts skip semantic overlap", () => {
  const result = analyzePrompt("masterpiece, best quality", { promptRole: "negative" });
  assert.equal(result.semantic.length, 0);
  assert.equal(result.promptRole, "negative");
});

test("Pony and Illustrious profiles preserve quality tags", () => {
  for (const modelProfile of ["pony", "illustrious"]) {
    const result = analyzePrompt("masterpiece, best quality, score_9", { modelProfile });
    assert.equal(result.optimizedPrompt, "masterpiece, best quality, score_9");
    assert.equal(result.scoreBreakdown.semantic, 0);
  }
});

test("score includes an explainable breakdown", () => {
  const result = analyzePrompt("portrait, portrait, masterpiece, best quality");
  assert.deepEqual(result.scoreBreakdown, {
    exact: 20, semantic: 12, repeatedWords: 0, creatorTags: 0, contradictions: 0,
  });
  assert.equal(result.score, 32);
});

test("removes standalone creator handles while preserving paragraphs", () => {
  const prompt = "Moni, black hair, @chxrrygxg\n\nblack dress, @another_creator\n\nrainy street";
  const result = analyzePrompt(prompt);
  assert.deepEqual(result.creatorTags, ["@chxrrygxg", "@another_creator"]);
  assert.equal(result.scoreBreakdown.creatorTags, 20);
  assert.equal(result.optimizedPrompt, "Moni, black hair\n\nblack dress\n\nrainy street");
  assert.deepEqual(result.removedCreatorTags, ["@chxrrygxg", "@another_creator"]);
});

test("does not remove email addresses or creator mentions inside prose", () => {
  const prompt = "contact@example.com, artwork inspired by @chxrrygxg";
  const result = analyzePrompt(prompt);
  assert.deepEqual(result.creatorTags, []);
  assert.equal(result.optimizedPrompt, prompt);
});

test("repeated creator handles are not double-counted as exact duplicates", () => {
  const result = analyzePrompt("Moni, @chxrrygxg, @chxrrygxg");
  assert.deepEqual(result.exact, []);
  assert.equal(result.scoreBreakdown.creatorTags, 20);
  assert.equal(result.score, 20);
});

test("reports a conservative token estimate", () => {
  assert.equal(estimatePromptTokens(""), 0);
  assert.ok(estimatePromptTokens("a cinematic portrait with soft light") >= 6);
});

test("detects tag and caption prompt formats", () => {
  assert.equal(detectPromptFormat("Moni, purple eyes, black dress, sitting, rainy street"), "tags");
  assert.equal(detectPromptFormat("Moni is sitting outside in the rain. She is wearing a black dress."), "caption");
  assert.equal(detectPromptFormat(""), "empty");
});

test("converts tags into structured natural-language art direction", () => {
  const result = tagsToCaption("masterpiece, Moni, purple_eyes, black dress, sitting, close-up, rainy street, cinematic lighting");
  assert.match(result, /Create an image of Moni\./);
  assert.match(result, /purple eyes/);
  assert.match(result, /wearing black dress/);
  assert.match(result, /rainy street/);
  assert.match(result, /masterpiece/);
});

test("converts caption prose into concise comma-separated tags", () => {
  const result = captionToTags("Moni has purple eyes and long black hair. She is wearing a black dress while sitting outside in the rain. Use cinematic lighting.");
  assert.match(result, /Moni has purple eyes/);
  assert.match(result, /long black hair/);
  assert.match(result, /black dress/);
  assert.match(result, /sitting outside in rain/);
  assert.match(result, /cinematic lighting/);
});

test("caption conversion removes prose scaffolding from character descriptions", () => {
  const caption = "The character, identified as Taiga Aisu, is depicted in a dynamic, playful pose on the ground, wears a dark blue school uniform with a white collar and a light green ribbon tied at her neck, and has large expressive brown eyes that are looking at the viewer.";
  const result = captionToTags(caption);
  assert.equal(result.includes("The character"), false);
  assert.equal(result.includes("identified as"), false);
  assert.equal(result.includes("is depicted"), false);
  assert.equal(result.includes("wears"), false);
  assert.match(result, /Taiga Aisu/);
  assert.match(result, /dynamic/);
  assert.match(result, /dark blue school uniform/);
  assert.match(result, /light green ribbon tied at her neck/);
  assert.match(result, /large expressive brown eyes/);
  assert.match(result, /looking at viewer/);
});

test("detects and resolves contradictory hair and eye colors", () => {
  const prompt = "Moni, black hair, purple eyes\n\nbrown long hair, large expressive brown eyes, blue jacket";
  const result = analyzePrompt(prompt);
  assert.equal(result.contradictions.length, 2);
  assert.deepEqual(result.contradictions.map((item) => item.label), ["hair color", "eye color"]);
  assert.equal(result.optimizedPrompt, "Moni, black hair, purple eyes\n\nlong hair, large expressive eyes, blue jacket");
  assert.equal(result.scoreBreakdown.contradictions, 24);
  assert.match(result.suggestions.join(" "), /conflicting hair color/);
});

test("heterochromia and multicolored hair disable unsafe color cleanup", () => {
  const prompt = "heterochromia, purple eyes, brown eyes, two-tone hair, black hair, brown hair";
  const result = analyzePrompt(prompt);
  assert.equal(result.contradictions.length, 0);
  assert.equal(result.optimizedPrompt, prompt);
});

test("negative prompts do not auto-resolve color contradictions", () => {
  const prompt = "black hair, brown hair, purple eyes, brown eyes";
  const result = analyzePrompt(prompt, { promptRole: "negative" });
  assert.equal(result.contradictions.length, 0);
  assert.equal(result.optimizedPrompt, prompt);
});

test("format conversion preserves model-control syntax verbatim", () => {
  const controls = ["<lora:cherry:0.8>", "(purple_eyes:1.2)", "__location__", "BREAK"];
  const caption = tagsToCaption(`${controls.join(", ")}, Moni, portrait`);
  const tags = captionToTags(`${controls.join(" ")} Moni is standing in a studio.`);
  controls.forEach((control) => {
    assert.equal(caption.includes(control), true);
    assert.equal(tags.includes(control), true);
  });
});

test("optimization preserves paragraph organization", () => {
  const prompt = [
    "Moni, black hair, black hair, purple eyes",
    "",
    "black dress, black dress, gold choker",
    "",
    "rainy street, cinematic lighting",
  ].join("\n");
  const result = analyzePrompt(prompt);
  assert.equal(result.optimizedPrompt, [
    "Moni, black hair, purple eyes",
    "",
    "black dress, gold choker",
    "",
    "rainy street, cinematic lighting",
  ].join("\n"));
});

test("optimization preserves Windows line endings", () => {
  const prompt = "Moni, portrait, portrait\r\nblack dress\r\nrainy street";
  assert.equal(
    analyzePrompt(prompt).optimizedPrompt,
    "Moni, portrait\r\nblack dress\r\nrainy street",
  );
});
