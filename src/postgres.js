import { config } from "./config.js";

let pool = null;

export function postgresEnabled() {
  return Boolean(config.databaseUrl);
}

export async function postgresQuery(text, params = []) {
  if (!pool) {
    const { Pool } = await import("pg");
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: shouldUseSsl() ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool.query(text, params);
}

function shouldUseSsl() {
  if (config.databaseSsl) return ["1", "true", "require"].includes(config.databaseSsl.toLowerCase());
  return config.databaseUrl.includes("railway") || config.databaseUrl.includes("sslmode=require");
}

export async function ensurePostgresSchema() {
  await postgresQuery(`
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
  `);
}

export async function readStateFromPostgres() {
  const result = await postgresQuery("select payload from luma_state where id = 'default'");
  return result.rows[0]?.payload || null;
}

export async function saveStateToPostgres(db) {
  await postgresQuery(
    `insert into luma_state (id, payload, updated_at)
     values ('default', $1::jsonb, now())
     on conflict (id) do update set payload = excluded.payload, updated_at = now()`,
    [JSON.stringify(db)]
  );
  await mirrorMemoryTables(db);
}

async function mirrorMemoryTables(db) {
  for (const event of db.memoryEvents || []) {
    await postgresQuery(
      `insert into memory_events (id, type, summary, source, user_text, status_id, context, actions, metadata, created_at)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10)
       on conflict (id) do update set
         type=excluded.type, summary=excluded.summary, source=excluded.source,
         user_text=excluded.user_text, status_id=excluded.status_id,
         context=excluded.context, actions=excluded.actions, metadata=excluded.metadata`,
      [
        event.id,
        event.type || null,
        event.summary || null,
        event.source || null,
        event.userText || null,
        event.statusId || null,
        JSON.stringify(event.context || {}),
        JSON.stringify(event.actions || []),
        JSON.stringify(event.metadata || {}),
        event.timestamp || new Date().toISOString()
      ]
    );
  }

  for (const message of db.conversations || []) {
    await postgresQuery(
      `insert into conversations (id, session_id, role, content, source, created_at)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (id) do update set role=excluded.role, content=excluded.content, source=excluded.source`,
      [message.id, message.conversationId || "default", message.role, message.content, message.source || null, message.timestamp || new Date().toISOString()]
    );
  }

  for (const project of db.projects || []) {
    await postgresQuery(
      `insert into projects (id, name, type, state, goal, current_progress, next_step, history, updated_at, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
       on conflict (id) do update set
         name=excluded.name, type=excluded.type, state=excluded.state, goal=excluded.goal,
         current_progress=excluded.current_progress, next_step=excluded.next_step,
         history=excluded.history, updated_at=excluded.updated_at`,
      [
        project.id,
        project.name,
        project.type || "custom",
        project.state || "active",
        project.goal || "",
        project.currentProgress || "",
        project.nextStep || null,
        JSON.stringify(project.history || []),
        project.updatedAt || new Date().toISOString(),
        project.createdAt || new Date().toISOString()
      ]
    );
  }

  for (const usage of db.usageEvents || []) {
    await postgresQuery(
      `insert into usage_events (id, provider, model, reason, input_tokens, output_tokens, total_tokens, estimated_cost_usd, parser, optimized, saved_tokens, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (id) do update set total_tokens=excluded.total_tokens, estimated_cost_usd=excluded.estimated_cost_usd`,
      [
        usage.id,
        usage.provider || "local",
        usage.model || "unknown",
        usage.reason || "chat",
        usage.inputTokens || 0,
        usage.outputTokens || 0,
        usage.totalTokens || 0,
        usage.estimatedCostUsd || 0,
        usage.parser || null,
        Boolean(usage.optimized),
        usage.savedTokens || 0,
        usage.timestamp || new Date().toISOString()
      ]
    );
  }

  for (const event of db.brainEvents || []) {
    await postgresQuery(
      `insert into brain_events (id, provider, model, mode, purpose, ok, latency_ms, input, output, error, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)
       on conflict (id) do update set ok=excluded.ok, output=excluded.output, error=excluded.error`,
      [
        event.id,
        event.provider || null,
        event.model || null,
        event.mode || null,
        event.purpose || null,
        Boolean(event.ok),
        event.latencyMs || 0,
        JSON.stringify(event.input || {}),
        JSON.stringify(event.output || {}),
        event.error || null,
        event.timestamp || new Date().toISOString()
      ]
    );
  }

  for (const sample of db.trainingSamples || []) {
    await postgresQuery(
      `insert into training_samples (id, mode, input_packet, expert_output, brain_output, user_feedback, brain_event_id, created_at)
       values ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8)
       on conflict (id) do update set brain_output=excluded.brain_output, user_feedback=excluded.user_feedback`,
      [
        sample.id,
        sample.mode || null,
        JSON.stringify(sample.inputPacket || {}),
        JSON.stringify(sample.expertOutput || {}),
        JSON.stringify(sample.brainOutput || {}),
        JSON.stringify(sample.userFeedback || {}),
        sample.brainEventId || null,
        sample.createdAt || new Date().toISOString()
      ]
    );
  }
}
