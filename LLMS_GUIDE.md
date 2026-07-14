# DOLE Iligan Portal — LLMS Context & Continuation Guide

> **Purpose**: This document is the definitive context file for any LLM (AI assistant) continuing development on this project. Read this entirely before making any code changes.

---

## 1. Project Overview

**Project Name**: DOLE Iligan Portal  
**Type**: Vite + Vanilla JS + TailwindCSS v4 + Flowbite multi-page web application  
**Repository**: `markjordanugtongspc/DOLE-Portal`  
**Stack**: HTML, JavaScript (ES Modules), TailwindCSS v4, Flowbite, ApexCharts, SweetAlert2  
**Backend**: Supabase (PostgreSQL) — **Schema created and seeded as of 2026-07-14**

---

## 2. Project Structure

```
Portal/
├── index.html                          ← Login page (root)
├── vite.config.js                      ← Vite config (envDir → src/backend/config/)
├── package.json
├── .gitignore
├── src/
│   ├── main.js                         ← Entry point; imports all modules
│   ├── style.css                       ← TailwindCSS v4 global styles
│   ├── assets/
│   │   ├── images/slider/              ← sl1.jpg, sl3.jpg, sl5.jpg (static, kept local)
│   │   └── logos/dole_logo.png
│   ├── pages/
│   │   └── user/
│   │       ├── admin/
│   │       │   ├── dashboard/index.html
│   │       │   ├── staffs/index.html   ← Manage staff + GIP assistants
│   │       │   ├── systems/index.html  ← Manage sub-systems registry
│   │       │   ├── tickets/index.html  ← Ticket support inbox
│   │       │   └── articles/index.html
│   │       └── staff/
│   │           ├── dashboard/index.html ← Staff view with systems grid
│   │           └── assistants/index.html ← Staff manages own GIP assistants
│   ├── components/                     ← Reusable HTML components
│   ├── scripts/
│   │   └── modules/
│   │       ├── auth.js                 ← Login form (UI only, no API yet)
│   │       ├── drawer.js               ← Mobile login drawer
│   │       ├── sidebar.js              ← Sidebar navigation
│   │       ├── dashboard.js            ← Staff/admin dashboard controller
│   │       ├── staffs-manage.js        ← Admin: manage staff + GIP forms
│   │       ├── assistants-manage.js    ← Staff: manage own GIP assistants
│   │       ├── ticket-support.js       ← Ticket inbox, chat, KB articles
│   │       ├── charts.js               ← ApexCharts (currently mock data)
│   │       ├── slider.js               ← Flowbite carousel
│   │       ├── theme-toggler.js        ← Dark/light mode
│   │       └── cookies.js              ← Preference helpers
│   └── backend/                        ← ⭐ NEW — Backend layer
│       ├── config/
│       │   ├── .env                    ← Gitignored — real credentials
│       │   └── .env.example            ← Safe template to commit
│       ├── migrations/
│       │   ├── 001_initial_schema.sql  ← Full schema + seed data
│       │   └── run-migration.mjs       ← Node.js migration executor
│       └── api/
│           ├── supabase.js             ← Supabase client init (shared)
│           ├── index.js                ← Barrel export (import all from here)
│           ├── auth.api.js             ← Login functions
│           ├── users.api.js            ← Users CRUD
│           ├── gips.api.js             ← GIP Assistants CRUD
│           ├── tickets.api.js          ← Tickets CRUD + categories
│           ├── ticket-messages.api.js  ← Chat messages CRUD
│           └── systems.api.js          ← Systems CRUD + Supabase Storage
```

---

## 3. Supabase Database Schema

**Project URL**: `https://byrmafeczbxutgkicmtu.supabase.co`  
**Status**: ✅ Schema created and seeded on 2026-07-14

### Tables Overview

| Table | Type | Primary Key | Purpose |
|-------|------|-------------|---------|
| `roles` | Lookup | SMALLINT | Admin, HR, Staff, GIP — static, not editable |
| `offices` | Lookup | SMALLINT | Lanao del Norte offices — static, not editable |
| `ticket_categories` | Lookup | SMALLINT | Support Requests, Bug Report, Feature Request |
| `users` | Core | BIGINT | Staff, Admin, HR accounts |
| `gips` | Core | BIGINT | GIP Assistants (linked to a staff user) |
| `systems` | Core | BIGINT | Sub-system registry (admin-managed) |
| `tickets` | Core | BIGINT | Support tickets (Staff → Admin communication) |
| `ticket_messages` | Child | BIGINT | Conversation messages per ticket |
| `kb_articles` | Reference | BIGINT | Knowledge Base articles for admin agents |

