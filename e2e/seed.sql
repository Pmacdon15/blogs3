-- Fixture posts for the Playwright suite (e2e/). Idempotent: rerunning
-- resets the fixtures and leaves every other post alone. The home page is
-- prerendered at build time, so load this before `next build`.
insert into posts (author_id, slug, title, excerpt, blocks, tags, status, published_at)
values
  (
    'e2e-fixture',
    'e2e-accessibility-fixture',
    'Accessibility fixture',
    'A published post with every block type the public page renders.',
    '[
      {"id": "intro", "type": "text", "text": "This post exists so the end-to-end suite has something to read.\n\nIt has two paragraphs."},
      {"id": "a-heading", "type": "heading", "text": "A section heading"},
      {"id": "some-code", "type": "code", "language": "typescript", "code": "// The answer, typed.\nexport const answer: number = 42;\nconsole.log(answer);"}
    ]'::jsonb,
    array['testing', 'a11y'],
    'published',
    '2026-01-15T12:00:00Z'
  ),
  (
    'e2e-fixture',
    'e2e-second-fixture',
    'Second fixture',
    'Another published post, so lists have more than one card.',
    '[{"id": "body", "type": "text", "text": "Short and sweet."}]'::jsonb,
    array['testing'],
    'published',
    '2026-01-10T12:00:00Z'
  ),
  (
    'e2e-fixture',
    'e2e-draft-fixture',
    'Draft fixture',
    'A draft, which the public site must never show.',
    '[{"id": "body", "type": "text", "text": "Not ready yet."}]'::jsonb,
    array['testing'],
    'draft',
    null
  )
on conflict (slug) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  blocks = excluded.blocks,
  tags = excluded.tags,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = now();
