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

function creatorHandleValue(segment) {
  const value = standaloneTagValue(segment);
  return /^@[a-z0-9](?:[a-z0-9_.-]{0,62}[a-z0-9_])?$/i.test(value) ? value : "";
}

function isProtectedControlSegment(segment) {
  const value = String(segment || "").trim();
  return /^<[^>]+>$/.test(value)
    || /^__[^_]+__$/.test(value)
    || /^\{[\s\S]*\}$/.test(value)
    || /^(?:BREAK|AND|AND_SALT)$/i.test(value)
    || /^(?:embedding|textual_inversion):/i.test(value);
}

const CONVERTER_CATEGORIES = {
  qualityStyle: /\b(?:masterpiece|quality|aesthetic|detailed|detail|absurdres|highres|photorealistic|realistic|anime|illustration|painting|render|cinematic|lighting|light|shading|texture|focus|bokeh|depth of field|ray tracing|uhd|\d+k)\b/i,
  appearance: /\b(?:hair|eyes?|pupils?|skin|face|lips?|mouth|nose|ears?|body|breasts?|chest|waist|hips?|thighs?|legs?|arms?|hands?|fingers?|nails?|ribs?|navel|teeth|tongue|blush|mascara|eyeshadow|makeup|petite|muscular|slim|curvy|tall|short)\b/i,
  clothing: /\b(?:wearing|clothes?|clothing|outfit|dress|shirt|blouse|skirt|pants|shorts|jacket|coat|uniform|swimsuit|bikini|lingerie|underwear|stockings?|thigh-highs?|shoes?|boots?|heels?|gloves?|collar|choker|hat|costume|armor|jewelry|necklace|earrings?)\b/i,
  poseAction: /\b(?:standing|sitting|kneeling|squatting|lying|walking|running|jumping|leaning|bending|looking|smiling|crying|laughing|begging|holding|touching|reaching|facing|turned|pose|posing|expression|view|from behind|profile)\b/i,
  camera: /\b(?:close[- ]?up|portrait|headshot|cowboy shot|full body|upper body|wide shot|low angle|high angle|from above|from below|camera|lens|framing|composition|cropped|uncropped|foreshortening|perspective)\b/i,
  environment: /\b(?:background|indoors?|outdoors?|room|bedroom|bathroom|street|city|forest|beach|ocean|mountain|garden|restaurant|school|rain|snow|night|day|sunset|sky|window|door|floor|wall|sign|hotel|studio)\b/i,
};

function isConverterControlSegment(segment) {
  const value = String(segment || "").trim();
  return isProtectedControlSegment(value) || /^\([^()]+:\s*-?\d+(?:\.\d+)?\)$/.test(value);
}

function naturalList(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function humanizeTag(segment) {
  const value = String(segment || "").trim();
  if (!value || isConverterControlSegment(value)) return value;
  if (/^(?:score|rating|source|year)_/i.test(value)) return value;
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function converterTagValue(segment) {
  return standaloneTagValue(humanizeTag(segment));
}

function looksLikeSubject(segment, index) {
  const value = converterTagValue(segment);
  if (/^(?:\d+|one|two|three)\s*(?:girls?|boys?|women|men|people|characters?)$/i.test(value)) return true;
  if (/\b(?:woman|man|female|male|character|creature|animal|girl|boy)\b/i.test(value)) return true;
  if (/^[A-Z][\p{L}\p{N}'-]*(?:\s+[A-Z][\p{L}\p{N}'-]*){0,2}$/u.test(String(segment || "").trim())) return true;
  if (Object.values(CONVERTER_CATEGORIES).some((pattern) => pattern.test(value))) return false;
  const words = value.split(/\s+/).filter(Boolean);
  return index === 0 && words.length <= 4 && /^[\p{L}\p{N}_'-]+(?:\s+[\p{L}\p{N}_'-]+){0,3}$/u.test(value);
}

