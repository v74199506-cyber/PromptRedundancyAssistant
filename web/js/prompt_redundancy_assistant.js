import { app } from "/scripts/app.js";
import {
  analyzePrompt,
  captionToTags,
  detectPromptFormat,
  escapeHtml,
  highlightedPromptHtml,
  tagsToCaption,
} from "./analyzer.js";

const SETTING_ENABLED = "PromptRedundancyAssistant.General.Enabled";
const SETTING_BADGES = "PromptRedundancyAssistant.General.NodeBadges";
const SETTING_CONVERTER_BADGES = "PromptRedundancyAssistant.General.ConverterBadges";
const SETTING_TYPING = "PromptRedundancyAssistant.General.TypingHelper";
const SETTING_SEMANTIC = "PromptRedundancyAssistant.Analysis.SemanticOverlap";
const SETTING_MINIMUM = "PromptRedundancyAssistant.Analysis.MinimumWordRepetitions";
const SETTING_PROFILE = "PromptRedundancyAssistant.Analysis.ModelProfile";
const SETTING_IGNORED = "PromptRedundancyAssistant.Analysis.IgnoredTerms";
const SETTING_TOKEN_INFO = "PromptRedundancyAssistant.Analysis.ShowTokenEstimate";
const PROMPT_NAME = /(prompt|text|positive|negative|instruction|description|caption|wildcard)/i;
const cache = new WeakMap();
const undoHistory = new WeakMap();
let activeContext = null;
let panel = null;
let typingPill = null;
let typingTimer = null;

function setting(id, fallback) {
  return app.extensionManager?.setting?.get(id) ?? fallback;
}

function inferPromptRole(context = {}) {
  const clues = [context.widget?.name, context.node?.title, context.node?.type, context.element?.name, context.element?.placeholder]
    .filter(Boolean)
    .join(" ");
  return /negative|negativo/i.test(clues) ? "negative" : "positive";
}

function analysisOptions(context = {}) {
  return {
    minimumWordRepetitions: Number(setting(SETTING_MINIMUM, 3)),
    checkSemanticOverlap: Boolean(setting(SETTING_SEMANTIC, true)),
    modelProfile: String(setting(SETTING_PROFILE, "general")).toLocaleLowerCase(),
    ignoredTerms: String(setting(SETTING_IGNORED, "")),
    promptRole: inferPromptRole(context),
  };
}

function isPromptWidget(widget) {
  if (!widget || typeof widget.value !== "string" || widget.value.trim().length < 3) return false;
  const multiline = widget.options?.multiline || widget.inputEl?.tagName === "TEXTAREA" || /text/i.test(widget.type || "");
  return Boolean(multiline || PROMPT_NAME.test(widget.name || ""));
}

function contextForElement(element) {
  for (const node of app.graph?._nodes || []) {
    for (const widget of node.widgets || []) {
      if (widget.inputEl === element || widget.element === element) return { element, node, widget };
    }
  }
  return { element };
}

function analyzeNode(node) {
  const widgets = (node.widgets || []).filter(isPromptWidget);
  const nodeOptions = analysisOptions({ node });
  const key = widgets.map((widget) => `${widget.name}:${widget.value}`).join("\u241e") + JSON.stringify(nodeOptions);
  const previous = cache.get(node);
  if (previous?.key === key) return previous.best;

  let first = null;
  let bestIssue = null;
  widgets.forEach((widget) => {
    const analysis = analyzePrompt(widget.value, analysisOptions({ node, widget }));
    const candidate = { node, widget, analysis };
    if (!first) first = candidate;
    if (analysis.hasIssues && (!bestIssue || analysis.score > bestIssue.analysis.score)) bestIssue = candidate;
  });
  const best = bestIssue || first;
  cache.set(node, { key, best });
  return best;
}