### Key Relationships
- `users.role_id` → `roles.id`
- `users.office_id` → `offices.id`
- `users.gip_id` → `gips.id` *(nullable FK — deferred/circular, set when staff links a GIP)*
- `gips.created_by` → `users.id` *(which staff created this GIP)*
- `tickets.created_by` → `users.id` *(staff who filed the ticket)*
- `tickets.category_id` → `ticket_categories.id`
- `ticket_messages.ticket_id` → `tickets.id` *(CASCADE delete)*
- `ticket_messages.sender_id` → `users.id` *(nullable for system messages)*

### Seed Data Already Inserted

**Roles**: admin, hr, staff, gip

**Offices (Lanao del Norte / Region X)**:
- DOLE Region X Main Office
- Lanao del Norte Provincial Office
- Iligan City Field Office
- Balo-i, Kauswagan, Linamon, Bacolod, Maigo, Tubod, Kapatagan, Baroy, Poona Piagapo, Matungao, Munai, Tagoloan Municipal Offices

**Admin Account** (default seed — MUST be hashed before production):
```
username: admin
password: admin321!
pin:      4321
full_name: Administrator
role:     admin
```

**Systems**: 9 default systems (GIP, SPES, TUPAD, Livelihood, Career Guidance, Labor Inspectorate, SENA, AEP, JobFair)

**Ticket Categories**: Support Requests, Bug Report, Feature Request

**KB Articles**: 4 articles (Account Creation, Adding Systems, Troubleshooting Login, Password Recovery)

---

## 4. Authentication System

### Login Modes (from `auth.js`)

| Mode | Fields | DB Check |
|------|--------|----------|
| Username + Password | `users.username` + `users.password` | `loginWithUsername()` in `auth.api.js` |
| Email + Password | `users.email` + `users.password` | `loginWithEmail()` in `auth.api.js` |
| Phone + PIN | `users.phone` + `users.pin` | `loginWithPhone()` in `auth.api.js` |

> ⚠️ **Passwords and PINs are currently stored as plaintext** in the DB seed. Before going live, implement bcrypt hashing on write and compare on read.

### Session Storage
- Session saved to `localStorage` key: `dole_session`
- Contains: `{ id, role_id, office_id, full_name, username, email, phone, status, loggedInAt }`

---

## 5. Role-Based Access Control (RBAC)

| Role | Access |
|------|--------|
| `admin` (id=1) | Full access — manages everything |
| `hr` (id=2) | Admin-level access, files support tickets (does not resolve them) |
| `staff` (id=3) | Staff dashboard, can create tickets, manage own GIP assistants (max 2) |
| `gip` (id=4) | Limited — view linked systems, communication only |

Sidebar navigation in `sidebar.js` hides/shows items based on `users.role_id`.

---

## 6. Ticket System

### Lifecycle
```
Created by Staff/HR → status: 'Pending'
       ↓
Admin opens ticket  → status: 'Open'  (auto-set by openTicket() API)
       ↓
Admin resolves      → status: 'Closed'
```

### Ticket Number Format
- Auto-generated by PostgreSQL trigger: `TK-0001`, `TK-0002`, ..., `TK-9999`
- Sequence: `ticket_number_seq` (can be reset with `ALTER SEQUENCE ticket_number_seq RESTART WITH 1`)
- URL parameter support: `?ticket=TK-0001`

### Categories (from `ticket_categories` table)
- Support Requests, Bug Report, Feature Request
- Fetched dynamically via `fetchTicketCategories()` in `tickets.api.js`

### Priorities
- High, Medium, Low (DB CHECK constraint)
- Default: Medium

---

## 7. GIP Assistants

- GIPs are managed in the `gips` table (separate from `users`)
- Each staff user can have **max 2 GIP assistants** (enforced in `createGip()`)
- `gips.created_by` → `users.id` (the staff who manages this GIP)
- `users.gip_id` → `gips.id` (optional back-link, nullable)
- GIP status: `active` / `offline` / can be archived via `archived_at`

---

## 8. Systems (Sub-system Registry)

