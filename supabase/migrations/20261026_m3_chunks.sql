-- FinePrint M3: clause chunks + optional pgvector embeddings (cloud path).
-- Local demos use packages/agent KnowledgeStore (./data/knowledge). Apply this when STORAGE_BACKEND=supabase.

create extension if not exists vector;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  page integer not null check (page > 0),
  chunk_index integer not null check (chunk_index >= 0),
  text text not null,
  -- OpenAI/NRP embedding dims vary; 1536 is a common default — adjust to your model.
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_doc_idx
  on public.document_chunks (document_id);

create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.document_chunks enable row level security;

create policy chunks_owner on public.document_chunks
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and d.owner_id = auth.uid()
    )
  );

create table if not exists public.stipulation_patterns (
  id text primary key,
  risk_type text not null,
  label text not null,
  keywords text[] not null,
  description text not null
);
