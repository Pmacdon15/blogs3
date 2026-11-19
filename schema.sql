-- Blogs3 schema. Idempotent: safe to run on every deploy or CI build.
create extension if not exists pgcrypto;

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null,
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  cover_image_url text,
  blocks jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_published_idx
  on posts (published_at desc) where status = 'published';
