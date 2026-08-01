import { app } from "/scripts/app.js";
import { analyzePrompt, highlightedPromptHtml } from "./analyzer.js";

const SETTING_ENABLED = "PromptRedundancyAssistant.General.Enabled";
const SETTING_BADGES = "PromptRedundancyAssistant.General.NodeBadges";
const SETTING_TYPING = "PromptRedundancyAssistant.General.TypingHelper";
const SETTING_SEMANTIC = "PromptRedundancyAssistant.Analysis.SemanticOverlap";
const SETTING_MINIMUM = "PromptRedundancyAssistant.Analysis.MinimumWordRepetitions";
const PROMPT_NAME = /(prompt|text|positive|negative|instruction|description|caption|wildcard)/i;
const cache = new WeakMap();
let activeContext = null;
let panel = null;
let typingPill = null;
let typingTimer = null;

function setting(id, fallback) {
  return app.extensionManager?.setting?.get(id) ?? fallback;
}

function analysisOptions() {
  return {
    minimumWordRepetitions: Number(setting(SETTING_MINIMUM, 3)),
    checkSemanticOverlap: Boolean(setting(SETTING_SEMANTIC, true)),
  };
}

function isPromptWidget(widget) {
  if (!widget || typeof widget.value !== "string" || widget.value.trim().length < 3) return false;
  const multiline = widget.options?.multiline || widget.inputEl?.tagName === "TEXTAREA" || /text/i.test(widget.type || "");
  return Boolean(multiline || PROMPT_NAME.test(widget.name || ""));
}

function analyzeNode(node) {
  const widgets = (node.widgets || []).filter(isPromptWidget);
  const key = widgets.map((widget) => `${widget.name}:${widget.value}`).join("\u241e") + JSON.stringify(analysisOptions());
  const previous = cache.get(node);
  if (previous?.key === key) return previous.best;

  let best = null;
  widgets.forEach((widget) => {
    const analysis = analyzePrompt(widget.value, analysisOptions());
    if (analysis.hasIssues && (!best || analysis.score > best.analysis.score)) best = { node, widget, analysis };
  });
  cache.set(node, { key, best });
  return best;
}