function ensureStyles() {
  if (document.getElementById("pra-styles")) return;
  const style = document.createElement("style");
  style.id = "pra-styles";
  style.textContent = `
    .pra-panel{position:fixed;right:18px;bottom:18px;z-index:100000;width:min(480px,calc(100vw - 36px));max-height:min(700px,calc(100vh - 36px));overflow:auto;background:#17191d;color:#e8e8e8;border:1px solid #555;border-radius:10px;box-shadow:0 12px 40px #000b;font:13px/1.45 system-ui,sans-serif;padding:14px}
    .pra-panel[hidden]{display:none}.pra-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:15px;font-weight:700}.pra-close{border:0;background:transparent;color:#aaa;font-size:20px;cursor:pointer}.pra-preview,.pra-optimized{margin:10px 0;padding:9px;background:#0f1012;border:1px solid #3b3d42;border-radius:7px;white-space:pre-wrap;overflow-wrap:anywhere}.pra-optimized{max-height:170px;overflow:auto;color:#d8f4ff}.pra-score{display:inline-block;padding:2px 7px;border-radius:999px;background:#6b4d00;color:#fff1af;font-weight:700}.pra-score.pra-score-good{background:#245c36;color:#c9f7d5}.pra-metrics{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.pra-metric{background:#24272d;border:1px solid #41454d;border-radius:999px;padding:2px 7px;font-size:11px}.pra-list{margin:7px 0;padding-left:20px}.pra-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pra-button{cursor:pointer;border:1px solid #666;background:#292c31;color:#eee;padding:6px 10px;border-radius:6px}.pra-button:hover{background:#363a40}.pra-button:disabled{cursor:not-allowed;opacity:.5}.pra-converter{margin-top:13px;padding-top:11px;border-top:1px solid #3b3d42}.pra-converter-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.pra-conversion-preview[hidden]{display:none}.pra-status{min-height:18px;margin-top:9px;color:#bde8c7}.pra-status.pra-error{color:#ffb4a8}.pra-muted{color:#aaa;font-size:11px}.pra-warning{color:#ffd58a}.pra-exact{background:#725c00;color:#fff4b8;border-radius:3px;padding:1px 2px}.pra-creator{background:#7a2f2f;color:#ffd7d7;border-radius:3px;padding:1px 2px}.pra-semantic{background:#563b78;color:#f1dfff;border-radius:3px;padding:1px 2px}.pra-word{background:#174f6c;color:#d8f4ff;border-radius:3px;padding:1px 2px}.pra-pill{position:fixed;z-index:100001;border:1px solid #bb8b18;background:#2c240f;color:#ffe49a;border-radius:999px;padding:4px 9px;box-shadow:0 4px 16px #0008;font:12px system-ui,sans-serif;cursor:pointer}.pra-pill[hidden]{display:none}`;
  document.head.appendChild(style);
}

function ensurePanel() {
  ensureStyles();
  if (panel) return panel;
  panel = document.createElement("section");
  panel.className = "pra-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Prompt redundancy suggestions");
  document.body.appendChild(panel);
  return panel;
}

function textElementFor(context) {
  const candidates = [context.element, context.widget?.inputEl, context.widget?.element];
  return candidates.find((candidate) => candidate && typeof candidate.value === "string") || null;
}

function setWidgetValue(context, value) {
  const exactValue = String(value ?? "");
  const element = textElementFor(context);
  if (element) element.value = exactValue;
  if (context.widget) {
    context.widget.value = exactValue;
    context.widget.callback?.(exactValue);
  }
  if (element) {
    // Some ComfyUI widgets synchronize through DOM events; dispatch both, then
    // enforce the stored string again in case a callback normalized whitespace.
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.value = exactValue;
  }
  if (context.widget) context.widget.value = exactValue;
  if (context.node) cache.delete(context.node);
  app.canvas?.setDirty?.(true, true);
}

function historyTarget(context) {
  return context.widget || context.element || null;
}

function rememberPrompt(context, value) {
  const target = historyTarget(context);
  if (!target) return;
  const history = undoHistory.get(target) || [];
  if (history.at(-1) !== value) history.push(value);
  if (history.length > 10) history.shift();
  undoHistory.set(target, history);
}

function restorePrompt(context) {
  const target = historyTarget(context);
  const history = target ? undoHistory.get(target) : null;
  if (!history?.length) return null;
  const value = history.pop();
  setWidgetValue(context, value);
  return value;
}

