/**
 * AiService.js
 * Handles core AI interactions for Elite Learning Platform using Google Gemini.
 */

import { supabase } from '../utils/supabase'

export const AiService = {
  /**
   * Generates a deep, pedagogical explanation for a question.
   * @param {Object} question - The question object.
   * @param {string} userChoiceId - The ID of the answer the user selected.
   * @param {string} correctChoiceId - The ID of the correct answer.
   * @param {Object} userAnalytics - Historical user data to tailor the tutor's memory.
   * @returns {Promise<string>} - The AI generated explanation.
   */
  async getDeepExplanation(question, userChoiceId, correctChoiceId, userAnalytics = null) {


    const userChoice = question.answers.find(a => a.id === userChoiceId)?.answer_text || (userChoiceId && typeof userChoiceId === 'string' ? userChoiceId : "None");
    const correctChoice = question.answers.find(a => a.id === correctChoiceId)?.answer_text || (correctChoiceId && typeof correctChoiceId === 'string' ? correctChoiceId : "Unknown");

    let contextSection = "";
    if (userAnalytics && userAnalytics.mastery) {
        const weakSubjects = userAnalytics.mastery.filter(m => m.average < 60).map(m => m.subject).join(", ");
        const strongSubjects = userAnalytics.mastery.filter(m => m.average >= 70).map(m => m.subject).join(", ");
        
        contextSection = `
        STUDENT PROFILE BACKGROUND:
        - The student has past weaknesses in: ${weakSubjects || 'None systematically yet.'}
        - The student has demonstrated strength in: ${strongSubjects || 'Currently building foundations.'}
        - Tone Instruction: Acknowledge their journey. If this topic aligns with their weaknesses, encourage them actively and break it down more granularly. If it's a strength, praise their consistency and offer a more advanced abstract perspective. Connect it to their broader goals.
        `;
    }

    const prompt = `
      You are "Elite AI", a world-class academic tutor. 
      Analyze the following academic question and provide a deep, friendly, and structured explanation.
      
      ${contextSection}
      
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
      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: { prompt, temperature: 0.7, maxOutputTokens: 1000 }
      })

      if (error || !data) throw error || new Error("Elite AI is currently resting. Please try again later.")

      return data.text || "Elite AI couldn't generate an explanation. Please check the standard explanation."
    } catch (err) {
      console.error("AiService Error:", err)
      throw err
    }
  },

  /**
   * Generates a dynamic HTML study guide for a specific topic, tailored by historical weak/strong points.
   */
  async getTopicDeepDive(topic, subject, userAnalytics = null) {


    let memoryContext = "The student is exploring this topic.";
    if (userAnalytics && userAnalytics.mastery) {
        const subData = userAnalytics.mastery.find(m => m.subject.toLowerCase() === (subject || '').toLowerCase());
        if (subData) {
            if (subData.average < 50) memoryContext = `The student has historically struggled with ${subject} (Mastery: ${subData.average}%). Break this concept down fundamentally. Focus on building confidence.`;
            else if (subData.average > 70) memoryContext = `The student is strong in ${subject} (Mastery: ${subData.average}%). Keep the explanation crisp, advanced, and focus on nuanced edge cases.`;
            else memoryContext = `The student has average proficiency in ${subject} (${subData.average}%). Provide a solid, balanced overview.`;
        }
    }

    const prompt = `
      You are "Elite AI", a world-class academic tutor.
      Topic: "${topic}" within the subject "${subject || 'General'}".
      Context on Student: ${memoryContext}
      
      Create a highly targeted study guide (max 150 words). 
      Include 2-3 key bullet points and one core rule, formula, or fundamental law if applicable.
      Return the response formatted purely in HTML tags (e.g. <h3>, <ul>, <li>, <p>) so it can be injected directly into a web interface. Do not include markdown formatting or backticks.
      Ensure the tone aligns with the Context on Student.
    `;

    try {
      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: { prompt, temperature: 0.7, maxOutputTokens: 600 }
      });

      if (error || !data) throw error || new Error("Elite AI is currently resting. Please try again later.");

      let htmlText = data.text || "No summary available.";
      return htmlText.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '');
    } catch (err) {
      console.error("AiService Deep Dive Error:", err);
      throw err;
    }
  },

  /**
   * Translates raw JSON performance metrics into human-readable, bespoke AI strategy.
   * @param {Object} analytics - The raw user analytics object { history, mastery }
   * @param {boolean} shortVersion - If true, returns a 2-sentence summary instead of full HTML blocks.
   * @returns {Promise<string>}
   */
  async getAIPerformanceSummary(analytics, shortVersion = false) {


     if (!analytics || !analytics.mastery || analytics.mastery.length === 0) {
        return shortVersion 
            ? "Analyzing your initial baseline... complete a few more practices!" 
            : `<div style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Need more session data to establish an Elite AI baseline. Complete a practice module to begin.</div>`;
     }

     // Compress Analytics Payload for Token Efficiency
     const payload = {
        totalSessions: analytics.history?.length || 0,
        subjects: analytics.mastery.map(m => ({ sub: m.subject, score: m.average, limit: m.total_attempted }))
     };

     const promptShort = `
        You are "Elite AI", a precise academic advisor. 
        Analyze the following student data payload: ${JSON.stringify(payload)}
        Write exactly TWO sentences. Identify their strongest point, then direct their focus to their weakest point with a short encouraging remark.
        Output purely plain text (no markdown formatting or styles).
     `;

     const promptLong = `
        You are "Elite AI", a master academic strategist.
        Analyze this student's data payload: ${JSON.stringify(payload)}
        
        Write a robust, 2-3 paragraph performance synthesis targeted directly AT the student (e.g., "Looking at your recent sessions..."). 
        Identify their dominant strengths and deeply analyze their core weaknesses, suggesting a strategic path forward.
        Return the response cleanly formatted in HTML using <p> tags with bolding (<strong>) for subjects or key metrics. 
        Do not use markdown backticks. Do not include raw JSON. Maintain an elite, encouraging, and authoritative tone.
     `;

     try {
       const { data, error } = await supabase.functions.invoke('gemini-proxy', {
         body: { prompt: shortVersion ? promptShort : promptLong, temperature: 0.8, maxOutputTokens: shortVersion ? 150 : 800 }
       });

       if (error || !data) throw error || new Error("API call failed.");
       let text = data.text || "Strategy synthesis unavailable.";
       return text.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '');
     } catch (err) {
       console.error("AI Performance Error:", err);
       return shortVersion ? "AI Synthesis unavailable right now." : "<p style='color:var(--error);'>Could not load AI synthesis at this time.</p>";
     }
  },

  /**
   * Projects a JAMB score (0-400) based on weighted subject mastery.
   */
  getPredictedJAMBScore(analytics) {
    if (!analytics || !analytics.mastery || analytics.mastery.length === 0) return 0;
    
    // JAMB consists of 4 subjects. We calculate the average of all subjects or the top 4.
    const scores = analytics.mastery.map(m => m.average);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // Normalize 0-100% to 0-400 score
    // We add a slight "exam pressure" penalty of 5% for realism
    const prediction = (average * 4) * 0.95;
    return Math.round(prediction);
  },

  /**
   * Generates a "Focus for Today" study plan using Gemini.
   */
  async generateTodayFocus(analytics) {

    
    const weakSubjects = (analytics.mastery || [])
      .filter(m => m.average < 60)
      .sort((a, b) => a.average - b.average)
      .slice(0, 2);

    if (weakSubjects.length === 0) return "You're performing well across the board! Focus on maintaining consistency.";

    const prompt = `
      You are "Elite AI Strategist". 
      Based on this student's weakness in ${weakSubjects.map(s => s.subject).join(', ')}, 
      give a ONE-SENTENCE, high-energy recommendation for what they should study today.
      Keep it under 30 words. No markdown.
    `;

    try {
      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: { prompt, temperature: 0.7, maxOutputTokens: 100 }
      });
      if (error || !data) throw error;
      return data.text || "Focus on your weakest areas today.";
    } catch (err) {
      return "Double down on your weakest subjects today.";
    }
  },

  /**
   * AI-powered question repair for administrators.
   */
  async repairQuestion(questionText, reason, details) {


    const prompt = `
      You are "Elite AI", a content auditor.
      An academic question has been reported for: "${reason}".
      Student Feedback: "${details}"
      
      ORIGINAL QUESTION: ${questionText}
      
      TASK: 
      1. Correct any errors (factual, grammatical, or formatting).
      2. Ensure exactly 4 clear options (A, B, C, D).
      3. Identify the correct option.
      4. Provide a robust pedagogical explanation.
      
      RETURN ONLY A JSON OBJECT with these keys:
      {
        "question_text": "...",
        "option_a": "...",
        "option_b": "...",
        "option_c": "...",
        "option_d": "...",
        "correct_option": "A" | "B" | "C" | "D",
        "explanation": "..."
      }
      Do not include any other text or markdown backticks.
    `;

    try {
      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: { prompt, temperature: 0.2, maxOutputTokens: 1200 }
      });

      if (error || !data) {
        throw error || new Error("AI Repair service unavailable");
      }
      const text = data.text || "{}";
      return JSON.parse(text);
    } catch (err) {
      console.error("AI Repair Error:", err);
      throw err;
    }
  }
}
