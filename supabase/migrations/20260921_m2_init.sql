-- FinePrint M2 schema: documents, scans, findings + RLS
-- Apply with Supabase CLI or SQL editor when STORAGE_BACKEND=supabase.
-- Local teammate onboarding uses packages/agent LocalStore (./data) and does not need this yet.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  content_sha256 text not null,
  mime text not null check (mime = 'application/pdf'),
  bytes integer not null check (bytes > 0),
  original_filename text not null,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'parsed', 'deleted')),
  created_at timestamptz not null default now()
);

create index if not exists documents_owner_idx on public.documents (owner_id);
create index if not exists documents_sha_idx on public.documents (content_sha256);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'parsing', 'analyzing', 'validating', 'done', 'failed')),
  model text not null,
  prompt_version text not null,
  error text,
  content_sha256 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scans_owner_idx on public.scans (owner_id);
create index if not exists scans_cache_idx
  on public.scans (content_sha256, model, prompt_version, status);

create table if not exists public.document_pages (
  document_id uuid not null references public.documents (id) on delete cascade,
  page integer not null check (page > 0),
  text text not null,
  primary key (document_id, page)
);

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans (id) on delete cascade,
  risk_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  plain_english text not null,
  quote text not null,
  page integer not null,
  char_start integer,
  char_end integer,
  grounded boolean not null default false
);

create index if not exists findings_scan_idx on public.findings (scan_id);

-- M3 chunks + embeddings: see 20261026_m3_chunks.sql

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.scans enable row level security;
alter table public.document_pages enable row level security;
alter table public.findings enable row level security;

create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy documents_owner on public.documents
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy scans_owner on public.scans
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy pages_owner on public.document_pages
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and d.owner_id = auth.uid()
    )
  );

create policy findings_owner on public.findings
  for all using (
    exists (
      select 1 from public.scans s
      where s.id = scan_id and s.owner_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_storage_owner on storage.objects
  for all using (
    bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]
  );