function contextPrompt(context) {
  // The visible editor can be newer than widget.value while the user is typing.
  // Prefer it so undo captures formatting exactly as the user saw it.
  const element = textElementFor(context);
  if (element) return element.value;
  if (context.widget && typeof context.widget.value === "string") return context.widget.value;
  return context.analysis?.prompt || "";
}

async function copyTextWithFallback(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    // Browser permission denied: use the selection-based fallback below.
  }

  const temporary = document.createElement("textarea");
  temporary.value = text;
  temporary.setAttribute("readonly", "");
  temporary.style.position = "fixed";
  temporary.style.left = "-9999px";
  temporary.style.opacity = "0";
  document.body.appendChild(temporary);
  temporary.focus();
  temporary.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (_) {
    copied = false;
  }
  temporary.remove();
  return copied;
}

function showPanel(context, statusMessage = "") {
  activeContext = context;
  const container = ensurePanel();
  const analysis = analyzePrompt(contextPrompt(context), analysisOptions(context));
  context.analysis = analysis;
  const suggestions = analysis.suggestions.length
    ? analysis.suggestions
    : ["No known redundancy found. Keep only terms recommended for the selected checkpoint."];
  const hasAutomaticChanges = analysis.optimizedPrompt !== analysis.prompt;
  const target = historyTarget(context);
  const canUndo = Boolean(target && undoHistory.get(target)?.length);
  const showTokenInfo = Boolean(setting(SETTING_TOKEN_INFO, true));
  const tokenWarning = analysis.tokenEstimate > analysis.tokenWarning;
  const promptFormat = detectPromptFormat(analysis.prompt);
  container.innerHTML = `
    <div class="pra-title"><span>Prompt Assistant <span class="pra-score ${analysis.score === 0 ? "pra-score-good" : ""}" title="Redundancy score">${analysis.score}</span></span><button class="pra-close" title="Close" aria-label="Close">x</button></div>
    <div class="pra-metrics">
      <span class="pra-metric">${escapeHtml(analysis.profileLabel)}</span>
      <span class="pra-metric">${escapeHtml(analysis.promptRole)}</span>
      <span class="pra-metric">format ${escapeHtml(promptFormat)}</span>
      <span class="pra-metric">exact ${analysis.scoreBreakdown.exact}</span>
      <span class="pra-metric">meaning ${analysis.scoreBreakdown.semantic}</span>
      <span class="pra-metric">words ${analysis.scoreBreakdown.repeatedWords}</span>
      <span class="pra-metric">creator ${analysis.scoreBreakdown.creatorTags}</span>
      ${showTokenInfo ? `<span class="pra-metric ${tokenWarning ? "pra-warning" : ""}" title="Rough estimate; the model tokenizer is authoritative">~${analysis.tokenEstimate} tokens</span>` : ""}
    </div>
    <div class="pra-preview">${highlightedPromptHtml(analysis.prompt, analysis)}</div>
    <div><strong>Suggestions</strong></div>
    <ul class="pra-list">${suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <details><summary>Optimized prompt preview</summary><div class="pra-optimized">${escapeHtml(analysis.optimizedPrompt)}</div></details>
    <div class="pra-muted">Yellow: exact duplicate | Red: creator handle | Purple: overlapping meaning | Blue: repeated word</div>
    <div class="pra-actions"><button class="pra-button" data-action="apply" ${hasAutomaticChanges ? "" : "disabled"}>Apply optimized prompt</button><button class="pra-button" data-action="undo" ${canUndo ? "" : "disabled"}>Undo last apply</button><button class="pra-button" data-action="copy">Copy optimized prompt</button></div>
    <div class="pra-converter">
      <div class="pra-converter-head"><strong>Format converter</strong><span class="pra-muted">Local, deterministic, preview first</span></div>
      <div class="pra-actions"><button class="pra-button" data-convert="caption">Tags → Caption</button><button class="pra-button" data-convert="tags">Caption → Tags</button></div>
      <div class="pra-conversion-preview" data-conversion-box hidden>
        <div class="pra-optimized" data-conversion-output></div>
        <div class="pra-actions"><button class="pra-button" data-action="apply-conversion">Apply conversion</button><button class="pra-button" data-action="copy-conversion">Copy conversion</button></div>
      </div>
    </div>
    <div class="pra-status" role="status" aria-live="polite">${escapeHtml(statusMessage)}</div>`;
  container.hidden = false;
  container.querySelector(".pra-close").addEventListener("click", () => { container.hidden = true; });
  container.querySelector('[data-action="apply"]').addEventListener("click", () => {
    const previousScore = analysis.score;
    rememberPrompt(activeContext, contextPrompt(activeContext));
    setWidgetValue(activeContext, analysis.optimizedPrompt);
    if (typingPill) typingPill.hidden = true;
    const updated = analyzePrompt(contextPrompt(activeContext), analysisOptions(activeContext));
    activeContext.analysis = updated;
    showPanel(activeContext, `Optimized prompt applied. Redundancy score: ${previousScore} -> ${updated.score}.`);
  });
  container.querySelector('[data-action="undo"]').addEventListener("click", () => {
    const restored = restorePrompt(activeContext);
    showPanel(activeContext, restored === null
      ? "Nothing to restore."
      : `Previous prompt restored exactly (${detectPromptFormat(restored)} format).`);
  });
  container.querySelector('[data-action="copy"]').addEventListener("click", async () => {
    const button = container.querySelector('[data-action="copy"]');
    const status = container.querySelector(".pra-status");
    const copied = await copyTextWithFallback(analysis.optimizedPrompt);
    button.textContent = copied ? "Copied" : "Copy failed";
    status.textContent = copied
      ? "Optimized prompt copied to the clipboard."
      : "Clipboard permission was denied. Expand the preview and copy the text manually.";
    status.classList.toggle("pra-error", !copied);
  });

  let convertedPrompt = "";
  const conversionBox = container.querySelector("[data-conversion-box]");
  const conversionOutput = container.querySelector("[data-conversion-output]");
  container.querySelectorAll("[data-convert]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetFormat = button.dataset.convert;
      convertedPrompt = targetFormat === "caption"
        ? tagsToCaption(contextPrompt(activeContext))
        : captionToTags(contextPrompt(activeContext));
      conversionOutput.textContent = convertedPrompt || "No convertible prompt text found.";
      conversionBox.hidden = false;
      container.querySelector('[data-action="apply-conversion"]').disabled = !convertedPrompt;
      container.querySelector('[data-action="copy-conversion"]').disabled = !convertedPrompt;
    });
  });
  container.querySelector('[data-action="apply-conversion"]').addEventListener("click", () => {
    if (!convertedPrompt) return;
    rememberPrompt(activeContext, contextPrompt(activeContext));
    setWidgetValue(activeContext, convertedPrompt);
    if (typingPill) typingPill.hidden = true;
    showPanel(activeContext, `Converted prompt applied (${detectPromptFormat(convertedPrompt)} format).`);
  });
  container.querySelector('[data-action="copy-conversion"]').addEventListener("click", async () => {
    const status = container.querySelector(".pra-status");
    const copied = convertedPrompt ? await copyTextWithFallback(convertedPrompt) : false;
    status.textContent = copied
      ? "Converted prompt copied to the clipboard."
      : "Clipboard permission was denied. Copy the conversion preview manually.";
    status.classList.toggle("pra-error", !copied);
  });
}

