import { DataService } from '../services/data'
import { SubscriptionService } from '../services/subscriptionService'
import { Chart } from 'chart.js/auto'

export const AnalyticsComponent = {
  async render(profile, onBack, onStartPractice) {
    const container = document.getElementById('analytics-container')
    container.style.display = 'block'
    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; height:50vh;">
        <div class="loader-spinner"></div>
      </div>
    `

    try {
      const { history, mastery, stats, error } = await DataService.getUserAnalytics(profile.id)
      if (error) throw error

      // 1. Fetch System Config for Free Access Toggles (Check all major features)
      const { data: configs } = await DataService.getGlobalConfigs([
        'explanations_free_access', 
        'exams_free_access', 
        'ai_tutor_free_access'
      ]);
      const isSystemFree = configs?.some(c => c.value === true || c.value === 'true');

      const accuracy = stats.overall.total > 0 ? Math.round((stats.overall.correct / stats.overall.total) * 100) : 0
      const hours = (stats.overall.time / 3600).toFixed(1)

      // 2. Premium Gating check (Includes system-wide free mode)
      const state = SubscriptionService.resolveUserTier(profile, isSystemFree)
      const isPremium = state === 'premium' || profile.is_activated || isSystemFree

      container.innerHTML = `
        <div class="analytics-page-wrapper" style="padding-bottom: 5rem; animation: fadeIn 0.4s ease; position: relative;">
          ${!isPremium ? `
            <div id="analytics-premium-gate" style="position: absolute; top: 120px; left: 0; right: 0; bottom: 0; z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(12px); border-radius: 24px; padding: 2rem; text-align: center;">
               <div style="background: var(--accent-gradient); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 2rem; box-shadow: 0 10px 40px rgba(124, 58, 237, 0.4);">
                  <i data-lucide="lock" style="color: white; width: 32px; height: 32px;"></i>
               </div>
               <h2 style="font-family: 'Outfit'; font-weight: 900; font-size: 2rem; color: white; margin-bottom: 1rem;">Premium Insights Locked</h2>
               <p style="color: rgba(255,255,255,0.8); max-width: 400px; line-height: 1.6; margin-bottom: 2.5rem; font-weight: 500;">Upgrade to **Elite Premium** to unlock detailed subject mastery trends, topic-level gap analysis, and global benchmarking.</p>
               <button id="insights-upgrade-btn" class="btn-dominant" style="padding: 0 3rem; height: 56px; font-weight: 800;">UPGRADE TO ELITE PREMIUM</button>
            </div>
          ` : ''}

          <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h1 style="font-family: 'Outfit'; font-weight: 900; font-size: 2.25rem; color: var(--text-primary); margin: 0;">Elite Insights</h1>
              <p style="color: var(--text-secondary); font-weight: 500; font-size: 1rem; margin-top: 0.25rem;">Advanced Performance Analytics & Mastery</p>
            </div>
            <div style="display: flex; gap: 0.75rem;">
                <button id="show-recap-btn" class="glass-btn" style="height: 48px; border: 1.5px solid var(--accent-primary); color: var(--accent-primary); padding: 0 1.5rem; font-weight: 700; border-radius: 12px; display: flex; align-items: center; gap: 0.5rem; background: rgba(37, 99, 235, 0.05);">
                    <i data-lucide="bar-chart-2" style="width: 18px;"></i> RECAP
                </button>
                <button id="analytics-back-btn" class="btn-secondary" style="height: 48px; padding: 0 1.5rem; font-weight: 700;">
                    <i data-lucide="arrow-left" style="width: 18px; margin-right: 0.5rem;"></i> DASHBOARD
                </button>
            </div>
          </header>

          <div style="${!isPremium ? 'filter: blur(8px); pointer-events: none; user-select: none;' : ''}">
            <!-- TOP LEVEL METRICS -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 3rem;">
              <div class="glass card" style="padding: 2rem; border-top: 4px solid var(--accent-primary);">
                <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 1rem;">Total Answered</div>
                <div style="font-family: 'Outfit'; font-size: 2.5rem; font-weight: 900; color: var(--text-primary);">${stats.overall.total}</div>
                <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--success); font-weight: 600;">\u2191 Lifetime Progress</div>
              </div>
              
              <div class="glass card" style="padding: 2rem; border-top: 4px solid var(--success);">
                <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 1rem;">Global Accuracy</div>
                <div style="font-family: 'Outfit'; font-size: 2.5rem; font-weight: 900; color: var(--text-primary);">${accuracy}%</div>
                <div style="height: 6px; background: rgba(0,0,0,0.2); border-radius: 3px; margin-top: 1rem; overflow: hidden;">
                  <div style="width: ${accuracy}%; height: 100%; background: var(--success); border-radius: 3px;"></div>
                </div>
              </div>

              <div class="glass card" style="padding: 2rem; border-top: 4px solid var(--accent-secondary);">
                <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 1rem;">Study Hours</div>
                <div style="font-family: 'Outfit'; font-size: 2.5rem; font-weight: 900; color: var(--text-primary);">${hours}h</div>
                <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Equivalent to ${Math.round(hours/1.5)} Full Sessions</div>
              </div>

              <div class="glass card" style="padding: 2rem; border-top: 4px solid #f59e0b; background: rgba(245, 158, 11, 0.03);">
                <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 1rem;">Projected JAMB Score</div>
                <div id="projected-score-display" style="font-family: 'Outfit'; font-size: 2.5rem; font-weight: 900; color: #f59e0b;">...</div>
                <div style="margin-top: 0.5rem; font-size: 0.7rem; color: var(--text-secondary); font-weight: 500;">Based on weighted subject mastery</div>
              </div>
            </div>

            <!-- TODAY'S FOCUS CARD -->
            <div id="ai-today-focus-card" class="glass card scale-in" style="padding: 1.5rem 2rem; margin-bottom: 2rem; border-left: 4px solid var(--accent-primary); display: none; align-items: center; gap: 1.5rem; background: rgba(37, 99, 235, 0.05);">
               <div style="background: var(--accent-primary); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.2);">
                  <i data-lucide="zap" style="color: white; width: 22px;"></i>
               </div>
               <div>
                  <h4 style="font-family: 'Outfit'; font-size: 0.7rem; font-weight: 800; color: var(--accent-primary); margin: 0; text-transform: uppercase; letter-spacing: 0.1em;">Elite Recommendation for Today</h4>
                  <p id="ai-today-focus-text" style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin: 0.2rem 0 0 0; line-height: 1.4;">Calculating your focus points...</p>
               </div>
            </div>

            <!-- ELITE AI SYNTHESIS -->
            <div class="glass card scale-in" style="padding: 2.5rem; margin-bottom: 3rem; background: rgba(124, 58, 237, 0.05); border: 1.5px solid var(--accent-secondary); position: relative; overflow: hidden; border-radius: 20px;">
              <h3 style="font-family: 'Outfit'; font-weight: 900; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem; color: var(--accent-secondary); font-size: 1.5rem; text-transform: uppercase; letter-spacing: 0.1em;">
                <i data-lucide="sparkles" style="width: 28px; height: 28px;"></i> Elite AI Synthesis
              </h3>
              <div id="analytics-ai-synthesis" style="font-size: 1.1rem; color: var(--text-primary); line-height: 1.8; font-weight: 500;">
                <div style="display:flex; align-items:center; gap:10px;"><div class="loader-spinner" style="width:20px;height:20px;"></div> <span style="color:var(--text-secondary);">Analyzing your historical data trajectory...</span></div>
              </div>
            </div>

            <!-- MIDDLE SECTION: GRAPHS & SUBJECTS -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 2rem; margin-bottom: 3rem;">
              <!-- Score Trend Chart -->
              <div class="glass card" style="padding: 2rem;">
                <h3 style="font-family: 'Outfit'; font-weight: 800; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                  <i data-lucide="trending-up" style="color: var(--accent-primary);"></i> Score Progression
                </h3>
                <canvas id="insights-score-chart" height="300"></canvas>
              </div>

              <!-- Subject Performance List -->
              <div class="glass card" style="padding: 2rem;">
                <h3 style="font-family: 'Outfit'; font-weight: 800; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                  <i data-lucide="target" style="color: var(--success);"></i> Subject Status
                </h3>
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                  ${Object.entries(stats.bySubject).slice(0, 5).map(([sub, s]) => `
                    <div>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem;">
                        <span style="font-weight: 700; color: var(--text-primary);">${sub}</span>
                        <span style="font-weight: 800; color: var(--success);">${Math.round((s.correct / s.total) * 100)}%</span>
                      </div>
                      <div style="height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
                        <div style="width: ${(s.correct / s.total) * 100}%; height: 100%; background: var(--accent-primary); transition: width 1s ease;"></div>
                      </div>
                    </div>
                  `).join('') || '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">No subject data yet.</div>'}
                </div>
              </div>
            </div>

            <!-- BOTTOM SECTION: TOPIC MASTERY -->
            <h2 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.5rem; margin-bottom: 1.5rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.75rem;">
              <i data-lucide="award" style="color: var(--accent-secondary);"></i> Topic Mastery Rankings
            </h2>
            <div class="glass card" style="padding: 2rem; overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                <thead>
                  <tr style="text-align: left; border-bottom: 1px solid var(--glass-border);">
                    <th style="padding: 1rem; color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase;">Subject</th>
                    <th style="padding: 1rem; color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase;">Topic</th>
                    <th style="padding: 1rem; color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase;">Proficiency</th>
                    <th style="padding: 1rem; color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase;">Status</th>
                    <th style="padding: 1rem; color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${mastery.length > 0 ? mastery.slice(0, 10).map(m => `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                      <td style="padding: 1.25rem 1rem; font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${m.subject}</td>
                      <td style="padding: 1.25rem 1rem; color: var(--text-secondary); font-weight: 500;">${m.topic}</td>
                      <td style="padding: 1.25rem 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                          <div style="flex: 1; height: 6px; background: rgba(0,0,0,0.2); border-radius: 3px; max-width: 100px; overflow: hidden;">
                            <div style="width: ${m.mastery_percentage}%; height: 100%; background: ${m.mastery_percentage > 70 ? 'var(--success)' : m.mastery_percentage > 40 ? 'var(--accent-primary)' : 'var(--error)'};"></div>
                          </div>
                          <span style="font-weight: 800; font-size: 0.9rem; color: var(--text-primary);">${m.mastery_percentage}%</span>
                        </div>
                      </td>
                      <td style="padding: 1.25rem 1rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.6rem; border-radius: 6px; background: ${m.mastery_percentage > 70 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.05)'}; color: ${m.mastery_percentage > 70 ? 'var(--success)' : 'var(--text-secondary)'};">
                          ${m.mastery_percentage > 70 ? 'MASTERED' : 'LEARNING'}
                        </span>
                      </td>
                      <td style="padding: 1.25rem 1rem;">
                        <button class="topic-dive-trigger btn-secondary" data-topic="${m.topic}" data-subject="${m.subject}" style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 800; border-radius: 8px; border-color: var(--accent-secondary); color: var(--accent-secondary); min-width: 100px;">
                          DEEP DIVE
                        </button>
                      </td>
                    </tr>
                  `).join('') : `<tr><td colspan="5" style="text-align:center; padding: 3rem; color: var(--text-secondary);">Continue practicing to unlock topic analysis.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `

      // 1. Render Chart
      if (isPremium) this.renderScoreChart(history)

      // 2. Attach Listeners
      document.getElementById('analytics-back-btn').onclick = onBack
      
      const recapBtn = document.getElementById('show-recap-btn');
      if (recapBtn) {
          recapBtn.onclick = () => {
             if (typeof window.navigateTo === 'function') {
                 window.navigateTo('recap', profile);
             }
          };
      }

      document.querySelectorAll('.topic-dive-trigger').forEach(btn => {
          btn.onclick = async () => {
              const { topic, subject } = btn.dataset;
              btn.disabled = true;
              btn.innerHTML = '<div class="loader-spinner" style="width:14px; height:14px;"></div>';
              
              const { TopicDeepDiveComponent } = await import('./TopicDeepDive');
              TopicDeepDiveComponent.render(topic, subject, profile, async () => {
                  // This is the "Master this Topic" callback
                  const { data: questions } = await DataService.getPracticeQuestions(subject, topic, 10);
                  if (questions && questions.length > 0) {
                      onStartPractice(questions, 'practice', subject, 'Practice');
                  } else {
                      alert("Not enough questions found for a focused session yet.");
                  }
              });
              
              btn.disabled = false;
              btn.innerHTML = 'DEEP DIVE';
          };
      });

      const upgradeBtn = document.getElementById('insights-upgrade-btn')
      if (upgradeBtn) {
        upgradeBtn.onclick = () => {
          document.getElementById('upgrade-modal').style.display = 'flex'
        }
      }

      // 3. Lucide Icons
      if (window.lucide) window.lucide.createIcons({ root: container })

      // 4. Lazy Load Full AI Synthesis & Predictive Metrics
      if (isPremium) {
        import('../services/aiService').then(async ({ AiService }) => {
            const analytics = { history, mastery, stats };
            
            // Set Projected Score
            const projectedScore = AiService.getPredictedJAMBScore(analytics);
            const scoreEl = document.getElementById('projected-score-display');
            if (scoreEl) scoreEl.textContent = projectedScore > 0 ? `${projectedScore}/400` : 'Baseline Needed';

            // Set Today's Focus
            const focusCard = document.getElementById('ai-today-focus-card');
            const focusText = document.getElementById('ai-today-focus-text');
            if (focusCard && focusText) {
                focusCard.style.display = 'flex';
                const focus = await AiService.generateTodayFocus(analytics);
                focusText.textContent = focus;
                if (window.lucide) window.lucide.createIcons({ root: focusCard });
            }

            try {
                const synthesis = await AiService.getAIPerformanceSummary(analytics, false);
                const el = document.getElementById('analytics-ai-synthesis');
                if (el) el.innerHTML = synthesis;
            } catch (e) {
                const el = document.getElementById('analytics-ai-synthesis');
                if (el) el.innerHTML = "<p style='color:var(--error);'>Synthesis currently unavailable.</p>";
            }
        }).catch(e => console.error("Synthesis Load Error:", e));
      }

    } catch (err) {
      console.error("Analytics load crash:", err)
      container.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--error); font-weight: 700;">\u26A0\uFE0F ${err.message || 'Failed to generate insights.'}</div>`
    }
  },

  renderScoreChart(history) {
    const ctx = document.getElementById('insights-score-chart')?.getContext('2d')
    if (!ctx || !history || history.length === 0) return

    const data = history.slice(-10).reverse()
    const labels = data.map((_, i) => `Session ${i + 1}`)
    const scores = data.map(s => s.score_percentage)

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Score %',
          data: scores,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#3b82f6'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        }
      }
    })
  }
}
