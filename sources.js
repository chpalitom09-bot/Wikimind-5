/* ═══════════════════════════════════════════════════
   WIKIMIND AI v5 — sources.js
   Gestion des sources : Jina Reader, Tavily, OpenAI,
   détection d'URLs, et construction du bouton Sources
   ═══════════════════════════════════════════════════ */

// ── 1. REGISTRE DES SOURCES ──────────────────────────────────────────────────

const PROVIDER_SOURCES = {
  pollinations: {
    name: "Pollinations AI",
    logo: "pollinationai.png",
    url: "https://pollinations.ai/",
    desc: "Génération d'images IA"
  },
  mistral: {
    name: "Mistral AI",
    logo: "mistrallogo.png",
    url: "https://chat.mistral.ai/chat",
    desc: "Modèles de langage"
  },
  groq: {
    name: "Groq",
    logo: "groqlogo.png",
    url: "https://groq.com/",
    desc: "Inférence ultra-rapide"
  },
  cerebras: {
    name: "Cerebras",
    logo: "cerebraslogo.png",
    url: "https://cerebras.ai/",
    desc: "Inférence wafer-scale"
  },
  jina: {
    name: "Jina Reader",
    logo: "jinalogo.png",
    url: "https://jina.ai/",
    desc: "Conversion URL → texte",
    badge: "READER",
    badgeClass: "sources-badge-jina"
  },
  tavily: {
    name: "Tavily Search",
    logo: "tavily.png",
    url: "https://app.tavily.com/",
    desc: "Recherche d'actualités IA",
    badge: "SEARCH",
    badgeClass: "sources-badge-tavily"
  },
  openai: {
    name: "OpenAI",
    logo: "openailogo.png",
    url: "https://openai.com/",
    desc: "Modèles OpenAI",
    badge: "GPT",
    badgeClass: "sources-badge-openai"
  }
};

// Modèles qui nécessitent la source "openai"
const OPENAI_MODEL_IDS = ["wm-image-gpt-large", "wm-large-5.6"];

// ── 2. CLÉS API ──────────────────────────────────────────────────────────────

const JINA_API_KEY   = "jina_f3e1d6a7b2c84e9f0a3b5d2c1e8f7a6b4d9e2c0f1a3b5d7e9f";
const TAVILY_API_KEY = "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";
const JINA_RPM_MAX   = 20; // limite Jina Reader gratuit

// Rate-limit Jina en mémoire (timestamps des appels dans l'heure)
let _jinaCallTimestamps = [];

function _jinaCheckRateLimit() {
  const now = Date.now();
  _jinaCallTimestamps = _jinaCallTimestamps.filter(ts => now - ts < 60000); // 1 min
  return _jinaCallTimestamps.length < JINA_RPM_MAX;
}

function _jinaRegisterCall() {
  _jinaCallTimestamps.push(Date.now());
}

// ── 3. DÉTECTION D'ACTUALITÉ (pour déclencher Tavily) ──────────────────────

const NEWS_KEYWORDS = /\b(actualit[ée]s?|news|dernières?[\s-]nouvelles?|récent|récemment|aujourd'hui|ce\s+(matin|soir|jour|week-?end|mois)|cette\s+(semaine|année)|en\s+(ce\s+moment|cours)|live|direct|breaking|dernier[se]?\s+(heure|jour|semaine)|quoi\s+de\s+neuf|que\s+se\s+passe[- ]t[- ]il|événement[s]?\s+r[ée]cent|info[s]?\s+du\s+jour|tendance[s]?)\b/i;

function isTavilyRequest(text) {
  return NEWS_KEYWORDS.test(text);
}

// ── 4. EXTRACTION D'URLS DANS LE TEXTE ──────────────────────────────────────

const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

function extractUrls(text) {
  const matches = [];
  let m;
  URL_REGEX.lastIndex = 0;
  while ((m = URL_REGEX.exec(text)) !== null) {
    matches.push(m[0]);
  }
  return [...new Set(matches)];
}

// ── 5. JINA READER — Fetch d'une URL ────────────────────────────────────────

async function jinaFetchUrl(url) {
  if (!_jinaCheckRateLimit()) {
    console.warn("[Jina] Rate limit atteint (20 RPM)");
    return null;
  }
  try {
    _jinaRegisterCall();
    const resp = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "text",
        ...(JINA_API_KEY ? { "Authorization": `Bearer ${JINA_API_KEY}` } : {})
      }
    });
    if (!resp.ok) {
      console.warn(`[Jina] Erreur HTTP ${resp.status} pour ${url}`);
      return null;
    }
    const text = await resp.text();
    // Tronquer à ~4000 chars pour ne pas saturer le contexte
    return text.slice(0, 4000) + (text.length > 4000 ? "\n\n[...contenu tronqué]" : "");
  } catch (err) {
    console.warn("[Jina] Erreur réseau :", err);
    return null;
  }
}

// ── 6. TAVILY SEARCH ─────────────────────────────────────────────────────────

