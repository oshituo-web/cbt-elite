/**
 * AiService.js
 * Handles core AI interactions for Elite Learning Platform using Google Gemini.
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_MODEL = "gemini-1.5-flash"

export const AiService = {
  /**
   * Generates a deep, pedagogical explanation for a question.
   * @param {Object} question - The question object.
   * @param {string} userChoiceId - The ID of the answer the user selected.
   * @param {string} correctChoiceId - The ID of the correct answer.
   * @returns {Promise<string>} - The AI generated explanation.
   */
  async getDeepExplanation(question, userChoiceId, correctChoiceId) {
    if (!GEMINI_API_KEY) {
      throw new Error("Elite AI is currently unavailable (M-API-KEY missing).")
    }

    const userChoice = question.answers.find(a => a.id === userChoiceId)?.answer_text || "None"
    const correctChoice = question.answers.find(a => a.id === correctChoiceId)?.answer_text || "Unknown"

    const prompt = `
      You are "Elite AI", a world-class academic tutor. 
      Analyze the following academic question and provide a deep, friendly, and structured explanation.
      
      QUESTION: ${question.question_text}
      ${question.question_groups?.content ? `CONTEXT/PASSAGE: ${question.question_groups.content}` : ''}
      
      USER SELECTED: ${userChoice}
      CORRECT ANSWER: ${correctChoice}
      
      STEPS FOR YOUR RESPONSE:
      1. Briefly validate the user if they were close, or kindly explain why the correct answer is superior.
      2. Provide a step-by-step breakdown of the logic required to solve this.
      3. Mention the core concept being tested.
      4. If this is a science or math question, ensure all formulas are formatted in LaTeX (e.g., $E=mc^2$).
      5. Keep the tone encouraging and academic.
      6. Use double newlines for paragraph separation.
      
      Respond only with the explanation text.
    `

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
        })
      })

      if (!response.ok) throw new Error("Elite AI is currently resting. Please try again later.")

      const data = await response.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Elite AI couldn't generate an explanation. Please check the standard explanation."
    } catch (err) {
      console.error("AiService Error:", err)
      throw err
    }
  }
}
