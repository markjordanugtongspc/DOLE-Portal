import fs from 'node:fs';
import path from 'node:path';
import { allowMethods, getRequestBody, requireSameOrigin, sendJson } from '../_lib/http.js';

/* ========================================================================== */
/* START: DOLE PORTAL SMSAPI SERVERLESS BACKEND HANDLER                       */
/* ========================================================================== */

const resolveSmsConfig = () => {
    let uid = process.env.SMSAPI_UID;
    let apiKey = process.env.SMSAPI_KEY;
    let baseUrl = process.env.SMSAPI_BASE_URL || 'https://smsapi.neilian.dev/send';

    if (!uid || !apiKey) {
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
                            if (key === 'SMSAPI_UID' && !uid) uid = cleanVal;
                            if (key === 'SMSAPI_KEY' && !apiKey) apiKey = cleanVal;
                            if (key === 'SMSAPI_BASE_URL' && baseUrl === 'https://smsapi.neilian.dev/send') baseUrl = cleanVal || baseUrl;
                        }
                    }
                }
            }
        } catch {
            // Ignore in environments without local fs
        }
    }

    return {
        uid: uid || '',
        apiKey: apiKey || '',
        baseUrl: baseUrl || 'https://smsapi.neilian.dev/send'
    };
};

/**
 * Standardize Philippine mobile numbers to +639XXXXXXXXX format
 */
const normalizePhilippinePhone = (rawPhone = '') => {
    let clean = String(rawPhone || '').trim().replace(/[\s\-\(\)]/g, '');
    if (clean.startsWith('09')) {
        clean = '+63' + clean.slice(1);
    } else if (clean.startsWith('639')) {
        clean = '+' + clean;
    } else if (clean.startsWith('9') && clean.length === 10) {
        clean = '+63' + clean;
    }
    return clean;
};

export default async function handler(req, res) {
    if (!allowMethods(req, res, ['GET', 'POST'])) return;
    if (!requireSameOrigin(req, res)) return;

    const config = resolveSmsConfig();

    if (req.method === 'GET') {
        return sendJson(res, 200, {
            status: 'online',
            service: 'DOLE SMSAPI Gateway Service',
            configured: Boolean(config.apiKey && config.uid),
            endpoint: config.baseUrl,
            uid_masked: config.uid ? `${config.uid.slice(0, 6)}...${config.uid.slice(-4)}` : null,
            key_masked: config.apiKey ? `${config.apiKey.slice(0, 7)}...${config.apiKey.slice(-4)}` : null,
            timestamp: new Date().toISOString()
        });
    }

    // POST request: Send SMS
    const body = getRequestBody(req);
    const rawPhone = String(body.phone || '').trim();
    const rawMessage = String(body.message || '').trim();
    const customUid = body.uid ? String(body.uid).trim() : '';
    const customApiKey = body.apiKey ? String(body.apiKey).trim() : '';

    const effectiveUid = customUid || config.uid;
    const effectiveApiKey = customApiKey || config.apiKey;
    const effectiveUrl = config.baseUrl || 'https://smsapi.neilian.dev/send';

    if (!effectiveApiKey) {
        return sendJson(res, 500, {
            error: 'SMSAPI Secret Key is not configured. Please ensure SMSAPI_KEY is defined in backend .env.'
        });
    }

    if (!effectiveUid) {
        return sendJson(res, 500, {
            error: 'SMSAPI UID is not configured. Please ensure SMSAPI_UID is defined in backend .env.'
        });
    }

    if (!rawPhone) {
        return sendJson(res, 400, { error: 'Recipient phone number is required.' });
    }

    const phone = normalizePhilippinePhone(rawPhone);

    // Validate Philippine format: Must start with +639 and be followed by 9 digits (total 13 chars)
    const phoneRegex = /^\+639\d{9}$/;
    if (!phoneRegex.test(phone)) {
        return sendJson(res, 400, {
            error: `Invalid Philippine mobile number format: '${rawPhone}'. Must start with +639 and contain 10 digits after +63 (e.g. +639123456789).`
        });
    }

    if (!rawMessage) {
        return sendJson(res, 400, { error: 'Message content cannot be empty.' });
    }

    if (rawMessage.length > 160) {
        return sendJson(res, 400, {
            error: `Message exceeds the 160 character single-SMS limit (current: ${rawMessage.length} chars).`
        });
    }

    const payload = {
        uid: effectiveUid,
        phone: phone,
        message: rawMessage
    };

    const startTime = Date.now();

    try {
        const smsResponse = await fetch(effectiveUrl, {
            method: 'POST',
            headers: {
                'x-api-key': effectiveApiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const latencyMs = Date.now() - startTime;
        const responseText = await smsResponse.text();
        let parsedResponse = null;

        try {
            parsedResponse = JSON.parse(responseText);
        } catch {
            parsedResponse = responseText;
        }

        const isSuccess = smsResponse.ok;

        return sendJson(res, smsResponse.status, {
            success: isSuccess,
            statusCode: smsResponse.status,
            latencyMs,
            recipient: phone,
            charCount: rawMessage.length,
            gatewayResponse: parsedResponse,
            sentAt: new Date().toISOString(),
            diagnostics: {
                endpoint: effectiveUrl,
                uid_used: `${effectiveUid.slice(0, 6)}...${effectiveUid.slice(-4)}`,
                apiKey_used: `${effectiveApiKey.slice(0, 7)}...${effectiveApiKey.slice(-4)}`
            }
        });

    } catch (err) {
        const latencyMs = Date.now() - startTime;
        console.error('[SMSAPI Gateway Error]:', err);
        return sendJson(res, 502, {
            success: false,
            error: `Failed to communicate with SMS Gateway: ${err.message}`,
            latencyMs,
            timestamp: new Date().toISOString()
        });
    }
}
