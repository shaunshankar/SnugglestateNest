# 🪺 Snuggle State: Nest

A full-stack household finance app built with React + Vite, Supabase, and the Anthropic API. Track budgets, transactions, bills, and savings goals — together with your household.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router v6, Tailwind CSS, Recharts |
| Auth & Database | Supabase (PostgreSQL + RLS) |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Email | Resend |
| Hosting | Netlify |

---

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) account
- An [Anthropic](https://console.anthropic.com) API key
- A [Resend](https://resend.com) account (for bill reminder emails)
- A [Netlify](https://netlify.com) account (for deployment)

---

## Local Setup

### 1. Clone & install

```bash
git clone <your-repo-url>
cd snuggle-state-nest
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **anon public key** from Settings → API

### 3. Run the database migration

In your Supabase project:

1. Go to **SQL Editor**
2. Paste the contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run**

This creates all tables, RLS policies, and helper functions.

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_RESEND_API_KEY=re_...
VITE_APP_URL=http://localhost:5173
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Supabase Edge Function (Bill Reminders)

The bill reminder function sends emails the day before a bill is due.

### Deploy the function

```bash
# Install Supabase CLI if needed
brew install supabase/tap/supabase

# Log in
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy
supabase functions deploy bill-reminders
```

### Set function secrets

```bash
supabase secrets set RESEND_API_KEY=re_your_key
supabase secrets set APP_URL=https://your-app.netlify.app
```

### Schedule daily execution

In the Supabase SQL editor, enable `pg_cron` and schedule:

```sql
-- Enable pg_cron (if not already enabled — do this in Supabase dashboard under Extensions)
select cron.schedule(
  'daily-bill-reminders',
  '0 8 * * *',   -- 8am UTC every day
  $$
  select net.http_post(
    url := 'https://your-project-ref.functions.supabase.co/bill-reminders',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

> Update `from` in the edge function (`reminders@yourdomain.com`) to a domain you've verified in Resend.

---

## Deploy to Netlify

### Option A — Netlify UI (recommended for first deploy)

1. Push your code to GitHub
2. Go to [app.netlify.com](https://app.netlify.com) → Add new site → Import from Git
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables under **Site settings → Environment variables** (same keys as your `.env`)
6. Deploy!

### Option B — Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify env:import .env
netlify deploy --prod
```

The `netlify.toml` already includes the SPA redirect rule, so all routes work correctly.

---

## Features

### Dashboard
- Monthly income vs spending summary
- Budget progress bars (green/amber/red by usage)
- Upcoming bills (next 7 days)
- Top savings goals

### Budgets
- Set per-category monthly limits (owner only)
- Visual spend vs budget for current month
- Over-budget alerts

### Transactions
- Manual entry with AI-powered merchant category suggestions
- CSV bank statement import with AI auto-categorisation
- Search, filter by category & date range
- Paginated list

### Bills & Subscriptions
- Track recurring bills by due day, frequency, and category
- Mark as paid (creates a payment record)
- Email reminder the day before due (via Resend + Edge Function)
- Active/inactive toggle

### Savings Goals
- Create goals with target amounts and dates
- Log contributions
- On-track status and months-remaining calculation

### Reports
- Spending pie/donut chart by category
- 6-month bar chart comparison
- Savings trend line chart
- Month selector for historical reports

### Household
- Shareable 6-character invite code
- Member list with join dates
- Owner management

---

## Security Notes

- **Anthropic API key**: `VITE_ANTHROPIC_API_KEY` is exposed in the browser bundle. This is acceptable for personal/household use but for a production multi-tenant app you should proxy calls through a Netlify Function or Supabase Edge Function.
- **RLS**: All Supabase tables use Row Level Security — users can only access their own household's data.
- **Invite codes**: 6-character alphanumeric codes are the join mechanism; treat them as moderately sensitive (anyone with the code can join the household).

---

## Project Structure

```
/
├── src/
│   ├── components/     Shared UI (Layout, Sidebar, BottomNav, ...)
│   ├── hooks/          useAuth, useHousehold contexts
│   ├── lib/            supabase.js, anthropic.js
│   ├── pages/          One file per route
│   └── utils/          categories, formatters, dateUtils
├── supabase/
│   ├── migrations/     001_initial_schema.sql
│   └── functions/
│       └── bill-reminders/  Deno edge function
├── netlify.toml
└── .env.example
```
