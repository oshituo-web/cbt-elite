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
        <label style="font-size: 0.875rem; color: var(--accent-primary); font-weight: 600;">Your Answer:</label>
        <textarea id="theory-input" class="glass" 
          placeholder="Type your detailed answer here..." 
          style="width: 100%; min-height: 200px; padding: 1rem; color: inherit; line-height: 1.6; resize: vertical;"
          ${isReviewMode ? 'disabled' : ''}>${value}</textarea>
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
        <span style="font-weight: 700; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); border-radius: 50%;">${letter}</span>
        <span style="flex: 1;">${ans.option_text || ans.answer_text || 'Missing Option'}</span>
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
