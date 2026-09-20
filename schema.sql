-- Mastercraft Shop Management v0.3
-- Render PostgreSQL schema. Safe to run repeatedly.
create extension if not exists pgcrypto;

create table if not exists departments (
  id bigserial primary key,
  name text not null unique,
  active boolean not null default true
);

create table if not exists employees (
  id bigserial primary key,
  employee_code text not null unique,
  full_name text not null,
  department_id bigint references departments(id),
  role text not null default 'employee' check (role in ('employee','supervisor','admin')),
  pin_hash text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id bigserial primary key,
  job_number text not null unique,
  customer_name text,
  description text,
  due_date date,
  priority integer not null default 3 check (priority between 1 and 5),
  status text not null default 'not_started' check (status in ('not_started','in_progress','on_hold','complete','closed')),
  created_at timestamptz not null default now()
);

create table if not exists operations (
  id bigserial primary key,
  job_id bigint not null references jobs(id) on delete cascade,
  department_id bigint not null references departments(id),
  operation_name text not null,
  sequence_no integer not null default 1,
  estimated_hours numeric(10,2),
  planned_start timestamptz,
  planned_finish timestamptz,
  status text not null default 'queued' check (status in ('queued','ready','in_progress','paused','blocked','complete')),
  completed_at timestamptz,
  unique(job_id, sequence_no)
);

create table if not exists assignments (
  id bigserial primary key,
  operation_id bigint not null references operations(id) on delete cascade,
  employee_id bigint not null references employees(id),
  assigned_at timestamptz not null default now(),
  unique(operation_id, employee_id)
);

create table if not exists time_entries (
  id bigserial primary key,
  employee_id bigint not null references employees(id),
  job_id bigint references jobs(id),
  operation_id bigint references operations(id),
  entry_type text not null default 'direct' check (entry_type in ('direct','indirect','break','training','pto','holiday')),
  started_at timestamptz not null,
  stopped_at timestamptz,
  notes text,
  adjusted_by bigint references employees(id),
  created_at timestamptz not null default now(),
  check (stopped_at is null or stopped_at >= started_at)
);

create unique index if not exists one_open_time_entry_per_employee
on time_entries(employee_id) where stopped_at is null;

create index if not exists time_entries_job_idx on time_entries(job_id, started_at);
create index if not exists time_entries_operation_idx on time_entries(operation_id, started_at);

create table if not exists materials (
  id bigserial primary key,
  item_code text unique,
  description text not null,
  unit_of_measure text not null,
  standard_cost numeric(12,4),
  quickbooks_item_ref text,
  active boolean not null default true
);

create table if not exists material_transactions (
  id bigserial primary key,
  job_id bigint not null references jobs(id),
  operation_id bigint references operations(id),
  material_id bigint not null references materials(id),
  employee_id bigint not null references employees(id),
  transaction_type text not null check (transaction_type in ('issue','return')),
  quantity numeric(12,4) not null check (quantity > 0),
  unit_cost numeric(12,4),
  occurred_at timestamptz not null default now(),
  notes text
);

create index if not exists material_transactions_job_idx on material_transactions(job_id, occurred_at);
