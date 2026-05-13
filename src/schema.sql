create table if not exists luma_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists memory_events (
  id text primary key,
  type text,
  summary text,
  source text,
  user_text text,
  status_id text,
  context jsonb,
  actions jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id text primary key,
  session_id text default 'default',
  role text,
  content text,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id text primary key,
  name text not null,
  type text default 'custom',
  state text default 'active',
  goal text,
  current_progress text,
  next_step text,
  history jsonb,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists usage_events (
  id text primary key,
  provider text,
  model text,
  reason text,
  input_tokens integer default 0,
  output_tokens integer default 0,
  total_tokens integer default 0,
  estimated_cost_usd numeric default 0,
  parser text,
  optimized boolean default false,
  saved_tokens integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists brain_events (
  id text primary key,
  provider text,
  model text,
  mode text,
  purpose text,
  ok boolean,
  latency_ms integer,
  input jsonb,
  output jsonb,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists training_samples (
  id text primary key,
  mode text,
  input_packet jsonb,
  expert_output jsonb,
  brain_output jsonb,
  user_feedback jsonb,
  brain_event_id text,
  created_at timestamptz not null default now()
);

create table if not exists context_snapshots (
  id bigserial primary key,
  behavior_mode text,
  location_tag text,
  weather text,
  temperature numeric,
  raw jsonb,
  created_at timestamptz not null default now()
);

create table if not exists emotion_signals (
  id bigserial primary key,
  session_id text,
  mood_label text,
  valence numeric,
  arousal numeric,
  confidence numeric,
  evidence_text text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
