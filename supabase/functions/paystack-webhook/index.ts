import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts"
import { createHmac } from "node:crypto"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!PAYSTACK_SECRET_KEY) {
      console.error("Missing PAYSTACK_SECRET_KEY")
      return new Response('Internal Server Error', { status: 500 })
    }

    const signature = req.headers.get('x-paystack-signature')
    const body = await req.text()

    if (!signature) {
      return new Response('Missing signature', { status: 401 })
    }

    const hash = createHmac('sha512', PAYSTACK_SECRET_KEY).update(body).digest('hex')
    if (hash !== signature) {
      console.error("Invalid signature mismatch")
      return new Response('Invalid signature', { status: 401 })
    }

    const event = JSON.parse(body)

    if (event.event === 'charge.success') {
      const email = event.data.customer?.email
      
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
         console.error("Missing Supabase env vars")
         return new Response('Internal error', { status: 500 })
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      
      // Find User
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, activation_status')
        .eq('email', email)
        .single()

      if (userError || !user) {
         console.error("User not found for email:", email)
         return new Response('User not found', { status: 404 })
      }

      // Check if this is the first activation or a monthly renewal
      // Here we assume if they are already activated, it's a monthly renewal. 
      // If we had distinct amounts, we could check event.data.amount as well.
      let planName = 'Monthly Renewed';
      if (!user.activation_status) {
         const { error: actError } = await supabaseAdmin.rpc('secure_activate_user', { p_user_id: user.id, p_plan: 'lifetime' })
         if (actError) throw actError;
         
         // Fetch initial credits from system_config (we default to 10 if we can't load it instantly)
         console.log(`Activated user ${email} successfully.`)
         await supabaseAdmin.from('users').update({ ai_credits: 10 }).eq('id', user.id)
         planName = 'Lifetime Activated';
      } else {
         const { error: subError } = await supabaseAdmin.rpc('secure_subscribe_user', { p_user_id: user.id, p_plan: 'monthly' })
         if (subError) throw subError;
         console.log(`Renewed user ${email} successfully.`)
      }

      // Dispatch Email Receipt via Resend API
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      if (RESEND_API_KEY && email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'CBT Elite <billing@resend.dev>',
            to: email,
            subject: 'Receipt: CBT Elite Pro Subscription',
            html: `
              <h2>Thank you for upgrading!</h2>
              <p>Your CBT Elite account has been updated: <strong>${planName}</strong></p>
              <p><strong>Amount Paid:</strong> ₦${(event.data.amount / 100).toLocaleString()}</p>
              <p>Sign in to start practicing smarter with AI.</p>
            `
          })
        }).catch(err => console.error("Email dispatch failed", err));
      }
    }

    return new Response('Event processed', { status: 200 })
  } catch (err) {
    console.error("Webhook processing error:", err)
    return new Response('Webhook handling failed', { status: 500 })
  }
})
