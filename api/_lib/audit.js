const MAX_MESSAGE_LENGTH = 500;
const MAX_TEXT_LENGTH = 120;

const clampText = (value, max = MAX_TEXT_LENGTH) => String(value || '').trim().slice(0, max);

const sanitizeMetadata = (metadata = {}) => {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
    const blocked = /password|pin|credential|token|secret|hash/i;
    return Object.fromEntries(Object.entries(metadata)
        .filter(([key]) => !blocked.test(key))
        .slice(0, 30)
        .map(([key, value]) => [clampText(key), typeof value === 'string' ? value.slice(0, 300) : value]));
};

const requestIp = (req) => {
    const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || String(req?.socket?.remoteAddress || '').trim() || null;
};

/* START SERVER AUDIT NOTIFICATION WRITER */
export const writeAuditLog = async (admin, req, {
    actorId = null,
    targetUserId = null,
    eventType = 'system',
    action = 'updated',
    entityType = 'system',
    entityId = null,
    message = 'Portal activity recorded.',
    metadata = {},
} = {}) => {
    const safeEventType = clampText(eventType);
    const safeAction = clampText(action);
    const safeEntityType = clampText(entityType);
    const { error } = await admin.from('notifications').insert({
        type: 'audit',
        title: `Audit: ${safeEventType} / ${safeAction}`,
        message: clampText(message, MAX_MESSAGE_LENGTH),
        recipient_roles: ['admin', 'hr'],
        actor_id: Number.isFinite(Number(actorId)) ? Number(actorId) : null,
        subject_user_id: Number.isFinite(Number(targetUserId)) ? Number(targetUserId) : null,
        event_type: safeEventType,
        action: safeAction,
        entity_type: safeEntityType,
        entity_id: entityId === null || entityId === undefined ? null : clampText(entityId),
        metadata: sanitizeMetadata(metadata),
        ip_address: requestIp(req),
        user_agent: clampText(req?.headers?.['user-agent'], 500) || null,
    });
    return { error: error?.message || null };
};
/* END SERVER AUDIT NOTIFICATION WRITER */

export { sanitizeMetadata };