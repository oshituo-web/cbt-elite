import { DataService } from '../services/data'
import { SubscriptionService } from '../services/subscriptionService'
import { SubscriptionManager } from '../utils/subscriptionManager'
import { TopicDeepDiveComponent } from './TopicDeepDive'

export const ResultsComponent = {
  async render(questions, userAnswers, onRestart, onReview, profile, mode, subject, examType, timeTaken, onBack) {
    let isSystemFree = false;
    try {
        const configResp = await DataService.getSystemConfig('explanations_free_access');
        isSystemFree = configResp.data?.value === true || configResp.data?.value === 'true';
    } catch (err) {
        console.warn("Failed to fetch global config:", err);
    }
    const container = document.getElementById('dashboard-container')
    container.style.display = 'block'
    container.innerHTML = `
      <div class="glass card scale-in" style="width: min(800px, 92vw); margin: 3rem auto; padding: 2.5rem 1rem; text-align: center;">
        <div class="loader-spinner mb-lg" style="margin: 0 auto; width: 48px; height: 48px;"></div>
        <h2 style="font-family: 'Outfit'; font-size: 1.75rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Finalizing Your Story</h2>
        <p style="color: var(--text-secondary); font-weight: 500; font-size: 1rem;">Saving progress...</p>
      </div>
    `

    const objQuestions = questions.filter(q => q.question_type !== 'theory')
    
    let correct = 0
    objQuestions.forEach((q, i) => {
      const qIdx = questions.indexOf(q)
      const selectedId = userAnswers[qIdx]
      const correctAnswer = q.answers.find(a => a.is_correct)
      if (selectedId === correctAnswer?.id) correct++
    })

    const scorePercent = objQuestions.length > 0 ? Math.round((correct / objQuestions.length) * 100) : 0
    
    if (profile && profile.id) {
        DataService.saveExamSession(profile.id, {
            session_type: mode,
            subject: subject || 'Various',
            total_questions: questions.length,
            correct_answers: correct,
            time_taken_seconds: timeTaken,
            score_percentage: scorePercent
        }, questions, userAnswers).catch(err => console.error("Result save error:", err))
    }

    const isJambMock = mode === 'exam' && examType === 'JAMB'
    const statsGroup = {}
    questions.forEach((q, i) => {
        const key = isJambMock ? (q.subject || 'General') : (q.topic || 'General')
        if (!statsGroup[key]) statsGroup[key] = { total: 0, correct: 0 }
        statsGroup[key].total++
        if (q.question_type !== 'theory') {
            const correctAnswer = q.answers.find(a => a.is_correct)
            if (userAnswers[i] === correctAnswer?.id) statsGroup[key].correct++
        }
    })

    container.innerHTML = `
      <div class="results-view-container" style="width: 100%; max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem; box-sizing: border-box;">
        <div class="glass card scale-in" style="padding: 2.5rem 1rem; position: relative; text-align: center; width: 100%; box-sizing: border-box;">
          <button id="results-back-btn" class="btn-secondary" style="position: absolute; top: 1rem; left: 1rem; width: 40px; height: 40px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%;" title="Go Back">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          
          <div style="margin-bottom: 2.5rem; padding-top: 1rem;">
            <h2 style="font-family: 'Outfit'; font-size: 2rem; font-weight: 900; color: var(--text-primary); margin-bottom: 0.5rem;">Session Complete</h2>
            <p style="color: var(--text-secondary); font-weight: 500;">Great effort! Here is your breakdown.</p>
          </div>
          
          <div style="margin-bottom: 2.5rem; width: 100%;">
            <div class="glass card" style="text-align: center; padding: 2rem 1rem; border: 2px solid var(--primary); background: rgba(37, 99, 235, 0.05); width: 100%; box-sizing: border-box;">
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-weight: 800; text-transform: uppercase;">Objective Score</div>
              <div style="font-size: clamp(2.5rem, 12vw, 4rem); font-weight: 900; color: var(--primary); line-height: 1; font-family: 'Outfit';">${correct} / ${objQuestions.length}</div>
              <div style="font-size: 1.2rem; color: var(--text-primary); margin-top: 0.75rem; font-weight: 800;">${scorePercent}% Accuracy</div>
            </div>
          </div>

          <!-- Premium CTA -->
          ${(() => {
            const subState = SubscriptionManager.getUserSubscriptionState(profile, isSystemFree);
            if (subState.tier === 'premium' && !subState.shouldShowRenewCTA) return '';

            if (!profile || !profile.activation_status) {
              return `
                <div class="glass card scale-in mb-xl" style="padding: 1.5rem; border-left: 6px solid var(--accent-primary); background: rgba(37, 99, 235, 0.05); text-align: left; width: 100%; box-sizing: border-box;">
                  <h4 style="color: var(--accent-primary); margin: 0 0 0.5rem 0; font-family: 'Outfit'; font-size: 1.25rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="sparkles"></i> Boost Your Score</h4>
                  <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem;">Premium users get AI explanations that help them learn 2x faster.</p>
                  <button class="btn-primary" style="width: 100%; max-width: 300px;" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                     Activate Lifetime Access
                  </button>
                </div>
              `;
            } else if (subState.shouldShowRenewCTA || subState.isExpired) {
              return `
                <div class="glass card scale-in mb-xl" style="padding: 1.5rem; border-left: 6px solid var(--accent-secondary); background: rgba(147, 51, 234, 0.05); text-align: left; width: 100%; box-sizing: border-box;">
                  <h4 style="color: var(--accent-secondary); margin: 0 0 0.5rem 0; font-family: 'Outfit'; font-size: 1.25rem; font-weight: 800;"><i data-lucide="rocket"></i> Renew Premium</h4>
                  <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem;">Keep enjoying AI explanations and unlimited exams.</p>
                  <button class="btn-primary" style="background: var(--accent-secondary); width: 100%; max-width: 300px;" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                     Renew Now – ₦1,000
                  </button>
                </div>
              `;
            }
            return '';
          })()}

          <!-- PERFORMANCE BY TOPIC -->
          <div style="text-align: left; width: 100%;">
            <h3 style="font-family: 'Outfit'; margin-bottom: 1.25rem; font-size: 1.35rem; font-weight: 800; color: var(--text-primary);">
                ${isJambMock ? 'By Subject' : 'By Topic'}
            </h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2.5rem; width: 100%;">
              ${(() => {
                let weakest = null
                let minPercent = 101

                return Object.entries(statsGroup).map(([label, stats]) => {
                  const percent = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
                  const isSuccess = percent >= 50
                  if (percent < minPercent && stats.total > 0) { minPercent = percent; weakest = label; }
                  this._weakestTopic = (minPercent < 60) ? weakest : null

                  return `
                    <div class="glass" style="padding: 1rem; border-radius: 12px; border-left: 4px solid ${isSuccess ? 'var(--success)' : 'var(--error)'}; width: 100%; box-sizing: border-box;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem; flex-wrap: wrap; gap: 0.5rem;">
                        <span style="font-weight: 800; color: var(--text-primary);">${label}</span>
                        <span style="color: ${isSuccess ? 'var(--success)' : 'var(--error)'}; font-weight: 900;">${stats.correct}/${stats.total} (${percent}%)</span>
                      </div>
                      <div class="progress-v2-container" style="height: 6px;"><div class="progress-v2-fill ${isSuccess ? 'success' : 'error'}" style="width: ${percent}%;"></div></div>
                    </div>
                  `
                }).join('')
              })()}
            </div>
          </div>

          <!-- AI TUTOR SMART RECOMMENDATION -->
          ${this._weakestTopic ? `
            <div class="glass card scale-in mb-xl" style="background: var(--accent-gradient); border: none; padding: 2rem 1rem; text-align: left; color: white; width: 100%; box-sizing: border-box;">
               <h3 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.5rem; margin-bottom: 0.5rem;">Master "${this._weakestTopic}"</h3>
               <p style="opacity: 0.9; margin-bottom: 1.5rem; font-size: 0.95rem;">Reviewing core concepts here could boost your score by up to 15%.</p>
               <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                 <button id="deep-dive-btn" class="btn-secondary" style="background: white; color: var(--primary); border: none; font-weight: 800; flex: 1; min-width: 140px;">Summary</button>
                 <button id="auto-focus-btn" class="btn-secondary" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); font-weight: 800; flex: 1; min-width: 140px;">Challenge</button>
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
            alert("No questions found.");
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
    if (homeBtn) homeBtn.onclick = () => onBack ? onBack() : location.reload()

    const backBtn = document.getElementById('results-back-btn')
    if (backBtn) backBtn.onclick = () => onBack ? onBack() : location.reload()

    if (window.lucide) window.lucide.createIcons();
  }
}
