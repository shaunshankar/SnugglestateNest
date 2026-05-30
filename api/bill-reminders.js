import { neon } from '@neondatabase/serverless'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const APP_URL = process.env.VITE_APP_URL || 'https://your-app.vercel.app'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = neon(process.env.DATABASE_URL)

  try {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDay = tomorrow.getDate()

    const bills = await sql`
      SELECT id, name, amount, due_day, household_id
      FROM bills
      WHERE due_day = ${tomorrowDay}
        AND is_active = true
    `

    if (!bills.length) {
      return res.status(200).json({ sent: 0, message: 'No bills due tomorrow' })
    }

    let emailsSent = 0

    for (const bill of bills) {
      const members = await sql`
        SELECT email, full_name
        FROM profiles
        WHERE household_id = ${bill.household_id}
          AND email IS NOT NULL
      `

      for (const member of members) {
        if (!member.email) continue
        const sent = await sendReminderEmail(member.email, member.full_name || 'there', bill)
        if (sent) emailsSent++
      }
    }

    return res.status(200).json({ sent: emailsSent, bills: bills.length })
  } catch (err) {
    console.error('Bill reminder error:', err)
    return res.status(500).json({ error: String(err) })
  }
}

async function sendReminderEmail(to, name, bill) {
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
          <a href="${APP_URL}/bills">View in Nest &rarr;</a>
        </div>
      </div>
      <div class="footer">
        <p>You're receiving this because you're a member of a Snuggle State: Nest household.</p>
      </div>
    </div>
  </div>
</body>
</html>`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Snuggle State: Nest <reminders@yourdomain.com>',
      to: [to],
      subject: `Reminder: ${bill.name} is due tomorrow`,
      html,
    }),
  })

  return response.ok
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
