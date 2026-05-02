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
      <div class="modal-content glass scale-in" style="max-width: 800px; width: 95%; padding: 2.5rem; background: var(--bg-color); border-radius: 24px; position: relative; max-height: 90vh; overflow-y: auto; margin: auto; border: 1.5px solid var(--glass-border); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <button id="close-recap" class="header-icon-btn" style="position: absolute; top: 1.25rem; right: 1.25rem; width: auto; height: 36px; padding: 0 0.6rem; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 0.25rem; background: rgba(0,0,0,0.1); border: 1px solid var(--glass-border); z-index: 10;">
          <i data-lucide="x" style="width: 16px; height: 16px;"></i>
          <span style="font-weight: 800; font-size: 0.65rem; letter-spacing: 0.05em;">EXIT</span>
        </button>
        
        <div style="text-align: center; margin-bottom: 2.5rem;">
          <h2 style="font-family: 'Outfit'; margin: 0; font-weight: 900; font-size: 2.25rem; color: var(--text-primary); display: flex; justify-content: center; align-items: center; gap: 0.75rem;">
            <i data-lucide="bar-chart-2" style="color: var(--accent-primary); width: 36px; height: 36px;"></i> Elite Recap
          </h2>
          <p style="color: var(--text-secondary); margin-top: 0.5rem; font-weight: 600; font-size: 1.1rem;">Your Personalized Performance Audit</p>
        </div>

        <!-- Section 1: Weekly Snapshot -->
        <div style="margin-bottom: 2.5rem;">
          <h3 style="font-size: 0.85rem; color: var(--accent-primary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 900; font-family: 'Outfit'; display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="calendar" style="width: 16px;"></i> Weekly Snapshot
          </h3>
          <div class="glass card" style="padding: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; text-align: center; border-radius: 16px;">
             <div>
               <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800; margin-bottom: 0.25rem;">Answered</div>
               <div style="font-size: 1.8rem; font-weight: 900; color: var(--text-primary); font-family: 'Outfit';">${weeklySafe.total_questions_answered || 0}</div>
             </div>
             <div>
               <div style="font-size: 0.7rem; color: var(--success); text-transform: uppercase; font-weight: 800; margin-bottom: 0.25rem;">Correct</div>
               <div style="font-size: 1.8rem; font-weight: 900; color: var(--success); font-family: 'Outfit';">${wCorrect}</div>
             </div>
             <div>
               <div style="font-size: 0.7rem; color: var(--error); text-transform: uppercase; font-weight: 800; margin-bottom: 0.25rem;">Efficiency</div>
               <div style="font-size: 1.8rem; font-weight: 900; color: var(--error); font-family: 'Outfit';">${weeklySafe.average_score_percentage}%</div>
             </div>
             <div>
               <div style="font-size: 0.7rem; color: var(--accent-secondary); text-transform: uppercase; font-weight: 800; margin-bottom: 0.25rem;">Study Time</div>
               <div style="font-size: 1.8rem; font-weight: 900; color: var(--accent-secondary); font-family: 'Outfit';">${(weeklySafe.time_taken_seconds / 3600).toFixed(1)}h</div>
             </div>
          </div>
        </div>

        <!-- Section 2: Lifetime Performance -->
        <div style="margin-bottom: 2.5rem;">
          <h3 style="font-size: 0.85rem; color: var(--primary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 900; font-family: 'Outfit'; display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="activity" style="width: 16px;"></i> Lifetime Summary
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
            ${renderStatLine('Overall Proficiency', overall.total, overall.correct, 'var(--primary)')}
            <div class="glass card" style="padding: 1.25rem; display: flex; align-items: center; gap: 1rem; border-radius: 16px; height: fit-content;">
                <div style="background: rgba(147, 51, 234, 0.1); width: 44px; height: 44px; border-radius: 12px; color: var(--accent-secondary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <i data-lucide="clock" style="width: 22px;"></i>
                </div>
                <div>
                  <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800;">Total Engagement</div>
                  <div style="font-size: 1.2rem; font-weight: 900; color: var(--text-primary); font-family: 'Outfit';">${(overall.time / 3600).toFixed(1)} Hours Explored</div>
                </div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem; margin-bottom: 2.5rem;">
          <!-- Section 3: My Mode (Exam vs Practice) -->
          <div>
            <h3 style="font-size: 0.85rem; color: var(--accent-secondary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 900; font-family: 'Outfit'; display: flex; align-items: center; gap: 0.5rem;">
              <i data-lucide="layers" style="width: 16px;"></i> My Mode
            </h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${modeHtml || '<div class="glass card" style="padding: 2rem; color: var(--text-secondary); text-align: center; font-weight: 700;">No mode data detected.</div>'}
            </div>
          </div>

          <!-- Section 4: By Subject -->
          <div>
            <h3 style="font-size: 0.85rem; color: var(--success); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 900; font-family: 'Outfit'; display: flex; align-items: center; gap: 0.5rem;">
              <i data-lucide="target" style="width: 16px;"></i> By Subjects
            </h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${subjectHtml || '<div class="glass card" style="padding: 2rem; color: var(--text-secondary); text-align: center; font-weight: 700;">No subject data detected.</div>'}
            </div>
          </div>
        </div>

        <!-- Section 5: Mastery Breakdown -->
        <div style="margin-bottom: 3rem;">
          <h3 style="font-size: 0.85rem; color: var(--accent-primary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 900; font-family: 'Outfit'; display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="award" style="width: 16px;"></i> Topic Mastery Trajectory
          </h3>
          <div class="glass card" style="padding: 1.75rem; border-radius: 20px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
              ${masterySafe.length > 0 ? masterySafe.slice(0, 8).map(m => `
                <div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; align-items: center;">
                    <div style="display: flex; flex-direction: column;">
                      <span style="color: var(--text-primary); font-weight: 800; font-size: 0.85rem; line-height: 1.2;">${m.subject}</span>
                      <span style="color: var(--text-secondary); font-weight: 600; font-size: 0.75rem;">${m.topic}</span>
                    </div>
                    <span style="font-weight: 900; color: var(--success); font-family: 'Outfit';">${m.mastery_percentage}%</span>
                  </div>
                  <div style="height: 5px; background: rgba(0,0,0,0.05); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${m.mastery_percentage}%; height: 100%; background: var(--success); border-radius: 3px; transition: width 1s ease;"></div>
                  </div>
                </div>
              `).join('') : '<div style="grid-column: 1/-1; color: var(--text-secondary); text-align: center; padding: 2rem; font-weight: 700;">Complete sessions to unlock deep topic analysis.</div>'}
            </div>
          </div>
        </div>

        <div style="text-align: center; padding-top: 1rem;">
          <button id="recap-back-btn" class="btn-dominant" style="padding: 0 4rem; height: 56px; font-weight: 900; font-size: 1rem; border-radius: 16px; white-space: nowrap;">EXIT INSIGHTS</button>
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
