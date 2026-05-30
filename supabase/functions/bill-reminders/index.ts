// Supabase Edge Function — Bill Due Reminders
// Deploy: supabase functions deploy bill-reminders
// Schedule via Supabase cron: select cron.schedule('bill-reminders', '0 8 * * *', $$select net.http_post(...)$$);
// Or invoke manually: supabase functions invoke bill-reminders

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'https://your-app.netlify.app'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

Deno.serve(async (req) => {
  // Only allow POST or scheduled invocations
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDay = tomorrow.getDate()

    // Find all active bills due tomorrow
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('id, name, amount, due_day, household_id')
      .eq('due_day', tomorrowDay)
      .eq('is_active', true)

    if (billsError) throw billsError
    if (!bills || bills.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No bills due tomorrow' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let emailsSent = 0

    for (const bill of bills) {
      // Get all household members' emails
      const { data: members } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('household_id', bill.household_id)
        .not('email', 'is', null)

      if (!members?.length) continue

      for (const member of members) {
        if (!member.email) continue
        const sent = await sendReminderEmail(member.email, member.full_name || 'there', bill)
        if (sent) emailsSent++
      }
    }

    return new Response(
      JSON.stringify({ sent: emailsSent, bills: bills.length }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Bill reminder error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

async function sendReminderEmail(
  to: string,
  name: string,
  bill: { name: string; amount: number; due_day: number },
): Promise<boolean> {
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(bill.amount)

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; background: #f8faf9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 520px; margin: 40px auto; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .header { background: #0d9488; padding: 32px 40px; text-align: center; }
    .header-icon { font-size: 36px; margin-bottom: 8px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .header p { color: #99f6e4; margin: 6px 0 0; font-size: 14px; }
    .body { padding: 32px 40px; }
    .greeting { font-size: 16px; color: #334155; margin-bottom: 16px; }
    .bill-box { background: #f0fdf9; border: 2px solid #ccfbef; border-radius: 12px; padding: 20px 24px; margin: 20px 0; }
    .bill-name { font-size: 20px; font-weight: 700; color: #0f766e; margin: 0 0 4px; }
    .bill-amount { font-size: 32px; font-weight: 800; color: #0d9488; margin: 0; }
    .bill-due { font-size: 13px; color: #64748b; margin: 6px 0 0; }
    .cta { display: block; text-align: center; margin: 28px 0 0; }
    .cta a { background: #0d9488; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 10px; font-size: 14px; font-weight: 600; display: inline-block; }
    .footer { padding: 20px 40px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="header-icon">🪺</div>
        <h1>Snuggle State: Nest</h1>
        <p>Bill reminder</p>
      </div>
      <div class="body">
        <p class="greeting">Hi ${name},</p>
        <p style="color:#475569;font-size:15px;margin:0 0 8px;">Just a friendly nudge — one of your household bills is due <strong>tomorrow</strong>:</p>
        <div class="bill-box">
          <p class="bill-name">${bill.name}</p>
          <p class="bill-amount">${amount}</p>
          <p class="bill-due">Due on the ${ordinal(bill.due_day)} of each month</p>
        </div>
        <p style="color:#64748b;font-size:14px;">Head to your Nest dashboard to mark it as paid once it's sorted.</p>
        <div class="cta">
          <a href="${APP_URL}/bills">View in Nest →</a>
        </div>
      </div>
      <div class="footer">
        <p>You're receiving this because you're a member of a Snuggle State: Nest household.</p>
      </div>
    </div>
  </div>
</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Snuggle State: Nest <reminders@yourdomain.com>',
      to: [to],
      subject: `Reminder: ${bill.name} is due tomorrow`,
      html,
    }),
  })

  return res.ok
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
