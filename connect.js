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

  <!-- ── RIGHT — MODÈLES LIVE ── -->
  <div id="cn-right">
    <div id="cn-models-panel">
      <div class="cmp-panel-header">
        <div class="cmp-panel-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
          Modèles disponibles
        </div>
        <div class="cmp-live-row">
          <div class="cmp-live-dot"></div>
          <span>Live</span>
        </div>
      </div>

      <div class="cmp-provider-tabs" id="cmp-prov-tabs">
        <button class="cmp-ptab active" data-prov="all">Tous</button>
        <button class="cmp-ptab" data-prov="mistral">Mistral</button>
        <button class="cmp-ptab" data-prov="groq">Groq</button>
        <button class="cmp-ptab" data-prov="cerebras">Cerebras</button>
      </div>

      <div class="cmp-models-list" id="cmp-models-list">
        <div class="cmp-loading">
          <div class="cmp-spinner"></div>
        </div>
      </div>

      <div class="cmp-panel-footer">
        <span id="cmp-footer-count">—</span>
        <span id="cmp-footer-time">—</span>
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

  // ── STATE ───────────────────────────────────────────────────────────────
  let _step = 'email';
  let _emailVal = '';
  let _mounted = false;
  let _authReady = false;
  let _demoTimer = null;

  // Models panel state
  let _modelsData = null;
  let _modelsFilter = 'all';

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

  // ── MODELS PANEL ────────────────────────────────────────────────────────

  const MODELS_META = {
    "mistral-small-latest":    { name:"Small 5.1",    provider:"mistral" },
    "mistral-medium-latest":   { name:"Medium 5.1",   provider:"mistral" },
    "codestral-latest":        { name:"Code 5.1",     provider:"mistral" },
    "mistral-large-latest":    { name:"Large 5.1",    provider:"mistral" },
    "llama-3.2-3b-preview":    { name:"Flash 1.1",    provider:"groq" },
    "gemma2-9b-it":            { name:"Flash 1.2",    provider:"groq" },
    "zai-glm-4.7":             { name:"Flash 1.3",    provider:"cerebras" },
    "ministral-3b-2512":       { name:"Flash 1.4",    provider:"mistral" },
    "labs-leanstral-2603":     { name:"Flash 1.5",    provider:"mistral" },
    "llama-3.1-8b-instant":    { name:"Flash 1.0",    provider:"groq" },
    "ministral-3b-latest":     { name:"Small 4.7",    provider:"mistral" },
    "llama-3.3-70b-versatile": { name:"Medium 5.3",   provider:"groq" },
    "ministral-14b-2512":      { name:"Medium 5.4",   provider:"mistral" },
    "mistral-medium-2505":     { name:"Medium 5.5",   provider:"mistral" },
    "mistral-medium-2508":     { name:"Medium 5.6",   provider:"mistral" },
    "magistral-medium-2509":   { name:"Medium 5.7",   provider:"mistral" },
    "compound":                { name:"Compound 1.0", provider:"groq" },
    "llama-3.3-70b-versatile": { name:"Medium 5.3",   provider:"groq" },
    "deepseek-r1-distill-llama-70b": { name:"Large 5.4", provider:"groq" },
    "gpt-oss-120b":            { name:"Large 5.6",    provider:"cerebras" },
    "mistral-large-2512":      { name:"Large 5.7",    provider:"mistral" },
    "codestral-2508":          { name:"Large 5.8",    provider:"mistral" },
    "devstral-2512":           { name:"Large 5.9",    provider:"mistral" },
  };

  const PROV_COLORS = {
    mistral:  "#ff7000",
    groq:     "#f55036",
    cerebras: "#9b6eff",
  };

  const PROV_NAMES = { mistral:"Mistral", groq:"Groq", cerebras:"Cerebras" };

  function startDemo() {
    // Init provider filter tabs
    document.querySelectorAll('.cmp-ptab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cmp-ptab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _modelsFilter = btn.dataset.prov;
        renderModelsList();
      });
    });
    loadModelsData();
  }

  function loadModelsData() {
    // Try to fetch from Firebase public stats
    const DB_URL = 'https://wikimind-3-comments-default-rtdb.europe-west1.firebasedatabase.app/wikimind5_public_stats.json?orderBy="$key"&limitToLast=500';
    fetch(DB_URL)
      .then(r => r.ok ? r.json() : null)
      .then(raw => {
        if (!raw) { showModelsError(); return; }
        _modelsData = processModelsData(raw);
        renderModelsList();
        updateFooter();
      })
      .catch(() => {
        // Fallback: show static known models without stats
        _modelsData = fallbackModels();
        renderModelsList();
        updateFooter();
      });
  }

  function processModelsData(raw) {
    const byModel = {};
    Object.values(raw).forEach(entry => {
      if (!entry || !entry.model) return;
      const k = entry.model;
      if (!byModel[k]) byModel[k] = { count: 0, totalCps: 0, totalTime: 0, cpsN: 0, timeN: 0 };
      byModel[k].count++;
      if (entry.cps && entry.cps > 0) { byModel[k].totalCps += entry.cps; byModel[k].cpsN++; }
      if (entry.responseTime && entry.responseTime > 0) { byModel[k].totalTime += entry.responseTime; byModel[k].timeN++; }
    });
    return Object.entries(byModel)
      .map(([modelId, d]) => {
        const meta = MODELS_META[modelId] || { name: modelId.split('-')[0], provider: 'mistral' };
        return {
          modelId, ...meta,
          count: d.count,
          cps: d.cpsN > 0 ? Math.round(d.totalCps / d.cpsN) : null,
          avgTime: d.timeN > 0 ? Math.round(d.totalTime / d.timeN) : null,
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  function fallbackModels() {
    return Object.entries(MODELS_META).slice(0, 12).map(([modelId, meta]) => ({
      modelId, ...meta, count: null, cps: null, avgTime: null
    }));
  }

  function renderModelsList() {
    const list = document.getElementById('cmp-models-list');
    if (!list || !_modelsData) return;
    const filtered = _modelsFilter === 'all'
      ? _modelsData
      : _modelsData.filter(m => m.provider === _modelsFilter);
    if (!filtered.length) {
      list.innerHTML = '<div class="cmp-empty">Aucun modèle</div>';
      return;
    }
    const maxCps = Math.max.apply(null, filtered.map(function(m){return m.cps||0;}).concat([1]));
    list.innerHTML = filtered.map(function(m) {
      const provCol = PROV_COLORS[m.provider] || '#888';
      const cpsBar = m.cps ? Math.round((m.cps / maxCps) * 100) : 0;
      const cpsLabel = m.cps ? m.cps + ' c/s' : '—';
      const timeLabel = m.avgTime ? (m.avgTime > 1000 ? (m.avgTime/1000).toFixed(1)+'s' : m.avgTime+'ms') : '—';
      const countLabel = m.count ? (m.count >= 1000 ? (m.count/1000).toFixed(1)+'k' : m.count) : '—';
      const initials = (PROV_NAMES[m.provider] || '?')[0];
      const rgb = hexToRgb(provCol);
      return '<div class="cmp-model-row">' +
        '<div class="cmp-model-logo" style="background:rgba('+rgb+',0.12);border-color:rgba('+rgb+',0.2);color:'+provCol+'">'+initials+'</div>' +
        '<div class="cmp-model-info">' +
          '<div class="cmp-model-name">'+escHtml(m.name)+'</div>' +
          '<div class="cmp-model-prov" style="color:'+provCol+'">'+escHtml(PROV_NAMES[m.provider] || m.provider)+'</div>' +
        '</div>' +
        '<div class="cmp-model-stats">' +
          '<div class="cmp-model-cps">'+cpsLabel+'</div>' +
          '<div class="cmp-cps-bar-track"><div class="cmp-cps-bar-fill" style="width:'+cpsBar+'%;background:'+provCol+'"></div></div>' +
        '</div>' +
        '<div class="cmp-model-meta">' +
          '<div class="cmp-meta-time">'+timeLabel+'</div>' +
          '<div class="cmp-meta-count">'+countLabel+'</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return r+','+g+','+b;
  }

  function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function showModelsError() {
    const list = document.getElementById('cmp-models-list');
    if (list) list.innerHTML = '<div class="cmp-empty">Données indisponibles</div>';
  }

  function updateFooter() {
    const countEl = document.getElementById('cmp-footer-count');
    const timeEl = document.getElementById('cmp-footer-time');
    if (countEl && _modelsData) {
      const total = _modelsData.reduce((a, m) => a + (m.count || 0), 0);
      countEl.textContent = total > 0 ? total.toLocaleString('fr') + ' réponses analysées' : _modelsData.length + ' modèles';
    }
    if (timeEl) {
      const now = new Date();
      timeEl.textContent = 'Actualisé ' + now.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
    }
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
