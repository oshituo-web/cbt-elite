// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, payload } = await req.json()

    // 1. Validate Input
    if (!GEMINI_API_KEY) {
      throw new Error("API Key missing in environment")
    }

    // 2. Secure Billing (for explain and grade)
    if (action === "explain" || action === "grade") {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) throw new Error("Missing Authorization header")

      const supabaseUserClient = createClient(
        SUPABASE_URL ?? '',
        SUPABASE_ANON_KEY ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )
      
      const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser()
      if (authError || !user) throw new Error("Unauthorized Request")

      const supabaseAdmin = createClient(
        SUPABASE_URL ?? '',
        SUPABASE_SERVICE_ROLE_KEY ?? ''
      )
      
      let cost = action === 'grade' ? 5 : 1
      const configKey = action === 'grade' ? 'cost_theory_grading' : 'cost_explanation'
      
      const { data: configData } = await supabaseAdmin
         .from('system_config')
         .select('value')
         .eq('key', configKey)
         .maybeSingle()
         
      if (configData && configData.value) {
         cost = parseInt(configData.value, 10) || cost;
      }

      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('ai_credits')
        .eq('id', user.id)
        .single()
        
      if (!userData || (userData.ai_credits || 0) < cost) {
         return new Response(JSON.stringify({ error: "Insufficient AI Credits", insufficient_credits: true }), { 
           status: 402, 
           headers: { ...corsHeaders, "Content-Type": "application/json" } 
         })
      }
      
      await supabaseAdmin
        .from('users')
        .update({ ai_credits: Math.max(0, userData.ai_credits - cost) })
        .eq('id', user.id)
    }

    // 3. Routing based on 'action'
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

    // 4. Call Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    })

    const data = await resp.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
