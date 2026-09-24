# Deploying MarketIQ

Next.js on **Vercel**, data on **Supabase**.

## 1. Create or reuse the Supabase project

The Supabase free plan allows **2 active projects**, so the four apps are paired
without clashing table names:

| Supabase project | Apps |
| --- | --- |
| `sharewallet-portfolio` | ShareWallet + Portfolio |
| `codesim-marketiq` | CodeSim + MarketIQ |

This app uses `codesim-marketiq` (shared with CodeSim). (ShareWallet and CodeSim both define `profiles`, so
they must live in different projects.)

## 2. Apply the database schema

In the Supabase dashboard open **SQL Editor → New query**, paste each file in
order and click **Run**:

   1. `supabase/migrations/20260924000000_init.sql`

Or, with the Supabase CLI: `npx supabase link --project-ref <ref>` then
`npx supabase db push`.

## 3. Configure Supabase Auth

In **Authentication → URL Configuration** of the Supabase project:

- **Redirect URLs:** add `https://<your-vercel-domain>/auth/callback` (and
  `http://localhost:3000/auth/callback` for local dev). Both apps sharing the
  project need their own entry. The app passes its own callback URL, so the
  Site URL can point at either one.
- **Authentication → Providers → Email:** leave enabled (magic links).

## 4. Deploy on Vercel

1. <https://vercel.com/new> → **Import** `EmmanuelAzu/market_Iq`. Framework
   preset: Next.js (auto-detected), default build settings.
2. Add these **Environment Variables** before the first deploy:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role key. **Server-only; never prefix with `NEXT_PUBLIC_`.** |
| `ANTHROPIC_API_KEY` | from console.anthropic.com |
| `ANTHROPIC_MODEL` | optional; defaults to `claude-opus-5` |

3. Click **Deploy**. Every push to `main` redeploys automatically.

`package.json` pins Node **22+** (`engines`), which yahoo-finance2 v4 requires, and Vercel picks that up automatically. `/api/ai/analyze-stock` sets `maxDuration = 60`.
