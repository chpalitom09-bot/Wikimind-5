/**
 * connect.js — Wikimind AI Login Page
 * Gère : affichage instantané si non connecté, masquage si connecté,
 * connexion Google / Microsoft / Email (auto détection login vs inscription),
 * collecte du profil utilisateur (prénom, nom, profession),
 * popups Tarification + Légal, animation démo IA prédéfinie.
 *
 * UTILISATION dans index.html :
 *   <link rel="stylesheet" href="connect.css">
 *   <script src="connect.js" defer></script>
 *
 * Le script attend que window.auth et window.db soient exposés par le module
 * Firebase principal (index.html). Si Firebase n'est pas encore prêt au
 * moment où connect.js s'exécute, il patiente via un polling léger.
 */

(function () {
  'use strict';

  // ── CONFIG ─────────────────────────────────────────────────────────────
  const CONTACT_EMAIL = 'wikimind.ai@gmail.com';
  const DB_PATH_PREFIX = 'wikimind5/users';

  // ── PROFESSIONS ────────────────────────────────────────────────────────
  const PROFESSIONS = [
    { value: '', label: 'Votre situation — sélectionnez' },
    { value: 'etudiant_lycee', label: '🎓 Lycéen(ne)' },
    { value: 'etudiant_universite', label: '🎓 Étudiant(e) universitaire' },
    { value: 'etudiant_ingenieur', label: '🎓 Étudiant(e) ingénieur' },
    { value: 'sans_emploi', label: '🔍 Sans emploi' },
    { value: 'auto_entrepreneur', label: '💼 Auto-entrepreneur' },
    { value: 'ingenieur', label: '⚙️ Ingénieur(e)' },
    { value: 'developpeur', label: '💻 Développeur(se)' },
    { value: 'data_scientist', label: '📊 Data Scientist / IA' },
    { value: 'medecin', label: '🩺 Médecin / Professionnel santé' },
    { value: 'juriste', label: '⚖️ Juriste / Avocat(e)' },
    { value: 'enseignant', label: '📚 Enseignant(e) / Formateur' },
    { value: 'chercheur', label: '🔬 Chercheur(se) / Scientifique' },
    { value: 'designer', label: '🎨 Designer / Créatif' },
    { value: 'marketeur', label: '📣 Marketing / Communication' },
    { value: 'entrepreneur', label: '🚀 Entrepreneur / Fondateur' },
    { value: 'manager', label: '🏢 Manager / Cadre' },
    { value: 'comptable', label: '🧮 Comptable / Finance' },
    { value: 'artisan', label: '🔨 Artisan / Technicien' },
    { value: 'retraite', label: '🏖️ Retraité(e)' },
    { value: 'autre', label: '✨ Autre' },
  ];

  // ── HTML ────────────────────────────────────────────────────────────────
  const HTML = `
<div id="cn-topbar">
  <a id="cn-logo" href="#">
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#wm-grad)"/>
      <path d="M9 16c0-3.866 3.134-7 7-7s7 3.134 7 7-3.134 7-7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="16" cy="16" r="2.5" fill="#fff"/>
      <defs>
        <linearGradient id="wm-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stop-color="#6e6eff"/>
          <stop offset="1" stop-color="#a855f7"/>
        </linearGradient>
      </defs>
    </svg>
    Wikimind
  </a>
  <nav id="cn-topbar-nav">
    <button class="cn-nav-btn" id="cn-btn-tarif">Tarification</button>
    <button class="cn-nav-btn" id="cn-btn-legal">Légal & Confidentialité</button>
    <a class="cn-nav-btn" id="cn-topbar-contact" href="mailto:${CONTACT_EMAIL}">Contacter Wikimind</a>
  </nav>
</div>

<div id="cn-page">
  <!-- ── LEFT ── -->
  <div id="cn-left">
    <div id="cn-brand">
      <h1>Pensez plus vite,<br>apprenez mieux</h1>
      <p>Wikimind AI — votre assistant intelligent pour étudier, créer et explorer.</p>
    </div>

    <div id="cn-card">
      <!-- Social -->
      <div id="cn-social-row">
        <button class="cn-social-btn" id="cn-btn-google">
          <svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Google
        </button>
        <button class="cn-social-btn" id="cn-btn-microsoft">
          <svg viewBox="0 0 24 24"><rect x="1" y="1" width="10.5" height="10.5" fill="#F25022"/><rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00"/><rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/></svg>
          Microsoft
        </button>
      </div>

      <div class="cn-sep"><span>ou continuer avec l'e-mail</span></div>

      <!-- Step 1: Email -->
      <div id="cn-step-email">
        <div id="cn-email-row">
          <input class="cn-input" id="cn-email" type="email" placeholder="Votre adresse e-mail" autocomplete="email">
          <button id="cn-email-go">Continuer</button>
        </div>
      </div>

      <!-- Step 2: Password -->
      <div id="cn-step-pass">
        <div class="cn-step-header">
          <button class="cn-step-back" id="cn-back-pass" title="Retour">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="cn-step-label">Connectez-vous en tant que <strong id="cn-step-email-label"></strong></span>
        </div>
        <input class="cn-input" id="cn-pass" type="password" placeholder="Mot de passe" autocomplete="current-password">
        <div id="cn-err"></div>
        <button class="cn-submit-btn" id="cn-pass-submit">Se connecter</button>
      </div>

      <!-- Step 3: New account profile -->
      <div id="cn-step-profile">
        <div class="cn-step-header">
          <button class="cn-step-back" id="cn-back-profile" title="Retour">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="cn-step-label">Créer votre compte</span>
        </div>
        <div id="cn-profile-grid">
          <input class="cn-input" id="cn-firstname" type="text" placeholder="Prénom" autocomplete="given-name">
          <input class="cn-input" id="cn-lastname" type="text" placeholder="Nom" autocomplete="family-name">
        </div>
        <select class="cn-input" id="cn-profession">${PROFESSIONS.map(p => `<option value="${p.value}">${p.label}</option>`).join('')}</select>
        <input class="cn-input" id="cn-pass-new" type="password" placeholder="Choisir un mot de passe (6+ caractères)" autocomplete="new-password">
        <div id="cn-err-profile"></div>
        <button class="cn-submit-btn" id="cn-profile-submit">Créer mon compte</button>
      </div>

      <p id="cn-legal">En continuant, vous acceptez la <a id="cn-legal-cgu-link">Politique de confidentialité</a> et les <a id="cn-legal-cgu2-link">Conditions d'utilisation</a> de Wikimind.</p>
    </div>
  </div>

  <!-- ── RIGHT — FEATURE SHOWCASE ── -->
  <div id="cn-right">
    <div id="cn-showcase">
      <div class="sh-glow sh-glow1"></div>
      <div class="sh-glow sh-glow2"></div>

      <div class="sh-pills">
        <div class="sh-pill active" data-i="0">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg>
          Flashcards
        </div>
        <div class="sh-pill" data-i="1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Quiz QCM
        </div>
        <div class="sh-pill" data-i="2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Sources Web
        </div>
        <div class="sh-pill" data-i="3">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Graphiques
        </div>
      </div>

      <div class="sh-stage">

        <!-- PANEL 0 : Flashcards -->
        <div class="sh-panel active" id="sh-p0">
          <div class="sh-panel-label">
            <div class="sh-panel-icon" style="background:rgba(110,110,255,0.15)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6e6eff" stroke-width="2.2"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg>
            </div>
            <span>Flashcards IA</span>
            <span class="sh-counter" id="sh-fc-counter">1 / 4</span>
          </div>
          <div class="sh-fc-scene" id="sh-fc-scene">
            <div class="sh-fc-card" id="sh-fc-card">
              <div class="sh-fc-face sh-fc-front">
                <div class="sh-fc-q" id="sh-fc-q">Qu'est-ce que la rétropropagation ?</div>
                <div class="sh-fc-hint">Cliquer pour voir la réponse</div>
              </div>
              <div class="sh-fc-face sh-fc-back">
                <div class="sh-fc-a-label">Réponse</div>
                <div class="sh-fc-a" id="sh-fc-a">Algorithme qui calcule le gradient de l'erreur en remontant couche par couche pour ajuster les poids.</div>
              </div>
            </div>
          </div>
          <div class="sh-fc-dots" id="sh-fc-dots">
            <div class="sh-fc-dot current"></div>
            <div class="sh-fc-dot"></div>
            <div class="sh-fc-dot"></div>
            <div class="sh-fc-dot"></div>
          </div>
        </div>

        <!-- PANEL 1 : Quiz QCM -->
        <div class="sh-panel" id="sh-p1">
          <div class="sh-panel-label">
            <div class="sh-panel-icon" style="background:rgba(168,85,247,0.12)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <span>QCM Interactif</span>
          </div>
          <div class="sh-qz-q">Quel algorithme est utilisé pour entraîner les réseaux de neurones ?</div>
          <div class="sh-qz-opts">
            <div class="sh-qz-opt" id="sh-qo-a"><div class="sh-opt-letter">A</div>Algorithme de Dijkstra</div>
            <div class="sh-qz-opt" id="sh-qo-b"><div class="sh-opt-letter">B</div>Descente de gradient</div>
            <div class="sh-qz-opt" id="sh-qo-c"><div class="sh-opt-letter">C</div>Tri par fusion</div>
            <div class="sh-qz-opt" id="sh-qo-d"><div class="sh-opt-letter">D</div>Recherche binaire</div>
          </div>
          <div class="sh-qz-expl" id="sh-qz-expl">La descente de gradient ajuste les poids en minimisant la fonction de perte, guidée par la rétropropagation.</div>
        </div>

        <!-- PANEL 2 : Sources -->
        <div class="sh-panel" id="sh-p2">
          <div class="sh-panel-label">
            <div class="sh-panel-icon" style="background:rgba(74,222,128,0.1)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <span>Sources Vérifiées</span>
          </div>
          <div class="sh-src-q">"Quelles sont les dernières avancées en LLM open-source ?"</div>
          <div class="sh-src-list">
            <div class="sh-src-card" id="sh-sc0">
              <div class="sh-src-logo" style="background:#1a1a2e;color:#4285f4;font-size:0.8rem;font-weight:700">W</div>
              <div class="sh-src-body">
                <div class="sh-src-site">wikipedia.org</div>
                <div class="sh-src-title">Large Language Models — Architectures récentes</div>
                <div class="sh-src-snip">Les modèles Llama 3, Mistral et Qwen représentent...</div>
              </div>
              <div class="sh-src-rel">98%</div>
            </div>
            <div class="sh-src-card" id="sh-sc1">
              <div class="sh-src-logo" style="background:#0d1117;color:#e0e0e0;font-size:0.65rem;font-weight:700">arXiv</div>
              <div class="sh-src-body">
                <div class="sh-src-site">arxiv.org</div>
                <div class="sh-src-title">Scaling Laws for Open-Source LLMs (2025)</div>
                <div class="sh-src-snip">Cette étude compare les performances sur 47 benchmarks...</div>
              </div>
              <div class="sh-src-rel">94%</div>
            </div>
            <div class="sh-src-card" id="sh-sc2">
              <div class="sh-src-logo" style="background:#1a0a2e;color:#a855f7;font-size:0.85rem;font-weight:700">M</div>
              <div class="sh-src-body">
                <div class="sh-src-site">mistral.ai</div>
                <div class="sh-src-title">Mistral Large 2 — Technical Report</div>
                <div class="sh-src-snip">Architecture MoE avec 8 experts actifs par token...</div>
              </div>
              <div class="sh-src-rel">91%</div>
            </div>
          </div>
        </div>

        <!-- PANEL 3 : Graphiques -->
        <div class="sh-panel" id="sh-p3">
          <div class="sh-panel-label">
            <div class="sh-panel-icon" style="background:rgba(251,191,36,0.1)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <span>Graphiques IA</span>
          </div>
          <div class="sh-cht-head">
            <div class="sh-cht-title">Précision modèles — Benchmark MMLU</div>
            <div class="sh-cht-legend">
              <span><span class="sh-leg-dot" style="background:#6e6eff"></span>Wm Large</span>
              <span><span class="sh-leg-dot" style="background:#a855f7"></span>Wm Small</span>
            </div>
          </div>
          <div class="sh-cht-wrap">
            <div class="sh-cht-grid-line" style="top:20px"></div>
            <div class="sh-cht-grid-line" style="top:56px"></div>
            <div class="sh-cht-grid-line" style="top:92px"></div>
            <div class="sh-cht-bars" id="sh-cht-bars"></div>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>

<!-- ── FORFAIT POPUP ── -->
<div id="cn-forfait-overlay">
  <div id="cn-forfait-box">
    <h2>Tarification</h2>
    <p>Choisissez le forfait adapté à vos besoins. Passez à niveau à tout moment.</p>
    <div class="cn-plans-grid">
      <div class="cn-plan-card">
        <div class="cn-plan-name">Free</div>
        <div class="cn-plan-price">0 €<span> / mois</span></div>
        <ul class="cn-plan-features">
          <li>Modèles Small & Medium</li>
          <li>50 messages / jour</li>
          <li>Flashcards & Quiz</li>
          <li>Historique 30 jours</li>
        </ul>
        <button class="cn-plan-btn" onclick="document.getElementById('cn-forfait-overlay').classList.remove('open')">Commencer gratis</button>
      </div>
      <div class="cn-plan-card popular">
        <div class="cn-plan-badge">POPULAIRE</div>
        <div class="cn-plan-name">Plus</div>
        <div class="cn-plan-price">9 €<span> / mois</span></div>
        <ul class="cn-plan-features">
          <li>Tous les modèles</li>
          <li>500 messages / jour</li>
          <li>Connecteurs Google</li>
          <li>Historique illimité</li>
          <li>Génération d'images</li>
        </ul>
        <button class="cn-plan-btn" onclick="window.location.href='mailto:${CONTACT_EMAIL}?subject=Demande forfait Plus'">Passer à Plus</button>
      </div>
      <div class="cn-plan-card">
        <div class="cn-plan-name">Pro</div>
        <div class="cn-plan-price">24 €<span> / mois</span></div>
        <ul class="cn-plan-features">
          <li>Accès prioritaire</li>
          <li>Messages illimités</li>
          <li>Tous les connecteurs</li>
          <li>API BYOK avancée</li>
          <li>Support dédié</li>
        </ul>
        <button class="cn-plan-btn" onclick="window.location.href='mailto:${CONTACT_EMAIL}?subject=Demande forfait Pro'">Passer à Pro</button>
      </div>
      <div class="cn-plan-card">
        <div class="cn-plan-name">Entreprise</div>
        <div class="cn-plan-price">Sur devis</div>
        <ul class="cn-plan-features">
          <li>Déploiement privé</li>
          <li>SSO & sécurité avancée</li>
          <li>Formation équipes</li>
          <li>SLA garanti</li>
          <li>Intégrations sur mesure</li>
        </ul>
        <button class="cn-plan-btn" onclick="window.location.href='mailto:${CONTACT_EMAIL}?subject=Demande forfait Entreprise'">Nous contacter</button>
      </div>
    </div>
    <button id="cn-forfait-close">Fermer</button>
  </div>
</div>

<!-- ── LEGAL POPUP ── -->
<div id="cn-legal-overlay">
  <div id="cn-legal-box">
    <h2>Mentions légales & Confidentialité</h2>
    <button id="cn-legal-close">✕</button>
    <div class="cn-legal-tabs">
      <button class="cn-legal-tab active" data-tab="privacy">Confidentialité</button>
      <button class="cn-legal-tab" data-tab="cgu">Conditions</button>
      <button class="cn-legal-tab" data-tab="cookies">Cookies</button>
      <button class="cn-legal-tab" data-tab="mentions">Mentions légales</button>
    </div>
    <div class="cn-legal-content active" id="cn-tab-privacy">
      <h3>Collecte des données</h3>
      <p>Wikimind collecte uniquement les données nécessaires au fonctionnement du service : adresse e-mail, nom d'affichage, profession et historique de conversations. Ces données sont stockées de manière sécurisée sur Firebase (Google Cloud, serveurs en Europe).</p>
      <h3>Utilisation</h3>
      <p>Vos données ne sont jamais vendues à des tiers. Elles sont utilisées exclusivement pour personnaliser votre expérience, améliorer le service et assurer la sécurité de la plateforme.</p>
      <h3>Vos droits (RGPD)</h3>
      <ul>
        <li>Droit d'accès à vos données personnelles</li>
        <li>Droit de rectification et de suppression</li>
        <li>Droit à la portabilité des données</li>
        <li>Droit d'opposition au traitement</li>
      </ul>
      <p>Pour exercer vos droits, contactez-nous : <a href="mailto:${CONTACT_EMAIL}" style="color:#a0a0ff">${CONTACT_EMAIL}</a></p>
      <h3>Conservation</h3>
      <p>Les données sont conservées pendant la durée de vie du compte. À la suppression du compte, toutes les données sont effacées dans un délai de 30 jours.</p>
    </div>
    <div class="cn-legal-content" id="cn-tab-cgu">
      <h3>Acceptation des conditions</h3>
      <p>En utilisant Wikimind, vous acceptez les présentes conditions d'utilisation. L'accès au service est réservé aux personnes de 13 ans et plus.</p>
      <h3>Usage acceptable</h3>
      <ul>
        <li>Usage personnel, éducatif et professionnel autorisé</li>
        <li>Interdiction de générer du contenu illégal ou nuisible</li>
        <li>Pas de tentative de contournement des systèmes de modération</li>
        <li>Respect des droits d'auteur et de la propriété intellectuelle</li>
      </ul>
      <h3>Propriété intellectuelle</h3>
      <p>Le contenu généré par l'IA vous appartient. La marque Wikimind, son logo et ses interfaces sont protégés.</p>
      <h3>Limitation de responsabilité</h3>
      <p>Wikimind est un outil d'assistance. Les réponses de l'IA ne constituent pas des conseils médicaux, juridiques ou financiers professionnels. Vérifiez toujours les informations critiques auprès de professionnels qualifiés.</p>
    </div>
    <div class="cn-legal-content" id="cn-tab-cookies">
      <h3>Cookies essentiels</h3>
      <p>Wikimind utilise uniquement des cookies essentiels au fonctionnement du service : authentification Firebase, préférences utilisateur et état de session. Aucun cookie publicitaire ou de tracking tiers n'est utilisé.</p>
      <h3>Stockage local</h3>
      <p>Certaines préférences (modèle sélectionné, connecteurs actifs, thème) sont stockées dans le localStorage de votre navigateur pour améliorer votre expérience. Ces données restent sur votre appareil.</p>
    </div>
    <div class="cn-legal-content" id="cn-tab-mentions">
      <h3>Éditeur</h3>
      <p>Wikimind AI est un projet indépendant. Pour tout contact : <a href="mailto:${CONTACT_EMAIL}" style="color:#a0a0ff">${CONTACT_EMAIL}</a></p>
      <h3>Hébergement</h3>
      <p>Le service est hébergé sur Firebase / Google Cloud Platform, serveurs situés en Europe (europe-west1).</p>
      <h3>Technologies</h3>
      <p>Wikimind utilise des modèles d'IA de Mistral AI, Meta (Llama), et d'autres fournisseurs. Les modèles sont accessibles via des API sécurisées. Wikimind n'entraîne pas ses propres modèles avec vos données.</p>
    </div>
  </div>
</div>
`;

  // ── SHOWCASE DATA ────────────────────────────────────────────────────────
  const SH_CARDS = [
    { q: "Qu'est-ce que la rétropropagation ?", a: "Algorithme qui calcule le gradient de l'erreur en remontant couche par couche pour ajuster les poids du réseau." },
    { q: "Définir l'entropie croisée ?", a: "Fonction de perte qui mesure la divergence entre la distribution prédite et la distribution réelle des labels." },
    { q: "Qu'est-ce qu'un Transformer ?", a: "Architecture basée sur le mécanisme d'attention permettant de traiter des séquences en parallèle (self-attention)." },
    { q: "Qu'est-ce que le fine-tuning ?", a: "Adaptation d'un modèle pré-entraîné à une tâche spécifique en continuant l'entraînement sur un dataset ciblé." }
  ];
  const SH_MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun'];
  const SH_DATA_A = [71, 74, 77, 79, 83, 87];
  const SH_DATA_B = [58, 61, 63, 67, 70, 74];

  // ── STATE ───────────────────────────────────────────────────────────────
  let _step = 'email';
  let _emailVal = '';
  let _mounted = false;
  let _authReady = false;
  let _demoTimer = null;

  // Showcase state
  let _shCurrent = 0;
  let _shAutoTimer = null;
  let _shFcIdx = 0;
  let _shFcFlipped = false;
  let _shQuizDone = false;
  let _shSourcesDone = false;
  let _shChartBuilt = false;

  // ── WAIT FOR FIREBASE ────────────────────────────────────────────────────
  function waitForAuth(cb) {
    if (window.auth) { cb(window.auth); return; }
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (window.auth) { clearInterval(iv); cb(window.auth); }
      else if (tries > 100) { clearInterval(iv); mount(); } // fallback: show anyway
    }, 80);
  }

  // ── MOUNT ────────────────────────────────────────────────────────────────
  function mount() {
    if (_mounted) return;
    _mounted = true;

    const root = document.createElement('div');
    root.id = 'cn-root';
    root.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0a0a0a;overflow:hidden;';
    root.innerHTML = HTML;
    document.body.appendChild(root);

    bindEvents();
    startDemo();
  }

  // ── INIT ─────────────────────────────────────────────────────────────────
  function init() {
    // Check auth ASAP — if Firebase exposes onAuthStateChanged
    waitForAuth(function (auth) {
      // If there's already a cached user (very fast check)
      if (auth.currentUser) {
        // user already logged in — don't show page
        return;
      }
      // Listen for auth state
      const { onAuthStateChanged } = window._fbAuthFns || {};
      if (onAuthStateChanged) {
        onAuthStateChanged(auth, function (user) {
          if (user && _mounted) {
            // User just signed in through connect page — unmount
            unmount();
          } else if (!user && !_mounted) {
            mount();
          }
        });
      }
      // Also mount immediately if not logged in
      if (!auth.currentUser) mount();
    });
  }

  function unmount() {
    const root = document.getElementById('cn-root');
    if (root) {
      root.style.transition = 'opacity 0.3s';
      root.style.opacity = '0';
      setTimeout(() => root.remove(), 320);
    }
    if (_demoTimer) clearTimeout(_demoTimer);
  }

  // ── BIND EVENTS ─────────────────────────────────────────────────────────
  function bindEvents() {
    const $ = id => document.getElementById(id);

    // Topbar
    $('cn-btn-tarif').onclick = () => $('cn-forfait-overlay').classList.add('open');
    $('cn-btn-legal').onclick = () => openLegal('privacy');
    $('cn-legal-cgu-link').onclick = () => openLegal('privacy');
    $('cn-legal-cgu2-link').onclick = () => openLegal('cgu');
    $('cn-forfait-close').onclick = () => $('cn-forfait-overlay').classList.remove('open');
    $('cn-legal-close').onclick = () => $('cn-legal-overlay').classList.remove('open');

    // Legal tabs
    document.querySelectorAll('.cn-legal-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.cn-legal-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.cn-legal-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        $('cn-tab-' + tab.dataset.tab).classList.add('active');
      };
    });

    // Close overlays on backdrop click
    $('cn-forfait-overlay').onclick = e => { if (e.target === $('cn-forfait-overlay')) $('cn-forfait-overlay').classList.remove('open'); };
    $('cn-legal-overlay').onclick = e => { if (e.target === $('cn-legal-overlay')) $('cn-legal-overlay').classList.remove('open'); };

    // Social auth
    $('cn-btn-google').onclick = () => socialAuth('google');
    $('cn-btn-microsoft').onclick = () => socialAuth('microsoft');

    // Email step
    const emailInput = $('cn-email');
    emailInput.onkeydown = e => { if (e.key === 'Enter') stepEmail(); };
    $('cn-email-go').onclick = stepEmail;

    // Password step
    $('cn-back-pass').onclick = () => showStep('email');
    $('cn-pass').onkeydown = e => { if (e.key === 'Enter') submitPass(); };
    $('cn-pass-submit').onclick = submitPass;

    // Profile step
    $('cn-back-profile').onclick = () => showStep('email');
    $('cn-profile-submit').onclick = submitProfile;
    $('cn-pass-new').onkeydown = e => { if (e.key === 'Enter') submitProfile(); };
  }

  // ── STEP NAVIGATION ──────────────────────────────────────────────────────
  function showStep(step) {
    _step = step;
    const $ = id => document.getElementById(id);
    $('cn-step-email').style.display = step === 'email' ? '' : 'none';

    const pass = $('cn-step-pass');
    const prof = $('cn-step-profile');
    pass.classList.toggle('active', step === 'pass');
    prof.classList.toggle('active', step === 'profile');

    if (step === 'pass') {
      $('cn-step-email-label').textContent = _emailVal;
      setTimeout(() => $('cn-pass').focus(), 50);
    }
    if (step === 'profile') {
      setTimeout(() => $('cn-firstname').focus(), 50);
    }
    setErr('');
    setErrProfile('');
  }

  // ── EMAIL STEP ──────────────────────────────────────────────────────────
  async function stepEmail() {
    const emailInput = document.getElementById('cn-email');
    const email = emailInput.value.trim();
    if (!validateEmail(email)) { emailInput.style.borderColor = '#ff5555'; return; }
    emailInput.style.borderColor = '';
    _emailVal = email;

    const btn = document.getElementById('cn-email-go');
    btn.disabled = true;
    btn.innerHTML = '<span class="cn-spinner"></span>';

    try {
      const { fetchSignInMethodsForEmail } = await getFirebaseFns();
      // [] = nouveau compte  /  ['password'] ou ['google.com'] = compte existant
      const methods = await fetchSignInMethodsForEmail(window.auth, email);
      if (methods && methods.length > 0) {
        // Compte existant → demander le mot de passe
        showStep('pass');
      } else {
        // Nouveau compte → collecte du profil
        showStep('profile');
      }
    } catch (err) {
      // Erreur réseau : fallback mot de passe
      showStep('pass');
    }

    btn.disabled = false;
    btn.textContent = 'Continuer';
  }

  // ── PASSWORD (LOGIN) ────────────────────────────────────────────────────
  async function submitPass() {
    const pass = document.getElementById('cn-pass').value;
    if (!pass) return;

    const btn = document.getElementById('cn-pass-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="cn-spinner" style="border-top-color:#000"></span>';

    try {
      const { signInWithEmailAndPassword } = await getFirebaseFns();
      await signInWithEmailAndPassword(window.auth, _emailVal, pass);
      // onAuthStateChanged in index.html will hide the overlay
      unmount();
    } catch (e) {
      setErr(friendlyError(e.code));
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  }

  // ── PROFILE (REGISTER) ──────────────────────────────────────────────────
  async function submitProfile() {
    const $ = id => document.getElementById(id);
    const firstname = $('cn-firstname').value.trim();
    const lastname = $('cn-lastname').value.trim();
    const profession = $('cn-profession').value;
    const pass = $('cn-pass-new').value;

    if (!firstname) { setErrProfile('Veuillez entrer votre prénom.'); return; }
    if (!pass || pass.length < 6) { setErrProfile('Le mot de passe doit contenir au moins 6 caractères.'); return; }

    const btn = $('cn-profile-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="cn-spinner" style="border-top-color:#000"></span>';

    try {
      const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, set, ref } = await getFirebaseFns();
      const cred = await createUserWithEmailAndPassword(window.auth, _emailVal, pass);
      const displayName = (firstname + ' ' + lastname).trim();
      await updateProfile(cred.user, { displayName });

      // Save profile to Firebase
      if (window.db && set && ref) {
        const uid = cred.user.uid;
        await set(ref(window.db, `${DB_PATH_PREFIX}/${uid}/profile`), {
          firstname,
          lastname,
          displayName,
          profession: profession || 'non_renseigne',
          email: _emailVal,
          createdAt: Date.now()
        });
      }

      await sendEmailVerification(cred.user);
      unmount();
      // index.html handles the verify screen
    } catch (e) {
      setErrProfile(friendlyError(e.code));
      btn.disabled = false;
      btn.textContent = 'Créer mon compte';
    }
  }

  // ── SOCIAL AUTH ─────────────────────────────────────────────────────────
  async function socialAuth(provider) {
    try {
      const fns = await getFirebaseFns();
      const auth = window.auth;
      let result;
      if (provider === 'google') {
        const p = new fns.GoogleAuthProvider();
        result = await fns.signInWithPopup(auth, p);
      } else if (provider === 'microsoft') {
        const p = new fns.OAuthProvider('microsoft.com');
        result = await fns.signInWithPopup(auth, p);
      }
      if (result) {
        // Save basic profile if first sign in
        const user = result.user;
        const isNew = result._tokenResponse?.isNewUser;
        if (isNew && window.db && fns.set && fns.ref) {
          const nameParts = (user.displayName || '').split(' ');
          await fns.set(fns.ref(window.db, `${DB_PATH_PREFIX}/${user.uid}/profile`), {
            firstname: nameParts[0] || '',
            lastname: nameParts.slice(1).join(' ') || '',
            displayName: user.displayName || '',
            profession: 'non_renseigne',
            email: user.email || '',
            createdAt: Date.now()
          });
        }
        unmount();
      }
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setErr(friendlyError(e.code));
      }
    }
  }

  // ── GET FIREBASE FUNCTIONS ───────────────────────────────────────────────
  // index.html exposes auth/db globally. We also try to grab named functions.
  async function getFirebaseFns() {
    // Try from global window (index.html exposes these)
    const fns = {
      signInWithEmailAndPassword: window._fbSignIn,
      createUserWithEmailAndPassword: window._fbCreateUser,
      updateProfile: window._fbUpdateProfile,
      sendEmailVerification: window._fbSendVerification,
      fetchSignInMethodsForEmail: window._fbFetchSignInMethods,
      GoogleAuthProvider: window._fbGoogleProvider,
      OAuthProvider: window._fbOAuthProvider,
      signInWithPopup: window._fbSignInPopup,
      set: window._firebaseSet,
      ref: window._firebaseRef,
    };

    // If not pre-exposed, dynamically import from Firebase CDN (same version)
    if (!fns.signInWithEmailAndPassword) {
      const authMod = await import('https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js');
      fns.signInWithEmailAndPassword = authMod.signInWithEmailAndPassword;
      fns.createUserWithEmailAndPassword = authMod.createUserWithEmailAndPassword;
      fns.updateProfile = authMod.updateProfile;
      fns.sendEmailVerification = authMod.sendEmailVerification;
      fns.fetchSignInMethodsForEmail = authMod.fetchSignInMethodsForEmail;
      fns.GoogleAuthProvider = authMod.GoogleAuthProvider;
      fns.OAuthProvider = authMod.OAuthProvider;
      fns.signInWithPopup = authMod.signInWithPopup;
    }
    if (!fns.set) {
      const dbMod = await import('https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js');
      fns.set = dbMod.set;
      fns.ref = dbMod.ref;
    }
    return fns;
  }

  // ── UTILS ────────────────────────────────────────────────────────────────
  function validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  function setErr(msg) {
    const el = document.getElementById('cn-err');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }
  function setErrProfile(msg) {
    const el = document.getElementById('cn-err-profile');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  function friendlyError(code) {
    const map = {
      'auth/invalid-email': 'Adresse e-mail invalide.',
      'auth/user-not-found': 'Aucun compte trouvé avec cet e-mail.',
      'auth/wrong-password': 'Mot de passe incorrect.',
      'auth/email-already-in-use': 'Cet e-mail est déjà utilisé.',
      'auth/weak-password': 'Mot de passe trop faible (6 caractères minimum).',
      'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
      'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
      'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
      'auth/popup-blocked': 'Popup bloquée par le navigateur. Autorisez les popups.',
    };
    return map[code] || 'Une erreur est survenue. Réessayez.';
  }

  function openLegal(tab) {
    document.getElementById('cn-legal-overlay').classList.add('open');
    document.querySelectorAll('.cn-legal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.cn-legal-content').forEach(c => c.classList.remove('active'));
    const tabEl = document.querySelector(`.cn-legal-tab[data-tab="${tab}"]`);
    if (tabEl) tabEl.classList.add('active');
    const contentEl = document.getElementById('cn-tab-' + tab);
    if (contentEl) contentEl.classList.add('active');
  }

  // ── SHOWCASE ANIMATION ─────────────────────────────────────────────────────

  function startDemo() {
    // Init showcased feature panels
    initShowcasePills();
    // Auto-flip flashcard after delay
    setTimeout(shFcAutoFlip, 2000);
    // Start auto-rotate
    _shAutoTimer = setInterval(() => {
      shSwitchTo((_shCurrent + 1) % 4);
    }, 4400);
  }

  function initShowcasePills() {
    document.querySelectorAll('.sh-pill').forEach(p => {
      p.addEventListener('click', () => {
        const idx = parseInt(p.dataset.i);
        clearInterval(_shAutoTimer);
        shSwitchTo(idx);
        _shAutoTimer = setInterval(() => shSwitchTo((_shCurrent + 1) % 4), 4400);
      });
    });
  }

  function shSwitchTo(idx) {
    if (idx === _shCurrent) return;
    const panels = ['sh-p0','sh-p1','sh-p2','sh-p3'];
    const pills = document.querySelectorAll('.sh-pill');
    document.getElementById(panels[_shCurrent]).classList.remove('active');
    pills[_shCurrent].classList.remove('active');
    _shCurrent = idx;
    document.getElementById(panels[_shCurrent]).classList.add('active');
    pills[_shCurrent].classList.add('active');
    // Trigger panel-specific animations
    if (idx === 1) { _shQuizDone = false; setTimeout(shRunQuiz, 350); }
    if (idx === 2) { _shSourcesDone = false; setTimeout(shRunSources, 300); }
    if (idx === 3 && !_shChartBuilt) { shBuildChart(); _shChartBuilt = true; }
  }

  // Flashcard: auto-flip every 2s then advance
  function shFcAutoFlip() {
    const card = document.getElementById('sh-fc-card');
    if (!card) return;
    if (!document.getElementById('sh-p0').classList.contains('active')) {
      setTimeout(shFcAutoFlip, 600);
      return;
    }
    _shFcFlipped = true;
    card.classList.add('flipped');
    setTimeout(() => {
      card.style.transition = 'none';
      card.classList.remove('flipped');
      _shFcIdx = (_shFcIdx + 1) % SH_CARDS.length;
      setTimeout(() => {
        card.style.transition = '';
        const qEl = document.getElementById('sh-fc-q');
        const aEl = document.getElementById('sh-fc-a');
        const cEl = document.getElementById('sh-fc-counter');
        if (qEl) qEl.textContent = SH_CARDS[_shFcIdx].q;
        if (aEl) aEl.textContent = SH_CARDS[_shFcIdx].a;
        if (cEl) cEl.textContent = (_shFcIdx + 1) + ' / ' + SH_CARDS.length;
        const dots = document.querySelectorAll('.sh-fc-dot');
        dots.forEach((d, i) => {
          d.classList.toggle('done', i < _shFcIdx);
          d.classList.toggle('current', i === _shFcIdx);
        });
        _shFcFlipped = false;
      }, 60);
      setTimeout(shFcAutoFlip, 2200);
    }, 750);
  }

  function shRunQuiz() {
    if (_shQuizDone) return;
    _shQuizDone = true;
    // Reset
    ['sh-qo-a','sh-qo-b','sh-qo-c','sh-qo-d'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.className = 'sh-qz-opt';
    });
    const expl = document.getElementById('sh-qz-expl');
    if (expl) expl.classList.remove('show');

    setTimeout(() => {
      const a = document.getElementById('sh-qo-a');
      if (a) a.classList.add('highlight');
    }, 300);
    setTimeout(() => {
      const a = document.getElementById('sh-qo-a');
      if (a) { a.classList.remove('highlight'); a.classList.add('wrong'); }
    }, 900);
    setTimeout(() => {
      const c = document.getElementById('sh-qo-c');
      if (c) c.classList.add('highlight');
    }, 1300);
    setTimeout(() => {
      const c = document.getElementById('sh-qo-c');
      if (c) { c.classList.remove('highlight'); c.classList.add('wrong'); }
    }, 1850);
    setTimeout(() => {
      const b = document.getElementById('sh-qo-b');
      if (b) b.classList.add('correct');
      const expl2 = document.getElementById('sh-qz-expl');
      if (expl2) expl2.classList.add('show');
    }, 2300);
  }

  function shRunSources() {
    if (_shSourcesDone) return;
    _shSourcesDone = true;
    const cards = document.querySelectorAll('.sh-src-card');
    cards.forEach(c => c.classList.remove('in'));
    cards.forEach((c, i) => {
      setTimeout(() => c.classList.add('in'), i * 220 + 80);
    });
  }

  function shBuildChart() {
    const container = document.getElementById('sh-cht-bars');
    if (!container) return;
    container.innerHTML = '';
    const maxVal = Math.max(...SH_DATA_A, ...SH_DATA_B);
    const minVal = 50;
    SH_MONTHS.forEach((m, i) => {
      const col = document.createElement('div');
      col.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;position:relative;gap:3px';
      const pair = document.createElement('div');
      pair.style.cssText = 'display:flex;gap:2px;align-items:flex-end;width:100%';
      const barA = document.createElement('div');
      barA.style.cssText = 'flex:1;border-radius:3px 3px 0 0;background:#6e6eff;opacity:0.85;height:0;transition:height 1.1s cubic-bezier(0.34,1.05,0.64,1)';
      const barB = document.createElement('div');
      barB.style.cssText = 'flex:1;border-radius:3px 3px 0 0;background:#a855f7;opacity:0.75;height:0;transition:height 1.1s cubic-bezier(0.34,1.05,0.64,1)';
      pair.appendChild(barA);
      pair.appendChild(barB);
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:0.58rem;color:#444;position:absolute;bottom:0;white-space:nowrap;font-family:Geist,sans-serif';
      lbl.textContent = m;
      col.appendChild(pair);
      col.appendChild(lbl);
      container.appendChild(col);
      const pctA = ((SH_DATA_A[i] - minVal) / (maxVal - minVal) * 100);
      const pctB = ((SH_DATA_B[i] - minVal) / (maxVal - minVal) * 100);
      setTimeout(() => {
        barA.style.height = Math.round(pctA * 1.05) + 'px';
        barB.style.height = Math.round(pctB * 1.05) + 'px';
      }, i * 110 + 200);
    });
  }

    // ── BOOT ─────────────────────────────────────────────────────────────────
  // Expose Firebase auth functions so connect.js can use them even if the
  // main module hasn't run yet. index.html should add these to window:
  //   window._fbSignIn = signInWithEmailAndPassword;
  //   window._fbCreateUser = createUserWithEmailAndPassword;
  //   window._fbUpdateProfile = updateProfile;
  //   window._fbSendVerification = sendEmailVerification;
  //   window._fbGoogleProvider = GoogleAuthProvider;
  //   window._fbOAuthProvider = OAuthProvider;
  //   window._fbSignInPopup = signInWithPopup;
  //   window._fbAuthFns = { onAuthStateChanged };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
