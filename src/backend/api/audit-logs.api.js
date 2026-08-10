const auditRequest = async (url, options = {}) => {
    try {
        const response = await fetch(url, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { data: null, error: payload.error || 'Unable to reach the audit log service.' };
        return { data: payload.data ?? payload, error: null };
    } catch (error) {
        return { data: null, error: error.message || 'Unable to reach the audit log service.' };
    }
};

/* START AUDIT LOG CLIENT API */
export const recordAuditLog = (payload) => auditRequest('/api/audit-logs', {
    method: 'POST',
    body: JSON.stringify(payload),
});

export const fetchAuditLogs = (limit = 100) => auditRequest(`/api/audit-logs?limit=${encodeURIComponent(limit)}`);
/* END AUDIT LOG CLIENT API */
