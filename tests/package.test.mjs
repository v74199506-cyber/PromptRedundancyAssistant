import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("registry metadata has no publication placeholders", async () => {
  const pyproject = await readFile(new URL("pyproject.toml", projectRoot), "utf8");
  assert.equal(pyproject.includes("YOUR_"), false);
  assert.match(pyproject, /PublisherId\s*=\s*"v74199506-cyber"/);
  assert.match(pyproject, /version\s*=\s*"2\.2\.1"/);
});

test("extension remains frontend-only and dependency-free", async () => {
  const initializer = await readFile(new URL("__init__.py", projectRoot), "utf8");
  const pyproject = await readFile(new URL("pyproject.toml", projectRoot), "utf8");
  assert.match(initializer, /NODE_CLASS_MAPPINGS\s*=\s*\{\}/);
  assert.match(pyproject, /dependencies\s*=\s*\[\]/);
});

test("frontend includes copy fallback, undo, model profiles and format conversion", async () => {
  const frontend = await readFile(new URL("web/js/prompt_redundancy_assistant.js", projectRoot), "utf8");
  assert.match(frontend, /execCommand\("copy"\)/);
  assert.match(frontend, /Undo last apply/);
  assert.match(frontend, /Prompt model profile/);
  assert.match(frontend, /Tags → Caption/);
  assert.match(frontend, /Caption → Tags/);
  assert.match(frontend, /Apply conversion/);
  assert.match(frontend, /Prefer it so undo captures formatting exactly/);
  assert.match(frontend, /Previous prompt restored exactly/);
});