- Stored in `systems` table
- Each system has: `title`, `description`, `system_url`, `image_url`, `color` (hex), `is_active`
- **Image Strategy**:
  - Default 9 systems → `image_url` = local path (e.g., `/src/assets/images/slider/sl1.jpg`)
  - New admin-uploaded images → Supabase Storage bucket `system-images` → public URL stored in `image_url`
  - Upload via `uploadSystemImage(file, systemId)` in `systems.api.js`
- Click tracking is currently in `localStorage` — future: move to a `system_clicks` table

---

## 9. Environment Variables

All stored in `src/backend/config/.env` (gitignored).
Vite reads from this path via `envDir` in `vite.config.js`.

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (used in frontend) |
| `VITE_SUPABASE_SERVICE_ROLE` | Service role key (DO NOT expose to client) |
| `VITE_SUPABASE_STORAGE_BUCKET` | Storage bucket name: `system-images` |

---

## 10. Currently Mocked (Not Yet Wired to Backend)

These modules still use `localStorage` or hardcoded mock data. They need to be wired to the backend API in Phase 4:

| Module | Current State | API Ready? |
|--------|--------------|------------|
| `auth.js` | UI only — no actual DB query | ✅ `auth.api.js` ready |
| `staffs-manage.js` | `localStorage` mock | ✅ `users.api.js` + `gips.api.js` ready |
| `assistants-manage.js` | `localStorage` mock | ✅ `gips.api.js` ready |
| `dashboard.js` | `localStorage` mock for systems | ✅ `systems.api.js` ready |
| `ticket-support.js` | Hardcoded `MOCK_TICKETS` array | ✅ `tickets.api.js` + `ticket-messages.api.js` ready |
| `charts.js` | Hardcoded chart data | ⏳ Needs aggregation queries |

---

## 11. Developer Rules & Conventions

> These are enforced by user rules and must be followed at all times:

1. **TailwindCSS v4** — Always use v4 classes. Use responsive modifiers (`sm:`, `lg:`, etc.).
2. **SweetAlert2** — Use for all popups/modals instead of `alert()` or `confirm()`. Use `modals.js` script file.
3. **`cursor-pointer`** — Always add to all clickable buttons and `<a>` tags.
4. **Git Hygiene** — Always `git fetch` before editing. Stash local changes if remote has updates.
5. **No Broken DOM** — Never truncate or leave incomplete HTML structures.
6. **Professional Output** — Code must be clean, commented, and production-quality.

---

## 12. Next Steps (Pending Implementation)

In priority order:

1. **Wire `auth.js` to `auth.api.js`** — Replace UI-only form with actual Supabase query
2. **Wire `staffs-manage.js` to `users.api.js`** — Replace localStorage with real CRUD
3. **Wire `assistants-manage.js` to `gips.api.js`** — Replace localStorage with real CRUD
4. **Wire `dashboard.js` to `systems.api.js`** — Load systems from DB instead of localStorage
5. **Wire `ticket-support.js` to `tickets.api.js`** — Replace MOCK_TICKETS with real DB fetch
6. **Wire ticket chat to `ticket-messages.api.js`** — Persist messages in DB
7. **Password hashing** — Implement bcrypt on write, compare on verify
8. **Row Level Security (RLS)** — Enable Supabase RLS policies per role
9. **Real-time chat** — Add `supabase.channel()` subscription to ticket_messages for live updates
10. **System image upload UI** — Wire file input on systems form to `uploadSystemImage()`

---

## 13. Migration Commands

To re-run or reset the schema:

```bash
# Run migration (from project root)
node src/backend/migrations/run-migration.mjs

# Direct psql (if psql is available)
psql "postgresql://postgres:zCtWCwKye3cfgVUl@db.byrmafeczbxutgkicmtu.supabase.co:5432/postgres" -f src/backend/migrations/001_initial_schema.sql

# Reset ticket sequence to 0001
# Run in Supabase SQL Editor:
# ALTER SEQUENCE ticket_number_seq RESTART WITH 1;
```

---

## 14. Supabase Storage Bucket Setup

> The `system-images` bucket must be created in Supabase manually (UI or SQL):

1. Go to Supabase Dashboard → Storage → New bucket
2. Name: `system-images`
3. Public: ✅ Yes
4. File size limit: 5 MB
5. Allowed MIME types: `image/jpeg, image/png, image/webp, image/gif`

---

*Last updated: 2026-07-14 | Generated by Antigravity AI for DOLE Iligan Portal*
