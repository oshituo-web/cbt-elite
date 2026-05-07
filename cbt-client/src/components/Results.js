import { DataService } from '../services/data'
import { supabase } from '../utils/supabase'
import { SubscriptionService } from '../services/subscriptionService'
import { SubscriptionManager } from '../utils/subscriptionManager'
import { TopicDeepDiveComponent } from './TopicDeepDive'
import { ModalService } from '../services/ModalService'

export const ResultsComponent = {
  async render(questions, userAnswers, onRestart, onReview, profile, mode, subject, examType, timeTaken, onBack, questionSource = 'ai') {
    const container = document.getElementById('dashboard-container')
    container.style.display = 'block'
    try {
      container.innerHTML = `
        <div class="glass card scale-in" style="width: min(800px, 92vw); margin: 3rem auto; padding: 2.5rem 1rem; text-align: center;">
          <div class="loader-spinner mb-lg" style="margin: 0 auto; width: 48px; height: 48px;"></div>
          <h2 style="font-family: 'Outfit'; font-size: 1.75rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Analyzing your scores</h2>
          <p style="color: var(--text-secondary); font-weight: 500; font-size: 1rem;">Saving progress...</p>
        </div>
      `
    } catch (err) {
      console.error("FATAL: Results rendering crashed:", err)
      container.innerHTML = `
        <div class="glass card scale-in" style="width: min(500px, 92vw); margin: 3rem auto; padding: 2.5rem 1rem; text-align: center;">
          <h2 style="font-family: 'Outfit'; color: var(--error);">Something went wrong</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">We couldn't process your results, but your progress was saved.</p>
          <button class="btn-primary" onclick="location.reload()">Return to Dashboard</button>
        </div>
      `
      return
    }

    try {
      let systemConfig = {
        explanations_free_access: false,
        exams_free_access: false,
        ai_tutor_free_access: false
    };

    // Non-blocking config fetch with short timeout fallback
    const configPromise = supabase.from('system_config').select('key, value').then(({ data }) => {
        if (data) {
            data.forEach(c => {
                const val = c.value === true || c.value === 'true';
                if (systemConfig.hasOwnProperty(c.key)) systemConfig[c.key] = val;
            });
        }
    }).catch(err => console.warn("Results config fetch non-critical failure:", err));

    const objQuestions = questions.filter(q => q.question_type !== 'theory')
    
    let correct = 0
    objQuestions.forEach((q, i) => {
      const qIdx = questions.indexOf(q)
      const selectedId = userAnswers[qIdx]
      const correctAnswer = q.answers.find(a => a.is_correct)
      if (selectedId === correctAnswer?.id) correct++
    })

    const scorePercent = objQuestions.length > 0 ? Math.round((correct / objQuestions.length) * 100) : 0
    
    const answeredCount = Object.values(userAnswers || {}).filter(a => a !== null && a !== "").length;
    
    const oldDailyCount = profile?.daily_questions_count || 0;
    
    // --- OPTIMISTIC STREAK CALCULATION ---
    const calculateStreak = (lastSessionDate, currentStreak) => {
      if (!lastSessionDate) return 1;
      const today = new Date();
      const lastDate = new Date(lastSessionDate);
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const lastDateOnly = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
      const diffDays = Math.round((todayDate - lastDateOnly) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return Math.max(currentStreak || 0, 1);
      if (diffDays === 1) return (currentStreak || 0) + 1;
      return 1;
    };

    let latestStreak = calculateStreak(profile?.last_session_date, profile?.streak_count);

    console.log("[Streak Debug] PRE-SESSION actual:", profile?.streak_count, "| optimistic:", latestStreak, "| last_session_date:", profile?.last_session_date);

        // ✅ NOTE: saveExamSession is now called in Exam.js for consistency
        // But we still refresh the profile to show updated streaks/coins
        console.log("[Results] Refreshing profile to sync rewards...");

        // 🔄 REFRESH: Get latest profile AFTER save completes
        const { data: refreshed } = await DataService.getProfile(profile.id);
        if (refreshed) {
            // Trust optimistic streak if the database sync hasn't caught up yet
            latestStreak = Math.max(refreshed.streak_count || 0, latestStreak);
            profile.streak_count = latestStreak;
            profile.elite_coins = refreshed.elite_coins;
            profile.daily_questions_count = refreshed.daily_questions_count;
            profile.last_session_date = refreshed.last_session_date;

            console.log("[Streak Debug] POST-SESSION streak:", latestStreak, "| last_session_date:", refreshed.last_session_date);

            // 🔥 UPDATE GLOBAL UI (Header Streak/Coins)
            if (window.updateHeaderProfile) {
                window.updateHeaderProfile(refreshed);
            }
        } else {
            console.warn("[Streak Debug] Profile refresh returned null.");
        }

    const isJambMock = mode === 'exam' && examType === 'JAMB'
    
    // 📊 Granular Topic Stats calculation
    const topicStatsMap = {};
    questions.forEach((q, i) => {
        const topic = q.topic || (q.subject ? `General ${q.subject}` : 'General');
        if (!topicStatsMap[topic]) topicStatsMap[topic] = { correct: 0, total: 0 };
        
        if (q.question_type !== 'theory') {
            topicStatsMap[topic].total++;
            const selectedId = userAnswers[i];
            const correctId = q.answers.find(a => a.is_correct)?.id;
            if (selectedId === correctId) topicStatsMap[topic].correct++;
        }
    });

    const sessionStats = Object.keys(topicStatsMap)
        .filter(topic => topicStatsMap[topic].total > 0)
        .map(topic => {
            const s = topicStatsMap[topic];
            return {
                label: topic,
                correct: s.correct,
                total: s.total,
                percent: Math.round((s.correct / s.total) * 100)
            };
        })
        .sort((a, b) => a.percent - b.percent); // Show weakest topics first

    // Identify weakest topic for AI Recommendation
    this._weakestTopic = sessionStats.length > 0 ? sessionStats[0].label : null;

    container.innerHTML = `
      <div class="results-view-container" style="width: 100%; max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem; box-sizing: border-box;">
        <div class="glass card scale-in" style="padding: 2.5rem 1rem; position: relative; text-align: center; width: 100%; box-sizing: border-box;">
          <button id="results-back-btn" class="header-icon-btn" title="Exit" style="position: absolute; top: 1.5rem; left: 1.5rem; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 14px; background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); color: var(--text-primary);">
            <i data-lucide="arrow-left" style="width: 24px; stroke-width: 3px;"></i>
          </button>
          
          <div style="margin-bottom: 2rem; padding-top: 1rem;">
            <div style="font-family: 'Outfit'; font-size: 0.75rem; font-weight: 800; color: ${questionSource === 'past' ? 'var(--accent-secondary)' : 'var(--accent-primary)'}; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.2em;">
              ${questionSource === 'past' ? 'Verified Past Question Results' : 'Elite AI Practice Analysis'}
            </div>
            <h2 style="font-family: 'Outfit'; font-size: 2rem; font-weight: 900; color: var(--text-primary); margin-bottom: 0.5rem;">Session Complete</h2>
          </div>
          
          <div style="margin-bottom: 2rem; width: 100%;">
            <div class="glass card" style="text-align: center; padding: 1.5rem 1rem; border: 2px solid var(--primary); background: rgba(37, 99, 235, 0.05); width: 100%; box-sizing: border-box;">
              <div style="font-family: 'Outfit'; font-size: clamp(2rem, 10vw, 3.5rem); font-weight: 900; color: var(--primary); line-height: 1;">
                ${correct} / ${objQuestions.length} • ${scorePercent}%
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Final Score & Accuracy</div>
            </div>
          </div>

          <!-- ELITE REWARDS & STREAK -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2.5rem;">
            <div class="glass card scale-in" style="padding: 1rem; border: 2px solid #f59e0b; background: rgba(245, 158, 11, 0.05); display: flex; flex-direction: column; align-items: center; justify-content: center;">
               <div style="background: rgba(245, 158, 11, 0.15); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #f59e0b; margin-bottom: 0.5rem;">
                 <i data-lucide="coins" style="width: 20px;"></i>
               </div>
               <div style="font-family: 'Outfit'; font-size: 1.5rem; font-weight: 900; color: #f59e0b; line-height: 1;">+${Math.ceil((objQuestions.length * (scorePercent / 100)) / 2)}</div>
               <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Elite Coins</div>
            </div>

            <div class="glass card scale-in" style="padding: 1rem; border: 2px solid var(--warning); background: rgba(245, 158, 11, 0.05); display: flex; flex-direction: column; align-items: center; justify-content: center;">
               <div style="background: rgba(245, 158, 11, 0.15); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--warning); margin-bottom: 0.5rem;">
                 <i data-lucide="flame" style="width: 20px; ${latestStreak > 0 ? 'fill: var(--warning);' : ''}"></i>
               </div>
               <div style="font-family: 'Outfit'; font-size: 1.5rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${latestStreak}</div>
               <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Day Streak</div>
            </div>
          </div>
            ${(() => {
                const dailyGoalHit = oldDailyCount < 50 && (oldDailyCount + answeredCount) >= 50;
                const isClash = mode === 'clash';
                const day = new Date().getDay();
                const isSunday = day === 0;
                
                let bonusLines = [];
                if (dailyGoalHit) {
                    bonusLines.push(`<span style="color: #f59e0b;"><i data-lucide="star" style="width: 14px; fill: #f59e0b;"></i> DAILY GOAL HIT! +50</span>`);
                }
                if (isClash && scorePercent >= 80) {
                    const clashAmt = isSunday ? 200 : 100;
                    bonusLines.push(`<span style="color: var(--accent-primary);"><i data-lucide="award" style="width: 14px; fill: var(--accent-primary);"></i> ${isSunday ? 'SUPER ELITE' : 'CLASH'} BONUS! +${clashAmt}</span>`);
                }

                if (bonusLines.length > 0) {
                    return `
                    <div style="flex-basis: 100%; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1); text-align: left; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.75rem; font-weight: 800;">
                        ${bonusLines.join('')}
                    </div>
                    `;
                }
                return '';
            })()}
          </div>

          <!-- PERFORMANCE FOR THIS SESSION -->
          <div style="text-align: left; width: 100%;">
            <h3 style="font-family: 'Outfit'; margin-bottom: 1.25rem; font-size: 1.35rem; font-weight: 800; color: var(--text-primary);">
                Topic-wise Performance
            </h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2.5rem; width: 100%;">
              ${sessionStats.map(s => `
                <div class="glass" style="padding: 1rem; border-radius: 12px; border-left: 4px solid ${s.percent >= 50 ? 'var(--success)' : 'var(--error)'}; width: 100%; box-sizing: border-box;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem; flex-wrap: wrap; gap: 0.5rem;">
                    <span style="font-weight: 800; color: var(--text-primary);">${s.label}</span>
                    <span style="color: ${s.percent >= 50 ? 'var(--success)' : 'var(--error)'}; font-weight: 900;">${s.correct}/${s.total} (${s.percent}%)</span>
                  </div>
                  <div class="progress-v2-container" style="height: 6px;"><div class="progress-v2-fill ${s.percent >= 50 ? 'success' : 'error'}" style="width: ${s.percent}%;"></div></div>
                </div>
              `).join('')}
            </div>

          <!-- AI TUTOR SMART RECOMMENDATION -->
          ${this._weakestTopic && questionSource === 'ai' ? `
            <div class="glass card scale-in mb-xl" style="background: linear-gradient(135deg, #5B21B6 0%, #3730A3 100%); border: none; padding: 2rem 1.5rem; text-align: left; color: #ffffff; width: 100%; box-sizing: border-box; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
               <h3 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.5rem; margin-bottom: 0.5rem; color: #ffffff;">AI Insight: Master "${this._weakestTopic}"</h3>
               <p style="margin-bottom: 1.5rem; font-size: 1rem; font-weight: 500; color: rgba(255,255,255,0.95); line-height: 1.5;">Your performance on this topic was ${sessionStats[0].percent}%. Reviewing core concepts could boost your predicted JAMB score.</p>
               <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                 <button id="deep-dive-btn" class="btn-secondary" style="background: white; color: #3730A3; border: none; font-weight: 800; flex: 1; min-width: 140px; height: 44px; border-radius: 12px;">Deep Dive</button>
                 <button id="auto-focus-btn" class="btn-secondary" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); font-weight: 800; flex: 1; min-width: 140px; height: 44px; border-radius: 12px;">Drill Topic</button>
               </div>
            </div>
          ` : (this._weakestTopic && questionSource === 'past' ? `
             <div class="glass card scale-in mb-xl" style="background: rgba(124, 58, 237, 0.05); border: 2px dashed var(--accent-secondary); padding: 1.5rem; text-align: left; width: 100%; box-sizing: border-box;">
               <h3 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--accent-secondary);">Archive Analysis</h3>
               <p style="margin-bottom: 1.25rem; font-size: 0.95rem; font-weight: 500; color: var(--text-secondary); line-height: 1.5;">You struggled with <b>${this._weakestTopic}</b> in this past paper. We recommend an <b>Elite AI Drill</b> to master this topic before your real exam.</p>
               <button id="drill-weak-btn" class="btn-primary" style="height: 44px; width: 100%; font-weight: 900;">START AI DRILL: ${this._weakestTopic.toUpperCase()}</button>
            </div>
          ` : '')}

          <div class="glass card" style="padding: 2rem 1rem; background: rgba(0,0,0,0.1); border-radius: 20px; width: 100%; box-sizing: border-box;">
             <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; width: 100%;">
               <button class="btn-primary" id="restart-exam" style="flex: 1; min-width: 140px; height: 48px; white-space: nowrap;">Retake</button>
               <button class="btn-secondary" id="review-exam" style="flex: 1; min-width: 140px; height: 48px; border-color: var(--accent-primary); white-space: nowrap;">Review</button>
               <button class="btn-secondary" id="back-home" style="flex: 1; min-width: 140px; height: 48px; white-space: nowrap;">EXIT TO DASHBOARD</button>
             </div>
          </div>

        </div>
      </div>
    `

    const deepDiveBtn = document.getElementById('deep-dive-btn')
    const autoFocusBtn = document.getElementById('auto-focus-btn')

    if (deepDiveBtn) {
      deepDiveBtn.onclick = () => {
        TopicDeepDiveComponent.render(this._weakestTopic, subject, profile, (questions) => {
           onReview(questions);
        });
      }
    }

    if (autoFocusBtn) {
      autoFocusBtn.onclick = async () => {
         autoFocusBtn.disabled = true;
         autoFocusBtn.innerHTML = 'Loading...';
         const { data: questions } = await DataService.getPracticeQuestions(subject, this._weakestTopic, 10);
         if (questions && questions.length > 0) {
            onRestart(questions, 'practice', subject, examType, { questionSource: 'ai' }); 
         } else {
             await ModalService.alert("No Questions", "We couldn't find enough questions for this topic yet. Try another one!", 'info');
            autoFocusBtn.disabled = false;
            autoFocusBtn.innerHTML = 'Drill Topic';
         }
      }
    }

    const drillWeakBtn = document.getElementById('drill-weak-btn');
    if (drillWeakBtn) {
        drillWeakBtn.onclick = async () => {
            drillWeakBtn.disabled = true;
            drillWeakBtn.textContent = 'PREPARING AI DRILL...';
            const { data: questions } = await DataService.getPracticeQuestions(subject, this._weakestTopic, 10);
            if (questions && questions.length > 0) {
                onRestart(questions, 'practice', subject, examType, { questionSource: 'ai' });
            } else {
                ModalService.alert("AI Unavailable", "Could not generate drill questions for this topic. Try another subject!", "info");
                drillWeakBtn.disabled = false;
                drillWeakBtn.textContent = `START AI DRILL: ${this._weakestTopic.toUpperCase()}`;
            }
        };
    }

    const restartBtn = document.getElementById('restart-exam')
    if (restartBtn) restartBtn.onclick = () => onRestart(questions, mode, subject, examType, { questionSource })

    const reviewBtn = document.getElementById('review-exam')
    if (reviewBtn) reviewBtn.onclick = () => onReview(questions, userAnswers)

    const homeBtn = document.getElementById('back-home')
    if (homeBtn) {
      homeBtn.onclick = () => {
        if (typeof window.navigateTo === 'function') {
          window.navigateTo('dashboard', profile);
        } else if (onBack) {
          onBack();
        } else {
          location.reload();
        }
      }
    }

    const backBtn = document.getElementById('results-back-btn')
    if (backBtn) backBtn.onclick = () => onBack ? onBack() : location.reload()

      if (window.lucide) window.lucide.createIcons();

    } catch (err) {
      console.error("Results component fatal error:", err);
      container.innerHTML = `
        <div class="glass card scale-in" style="width: min(500px, 92vw); margin: 3rem auto; padding: 2.5rem 1rem; text-align: center;">
          <h2 style="font-family: 'Outfit'; color: var(--error);">Something went wrong</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">We couldn't display your scores properly, but your exam has been saved.</p>
          <button class="btn-primary" onclick="location.reload()">Return to Dashboard</button>
        </div>
      `;
    }
  }
}
