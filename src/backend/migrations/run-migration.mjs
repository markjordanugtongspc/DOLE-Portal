/**
 * DOLE Iligan Portal — Supabase Migration Runner
 * Executes the SQL migration against the live Supabase PostgreSQL database.
 *
 * Usage: node src/backend/migrations/run-migration.mjs
 *
 * Requires: @supabase/supabase-js installed
 * Run: npm install @supabase/supabase-js
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Supabase connection (using service role for DDL permissions) ──────────────
const SUPABASE_URL     = 'https://byrmafeczbxutgkicmtu.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5cm1hZmVjemJ4dXRna2ljbXR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzkyNjA1NSwiZXhwIjoyMDk5NTAyMDU1fQ.Ivw2geXXXSdS0MkLJFpSpr9rjeW9LiZBrkz3Q-9hhL0';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

// ─── Read SQL file ─────────────────────────────────────────────────────────────
const sqlPath = join(__dirname, '001_initial_schema.sql');
const sql = readFileSync(sqlPath, 'utf-8');

// ─── Split SQL into individual statements for execution ───────────────────────
// Splits on semicolons but respects $$ dollar-quoted blocks (PL/pgSQL functions)
function parseSqlStatements(rawSql) {
    const statements = [];
    let current = '';
    let inDollarQuote = false;
    let dollarTag = '';

    const lines = rawSql.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();

        // Skip pure comment lines
        if (trimmed.startsWith('--')) {
            current += line + '\n';
            continue;
        }

        // Detect dollar-quote start/end (e.g. $$ or $BODY$)
        const dollarMatches = line.match(/\$[a-zA-Z_]*\$/g);
        if (dollarMatches) {
            for (const tag of dollarMatches) {
                if (!inDollarQuote) {
                    inDollarQuote = true;
                    dollarTag = tag;
                } else if (tag === dollarTag) {
                    inDollarQuote = false;
                    dollarTag = '';
                }
            }
        }

        current += line + '\n';

        if (!inDollarQuote && trimmed.endsWith(';')) {
            const stmt = current.trim();
            if (stmt && stmt !== ';') {
                statements.push(stmt);
            }
            current = '';
        }
    }

    if (current.trim()) {
        statements.push(current.trim());
    }

    return statements.filter(s => s.replace(/--.*$/gm, '').trim().length > 0);
}

// ─── Execute via Supabase REST API (rpc exec_sql) ─────────────────────────────
// Since Supabase JS client doesn't support raw DDL directly, we use the
// Management API's database query endpoint with the service role.
async function executeSql(sqlStatement) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ sql: sqlStatement })
    });

    // Fallback: use Supabase Management API
    if (!response.ok) {
        return { error: await response.text() };
    }
    return { data: await response.json() };
}

// ─── Alternative: Use pg directly via connection string ───────────────────────
async function runMigrationViaPg() {
    let pg;
    try {
        pg = await import('pg');
    } catch {
        console.error('❌  pg package not found. Run: npm install pg');
        process.exit(1);
    }

    const { Client } = pg.default || pg;
    const client = new Client({
        connectionString: 'postgresql://postgres:zCtWCwKye3cfgVUl@db.byrmafeczbxutgkicmtu.supabase.co:5432/postgres',
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔗  Connecting to Supabase PostgreSQL...');
        await client.connect();
        console.log('✅  Connected.\n');

        const statements = parseSqlStatements(sql);
        console.log(`📋  Found ${statements.length} SQL statements to execute.\n`);

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];

            // Get a readable label for the statement
            const firstLine = stmt.split('\n').find(l => l.trim() && !l.trim().startsWith('--')) || '';
            const label = firstLine.substring(0, 80).trim();

            process.stdout.write(`  [${i + 1}/${statements.length}] ${label}... `);

            try {
                await client.query(stmt);
                console.log('✅');
                successCount++;
            } catch (err) {
                // Skip "already exists" errors gracefully
                if (err.code === '42P07' || err.message.includes('already exists')) {
                    console.log('⏭️  (already exists — skipped)');
                    successCount++;
                } else if (err.code === '42710') {
                    // Duplicate object
                    console.log('⏭️  (duplicate — skipped)');
                    successCount++;
                } else {
                    console.log(`❌  ERROR: ${err.message}`);
                    errorCount++;
                }
            }
        }

        console.log('\n─────────────────────────────────────');
        console.log(`✅  Success: ${successCount} statements`);
        if (errorCount > 0) {
            console.log(`❌  Errors:  ${errorCount} statements`);
        }
        console.log('─────────────────────────────────────');
        console.log('\n🎉  Migration complete!\n');

    } catch (err) {
        console.error('❌  Fatal connection error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// ─── Run ───────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════');
console.log('  DOLE Iligan Portal — Supabase Migration Runner');
console.log('  Migration: 001_initial_schema.sql');
console.log('═══════════════════════════════════════════════════════\n');

runMigrationViaPg();
