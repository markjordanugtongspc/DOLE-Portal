/**
 * DOLE Iligan Portal - Local migration runner.
 *
 * This file intentionally contains no project URL, service role key, or database
 * password. Keep real credentials in a local, gitignored env file.
 *
 * Usage:
 *   SUPABASE_DB_URL="your_local_database_connection_string" MIGRATION_SQL_PATH="C:/secure/schema.sql" node src/backend/migrations/run-migration.mjs
 *
 * Optional local env files loaded automatically when present:
 *   src/backend/config/.env.local
 *   src/backend/config/.env
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../../..');
const envFiles = [
    resolve(projectRoot, 'src/backend/config/.env.local'),
    resolve(projectRoot, 'src/backend/config/.env')
];

function loadLocalEnv() {
    for (const envPath of envFiles) {
        if (!existsSync(envPath)) continue;

        const lines = readFileSync(envPath, 'utf-8').split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const separatorIndex = trimmed.indexOf('=');
            if (separatorIndex === -1) continue;

            const key = trimmed.slice(0, separatorIndex).trim();
            const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
            if (key && process.env[key] === undefined) {
                process.env[key] = value;
            }
        }
    }
}

function parseSqlStatements(rawSql) {
    const statements = [];
    let current = '';
    let inDollarQuote = false;
    let dollarTag = '';

    for (const line of rawSql.split('\n')) {
        const trimmed = line.trim();
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

        current += `${line}\n`;
        if (!inDollarQuote && trimmed.endsWith(';')) {
            const statement = current.trim();
            if (statement && statement !== ';') statements.push(statement);
            current = '';
        }
    }

    if (current.trim()) statements.push(current.trim());
    return statements.filter((statement) => statement.replace(/--.*$/gm, '').trim().length > 0);
}

async function runMigration() {
    loadLocalEnv();

    const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    const migrationPath = process.env.MIGRATION_SQL_PATH;

    if (!connectionString) {
        throw new Error('Missing SUPABASE_DB_URL or DATABASE_URL. Put it in a local gitignored env file or pass it before the command.');
    }

    if (!migrationPath) {
        throw new Error('Missing MIGRATION_SQL_PATH. Keep migration SQL outside git or in a gitignored local path.');
    }

    const resolvedMigrationPath = resolve(projectRoot, migrationPath);
    if (!existsSync(resolvedMigrationPath)) {
        throw new Error(`Migration SQL file was not found: ${resolvedMigrationPath}`);
    }

    let pg;
    try {
        pg = await import('pg');
    } catch {
        throw new Error('Missing pg dependency. Run npm install first.');
    }

    const { Client } = pg.default || pg;
    const sql = readFileSync(resolvedMigrationPath, 'utf-8');
    const statements = parseSqlStatements(sql);
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    console.log('Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log(`Connected. Running ${statements.length} SQL statements.`);

    let successCount = 0;
    try {
        for (let i = 0; i < statements.length; i += 1) {
            const statement = statements[i];
            const firstLine = statement.split('\n').find((line) => line.trim() && !line.trim().startsWith('--')) || '';
            const label = firstLine.substring(0, 80).trim();
            process.stdout.write(`  [${i + 1}/${statements.length}] ${label}... `);

            try {
                await client.query(statement);
                successCount += 1;
                console.log('done');
            } catch (error) {
                if (error.code === '42P07' || error.code === '42710' || error.message.includes('already exists')) {
                    successCount += 1;
                    console.log('already exists, skipped');
                } else {
                    throw error;
                }
            }
        }
    } finally {
        await client.end();
    }

    console.log(`Migration complete. Successful statements: ${successCount}`);
}

runMigration().catch((error) => {
    console.error(`Migration failed: ${error.message}`);
    process.exit(1);
});