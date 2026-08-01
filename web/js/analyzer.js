export const SEMANTIC_GROUPS = {
  quality: ["masterpiece", "best quality", "high quality", "ultra quality", "premium quality"],
  detail: ["highly detailed", "ultra detailed", "extremely detailed", "intricate details", "fine details"],
  realism: ["photorealistic", "photo realistic", "hyperrealistic", "hyper realistic", "ultra realistic", "lifelike"],
  resolution: ["4k", "8k", "16k", "uhd", "highres", "high res", "absurdres"],
  sharpness: ["sharp focus", "crisp focus", "tack sharp", "razor sharp"],
};

const STOP_WORDS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with", "without",
  "de", "da", "do", "e", "em", "na", "no", "para", "por", "um", "uma", "com", "sem",
]);

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

export function analyzePrompt(prompt, options = {}) {
  const minimumWordRepetitions = Number(options.minimumWordRepetitions || 3);
  const checkSemanticOverlap = options.checkSemanticOverlap !== false;
  const segments = String(prompt || "").split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
  const normalized = segments.map(normalizeSegment);
  const counts = new Map();
  normalized.forEach((part) => counts.set(part, (counts.get(part) || 0) + 1));

  const exact = [...counts.entries()]
    .filter(([term, count]) => term && count > 1)
    .map(([term, count]) => ({ term, count }));

  const lowered = normalizeSegment(prompt);
  const semantic = [];
  if (checkSemanticOverlap) {
    Object.entries(SEMANTIC_GROUPS).forEach(([group, phrases]) => {
      const terms = phrases.filter((phrase) => phraseIsPresent(lowered, phrase));
      if (terms.length > 1) semantic.push({ group, terms });
    });
  }

  const wordCounts = new Map();
  (lowered.match(/[\p{L}\p{N}_'-]+/gu) || []).forEach((word) => {
    if (word.length > 2 && !STOP_WORDS.has(word)) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  });
  const repeatedWords = [...wordCounts.entries()]
    .filter(([, count]) => count >= minimumWordRepetitions)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, count }));

  const seen = new Set();
  const cleanedSegments = segments.filter((segment) => {
    const key = normalizeSegment(segment);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const duplicateInstances = exact.reduce((total, item) => total + item.count - 1, 0);
  const semanticExcess = semantic.reduce((total, item) => total + item.terms.length - 1, 0);
  const wordExcess = repeatedWords.reduce((total, item) => total + item.count - minimumWordRepetitions + 1, 0);
  const score = Math.min(100, duplicateInstances * 20 + semanticExcess * 12 + wordExcess * 3);

  const suggestions = [];
  if (exact.length) suggestions.push("Remove later copies of identical comma-separated concepts.");
  semantic.forEach(({ group, terms }) => suggestions.push(`Choose one strong ${group} term instead of: ${terms.join(", ")}.`));
  if (segments.length > 35) suggestions.push("Shorten the prompt and prioritize subject, composition, lighting, and style.");
  if (!suggestions.length && repeatedWords.length) suggestions.push("Review the highlighted repeated words and keep repetitions only when they add meaning.");

  return {
    prompt: String(prompt || ""),
    segments,
    exact,
    semantic,
    repeatedWords,
    cleanedPrompt: cleanedSegments.join(", "),
    score,
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
