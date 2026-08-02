export const SEMANTIC_GROUPS = {
  quality: ["masterpiece", "best quality", "amazing quality", "high quality", "ultra quality", "premium quality"],
  detail: ["highly detailed", "ultra detailed", "extremely detailed", "intricate details", "fine details"],
  realism: ["photorealistic", "photo realistic", "hyperrealistic", "hyper realistic", "ultra realistic", "lifelike"],
  resolution: ["4k", "8k", "16k", "uhd", "highres", "high res", "absurdres"],
  sharpness: ["sharp focus", "crisp focus", "tack sharp", "razor sharp"],
  lighting: ["cinematic lighting", "dramatic lighting", "movie lighting", "studio lighting"],
};

export const MODEL_PROFILES = {
  general: { label: "General", tokenWarning: 77, excludedGroups: [] },
  sdxl: { label: "SDXL", tokenWarning: 77, excludedGroups: [] },
  pony: { label: "Pony", tokenWarning: 77, excludedGroups: ["quality"] },
  illustrious: { label: "Illustrious", tokenWarning: 77, excludedGroups: ["quality"] },
  flux: { label: "Flux", tokenWarning: 256, excludedGroups: ["quality"] },
};

const STOP_WORDS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with", "without",
  "de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos", "para", "por", "um", "uma", "com", "sem",
]);

function normalizedProfile(profile) {
  const key = String(profile || "general").toLocaleLowerCase();
  return MODEL_PROFILES[key] ? key : "general";
}

function ignoredTerms(value) {
  const terms = Array.isArray(value) ? value : String(value || "").split(/[,;\n]+/);
  return new Set(terms.map(normalizeSegment).filter(Boolean));
}

export function normalizeSegment(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/^[\s([{]+|[\s)\]}]+$/g, "")
    .replace(/\s+/g, " ");
}

