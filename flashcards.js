// ========== FLASHCARDS MODULE ==========
class FlashcardsManager {
  constructor() {
    this.isActive = false;
    this.isGenerating = false;
    this.currentDeck = null;
    this.flipStates = new Map();
    this.editorState = { isOpen: false, deckId: null, question: '', answer: '' };

    // Firebase references
    this.db = window.db;
    this.auth = window.auth;
    this.userId = null;
    this.flashcardsRef = null;
    this.useLocalStorage = false;

    // Fallback si Firebase n'est pas disponible
    if (!this.db || !this.auth) {
      this.useLocalStorage = true;
      console.warn("Firebase non disponible, utilisation du localStorage");
    }

    // Initialize when user is authenticated
    if (this.auth) {
      this.auth.onAuthStateChanged((user) => {
        if (user) {
          this.userId = user.uid;
          this.flashcardsRef = this.db ? this.db.ref(`wikimind5/users/${this.userId}/flashcards`) : null;
        } else {
          this.userId = null;
          this.flashcardsRef = null;
        }
      });
    } else {
      // Mode invité : utiliser l'ID localStorage
      this.userId = localStorage.getItem("wikimind_guest_id");
      if (this.userId) {
        this.flashcardsRef = this.db ? this.db.ref(`wikimind5/users/${this.userId}/flashcards`) : null;
      }
    }

    this.initDOM();
    this.bindEvents();
    this.injectPlusMenuItem();
  }

