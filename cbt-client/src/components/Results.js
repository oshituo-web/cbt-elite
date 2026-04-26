import { DataService } from '../services/data'
import { supabase } from '../utils/supabase'
import { SubscriptionService } from '../services/subscriptionService'
import { SubscriptionManager } from '../utils/subscriptionManager'
import { TopicDeepDiveComponent } from './TopicDeepDive'
import { ModalService } from '../services/ModalService'

export const ResultsComponent = {
  async render(questions, userAnswers, onRestart, onReview, profile, mode, subject, examType, timeTaken, onBack) {
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
    let latestStreak = profile?.streak_count || 0;

    console.log("[Streak Debug] PRE-SESSION streak:", latestStreak, "| last_session_date:", profile?.last_session_date);

    if (profile && profile.id) {
        // ✅ FIXED: Use try/catch so we properly await the save before refreshing profile
        try {
            const { error: saveError } = await DataService.saveExamSession(profile.id, {
                session_type: mode,
                subject: subject || 'Various',
                total_questions: questions.length,
                answered_questions: answeredCount,
                correct_answers: correct,
                time_taken_seconds: timeTaken,
                score_percentage: scorePercent
            }, questions, userAnswers);

            if (saveError) {
                console.error("[Streak Debug] saveExamSession error:", saveError);
            } else {
                console.log("[Streak Debug] Session saved OK. Now refreshing profile...");
            }
        } catch (err) {
            console.error("[Streak Debug] Critical save error:", err);
        }

        // 🔄 REFRESH: Get latest profile AFTER save completes
        const { data: refreshed } = await DataService.getProfile(profile.id);
        if (refreshed) {
            latestStreak = refreshed.streak_count || 0;
            profile.streak_count = refreshed.streak_count;
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
          <button id="results-back-btn" class="btn-secondary" style="position: absolute; top: 1rem; left: 1rem; width: 40px; height: 40px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%;" title="Go Back">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          
          <div style="margin-bottom: 2rem; padding-top: 1rem;">
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
          </div>

          <!-- AI TUTOR SMART RECOMMENDATION -->
          ${this._weakestTopic ? `
            <div class="glass card scale-in mb-xl" style="background: linear-gradient(135deg, #5B21B6 0%, #3730A3 100%); border: none; padding: 2rem 1.5rem; text-align: left; color: #ffffff; width: 100%; box-sizing: border-box; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
               <h3 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.5rem; margin-bottom: 0.5rem; color: #ffffff;">Master "${this._weakestTopic}"</h3>
               <p style="margin-bottom: 1.5rem; font-size: 1rem; font-weight: 500; color: rgba(255,255,255,0.95); line-height: 1.5;">Reviewing core concepts here could boost your score by up to 15%.</p>
               <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                 <button id="deep-dive-btn" class="btn-secondary" style="background: white; color: #3730A3; border: none; font-weight: 800; flex: 1; min-width: 140px; height: 44px; border-radius: 12px;">Summary</button>
                 <button id="auto-focus-btn" class="btn-secondary" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); font-weight: 800; flex: 1; min-width: 140px; height: 44px; border-radius: 12px;">Challenge</button>
               </div>
            </div>
          ` : ''}

          <div class="glass card" style="padding: 2rem 1rem; background: rgba(0,0,0,0.1); border-radius: 20px; width: 100%; box-sizing: border-box;">
             <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; width: 100%;">
               <button class="btn-primary" id="restart-exam" style="flex: 1; min-width: 140px; height: 48px;">Retake</button>
               <button class="btn-secondary" id="review-exam" style="flex: 1; min-width: 140px; height: 48px; border-color: var(--accent-primary);">Review</button>
               <button class="btn-secondary" id="back-home" style="flex: 1; min-width: 140px; height: 48px;">Dashboard</button>
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
            onRestart(questions, 'practice', subject, examType); 
         } else {
             await ModalService.alert("No Questions", "We couldn't find enough questions for this topic yet. Try another one!", 'info');
            autoFocusBtn.disabled = false;
            autoFocusBtn.innerHTML = 'Challenge';
         }
      }
    }

    const restartBtn = document.getElementById('restart-exam')
    if (restartBtn) restartBtn.onclick = () => onRestart(questions, mode, subject, examType)

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
