import assert from "node:assert/strict";
import test from "node:test";
import { analyzePrompt, highlightedPromptHtml } from "../web/js/analyzer.js";

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
  assert.equal(result.cleanedPrompt, prompt);
  assert.equal(result.semantic[0].group, "quality");
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
