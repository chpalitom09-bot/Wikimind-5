// ==================== CONFIGURATION ====================
const FLASHCARDS_PNG = "flashcards.png"; // Doit être dans le même dossier que index.html
const FIREBASE_PATH = "wikimind5/users";
const LOCALSTORAGE_KEY = "wm_flashcards_decks";

// ==================== ÉTAT GLOBAL ====================
let FlashcardsManager = {
  activeTool: null,
  currentDeckId: null,
  isPanelOpen: false,
  isLoading: false,
  decks: [],
  currentConversationId: null,
  messageObservers: [],

  // Initialisation
  init() {
    this.injectToolsMenuItem();
    this.injectToolsPanel();
    this.setupEventListeners();
    this.loadDecks();
    this.setupMessageObserver();
  },

  // ==================== INJECTION HTML ====================
  injectToolsMenuItem() {
    const plusMenu = document.getElementById("plus-menu");
    if (!plusMenu) return;

    const outilsItem = document.createElement("div");
    outilsItem.className = "menu-item outils";
    outilsItem.innerHTML = `
      <span class="menu-icon">🧰</span>
      <span class="menu-label">Outils</span>
    `;
    outilsItem.addEventListener("click", () => this.toggleToolsPanel());
    plusMenu.appendChild(outilsItem);
  },

  injectToolsPanel() {
    // Le panneau est déjà dans index.html
    this.renderToolsList();
  },

  // ==================== GESTION DU PANNEAU OUTILS ====================
  toggleToolsPanel() {
    const panel = document.getElementById("tools-panel");
    if (!panel) return;

    panel.classList.toggle("open");
    this.isPanelOpen = panel.classList.contains("open");
  },

  renderToolsList() {
    const toolsList = document.getElementById("tools-list");
    if (!toolsList) return;

    const tools = [
      {
        id: "flashcards",
        name: "Générateur de Flashcards",
        description: "Créez des cartes mémoire pour réviser",
        icon: FLASHCARDS_PNG,
        active: this.activeTool === "flashcards"
      }
      // Ajoutez d'autres outils ici plus tard
    ];

    toolsList.innerHTML = tools.map(tool => `
      <div class="tool-item ${tool.active ? 'active' : ''}" data-tool-id="${tool.id}">
        <div class="tool-icon">
          ${tool.icon ? `<img src="${tool.icon}" alt="${tool.name}" style="width:20px;height:20px;">` : "📚"}
        </div>
        <div class="tool-info">
          <div class="tool-name">${tool.name}</div>
          <div class="tool-description">${tool.description}</div>
        </div>
        ${tool.active ? '<div class="activation-indicator"></div>' : ''}
      </div>
    `).join("");

    // Ajouter les écouteurs
    toolsList.querySelectorAll(".tool-item").forEach(item => {
      item.addEventListener("click", () => {
        const toolId = item.dataset.toolId;
        this.toggleTool(toolId);
      });
    });
  },

  // ==================== GESTION DES OUTILS ====================
  toggleTool(toolId) {
    if (this.activeTool === toolId) {
      this.activeTool = null;
    } else {
      this.activeTool = toolId;
    }

    this.renderToolsList();
    this.toggleToolsPanel();

    if (this.activeTool === "flashcards") {
      this.activateFlashcardsTool();
    } else {
      this.deactivateFlashcardsTool();
    }
  },

  activateFlashcardsTool() {
    // Afficher le message de chargement
    this.showLoading("Ouverture de Flashcards 5.1");

    // Simuler le chargement (à remplacer par la vraie logique)
    setTimeout(() => {
      this.showLoading("Création des Flashcards");
    }, 1000);

    setTimeout(() => {
      this.showLoading("Finalisation des Flashcards");
      this.hideLoading();
    }, 2000);

    // Notifier l'IA que l'outil est activé
    this.notifyAIToolActivated();
  },

  deactivateFlashcardsTool() {
    this.activeTool = null;
    this.notifyAIToolDeactivated();
  },

  notifyAIToolActivated() {
    // Envoyer un événement pour que l'IA sache que Flashcards est activé
    const event = new CustomEvent("wikimind:toolActivated", {
      detail: { toolId: "flashcards" }
    });
    window.dispatchEvent(event);
  },

  notifyAIToolDeactivated() {
    const event = new CustomEvent("wikimind:toolDeactivated", {
      detail: { toolId: "flashcards" }
    });
    window.dispatchEvent(event);
  },

  // ==================== CHARGEMENT ET SAUVEGARDE ====================
  async loadDecks() {
    try {
      if (window.auth && window.auth.currentUser) {
        const uid = window.auth.currentUser.uid;
        const ref = window.db.ref(`${FIREBASE_PATH}/${uid}/flashcards`);
        ref.on("value", (snapshot) => {
          this.decks = [];
          snapshot.forEach((childSnapshot) => {
            const deck = childSnapshot.val();
            if (deck) {
              this.decks.push({
                id: childSnapshot.key,
                ...deck
              });
            }
          });
        });
      } else {
        // Fallback localStorage
        const saved = localStorage.getItem(LOCALSTORAGE_KEY);
        this.decks = saved ? JSON.parse(saved) : [];
      }
    } catch (error) {
      console.error("Erreur de chargement des decks:", error);
      // Fallback localStorage
      const saved = localStorage.getItem(LOCALSTORAGE_KEY);
      this.decks = saved ? JSON.parse(saved) : [];
    }
  },

  async saveDeck(deck) {
    try {
      if (window.auth && window.auth.currentUser) {
        const uid = window.auth.currentUser.uid;
        const ref = window.db.ref(`${FIREBASE_PATH}/${uid}/flashcards/${deck.id}`);
        await ref.set(deck);
      } else {
        // Fallback localStorage
        const existing = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || "[]");
        const index = existing.findIndex(d => d.id === deck.id);
        if (index >= 0) {
          existing[index] = deck;
        } else {
          existing.push(deck);
        }
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(existing));
      }
    } catch (error) {
      console.error("Erreur de sauvegarde du deck:", error);
    }
  },

  // ==================== GÉNÉRATION DES FLASHCARDS ====================
  showLoading(message) {
    this.isLoading = true;
    const loadingElement = document.createElement("div");
    loadingElement.className = "flashcards-loading";
    loadingElement.innerHTML = `
      <img src="${FLASHCARDS_PNG}" alt="Chargement...">
      <span class="progress-text">${message}</span>
    `;

    // Ajouter au conteneur des messages (à adapter selon votre structure)
    const messagesContainer = document.querySelector(".messages-container") ||
                              document.querySelector("#chat-container") ||
                              document.body;
    messagesContainer.appendChild(loadingElement);

    // Faire défiler vers le bas
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  },

  hideLoading() {
    this.isLoading = false;
    const loadingElements = document.querySelectorAll(".flashcards-loading");
    loadingElements.forEach(el => el.remove());
  },

  // Appelée quand l'IA génère des flashcards
  createFlashcardsFromAI(flashcardsData) {
    if (!this.activeTool === "flashcards") return;

    const deckId = `deck_${Date.now()}`;
    const deck = {
      id: deckId,
      name: flashcardsData.title || "Nouveau Deck",
      description: flashcardsData.description || "",
      cards: flashcardsData.cards || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.decks.push(deck);
    this.saveDeck(deck);

    // Afficher l'attachement
    this.displayFlashcardsAttachment(deck);

    return deckId;
  },

  displayFlashcardsAttachment(deck) {
    const attachment = document.createElement("div");
    attachment.className = "flashcards-attachment";
    attachment.dataset.deckId = deck.id;
    attachment.innerHTML = `
      <div class="attachment-icon">
        <img src="${FLASHCARDS_PNG}" alt="Flashcards">
      </div>
      <div class="attachment-info">
        <div class="attachment-title">${deck.name}</div>
        <div class="attachment-meta">${deck.cards.length} cartes</div>
      </div>
    `;

    attachment.addEventListener("click", () => this.openFlashcardsPanel(deck.id));

    // Ajouter au conteneur des messages
    const messagesContainer = document.querySelector(".messages-container") ||
                              document.querySelector("#chat-container") ||
                              document.body;
    messagesContainer.appendChild(attachment);

    // Faire défiler vers le bas
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  },

  // ==================== PANNEAU D'ÉDITION ====================
  openFlashcardsPanel(deckId) {
    this.currentDeckId = deckId;
    const deck = this.decks.find(d => d.id === deckId);
    if (!deck) return;

    const panel = document.getElementById("flashcards-panel");
    if (!panel) return;

    panel.classList.add("open");
    this.renderDeckContent(deck);
  },

  closeFlashcardsPanel() {
    const panel = document.getElementById("flashcards-panel");
    if (panel) {
      panel.classList.remove("open");
    }
    this.currentDeckId = null;
  },

  renderDeckContent(deck) {
    const panel = document.getElementById("flashcards-panel");
    if (!panel) return;

    const header = panel.querySelector(".panel-header .panel-title");
    if (header) header.textContent = deck.name;

    const content = panel.querySelector(".panel-content");
    if (!content) return;

    content.innerHTML = `
      <div class="deck-list">
        ${deck.cards.map((card, index) => `
          <div class="deck-item" data-card-index="${index}">
            <div class="deck-name">Carte ${index + 1}</div>
            <div class="deck-count">${card.front.substring(0, 50)}...</div>
          </div>
        `).join("")}
      </div>

      <div class="card-editor">
        <div class="editor-header">
          <div class="editor-title">Éditeur de carte</div>
          <div class="editor-actions">
            <button id="edit-card-btn">✏️ Modifier</button>
            <button id="ai-edit-btn">🤖 Éditer avec IA</button>
            <button id="delete-card-btn">🗑️ Supprimer</button>
          </div>
        </div>
        <div class="card-preview">
          ${deck.cards.length > 0 ? this.renderCard(deck.cards[0]) : "<p>Aucune carte sélectionnée</p>"}
        </div>
      </div>
    `;

    // Ajouter les écouteurs
    content.querySelectorAll(".deck-item").forEach(item => {
      item.addEventListener("click", () => {
        const cardIndex = parseInt(item.dataset.cardIndex);
        this.showCard(deck, cardIndex);
      });
    });

    document.getElementById("edit-card-btn")?.addEventListener("click", () => {
      const cardIndex = 0; // À adapter
      this.editCardManually(deck, cardIndex);
    });

    document.getElementById("ai-edit-btn")?.addEventListener("click", () => {
      const cardIndex = 0; // À adapter
      this.editCardWithAI(deck, cardIndex);
    });

    document.getElementById("delete-card-btn")?.addEventListener("click", () => {
      const cardIndex = 0; // À adapter
      this.deleteCard(deck, cardIndex);
    });
  },

  renderCard(card) {
    return `
      <div class="flashcard front">
        <div class="flashcard-content">${card.front}</div>
      </div>
      <div class="flashcard back" style="display:none;">
        <div class="flashcard-content">${card.back}</div>
      </div>
    `;
  },

  showCard(deck, cardIndex) {
    const card = deck.cards[cardIndex];
    const preview = document.querySelector(".card-preview");
    if (!preview) return;

    preview.innerHTML = this.renderCard(card);

    // Ajouter l'écouteur pour le flip
    const flashcard = preview.querySelector(".flashcard");
    if (flashcard) {
      flashcard.addEventListener("click", () => {
        const back = preview.querySelector(".back");
        if (back.style.display === "none") {
          back.style.display = "block";
          flashcard.querySelector(".front").style.display = "none";
        } else {
          back.style.display = "none";
          flashcard.querySelector(".front").style.display = "block";
        }
      });
    }
  },

  editCardManually(deck, cardIndex) {
    const card = deck.cards[cardIndex];
    const newFront = prompt("Nouveau recto:", card.front);
    if (newFront === null) return;

    const newBack = prompt("Nouveau verso:", card.back);
    if (newBack === null) return;

    card.front = newFront;
    card.back = newBack;
    deck.updatedAt = new Date().toISOString();
    this.saveDeck(deck);
    this.renderDeckContent(deck);
  },

  editCardWithAI(deck, cardIndex) {
    // À implémenter: appeler l'IA pour éditer la carte
    alert("Édition avec IA à implémenter");
  },

  deleteCard(deck, cardIndex) {
    if (!confirm("Voulez-vous vraiment supprimer cette carte?")) return;

    deck.cards.splice(cardIndex, 1);
    deck.updatedAt = new Date().toISOString();
    this.saveDeck(deck);
    this.renderDeckContent(deck);
  },

  // ==================== OBSERVATEUR DE MESSAGES ====================
  setupMessageObserver() {
    // Observer les nouveaux messages pour détecter les mots-clés
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const text = node.textContent?.toLowerCase() || "";
            if (text.includes("flashcard") || text.includes("fiche de révision") || text.includes("cartes mémoire")) {
              if (this.activeTool === "flashcards") {
                // Extraire les flashcards du message
                const flashcardsData = this.extractFlashcardsFromMessage(node);
                if (flashcardsData) {
                  this.createFlashcardsFromAI(flashcardsData);
                }
              }
            }
          }
        });
      });
    });

    const messagesContainer = document.querySelector(".messages-container") ||
                              document.querySelector("#chat-container") ||
                              document.body;
    observer.observe(messagesContainer, { childList: true, subtree: true });
    this.messageObservers.push(observer);
  },

  extractFlashcardsFromMessage(node) {
    // Logique pour extraire les flashcards d'un message AI
    // Exemple: chercher des sections comme "Flashcard 1: ...", "Question: ...", "Réponse: ..."
    const text = node.textContent;
    const cards = [];

    // Regex pour détecter les flashcards (à adapter selon le format de l'IA)
    const flashcardRegex = /(?:Flashcard|Carte) \d+: ([^\n]+)\nQuestion: ([^\n]+)\nRéponse: ([^\n]+)/gi;
    let match;

    while ((match = flashcardRegex.exec(text)) !== null) {
      cards.push({
        front: match[2].trim(),
        back: match[3].trim()
      });
    }

    if (cards.length > 0) {
      return {
        title: "Flashcards générées",
        description: `Généré à partir de la conversation - ${cards.length} cartes`,
        cards: cards
      };
    }

    return null;
  },

  // ==================== NETTOYAGE ====================
  cleanup() {
    this.messageObservers.forEach(observer => observer.disconnect());
    this.messageObservers = [];
  }
};

// ==================== INITIALISATION ====================
document.addEventListener("DOMContentLoaded", () => {
  FlashcardsManager.init();

  // Fermer les panneaux en cliquant à l'extérieur
  document.addEventListener("click", (e) => {
    const toolsPanel = document.getElementById("tools-panel");
    const flashcardsPanel = document.getElementById("flashcards-panel");

    if (toolsPanel && !toolsPanel.contains(e.target) && !e.target.closest(".menu-item.outils")) {
      toolsPanel.classList.remove("open");
      FlashcardsManager.isPanelOpen = false;
    }

    if (flashcardsPanel && !flashcardsPanel.contains(e.target)) {
      flashcardsPanel.classList.remove("open");
      FlashcardsManager.currentDeckId = null;
    }
  });
});

// Exposer globalement pour l'IA
window.FlashcardsManager = FlashcardsManager;
