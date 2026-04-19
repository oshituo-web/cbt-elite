import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      console.error("DIAGNOSTIC: GEMINI_API_KEY is missing from environment variables.")
      return new Response(JSON.stringify({ error: "Gemini API key not configured on Supabase (Secret is missing)" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let requestBody;
    try {
      requestBody = await req.json()
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use gemini-1.5-flash-latest as the high-availability identifier
    const { prompt, temperature = 0.7, maxOutputTokens = 1000 } = requestBody
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // PRODUCTION MODEL: Verified from account model list
    const modelToUse = "models/gemini-2.5-flash";
    
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens }
    }

    console.log(`DIAGNOSTIC: Using verified production model: ${modelToUse}`)

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelToUse}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ 
            error: `Google API Error (${response.status}) during dynamic call`,
            model_attempted: modelToUse,
            details: errorText.substring(0, 200)
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || null
    
    if (!text) {
        return new Response(JSON.stringify({ error: "No text candidate returned from Gemini" }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Edge Function Error", details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
