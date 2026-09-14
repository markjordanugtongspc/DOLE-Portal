import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { allowMethods, getRequestBody, requireSameOrigin, sendJson } from '../_lib/http.js';
import { randomToken } from '../_lib/security.js';
import { requirePortalSession } from '../_lib/session.js';
import { getSsoSystem, hashSsoValue, resolveSsoCallback } from '../_lib/sso.js';

/* START SSO AUTHORIZATION CODE ISSUE API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['POST'])) return;
    if (!requireSameOrigin(req, res)) return;

    try {
        const admin = createPortalAdmin();
        const session = await requirePortalSession(req, res, admin);
        if (!session) return;

        const body = getRequestBody(req);
        const system = getSsoSystem(body.system_key);
        if (!system) return sendJson(res, 400, { error: 'This system is not supported for SSO.' });
        if (!system.clientSecret) return sendJson(res, 503, { error: 'This system SSO verifier is not configured yet.' });
        const callbackUrl = await resolveSsoCallback(admin, system);

        let link = null;
        if (session.user.is_gip) {
            const gipLinkResult = await admin
                .from('external_account_links')
                .select('portal_user_id, system_key, external_user_id, external_full_name, external_username')
                .eq('portal_user_id', session.user.id)
                .eq('system_key', system.key)
                .eq('is_gip', true)
                .maybeSingle();

            if (gipLinkResult.data) {
                link = gipLinkResult.data;
            } else {
                const fallbackLinkResult = await admin
                    .from('external_account_links')
                    .select('portal_user_id, system_key, external_user_id, external_full_name, external_username')
                    .eq('portal_user_id', session.user.id)
                    .eq('system_key', system.key)
                    .maybeSingle();
                link = fallbackLinkResult.data;
            }
        } else {
            const { data } = await admin
                .from('external_account_links')
                .select('portal_user_id, system_key, external_user_id, external_full_name, external_username')
                .eq('portal_user_id', session.user.id)
                .eq('system_key', system.key)
                .maybeSingle();
            link = data;
        }

        // Auto-resolve identity if not explicitly linked in external_account_links
        if (!link) {
            link = await autoResolveExternalLink(admin, session.user, system.key);
        }

        if (!link) return sendJson(res, 403, { error: 'Your Portal account is not assigned to this system yet.' });

        const code = randomToken(32);
        const state = randomToken(32);
        const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

        let ssoPortalUserId = Number(session.user.id);
        if (session.user.is_gip) {
            const { data: userRecord } = await admin
                .from('users')
                .select('id')
                .eq('id', ssoPortalUserId)
                .maybeSingle();

            if (!userRecord) {
                if (session.user.created_by && Number.isFinite(Number(session.user.created_by))) {
                    ssoPortalUserId = Number(session.user.created_by);
                } else {
                    const { data: gipRecord } = await admin
                        .from('gips')
                        .select('created_by')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    if (gipRecord?.created_by) {
                        ssoPortalUserId = Number(gipRecord.created_by);
                    } else {
                        const { data: fallbackUser } = await admin
                            .from('users')
                            .select('id')
                            .limit(1)
                            .maybeSingle();
                        ssoPortalUserId = fallbackUser?.id ? Number(fallbackUser.id) : 1;
                    }
                }
            }
        }

        const ssoPayload = {
            portal_user_id: ssoPortalUserId,
            system_key: system.key,
            external_user_id: link.external_user_id,
            external_full_name: link.external_full_name,
            external_username: link.external_username,
            redirect_uri: callbackUrl,
            code_hash: hashSsoValue(code),
            state_hash: hashSsoValue(state),
            expires_at: expiresAt
        };
        if (session.user.is_gip) {
            ssoPayload.is_gip = true;
        }

        let issueResult = await admin.from('sso_authorization_codes').insert(ssoPayload);
        if (issueResult.error && ssoPayload.is_gip) {
            delete ssoPayload.is_gip;
            issueResult = await admin.from('sso_authorization_codes').insert(ssoPayload);
        }
        if (issueResult.error) return sendJson(res, 500, { error: 'Unable to issue the one-time SSO authorization.' });

        const redirect = new URL(callbackUrl);
        redirect.searchParams.set('code', code);
        redirect.searchParams.set('state', state);
        return sendJson(res, 200, { data: { redirect_url: redirect.toString(), expires_at: expiresAt } });
    } catch (error) {
        console.error('[SSO AUTHORIZE] Failed:', error.message);
        return sendJson(res, 400, { error: error.message || 'SSO authorization is not configured.' });
    }
}
/* END SSO AUTHORIZATION CODE ISSUE API */

