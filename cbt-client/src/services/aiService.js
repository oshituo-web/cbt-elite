/**
 * AiService.js
 * Handles core AI interactions for Elite Learning Platform using Google Gemini.
 */

import { supabase } from '../utils/supabase'

/**
 * Executes a Supabase function with automatic exponential backoff for 429 Rate Limits.
 */
async function invokeWithRetry(functionName, options, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    const { data, error } = await supabase.functions.invoke(functionName, options);
    
    if (error) {
      let isRateLimit = false;
      let diagnosticMessage = error.message;

      // Extract details from the response body if available
      if (error.context) {
        try {
          const body = typeof error.context.json === 'function' ? await error.context.json() : error.context;
          if (body?.error) {
              diagnosticMessage = typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
              if (body.details) diagnosticMessage += ` (${body.details})`;
          }
          
          if (diagnosticMessage.includes('429') || diagnosticMessage.toLowerCase().includes('quota')) {
            isRateLimit = true;
          }
        } catch (e) {
           if (error.message.includes('429')) isRateLimit = true;
        }
      }

      if (isRateLimit && attempt < maxRetries - 1) {
        attempt++;
        const backoffMs = attempt * 2000;
        console.warn(`[AI Service] Rate limited or Quota issue. Retrying in ${backoffMs}ms... (Attempt ${attempt}/${maxRetries-1})`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }
      
      // If we're here, it's either not a rate limit or we're out of retries
      // We throw a more descriptive error for the UI
      const finalError = new Error(diagnosticMessage);
      finalError.status = error.status;
      return { data: null, error: finalError };
    }
    
    return { data, error };
  }
}

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
      const { data, error } = await invokeWithRetry('gemini-proxy', {
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
   * Handles a real-time chat interaction with the Elite AI Tutor.
   * @param {Object} question - The current question context (optional).
   * @param {string} userMessage - The student's message.
   * @param {Array} history - Previous messages in this session.
   * @param {string} topic - Optional topic context.
   * @param {string} subject - Optional subject context.
   * @returns {Promise<string>} - The AI response.
   */
  async tutorChat(question, userMessage, history = [], topic = null, subject = null) {
    const correctChoice = question?.answers?.find(a => a.is_correct)?.answer_text || "Unknown";
    
    // Context strings
    const questionContext = question ? `
      QUESTION: ${question.question_text}
      ${question.question_groups?.content ? `CONTEXT/PASSAGE: ${question.question_groups.content}` : ''}
      OPTIONS: ${question.answers?.map((a, i) => `${String.fromCharCode(65+i)}) ${a.answer_text}`).join(', ')}
      CORRECT ANSWER: ${correctChoice}
      EXPLANATION: ${question.explanation || 'No standard explanation available.'}
    ` : 'No specific question is currently being discussed.';

    const topicalContext = topic ? `
      CURRENT STUDY TOPIC: ${topic}
      SUBJECT: ${subject || 'General'}
    ` : '';

    // Construct the context-aware prompt
    const systemPrompt = `
      You are the "Elite AI Tutor", a world-class academic assistant for secondary and pre-university students (JAMB, WAEC, NECO standards).
      
      ${topicalContext}
      ${questionContext}
      
      INSTRUCTIONS:
      1. Be highly intelligent, smart, and context-aware. Detect the specific subject and topic automatically from the discussion.
      2. If a specific question is provided, use it as the primary focus. If only a topic is provided, act as a subject matter expert for that topic.
      3. Do NOT just give answers away; guide the student with Socratic questioning and pedagogical hints.
      4. Use Markdown for formatting and LaTeX for all mathematical or scientific formulas (e.g., $H_2O$, $v = u + at$).
      5. Tone: Elite, encouraging, authoritative yet accessible. 
      6. Limit responses to 150 words to fit a sidebar.
    `;

    // Format history for Gemini
    let fullPrompt = `${systemPrompt}\n\nCONVERSATION HISTORY:\n`;
    history.forEach(msg => {
      fullPrompt += `${msg.role === 'user' ? 'Student' : 'Elite AI'}: ${msg.content}\n`;
    });
    fullPrompt += `\nStudent: ${userMessage}\nElite AI:`;

    try {
      const { data, error } = await invokeWithRetry('gemini-proxy', {
        body: { 
           prompt: fullPrompt, 
           temperature: 0.8, 
           maxOutputTokens: 800 
        }
      });

      if (error || !data) throw error || new Error("Elite AI is taking a quick break.");

      return data.text || "I'm sorry, I couldn't process that. Could you rephrase?";
    } catch (err) {
      console.error("Tutor Chat Error:", err);
      return "I'm having trouble connecting to the Elite servers. Please try again in a moment.";
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
      const { data, error } = await invokeWithRetry('gemini-proxy', {
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
        const { data, error } = await invokeWithRetry('gemini-proxy', {
          body: { prompt: shortVersion ? promptShort : promptLong, temperature: 0.8, maxOutputTokens: shortVersion ? 150 : 800 }
        });

        if (error || !data) {
            console.error("AI Function Invoke Error:", error);
            throw error || new Error("API call failed.");
        }
        let text = data.text || "Strategy synthesis unavailable.";
        return text.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '');
      } catch (err) {
        console.error("AI Performance Error Detail:", err);
        
        // Attempt to extract the specific error message from the response body
        if (err.context && typeof err.context.json === 'function') {
            try {
                const body = await err.context.json();
                console.error("AI Function Error Body:", body);
            } catch (e) { /* ignore */ }
        }

        const fallbackMsg = "Elite AI strategist is currently offline for maintenance.";
        return shortVersion ? fallbackMsg : `<p style='color:var(--text-secondary); opacity: 0.7;'><em>${fallbackMsg}</em></p>`;
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
      const { data, error } = await invokeWithRetry('gemini-proxy', {
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
      You are "Elite AI Content Auditor". 
      An academic question has been reported for: "${reason}".
      Student Feedback: "${details}"
      
      ORIGINAL QUESTION: ${questionText}
      
      TASK: 
      1. CRITICAL: Perform a Deep Fact-Check against latest national secondary school syllabus standards (JAMB/WAEC/NECO).
      2. Correct any factual errors, grammatical issues, or formatting spikes (e.g., broken LaTeX).
      3. ENSURE LOGICAL CONSISTENCY: Solve the question step-by-step internally. If the correct answer was missing, add it as one of the options.
      4. Ensure exactly 4 clear options (A, B, C, D).
      5. Identify the correct option.
      6. Provide a robust pedagogical explanation that aligns with the current syllabus.
      
      VERIFICATION STEP:
      Before returning, re-read your generated question and options. Does the 'correct_option' you picked actually resolve the question accurately? If not, adjust until it is 100% correct.
      
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
      const { data, error } = await invokeWithRetry('gemini-proxy', {
        body: { prompt, temperature: 0.2, maxOutputTokens: 1200 }
      });

      if (error || !data) throw error || new Error("AI Repair service unavailable");
      const text = data.text || "{}";
      return JSON.parse(text);
    } catch (err) {
      console.error("AI Repair Error:", err);
      throw err;
    }
  },

  /**
   * Performs a diagnostic scan of a single question.
   */
  async auditQuestionDetailed(question) {
    const prompt = `
      You are "Elite AI Content Validator". 
      Analyze the following academic question for accuracy, syllabus alignment, and technical health.
      
      QUESTION: ${question.question_text}
      OPTIONS: A: ${question.option_a}, B: ${question.option_b}, C: ${question.option_c}, D: ${question.option_d}
      CORRECT: ${question.correct_option}
      EXPLANATION: ${question.explanation || 'None'}
      
      TASK:
      1. Grade this question on a health scale:
         - FACTUAL_ERROR: Factually wrong.
         - OUTDATED: No longer in the current syllabus.
         - FORMATTING: Broken LaTeX or text.
         - POOR_EXPLANATION: Explanation is missing or confusing.
         - HEALTHY: No issues found.
      2. Provide a 0-100 Health Score.
      3. Briefly state the issue if not Healthy.

      RETURN JSON ONLY:
      { "status": "...", "score": 85, "reason": "..." }
    `;

    try {
      const { data, error } = await invokeWithRetry('gemini-proxy', {
        body: { prompt, temperature: 0.1, maxOutputTokens: 300 }
      });
      if (error || !data) return { status: 'ERROR', score: 0, reason: 'AI Unreachable' };
      return JSON.parse(data.text);
    } catch (err) {
      return { status: 'ERROR', score: 0, reason: err.message };
    }
  },

  /**
   * Scans a batch of questions (max 50) in parallel.
   */
  async auditQuestionBatch(questions) {
    const results = [];
    const batchSize = 5; // Process in chunks to avoid overwhelming the proxy
    
    for (let i = 0; i < questions.length; i += batchSize) {
      const chunk = questions.slice(i, i + batchSize);
      const chunkResults = await Promise.all(chunk.map(async (q) => {
        const audit = await this.auditQuestionDetailed(q);
        return { ...q, audit };
      }));
      results.push(...chunkResults);
    }
    
    return results;
  },

  /**
   * Generates multiple high-quality academic questions from scratch.
   */
  async generateQuestions(exam, subject, topic, count = 5) {
    const prompt = `
      You are "Elite AI Question Architect". 
      Your task is to generate ${count} high-quality, exam-standard objective questions for the subject "${subject}" and topic "${topic || 'General'}" specifically tailored for the "${exam || 'General'}" examination standard.
      
      CRITICAL RULES (Failure to comply will break the database):
      1. DIFFICULTY: Match ${exam || 'JAMB/WAEC'} standard (balanced easy, medium, hard).
      2. FORMAT: Options must be plain text. Do NOT prefix them with "A)", "B)", etc.
      3. CORRECT OPTION: The 'correct_option' field MUST be strictly one of these four uppercase letters: "A", "B", "C", or "D".
      4. EXPLANATIONS: Provide deep pedagogical explanations for each.
      5. LaTeX: Use $...$ for inline math and $$...$$ for block math.
      
      RETURN A JSON ARRAY OF OBJECTS matching this exact schema:
      [
        {
          "question_text": "string",
          "option_a": "string (no prefix)",
          "option_b": "string (no prefix)",
          "option_c": "string (no prefix)",
          "option_d": "string (no prefix)",
          "correct_option": "A | B | C | D",
          "explanation": "string",
          "subject": "${subject}",
          "topic": "${topic}"
        }
      ]
    `;

    try {
      const { data, error } = await invokeWithRetry('gemini-proxy', {
        body: { 
            prompt, 
            temperature: 0.7, 
            maxOutputTokens: 3500,
            responseMimeType: "application/json"
        }
      });

      if (error || !data) throw error || new Error("AI Generation service unavailable");
      const text = data.text || "[]";
      const cleanJson = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
      
      let parsed = JSON.parse(cleanJson);
      if (!Array.isArray(parsed)) {
          if (parsed.questions && Array.isArray(parsed.questions)) {
              parsed = parsed.questions;
          } else {
              parsed = [parsed];
          }
      }
      
      // Auto-heal strictly to standard
      return parsed.map(q => ({
          ...q,
          correct_option: (q.correct_option || 'A').toUpperCase().replace(/[^ABCD]/g, '').charAt(0) || 'A',
          option_a: String(q.option_a || '').replace(/^[A-D][\.\)]\s*/i, ''),
          option_b: String(q.option_b || '').replace(/^[A-D][\.\)]\s*/i, ''),
          option_c: String(q.option_c || '').replace(/^[A-D][\.\)]\s*/i, ''),
          option_d: String(q.option_d || '').replace(/^[A-D][\.\)]\s*/i, ''),
      }));
    } catch (err) {
      console.error("AI Question Generation Error:", err);
      throw err;
    }
  }
}
