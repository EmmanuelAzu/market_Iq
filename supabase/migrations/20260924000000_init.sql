-- MarketIQ: initial schema

create extension if not exists "uuid-ossp";

create table watchlists (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  ticker text not null check (ticker ~ '^[A-Z0-9.\-^=]{1,15}$'),
  company_name text,
  added_at timestamp with time zone default timezone('utc'::text, now()),
  unique (user_id, ticker)
);

create table chart_annotations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  ticker text not null,
  annotation_data jsonb not null, -- trendlines, notes, fibonacci overlays in (time, price) space
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  unique (user_id, ticker) -- one drawing layer per user per ticker
);

create table ai_insights_cache (
  id uuid default uuid_generate_v4() primary key,
  ticker text not null,
  sentiment_score numeric(3,2) check (sentiment_score between -1 and 1), -- -1.00 to +1.00
  summary text not null,
  key_drivers text[],
  news_references jsonb,
  analysis jsonb, -- full structured model output
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table trading_strategies (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  ticker text,
  rules jsonb not null, -- entry (SMA crossover), stop loss, take profit
  backtest_results jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create index on watchlists (user_id, added_at desc);
create index on ai_insights_cache (ticker, expires_at desc);
create index on trading_strategies (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table watchlists enable row level security;
alter table chart_annotations enable row level security;
alter table ai_insights_cache enable row level security;
alter table trading_strategies enable row level security;

create policy "Own watchlist" on watchlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Own annotations" on chart_annotations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Own strategies" on trading_strategies
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Insights are shared market data: anyone can read, only the server
-- (service role, which bypasses RLS) writes.
create policy "Insights are public" on ai_insights_cache for select using (true);
revoke insert, update, delete on ai_insights_cache from anon, authenticated;
