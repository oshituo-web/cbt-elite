import { DataService } from '../services/data'

export const ResultsComponent = {
  async render(questions, userAnswers, onRestart, onReview, profile, mode, subject, examType, timeTaken, onBack) {
    const container = document.getElementById('dashboard-container')
    container.style.display = 'block'
    container.innerHTML = `
      <div class="glass card" style="max-width: 800px; margin: 50px auto; padding: 3rem; text-align: center;">
        <div class="loader-spinner" style="margin: 2rem auto;"></div>
        <h2 style="font-family: 'Outfit';">Finalizing Results...</h2>
        <p style="color: #ffffff;">Saving your progress and generating your performance report.</p>
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
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 3rem;">
          <div class="result-card" style="text-align: center; padding: 1rem;">
            <div style="font-size: 0.75rem; color: #ffffff; margin-bottom: 0.5rem; letter-spacing: 0.1em;">OBJECTIVE SCORE</div>
            <div style="font-size: 3.5rem; font-weight: 800; color: var(--accent-primary); line-height: 1;">${correct} / ${objQuestions.length}</div>
            <div style="font-size: 1.15rem; color: #ffffff; margin-top: 0.75rem; font-weight: 700;">${scorePercent}% Correct</div>
          </div>
        </div>

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

        <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; margin-top: 2rem;">
          <button class="primary" id="restart-exam" style="flex: 1; min-width: 200px; padding: 1rem;">Retake Practice</button>
          <button class="btn-secondary" id="review-exam" style="flex: 1; min-width: 200px; padding: 1rem; border-color: var(--accent-primary);">Review Detailed Answers</button>
          <button class="btn-secondary" id="back-home" style="flex: 1; min-width: 200px; padding: 1rem;">← Back to Dashboard</button>
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
