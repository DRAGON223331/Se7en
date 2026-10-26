-- Run this in Supabase SQL Editor for Se7en V19.
-- Keep these tables private: frontend requests go through Vercel API routes only.
create extension if not exists pgcrypto;

create table if not exists public.se7en_customers (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text not null default 'عميل Se7en',
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create table if not exists public.se7en_otp_challenges (
  phone text primary key,
  pending_name text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  send_count integer not null default 0 check (send_count >= 0),
  window_started_at timestamptz not null default now(),
  sent_at timestamptz not null default now()
);

create table if not exists public.se7en_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null references public.se7en_customers(phone) on update cascade on delete cascade,
  customer_name text not null default 'عميل Se7en',
  assigned_agent text not null check (assigned_agent in ('agent1', 'agent2')),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.se7en_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.se7en_conversations(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer', 'agent')),
  sender_id text not null,
  sender_name text not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists se7en_conversations_customer_idx on public.se7en_conversations(customer_phone, last_message_at desc);
create index if not exists se7en_conversations_agent_idx on public.se7en_conversations(assigned_agent, last_message_at desc);
create index if not exists se7en_messages_conversation_idx on public.se7en_messages(conversation_id, created_at asc);

-- API uses only the server-side Supabase service role key; never place it in browser code.
-- Enable RLS as an additional safety layer (service role requests still bypass it).
alter table public.se7en_customers enable row level security;
alter table public.se7en_otp_challenges enable row level security;
alter table public.se7en_conversations enable row level security;
alter table public.se7en_messages enable row level security;
