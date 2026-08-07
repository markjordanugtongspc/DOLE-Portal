import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { allowMethods, getRequestBody, requireSameOrigin, sendJson } from '../_lib/http.js';
import { hashCredential, verifyCredential } from '../_lib/security.js';
import { createSessionCookie, issuePortalSession } from '../_lib/session.js';

const identityColumnByMode = { username: 'username', email: 'email', phone: 'phone' };
const safeUser = (user) => ({
    id: Number(user.id), role_id: Number(user.role_id), office_id: user.office_id === null ? null : Number(user.office_id),
    full_name: user.full_name, username: user.username, email: user.email, phone: user.phone,
    approval_status: user.approval_status, status: 'online'
});

/* START PORTAL BACKEND LOGIN API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['POST'])) return;
    if (!requireSameOrigin(req, res)) return;

    const body = getRequestBody(req);
    const mode = String(body.mode || 'username').toLowerCase();
    const column = identityColumnByMode[mode];
    const identity = String(body.identity || '').trim();
    const credential = String(body.credential || '');
    const credentialColumn = mode === 'phone' ? 'pin' : 'password';
    const normalizedIdentity = mode === 'phone' && /^9\d{9}$/.test(identity) ? `+63${identity}` : identity;

    if (!column || !identity || !credential || credential.length > 1024) {
        return sendJson(res, 400, { error: 'A valid login identity and credential are required.', field: 'credential' });
    }

    try {
        const admin = createPortalAdmin();
        const { data: user, error } = await admin
            .from('users')
            .select('id, role_id, office_id, full_name, username, email, phone, approval_status, status, archived_at, password, pin')
            .eq(column, normalizedIdentity)
            .maybeSingle();

        if (error || !user || user.archived_at) {
            return sendJson(res, 401, { error: 'Invalid login credentials.', code: 'credential_invalid', field: 'credential' });
        }

        const verification = await verifyCredential(user[credentialColumn], credential);
        if (!verification.valid) {
            return sendJson(res, 401, { error: 'Invalid login credentials.', code: 'credential_invalid', field: 'credential' });
        }

        const approvalStatus = String(user.approval_status || 'PENDING').toUpperCase();
        if (approvalStatus !== 'APPROVED') {
            const errorMessage = approvalStatus === 'DECLINED'
                ? 'Your registration request was declined. Please contact your HR office or Portal administrator.'
                : 'Your registration is still pending approval.';
            return sendJson(res, 403, { error: errorMessage, code: `approval_${approvalStatus.toLowerCase()}`, field: 'identity' });
        }

        if (verification.upgrade) {
            await admin.from('users').update({ [credentialColumn]: await hashCredential(credential), updated_at: new Date().toISOString() }).eq('id', user.id);
        }
        await admin.from('users').update({ status: 'online', last_seen: new Date().toISOString() }).eq('id', user.id);

        const session = await issuePortalSession(admin, user.id, Boolean(body.remember));
        res.setHeader('Set-Cookie', createSessionCookie(session.token, session.maxAge, req));
        return sendJson(res, 200, { data: safeUser(user) });
    } catch (error) {
        console.error('[PORTAL AUTH] Login failed:', error.message);
        return sendJson(res, 500, { error: 'Server authentication is not configured.' });
    }
}
/* END PORTAL BACKEND LOGIN API */