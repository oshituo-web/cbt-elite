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

      // 2. Premium Gating check (Includes system-wide free mode and Store-bought tokens)
      const state = SubscriptionService.resolveUserTier(profile, isSystemFree)
      const hasPredictionToken = !!profile.last_ai_score_prediction;
      const isPremium = state === 'premium' || profile.is_activated || isSystemFree
      const canSeeAnalytics = isPremium || hasPredictionToken;

      container.innerHTML = `
        <style>
          .analytics-page-wrapper {
            padding: calc(var(--header-height) + 1.5rem) 20px 120px 20px;
            animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
            max-width: 1000px;
            margin: 0 auto;
            width: 100%;
            box-sizing: border-box;
            min-height: 100vh;
            overflow-x: hidden;
            word-break: break-word;
          }
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
            width: 100%;
            align-items: stretch;
          }
          .premium-glass-card {
            background: rgba(255, 255, 255, 0.04);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 1.5rem 1.25rem;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            height: 100%;
          }
          .premium-glass-card:hover {
            transform: translateY(-4px);
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.15);
            box-shadow: 0 12px 40px -4px rgba(0, 0, 0, 0.2);
          }
          .synthesis-card {
            padding: 2rem;
            margin-bottom: 2.5rem;
            background: linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(37, 99, 235, 0.03) 100%);
            border: 1.5px solid rgba(124, 58, 237, 0.3);
            position: relative;
            overflow: hidden;
            border-radius: 24px;
            width: 100%;
            box-sizing: border-box;
            box-shadow: 0 15px 40px -12px rgba(124, 58, 237, 0.15);
          }
          .synthesis-card::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%);
            pointer-events: none;
          }
          .stat-value-large {
            font-size: 2.25rem;
            font-weight: 900;
            font-family: 'Outfit';
            line-height: 1;
            margin-bottom: 0.25rem;
            color: var(--text-primary);
          }
          .recap-fab {
            position: fixed;
            bottom: 110px;
            right: 20px;
            z-index: 5000;
            box-shadow: 0 10px 30px rgba(37, 99, 235, 0.4);
            border-radius: 50px;
            height: 52px;
            padding: 0 1.25rem;
            background: var(--accent-primary);
            color: white;
            border: none;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            animation: slideUpFade 0.4s ease;
            cursor: pointer;
            border: 2px solid rgba(255,255,255,0.1);
          }
          @keyframes slideUpFade {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @media (max-width: 768px) {
            .metrics-grid {
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
            }
            .analytics-page-wrapper {
              padding: calc(var(--header-height) + 1.25rem) 16px 140px 16px;
            }
          }
        </style>
        <div class="analytics-bg-glow" style="position: fixed; top: 0; left: 0; right: 0; height: 100vh; background: radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.05) 0%, transparent 40%), radial-gradient(circle at 20% 80%, rgba(14, 165, 233, 0.05) 0%, transparent 40%); pointer-events: none; z-index: -1;"></div>
        <div class="analytics-page-wrapper">
          ${!canSeeAnalytics ? `
            <div id="analytics-premium-gate" style="position: absolute; top: 120px; left: 0; right: 0; bottom: 0; z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(12px); border-radius: 24px; padding: 2rem; text-align: center;">
               <div style="background: var(--accent-gradient); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 2rem; box-shadow: 0 10px 40px rgba(124, 58, 237, 0.4);">
                  <i data-lucide="lock" style="color: white; width: 32px; height: 32px;"></i>
               </div>
               <h2 style="font-family: 'Outfit'; font-weight: 900; font-size: 2rem; color: white; margin-bottom: 1rem;">Premium Insights Locked</h2>
               <p style="color: rgba(255,255,255,0.8); max-width: 400px; line-height: 1.6; margin-bottom: 2.5rem; font-weight: 500;">Upgrade to **Elite Premium** or use **Elite Coins** in the Store to unlock detailed subject mastery trends and AI projections.</p>
               <button id="insights-upgrade-btn" class="btn-dominant" style="padding: 0 3rem; height: 56px; font-weight: 800;">UPGRADE TO ELITE PREMIUM</button>
            </div>
          ` : ''}

          <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h1 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.75rem; color: var(--text-primary); margin: 0; letter-spacing: -0.02em;">Elite Insights</h1>
              <p style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem; margin-top: 0.2rem;">Advanced Performance Analytics</p>
            </div>
            <button id="analytics-back-btn" class="btn-secondary" style="height: 40px; padding: 0 1.25rem; font-weight: 700; border-radius: 10px; display: flex; align-items: center; gap: 0.4rem; background: rgba(255,255,255,0.05);">
                <i data-lucide="arrow-left" style="width: 16px;"></i> DASHBOARD
            </button>
          </header>

          <button id="show-recap-btn" class="recap-fab">
              <i data-lucide="bar-chart-2" style="width: 20px;"></i>
              <span>RECAP</span>
          </button>

          <div style="${!isPremium ? 'filter: blur(8px); pointer-events: none; user-select: none;' : ''}">
            <!-- TOP LEVEL METRICS -->
            <div class="metrics-grid">
              <div class="premium-glass-card" style="border-top: 4px solid var(--accent-primary);">
                <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Questions</div>
                <div class="stat-value-large" style="color: var(--text-primary);">${stats.overall.total.toLocaleString()}</div>
                <div style="margin-top: 0.75rem; font-size: 0.75rem; color: var(--success); font-weight: 700; display: flex; align-items: center; gap: 4px;">
                    <i data-lucide="trending-up" style="width: 12px;"></i> ${Math.round(stats.overall.total/10)}% Lift
                </div>
              </div>
              
              <div class="premium-glass-card" style="border-top: 4px solid var(--success);">
                <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Accuracy</div>
                <div class="stat-value-large" style="color: var(--success);">${accuracy}%</div>
                <div style="height: 6px; background: rgba(0,0,0,0.1); border-radius: 3px; margin-top: 1rem; overflow: hidden; width: 100%;">
                  <div style="width: ${accuracy}%; height: 100%; background: linear-gradient(90deg, var(--success), #10b981); border-radius: 3px;"></div>
                </div>
              </div>
  
              <div class="premium-glass-card" style="border-top: 4px solid var(--accent-secondary);">
                <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Study Time</div>
                <div class="stat-value-large" style="color: var(--text-primary);">${hours}<span style="font-size: 0.8rem; margin-left: 2px;">hrs</span></div>
                <div style="margin-top: 0.75rem; font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">Consistent Prep</div>
              </div>
  
              <div class="premium-glass-card" style="border-top: 4px solid #f59e0b; background: rgba(245, 158, 11, 0.04);">
                <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.05em;">JAMB Prediction</div>
                <div id="projected-score-display" class="stat-value-large" style="color: #f59e0b; text-shadow: 0 0 20px rgba(245, 158, 11, 0.2);">...</div>
                <div style="margin-top: 0.75rem; font-size: 0.7rem; color: var(--text-secondary); font-weight: 600;">Based on Trajectory</div>
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
            <div class="glass card synthesis-card" style="padding: 1.5rem;">
              <h3 style="font-family: 'Outfit'; font-weight: 800; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.6rem; color: var(--accent-secondary); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em;">
                <i data-lucide="sparkles" style="width: 18px; height: 18px;"></i> Elite AI Synthesis
              </h3>
              <div id="analytics-ai-synthesis" style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.6; font-weight: 500;">
                <div style="display:flex; align-items:center; gap:10px;"><div class="loader-spinner" style="width:16px;height:16px;"></div> <span style="color:var(--text-secondary); font-size: 0.8rem;">Analyzing your historical data trajectory...</span></div>
              </div>
            </div>

            <!-- MIDDLE SECTION: GRAPHS & SUBJECTS -->
            <div class="charts-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
              <!-- Score Trend Chart -->
              <div class="glass card" style="padding: 1.5rem;">
                <h3 style="font-family: 'Outfit'; font-weight: 800; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem;">
                  <i data-lucide="trending-up" style="color: var(--accent-primary); width: 20px;"></i> Score Progression
                </h3>
                <div style="height: 250px; width: 100%;"><canvas id="insights-score-chart"></canvas></div>
              </div>

              <!-- Subject Performance List -->
              <div class="glass card" style="padding: 1.5rem;">
                <h3 style="font-family: 'Outfit'; font-weight: 800; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem;">
                  <i data-lucide="target" style="color: var(--success); width: 20px;"></i> Subject Status
                </h3>
                <div style="display: flex; flex-direction: column; gap: 1.1rem;">
                  ${Object.entries(stats.bySubject).sort((a,b) => (b[1].correct/b[1].total) - (a[1].correct/a[1].total)).slice(0, 5).map(([sub, s]) => `
                    <div>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.85rem;">
                        <span style="font-weight: 700; color: var(--text-primary);">${sub}</span>
                        <span style="font-weight: 800; color: var(--success);">${Math.round((s.correct / s.total) * 100)}%</span>
                      </div>
                      <div style="height: 5px; background: rgba(0,0,0,0.05); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${(s.correct / s.total) * 100}%; height: 100%; background: var(--accent-primary); transition: width 1s ease;"></div>
                      </div>
                    </div>
                  `).join('') || '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">No subject data yet.</div>'}
                </div>
              </div>
            </div>

            <h2 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.35rem; margin-bottom: 1.25rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.75rem;">
              <i data-lucide="award" style="color: var(--accent-secondary); width: 24px;"></i> Topic Proficiency Rankings
            </h2>
            <div class="glass card" style="padding: 1.5rem; overflow-x: auto; border-radius: 16px;">
              <table style="width: 100%; border-collapse: collapse; min-width: 500px;">
                <thead>
                  <tr style="text-align: left; border-bottom: 1px solid var(--glass-border);">
                    <th style="padding: 1rem; color: var(--text-secondary); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;">Subject</th>
                    <th style="padding: 1rem; color: var(--text-secondary); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;">Topic</th>
                    <th style="padding: 1rem; color: var(--text-secondary); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;">Proficiency</th>
                    <th style="padding: 1rem; color: var(--text-secondary); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${mastery.length > 0 ? mastery.sort((a,b) => b.mastery_percentage - a.mastery_percentage).slice(0, 10).map(m => `
                    <tr style="border-bottom: 1px solid rgba(0,0,0,0.02);">
                      <td style="padding: 1rem; font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${m.subject}</td>
                      <td style="padding: 1rem; color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">${m.topic}</td>
                      <td style="padding: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                          <div style="flex: 1; height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; min-width: 60px; overflow: hidden;">
                            <div style="width: ${m.mastery_percentage}%; height: 100%; background: ${m.mastery_percentage > 70 ? 'var(--success)' : m.mastery_percentage > 40 ? 'var(--accent-primary)' : 'var(--error)'};"></div>
                          </div>
                          <span style="font-weight: 800; font-size: 0.85rem; color: var(--text-primary);">${m.mastery_percentage}%</span>
                        </div>
                      </td>
                      <td style="padding: 1rem;">
                        <button class="topic-dive-trigger btn-secondary" data-topic="${m.topic}" data-subject="${m.subject}" style="padding: 0.4rem 0.75rem; font-size: 0.7rem; font-weight: 800; border-radius: 8px; border-color: var(--accent-secondary); color: var(--accent-secondary);">
                          DIVE
                        </button>
                      </td>
                    </tr>
                  `).join('') : `<tr><td colspan="4" style="text-align:center; padding: 3rem; color: var(--text-secondary);">Continue practicing to unlock topic analysis.</td></tr>`}
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
      if (canSeeAnalytics) {
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

    const isDarkMode = document.body.classList.contains('dark-mode');
    const textColor = isDarkMode ? '#f8fafc' : '#475569';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)';

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Score %',
          data: scores,
          borderColor: isDarkMode ? '#38bdf8' : '#3b82f6',
          backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.1)' : 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: isDarkMode ? '#38bdf8' : '#3b82f6'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { 
            beginAtZero: true, 
            max: 100, 
            grid: { color: gridColor }, 
            ticks: { color: textColor, font: { family: 'Outfit', size: 11, weight: 'bold' } } 
          },
          x: { 
            grid: { display: false }, 
            ticks: { color: textColor, font: { family: 'Outfit', size: 11, weight: 'bold' } } 
          }
        }
      }
    })
  }
}
