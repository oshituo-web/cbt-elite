export const WeeklyRecapComponent = {
  render(weekly, stats, mastery) {
    const modal = document.createElement('div')
    modal.id = 'performance-modal'
    modal.className = 'glass'
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      z-index: 3000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      backdrop-filter: blur(12px);
    `
    const statsSafe = {
      overall: stats?.overall || { total: 0, correct: 0, time: 0, accuracy: 0 },
      byMode: stats?.byMode || {},
      bySubject: stats?.bySubject || {}
    }
    const { overall, byMode, bySubject } = statsSafe
    const weeklySafe = weekly || { total_questions_answered: 0, average_score_percentage: 0, leaderboard_rank: '--' }
    const masterySafe = mastery || []

    const renderStatLine = (label, t, c, color = 'var(--accent-primary)') => {
      const total = t || 0
      const correct = c || 0
      const wrong = total - correct
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
      return `
        <div class="glass" style="padding: 1.25rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-weight: 700; font-family: 'Outfit'; color: ${color};">${label.toUpperCase()}</span>
            <span style="font-size: 1.1rem; font-weight: 800; color: #fff;">${accuracy}%</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.8rem;">
            <div style="color: var(--text-secondary);">Total: <strong style="color: #fff;">${total}</strong></div>
            <div style="color: var(--success);">Correct: <strong style="color: #fff;">${correct}</strong></div>
            <div style="color: var(--error);">Wrong: <strong style="color: #fff;">${wrong}</strong></div>
          </div>
          <div style="height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-top: 0.75rem;">
            <div style="width: ${accuracy}%; height: 100%; background: ${color}; border-radius: 2px; transition: width 0.5s ease-out;"></div>
          </div>
        </div>
      `
    }

    const modeHtml = Object.entries(byMode).map(([mode, s]) => 
      renderStatLine(mode, s.total, s.correct, mode === 'exam' ? 'var(--accent-primary)' : 'var(--accent-secondary)')
    ).join('')

    const subjectHtml = Object.entries(bySubject).map(([sub, s]) => 
      renderStatLine(sub, s.total, s.correct, 'var(--success)')
    ).join('')

    const wCorrect = Math.round((weeklySafe.total_questions_answered || 0) * ((weeklySafe.average_score_percentage || 0) / 100))
    const wWrong = (weeklySafe.total_questions_answered || 0) - wCorrect

    modal.innerHTML = `
      <div class="card glass" style="max-width: 650px; width: 100%; padding: 2.5rem; background: var(--bg-color); border: 1px solid var(--accent-primary); overflow-y: auto; max-height: 90vh;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
          <h2 style="font-family: 'Outfit'; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
            <span>📈</span> Performance Analytics
          </h2>
          <button id="close-recap" class="glass" style="border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; cursor: pointer;">×</button>
        </div>

        <!-- Section 1: Weekly Comparison -->
        <h3 style="font-size: 0.8rem; color: var(--accent-primary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 2px; font-family: 'Outfit';">This Week's Activity</h3>
        <div class="glass" style="padding: 1.5rem; margin-bottom: 2.5rem; display: flex; justify-content: space-around; align-items: center;">
           <div style="text-align: center;">
             <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase;">Solved</div>
             <div style="font-size: 1.25rem; font-weight: 700;">${weeklySafe.total_questions_answered || 0}</div>
           </div>
           <div style="text-align: center;">
             <div style="font-size: 0.7rem; color: var(--success); text-transform: uppercase;">Correct</div>
             <div style="font-size: 1.25rem; font-weight: 700; color: var(--success);">${wCorrect}</div>
           </div>
           <div style="text-align: center;">
             <div style="font-size: 0.7rem; color: var(--error); text-transform: uppercase;">Wrong</div>
             <div style="font-size: 1.25rem; font-weight: 700; color: var(--error);">${wWrong}</div>
           </div>
           <div style="text-align: center;">
             <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase;">Mode Rank</div>
             <div style="font-size: 1.25rem; font-weight: 700; color: white;">#${weeklySafe.leaderboard_rank || '--'}</div>
           </div>
        </div>

        <!-- Section 2: Lifetime Summary -->
        <h3 style="font-size: 0.8rem; color: var(--accent-primary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 2px; font-family: 'Outfit';">Lifetime Performance</h3>
        ${renderStatLine('Overall Assessment', overall.total, overall.correct, 'var(--accent-primary)')}
        <div style="display: flex; gap: 1rem; margin-bottom: 2.5rem;">
           <div class="glass" style="flex: 1; padding: 1rem; text-align: center;">
              <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase;">Total Time</div>
              <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent-secondary);">${(overall.time / 3600).toFixed(1)}h</div>
           </div>
        </div>

        <!-- Section 3: Analysis by Mode -->
        <h3 style="font-size: 0.8rem; color: var(--accent-secondary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 2px; font-family: 'Outfit';">Analysis by Mode</h3>
        <div style="margin-bottom: 2.5rem;">
          ${modeHtml || '<div style="color: var(--text-secondary); padding: 1rem; text-align: center;">Finish a Mock Exam or Subject Practice to see mode-wise analysis.</div>'}
        </div>

        <!-- Section 4: Analysis by Subject -->
        <h3 style="font-size: 0.8rem; color: var(--success); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 2px; font-family: 'Outfit';">Analysis by Subject</h3>
        <div style="margin-bottom: 2.5rem;">
          ${subjectHtml || '<div style="color: var(--text-secondary); padding: 1rem; text-align: center;">Finish sessions in different subjects to see subject-wise analysis.</div>'}
        </div>

        <!-- Section 5: Topic Mastery -->
        <h3 style="font-size: 0.8rem; color: var(--accent-primary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 2px; font-family: 'Outfit';">Detailed Topic Insights</h3>
        <div class="glass" style="padding: 1.5rem;">
          ${masterySafe.length > 0 ? masterySafe.slice(0, 5).map(m => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.8rem;">
              <span style="color: var(--text-secondary);">${m.subject} > ${m.topic}</span>
              <span style="font-weight: 700; color: var(--success);">${m.mastery_percentage}%</span>
            </div>
            <div style="height: 3px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-bottom: 1rem;">
              <div style="width: ${m.mastery_percentage}%; height: 100%; background: var(--success); border-radius: 2px;"></div>
            </div>
          `).join('') : '<div style="color: var(--text-secondary); text-align: center;">Keep practicing to see topic Mastery!</div>'}
        </div>

        <div style="margin-top: 2.5rem; display: flex; justify-content: center;">
          <button id="recap-back-btn" class="glass" style="padding: 1rem 2rem; font-weight: bold;">← Back to Dashboard</button>
        </div>
      </div>
    `
    document.body.appendChild(modal)

    document.getElementById('close-recap').onclick = () => {
      modal.remove()
    }
    
    document.getElementById('recap-back-btn').onclick = () => {
      modal.remove()
    }
  }
}