async function tavilySearch(query) {
  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "basic",
        max_results: 5,
        include_answer: true
      })
    });
    if (!resp.ok) {
      console.warn(`[Tavily] Erreur HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    // Formatter pour injection dans le contexte
    let ctx = "";
    if (data.answer) ctx += `Réponse rapide : ${data.answer}\n\n`;
    if (data.results?.length) {
      ctx += "Résultats d'actualité :\n";
      data.results.slice(0, 5).forEach((r, i) => {
        ctx += `\n[${i + 1}] ${r.title}\n${r.url}\n${r.content?.slice(0, 500) || ""}\n`;
      });
    }
    return ctx || null;
  } catch (err) {
    console.warn("[Tavily] Erreur réseau :", err);
    return null;
  }
}

// ── 7. TOAST JINA (indicateur visuel pendant la lecture) ────────────────────

let _jinaToastEl = null;

function _ensureJinaToast() {
  if (_jinaToastEl) return _jinaToastEl;
  _jinaToastEl = document.createElement("div");
  _jinaToastEl.className = "wm-jina-toast";
  _jinaToastEl.innerHTML = `<div class="wm-jina-spinner"></div><span></span>`;
  document.body.appendChild(_jinaToastEl);
  return _jinaToastEl;
}

function showJinaToast(msg) {
  const t = _ensureJinaToast();
  t.querySelector("span").textContent = msg;
  t.classList.add("show");
}

function hideJinaToast() {
  if (_jinaToastEl) _jinaToastEl.classList.remove("show");
}

// ── 8. ENRICHISSEMENT DU MESSAGE AVANT ENVOI ────────────────────────────────
/**
 * Appelé depuis sendMessage() avant doStream().
 * Détecte les URLs et/ou l'actualité, appelle Jina/Tavily,
 * retourne { enrichedText, extraSources }
 *   enrichedText  : texte enrichi à injecter dans le contexte
 *   extraSources  : tableau de clés PROVIDER_SOURCES à ajouter au bouton
 */
async function wmEnrichMessage(userText) {
  const extraSources = [];
  let enrichedText = userText;

  const urls = extractUrls(userText);
  const wantsNews = isTavilyRequest(userText);

  // ── Jina Reader : lecture des URLs ──
  if (urls.length > 0) {
    const urlResults = [];
    for (const url of urls.slice(0, 3)) { // max 3 URLs par message
      showJinaToast(`Lecture de ${new URL(url).hostname}…`);
      const content = await jinaFetchUrl(url);
      if (content) {
        urlResults.push(`### Contenu de ${url}\n${content}`);
      }
    }
    hideJinaToast();
    if (urlResults.length > 0) {
      enrichedText += `\n\n--- CONTENU DES LIENS (via Jina Reader) ---\n${urlResults.join("\n\n")}\n--- FIN CONTENU ---`;
      extraSources.push("jina");
    }
  }

  // ── Tavily : recherche d'actualité ──
  if (wantsNews) {
    showJinaToast("Recherche d'actualités…");
    const tavilyCtx = await tavilySearch(userText.slice(0, 200));
    hideJinaToast();
    if (tavilyCtx) {
      enrichedText += `\n\n--- ACTUALITÉS (via Tavily) ---\n${tavilyCtx}\n--- FIN ACTUALITÉS ---`;
      extraSources.push("tavily");
    }
  }

  return { enrichedText, extraSources };
}

// ── 9. RÉSOLUTION DES SOURCES D'UN MESSAGE ──────────────────────────────────
/**
 * Retourne le tableau de clés sources pour un msgObj donné.
 * Inclut le provider du modèle + openai si applicable + extras dynamiques.
 */
function resolveMsgSources(msgObj) {
  const sources = [];

  // Source provider principal
  const provider = msgObj.provider || 'mistral';
  if (PROVIDER_SOURCES[provider]) sources.push(provider);

  // OpenAI si modèle GPT
  const modelId = msgObj.modelId || "";
  if (OPENAI_MODEL_IDS.includes(modelId) && !sources.includes("openai")) {
    sources.push("openai");
  }

  // Extras dynamiques (jina, tavily) stockés sur le msgObj
  if (msgObj.extraSources) {
    for (const s of msgObj.extraSources) {
      if (!sources.includes(s)) sources.push(s);
    }
  }

  return sources;
}

// ── 10. CONSTRUCTION DU BOUTON SOURCES ──────────────────────────────────────