function phraseIsPresent(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`, "iu").test(text);
}

/** Split only on top-level separators so ComfyUI weights, wildcards and LoRA syntax survive unchanged. */
export function splitPromptSegments(prompt) {
  const source = String(prompt || "");
  const segments = [];
  let current = "";
  const depth = { "(": 0, "[": 0, "{": 0, "<": 0 };
  const openerFor = { ")": "(", "]": "[", "}": "{", ">": "<" };

  for (const character of source) {
    if (Object.hasOwn(depth, character)) depth[character] += 1;
    else if (Object.hasOwn(openerFor, character)) {
      const opener = openerFor[character];
      depth[opener] = Math.max(0, depth[opener] - 1);
    }

    const topLevel = Object.values(depth).every((value) => value === 0);
    if (topLevel && (character === "," || character === ";" || character === "\n")) {
      if (current.trim()) segments.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

function standaloneTagValue(segment) {
  return normalizeSegment(segment)
    .replace(/^\(+|\)+$/g, "")
    .replace(/:\s*-?\d+(?:\.\d+)?$/, "")
    .trim();
}

function isProtectedControlSegment(segment) {
  const value = String(segment || "").trim();
  return /^<[^>]+>$/.test(value)
    || /^__[^_]+__$/.test(value)
    || /^\{[\s\S]*\}$/.test(value)
    || /^(?:BREAK|AND|AND_SALT)$/i.test(value)
    || /^(?:embedding|textual_inversion):/i.test(value);
}

function wordAnalysisText(prompt) {
  return String(prompt || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/__[^_]+__/g, " ")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/\b(?:BREAK|AND|AND_SALT)\b/g, " ");
}

export function estimatePromptTokens(prompt) {
  const text = String(prompt || "").trim();
  if (!text) return 0;
  const wordsAndPunctuation = text.match(/[\p{L}\p{N}_'-]+|[^\s\p{L}\p{N}_'-]/gu) || [];
  const characterEstimate = Math.ceil(text.length / 4);
  return Math.max(wordsAndPunctuation.length, characterEstimate);
}

function optimizeSegments(segments, exact, semantic, ignored) {
  const exactTerms = new Set(exact.map((item) => item.term));
  const seenExact = new Set();
  const semanticTermToGroup = new Map();
  semantic.forEach(({ group, terms }) => terms.forEach((term) => semanticTermToGroup.set(term, group)));
  const keptSemanticGroups = new Set();
  const removedExact = [];
  const removedSemantic = [];

  const optimized = segments.filter((segment) => {
    const normalized = normalizeSegment(segment);
    if (ignored.has(normalized) || isProtectedControlSegment(segment)) return true;
    if (exactTerms.has(normalized)) {
      if (seenExact.has(normalized)) {
        removedExact.push(segment);
        return false;
      }
      seenExact.add(normalized);
    }

    const standalone = standaloneTagValue(segment);
    const group = semanticTermToGroup.get(standalone);
    if (group) {
      if (keptSemanticGroups.has(group)) {
        removedSemantic.push(segment);
        return false;
      }
      keptSemanticGroups.add(group);
    }
    return true;
  });

  return { optimized, removedExact, removedSemantic };
}

export function analyzePrompt(prompt, options = {}) {
  const minimumWordRepetitions = Number(options.minimumWordRepetitions || 3);
  const checkSemanticOverlap = options.checkSemanticOverlap !== false;
  const profileKey = normalizedProfile(options.modelProfile);
  const profile = MODEL_PROFILES[profileKey];
  const role = String(options.promptRole || "positive").toLocaleLowerCase() === "negative" ? "negative" : "positive";
  const ignored = ignoredTerms(options.ignoredTerms);
  const segments = splitPromptSegments(prompt);
  const normalized = segments.map(normalizeSegment);
  const counts = new Map();
  normalized.forEach((part, index) => {
    if (!part || ignored.has(part) || isProtectedControlSegment(segments[index])) return;
    counts.set(part, (counts.get(part) || 0) + 1);
  });

  const exact = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([term, count]) => ({ term, count }));

  const lowered = normalizeSegment(prompt);
  const semantic = [];
  if (checkSemanticOverlap && role !== "negative") {
    Object.entries(SEMANTIC_GROUPS).forEach(([group, phrases]) => {
      if (profile.excludedGroups.includes(group)) return;
      const terms = phrases.filter((phrase) => !ignored.has(phrase) && phraseIsPresent(lowered, phrase));
      if (terms.length > 1) semantic.push({ group, terms });
    });
  }

  const wordCounts = new Map();
  const wordSource = normalizeSegment(wordAnalysisText(prompt));
  (wordSource.match(/[\p{L}\p{N}_'-]+/gu) || []).forEach((word) => {
    if (word.length > 2 && !STOP_WORDS.has(word) && !ignored.has(word)) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  });
  const repeatedWords = [...wordCounts.entries()]
    .filter(([, count]) => count >= minimumWordRepetitions)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, count }));

  const optimization = optimizeSegments(segments, exact, semantic, ignored);
  const duplicateInstances = exact.reduce((total, item) => total + item.count - 1, 0);
  const semanticExcess = semantic.reduce((total, item) => total + item.terms.length - 1, 0);
  const wordExcess = repeatedWords.reduce((total, item) => total + item.count - minimumWordRepetitions + 1, 0);
  const scoreBreakdown = {
    exact: duplicateInstances * 20,
    semantic: semanticExcess * 12,
    repeatedWords: wordExcess * 3,
  };
  const score = Math.min(100, scoreBreakdown.exact + scoreBreakdown.semantic + scoreBreakdown.repeatedWords);
  const tokenEstimate = estimatePromptTokens(prompt);

  const suggestions = [];
  if (exact.length) suggestions.push("Remove later copies of identical top-level concepts.");
  semantic.forEach(({ group, terms }) => suggestions.push(`Choose one strong ${group} term instead of: ${terms.join(", ")}.`));
  if (segments.length > 35) suggestions.push("Shorten the prompt and prioritize subject, composition, lighting, and style.");
  if (!suggestions.length && repeatedWords.length) suggestions.push("Review repeated words and keep them only when repetition adds meaning.");
  if (tokenEstimate > profile.tokenWarning) {
    suggestions.push(`Approximate length is ${tokenEstimate} tokens; verify truncation with the tokenizer used by ${profile.label}.`);
  }
  if (role === "negative" && segments.length > 25) {
    suggestions.push("This negative prompt is long; test a shorter version because useful negatives depend on the checkpoint.");
  }
  if (profileKey === "flux" && role === "negative" && segments.length > 0) {
    suggestions.push("Many Flux workflows use a short or empty negative prompt; follow the checkpoint guidance.");
  }

  return {
    prompt: String(prompt || ""),
    segments,
    exact,
    semantic,
    repeatedWords,
    cleanedPrompt: optimization.optimized.join(", "),
    optimizedPrompt: optimization.optimized.join(", "),
    removedExact: optimization.removedExact,
    removedSemantic: optimization.removedSemantic,
    score,
    scoreBreakdown,
    tokenEstimate,
    tokenWarning: profile.tokenWarning,
    profile: profileKey,
    profileLabel: profile.label,
    promptRole: role,
    suggestions,
    hasIssues: score > 0,
  };
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

export function highlightedPromptHtml(prompt, analysis) {
  const exactTerms = new Set(analysis.exact.map((item) => item.term));
  const semanticTerms = new Set(analysis.semantic.flatMap((item) => item.terms));
  const repeatedWords = new Set(analysis.repeatedWords.map((item) => item.word));
  const parts = String(prompt || "").split(/([,;\n]+)/);

  return parts.map((part, index) => {
    if (index % 2 === 1) return escapeHtml(part);
    const normalized = normalizeSegment(part);
    if (normalized && exactTerms.has(normalized)) return `<mark class="pra-exact">${escapeHtml(part)}</mark>`;
    if ([...semanticTerms].some((term) => phraseIsPresent(normalized, term))) {
      return `<mark class="pra-semantic">${escapeHtml(part)}</mark>`;
    }
    return part.split(/([\p{L}\p{N}_'-]+)/gu).map((token) => {
      return repeatedWords.has(token.toLocaleLowerCase())
        ? `<mark class="pra-word">${escapeHtml(token)}</mark>`
        : escapeHtml(token);
    }).join("");
  }).join("");
}
