/* ══════════════════════════════════════════════
   FORFAIT — Wikimind Plans & Abonnements
   ══════════════════════════════════════════════ */

(function () {

  // ── Données des plans ───────────────────────────────────────────────────
  const PLANS = [
    {
      id: "free",
      name: "Free",
      monthly: 0,
      annual: 0,
      desc: "Pour découvrir Wikimind et ses fonctionnalités essentielles.",
      badge: { text: "Actuel", cls: "badge-current" },
      cta: { text: "Forfait actuel", cls: "current-cta", disabled: true },
      featured: false,
      current: true,
      features: [
        { text: "Accès aux modèles Small et Flash", active: true },
        { text: "20 messages / jour", active: true },
        { text: "Génération d'images (Flux Schnell)", active: true },
        { text: "Historique des conversations", active: true },
        { text: "Stockage cloud des images", active: false },
        { text: "Modèles Large et Medium", active: false },
        { text: "Mind Tokens bonus", active: false },
      ],
    },
    {
      id: "plus",
      name: "Plus",
      monthly: 7,
      annual: 5,
      desc: "Pour les utilisateurs réguliers qui veulent plus de puissance et de stockage.",
      badge: { text: "Populaire", cls: "badge-popular" },
      cta: { text: "Passer à Plus →", cls: "featured-cta", disabled: false },
      featured: true,
      current: false,
      features: [
        { text: "Accès à tous les modèles", active: true },
        { text: "Messages illimités", active: true },
        { text: "Tous les modèles image (GPT Image, Kontext…)", active: true },
        { text: "Stockage cloud des images — 5 Go", active: true },
        { text: "Historique illimité", active: true },
        { text: "500 Mind Tokens offerts / mois", active: true },
        { text: "Support prioritaire", active: false },
      ],
    },
    {
      id: "pro",
      name: "Pro",
      monthly: 18,
      annual: 14,
      desc: "Pour les créateurs et professionnels avec des besoins intensifs.",
      badge: null,
      cta: { text: "Passer à Pro →", cls: "", disabled: false },
      featured: false,
      current: false,
      features: [
        { text: "Tout ce qui est inclus dans Plus", active: true },
        { text: "Stockage cloud des images — 50 Go", active: true },
        { text: "Limites de génération augmentées ×5", active: true },
        { text: "Accès anticipé aux nouveaux modèles", active: true },
        { text: "2 000 Mind Tokens offerts / mois", active: true },
        { text: "Support prioritaire 24h", active: true },
        { text: "API Wikimind en accès direct", active: true },
      ],
    },
  ];

  let isAnnual = false;

  // ── Injection CSS ────────────────────────────────────────────────────────
  function injectCSS() {
    if (!document.querySelector('link[href="forfait.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "forfait.css";
      document.head.appendChild(link);
    }
  }

  // ── Build HTML ───────────────────────────────────────────────────────────
  function buildPanel() {
    const overlay = document.createElement("div");
    overlay.id = "forfait-overlay";
    document.body.appendChild(overlay);

    const panel = document.createElement("div");
    panel.id = "forfait-panel";
    panel.innerHTML = `
      <div id="fp-topbar">
        <div id="fp-topbar-left">
          <span id="fp-topbar-logo">Wikimind</span>
          <div id="fp-topbar-sep"></div>
          <span id="fp-topbar-title">Choisir un forfait</span>
        </div>
        <button id="fp-close" title="Fermer">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div id="fp-body">
        <div id="fp-hero">
          <div id="fp-hero-eyebrow">
            <span></span>
            Wikimind Premium
            <span></span>
          </div>
          <h1 id="fp-hero-title">Débloquez tout<br><em>le potentiel de l'IA</em></h1>
          <p id="fp-hero-sub">Des modèles plus puissants, du stockage cloud pour vos images générées, et bien plus — au prix qui vous convient.</p>
        </div>

        <div id="fp-billing-toggle">
          <span class="fp-billing-opt active" id="fp-opt-monthly">Mensuel</span>
          <div id="fp-toggle-switch">
            <div id="fp-toggle-knob"></div>
          </div>
          <span class="fp-billing-opt" id="fp-opt-annual">Annuel</span>
          <span class="fp-annual-badge" id="fp-save-badge">−2 mois offerts</span>
        </div>

        <div id="fp-plans">
          ${PLANS.map(buildPlanCard).join("")}
        </div>

        <p id="fp-note">
          Paiement sécurisé. Annulation à tout moment, sans engagement.<br>
          Les Mind Tokens sont une monnaie virtuelle utilisable sur toute la plateforme.<br>
          <a id="fp-faq-link">Voir la FAQ →</a>
        </p>
      </div>
    `;
    document.body.appendChild(panel);
  }

  function buildPlanCard(plan) {
    const price = isAnnual ? plan.annual : plan.monthly;
    const annualNote = plan.monthly === 0
      ? ""
      : isAnnual
        ? `<span class="saving">soit ${plan.annual * 12} € / an</span>`
        : `${plan.annual} € / mois facturé annuellement`;

    const badgeHTML = plan.badge
      ? `<div class="fp-plan-badge ${plan.badge.cls}">${plan.badge.text}</div>`
      : "";

    const featuresHTML = plan.features.map(f => `
      <li class="fp-feature${f.active ? "" : " dim"}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${f.active ? "currentColor" : "currentColor"}" stroke-width="2.5">
          ${f.active
            ? `<polyline points="20 6 9 17 4 12"/>`
            : `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`
          }
        </svg>
        ${f.text}
      </li>`).join("");

    const priceDisplay = plan.monthly === 0
      ? `<span class="fp-price-amount">0</span><span class="fp-price-currency">€</span>`
      : `<span class="fp-price-currency">€</span><span class="fp-price-amount" data-monthly="${plan.monthly}" data-annual="${plan.annual}">${price}</span>`;

    return `
      <div class="fp-plan${plan.featured ? " featured" : ""}${plan.current ? " current" : ""}" data-plan="${plan.id}">
        ${badgeHTML}
        <div class="fp-plan-name">${plan.name}</div>
        <div class="fp-plan-price">
          ${priceDisplay}
          ${plan.monthly > 0 ? `<span class="fp-price-period">/ mois</span>` : `<span class="fp-price-period">pour toujours</span>`}
        </div>
        <div class="fp-price-annual-note" id="fp-note-${plan.id}">${annualNote}</div>
        <p class="fp-plan-desc">${plan.desc}</p>
        <ul class="fp-features">${featuresHTML}</ul>
        <button class="fp-cta ${plan.cta.cls}" data-plan="${plan.id}" ${plan.cta.disabled ? "disabled" : ""}>${plan.cta.text}</button>
      </div>`;
  }

  // ── Toggle mensuel / annuel ──────────────────────────────────────────────
  function updatePrices(annual) {
    isAnnual = annual;
    const toggle = document.getElementById("fp-toggle-switch");
    const optMonthly = document.getElementById("fp-opt-monthly");
    const optAnnual = document.getElementById("fp-opt-annual");

    toggle.classList.toggle("annual", annual);
    optMonthly.classList.toggle("active", !annual);
    optAnnual.classList.toggle("active", annual);

    PLANS.forEach(plan => {
      if (plan.monthly === 0) return;
      const amountEl = document.querySelector(`.fp-plan[data-plan="${plan.id}"] .fp-price-amount`);
      const noteEl = document.getElementById(`fp-note-${plan.id}`);
      if (amountEl) amountEl.textContent = annual ? plan.annual : plan.monthly;
      if (noteEl) {
        noteEl.className = `fp-price-annual-note${annual ? " saving" : ""}`;
        noteEl.innerHTML = annual
          ? `soit ${plan.annual * 12} € / an`
          : `${plan.annual} € / mois facturé annuellement`;
      }
    });
  }

  // ── Ouvrir / Fermer ──────────────────────────────────────────────────────
  function open() {
    document.getElementById("forfait-overlay").classList.add("open");
    document.getElementById("forfait-panel").classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function close() {
    document.getElementById("forfait-overlay").classList.remove("open");
    document.getElementById("forfait-panel").classList.remove("open");
    document.body.style.overflow = "";
  }

  // ── Bind events ──────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById("fp-close").addEventListener("click", close);
    document.getElementById("forfait-overlay").addEventListener("click", close);

    // Toggle
    const toggleSwitch = document.getElementById("fp-toggle-switch");
    const optMonthly = document.getElementById("fp-opt-monthly");
    const optAnnual = document.getElementById("fp-opt-annual");
    toggleSwitch.addEventListener("click", () => updatePrices(!isAnnual));
    optMonthly.addEventListener("click", () => updatePrices(false));
    optAnnual.addEventListener("click", () => updatePrices(true));

    // CTA buttons
    document.querySelectorAll(".fp-cta:not([disabled])").forEach(btn => {
      btn.addEventListener("click", () => {
        const planId = btn.dataset.plan;
        // Hook à brancher plus tard sur le système de paiement
        console.log("[Wikimind Forfait] Upgrade vers :", planId, "| Annuel :", isAnnual);
        // Placeholder toast
        if (window.toast) window.toast("Paiement — Bientôt disponible");
      });
    });

    // Échap
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.getElementById("forfait-panel").classList.contains("open")) {
        close();
      }
    });
  }

  // ── Brancher sur le bouton pp-upgrade ────────────────────────────────────
  function hookUpgradeButton() {
    const btn = document.getElementById("pp-upgrade");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const profilePopup = document.getElementById("profile-popup");
      if (profilePopup) profilePopup.classList.remove("open");
      open();
    });

    // Aussi depuis les settings
    const stgUpgrade = document.getElementById("stg-account-plan");
    if (stgUpgrade) {
      stgUpgrade.style.cursor = "pointer";
      stgUpgrade.addEventListener("click", open);
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    injectCSS();
    buildPanel();
    bindEvents();
    hookUpgradeButton();
  }

  // Exposer pour usage externe si besoin
  window.WMForfait = { open, close };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
