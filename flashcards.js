// ========== FLASHCARDS MODULE ==========
class FlashcardsManager {
  constructor() {
    this.isActive = false;
    this.isGenerating = false;
    this.currentDeck = null;
    this.flipStates = new Map();
    this.editorState = { isOpen: false, cardId: null, question: '', answer: '' };

    // Firebase references
    this.db = firebase.database();
    this.userId = null;
    this.flashcardsRef = null;

    // Initialize when user is authenticated
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        this.userId = user.uid;
        this.flashcardsRef = this.db.ref(`wikimind5/users/${this.userId}/flashcards`);
      } else {
        this.userId = null;
        this.flashcardsRef = null;
      }
    });

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'flashcards-overlay';
    overlay.innerHTML = `
      <div id="flashcards-panel">
        <div id="flashcards-header">
          <div id="flashcards-title">
            <img src="flashcards.png" alt="Flashcards" style="width: 20px; height: 20px;" />
            <span>Flashcards</span>
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

    // Add to plus menu
    this.injectPlusMenuItem();
  }

  injectPlusMenuItem() {
    const plusMenu = document.getElementById('plus-menu');
    if (!plusMenu) return;

    // Add "Outils" section if not exists
    let outilsSection = plusMenu.querySelector('.pm-section-outils');
    if (!outilsSection) {
      outilsSection = document.createElement('div');
      outilsSection.className = 'pm-section-outils';
      outilsSection.innerHTML = `
        <div class="pm-section-label" style="padding: 8px 16px 4px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; color: var(--text3); text-transform: uppercase;">Outils</div>
      `;
      plusMenu.insertBefore(outilsSection, plusMenu.firstChild);
    }

    // Add Flashcards item
    const flashcardsItem = document.createElement('div');
    flashcardsItem.className = 'pm-item';
    flashcardsItem.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="14" height="14" rx="2" ry="2"/>
        <path d="M3 17l5-5 5 5M17 3l5 5-5 5"/>
      </svg>
      <span>Générateur de Flashcards</span>
    `;
    flashcardsItem.addEventListener('click', () => this.toggleFlashcards());
    outilsSection.appendChild(flashcardsItem);
  }

  bindEvents() {
    // Close panel
    document.getElementById('flashcards-close')?.addEventListener('click', () => this.closePanel());

    // Close on overlay click
    document.getElementById('flashcards-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'flashcards-overlay') this.closePanel();
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
              if (text.includes('flashcard') || text.includes('fiche de révision') || text.includes('cartes mémoire')) {
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
    const panel = document.getElementById('flashcards-panel');
    const overlay = document.getElementById('flashcards-overlay');
    if (panel.classList.contains('open')) {
      this.closePanel();
    } else {
      panel.classList.add('open');
      overlay.classList.add('open');
      this.loadFlashcards();
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
  }

  deactivateFlashcardsMode() {
    this.isActive = false;
    this.isGenerating = false;
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
      thinkingEl.querySelector('span').textContent = 'Création des Flashcards';
    }, 1500);

    setTimeout(() => {
      thinkingEl.querySelector('span').textContent = 'Finalisation des Flashcards';
    }, 3000);
  }

  // ========== FLASHCARDS MANAGEMENT ==========
  async loadFlashcards() {
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

    if (Object.keys(decks).length === 0) {
      body.innerHTML = '<div class="flashcard-empty">Aucune flashcard pour le moment. Générez-en une pour commencer !</div>';
      return;
    }

    let html = '<div class="flashcard-list">';
    for (const [deckId, deck] of Object.entries(decks)) {
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
    }
    html += '</div>';
    body.innerHTML = html;

    // Bind events
    this.bindFlashcardEvents();
  }

  bindFlashcardEvents() {
    document.querySelectorAll('.flashcard-item').forEach(item => {
      // Flip card
      item.addEventListener('click', (e) => {
        if (e.target.closest('.flashcard-actions')) return;
        const isFlipped = item.dataset.flipped === 'true';
        item.dataset.flipped = !isFlipped;
        item.classList.toggle('flip', !isFlipped);
      });

      // Edit
      item.querySelector('.edit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const deckId = item.dataset.deckId;
        this.openEditor(deckId);
      });

      // AI Edit
      item.querySelector('.ai-edit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const deckId = item.dataset.deckId;
        this.editWithAI(deckId);
      });

      // Delete
      item.querySelector('.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const deckId = item.dataset.deckId;
        this.deleteDeck(deckId);
      });
    });
  }

  openEditor(deckId) {
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
          <input type="text" class="flashcard-editor-input card-question" placeholder="Question ou terme" value="${card.question || ''}" data-index="${index}">
          <input type="text" class="flashcard-editor-input card-answer" placeholder="Réponse ou définition" value="${card.answer || ''}" data-index="${index}" style="margin-top: 6px;">
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
          <input type="text" class="flashcard-editor-input" id="deck-name-input" placeholder="Nom du deck" value="${this.editorState.name || ''}">
        </div>
        <div id="cards-container">${cardsHTML}</div>
        <div class="flashcard-editor-actions">
          <button class="flashcard-editor-btn secondary" id="add-card-btn">+ Ajouter une carte</button>
          <button class="flashcard-editor-btn primary" id="save-deck-btn">Enregistrer</button>
        </div>
      </div>
    `;

    // Bind events
    document.getElementById('add-card-btn')?.addEventListener('click', () => this.addCard());
    document.getElementById('save-deck-btn')?.addEventListener('click', () => this.saveDeck());
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

    if (this.editorState.deckId) {
      this.flashcardsRef.child(this.editorState.deckId).set(deckData);
    } else {
      const newDeckId = this.flashcardsRef.push().key;
      this.flashcardsRef.child(newDeckId).set(deckData);
    }

    this.editorState.isOpen = false;
    this.loadFlashcards();
  }

  editWithAI(deckId) {
    // Send message to AI to improve flashcards
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.value = `Améliore ce deck de flashcards : [Deck ID: ${deckId}]`;
      const event = new Event('input', { bubbles: true });
      chatInput.dispatchEvent(event);
      // Trigger send (you may need to adjust this based on your send logic)
      document.querySelector('[data-action="send"]')?.click();
    }
  }

  async deleteDeck(deckId) {
    if (!this.flashcardsRef || !confirm('Voulez-vous vraiment supprimer ce deck ?')) return;
    try {
      await this.flashcardsRef.child(deckId).remove();
      this.loadFlashcards();
    } catch (error) {
      console.error('Error deleting deck:', error);
    }
  }

  // ========== FLASHCARDS GENERATION ==========
  generateFlashcardsFromResponse(responseText) {
    // Parse AI response to extract flashcards
    const flashcardPattern = /(?:Flashcard|Carte) \d+:?\s*["']?(.*?)["']?\s*[-–:]\s*["']?(.*?)["']?/gi;
    const cards = [];
    let match;

    while ((match = flashcardPattern.exec(responseText)) !== null) {
      cards.push({
        question: match[1].trim(),
        answer: match[2].trim()
      });
    }

    if (cards.length > 0) {
      this.saveGeneratedDeck('Deck généré', cards);
      return true;
    }
    return false;
  }

  saveGeneratedDeck(name, cards) {
    if (!this.flashcardsRef) return;

    const deckData = {
      name,
      cards,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const deckId = this.flashcardsRef.push().key;
    this.flashcardsRef.child(deckId).set(deckData).then(() => {
      this.currentDeck = deckId;
      this.renderFlashcardAttachment(deckId, name, cards.length);
    });
  }

  renderFlashcardAttachment(deckId, name, count) {
    // Create attachment preview in chat
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
        <div class="flashcard-attachment-name">${name}</div>
        <div class="flashcard-attachment-count">${count} cartes</div>
      </div>
    `;

    attachment.addEventListener('click', () => {
      this.currentDeck = deckId;
      this.toggleFlashcards();
    });

    // Insert before the message content or at the end
    const bubble = lastAIMsg.querySelector('.bubble.ai');
    if (bubble) {
      bubble.prepend(attachment);
    }
  }

  // ========== UTILITY ==========
  showFlashcardAttachment(deckId) {
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
