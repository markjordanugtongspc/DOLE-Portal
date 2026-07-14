-- ============================================================
-- DOLE Iligan Portal — Supabase PostgreSQL Schema
-- Migration: 001_initial_schema.sql
-- Run Order: Execute all statements in sequence
-- ============================================================

-- ─────────────────────────────────────────
-- 1. LOOKUP TABLES (Static / Seed Data)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
    id   SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS offices (
    id   SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ticket_categories (
    id   SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL UNIQUE,
    icon TEXT  -- icon identifier for UI rendering (e.g. heroicon name)
);

-- ─────────────────────────────────────────
-- 2. KNOWLEDGE BASE ARTICLES
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_articles (
    id           BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    title        TEXT NOT NULL,
    category     TEXT NOT NULL,   -- 'Tutorial', 'User Guide', 'Troubleshooting'
    summary      TEXT,
    suggest_text TEXT,            -- Pre-filled response text for admin agents
    read_time    TEXT,            -- e.g., '4 Minutes read'
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 3. SYSTEMS TABLE
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS systems (
    id           BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    title        TEXT NOT NULL,
    description  TEXT,
    system_url   TEXT,
    image_url    TEXT,       -- Local path (default) OR Supabase Storage public URL (user uploaded)
    color        TEXT,       -- Hex color for card accent glow: e.g. '#10b981'
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at  TIMESTAMPTZ
);

-- ─────────────────────────────────────────
-- 4. USERS TABLE (no gip_id FK yet — added after gips table)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    role_id     SMALLINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    office_id   SMALLINT REFERENCES offices(id) ON DELETE SET NULL,
    full_name   TEXT NOT NULL,
    username    TEXT UNIQUE NOT NULL,
    email       TEXT UNIQUE,
    phone       TEXT UNIQUE,
    pin         TEXT,             -- Hashed 4-digit PIN — used for Phone + PIN login mode
    password    TEXT,             -- Hashed password — used for Username/Email + Password login
    status      TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
    gip_id      BIGINT,           -- FK to gips.id — added after gips table via ALTER TABLE
    last_seen   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ       -- NULL = active; NOT NULL = resigned/archived
);

-- ─────────────────────────────────────────
-- 5. GIPS TABLE (GIP Assistants)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gips (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_by  BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    full_name   TEXT NOT NULL,
    username    TEXT UNIQUE NOT NULL,
    email       TEXT UNIQUE,
    phone       TEXT UNIQUE,
    password    TEXT NOT NULL,    -- Hashed
    status      TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ       -- NULL = active; NOT NULL = terminated/resigned GIP
);

-- ─────────────────────────────────────────
-- 6. DEFERRED FK: users.gip_id → gips.id
--    Added AFTER gips table exists to resolve circular dependency
-- ─────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_gip_id'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_gip_id
            FOREIGN KEY (gip_id)
            REFERENCES gips(id)
            ON DELETE SET NULL
            DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- ─────────────────────────────────────────
-- 7. TICKET NUMBER SEQUENCE + TRIGGER
-- ─────────────────────────────────────────

-- Sequence for TK-0001, TK-0002, TK-0003 ... TK-9999
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MAXVALUE
    NO CYCLE;

-- Auto-generate ticket_number on INSERT
CREATE OR REPLACE FUNCTION fn_generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ticket_number := 'TK-' || LPAD(nextval('ticket_number_seq')::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to tickets table (created below)
-- (Trigger is created after tickets table)

-- ─────────────────────────────────────────
-- 8. TICKETS TABLE
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tickets (
    id             BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    ticket_number  TEXT UNIQUE,   -- Auto-set by trigger: TK-0001, TK-0002, etc.
    created_by     BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id    SMALLINT REFERENCES ticket_categories(id) ON DELETE SET NULL,
    subject        TEXT NOT NULL,
    priority       TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
    status         TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Open', 'Pending', 'Closed')),
    team           TEXT,          -- e.g., 'Technical Support', 'Customer Service'
    tags           TEXT[],        -- Array of label tags (e.g., ['Bug', 'Urgent'])
    last_activity  TIMESTAMPTZ DEFAULT now(),
    unread_count   INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at    TIMESTAMPTZ
);

-- Attach ticket number auto-generation trigger
DROP TRIGGER IF EXISTS trg_set_ticket_number ON tickets;
CREATE TRIGGER trg_set_ticket_number
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION fn_generate_ticket_number();

-- ─────────────────────────────────────────
-- 9. TICKET MESSAGES TABLE
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_messages (
    id           BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    ticket_id    BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    sender_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,   -- NULL = system message
    sender_name  TEXT NOT NULL,
    sender_type  TEXT NOT NULL CHECK (sender_type IN ('staff', 'gip', 'admin', 'system')),
    message_type TEXT NOT NULL DEFAULT 'text'
                    CHECK (message_type IN ('text', 'image', 'file', 'gallery', 'link')),
    content      TEXT,
    metadata     JSONB,    -- Flexible payload per message_type (file_name, image_url, etc.)
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- 10. INDEXES FOR PERFORMANCE
-- ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_role_id      ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_office_id    ON users(office_id);
CREATE INDEX IF NOT EXISTS idx_users_status       ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_archived_at  ON users(archived_at);

CREATE INDEX IF NOT EXISTS idx_gips_created_by    ON gips(created_by);
CREATE INDEX IF NOT EXISTS idx_gips_status        ON gips(status);

CREATE INDEX IF NOT EXISTS idx_tickets_created_by   ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_status        ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority      ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id   ON tickets(category_id);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id  ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_id  ON ticket_messages(sender_id);

-- ─────────────────────────────────────────
-- 11. SEED DATA — ROLES
-- ─────────────────────────────────────────

INSERT INTO roles (name) VALUES
    ('admin'),   -- Portal Administrator (you/system maker)
    ('hr'),      -- HR Staff with admin-level access
    ('staff'),   -- Implementors (field staff using the staff dashboard)
    ('gip')      -- GIP Assistants (linked to a staff implementor)
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────
-- 12. SEED DATA — OFFICES (Lanao del Norte / Region X Focus)
-- ─────────────────────────────────────────

INSERT INTO offices (name) VALUES
    ('DOLE Region X Main Office'),
    ('Lanao del Norte Provincial Office'),
    ('Iligan City Field Office'),
    ('Balo-i Municipal Office'),
    ('Kauswagan Municipal Office'),
    ('Linamon Municipal Office'),
    ('Bacolod Municipal Office'),
    ('Maigo Municipal Office'),
    ('Tubod Municipal Office'),
    ('Kapatagan Municipal Office'),
    ('Baroy Municipal Office'),
    ('Poona Piagapo Municipal Office'),
    ('Matungao Municipal Office'),
    ('Munai Municipal Office'),
    ('Tagoloan Municipal Office')
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────
-- 13. SEED DATA — TICKET CATEGORIES
-- ─────────────────────────────────────────

INSERT INTO ticket_categories (name, icon) VALUES
    ('Support Requests', 'question-mark-circle'),
    ('Bug Report',       'bug-ant'),
    ('Feature Request',  'light-bulb')
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────
-- 14. SEED DATA — KNOWLEDGE BASE ARTICLES
-- ─────────────────────────────────────────

INSERT INTO kb_articles (title, category, summary, suggest_text, read_time) VALUES
(
    'Account Creation and Management',
    'Tutorial',
    'Instructions on establishing new user directories, allocating staff credentials, and managing security parameters for GIP payroll and portal accounts.',
    'For GIP account creation, please head to the Systems Roster tab, choose "Add Staff", and configure their access group details.',
    '4 Minutes read'
),
(
    'Adding Systems & Services',
    'User Guide',
    'Detailed instructions on linking separate district portals, web applications, and database indexes directly into the DOLE unified portal administration console.',
    'To add a new service portal, register its host domain inside the Systems module, copy the credentials token, and add it to theme-toggler config.',
    '6 Minutes read'
),
(
    'Troubleshooting Login Errors',
    'Troubleshooting',
    'Guide to diagnosing user access tokens, fixing Active Directory syncs, and repairing session failures.',
    'I need to check the Active Directory sync logs for your session. Can you please wait a moment while I pull up the audit trail?',
    '5 Minutes read'
),
(
    'Password Recovery Methods',
    'Tutorial',
    'Procedures for managing passwords, handling Email OTPs, and executing admin overrides for locked out credentials.',
    'Temporary password reset: default credentials have been configured as DoleLinamon2026!. Please ask the staff to change it immediately after login via Email OTP.',
    '3 Minutes read'
)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- 15. SEED DATA — DEFAULT SYSTEMS (from dashboard.js)
-- ─────────────────────────────────────────

INSERT INTO systems (title, description, system_url, image_url, color, is_active) VALUES
(
    'GIP Monitoring System',
    'Government Internship Program monitoring portal for tracking student interns across all regional offices.',
    'https://gip.dole.gov.ph',
    '/src/assets/images/slider/sl1.jpg',
    '#10b981',
    TRUE
),
(
    'SPES Monitoring System',
    'Special Program for Employment of Students system for managing beneficiary records and work assignments.',
    'https://spes.dole.gov.ph',
    '/src/assets/images/slider/sl3.jpg',
    '#3b82f6',
    TRUE
),
(
    'TUPAD System',
    'Tulong Panghanapbuhay sa Ating Displaced/Disadvantaged Workers — assistance distribution tracking system.',
    '#',
    '/src/assets/images/slider/sl5.jpg',
    '#ef4444',
    TRUE
),
(
    'Livelihood Assistance System',
    'Tracks livelihood grants, project proposals, and beneficiary disbursements across all target municipalities.',
    '#',
    '/src/assets/images/slider/sl1.jpg',
    '#8b5cf6',
    TRUE
),
(
    'Career Guidance Portal',
    'Provides graduating students with career matching algorithms, vocational counseling, and guidance tools.',
    '#',
    '/src/assets/images/slider/sl3.jpg',
    '#ec4899',
    TRUE
),
(
    'Labor Inspectorate System',
    'Manages establishment inspection schedules, compliance report checklists, and enforcement alerts.',
    '#',
    '/src/assets/images/slider/sl5.jpg',
    '#f59e0b',
    TRUE
),
(
    'Single Entry Approach (SENA)',
    'Coordinates labor dispute facilitation, case scheduling, and settlement agreements dynamically.',
    '#',
    '/src/assets/images/slider/sl1.jpg',
    '#06b6d4',
    TRUE
),
(
    'Alien Employment Permit (AEP)',
    'Processes work permit applications, foreign national credentials auditing, and visa issuance logs.',
    '#',
    '/src/assets/images/slider/sl3.jpg',
    '#14b8a6',
    TRUE
),
(
    'JobFair Portal',
    'Coordinating system for nationwide employment fairs, registration barcodes, and employer slots.',
    '#',
    '/src/assets/images/slider/sl5.jpg',
    '#6366f1',
    TRUE
)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- 16. SEED DATA — ADMIN USER (Default account)
-- ─────────────────────────────────────────
-- NOTE: Passwords are stored as plaintext here for initial setup only.
-- In production, these MUST be hashed with bcrypt/argon2 before storage.
-- Replace these values with properly hashed strings before going live.

INSERT INTO users (role_id, full_name, username, password, pin, status)
SELECT
    r.id,
    'Administrator',
    'admin',
    'admin321!',  -- ⚠️ HASH THIS before production: bcrypt('admin321!', 10)
    '4321',       -- ⚠️ HASH THIS before production: bcrypt('4321', 10)
    'offline'
FROM roles r WHERE r.name = 'admin'
ON CONFLICT (username) DO NOTHING;
