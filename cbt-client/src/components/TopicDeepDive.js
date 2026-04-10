export const TopicDeepDiveComponent = {
  render(topic, subject, profile, onStartFocus) {
    const modalId = 'topic-deep-dive-modal';
    let modal = document.getElementById(modalId);
    
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    
    // Simulate Topic Content (Template System)
    const content = this.getTopicSummary(topic, subject);
    
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content glass scale-in" style="max-width: 600px; width: 92vw; padding: 2.5rem; border-radius: 20px; position: relative; max-height: 90vh; overflow-y: auto;">
        <button id="close-deep-dive" class="btn-secondary" style="position: absolute; top: 1rem; right: 1rem; width: 40px; height: 40px; border-radius: 50%; padding: 0;">&times;</button>
        
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;">
          <div style="background: var(--accent-gradient); padding: 0.75rem; border-radius: 12px; color: white;">
            <i data-lucide="book-open"></i>
          </div>
          <div>
            <span style="font-size: 0.7rem; font-weight: 800; color: var(--accent-primary); text-transform: uppercase; letter-spacing: 0.1em;">Elite Study Guide</span>
            <h2 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.5rem; margin: 0; color: var(--text-primary);">${topic}</h2>
          </div>
        </div>

        <div class="study-card-content" style="text-align: left; color: var(--text-primary); line-height: 1.6;">
          ${content}
        </div>

        <div style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 1rem;">
           <button id="modal-focus-btn" class="btn-dominant" style="width: 100%; height: 56px; background: var(--accent-gradient);">
             Master this Topic (10 Questions)
           </button>
           <button id="modal-close-btn" class="btn-secondary" style="width: 100%; height: 50px;">
             I'll study more later
           </button>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: modal });

    this.setupListeners(onStartFocus, topic, subject);
  },

  setupListeners(onStartFocus, topic, subject) {
    const closeBtn = document.getElementById('close-deep-dive');
    const bottomCloseBtn = document.getElementById('modal-close-btn');
    const focusBtn = document.getElementById('modal-focus-btn');
    const modal = document.getElementById('topic-deep-dive-modal');

    const closeModal = () => {
      modal.style.display = 'none';
    };

    closeBtn.onclick = closeModal;
    bottomCloseBtn.onclick = closeModal;
    
    focusBtn.onclick = () => {
      closeModal();
      // Logic handled in Results.js, but we can also trigger here if needed
      // For consistency, we'll let the button in Results handle the question fetch
      // But we can trigger a generic "Auto Focus" event here
      const trigger = document.getElementById('auto-focus-btn');
      if (trigger) trigger.click();
    };

    window.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  },

  getTopicSummary(topic, subject) {
    // A robust template system for mock learning content
    const summaries = {
        'Algebra': `
          <p>Algebra is the language of patterns. Key concepts to remember:</p>
          <ul style="padding-left: 1.25rem; margin: 1rem 0;">
            <li><strong>BODMAS/PEMDAS:</strong> Order of operation is non-negotiable.</li>
            <li><strong>Equations:</strong> Whatever you do to the left, you must do to the right.</li>
            <li><strong>Variables:</strong> Think of 'x' as a mystery box. Your goal is to isolate it.</li>
          </ul>
          <div class="glass" style="padding: 1rem; border-left: 4px solid var(--accent-primary); font-size: 0.9rem; font-style: italic;">
            "If an equation has a power of 2 (x²), expect two possible solutions!"
          </div>
        `,
        'Cell Biology': `
          <p>Cells are the building blocks of life. Focus on these structures:</p>
          <ul style="padding-left: 1.25rem; margin: 1rem 0;">
            <li><strong>Mitochondria:</strong> Powerhouse of the cell (Site of ATP production).</li>
            <li><strong>Nucleus:</strong> The command center containing DNA.</li>
            <li><strong>Ribosomes:</strong> Protein synthesis factories.</li>
          </ul>
          <p>Remember: Plant cells have a <strong>Cell Wall</strong> and <strong>Chloroplasts</strong>; animal cells do not!</p>
        `,
        'English Grammar': `
          <p>Mastering concord and tenses is vital for high scores:</p>
          <ul style="padding-left: 1.25rem; margin: 1rem 0;">
            <li><strong>Subject-Verb Agreement:</strong> Singular subjects take singular verbs.</li>
            <li><strong>Tense Consistency:</strong> Don't switch from past to present mid-sentence.</li>
            <li><strong>Prepositions:</strong> Pay attention to fixed phrases (e.g., 'depend ON', 'interested IN').</li>
          </ul>
        `
    };

    return summaries[topic] || summaries[subject] || `
      <p>Mastering <strong>${topic}</strong> requires a mix of theory and constant practice.</p>
      <p>Key Study Tips:</p>
      <ul style="padding-left: 1.25rem; margin: 1rem 0;">
        <li>Review past questions from the last 5 years.</li>
        <li>Focus on first principles and core definitions.</li>
        <li>Test yourself frequently with 10-question focus sets.</li>
      </ul>
      <p>Our AI has flagged this area as a high-growth opportunity for your score.</p>
    `;
  }
};