function ensureStyles() {
  if (document.getElementById("pra-styles")) return;
  const style = document.createElement("style");
  style.id = "pra-styles";
  style.textContent = `
    .pra-panel{position:fixed;right:18px;bottom:18px;z-index:100000;width:min(430px,calc(100vw - 36px));max-height:min(560px,calc(100vh - 36px));overflow:auto;background:#17191d;color:#e8e8e8;border:1px solid #555;border-radius:10px;box-shadow:0 12px 40px #000b;font:13px/1.45 system-ui,sans-serif;padding:14px}
    .pra-panel[hidden]{display:none}.pra-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:15px;font-weight:700}.pra-close{border:0;background:transparent;color:#aaa;font-size:20px;cursor:pointer}.pra-preview{margin:10px 0;padding:9px;background:#0f1012;border:1px solid #3b3d42;border-radius:7px;white-space:pre-wrap;overflow-wrap:anywhere}.pra-score{display:inline-block;padding:2px 7px;border-radius:999px;background:#6b4d00;color:#fff1af;font-weight:700}.pra-list{margin:7px 0;padding-left:20px}.pra-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pra-button{cursor:pointer;border:1px solid #666;background:#292c31;color:#eee;padding:6px 10px;border-radius:6px}.pra-button:hover{background:#363a40}.pra-muted{color:#aaa;font-size:11px}.pra-exact{background:#725c00;color:#fff4b8;border-radius:3px;padding:1px 2px}.pra-semantic{background:#563b78;color:#f1dfff;border-radius:3px;padding:1px 2px}.pra-word{background:#174f6c;color:#d8f4ff;border-radius:3px;padding:1px 2px}.pra-pill{position:fixed;z-index:100001;border:1px solid #bb8b18;background:#2c240f;color:#ffe49a;border-radius:999px;padding:4px 9px;box-shadow:0 4px 16px #0008;font:12px system-ui,sans-serif;cursor:pointer}.pra-pill[hidden]{display:none}`;
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

function setWidgetValue(context, value) {
  if (context.widget) {
    context.widget.value = value;
    context.widget.callback?.(value);
    app.canvas?.setDirty?.(true, true);
  }
  if (context.element) {
    context.element.value = value;
    context.element.dispatchEvent(new Event("input", { bubbles: true }));
    context.element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function showPanel(context) {
  activeContext = context;
  const container = ensurePanel();
  const { analysis } = context;
  const suggestions = analysis.suggestions.length
    ? analysis.suggestions
    : ["The prompt is concise. Keep only quality tags recommended for the selected checkpoint."];
  container.innerHTML = `
    <div class="pra-title"><span>Prompt Assistant <span class="pra-score">${analysis.score}</span></span><button class="pra-close" title="Close" aria-label="Close">×</button></div>
    <div class="pra-preview">${highlightedPromptHtml(analysis.prompt, analysis)}</div>
    <div><strong>Suggestions</strong></div>
    <ul class="pra-list">${suggestions.map((item) => `<li>${item.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c])}</li>`).join("")}</ul>
    <div class="pra-muted">Yellow: exact duplicate · Purple: overlapping meaning · Blue: repeated word</div>
    <div class="pra-actions"><button class="pra-button" data-action="apply">Remove exact duplicates</button><button class="pra-button" data-action="copy">Copy cleaned prompt</button></div>`;
  container.hidden = false;
  container.querySelector(".pra-close").addEventListener("click", () => { container.hidden = true; });
  container.querySelector('[data-action="apply"]').addEventListener("click", () => {
    setWidgetValue(activeContext, analysis.cleanedPrompt);
    container.hidden = true;
  });
  container.querySelector('[data-action="copy"]').addEventListener("click", async () => {
    await navigator.clipboard.writeText(analysis.cleanedPrompt);
  });
}

function showTypingPill(element, analysis) {
  ensureStyles();
  if (!typingPill) {
    typingPill = document.createElement("button");
    typingPill.className = "pra-pill";
    typingPill.type = "button";
    document.body.appendChild(typingPill);
  }
  const rect = element.getBoundingClientRect();
  typingPill.textContent = `Prompt help · ${analysis.score}`;
  typingPill.style.left = `${Math.max(8, Math.min(window.innerWidth - 125, rect.right - 118))}px`;
  typingPill.style.top = `${Math.max(8, Math.min(window.innerHeight - 34, rect.bottom + 5))}px`;
  typingPill.hidden = false;
  typingPill.onclick = () => showPanel({ element, analysis });
}

function handleTextInput(event) {
  if (!setting(SETTING_ENABLED, true) || !setting(SETTING_TYPING, true)) return;
  const element = event.target;
  if (!(element instanceof HTMLTextAreaElement)) return;
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    const analysis = analyzePrompt(element.value, analysisOptions());
    if (analysis.hasIssues) showTypingPill(element, analysis);
    else if (typingPill) typingPill.hidden = true;
  }, 180);
}

function markCanvasDirty() {
  requestAnimationFrame(() => app.canvas?.setDirty?.(true, true));
}

app.registerExtension({
  name: "PromptRedundancy.Assistant",
  settings: [
    { id: SETTING_ENABLED, name: "Enable invisible prompt assistant", type: "boolean", defaultValue: true, onChange: markCanvasDirty },
    { id: SETTING_BADGES, name: "Show issue badges on prompt nodes", type: "boolean", defaultValue: true, onChange: markCanvasDirty },
    { id: SETTING_TYPING, name: "Show contextual help while typing", type: "boolean", defaultValue: true },
    { id: SETTING_SEMANTIC, name: "Detect overlapping meaning groups", type: "boolean", defaultValue: true, onChange: markCanvasDirty },
    { id: SETTING_MINIMUM, name: "Repeated-word threshold", type: "number", defaultValue: 3, attrs: { min: 2, max: 10, showButtons: true }, onChange: markCanvasDirty },
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
      if (!setting(SETTING_ENABLED, true) || !setting(SETTING_BADGES, true) || this.flags?.collapsed) return result;
      const issue = analyzeNode(this);
      if (!issue) {
        this.__praBadge = null;
        return result;
      }

      const width = 50;
      const height = 18;
      const x = Math.max(4, this.size[0] - width - 30);
      const y = -27;
      this.__praBadge = { x, y, width, height, issue };
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, width, height, 6);
      else ctx.rect(x, y, width, height);
      ctx.fillStyle = "#7a5700";
      ctx.fill();
      ctx.fillStyle = "#fff0ae";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`✦ ${issue.analysis.score}`, x + width / 2, y + height / 2 + 0.5);
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