function showTypingPill(context, analysis) {
  const { element } = context;
  ensureStyles();
  if (!typingPill) {
    typingPill = document.createElement("button");
    typingPill.className = "pra-pill";
    typingPill.type = "button";
    document.body.appendChild(typingPill);
  }
  const rect = element.getBoundingClientRect();
  typingPill.textContent = `Prompt help | ${analysis.score}`;
  typingPill.style.left = `${Math.max(8, Math.min(window.innerWidth - 125, rect.right - 118))}px`;
  typingPill.style.top = `${Math.max(8, Math.min(window.innerHeight - 34, rect.bottom + 5))}px`;
  typingPill.hidden = false;
  typingPill.onclick = () => showPanel({ ...context, analysis });
}

function handleTextInput(event) {
  if (!setting(SETTING_ENABLED, true) || !setting(SETTING_TYPING, true)) return;
  const element = event.target;
  if (!(element instanceof HTMLTextAreaElement)) return;
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    const context = contextForElement(element);
    const analysis = analyzePrompt(element.value, analysisOptions(context));
    if (analysis.hasIssues) showTypingPill(context, analysis);
    else if (typingPill) typingPill.hidden = true;
  }, 180);
}

function markCanvasDirty() {
  cache.clear?.();
  requestAnimationFrame(() => app.canvas?.setDirty?.(true, true));
}