/* START autoResolveExternalLink FUNCTIONALITY - Automatically resolves and caches subsystem identity for Portal users */
async function autoResolveExternalLink(admin, sessionUser, systemKey) {
    if (!sessionUser) return null;
    const portalUserId = Number(sessionUser.id);
    const username = String(sessionUser.username || '').trim();
    const email = String(sessionUser.email || '').trim().toLowerCase();
    const fullName = String(sessionUser.full_name || '').trim();
    const roleId = Number(sessionUser.role_id);
    const isAdmin = roleId === 1 || roleId === 6;
    const isHr = roleId === 2;
    const isChief = roleId === 4 || roleId === 5;

    if (systemKey === 'SPES') {
        const spesAdmin = typeof admin.schema === 'function' ? admin.schema('spes') : admin;
        let matchedStaff = null;

        // 1. Try matching by username
        if (username) {
            const { data } = await spesAdmin.from('staffs').select('id, full_name, username').ilike('username', username).is('archive_at', null).limit(1).maybeSingle();
            if (data) matchedStaff = data;
        }

        // 2. Try matching by email
        if (!matchedStaff && email) {
            const { data } = await spesAdmin.from('staffs').select('id, full_name, username').ilike('email', email).is('archive_at', null).limit(1).maybeSingle();
            if (data) matchedStaff = data;
        }

        // 3. Try matching by full name
        if (!matchedStaff && fullName) {
            const { data } = await spesAdmin.from('staffs').select('id, full_name, username').ilike('full_name', `%${fullName}%`).is('archive_at', null).limit(1).maybeSingle();
            if (data) matchedStaff = data;
        }

        // 4. Role-based fallback for Executive/Administrative roles
        if (!matchedStaff) {
            if (isAdmin) {
                const { data } = await spesAdmin.from('staffs').select('id, full_name, username').eq('id', 1).maybeSingle();
                matchedStaff = data || { id: 1, full_name: fullName || 'System Administrator', username: 'admin' };
            } else if (isHr) {
                const { data } = await spesAdmin.from('staffs').select('id, full_name, username').eq('id', 2).maybeSingle();
                matchedStaff = data || { id: 2, full_name: fullName || 'HR Officer', username: username || 'hr' };
            } else if (isChief) {
                const { data } = await spesAdmin.from('staffs').select('id, full_name, username').eq('id', 57).maybeSingle();
                matchedStaff = data || { id: 57, full_name: fullName || 'Chief Officer', username: username || 'chief' };
            }
        }

        if (matchedStaff) {
            const linkRecord = {
                portal_user_id: portalUserId,
                system_key: 'SPES',
                external_user_id: String(matchedStaff.id),
                external_full_name: matchedStaff.full_name,
                external_username: matchedStaff.username,
                linked_by: portalUserId,
                is_gip: Boolean(sessionUser.is_gip)
            };
            await admin.from('external_account_links').upsert(linkRecord, { onConflict: 'portal_user_id,system_key,is_gip' });
            return linkRecord;
        }
    } else if (systemKey === 'GIP') {
        const gipAdmin = typeof admin.schema === 'function' ? admin.schema('gip') : admin;
        let matchedUser = null;

        // 1. Try matching by username
        if (username) {
            const { data } = await gipAdmin.from('users').select('user_id, full_name, username').ilike('username', username).eq('is_active', true).limit(1).maybeSingle();
            if (data) matchedUser = data;
        }

        // 2. Try matching by email
        if (!matchedUser && email) {
            const { data } = await gipAdmin.from('users').select('user_id, full_name, username').ilike('email', email).eq('is_active', true).limit(1).maybeSingle();
            if (data) matchedUser = data;
        }

        // 3. Try matching by full name
        if (!matchedUser && fullName) {
            const { data } = await gipAdmin.from('users').select('user_id, full_name, username').ilike('full_name', `%${fullName}%`).eq('is_active', true).limit(1).maybeSingle();
            if (data) matchedUser = data;
        }

        // 4. Role-based fallback for Executive/Administrative roles
        if (!matchedUser && (isAdmin || isHr || isChief)) {
            const { data } = await gipAdmin.from('users').select('user_id, full_name, username').eq('user_id', 1).maybeSingle();
            matchedUser = data || { user_id: 1, full_name: fullName || 'Administrator', username: 'admin' };
        }

        if (matchedUser) {
            const linkRecord = {
                portal_user_id: portalUserId,
                system_key: 'GIP',
                external_user_id: String(matchedUser.user_id),
                external_full_name: matchedUser.full_name,
                external_username: matchedUser.username,
                linked_by: portalUserId,
                is_gip: Boolean(sessionUser.is_gip)
            };
            await admin.from('external_account_links').upsert(linkRecord, { onConflict: 'portal_user_id,system_key,is_gip' });
            return linkRecord;
        }
    }

    return null;
}
/* END autoResolveExternalLink FUNCTIONALITY */

