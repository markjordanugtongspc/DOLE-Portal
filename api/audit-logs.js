import { createPortalAdmin } from './_lib/supabase-admin.js';
import { writeAuditLog } from './_lib/audit.js';
import { allowMethods, getRequestBody, requireSameOrigin, sendJson } from './_lib/http.js';
import { requirePortalSession } from './_lib/session.js';

const allowedEventTypes = new Set(['account', 'system', 'ticket', 'session', 'auth']);
const allowedRoles = new Set([1, 2]);

/* START PORTAL AUDIT LOG API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['GET', 'POST'])) return;
    if (!requireSameOrigin(req, res)) return;

    try {
        const admin = createPortalAdmin();
        const session = await requirePortalSession(req, res, admin);
        if (!session) return;
        if (req.method === 'GET' && !allowedRoles.has(Number(session.user.role_id))) {
            return sendJson(res, 403, { error: 'Only Admin and HR may access audit logs.' });
        }

        if (req.method === 'POST') {
            const body = getRequestBody(req);
            const eventType = String(body.eventType || '').trim().toLowerCase();
            if (!allowedEventTypes.has(eventType)) {
                return sendJson(res, 400, { error: 'A valid audit event type is required.' });
            }
            const result = await writeAuditLog(admin, req, {
                actorId: session.user.id,
                targetUserId: body.targetUserId,
                eventType,
                action: body.action,
                entityType: body.entityType,
                entityId: body.entityId,
                message: body.message,
                metadata: body.metadata,
            });
            if (result.error) return sendJson(res, 500, { error: result.error });
            return sendJson(res, 201, { data: { recorded: true } });
        }

        const requestedLimit = Number(new URL(req.url, 'http://localhost').searchParams.get('limit') || 100);
        const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 100, 1), 200);
        const { data, error } = await admin
            .from('notifications')
            .select('id, type, title, message, actor_id, subject_user_id, event_type, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at')
            .eq('type', 'audit')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) return sendJson(res, 500, { error: error.message });

        const logs = data || [];
        const userIds = Array.from(new Set(logs.flatMap((log) => [log.actor_id, log.subject_user_id])
            .map(Number).filter(Number.isFinite)));
        let users = [];
        if (userIds.length) {
            const userResult = await admin.from('users').select('id, full_name, username').in('id', userIds);
            users = userResult.data || [];
        }
        const usersById = new Map(users.map((user) => [Number(user.id), user]));
        return sendJson(res, 200, {
            data: logs.map((log) => ({
                ...log,
                target_user_id: log.subject_user_id,
                target: usersById.get(Number(log.subject_user_id)) || null,
                actor: usersById.get(Number(log.actor_id)) || null,
            }))
        });
    } catch (error) {
        console.error('[PORTAL AUDIT] Request failed:', error.message);
        return sendJson(res, 500, { error: 'Audit logging is not configured.' });
    }
}
/* END PORTAL AUDIT LOG API */