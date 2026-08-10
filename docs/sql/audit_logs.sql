-- Portal audit records stored in the existing notifications table.
-- Run once in Supabase SQL Editor.

alter table public.notifications
    add column if not exists event_type text,
    add column if not exists action text,
    add column if not exists entity_type text,
    add column if not exists entity_id text,
    add column if not exists metadata jsonb not null default '{}'::jsonb,
    add column if not exists ip_address inet,
    add column if not exists user_agent text;

create index if not exists notifications_audit_created_at_idx
    on public.notifications (created_at desc)
    where type = 'audit';

create index if not exists notifications_audit_event_created_at_idx
    on public.notifications (event_type, created_at desc)
    where type = 'audit';