function buildSourcesBtn(sourceKeys) {
  const validSources = sourceKeys.filter(s => PROVIDER_SOURCES[s]);
  if (validSources.length === 0) return null;

  const btn = document.createElement("button");
  btn.className = "sources-btn";
  btn.title = "Sources";

  // Affiche max 3 logos (empilés)
  const logosSrc = validSources.slice(0, 3);
  const logosHtml = logosSrc.map(s => {
    const src = PROVIDER_SOURCES[s];
    return `<img src="${src.logo}" alt="${src.name}" onerror="this.style.display='none'">`;
  }).join('');

  const ddId = `sources-dd-${Math.random().toString(36).slice(2)}`;
  btn.innerHTML = `
    <div class="sources-btn-logos">${logosHtml}</div>
    <span>Sources</span>
    <div class="sources-dropdown" id="${ddId}">
      <div class="sources-dropdown-header">Sources utilisées</div>
      ${validSources.map(s => {
        const src = PROVIDER_SOURCES[s];
        const badgeHtml = src.badge
          ? `<span class="sources-dropdown-item-badge ${src.badgeClass || ''}">${src.badge}</span>`
          : '';
        return `<a href="${src.url}" target="_blank" rel="noopener" class="sources-dropdown-item">
          <img src="${src.logo}" alt="${src.name}" onerror="this.style.display='none'">
          <div class="sources-dropdown-item-info">
            <div class="sources-dropdown-item-name">${src.name}</div>
            <div class="sources-dropdown-item-url">${src.desc}</div>
          </div>
          ${badgeHtml}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>`;
      }).join('')}
    </div>
  `;

  const dropdown = btn.querySelector('.sources-dropdown');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.sources-dropdown.open').forEach(d => {
      if (d !== dropdown) d.classList.remove('open');
    });
    dropdown.classList.toggle('open');
  });
  document.addEventListener('click', () => dropdown.classList.remove('open'), { passive: true });

  return btn;
}

// ── 11. HIGHLIGHT URLS DANS LE TEXTAREA ──────────────────────────────────────
/**
 * Appelé sur l'événement input du textarea.
 * Rend les URLs détectées visibles en bleu.
 * On utilise un overlay transparent superposé au textarea.
 */
function initUrlHighlight(textareaEl) {
  // Créer le wrapper overlay si pas déjà fait
  const container = textareaEl.parentElement;
  if (!container) return;

  // S'assurer que le container est en position relative
  container.style.position = "relative";

  let overlay = container.querySelector(".wm-url-highlight-wrapper");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "wm-url-highlight-wrapper";
    overlay.setAttribute("aria-hidden", "true");
    container.insertBefore(overlay, textareaEl);
    // Le textarea doit être transparent sur son background pour laisser passer l'overlay
    // mais on garde le texte normal — l'overlay est en dessous et pointer-events:none
  }

  function syncOverlay() {
    const val = textareaEl.value;
    // Remplacer les URLs par des spans colorés (le texte reste transparent dans l'overlay)
    const escaped = val
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const highlighted = escaped.replace(
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g,
      (match) => `<span class="wm-url-highlight">${match}</span>`
    );
    overlay.innerHTML = highlighted;

    // Sync scroll
    overlay.scrollTop = textareaEl.scrollTop;
  }

  textareaEl.addEventListener("input", syncOverlay);
  textareaEl.addEventListener("scroll", () => {
    overlay.scrollTop = textareaEl.scrollTop;
  });

  // Sync font/padding de l'overlay avec le textarea
  const syncStyles = () => {
    const cs = getComputedStyle(textareaEl);
    overlay.style.padding = cs.padding;
    overlay.style.fontSize = cs.fontSize;
    overlay.style.fontFamily = cs.fontFamily;
    overlay.style.lineHeight = cs.lineHeight;
    overlay.style.letterSpacing = cs.letterSpacing;
  };
  syncStyles();

  return syncOverlay;
}

// ── 12. RENDU DES URLS EN PILLS DANS LE MESSAGE UTILISATEUR ─────────────────
/**
 * Transforme les URLs brutes dans le HTML d'un bubble user
 * en pills cliquables (ouvre dans un nouvel onglet).
 */
function renderUrlPillsInBubble(bubbleEl) {
  // Traiter uniquement les noeuds texte
  const walker = document.createTreeWalker(bubbleEl, NodeFilter.SHOW_TEXT);
  const nodesToReplace = [];

  let node;
  URL_REGEX.lastIndex = 0;
  while ((node = walker.nextNode())) {
    if (URL_REGEX.test(node.textContent)) {
      nodesToReplace.push(node);
    }
  }

  URL_REGEX.lastIndex = 0;
  nodesToReplace.forEach(textNode => {
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    URL_REGEX.lastIndex = 0;
    const text = textNode.textContent;
    while ((m = URL_REGEX.exec(text)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const pill = document.createElement("a");
      pill.className = "wm-url-pill";
      pill.href = m[0];
      pill.target = "_blank";
      pill.rel = "noopener";
      pill.title = m[0];
      pill.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>${new URL(m[0]).hostname}`;
      frag.appendChild(pill);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode.replaceChild(frag, textNode);
  });
}

// ── 13. EXPORTS GLOBAUX ──────────────────────────────────────────────────────

window.PROVIDER_SOURCES    = PROVIDER_SOURCES;
window.buildSourcesBtn     = buildSourcesBtn;
window.wmEnrichMessage     = wmEnrichMessage;
window.resolveMsgSources   = resolveMsgSources;
window.initUrlHighlight    = initUrlHighlight;
window.renderUrlPillsInBubble = renderUrlPillsInBubble;
window.isTavilyRequest     = isTavilyRequest;
window.extractUrls         = extractUrls;
window.OPENAI_MODEL_IDS    = OPENAI_MODEL_IDS;
