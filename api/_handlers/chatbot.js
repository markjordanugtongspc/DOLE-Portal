import fs from 'node:fs';
import path from 'node:path';
import { allowMethods, getRequestBody, requireSameOrigin, sendJson } from '../_lib/http.js';

/* ========================================================================== */
/* START: DOLE CHATBOT SERVERLESS BACKEND API HANDLER                         */
/* ========================================================================== */

// In-memory sliding rate limiter and security lockdown tracker
const clientTracker = new Map();
const LOCKDOWN_STAGES = [30, 180, 360, 720, 1440, 2880, 5760, 10800]; // in seconds (30s, 3m, 6m, 12m... max 3h)
const BURST_WINDOW_MS = 10000; // 10 seconds
const BURST_LIMIT = 10; // Max 10 rapid calls within 10s window

/* START CLIENT IP HELPER */
const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
    return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
};
/* END CLIENT IP HELPER */

/* START RATE LIMIT & LOCKDOWN EVALUATOR */
const checkRateLimitAndLockdown = (clientIp) => {
    const now = Date.now();
    let record = clientTracker.get(clientIp);

    if (!record) {
        record = {
            timestamps: [],
            strikeCount: 0,
            lockedUntil: 0
        };
        clientTracker.set(clientIp, record);
    }

    // Check if active lockdown exists
    if (record.lockedUntil > now) {
        const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
        return {
            allowed: false,
            locked: true,
            remainingSec,
            strikeCount: record.strikeCount,
            error: `Security lockdown active due to rapid burst activity. Please wait ${remainingSec}s.`
        };
    }

    // Clean old timestamps outside the burst window
    record.timestamps = record.timestamps.filter((ts) => now - ts < BURST_WINDOW_MS);
    record.timestamps.push(now);

    // Check if burst limit exceeded
    if (record.timestamps.length > BURST_LIMIT) {
        record.strikeCount += 1;
        const stageIndex = Math.min(record.strikeCount - 1, LOCKDOWN_STAGES.length - 1);
        const lockDurationSec = LOCKDOWN_STAGES[stageIndex];
        record.lockedUntil = now + lockDurationSec * 1000;
        record.timestamps = [];

        return {
            allowed: false,
            locked: true,
            remainingSec: lockDurationSec,
            strikeCount: record.strikeCount,
            error: `Rate limit threshold triggered (10 rapid requests). Security lockdown enforced for ${lockDurationSec}s.`
        };
    }

    return { allowed: true, locked: false, remainingSec: 0, strikeCount: record.strikeCount };
};
/* END RATE LIMIT & LOCKDOWN EVALUATOR */

/* START TOPIC INFERENCE CLASSIFIER */
const inferTopic = (text = '', requestedTopic = '') => {
    const validTopics = ['portal', 'spes', 'gip', 'dole_programs', 'dole_office', 'other'];
    if (requestedTopic && validTopics.includes(requestedTopic.toLowerCase())) {
        return requestedTopic.toLowerCase();
    }

    const query = String(text).toLowerCase();
    if (/\b(developer|creator|author|mark jordan|ugtong|who created|who made|who built)\b/i.test(query)) {
        return 'other';
    }
    if (/\b(spes|special program|student|payroll|disbursement|allowance|summer job)\b/i.test(query)) {
        return 'spes';
    }
    if (/\b(gip|government internship|intern|internship|stipend)\b/i.test(query)) {
        return 'gip';
    }
    if (/\b(tupad|dilp|livelihood|sena|single entry|workers|wage|emergency employment|strike|cba)\b/i.test(text)) {
        return 'dole_programs';
    }
    if (/\b(office|contact|hotline|location|address|director|head|region 10|region x|iligan|telephone|phone|email)\b/i.test(text)) {
        return 'dole_office';
    }

    return 'portal';
};
/* END TOPIC INFERENCE CLASSIFIER */

