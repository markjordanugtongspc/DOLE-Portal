import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { allowMethods, getRequestBody, sendJson } from '../_lib/http.js';
import { getPortalSession } from '../_lib/session.js';

/* START PORTAL CURRENT SESSION & STATUS API - Returns session details and updates presence / uptime status */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['GET', 'POST', 'PATCH'])) return;
    try {
        const admin = createPortalAdmin();
        const session = await getPortalSession(req, admin);

        if (req.method === 'POST' || req.method === 'PATCH') {
            if (!session || !session.user) {
                return sendJson(res, 401, { error: 'No active session found.' });
            }
            const body = getRequestBody(req);
            const status = body.status === 'online' ? 'online' : (body.status === 'offline' ? 'offline' : (session.user.status || 'online'));
            const timestamp = new Date().toISOString();
            const uptimeDelta = Math.max(0, Math.floor(Number(body.uptime_delta || body.uptimeDelta || 0)));

            if (session.user.is_gip) {
                const updatePayload = { status, updated_at: timestamp };
                if (uptimeDelta > 0) {
                    try {
                        const { data: rpcRes, error: rpcErr } = await admin.rpc('increment_user_uptime', {
                            p_user_id: session.user.id,
                            p_seconds: uptimeDelta,
                            p_is_gip: true
                        });
                        if (rpcErr) {
                            const currentUptime = Number(session.user.total_uptime || 0);
                            updatePayload.total_uptime = currentUptime + uptimeDelta;
                            await admin.from('gips').update(updatePayload).eq('id', session.user.id);
                        }
                    } catch {
                        await admin.from('gips').update(updatePayload).eq('id', session.user.id);
                    }
                } else {
                    await admin.from('gips').update(updatePayload).eq('id', session.user.id);
                }
            } else {
                const updatePayload = { status, last_seen: timestamp };
                if (uptimeDelta > 0) {
                    try {
                        const { data: rpcRes, error: rpcErr } = await admin.rpc('increment_user_uptime', {
                            p_user_id: session.user.id,
                            p_seconds: uptimeDelta,
                            p_is_gip: false
                        });
                        if (rpcErr) {
                            const currentUptime = Number(session.user.total_uptime || 0);
                            updatePayload.total_uptime = currentUptime + uptimeDelta;
                            await admin.from('users').update(updatePayload).eq('id', session.user.id);
                        }
                    } catch {
                        await admin.from('users').update(updatePayload).eq('id', session.user.id);
                    }
                } else {
                    await admin.from('users').update(updatePayload).eq('id', session.user.id);
                }
            }

            return sendJson(res, 200, { data: { status, user_id: session.user.id, uptime_delta: uptimeDelta } });
        }

        return sendJson(res, 200, { data: session?.user || null });
    } catch (error) {
        console.error('[PORTAL AUTH] Session / status handler failed:', error.message);
        return sendJson(res, 200, { data: null });
    }
}
/* END PORTAL CURRENT SESSION & STATUS API */