  initDOM() {
    // Create overlay for flashcards panel
    const overlay = document.createElement('div');
    overlay.id = 'flashcards-overlay';
    overlay.innerHTML = `
      <div id="flashcards-panel">
        <div id="flashcards-header">
          <div id="flashcards-title">
            <img src="flashcards.png" alt="Flashcards" style="width: 20px; height: 20px;" />
            <span>Mes Flashcards</span>
          </div>
          <button id="flashcards-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div id="flashcards-body">
          <div class="flashcard-empty">Aucune flashcard pour le moment. Générez-en une pour commencer !</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  injectPlusMenuItem() {
    const plusMenu = document.getElementById('plus-menu');
    if (!plusMenu) return;

    // Add "Outils" item if not exists
    let outilsItem = plusMenu.querySelector('.pm-item#pm-tools');
    if (!outilsItem) {
      outilsItem = document.createElement('div');
      outilsItem.className = 'pm-item';
      outilsItem.id = 'pm-tools';
      outilsItem.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span>Outils</span>
      `;
      outilsItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openToolsPanel();
      });
      // Insert before Agents or at the end
      const agentsItem = plusMenu.querySelector('#pm-agents');
      plusMenu.insertBefore(outilsItem, agentsItem || plusMenu.lastChild);
    }
  }

  openToolsPanel() {
    this.renderToolsGrid();
    document.getElementById('tools-panel').classList.add('open');
    document.getElementById('plus-menu').classList.remove('open');
  }

  closeToolsPanel() {
    document.getElementById('tools-panel').classList.remove('open');
  }

  renderToolsGrid() {
    const grid = document.getElementById('tools-grid');
    if (!grid) return;

    grid.innerHTML = `
      <div class="tool-card ${this.isActive ? 'active' : ''}" data-tool="flashcards">
        <div class="tool-card-icon">
          <img src="flashcards.png" alt="Flashcards" width="28" height="28">
        </div>
        <div class="tool-card-info">
          <div class="tool-card-name">Générateur de Flashcards</div>
          <div class="tool-card-desc">Créez des cartes mémoire pour réviser</div>
        </div>
        <div class="tool-card-status ${this.isActive ? 'connected' : 'disconnected'}">
          <div class="tool-status-dot"></div>
          ${this.isActive ? 'Actif' : 'Disponible'}
        </div>
      </div>
    `;

    // Bind click event
    grid.querySelector('.tool-card').addEventListener('click', () => {
      this.toggleFlashcards();
      this.closeToolsPanel();
    });
  }

  bindEvents() {
    // Close flashcards panel
    document.getElementById('flashcards-close')?.addEventListener('click', () => this.closePanel());
    document.getElementById('flashcards-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'flashcards-overlay') this.closePanel();
    });

    // Close tools panel
    document.getElementById('tools-panel-back')?.addEventListener('click', () => this.closeToolsPanel());
    document.getElementById('tools-panel')?.addEventListener('click', (e) => {
      if (e.target.id === 'tools-panel') this.closeToolsPanel();
    });

    // Detect flashcard requests in user messages
    this.setupMessageObserver();
  }

  setupMessageObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('msg-group')) {
            const bubble = node.querySelector('.bubble.user');
            if (bubble) {
              const text = bubble.textContent.toLowerCase();
              const flashcardKeywords = [
                'flashcard', 'flash cards', 'fiche de révision', 'cartes mémoire',
                'carte recto verso', 'quiz mémoire', 'apprendre par cœur'
              ];
              if (flashcardKeywords.some(keyword => text.includes(keyword))) {
                this.activateFlashcardsMode();
              }
            }
          }
        });
      });
    });

    const chatArea = document.getElementById('chat-area');
    if (chatArea) {
      observer.observe(chatArea, { childList: true });
    }
  }

  // ========== CORE METHODS ==========
  toggleFlashcards() {
    this.isActive = !this.isActive;
    const panel = document.getElementById('flashcards-panel');
    const overlay = document.getElementById('flashcards-overlay');

    if (this.isActive) {
      // Activer l'outil
      panel.classList.add('open');
      overlay.classList.add('open');
      this.loadFlashcards();

      // Mettre à jour l'interface
      const toolCard = document.querySelector('.tool-card[data-tool="flashcards"]');
      if (toolCard) {
        toolCard.classList.add('active');
        toolCard.querySelector('.tool-card-status').innerHTML = '<div class="tool-status-dot" style="background:#4ade80;"></div> Actif';
      }
    } else {
      // Désactiver l'outil
      panel.classList.remove('open');
      overlay.classList.remove('open');

      // Mettre à jour l'interface
      const toolCard = document.querySelector('.tool-card[data-tool="flashcards"]');
      if (toolCard) {
        toolCard.classList.remove('active');
        toolCard.querySelector('.tool-card-status').innerHTML = '<div class="tool-status-dot"></div> Disponible';
      }
    }
  }

  closePanel() {
    document.getElementById('flashcards-panel')?.classList.remove('open');
    document.getElementById('flashcards-overlay')?.classList.remove('open');
    this.editorState.isOpen = false;
  }

  activateFlashcardsMode() {
    if (this.isActive) return;
    this.isActive = true;
    this.showThinkingAnimation();

    // Mettre à jour l'interface
    const toolCard = document.querySelector('.tool-card[data-tool="flashcards"]');
    if (toolCard) {
      toolCard.classList.add('active');
      toolCard.querySelector('.tool-card-status').innerHTML = '<div class="tool-status-dot" style="background:#4ade80;"></div> Actif';
    }
  }

  deactivateFlashcardsMode() {
    this.isActive = false;
    this.isGenerating = false;

    // Mettre à jour l'interface
    const toolCard = document.querySelector('.tool-card[data-tool="flashcards"]');
    if (toolCard) {
      toolCard.classList.remove('active');
      toolCard.querySelector('.tool-card-status').innerHTML = '<div class="tool-status-dot"></div> Disponible';
    }
  }

  showThinkingAnimation() {
    const lastUserMsg = document.querySelector('.msg-group.user:last-of-type');
    if (!lastUserMsg) return;

    const thinkingEl = document.createElement('div');
    thinkingEl.className = 'flashcard-thinking';
    thinkingEl.innerHTML = `
      <div class="flashcard-thinking-icon">
        <img src="flashcards.png" alt="Flashcards" />
      </div>
      <span>Ouverture de Flashcards 5.1</span>
      <div class="flashcard-thinking-dots">
        <span></span><span></span><span></span>
      </div>
    `;
    lastUserMsg.appendChild(thinkingEl);

    // Simulate progress
    setTimeout(() => {
      const span = thinkingEl.querySelector('span');
      if (span) span.textContent = 'Création des Flashcards';
    }, 1500);

    setTimeout(() => {
      const span = thinkingEl.querySelector('span');
      if (span) span.textContent = 'Finalisation des Flashcards';
    }, 3000);
  }

  // ========== FLASHCARDS MANAGEMENT ==========
  async loadFlashcards() {
    if (this.useLocalStorage) {
      const decks = JSON.parse(localStorage.getItem('wm_flashcards_decks') || '[]');
      this.renderFlashcards(decks);
      return;
    }

    if (!this.flashcardsRef) return;

    try {
      const snapshot = await this.flashcardsRef.once('value');
      const decks = snapshot.val() || {};
      this.renderFlashcards(decks);
    } catch (error) {
      console.error('Error loading flashcards:', error);
    }
  }

  renderFlashcards(decks) {
    const body = document.getElementById('flashcards-body');
    if (!body) return;

    // Convertir en array si c'est un objet Firebase
    const decksArray = Array.isArray(decks) ? decks : Object.entries(decks).map(([id, deck]) => ({ id, ...deck }));

    if (decksArray.length === 0) {
      body.innerHTML = '<div class="flashcard-empty">Aucune flashcard pour le moment. Générez-en une pour commencer !</div>';
      return;
    }

    let html = '<div class="flashcard-list">';
    decksArray.forEach((deck) => {
      const deckId = deck.id || Object.keys(decks).find(key => decks[key] === deck);
      html += `
        <div class="flashcard-item" data-deck-id="${deckId}" data-flipped="false">
          <div class="flashcard-front">
            <div class="flashcard-question">${deck.name || 'Deck sans nom'}</div>
            <div class="flashcard-answer">${deck.cards?.length || 0} cartes</div>
          </div>
          <div class="flashcard-back">
            <div class="flashcard-answer">Deck: ${deck.name || 'Sans nom'}</div>
          </div>
          <div class="flashcard-actions">
            <button class="flashcard-action-btn edit" title="Modifier">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/></svg>
            </button>
            <button class="flashcard-action-btn ai-edit" title="Modifier par IA">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </button>
            <button class="flashcard-action-btn delete" title="Supprimer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    });
    html += '</div>';
    body.innerHTML = html;

    this.bindFlashcardEvents();
  }

  bindFlashcardEvents() {
    document.querySelectorAll('.flashcard-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.flashcard-actions')) return;
        const isFlipped = item.dataset.flipped === 'true';
        item.dataset.flipped = !isFlipped;
        item.classList.toggle('flip', !isFlipped);
      });

      item.querySelector('.edit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const deckId = item.dataset.deckId;
        this.openEditor(deckId);
      });

      item.querySelector('.ai-edit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const deckId = item.dataset.deckId;
        this.editWithAI(deckId);
      });

      item.querySelector('.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const deckId = item.dataset.deckId;
        this.deleteDeck(deckId);
      });
    });
  }

  openEditor(deckId) {
    if (this.useLocalStorage) {
      const decks = JSON.parse(localStorage.getItem('wm_flashcards_decks') || '[]');
      const deck = decks[deckId];
      if (deck) {
        this.editorState = {
          isOpen: true,
          deckId: deckId,
          name: deck.name || '',
          cards: deck.cards || []
        };
        this.renderEditor();
      }
      return;
    }

    if (!this.flashcardsRef) return;

    this.flashcardsRef.child(deckId).once('value', (snapshot) => {
      const deck = snapshot.val() || {};
      this.editorState = {
        isOpen: true,
        deckId: deckId,
        name: deck.name || '',
        cards: deck.cards || []
      };
      this.renderEditor();
    });
  }

  renderEditor() {
    const body = document.getElementById('flashcards-body');
    if (!body) return;

    let cardsHTML = '';
    this.editorState.cards.forEach((card, index) => {
      cardsHTML += `
        <div class="flashcard-editor-field">
          <label class="flashcard-editor-label">Carte ${index + 1}</label>
          <input type="text" class="flashcard-editor-input card-question" placeholder="Question ou terme" value="${this.escapeHtml(card.question || '')}" data-index="${index}">
          <input type="text" class="flashcard-editor-input card-answer" placeholder="Réponse ou définition" value="${this.escapeHtml(card.answer || '')}" data-index="${index}" style="margin-top: 6px;">
        </div>
      `;
    });

    body.innerHTML = `
      <div class="flashcard-editor">
        <div class="flashcard-editor-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/></svg>
          <span>Modifier le deck</span>
        </div>
        <div class="flashcard-editor-field">
          <label class="flashcard-editor-label">Nom du deck</label>
          <input type="text" class="flashcard-editor-input" id="deck-name-input" placeholder="Nom du deck" value="${this.escapeHtml(this.editorState.name || '')}">
        </div>
        <div id="cards-container">${cardsHTML}</div>
        <div class="flashcard-editor-actions">
          <button class="flashcard-editor-btn secondary" id="add-card-btn">+ Ajouter une carte</button>
          <button class="flashcard-editor-btn primary" id="save-deck-btn">Enregistrer</button>
        </div>
      </div>
    `;

    document.getElementById('add-card-btn')?.addEventListener('click', () => this.addCard());
    document.getElementById('save-deck-btn')?.addEventListener('click', () => this.saveDeck());
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  addCard() {
    this.editorState.cards.push({ question: '', answer: '' });
    this.renderEditor();
  }

  saveDeck() {
    const nameInput = document.getElementById('deck-name-input');
    const questionInputs = document.querySelectorAll('.card-question');
    const answerInputs = document.querySelectorAll('.card-answer');

    const name = nameInput?.value || 'Deck sans nom';
    const cards = Array.from(questionInputs).map((input, index) => ({
      question: input.value,
      answer: answerInputs[index]?.value || ''
    }));

    const deckData = { name, cards, updatedAt: Date.now() };

    if (this.useLocalStorage) {
      const decks = JSON.parse(localStorage.getItem('wm_flashcards_decks') || '[]');
      if (this.editorState.deckId !== null && this.editorState.deckId < decks.length) {
        decks[this.editorState.deckId] = deckData;
      } else {
        decks.push(deckData);
        this.editorState.deckId = decks.length - 1;
      }
      localStorage.setItem('wm_flashcards_decks', JSON.stringify(decks));
      this.editorState.isOpen = false;
      this.loadFlashcards();
      return;
    }

    if (!this.flashcardsRef) return;

    if (this.editorState.deckId) {
      this.flashcardsRef.child(this.editorState.deckId).set(deckData);
    } else {
      const newDeckId = this.flashcardsRef.push().key;
      this.flashcardsRef.child(newDeckId).set(deckData);
      this.editorState.deckId = newDeckId;
    }

    this.editorState.isOpen = false;
    this.loadFlashcards();
  }

  editWithAI(deckId) {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.value = `Améliore ce deck de flashcards : [Deck ID: ${deckId}]`;
      const event = new Event('input', { bubbles: true });
      chatInput.dispatchEvent(event);
      document.querySelector('#send-btn')?.click();
    }
  }

  async deleteDeck(deckId) {
    if (!confirm('Voulez-vous vraiment supprimer ce deck ?')) return;

    if (this.useLocalStorage) {
      const decks = JSON.parse(localStorage.getItem('wm_flashcards_decks') || '[]');
      decks.splice(deckId, 1);
      localStorage.setItem('wm_flashcards_decks', JSON.stringify(decks));
      this.loadFlashcards();
      return;
    }

    if (!this.flashcardsRef) return;
    try {
      await this.flashcardsRef.child(deckId).remove();
      this.loadFlashcards();
    } catch (error) {
      console.error('Error deleting deck:', error);
    }
  }

  // ========== FLASHCARDS GENERATION ==========
  generateFlashcardsFromResponse(responseText) {
    const flashcardPattern = /(?:Flashcard|Carte|Question) \d+:?\s*["'‘“](.*?)["'’”]\s*[-–:]\s*["'‘“](.*?)["'’”]/gi;
    const cards = [];
    let match;

    while ((match = flashcardPattern.exec(responseText)) !== null) {
      cards.push({
        question: match[1].trim(),
        answer: match[2].trim()
      });
    }

    if (cards.length > 0) {
      this.saveGeneratedDeck('Deck généré par Wikimind', cards);
      return true;
    }
    return false;
  }

  saveGeneratedDeck(name, cards) {
    const deckData = {
      name,
      cards,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (this.useLocalStorage) {
      const decks = JSON.parse(localStorage.getItem('wm_flashcards_decks') || '[]');
      decks.push(deckData);
      localStorage.setItem('wm_flashcards_decks', JSON.stringify(decks));
      this.currentDeck = decks.length - 1;
      this.renderFlashcardAttachment(this.currentDeck, name, cards.length);
      return;
    }

    if (!this.flashcardsRef) return;

    const deckId = this.flashcardsRef.push().key;
    this.flashcardsRef.child(deckId).set(deckData).then(() => {
      this.currentDeck = deckId;
      this.renderFlashcardAttachment(deckId, name, cards.length);
    });
  }

  renderFlashcardAttachment(deckId, name, count) {
    const lastAIMsg = document.querySelector('.msg-group.ai:last-of-type');
    if (!lastAIMsg) return;

    const attachment = document.createElement('div');
    attachment.className = 'flashcard-attachment';
    attachment.dataset.deckId = deckId;
    attachment.innerHTML = `
      <div class="flashcard-attachment-icon">
        <img src="flashcards.png" alt="Flashcards" />
      </div>
      <div class="flashcard-attachment-info">
        <div class="flashcard-attachment-name">${this.escapeHtml(name)}</div>
        <div class="flashcard-attachment-count">${count} cartes</div>
      </div>
    `;

    attachment.addEventListener('click', () => {
      this.currentDeck = deckId;
      this.toggleFlashcards();
    });

    const bubble = lastAIMsg.querySelector('.bubble.ai');
    if (bubble) {
      bubble.prepend(attachment);
    }
  }

  // ========== UTILITY ==========
  showFlashcardAttachment(deckId) {
    if (this.useLocalStorage) {
      const decks = JSON.parse(localStorage.getItem('wm_flashcards_decks') || '[]');
      const deck = decks[deckId];
      if (deck) {
        this.renderFlashcardAttachment(deckId, deck.name || 'Deck sans nom', deck.cards?.length || 0);
      }
      return;
    }

    if (!this.flashcardsRef) return;

    this.flashcardsRef.child(deckId).once('value', (snapshot) => {
      const deck = snapshot.val() || {};
      this.renderFlashcardAttachment(deckId, deck.name || 'Deck sans nom', deck.cards?.length || 0);
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.flashcardsManager = new FlashcardsManager();
});
