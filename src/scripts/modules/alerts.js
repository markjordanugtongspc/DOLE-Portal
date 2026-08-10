import {
    deleteNotifications,
    fetchNotifications,
    markNotificationsRead,
} from '@/backend/api/notifications.api.js';
import { fetchAuditLogs } from '@/backend/api/audit-logs.api.js';
import { supabase } from '@/backend/api/supabase.js';
import { getCachedCurrentUser } from '@/backend/api/auth.api.js';

const formatDate = (value) => {
    try {
        return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    } catch {
        return value || '';
    }
};

const esc = (value = '') => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const avatar = (person) => person?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(person?.full_name || person?.username || 'DOLE Portal')}&background=DBEAFE&color=1D4ED8&bold=true`;

export const initAlerts = () => {
    const root = document.getElementById('alerts-page');
    if (!root || root.dataset.initialized) return;
    root.dataset.initialized = 'true';

    const user = getCachedCurrentUser();
    const recipientRole = Number(user?.role_id) === 1 ? 'admin' : Number(user?.role_id) === 2 ? 'hr' : null;
    if (!recipientRole) return;

    const list = document.getElementById('alerts-list');
    const selectAll = document.getElementById('alerts-select-all');
    const filter = document.getElementById('alerts-filter');
    const markReadBtn = document.getElementById('alerts-mark-read');
    const deleteBtn = document.getElementById('alerts-delete');
    const empty = document.getElementById('alerts-empty');
    const error = document.getElementById('alerts-error');
    const auditLogsList = document.getElementById('audit-logs-list');
    const auditLogsLoading = document.getElementById('audit-logs-loading');
    const auditLogsEmpty = document.getElementById('audit-logs-empty');
    const auditLogsError = document.getElementById('audit-logs-error');

    /* START ALERTS LOADING STATE */
    const loading = document.getElementById('alerts-loading');
    const setLoading = (isLoading) => {
        loading?.classList.toggle('hidden', !isLoading);
        list?.classList.toggle('hidden', isLoading);
        if (isLoading) empty?.classList.add('hidden');
    };
    /* END ALERTS LOADING STATE */

    let notifications = [];
    let channel = null;

    const selectedIds = () => Array.from(list?.querySelectorAll('[data-alert-select]:checked') || [])
        .map((input) => Number(input.value));

    const updateActions = () => {
        const hasSelection = selectedIds().length > 0;
        [markReadBtn, deleteBtn].forEach((button) => {
            if (!button) return;
            button.disabled = !hasSelection;
            button.classList.toggle('opacity-50', !hasSelection);
            button.classList.toggle('cursor-not-allowed', !hasSelection);
        });
        if (selectAll) selectAll.checked = notifications.length > 0 && selectedIds().length === notifications.length;
    };

    const render = () => {
        if (!list) return;
        list.innerHTML = notifications.map((notification) => `
            <article data-alert-id="${notification.id}" class="group flex items-start gap-3 border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800 ${notification.is_read ? '' : 'border-l-4 border-l-blue-600 dark:border-l-blue-500'}">
                <input data-alert-select type="checkbox" value="${notification.id}" class="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800">
                <img src="${avatar(notification.actor)}" alt="${esc(notification.actor?.full_name || notification.actor?.username || 'Portal activity')}" class="mt-0.5 h-10 w-10 shrink-0 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-gray-200 dark:border-gray-900 dark:ring-gray-700">
                <div class="min-w-0 flex-1 cursor-pointer" data-alert-open>
                    <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2"><h2 class="truncate text-sm font-bold text-gray-900 dark:text-white">${esc(notification.title)}</h2>${notification.is_read ? '' : '<span class="h-2 w-2 shrink-0 rounded-full bg-blue-600 dark:bg-blue-500" aria-label="Unread"></span>'}</div>
                            <p class="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">${esc(notification.message)}</p>
                        </div>
                        <time class="shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500">${esc(formatDate(notification.created_at))}</time>
                    </div>
                </div>
            </article>`).join('');
        empty?.classList.toggle('hidden', notifications.length !== 0);
        updateActions();
    };

    /* START AUDIT LOGS */
    const renderAuditLogs = (logs = []) => {
        if (!auditLogsList) return;
        auditLogsList.innerHTML = logs.map((log) => {
            const actor = log.actor?.full_name || log.actor?.username || 'System';
            const target = log.target?.full_name || log.target?.username || '';
            const targetLabel = target ? ` - Target: ${esc(target)}` : '';
            return `<article class="flex flex-col gap-2 p-4 transition-colors hover:bg-white/60 dark:hover:bg-gray-800/40 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-sm font-bold text-gray-900 dark:text-white">${esc(log.message)}</span>
                        <span class="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">${esc(log.event_type)}</span>
                    </div>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">By ${esc(actor)}${targetLabel}</p>
                </div>
                <time class="shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500">${esc(formatDate(log.created_at))}</time>
            </article>`;
        }).join('');
        auditLogsList.classList.toggle('hidden', logs.length === 0);
        auditLogsEmpty?.classList.toggle('hidden', logs.length !== 0);
    };

    const loadAuditLogs = async () => {
        auditLogsLoading?.classList.remove('hidden');
        auditLogsList?.classList.add('hidden');
        auditLogsEmpty?.classList.add('hidden');
        auditLogsError?.classList.add('hidden');
        try {
            const result = await fetchAuditLogs(100);
            if (result.error) {
                auditLogsError.textContent = `Unable to load audit logs. ${result.error}`;
                auditLogsError.classList.remove('hidden');
                renderAuditLogs([]);
                return;
            }
            renderAuditLogs(Array.isArray(result.data) ? result.data : []);
        } catch (loadError) {
            window.DEBUG?.error('AUDIT_LOGS', 'Unable to load audit logs.', loadError);
            auditLogsError.textContent = 'Unable to load audit logs. Please run the notifications audit-fields migration and try again.';
            auditLogsError.classList.remove('hidden');
            renderAuditLogs([]);
        } finally {
            auditLogsLoading?.classList.add('hidden');
        }
    };
    /* END AUDIT LOGS */

    const load = async () => {
        setLoading(true);
        error?.classList.add('hidden');
        try {
            const result = await fetchNotifications(recipientRole, filter?.value || 'all');
            if (result.error) {
                error.textContent = `Unable to load alerts. ${result.error}`;
                error.classList.remove('hidden');
            }
            notifications = Array.isArray(result.data) ? result.data : [];
            render();
        } catch (loadError) {
            window.DEBUG?.error('ALERTS', 'Unable to load alerts.', loadError);
            notifications = [];
            if (error) {
                error.textContent = 'Unable to load alerts. Please try again.';
                error.classList.remove('hidden');
            }
            render();
        } finally {
            setLoading(false);
        }
    };

    selectAll?.addEventListener('change', () => {
        list?.querySelectorAll('[data-alert-select]').forEach((input) => { input.checked = selectAll.checked; });
        updateActions();
    });
    list?.addEventListener('change', (event) => {
        if (event.target.matches('[data-alert-select]')) updateActions();
    });
    filter?.addEventListener('change', load);

    markReadBtn?.addEventListener('click', async () => {
        const { error: requestError } = await markNotificationsRead(selectedIds());
        if (requestError) {
            error.textContent = `Unable to mark alerts as read. ${requestError}`;
            error.classList.remove('hidden');
            return;
        }
        await load();
    });

    deleteBtn?.addEventListener('click', async () => {
        const ids = selectedIds();
        if (!ids.length || !window.confirm(`Delete ${ids.length} selected notification${ids.length === 1 ? '' : 's'}?`)) return;
        const { error: requestError } = await deleteNotifications(ids);
        if (requestError) {
            error.textContent = `Unable to delete alerts. ${requestError}`;
            error.classList.remove('hidden');
            return;
        }
        await load();
    });

    list?.addEventListener('click', async (event) => {
        const target = event.target.closest('[data-alert-open]');
        if (!target) return;
        const notification = notifications.find((item) => Number(item.id) === Number(target.closest('[data-alert-id]')?.dataset.alertId));
        if (!notification) return;
        if (!notification.is_read) await markNotificationsRead([notification.id]);
        if (notification.action_url) window.location.assign(notification.action_url);
        else await load();
    });

    channel = supabase.channel(`alerts-${recipientRole}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => { void load(); void loadAuditLogs(); })
        .subscribe((status) => window.DEBUG?.flow('ALERTS', `Notifications channel: ${status}`));
    window.addEventListener('beforeunload', () => {
        if (channel) supabase.removeChannel(channel);
    }, { once: true });

    void load();
    void loadAuditLogs();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAlerts);
else initAlerts();