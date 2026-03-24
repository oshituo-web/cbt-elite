// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")

serve(async (req: Request) => {
  const { action, payload } = await req.json()

  // 1. Validate Input
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "API Key missing in environment" }), { status: 500 })
  }

  // 2. Routing based on 'action'
  let prompt = ""
  if (action === "generate") {
    const { exam, subject, topics, count, sample } = payload
    prompt = `
      As an expert JAMB/WAEC/NECO exam setter, generate exactly ${count} high-quality questions.
      Exam: ${exam}
      Subject: ${subject}
      Potential Topics: ${topics}
      ${sample || ""}
      
      Requirements:
      1. Subject-appropriate difficulty (mix of easy/medium/hard).
      2. 4 options (A-D).
      3. Detailed explanation for the answer.
      4. Universal Diagrams: If any question (Physics, Geography, Biology, etc.) would benefit from a visual aid, provide a DESCRIPTIVE placeholder in 'diagram_url': https://placehold.co/600x400?text=[Topic+Diagram+Description]
      
      Return ONLY a JSON array of objects:
      [{"exam_type": "${exam}", "subject": "${subject}", "topic": "...", "question": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_option": "A", "explanation": "...", "diagram_url": "..."}]
    `
  } else if (action === "explain") {
    prompt = `Explain this for a student: Q: ${payload.questionText}, Correct: ${payload.correctAnswer}, Student: ${payload.studentAnswer}. Return JSON: {"explanation": "..."}`
  } else if (action === "grade") {
    prompt = `Grade this theory: Student: ${payload.studentAnswer}, Model Points: ${JSON.stringify(payload.keyPoints)}. Return JSON: {"feedback": "..."}`
  }


  // 3. Call Gemini
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  })

  const data = await resp.json()
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  })
})
