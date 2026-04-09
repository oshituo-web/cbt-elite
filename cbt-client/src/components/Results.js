import { DataService } from '../services/data'
import { SubscriptionService } from '../services/subscriptionService'
import { SubscriptionManager } from '../utils/subscriptionManager'

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
      <div class="glass card scale-in" style="width: min(800px, 92vw); margin: 3rem auto; padding: 2.5rem 1.25rem; text-align: center;">
        <div class="loader-spinner mb-lg" style="margin: 0 auto; width: 48px; height: 48px;"></div>
        <h2 style="font-family: 'Outfit'; font-size: 2rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Finalizing Your Story</h2>
        <p style="color: var(--text-secondary); font-weight: 500; font-size: 1.1rem;">Saving your progress to the Elite database...</p>
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
    
    // Save Session and get Theory results (background)
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
      <div class="glass card scale-in" style="width: min(900px, 92vw); margin: 2rem auto; padding: 2.5rem 1.25rem; position: relative; text-align: center;">
        <button id="results-back-btn" class="btn-secondary" style="position: absolute; top: 1.5rem; left: 1.5rem; width: 44px; height: 44px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%;" title="Go Back">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        
        <div style="margin-bottom: 3.5rem;">
          <h2 style="font-family: 'Outfit'; font-size: 2.2rem; font-weight: 900; color: var(--text-primary); margin-bottom: 0.5rem;">Session Complete</h2>
          <p style="color: var(--text-secondary); font-weight: 500; font-size: 1.1rem;">Here is a breakdown of your elite performance.</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; margin-bottom: 3.5rem;">
          <div class="glass card" style="text-align: center; padding: 2.5rem; border: 2px solid var(--primary); background: linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, transparent 100%);">
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em;">Objective Score</div>
            <div style="font-size: clamp(3rem, 15vw, 4.5rem); font-weight: 900; color: var(--primary); line-height: 1; font-family: 'Outfit';">${correct} / ${objQuestions.length}</div>
            <div style="font-size: 1.4rem; color: var(--text-primary); margin-top: 1rem; font-weight: 800;">${scorePercent}% Accurate</div>
          </div>
        </div>

        <!-- Premium CTA for Results -->
        ${(() => {
          const subState = SubscriptionManager.getUserSubscriptionState(profile, isSystemFree);
          if (subState.tier === 'premium' && !subState.shouldShowRenewCTA) return '';

          if (subState.shouldShowActivateCTA) {
            return `
              <div class="glass card scale-in mb-xl" style="padding: 1.5rem; border-left: 6px solid var(--accent-primary); background: linear-gradient(90deg, rgba(37, 99, 235, 0.05) 0%, transparent 100%); text-align: left;">
                <h4 style="color: var(--accent-primary); margin: 0 0 0.5rem 0; font-family: 'Outfit'; font-size: 1.35rem; font-weight: 800; display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="sparkles"></i> Boost your score by 40%!</h4>
                <p style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 1.5rem; font-weight: 500;">Premium users get detailed AI-powered corrections and personalized study paths that double performance speed.</p>
                <button class="btn-primary" style="padding: 0 2rem; height: 48px;" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                   Activate Lifetime Access – ₦1,500
                </button>
              </div>
            `;
          } else if (subState.shouldShowRenewCTA) {
            return `
              <div class="glass card scale-in mb-xl" style="padding: 1.5rem; border-left: 6px solid var(--accent-secondary); background: linear-gradient(90deg, rgba(147, 51, 234, 0.05) 0%, transparent 100%); text-align: left;">
                <h4 style="color: var(--accent-secondary); margin: 0 0 0.5rem 0; font-family: 'Outfit'; font-size: 1.35rem; font-weight: 800; display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="rocket"></i> Keep the Momentum!</h4>
                <p style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 1.5rem; font-weight: 500;">Renew Premium to continue enjoying AI explanations and unlimited mock exams.</p>
                <button class="btn-primary" style="background: var(--accent-secondary); padding: 0 2rem; height: 48px;" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                   Renew Premium – ₦1,000/month
                </button>
              </div>
            `;
          }
          return '';
        })()}

        <div style="text-align: left;">
          <h3 style="font-family: 'Outfit'; margin-bottom: 1.5rem; font-size: 1.5rem; font-weight: 800; color: var(--text-primary);">
              ${isJambMock ? 'Performance by Subject' : 'Performance by Topic'}
          </h3>
          <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 4rem;">
            ${Object.entries(statsGroup).map(([label, stats]) => {
              const percent = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
              const isSuccess = percent >= 50
              return `
                <div class="glass" style="padding: 1.25rem; border-radius: 12px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.95rem;">
                    <span style="font-weight: 800; color: var(--text-primary);">${label}</span>
                    <span style="color: ${isSuccess ? 'var(--success)' : 'var(--error)'}; font-weight: 900; font-family: 'Outfit';">${stats.correct} / ${stats.total} (${percent}%)</span>
                  </div>
                  <div class="progress-v2-container">
                    <div class="progress-v2-fill ${isSuccess ? 'success' : 'error'}" style="width: ${percent}%;"></div>
                  </div>
                </div>
              `
            }).join('')}
          </div>
        </div>

        <div class="glass card" style="padding: 2.5rem; background: rgba(0,0,0,0.1); border-radius: 20px;">
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.85rem;">What's your next move?</p>
          <div style="display: flex; flex-wrap: wrap; gap: 1.25rem; justify-content: center;">
            <button class="btn-primary" id="restart-exam" style="flex: 1; min-width: 200px; height: 56px;">Retake Session</button>
            <button class="btn-secondary" id="review-exam" style="flex: 1; min-width: 200px; height: 56px; border-color: var(--accent-primary); border-width: 2px;">Review Correction</button>
            <button class="btn-secondary" id="back-home" style="flex: 1; min-width: 200px; height: 56px;">← Back to Dashboard</button>
          </div>
        </div>

      </div>
    `


    document.getElementById('restart-exam').onclick = onRestart
    document.getElementById('review-exam').onclick = onReview
    document.getElementById('back-home').onclick = () => {
        document.getElementById('back-home').style.opacity = '0.5';
        console.log("Results: Navigating back to dashboard...");
        if (onBack) onBack(); else location.reload();
    }
    document.getElementById('results-back-btn').onclick = () => {
        if (onBack) onBack(); else location.reload();
    }

    if (window.lucide) window.lucide.createIcons();
  }
}