/* START CLEAN AGENT TEXT RESPONSE HELPER */
const cleanAgentResponse = (rawText) => {
    if (!rawText) return 'I am here to help you with the DOLE Portal and its programs. How may I assist you?';

    let text = rawText;
    try {
        const parsed = JSON.parse(rawText);
        if (parsed.response) text = parsed.response;
        else if (parsed.text) text = parsed.text;
    } catch {
        // Not raw JSON, keep as is
    }

    const lines = text.split('\n');
    const filtered = lines.filter((line) => {
        const trimmed = line.trim();
        if (/^I'll (read|start|examine|check|inspect|look|run|follow|give|provide|proceed)/i.test(trimmed)) return false;
        if (/^Let me (read|load|record|examine|check|look|render|validate)/i.test(trimmed)) return false;
        if (/^Now let me/i.test(trimmed)) return false;
        if (/^I've (read|checked|loaded|examined)/i.test(trimmed)) return false;
        if (/^I have (the skill|everything|loaded)/i.test(trimmed)) return false;
        if (/^Validat(ing|ed|ion)\b/i.test(trimmed)) return false;
        if (/^Check(ing|ed)? (the |inputs)/i.test(trimmed)) return false;
        if (/^Inputs? (validated|validation|present|checked)/i.test(trimmed)) return false;
        if (/^\*\*Input(s)? validation:\*\*/i.test(trimmed)) return false;
        if (/^(question|topic|audience):/i.test(trimmed)) return false;
        if (/^[•\-\*]\s*(✅|⚠️|❌|\[\s*\]|\[x\])?\s*(question|topic|audience)\b/i.test(trimmed)) return false;
        if (/^Per the SKILL/i.test(trimmed)) return false;
        if (/^Since (audience|the|this|user)\b/i.test(trimmed)) return false;
        if (/^Because (audience|you're|the|user)\b/i.test(trimmed)) return false;
        if (/^This is (an? )?(app-support|DOLE|portal|SPES|GIP|TUPAD|friendly)/i.test(trimmed)) return false;
        if (/^Answering now\b/i.test(trimmed)) return false;
        if (/^The actual question\b/i.test(trimmed)) return false;
        if (/^Done( —|!|\.|$)/i.test(trimmed)) return false;
        if (/^Here's the (support )?answer/i.test(trimmed)) return false;
        if (/^Here's a (summary|dashboard)/i.test(trimmed)) return false;
        if (/^Here's your (step-by-step )?answer/i.test(trimmed)) return false;
        if (/per the DOLE Support Assistant procedure/i.test(trimmed)) return false;
        if (/find the SKILL\.md file/i.test(trimmed)) return false;
        if (/\b(matches the SKILL|SKILL\.md's public role|schema validation)\b/i.test(trimmed)) return false;
        return true;
    });

    return filtered.join('\n').trim();
};
/* END CLEAN AGENT TEXT RESPONSE HELPER */

/* START SERVER-SIDE ANTI-TOKEN-DRAIN GUARDRAIL */
const OUT_OF_SCOPE_REFUSAL = 'I am the official DOLE AI Support Assistant dedicated exclusively to DOLE Region X portal navigation, GIP/SPES programs, TUPAD/DILP services, and support ticket inquiries. I cannot generate code or build custom software. How can I assist you with DOLE programs today?';
const LOGIN_REQUIRED_REFUSAL = '🔒 **Authentication Required**: Inquiries about internal portal modules, employee tools, staff dashboards, and ticket submission require an active DOLE Portal login. Please log in first with your employee, implementer, or staff credentials to access these features. If you need public assistance for DOLE Region X programs (such as TUPAD, SPES, GIP, or DILP), feel free to ask!';

const GREETING_RESPONSE = `Hello! 👋 Welcome to the **DOLE Region X Support Assistant** (Lanao del Norte Provincial Field Office).

I can assist you with:
• **DOLE Programs & Employment Services**: TUPAD, SPES, GIP, DILP livelihood assistance, and PESO job matching.
• **Office Information & Inquiries**: Provincial Field Office address, hotlines, emails, and operating hours.
• **Portal Navigation & Ticket Support**: Guidance on ticket management and knowledge base self-help guides (login required for employee tools).

How can I help you today? Feel free to ask a question or select any suggested topic above!`;

const isGreetingOnly = (text = '') => {
    const trimmed = String(text).trim().toLowerCase().replace(/[!.,?]+$/, '');
    const greetingMatches = [
        'hi', 'hello', 'hi there', 'hello there', 'hey', 'hey there',
        'good morning', 'good afternoon', 'good evening', 'good day',
        'kumusta', 'kamusta', 'greetings', 'morning', 'afternoon', 'evening'
    ];
    return greetingMatches.includes(trimmed);
};

const isCodingOrBypassQuery = (text = '') => {
    const q = String(text).toLowerCase();
    const codingPatterns = [
        /\b(how to code|how to program|write (a )?(code|script|program|html|css|javascript|js|php|sql|python|java|c\+\+|bash|react|vue|node))\b/i,
        /\b(create|build|make|generate|develop) (a )?(website|system|app|software|database|script|code|bot|api|backend|frontend) for me\b/i,
        /\b(write|give me|show me) (the )?(html|css|tailwind|flowbite|javascript|php|sql|python|java|c\+\+|regex) code\b/i,
        /\b(can you code|can you program|can you write script|teach me (how to )?coding)\b/i,
        /\b(generate (an? )?sql query|select \* from|insert into|drop table)\b/i,
        /\b(solve this (math|calculus|physics) (equation|problem)|write an essay about)\b/i
    ];
    return codingPatterns.some((pattern) => pattern.test(q));
};

const isInternalPortalQuery = (text = '') => {
    const q = String(text).toLowerCase();
    const internalPatterns = [
        /\b(ticket|tickets)\b/i,
        /\bhow (to|do i).*(ticket|portal|dashboard|ocr|payroll|article|staff)\b/i,
        /\b(submit|create|file|track|open|manage|view).*(ticket)\b/i,
        /\b(how to (use|navigate|access|login|log in) (the )?portal)\b/i,
        /\b(staff dashboard|admin dashboard|staff management|manage staff)\b/i,
        /\b(ocr converter|convert (a )?documents?|ocr tool)\b/i,
        /\b(spes payroll|auto payroll|payroll monitoring|payroll calculation)\b/i,
        /\b(how to assign gip|manage articles|publish articles)\b/i,
        /\b(external systems directory|sso authorize)\b/i
    ];
    return internalPatterns.some((pattern) => pattern.test(q));
};
/* END SERVER-SIDE ANTI-TOKEN-DRAIN GUARDRAIL */

/* START MAIN HANDLER */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['GET', 'POST'])) return;
    if (!requireSameOrigin(req, res)) return;

    if (req.method === 'GET') {
        return sendJson(res, 200, {
            status: 'online',
            service: 'DOLE Support Chatbot API',
            provider: 'CREAO Developer Platform',
            timestamp: new Date().toISOString()
        });
    }

    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimitAndLockdown(clientIp);

    if (!rateCheck.allowed) {
        res.setHeader('Retry-After', rateCheck.remainingSec);
        return sendJson(res, 429, {
            error: rateCheck.error,
            locked: true,
            retryAfter: rateCheck.remainingSec,
            strikeCount: rateCheck.strikeCount
        });
    }

    const body = getRequestBody(req);
    const message = String(body.message || body.query || body.question || '').trim();
    const conversationId = body.conversation_id || body.conversationId || undefined;
    const requestedTopic = body.topic || '';
    const audience = body.audience || 'public';
    const isStreamRequested = Boolean(body.stream || req.headers.accept?.includes('text/event-stream'));

    if (!message) {
        return sendJson(res, 400, { error: 'Please enter a message or question.' });
    }

    // Short-circuit simple greetings (0 tokens spent)
    if (isGreetingOnly(message)) {
        if (isStreamRequested) {
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.write(`data: ${JSON.stringify({ delta: GREETING_RESPONSE, conversation_id: conversationId })}\n\n`);
            res.write(`data: ${JSON.stringify({ event: 'run.completed' })}\n\n`);
            res.end();
            return;
        }
        return sendJson(res, 200, {
            success: true,
            topic: 'portal',
            reply: GREETING_RESPONSE,
            conversation_id: conversationId
        });
    }

    // Short-circuit out-of-scope coding queries to prevent token drain
    if (isCodingOrBypassQuery(message)) {
        if (isStreamRequested) {
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.write(`data: ${JSON.stringify({ delta: OUT_OF_SCOPE_REFUSAL, conversation_id: conversationId })}\n\n`);
            res.write(`data: ${JSON.stringify({ event: 'run.completed' })}\n\n`);
            res.end();
            return;
        }
        return sendJson(res, 200, {
            success: true,
            topic: 'other',
            reply: OUT_OF_SCOPE_REFUSAL,
            conversation_id: conversationId
        });
    }

    // Short-circuit internal portal inquiries by unauthenticated guests (0 tokens spent)
    if ((audience === 'public' || audience === 'guest') && isInternalPortalQuery(message)) {
        if (isStreamRequested) {
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.write(`data: ${JSON.stringify({ delta: LOGIN_REQUIRED_REFUSAL, conversation_id: conversationId })}\n\n`);
            res.write(`data: ${JSON.stringify({ event: 'run.completed' })}\n\n`);
            res.end();
            return;
        }
        return sendJson(res, 200, {
            success: true,
            topic: 'portal',
            reply: LOGIN_REQUIRED_REFUSAL,
            conversation_id: conversationId
        });
    }

    const resolveCreaoConfig = () => {
        let apiKey = process.env.CREAO_API_KEY;
        let agentId = process.env.CREAO_AGENT_ID || 'bff66ca9-b406-4de3-86a6-0cde187b24aa';
        let baseUrl = process.env.CREAO_API_BASE_URL || 'https://developer.creao.ai';

        if (!apiKey) {
            try {
                const envPaths = [
                    path.resolve(process.cwd(), 'src/backend/config/.env'),
                    path.resolve(process.cwd(), '.env'),
                    path.resolve(process.cwd(), '.env.local')
                ];
                for (const p of envPaths) {
                    if (fs.existsSync(p)) {
                        const content = fs.readFileSync(p, 'utf8');
                        for (const line of content.split('\n')) {
                            const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
                            if (match) {
                                const [, key, val] = match;
                                const cleanVal = (val || '').trim().replace(/^['"]|['"]$/g, '');
                                if (key === 'CREAO_API_KEY' && !apiKey) apiKey = cleanVal;
                                if (key === 'CREAO_AGENT_ID' && agentId === 'bff66ca9-b406-4de3-86a6-0cde187b24aa') agentId = cleanVal || agentId;
                                if (key === 'CREAO_API_BASE_URL' && baseUrl === 'https://developer.creao.ai') baseUrl = cleanVal || baseUrl;
                            }
                        }
                    }
                }
            } catch {
                // ignore in environments without local fs
            }
        }

        return {
            apiKey: apiKey || '',
            agentId: agentId || 'bff66ca9-b406-4de3-86a6-0cde187b24aa',
            baseUrl: baseUrl.replace(/\/$/, '')
        };
    };

    const { apiKey, agentId, baseUrl } = resolveCreaoConfig();

    if (!apiKey) {
        return sendJson(res, 500, {
            error: 'CREAO API key is not configured on the server. Please check backend .env.'
        });
    }

    const topic = inferTopic(message, requestedTopic);

    try {
        if (isStreamRequested) {
            const creaoStreamRes = await fetch(`${baseUrl}/v1/realtime/runs`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    conversation_id: conversationId,
                    input: {
                        question: message,
                        topic: topic,
                        audience: audience
                    }
                })
            });

            if (!creaoStreamRes.ok) {
                const errorText = await creaoStreamRes.text();
                return sendJson(res, creaoStreamRes.status, {
                    error: `CREAO Realtime API Error: ${errorText}`
                });
            }

            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            });

            const reader = creaoStreamRes.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                res.write(chunk);
            }

            res.end();
            return;
        }

        const creaoRes = await fetch(`${baseUrl}/v1/realtime/runs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                agent_id: agentId,
                conversation_id: conversationId,
                input: {
                    question: message,
                    topic: topic,
                    audience: audience
                }
            })
        });

        if (!creaoRes.ok) {
            const errorPayload = await creaoRes.text();
            return sendJson(res, creaoRes.status, {
                error: `CREAO agent service returned ${creaoRes.status}: ${errorPayload}`
            });
        }

        const reader = creaoRes.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedDelta = '';
        let resolvedConversationId = conversationId;
        let runId = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const parsed = JSON.parse(line.slice(6));
                        if (parsed.delta) {
                            accumulatedDelta += parsed.delta;
                        }
                        if (parsed.conversation_id) {
                            resolvedConversationId = parsed.conversation_id;
                        }
                        if (parsed.run_id) {
                            runId = parsed.run_id;
                        }
                    } catch {
                        // ignore non-json SSE lines
                    }
                }
            }
        }

        const cleanReply = cleanAgentResponse(accumulatedDelta);

        return sendJson(res, 200, {
            success: true,
            reply: cleanReply,
            raw: accumulatedDelta,
            topic: topic,
            audience: audience,
            conversation_id: resolvedConversationId,
            run_id: runId
        });

    } catch (err) {
        console.error('[DOLE CHATBOT API] Exception:', err);
        return sendJson(res, 500, {
            error: 'Failed to communicate with DOLE Support AI service. Please try again shortly.'
        });
    }
}
/* END MAIN HANDLER */
/* ========================================================================== */
/* END: DOLE CHATBOT SERVERLESS BACKEND API HANDLER                           */
/* ========================================================================== */