/** Heuristically identify whether a prompt is tag-oriented, prose-oriented, or mixed. */
export function detectPromptFormat(prompt) {
  const text = String(prompt || "").trim();
  if (!text) return "empty";
  const segments = splitPromptSegments(text);
  const commaCount = (text.match(/,/g) || []).length;
  const sentenceCount = (text.match(/[.!?](?:\s|$)/g) || []).length;
  const proseMarkers = (text.match(/\b(?:is|are|was|were|has|have|wearing|while|because|should|there is|there are)\b/gi) || []).length;
  const averageWords = segments.reduce((sum, part) => sum + (part.match(/[\p{L}\p{N}_'-]+/gu) || []).length, 0) / Math.max(segments.length, 1);
  const tagScore = commaCount * 2 + (segments.length >= 4 ? 4 : 0) + (averageWords <= 5 ? 3 : 0);
  const captionScore = sentenceCount * 3 + proseMarkers * 2 + (averageWords >= 9 ? 4 : 0);
  if (tagScore >= captionScore + 3) return "tags";
  if (captionScore >= tagScore + 3) return "caption";
  return "mixed";
}

/** Convert comma-oriented image tags into compact natural-language art direction. */
export function tagsToCaption(prompt) {
  const source = String(prompt || "").trim();
  if (!source) return "";
  const buckets = {
    controls: [], subjects: [], appearance: [], clothing: [], poseAction: [], camera: [], environment: [], qualityStyle: [], details: [],
  };

  splitPromptSegments(source).forEach((rawSegment, index) => {
    const segment = humanizeTag(rawSegment);
    const value = converterTagValue(segment);
    if (!value) return;
    if (isConverterControlSegment(rawSegment)) buckets.controls.push(rawSegment.trim());
    else if (looksLikeSubject(segment, index)) buckets.subjects.push(segment);
    else if (CONVERTER_CATEGORIES.camera.test(value)) buckets.camera.push(segment);
    else if (CONVERTER_CATEGORIES.environment.test(value)) buckets.environment.push(segment);
    else if (CONVERTER_CATEGORIES.clothing.test(value)) buckets.clothing.push(segment.replace(/^wearing\s+/i, ""));
    else if (CONVERTER_CATEGORIES.poseAction.test(value)) buckets.poseAction.push(segment);
    else if (CONVERTER_CATEGORIES.appearance.test(value)) buckets.appearance.push(segment);
    else if (CONVERTER_CATEGORIES.qualityStyle.test(value)) buckets.qualityStyle.push(segment);
    else buckets.details.push(segment);
  });

  const sentences = [];
  if (buckets.subjects.length) sentences.push(`Create an image of ${naturalList(buckets.subjects)}.`);
  else sentences.push("Create an image focused on the requested subject.");
  if (buckets.appearance.length) sentences.push(`The subject has ${naturalList(buckets.appearance)}.`);
  if (buckets.clothing.length) sentences.push(`The subject is wearing ${naturalList(buckets.clothing)}.`);
  if (buckets.poseAction.length) sentences.push(`Show the subject ${naturalList(buckets.poseAction)}.`);
  if (buckets.camera.length) sentences.push(`Frame the scene with ${naturalList(buckets.camera)}.`);
  if (buckets.environment.length) sentences.push(`Set the scene with ${naturalList(buckets.environment)}.`);
  if (buckets.qualityStyle.length) sentences.push(`Use ${naturalList(buckets.qualityStyle)}.`);
  if (buckets.details.length) sentences.push(`Include ${naturalList(buckets.details)}.`);
  const caption = sentences.join(" ").replace(/\s+/g, " ").trim();
  return buckets.controls.length ? `${buckets.controls.join(" ")} ${caption}` : caption;
}

function protectInlineSyntax(text) {
  const controls = [];
  const protect = (match) => {
    const token = `PRACTRL${controls.length}TOKEN`;
    controls.push(match);
    return token;
  };
  const protectedText = String(text || "")
    .replace(/<[^>\n]+>|__[^_\n]+__|\{[^{}\n]*\}|\([^()\n]*:\s*-?\d+(?:\.\d+)?\)|(?:embedding|textual_inversion):[^\s,;]+/gi, protect)
    .replace(/\b(?:BREAK|AND|AND_SALT)\b/g, protect);
  return { protectedText, controls };
}

function restoreInlineSyntax(text, controls) {
  return String(text || "").replace(/PRACTRL(\d+)TOKEN/g, (_, index) => controls[Number(index)] || "");
}

function cleanCaptionFragment(fragment) {
  let value = String(fragment || "").trim();
  if (/^(?:she|he|they|it)\s+(?:is|are|has|have)$/i.test(value)) return "";
  value = value
    .replace(/^(?:please\s+)?(?:create|generate|make|render|depict|show)\s+(?:an?\s+)?(?:image|picture|illustration|photo|scene)\s+(?:of|featuring|with)\s+/i, "")
    .replace(/^(?:the\s+)?(?:image|picture|illustration|photo|scene|style)\s+(?:should\s+be|is|shows?|depicts?)\s+/i, "")
    .replace(/^(?:the\s+)?(?:image|picture|illustration|photo|scene)\s+should\s+/i, "")
    .replace(/^(?:the\s+)?(?:subject|character|person)\s+(?:is|has|should\s+be)\s+/i, "")
    .replace(/^(?:she|he|they|it)\s+(?:is|are|has|have)\s+/i, "")
    .replace(/^(?:she|he|they|it)\s+/i, "")
    .replace(/^wearing\s+(?:an?\s+)?/i, "")
    .replace(/^set\s+(?:the\s+scene\s+)?(?:in|with)\s+/i, "")
    .replace(/^frame\s+(?:the\s+scene\s+)?with\s+/i, "")
    .replace(/^use\s+/i, "")
    .replace(/^include\s+/i, "")
    .replace(/\blooking directly at (?:the )?(?:viewer|camera)\b/gi, "looking at viewer")
    .replace(/\blooks?\s+(sad|happy|angry|tired|afraid|surprised)\b/gi, "$1 expression")
    .replace(/\b(?:capture|show)\s+(?:her|him|them|the subject)\s+entirely\b/gi, "full body")
    .replace(/\bwithout cutting off any limbs\b/gi, "uncropped, complete limbs")
    .replace(/\b(?:a|an|the)\s+/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
  return value;
}

/** Convert prose art direction into concise, comma-separated prompt tags. */
export function captionToTags(prompt) {
  const source = String(prompt || "").trim();
  if (!source) return "";
  const { protectedText, controls } = protectInlineSyntax(source);
  const normalized = protectedText
    .replace(/\bin the style of\s+([^,.!?;]+)/gi, "$1 style")
    .replace(/\b(?:while|as well as|along with|together with|but)\b/gi, ",")
    .replace(/\b(?:and|with)\b/gi, ",")
    .replace(/\bwearing\b/gi, ",")
    .replace(/\b(?:there is|there are)\b/gi, ",");
  const rawFragments = normalized.split(/[,;\n]+|[.!?](?:\s+|$)/g);
  const controlsFound = [];
  const tags = [];
  const seen = new Set();

  rawFragments.forEach((raw) => {
    let fragment = cleanCaptionFragment(raw);
    if (!fragment) return;
    const tokens = fragment.match(/PRACTRL\d+TOKEN/g) || [];
    tokens.forEach((token) => {
      const restored = restoreInlineSyntax(token, controls);
      if (restored && !controlsFound.includes(restored)) controlsFound.push(restored);
      fragment = fragment.replace(token, " ");
    });
    fragment = restoreInlineSyntax(fragment, controls).replace(/\s+/g, " ").trim();
    if (!fragment) return;
    const key = normalizeSegment(fragment);
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(fragment);
    }
  });

  controls.forEach((control) => {
    if (!controlsFound.includes(control)) controlsFound.push(control);
  });
  return [...controlsFound, ...tags].join(", ");
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
  const removedCreatorTags = [];
  const keptIndexes = new Set();

  const optimized = segments.filter((segment, index) => {
    const normalized = normalizeSegment(segment);
    if (ignored.has(normalized) || isProtectedControlSegment(segment)) {
      keptIndexes.add(index);
      return true;
    }
    if (creatorHandleValue(segment)) {
      removedCreatorTags.push(segment);
      return false;
    }
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
    keptIndexes.add(index);
    return true;
  });

  return { optimized, keptIndexes, removedExact, removedSemantic, removedCreatorTags };
}

function splitTopLevelParagraphs(prompt) {
  const source = String(prompt || "");
  const paragraphs = [];
  const depth = { "(": 0, "[": 0, "{": 0, "<": 0 };
  const openerFor = { ")": "(", "]": "[", "}": "{", ">": "<" };
  let current = "";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (Object.hasOwn(depth, character)) depth[character] += 1;
    else if (Object.hasOwn(openerFor, character)) {
      const opener = openerFor[character];
      depth[opener] = Math.max(0, depth[opener] - 1);
    }

    const topLevel = Object.values(depth).every((value) => value === 0);
    if (topLevel && (character === "\n" || character === "\r")) {
      const lineBreak = character === "\r" && source[index + 1] === "\n" ? "\r\n" : character;
      if (lineBreak === "\r\n") index += 1;
      paragraphs.push({ text: current, lineBreak });
      current = "";
    } else {
      current += character;
    }
  }
  paragraphs.push({ text: current, lineBreak: "" });
  return paragraphs;
}

function rebuildOptimizedPrompt(prompt, keptIndexes) {
  let segmentIndex = 0;
  return splitTopLevelParagraphs(prompt).map(({ text, lineBreak }) => {
    const kept = [];
    splitPromptSegments(text).forEach((segment) => {
      if (keptIndexes.has(segmentIndex)) kept.push(segment);
      segmentIndex += 1;
    });
    return `${kept.join(", ")}${lineBreak}`;
  }).join("");
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
    if (!part || ignored.has(part) || isProtectedControlSegment(segments[index]) || creatorHandleValue(segments[index])) return;
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
  const creatorTags = segments
    .filter((segment) => !ignored.has(normalizeSegment(segment)))
    .map(creatorHandleValue)
    .filter(Boolean);

  const optimization = optimizeSegments(segments, exact, semantic, ignored);
  const optimizedPrompt = rebuildOptimizedPrompt(prompt, optimization.keptIndexes);
  const duplicateInstances = exact.reduce((total, item) => total + item.count - 1, 0);
  const semanticExcess = semantic.reduce((total, item) => total + item.terms.length - 1, 0);
  const wordExcess = repeatedWords.reduce((total, item) => total + item.count - minimumWordRepetitions + 1, 0);
  const scoreBreakdown = {
    exact: duplicateInstances * 20,
    semantic: semanticExcess * 12,
    repeatedWords: wordExcess * 3,
    creatorTags: creatorTags.length * 10,
  };
  const score = Math.min(100, Object.values(scoreBreakdown).reduce((total, value) => total + value, 0));
  const tokenEstimate = estimatePromptTokens(prompt);

  const suggestions = [];
  if (exact.length) suggestions.push("Remove later copies of identical top-level concepts.");
  if (creatorTags.length) suggestions.push(`Remove standalone creator handles: ${creatorTags.join(", ")}.`);
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
    creatorTags,
    cleanedPrompt: optimizedPrompt,
    optimizedPrompt,
    removedExact: optimization.removedExact,
    removedSemantic: optimization.removedSemantic,
    removedCreatorTags: optimization.removedCreatorTags,
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
  const creatorTags = new Set((analysis.creatorTags || []).map(normalizeSegment));
  const parts = String(prompt || "").split(/([,;\n]+)/);

  return parts.map((part, index) => {
    if (index % 2 === 1) return escapeHtml(part);
    const normalized = normalizeSegment(part);
    if (creatorTags.has(standaloneTagValue(part))) return `<mark class="pra-creator">${escapeHtml(part)}</mark>`;
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
