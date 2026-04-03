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
      <div class="glass card" style="max-width: 800px; margin: 50px auto; padding: 3rem; text-align: center;">
        <div class="loader-spinner" style="margin: 2rem auto;"></div>
        <h2 style="font-family: 'Outfit';">Finalizing Results...</h2>
        <p style="color: var(--text-primary);">Saving your progress and generating your performance report.</p>
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
      <div class="glass card results-container" style="max-width: 900px; width: 95%; margin: 2rem auto; padding: 2rem; position: relative; text-align: center;">
        <button id="results-back-btn" class="btn-secondary" style="position: absolute; top: 1.5rem; left: 1.5rem; padding: 0.4rem 0.6rem; border-radius: 8px;" title="Go Back">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h2 style="font-family: 'Outfit'; font-size: 1.75rem; margin-bottom: 2rem;">Exam Results</h2>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
          <div class="result-card" style="text-align: center; padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-primary); margin-bottom: 0.5rem; letter-spacing: 0.1em;">OBJECTIVE SCORE</div>
            <div style="font-size: 3.5rem; font-weight: 800; color: var(--accent-primary); line-height: 1;">${correct} / ${objQuestions.length}</div>
            <div style="font-size: 1.15rem; color: var(--text-primary); margin-top: 0.75rem; font-weight: 700;">${scorePercent}% Correct</div>
          </div>
        </div>

        <!-- Premium CTA for Results -->
        ${(() => {
          const subState = SubscriptionManager.getUserSubscriptionState(profile, isSystemFree);
          if (subState.tier === 'premium' && !subState.shouldShowRenewCTA) return '';

          if (subState.shouldShowActivateCTA) {
            return `
              <div class="glass card scale-in" style="margin-bottom: 2.5rem; padding: 1.5rem; border: 1px solid var(--accent-primary); background: rgba(59, 130, 246, 0.05); border-radius: 12px;">
                <h4 style="color: var(--accent-primary); margin-bottom: 0.5rem; font-family: 'Outfit';">Boost your score by 40%! \uD83D\uDE80</h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Premium users get detailed AI-powered corrections and personalized study paths that double performance speed.</p>
                <button class="primary" style="padding: 0.6rem 1.2rem; font-size: 0.85rem;" onclick="location.reload()">
                   Activate Lifetime Access – ₦1,500
                </button>
              </div>
            `;
          } else if (subState.shouldShowRenewCTA) {
            return `
              <div class="glass card scale-in" style="margin-bottom: 2.5rem; padding: 1.5rem; border: 1px solid var(--accent-secondary); background: rgba(255, 152, 0, 0.05); border-radius: 12px;">
                <h4 style="color: var(--accent-secondary); margin-bottom: 0.5rem; font-family: 'Outfit';">Keep the Momentum! \u26A1</h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Renew Premium to continue enjoying AI explanations and unlimited mock exams.</p>
                <button class="primary" style="padding: 0.6rem 1.2rem; font-size: 0.85rem;" onclick="location.reload()">
                   Renew Premium – ₦1,000/month
                </button>
              </div>
            `;
          }
          return '';
        })()}

        <h3 style="text-align: left; font-family: 'Outfit'; margin-bottom: 1rem; font-size: 1.25rem;">
            ${isJambMock ? 'Performance by Subject' : 'Performance by Topic'}
        </h3>
        <div style="display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 3rem;">
          ${Object.entries(statsGroup).map(([label, stats]) => {
            const percent = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
            return `
              <div style="text-align: left;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem;">
                  <span style="font-weight: 600;">${label}</span>
                  <span style="color: ${percent >= 50 ? 'var(--success)' : 'var(--error)'}; font-weight: 800;">${stats.correct} / ${stats.total} (${percent}%)</span>
                </div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                  <div style="width: ${percent}%; height: 100%; background: ${percent >= 50 ? 'var(--success)' : 'var(--error)'}; transition: width 0.5s ease;"></div>
                </div>
              </div>
            `
          }).join('')}
        </div>

        <div style="margin-bottom: 2rem;">
          <p style="color: var(--text-secondary); margin-bottom: 1rem; font-weight: 600;">View your performance and explanations</p>
          <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center;">
            <button class="primary" id="restart-exam" style="flex: 1; min-width: 200px; padding: 1rem;">Retake Practice</button>
            <button class="btn-secondary" id="review-exam" data-tooltip="Tap here after a test to see explanations and corrections" style="flex: 1; min-width: 200px; padding: 1rem; border-color: var(--accent-primary);">Review Questions</button>
            <button class="btn-secondary" id="back-home" style="flex: 1; min-width: 200px; padding: 1rem;">← Back to Dashboard</button>
          </div>
        </div>

      </div>
    `


    document.getElementById('restart-exam').onclick = onRestart
    document.getElementById('review-exam').onclick = onReview
    document.getElementById('back-home').onclick = () => {
        if (onBack) onBack(); else location.reload();
    }
    document.getElementById('results-back-btn').onclick = () => {
        if (onBack) onBack(); else location.reload();
    }



  }
}
