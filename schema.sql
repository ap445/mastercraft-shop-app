-- Mastercraft Shop Management v0.4
-- Render PostgreSQL schema. Safe to run repeatedly.
-- v0.4 simplifies the app down to: jobs + planned materials, and employees
-- clocking in against a job and logging material used. Departments,
-- scheduled operations, supervisor assignments, and daily guidance were
-- removed — the statements below clean those up on an already-deployed
-- database (each is a no-op once it has already run).
create extension if not exists pgcrypto;

create table if not exists employees (
  id bigserial primary key,
  employee_code text not null unique,
  full_name text not null,
  role text not null default 'employee' check (role in ('employee','admin')),
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

create table if not exists time_entries (
  id bigserial primary key,
  employee_id bigint not null references employees(id),
  job_id bigint references jobs(id),
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
  job_id bigint references jobs(id),
  material_id bigint not null references materials(id),
  employee_id bigint not null references employees(id),
  transaction_type text not null check (transaction_type in ('issue','return')),
  quantity numeric(12,4) not null check (quantity > 0),
  unit_cost numeric(12,4),
  occurred_at timestamptz not null default now(),
  notes text
);
alter table material_transactions alter column job_id drop not null;

-- let an employee log material use for something that isn't in the catalog yet,
-- as a free-text name instead of a materials.id
alter table material_transactions alter column material_id drop not null;
alter table material_transactions add column if not exists custom_material_name text;
alter table material_transactions drop constraint if exists material_transactions_material_ref_check;
alter table material_transactions add constraint material_transactions_material_ref_check check (material_id is not null or custom_material_name is not null);

create index if not exists material_transactions_job_idx on material_transactions(job_id, occurred_at);

create table if not exists job_materials (
  id bigserial primary key,
  job_id bigint not null references jobs(id) on delete cascade,
  material_id bigint not null references materials(id),
  planned_quantity numeric(12,4) not null check (planned_quantity > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique(job_id, material_id)
);

create index if not exists job_materials_job_idx on job_materials(job_id);

-- v0.4 cleanup: drop the scheduling/department/guidance layer. Order matters —
-- child tables and dependent columns go first so the FK constraints allow it.
drop table if exists guidance_attachments;
drop table if exists daily_guidance;
drop table if exists assignments;
alter table time_entries drop column if exists operation_id;
alter table material_transactions drop column if exists operation_id;
drop table if exists operations;

update employees set role='employee' where role not in ('employee','admin');
do $$
declare rec record;
begin
  for rec in select conname from pg_constraint where conrelid='employees'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%role%' loop
    execute format('alter table employees drop constraint %I', rec.conname);
  end loop;
end $$;
alter table employees add constraint employees_role_check check (role in ('employee','admin'));
alter table employees drop column if exists department_id;

drop table if exists departments;
