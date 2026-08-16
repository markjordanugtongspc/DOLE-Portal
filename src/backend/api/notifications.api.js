import { supabase } from './supabase.js';

const normalizeRoles = (roles) => Array.from(new Set((Array.isArray(roles) ? roles : [roles])
    .map((role) => String(role || '').trim().toLowerCase())
    .filter((role) => role === 'admin' || role === 'hr')));

export async function createNotification({ type = 'system', title, message, recipientRoles = ['admin', 'hr'], actorId = null, subjectUserId = null, actionUrl = null }) {
    const roles = normalizeRoles(recipientRoles);
    if (!title || !message || !roles.length) return { data: null, error: 'Notification title, message, and recipients are required.' };

    const { data, error } = await supabase
        .from('notifications')
        .insert([{ type, title, message, recipient_roles: roles, actor_id: actorId, subject_user_id: subjectUserId, action_url: actionUrl }])
        .select()
        .single();

    if (error) {
        window.DEBUG?.error('NOTIFICATIONS-API', 'Unable to create notification.', error.message);
        return { data: null, error: error.message };
    }
    return { data, error: null };
}

export async function fetchNotifications(recipientRole, filter = 'all') {
    const role = normalizeRoles(recipientRole)[0];
    if (!role) return { data: [], error: 'Alerts are available only to Admin and HR.' };

    let query = supabase
        .from('notifications')
        .select('*')
        .contains('recipient_roles', [role])
        .neq('type', 'audit')
        .order('created_at', { ascending: false });

    if (filter === 'unread') query = query.eq('is_read', false);

    const { data, error } = await query;
    if (error) {
        window.DEBUG?.error('NOTIFICATIONS-API', 'Unable to fetch notifications.', error.message);
        return { data: [], error: error.message };
    }
    const notifications = data || [];
    const userIds = Array.from(new Set(notifications
        .flatMap((notification) => [notification.actor_id, notification.subject_user_id])
        .map(Number)
        .filter(Number.isFinite)));

    if (!userIds.length) return { data: notifications, error: null };

    let { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, birthday, username, email, phone, avatar_url, status, approval_status, last_seen, created_at, role_id, office_id, roles(name), offices(name)')
        .in('id', userIds);

    if (usersError) {
        window.DEBUG?.warn('NOTIFICATIONS-API', 'Fallback loading basic notification users.', usersError.message);
        const fallback = await supabase
            .from('users')
            .select('id, full_name, username, avatar_url')
            .in('id', userIds);
        users = fallback.data || [];
    }

    const userById = new Map((users || []).map((user) => [Number(user.id), user]));
    return {
        data: notifications.map((notification) => ({
            ...notification,
            actor: userById.get(Number(notification.actor_id)) || userById.get(Number(notification.subject_user_id)) || null,
            subject_user: userById.get(Number(notification.subject_user_id)) || userById.get(Number(notification.actor_id)) || null,
        })),
        error: null
    };
}

export async function countUnreadNotifications(recipientRole) {
    const role = normalizeRoles(recipientRole)[0];
    if (!role) return { count: 0, error: null };

    const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .contains('recipient_roles', [role])
        .neq('type', 'audit')
        .eq('is_read', false);

    return { count: error ? 0 : (count || 0), error: error?.message || null };
}

export async function markNotificationsRead(ids) {
    const notificationIds = Array.from(new Set((Array.isArray(ids) ? ids : [ids]).map(Number).filter(Number.isFinite)));
    if (!notificationIds.length) return { error: null };

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', notificationIds)
        .neq('type', 'audit');

    return { error: error?.message || null };
}

export async function deleteNotifications(ids) {
    const notificationIds = Array.from(new Set((Array.isArray(ids) ? ids : [ids]).map(Number).filter(Number.isFinite)));
    if (!notificationIds.length) return { error: null };

    const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', notificationIds)
        .neq('type', 'audit');

    return { error: error?.message || null };
}