import 'dotenv/config';
import fetch from 'node-fetch';

async function testGen() {
  const prompt = `
      You are "Elite AI Question Architect". 
      Your task is to generate 2 high-quality, exam-standard objective questions for the subject "Mathematics" and topic "Algebra".
      
      STANDARDS:
      1. DIFFICULTY: Match JAMB/WAEC standard (balanced easy, medium, hard).
      2. FORMAT: Exactly 4 options (A, B, C, D).
      3. ACCURACY: Fact-check every question internally.
      4. EXPLANATIONS: Provide deep pedagogical explanations for each.
      5. LaTeX: Use $...$ for inline math and $$...$$ for block math.
      
      RETURN ONLY A JSON ARRAY of objects:
      [
        {
          "question_text": "...",
          "option_a": "...",
          "option_b": "...",
          "option_c": "...",
          "option_d": "...",
          "correct_option": "A" | "B" | "C" | "D",
          "explanation": "...",
          "subject": "Mathematics",
          "topic": "Algebra"
        }
      ]
      No other text or markdown backticks.
  `;

  const reqBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 2500 }
  };

  const API_KEY = process.env.VITE_SUPABASE_ANON_KEY; // I might need Gemini key
  console.log("Waiting for prompt...");
}

testGen();
