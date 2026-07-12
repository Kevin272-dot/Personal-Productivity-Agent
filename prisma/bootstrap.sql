create table if not exists users (
  id text primary key,
  telegram_id text not null unique,
  name text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create table if not exists daily_plans (
  id text primary key,
  deadline timestamptz not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  user_id text not null references users(id) on delete cascade
);

create table if not exists tasks (
  id text primary key,
  title text not null,
  priority text not null default 'normal',
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  daily_plan_id text not null references daily_plans(id) on delete cascade
);

create table if not exists focus_sessions (
  id text primary key,
  duration integer not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  completed boolean not null default false,
  task_id text not null references tasks(id) on delete cascade
);

create table if not exists reminder_history (
  id text primary key,
  type text not null,
  urgency text not null,
  sent_at timestamptz not null default now(),
  daily_plan_id text not null references daily_plans(id) on delete cascade
);