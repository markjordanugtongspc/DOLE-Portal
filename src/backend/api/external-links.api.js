/* START EXTERNAL ACCOUNT LINK API */
const requestJson = async (url, options = {}) => {
    try {
        const response = await fetch(url, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options
        });
        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : null;
        if (!payload) return { data: null, error: 'The Portal backend endpoint is not configured yet.' };
        if (!response.ok) return { data: null, error: payload.error || `Request failed with HTTP ${response.status}.` };
        return { data: payload.data ?? payload, error: null };
    } catch (error) {
        return { data: null, error: error.message || 'Unable to reach the Portal API.' };
    }
};

/** Save only the selected Portal-to-external account mappings. */
export const createExternalAccountLinks = (user, matches) => requestJson('/api/external-account-links', {
    method: 'POST',
    body: JSON.stringify({
        portal_user_id: user.id,
        links: matches.map((match) => ({
            system_key: match.system_key,
            external_user_id: String(match.id),
            external_full_name: match.full_name || null,
            external_username: match.username || null
        }))
    })
});

/** Retrieve existing Portal-to-external account mappings. */
export const fetchExternalAccountLinks = (portalUserId) => requestJson(`/api/external-account-links?portal_user_id=${portalUserId}`, {
    method: 'GET'
});

/** Remove one Portal-to-external account mapping. */
export const deleteExternalAccountLink = (portalUserId, systemKey) => requestJson('/api/external-account-links', {
    method: 'DELETE',
    body: JSON.stringify({ portal_user_id: portalUserId, system_key: systemKey })
});
/** Ask the trusted Portal backend to issue a short-lived SSO redirect. */
export const requestSystemSsoLaunch = (systemKey) => requestJson('/api/sso/authorize', {
    method: 'POST',
    body: JSON.stringify({ system_key: systemKey })
});
/* END EXTERNAL ACCOUNT LINK API */