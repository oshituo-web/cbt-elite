export const WeeklyRecapComponent = {
  render(weekly, stats, mastery) {
    const modal = document.createElement('div')
    modal.id = 'performance-modal'
    modal.className = 'modal-overlay'
    modal.style.display = 'flex'
    modal.style.opacity = '1'
    
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
        <div class="glass card scale-in" style="padding: 1.5rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <span style="font-weight: 800; font-family: 'Outfit'; color: ${color}; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.9rem;">${label}</span>
            <span style="font-size: 1.25rem; font-weight: 900; color: var(--text-primary);">${accuracy}%</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.85rem; margin-bottom: 1rem;">
            <div style="color: var(--text-secondary); font-weight: 600;">Total: <span style="color: var(--text-primary);">${total}</span></div>
            <div style="color: var(--success); font-weight: 600;">Correct: <span style="color: var(--text-primary);">${correct}</span></div>
            <div style="color: var(--error); font-weight: 600;">Wrong: <span style="color: var(--text-primary);">${wrong}</span></div>
          </div>
          <div style="height: 6px; background: rgba(0,0,0,0.2); border-radius: 3px; overflow: hidden; padding: 1px;">
            <div style="width: ${accuracy}%; height: 100%; background: ${color}; border-radius: 2px; transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
          </div>
        </div>
      `
    }

    const modeHtml = Object.entries(byMode).map(([mode, s]) => 
      renderStatLine(mode === 'exam' ? 'Mock Exams' : 'Subject Practice', s.total, s.correct, mode === 'exam' ? 'var(--accent-primary)' : 'var(--accent-secondary)')
    ).join('')

    const subjectHtml = Object.entries(bySubject).map(([sub, s]) => 
      renderStatLine(sub, s.total, s.correct, 'var(--success)')
    ).join('')

    const wCorrect = Math.round((weeklySafe.total_questions_answered || 0) * ((weeklySafe.average_score_percentage || 0) / 100))
    const wWrong = (weeklySafe.total_questions_answered || 0) - wCorrect

    modal.innerHTML = `
      <div class="modal-content glass" style="max-width: 680px; width: 100%; padding: 3rem; background: var(--bg-color); border-radius: var(--radius-lg); position: relative; max-height: 90vh; overflow-y: auto;">
        <button id="close-recap" class="btn-secondary" style="position: absolute; top: 1.5rem; right: 1.5rem; width: 40px; height: 40px; padding: 0; min-width: auto; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i data-lucide="x" style="width: 20px; height: 20px;"></i></button>
        
        <div style="text-align: center; margin-bottom: 3rem;">
          <h2 style="font-family: 'Outfit'; margin: 0; font-weight: 900; font-size: 2rem; color: var(--text-primary); display: flex; justify-content: center; align-items: center; gap: 0.75rem;">
            <i data-lucide="bar-chart-2" style="color: var(--accent-primary); width: 32px; height: 32px;"></i> Performance Insights
          </h2>
          <p style="color: var(--text-secondary); margin-top: 0.5rem; font-weight: 500;">Comprehensive analysis of your learning journey</p>
        </div>

        <!-- Section 1: Weekly Snapshot -->
        <h3 style="font-size: 0.9rem; color: var(--accent-primary); margin-bottom: 1.25rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; font-family: 'Outfit';">Weekly Snapshot</h3>
        <div class="glass card mb-xl" style="padding: 2rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1.5rem; text-align: center;">
           <div>
             <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; margin-bottom: 0.5rem;">Answered</div>
             <div style="font-size: 1.75rem; font-weight: 900; color: var(--primary); font-family: 'Outfit';">${weeklySafe.total_questions_answered || 0}</div>
           </div>
           <div>
             <div style="font-size: 0.75rem; color: var(--success); text-transform: uppercase; font-weight: 700; margin-bottom: 0.5rem;">Correct</div>
             <div style="font-size: 1.75rem; font-weight: 900; color: var(--success); font-family: 'Outfit';">${wCorrect}</div>
           </div>
           <div>
             <div style="font-size: 0.75rem; color: var(--error); text-transform: uppercase; font-weight: 700; margin-bottom: 0.5rem;">Inaccurate</div>
             <div style="font-size: 1.75rem; font-weight: 900; color: var(--error); font-family: 'Outfit';">${wWrong}</div>
           </div>
           <div>
             <div style="font-size: 0.75rem; color: var(--accent-secondary); text-transform: uppercase; font-weight: 700; margin-bottom: 0.5rem;">Globa Rank</div>
             <div style="font-size: 1.75rem; font-weight: 900; color: var(--accent-secondary); font-family: 'Outfit';">#${weeklySafe.leaderboard_rank || '--'}</div>
           </div>
        </div>

        <!-- Section 2: Lifetime Performance -->
        <h3 style="font-size: 0.9rem; color: var(--primary); margin-bottom: 1.25rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; font-family: 'Outfit';">Lifetime Summary</h3>
        ${renderStatLine('Overall Proficiency', overall.total, overall.correct, 'var(--primary)')}
        <div class="glass card mb-xl" style="padding: 1.5rem; display: flex; align-items: center; gap: 1rem;">
            <div style="background: rgba(147, 51, 234, 0.1); padding: 1rem; border-radius: 12px; color: var(--accent-secondary);">
              <i data-lucide="clock" style="width: 24px; height: 24px;"></i>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Total Study Time</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); font-family: 'Outfit';">${(overall.time / 3600).toFixed(1)} Hours</div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
          <!-- Section 3: Analysis by Mode -->
          <div>
            <h3 style="font-size: 0.9rem; color: var(--accent-secondary); margin-bottom: 1.25rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; font-family: 'Outfit';">By Mode</h3>
            <div>
              ${modeHtml || '<div class="glass card" style="padding: 2rem; color: var(--text-secondary); text-align: center; font-weight: 500;">No data yet.</div>'}
            </div>
          </div>

          <!-- Section 4: Analysis by Subject -->
          <div>
            <h3 style="font-size: 0.9rem; color: var(--success); margin-bottom: 1.25rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; font-family: 'Outfit';">By Subject</h3>
            <div>
              ${subjectHtml || '<div class="glass card" style="padding: 2rem; color: var(--text-secondary); text-align: center; font-weight: 500;">No data yet.</div>'}
            </div>
          </div>
        </div>

        <!-- Section 5: Mastery Breakdown -->
        <h3 style="font-size: 0.9rem; color: var(--accent-primary); margin-top: 3rem; margin-bottom: 1.25rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; font-family: 'Outfit';">Mastery Breakdown</h3>
        <div class="glass card" style="padding: 2rem;">
          ${masterySafe.length > 0 ? masterySafe.slice(0, 8).map(m => `
            <div style="margin-bottom: 1.5rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; align-items: center;">
                <span style="color: var(--text-primary); font-weight: 700; font-size: 0.9rem;">${m.subject} <span style="color: var(--text-secondary); font-weight: 500; font-size: 0.8rem;">&rsaquo; ${m.topic}</span></span>
                <span style="font-weight: 900; color: var(--success);">${m.mastery_percentage}%</span>
              </div>
              <div style="height: 4px; background: rgba(0,0,0,0.2); border-radius: 2px; overflow: hidden;">
                <div style="width: ${m.mastery_percentage}%; height: 100%; background: var(--success); border-radius: 2px; transition: width 1s ease;"></div>
              </div>
            </div>
          `).join('') : '<div style="color: var(--text-secondary); text-align: center; padding: 2rem; font-weight: 500;">Continue your sessions to generate topic mastery data!</div>'}
        </div>

        <div style="margin-top: 4rem; text-align: center;">
          <button id="recap-back-btn" class="btn-dominant" style="padding: 0 3rem; height: 56px;"><i data-lucide="arrow-left" style="width: 20px; height: 20px;"></i> BACK TO DASHBOARD</button>
        </div>
      </div>
    `
    document.body.appendChild(modal)

    // Render icons
    if (window.lucide) {
      window.lucide.createIcons({ root: modal });
    }

    const closeModal = () => {
      modal.style.opacity = '0'
      modal.querySelector('.modal-content').style.transform = 'scale(0.9)'
      setTimeout(() => modal.remove(), 300)
    }

    document.getElementById('close-recap').onclick = closeModal
    document.getElementById('recap-back-btn').onclick = closeModal
  }
}
