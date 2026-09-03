import { createPortalAdmin } from '../_lib/supabase-admin.js';
import { allowMethods, getRequestBody, requireSameOrigin, sendJson } from '../_lib/http.js';
import { requirePortalSession } from '../_lib/session.js';
import { validateExternalAccount } from '../_lib/external-systems.js';

const SYSTEM_KEYS = new Set(['SPES', 'GIP']);

/* START EXTERNAL ACCOUNT LINK ASSIGNMENT API */
export default async function handler(req, res) {
    if (!allowMethods(req, res, ['POST', 'GET', 'DELETE'])) return;
    if (!requireSameOrigin(req, res)) return;

    try {
        const admin = createPortalAdmin();
        const session = await requirePortalSession(req, res, admin);
        if (!session) return;
        const roleId = Number(session.user.role_id);
        if (roleId !== 1 && roleId !== 3) {
            return sendJson(res, 403, { error: 'Only an approved Portal administrator or staff member can manage account assignments.' });
        }
        const administrator = session;

        // START EXTERNAL ACCOUNT LINK UNASSIGNMENT
        if (req.method === 'DELETE') {
            const body = getRequestBody(req);
            const portalUserId = Number(body.portal_user_id);
            const systemKey = String(body.system_key || '').toUpperCase();
            if (!Number.isSafeInteger(portalUserId) || portalUserId < 1 || !SYSTEM_KEYS.has(systemKey)) {
                return sendJson(res, 400, { error: 'A valid Portal user and external system are required.' });
            }
            const { error: deleteError } = await admin
                .from('external_account_links')
                .delete()
                .eq('portal_user_id', portalUserId)
                .eq('system_key', systemKey);
            if (deleteError) return sendJson(res, 500, { error: 'Unable to unassign the external system account.' });
            return sendJson(res, 200, { data: { portal_user_id: portalUserId, system_key: systemKey, unassigned: true } });
        }
        // END EXTERNAL ACCOUNT LINK UNASSIGNMENT
        if (req.method === 'GET') {
            const requestUrl = new URL(req.url || '/', 'http://localhost');
            const portalUserId = Number(requestUrl.searchParams.get('portal_user_id'));
            if (!portalUserId || isNaN(portalUserId)) {
                return sendJson(res, 400, { error: 'A valid portal_user_id search parameter is required.' });
            }
            const { data: links, error: linksError } = await admin
                .from('external_account_links')
                .select('system_key, external_user_id, external_full_name, external_username')
                .eq('portal_user_id', portalUserId);
            if (linksError) {
                return sendJson(res, 500, { error: 'Unable to load external account links.' });
            }
            return sendJson(res, 200, { data: links });
        }

        const body = getRequestBody(req);
        const portalUserId = Number(body.portal_user_id);
        const isGip = Boolean(body.is_gip);
        const links = Array.isArray(body.links) ? body.links : [];
        if (!Number.isSafeInteger(portalUserId) || portalUserId < 1 || links.length < 1 || links.length > SYSTEM_KEYS.size) {
            return sendJson(res, 400, { error: 'Select at least one valid external system account.' });
        }

        const uniqueSystemKeys = new Set(links.map((link) => String(link?.system_key || '').toUpperCase()));
        if (uniqueSystemKeys.size !== links.length || [...uniqueSystemKeys].some((key) => !SYSTEM_KEYS.has(key))) {
            return sendJson(res, 400, { error: 'Each selected account must belong to one supported system.' });
        }

        let portalUser = null;
        if (isGip) {
            const { data: gipUser } = await admin
                .from('gips')
                .select('id, status, archived_at')
                .eq('id', portalUserId)
                .is('archived_at', null)
                .maybeSingle();
            if (gipUser && gipUser.status !== 'Archived') {
                portalUser = { id: gipUser.id, approval_status: 'APPROVED', is_gip: true };
            }
        } else {
            const { data: regUser } = await admin
                .from('users')
                .select('id, approval_status, archived_at')
                .eq('id', portalUserId)
                .maybeSingle();
            if (regUser && !regUser.archived_at && String(regUser.approval_status).toUpperCase() === 'APPROVED') {
                portalUser = { id: regUser.id, approval_status: 'APPROVED', is_gip: false };
            } else {
                const { data: gipUser } = await admin
                    .from('gips')
                    .select('id, status, archived_at')
                    .eq('id', portalUserId)
                    .is('archived_at', null)
                    .maybeSingle();
                if (gipUser && gipUser.status !== 'Archived') {
                    portalUser = { id: gipUser.id, approval_status: 'APPROVED', is_gip: true };
                }
            }
        }

        if (!portalUser) {
            return sendJson(res, 400, { error: 'The selected Portal account is not an active approved account.' });
        }

        const verifiedLinks = await Promise.all(links.map(async (link) => {
            const systemKey = String(link.system_key).toUpperCase();
            const externalUserId = String(link.external_user_id || '').trim();
            if (!externalUserId || externalUserId.length > 120) throw new Error('An external account ID is required.');
            const externalUser = await validateExternalAccount({ systemKey, externalUserId });
            return {
                portal_user_id: portalUserId,
                system_key: systemKey,
                external_user_id: String(externalUser.id),
                external_full_name: externalUser.full_name || null,
                external_username: externalUser.username || null,
                linked_by: administrator.user.id,
                updated_at: new Date().toISOString()
            };
        }));

        const isGipAccount = Boolean(portalUser.is_gip);
        const verifiedLinksWithGip = verifiedLinks.map((item) => ({ ...item, is_gip: isGipAccount }));

        // Attempt upsert with Plan B compound unique constraint (portal_user_id, system_key, is_gip)
        let upsertResult = await admin
            .from('external_account_links')
            .upsert(verifiedLinksWithGip, { onConflict: 'portal_user_id,system_key,is_gip' })
            .select('id, portal_user_id, system_key, external_user_id, external_full_name, external_username, linked_by, created_at, updated_at');

        if (upsertResult.error) {
            // Fallback for Plan A schema without is_gip column / constraint
            upsertResult = await admin
                .from('external_account_links')
                .upsert(verifiedLinks, { onConflict: 'portal_user_id,system_key' })
                .select('id, portal_user_id, system_key, external_user_id, external_full_name, external_username, linked_by, created_at, updated_at');
        }

        if (upsertResult.error) {
            console.error('[EXTERNAL LINKS] Upsert failed:', upsertResult.error.message);
            return sendJson(res, 500, {
                error: `Unable to save external account assignments: ${upsertResult.error.message}`
            });
        }
        return sendJson(res, 200, { data: upsertResult.data });
    } catch (error) {
        console.error('[EXTERNAL LINKS] Assignment failed:', error.message);
        return sendJson(res, 400, { error: error.message || 'Unable to verify the selected external account.' });
    }
}
/* END EXTERNAL ACCOUNT LINK ASSIGNMENT API */
