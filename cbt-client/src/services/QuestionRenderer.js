import { sanitizeContent } from '../utils/sanitize'

export const QuestionRenderer = {
  render(containerId, question, userAnswers, currentIndex, isReviewMode) {
    const optionsDiv = document.getElementById(containerId);
    if (!optionsDiv) return;
    
    optionsDiv.innerHTML = '';
    const answers = question.answers || [];
    
    if (question.question_type === 'theory') {
      this.renderTheory(optionsDiv, question, userAnswers, currentIndex, isReviewMode);
    } else {
      this.renderObjective(optionsDiv, question, userAnswers, currentIndex, isReviewMode);
    }
  },

  renderTheory(container, question, userAnswers, currentIndex, isReviewMode) {
    const value = userAnswers[currentIndex] || '';
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <p style="font-size: 0.875rem; color: var(--accent-primary); font-weight: 600; margin: 0 0 0.5rem 0;">Your Answer:</p>
        <textarea id="theory-input" class="glass" 
          placeholder="Type your detailed answer here..." 
          style="width: 100%; min-height: 200px; padding: 1rem; color: inherit; line-height: 1.6; resize: vertical; font-size: var(--base-font-size, 1rem);"
          ${isReviewMode ? 'disabled' : ''}>${sanitizeContent(value)}</textarea>
        <div id="paste-warning" style="color: var(--error); font-size: 0.75rem; margin-top: 0.25rem; display: none;">⚠️ Pasting is disabled in exam mode.</div>
      </div>
    `;
    
    const area = document.getElementById('theory-input');
    if (area && !isReviewMode) {
      // Event listeners are usually attached in the component for access to 'this'
      // But we can expose the element for connectivity
    }
  },

  renderObjective(container, question, userAnswers, currentIndex, isReviewMode) {
    let options = [...(question.answers || [])];
    
    if (options.length === 0) {
      container.innerHTML = '<div style="color: var(--error); padding: 1rem;">No options found for this question.</div>';
      return;
    }

    // 🛡️ DATA INTEGRITY CHECK: Ensure at least one answer is correct
    const hasCorrectAnswer = options.some(a => a.is_correct);
    if (!hasCorrectAnswer && !isReviewMode) {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'glass card scale-in';
        errorMsg.style.border = '1px solid var(--error)';
        errorMsg.style.padding = '1rem';
        errorMsg.style.marginBottom = '1rem';
        errorMsg.style.color = 'var(--error)';
        errorMsg.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i data-lucide="alert-triangle" style="width: 20px;"></i>
            <div style="flex: 1;">
              <strong style="display: block;">Content Integrity Error</strong>
              <span style="font-size: 0.8rem; opacity: 0.8;">The correct answer for this question is missing or incorrectly mapped in the database.</span>
            </div>
            <button id="report-broken-q" class="btn-secondary" style="font-size: 0.7rem; padding: 0.4rem 0.8rem; color: var(--error); border-color: var(--error);">REPORT NOW</button>
          </div>
        `;
        container.appendChild(errorMsg);
        if (window.lucide) window.lucide.createIcons({ root: errorMsg });
        
        const reportBtn = errorMsg.querySelector('#report-broken-q');
        if (reportBtn) {
            reportBtn.onclick = () => {
                // This will trigger the global report modal if attached
                const event = new CustomEvent('elite:report-question', { detail: { questionId: question.id, reason: 'Logical Error' } });
                window.dispatchEvent(event);
            };
        }
    }

    // Randomize options only if not in review mode and not already shuffled
    if (!isReviewMode && !question._shuffledOptions) {
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      question._shuffledOptions = options; // Store shuffled order for consistency
    } else if (question._shuffledOptions) {
      options = question._shuffledOptions; // Use stored shuffled order
    }

    options.forEach((ans, index) => {
      const isSelected = userAnswers[currentIndex] === ans.id;
      const isCorrect = ans.is_correct;
      const letter = String.fromCharCode(65 + index); // Dynamic A, B, C, D based on shuffled index
      
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      if (isReviewMode) {
        btn.classList.add('review-mode');
        if (isCorrect) btn.classList.add('correct');
        else if (isSelected && !isCorrect) btn.classList.add('incorrect');
      } else if (isSelected) {
        btn.classList.add('selected');
      }
      btn.dataset.id = ans.id;
      btn.innerHTML = `
        <span class="option-holder">${letter}</span>
        <span style="flex: 1; color: inherit; font-weight: inherit; font-size: var(--base-font-size, 1.15rem);">${sanitizeContent(ans.option_text || ans.answer_text || 'Missing Option')}</span>
        ${isReviewMode && isCorrect ? `
          <span style="margin-left: auto; display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 700;">
            ${isSelected ? '✅ Matches Your Choice' : '✓ Correct Answer'}
          </span>
        ` : ''}
      `;

      
      container.appendChild(btn);
    });
  }
};