app.registerExtension({
  name: "PromptRedundancy.Assistant",
  settings: [
    { id: SETTING_ENABLED, name: "Enable invisible prompt assistant", type: "boolean", defaultValue: true, onChange: markCanvasDirty },
    { id: SETTING_BADGES, name: "Show issue badges on prompt nodes", type: "boolean", defaultValue: true, onChange: markCanvasDirty },
    { id: SETTING_CONVERTER_BADGES, name: "Show converter button on clean prompt nodes", type: "boolean", defaultValue: true, onChange: markCanvasDirty },
    { id: SETTING_TYPING, name: "Show contextual help while typing", type: "boolean", defaultValue: true },
    { id: SETTING_SEMANTIC, name: "Detect overlapping meaning groups", type: "boolean", defaultValue: true, onChange: markCanvasDirty },
    { id: SETTING_MINIMUM, name: "Repeated-word threshold", type: "number", defaultValue: 3, attrs: { min: 2, max: 10, showButtons: true }, onChange: markCanvasDirty },
    { id: SETTING_PROFILE, name: "Prompt model profile", type: "combo", defaultValue: "general", options: ["general", "sdxl", "pony", "illustrious", "flux"], onChange: markCanvasDirty },
    { id: SETTING_IGNORED, name: "Ignored terms (comma separated)", type: "text", defaultValue: "", onChange: markCanvasDirty },
    { id: SETTING_TOKEN_INFO, name: "Show approximate token count", type: "boolean", defaultValue: true },
  ],

  async setup() {
    ensureStyles();
    document.addEventListener("input", handleTextInput, true);
    document.addEventListener("focusout", () => {
      setTimeout(() => { if (typingPill && panel?.hidden !== false) typingPill.hidden = true; }, 220);
    }, true);
  },

  async beforeRegisterNodeDef(nodeType) {
    const originalDraw = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function (ctx) {
      const result = originalDraw?.apply(this, arguments);
      if (!setting(SETTING_ENABLED, true) || this.flags?.collapsed) return result;
      const promptContext = analyzeNode(this);
      const showIssue = Boolean(promptContext?.analysis.hasIssues && setting(SETTING_BADGES, true));
      const showConverter = Boolean(promptContext && !promptContext.analysis.hasIssues && setting(SETTING_CONVERTER_BADGES, true));
      if (!showIssue && !showConverter) {
        this.__praBadge = null;
        return result;
      }

      const width = showIssue ? 50 : 28;
      const height = 18;
      const x = Math.max(4, this.size[0] - width - 30);
      const y = -27;
      this.__praBadge = { x, y, width, height, issue: promptContext };
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, width, height, 6);
      else ctx.rect(x, y, width, height);
      ctx.fillStyle = showIssue ? "#7a5700" : "#174f6c";
      ctx.fill();
      ctx.fillStyle = showIssue ? "#fff0ae" : "#d8f4ff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(showIssue ? `\u2726 ${promptContext.analysis.score}` : "\u2194", x + width / 2, y + height / 2 + 0.5);
      ctx.restore();
      return result;
    };

    const originalMouseDown = nodeType.prototype.onMouseDown;
    nodeType.prototype.onMouseDown = function (event, localPos) {
      const badge = this.__praBadge;
      if (badge && localPos && localPos[0] >= badge.x && localPos[0] <= badge.x + badge.width && localPos[1] >= badge.y && localPos[1] <= badge.y + badge.height) {
        showPanel(badge.issue);
        return true;
      }
      return originalMouseDown?.apply(this, arguments);
    };
  },
});
