import assert from "node:assert/strict";
import test from "node:test";
import { analyzePrompt, estimatePromptTokens, highlightedPromptHtml, splitPromptSegments } from "../web/js/analyzer.js";

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
  assert.deepEqual(result.scoreBreakdown, { exact: 20, semantic: 12, repeatedWords: 0 });
  assert.equal(result.score, 32);
});

test("reports a conservative token estimate", () => {
  assert.equal(estimatePromptTokens(""), 0);
  assert.ok(estimatePromptTokens("a cinematic portrait with soft light") >= 6);
});
