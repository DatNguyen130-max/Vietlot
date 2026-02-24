create or replace function public.set_results_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.power655_results (
  draw_id integer primary key,
  draw_code text not null unique,
  draw_date date not null unique,
  numbers integer[] not null,
  bonus integer,
  jackpot2_value bigint,
  raw_result integer[] not null,
  source_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint power655_numbers_len check (cardinality(numbers) = 6),
  constraint power655_raw_len check (cardinality(raw_result) between 6 and 7),
  constraint power655_bonus_range check (bonus is null or bonus between 1 and 55),
  constraint power655_jackpot2_value_non_negative check (jackpot2_value is null or jackpot2_value >= 0)
);

create index if not exists idx_power655_draw_date_desc on public.power655_results (draw_date desc);

drop trigger if exists trg_power655_updated_at on public.power655_results;
create trigger trg_power655_updated_at
before update on public.power655_results
for each row execute function public.set_results_updated_at();

alter table public.power655_results enable row level security;
drop policy if exists power655_service_role_only on public.power655_results;
create policy power655_service_role_only on public.power655_results
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

alter table if exists public.power655_results
  add column if not exists jackpot2_value bigint;

create table if not exists public.power645_results (
  draw_id integer primary key,
  draw_code text not null unique,
  draw_date date not null unique,
  numbers integer[] not null,
  bonus integer,
  raw_result integer[] not null,
  source_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint power645_numbers_len check (cardinality(numbers) = 6),
  constraint power645_raw_len check (cardinality(raw_result) = 6),
  constraint power645_bonus_range check (bonus is null or bonus between 1 and 45)
);

create index if not exists idx_power645_draw_date_desc on public.power645_results (draw_date desc);

drop trigger if exists trg_power645_updated_at on public.power645_results;
create trigger trg_power645_updated_at
before update on public.power645_results
for each row execute function public.set_results_updated_at();

alter table public.power645_results enable row level security;
drop policy if exists power645_service_role_only on public.power645_results;
create policy power645_service_role_only on public.power645_results
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
