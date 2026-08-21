import { Modal } from 'flowbite';
import {
    deleteNotifications,
    fetchNotifications,
    markNotificationsRead,
} from '@/backend/api/notifications.api.js';
import { fetchAuditLogs } from '@/backend/api/audit-logs.api.js';
import { fetchUserById, updateUser } from '@/backend/api/users.api.js';
import { fetchGipsByStaff } from '@/backend/api/gips.api.js';
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

const avatar = (person) => {
    const name = typeof person === 'string' ? person : person?.full_name || person?.username || 'DOLE Portal';
    return (typeof person === 'object' && person?.avatar_url) || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=DBEAFE&color=1D4ED8&bold=true`;
};

const approvalState = (user) => String(user?.approval_status || 'APPROVED').toUpperCase();

const approvalBadge = (state) => {
    if (state === 'PENDING') {
        return '<span class="inline-flex items-center bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 font-semibold px-2.5 py-1 rounded-md text-xs select-none gap-1.5"><span class="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>Pending</span>';
    }
    if (state === 'DECLINED') {
        return '<span class="inline-flex items-center bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 font-semibold px-2.5 py-1 rounded-md text-xs select-none gap-1.5"><span class="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>Declined</span>';
    }
    return '<span class="inline-flex items-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 font-semibold px-2.5 py-1 rounded-md text-xs select-none gap-1.5"><span class="w-1.5 h-1.5 bg-emerald-500"></span>Approved</span>';
};

const badge = (status = 'offline') => {
    const online = String(status).toLowerCase() === 'online';
    return `<span class="inline-flex items-center ${online ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'} font-semibold px-2.5 py-1 rounded-md text-xs select-none gap-1.5"><span class="w-1.5 h-1.5 ${online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'} rounded-full"></span>${online ? 'Online' : 'Offline'}</span>`;
};

const statusBadge = (user) => badge(user?.status);

const isRegistrationNotification = (notification) => {
    return notification?.type === 'registration_pending' ||
        notification?.type === 'staff_created' ||
        /registration|registered and is waiting|pending approval/i.test(`${notification?.title || ''} ${notification?.message || ''}`);
};

const getSubjectUser = (notification) => notification?.subject_user || notification?.actor || null;

/* START FLOWBITE FEEDBACK HELPERS */
const showToast = (type, message) => {
    let container = document.getElementById('systems-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'systems-toast-container';
        container.className = 'fixed bottom-4 right-4 z-[80] flex w-[calc(100%-2rem)] max-w-xs flex-col gap-2 sm:right-4 sm:w-full';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    const id = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.id = id;
    toast.className = 'flex items-center w-full max-w-xs p-4 text-gray-500 bg-white rounded-lg shadow-md dark:text-gray-400 dark:bg-gray-800 transition-all duration-300 transform translate-y-2 opacity-0';

    let iconHtml = '';
    if (type === 'success') {
        iconHtml = `
            <div class="inline-flex items-center justify-center shrink-0 w-8 h-8 text-emerald-500 bg-emerald-100 rounded-lg dark:bg-emerald-800 dark:text-emerald-200">
                <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z"/>
                </svg>
                <span class="sr-only">Success icon</span>
            </div>
        `;
    } else if (type === 'danger') {
        iconHtml = `
            <div class="inline-flex items-center justify-center shrink-0 w-8 h-8 text-red-500 bg-red-100 rounded-lg dark:bg-red-800 dark:text-red-200">
                <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 11.793a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 0 1 1.414 1.414L11.414 10l2.293 2.293Z"/>
                </svg>
                <span class="sr-only">Error icon</span>
            </div>
        `;
    } else {
        iconHtml = `
            <div class="inline-flex items-center justify-center shrink-0 w-8 h-8 text-orange-500 bg-orange-100 rounded-lg dark:bg-orange-850 dark:text-orange-200">
                <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5Z"/>
                </svg>
                <span class="sr-only">Warning icon</span>
            </div>
        `;
    }

    toast.innerHTML = `
        ${iconHtml}
        <div class="ms-3 text-sm font-semibold">${esc(message)}</div>
        <button type="button" class="cursor-pointer ms-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" data-dismiss-target="#${id}" aria-label="Close">
            <span class="sr-only">Close</span>
            <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
            </svg>
        </button>
    `;

    container.appendChild(toast);
    window.requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    const dismiss = () => {
        toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
    };

    toast.querySelector('[data-dismiss-target]')?.addEventListener('click', dismiss);
    setTimeout(dismiss, 4000);
};
/* END FLOWBITE FEEDBACK HELPERS */

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

    /* START USER REGISTRATION DETAILS MODAL SETUP */
    const modalEl = document.getElementById('alertUserModal');
    const alertModal = modalEl ? new Modal(modalEl) : null;
    const modalAcceptBtn = document.getElementById('alert-modal-btn-accept');
    const modalRejectBtn = document.getElementById('alert-modal-btn-reject');
    let activeModalUser = null;
    let activeModalAlertId = null;

    modalEl?.querySelectorAll('[data-alert-modal-close], [data-modal-hide="alertUserModal"]').forEach((btn) => {
        btn.addEventListener('click', () => alertModal?.hide());
    });
    /* END USER REGISTRATION DETAILS MODAL SETUP */

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

    /* START USER REGISTRATION APPROVE AND DECLINE ACTIONS */
    const SPINNER_SVG = `<svg class="w-4 h-4 animate-spin shrink-0 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

    const syncModalActionButtons = (targetUser) => {
        const isPending = !targetUser || approvalState(targetUser) === 'PENDING';
        const isApproved = targetUser && approvalState(targetUser) === 'APPROVED';
        const isDeclined = targetUser && approvalState(targetUser) === 'DECLINED';

        if (modalAcceptBtn) {
            modalAcceptBtn.disabled = !isPending;
            modalAcceptBtn.innerHTML = `
                <svg class="w-4 h-4 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                </svg>
                <span id="alert-modal-btn-accept-text">${isApproved ? 'APPROVED' : 'ACCEPT'}</span>
            `;
        }
        if (modalRejectBtn) {
            modalRejectBtn.disabled = !isPending;
            modalRejectBtn.innerHTML = `
                <svg class="w-4 h-4 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                <span id="alert-modal-btn-reject-text">${isDeclined ? 'DECLINED' : 'REJECT'}</span>
            `;
        }
    };

    const handleApproveStaff = async (userId, alertId = null, btnElement = null) => {
        const originalHtml = btnElement ? btnElement.innerHTML : null;
        if (btnElement) {
            btnElement.disabled = true;
            if (btnElement === modalAcceptBtn) {
                btnElement.innerHTML = `${SPINNER_SVG}<span>ACCEPTING...</span>`;
            } else {
                btnElement.innerHTML = SPINNER_SVG;
            }
        }
        if (modalAcceptBtn) modalAcceptBtn.disabled = true;
        if (modalRejectBtn) modalRejectBtn.disabled = true;

        try {
            const result = await updateUser(userId, { approval_status: 'APPROVED' });
            if (result.error) {
                window.DEBUG?.error('ALERTS', 'Approve staff failed.', result.error);
                showToast('danger', `Unable to approve staff. ${result.error}`);
                if (btnElement && originalHtml) {
                    btnElement.innerHTML = originalHtml;
                    btnElement.disabled = false;
                }
                if (activeModalUser) syncModalActionButtons(activeModalUser);
                return false;
            }

            showToast('success', 'Staff account approved successfully.');
            if (activeModalUser && activeModalUser.id === userId) {
                activeModalUser.approval_status = 'APPROVED';
                syncModalActionButtons(activeModalUser);
                const approvalEl = document.getElementById('alert-view-approval-status');
                if (approvalEl) approvalEl.innerHTML = approvalBadge('APPROVED');
            }
            if (alertId) await markNotificationsRead([alertId]);
            alertModal?.hide();
            await load();
            return true;
        } catch (err) {
            showToast('danger', `Unable to approve staff. ${err.message || err}`);
            if (btnElement && originalHtml) {
                btnElement.innerHTML = originalHtml;
                btnElement.disabled = false;
            }
            if (activeModalUser) syncModalActionButtons(activeModalUser);
            return false;
        }
    };

    const handleDeclineStaff = async (userId, alertId = null, btnElement = null) => {
        const originalHtml = btnElement ? btnElement.innerHTML : null;
        if (btnElement) {
            btnElement.disabled = true;
            if (btnElement === modalRejectBtn) {
                btnElement.innerHTML = `${SPINNER_SVG}<span>REJECTING...</span>`;
            } else {
                btnElement.innerHTML = SPINNER_SVG;
            }
        }
        if (modalAcceptBtn) modalAcceptBtn.disabled = true;
        if (modalRejectBtn) modalRejectBtn.disabled = true;

        try {
            const result = await updateUser(userId, { approval_status: 'DECLINED', status: 'offline' });
            if (result.error) {
                window.DEBUG?.error('ALERTS', 'Decline staff failed.', result.error);
                showToast('danger', `Unable to decline staff. ${result.error}`);
                if (btnElement && originalHtml) {
                    btnElement.innerHTML = originalHtml;
                    btnElement.disabled = false;
                }
                if (activeModalUser) syncModalActionButtons(activeModalUser);
                return false;
            }

            showToast('success', 'Staff account declined successfully.');
            if (activeModalUser && activeModalUser.id === userId) {
                activeModalUser.approval_status = 'DECLINED';
                syncModalActionButtons(activeModalUser);
                const approvalEl = document.getElementById('alert-view-approval-status');
                if (approvalEl) approvalEl.innerHTML = approvalBadge('DECLINED');
            }
            if (alertId) await markNotificationsRead([alertId]);
            alertModal?.hide();
            await load();
            return true;
        } catch (err) {
            showToast('danger', `Unable to decline staff. ${err.message || err}`);
            if (btnElement && originalHtml) {
                btnElement.innerHTML = originalHtml;
                btnElement.disabled = false;
            }
            if (activeModalUser) syncModalActionButtons(activeModalUser);
            return false;
        }
    };

    modalAcceptBtn?.addEventListener('click', async () => {
        if (!activeModalUser?.id) return;
        await handleApproveStaff(activeModalUser.id, activeModalAlertId, modalAcceptBtn);
    });

    modalRejectBtn?.addEventListener('click', async () => {
        if (!activeModalUser?.id) return;
        await handleDeclineStaff(activeModalUser.id, activeModalAlertId, modalRejectBtn);
    });
    /* END USER REGISTRATION APPROVE AND DECLINE ACTIONS */

    /* START OPEN USER REGISTRATION DETAILS MODAL */
    const openRegistrationDetailsModal = async (notification) => {
        try {
            if (!modalEl || !alertModal) return;
            const initialUser = getSubjectUser(notification);
            if (!initialUser?.id) return;

            activeModalAlertId = notification.id;

            // Show modal immediately with current data
            let user = initialUser;
            activeModalUser = user;

            const setText = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val || 'N/A';
            };

            const avatarImg = document.getElementById('alert-view-avatar');
            if (avatarImg) avatarImg.src = avatar(user);

            const onlineDot = document.getElementById('alert-view-online-dot');
            if (onlineDot) {
                onlineDot.className = `absolute bottom-0 right-0 w-5 h-5 ${user.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'} border-[3.5px] border-white dark:border-gray-800 rounded-full`;
            }

            setText('alert-view-name', user.full_name || user.username);
            setText('alert-view-position', user.roles?.name || (Number(user.role_id) === 2 ? 'HR' : Number(user.role_id) === 1 ? 'Admin' : 'Staff'));
            setText('alert-view-email', user.email);
            setText('alert-view-username', user.username);
            setText('alert-view-office', user.offices?.name || 'No office assigned');
            setText('alert-view-phone', user.phone);
            setText('alert-view-birthday', user.birthday ? formatDate(user.birthday) : 'N/A');
            setText('alert-view-date', user.created_at ? formatDate(user.created_at) : 'N/A');

            const statusEl = document.getElementById('alert-view-status');
            if (statusEl) statusEl.innerHTML = statusBadge(user);

            const approvalEl = document.getElementById('alert-view-approval-status');
            if (approvalEl) approvalEl.innerHTML = approvalBadge(approvalState(user));

            syncModalActionButtons(user);

            alertModal.show();

            // Fetch fresh complete user info and attached GIP assistants in background
            const [freshUserRes, gipsRes] = await Promise.all([
                fetchUserById(initialUser.id).catch(() => ({ data: null })),
                fetchGipsByStaff(initialUser.id).catch(() => ({ data: [] }))
            ]);

            if (freshUserRes?.data) {
                user = freshUserRes.data;
                activeModalUser = user;
                setText('alert-view-name', user.full_name || user.username);
                setText('alert-view-position', user.roles?.name || (Number(user.role_id) === 2 ? 'HR' : Number(user.role_id) === 1 ? 'Admin' : 'Staff'));
                setText('alert-view-email', user.email);
                setText('alert-view-username', user.username);
                setText('alert-view-office', user.offices?.name || 'No office assigned');
                setText('alert-view-phone', user.phone);
                setText('alert-view-birthday', user.birthday ? formatDate(user.birthday) : 'N/A');
                setText('alert-view-date', user.created_at ? formatDate(user.created_at) : 'N/A');
                if (statusEl) statusEl.innerHTML = statusBadge(user);
                if (approvalEl) approvalEl.innerHTML = approvalBadge(approvalState(user));
                syncModalActionButtons(user);
            }

            const gips = gipsRes?.data || [];
            const gipsContainer = document.getElementById('alert-view-gips-container');
            if (gipsContainer) {
                if (gips.length > 0) {
                    gipsContainer.innerHTML = gips.map((gip) => `
                        <div class="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-2xs">
                            <img class="w-9 h-9 rounded-lg object-cover ring-2 ring-gray-100 dark:ring-gray-700 shadow-xs" src="${avatar(gip)}" alt="${esc(gip.full_name)}">
                            <div class="flex-1 min-w-0">
                                <h5 class="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">${esc(gip.full_name)}</h5>
                                <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">${esc(gip.email || gip.username || 'GIP assistant')}</p>
                            </div>
                            <span class="inline-flex items-center bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold px-2 py-0.5 rounded text-[10px] select-none shrink-0">GIP</span>
                        </div>
                    `).join('');
                } else {
                    gipsContainer.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-400 italic">No linked GIP implementors attached to this registration.</p>';
                }
            }
        } catch (modalErr) {
            window.DEBUG?.error('ALERTS', 'Failed to open registration modal', modalErr);
        }
    };
    /* END OPEN USER REGISTRATION DETAILS MODAL */

    const render = () => {
        if (!list) return;
        list.innerHTML = notifications.map((notification) => {
            const isReg = isRegistrationNotification(notification);
            const subject = isReg ? getSubjectUser(notification) : null;
            const isPending = subject && approvalState(subject) === 'PENDING';

            let rightSideActionsHtml = '';
            if (isReg && subject) {
                if (isPending) {
                    rightSideActionsHtml = `
                        <div class="flex items-center gap-1 shrink-0 ms-2" data-alert-actions>
                            <button type="button" data-alert-action="approve" data-user-id="${subject.id}" data-alert-id="${notification.id}" class="group cursor-pointer p-1.5 sm:p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition-colors" title="Approve registration">
                                <svg class="w-5 h-5 sm:w-6 sm:h-6 pointer-events-none group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
                                <svg class="hidden w-5 h-5 sm:w-6 sm:h-6 pointer-events-none group-hover:block" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm13.707-1.293a1 1 0 0 0-1.414-1.414L11 12.586l-1.793-1.793a1 1 0 0 0-1.414 1.414l2.5 2.5a1 1 0 0 0 1.414 0l4-4Z" clip-rule="evenodd"/></svg>
                            </button>
                            <button type="button" data-alert-action="decline" data-user-id="${subject.id}" data-alert-id="${notification.id}" class="group cursor-pointer p-1.5 sm:p-2 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition-colors" title="Decline registration">
                                <svg class="w-5 h-5 sm:w-6 sm:h-6 pointer-events-none group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 9-6 6m0-6 6 6m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
                                <svg class="hidden w-5 h-5 sm:w-6 sm:h-6 pointer-events-none group-hover:block" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm7.707-3.707a1 1 0 0 0-1.414 1.414L10.586 12l-2.293 2.293a1 1 0 1 0 1.414 1.414L12 13.414l2.293 2.293a1 1 0 0 0 1.414-1.414L13.414 12l2.293-2.293a1 1 0 0 0-1.414-1.414L12 10.586 9.707 8.293Z" clip-rule="evenodd"/></svg>
                            </button>
                        </div>`;
                } else if (approvalState(subject) === 'APPROVED') {
                    rightSideActionsHtml = '<span class="inline-flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800/50 shrink-0 ms-2">Approved</span>';
                } else if (approvalState(subject) === 'DECLINED') {
                    rightSideActionsHtml = '<span class="inline-flex items-center text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-800/50 shrink-0 ms-2">Declined</span>';
                }
            }

            return `
            <article data-alert-id="${notification.id}" class="group flex items-start gap-3 border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800 ${notification.is_read ? '' : 'border-l-4 border-l-blue-600 dark:border-l-blue-500'}">
                <input data-alert-select type="checkbox" value="${notification.id}" class="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800">
                <img src="${avatar(notification.actor || subject)}" alt="${esc(notification.actor?.full_name || notification.actor?.username || 'Portal activity')}" class="mt-0.5 h-10 w-10 shrink-0 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-gray-200 dark:border-gray-900 dark:ring-gray-700">
                <div class="min-w-0 flex-1 cursor-pointer" data-alert-open>
                    <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2">
                                <h2 class="truncate text-sm font-bold text-gray-900 dark:text-white">${esc(notification.title)}</h2>
                                ${notification.is_read ? '' : '<span class="h-2 w-2 shrink-0 rounded-full bg-blue-600 dark:bg-blue-500" aria-label="Unread"></span>'}
                            </div>
                            <p class="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">${esc(notification.message)}</p>
                        </div>
                        <div class="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                            <time class="shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500">${esc(formatDate(notification.created_at))}</time>
                        </div>
                    </div>
                </div>
                ${rightSideActionsHtml}
            </article>`;
        }).join('');
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
        // Handle inline Card Action buttons (Approve / Decline)
        const actionBtn = event.target.closest('[data-alert-action]');
        if (actionBtn) {
            event.stopPropagation();
            const action = actionBtn.dataset.alertAction;
            const targetUserId = Number(actionBtn.dataset.userId);
            const alertId = Number(actionBtn.dataset.alertId);
            if (action === 'approve') {
                await handleApproveStaff(targetUserId, alertId, actionBtn);
            } else if (action === 'decline') {
                await handleDeclineStaff(targetUserId, alertId, actionBtn);
            }
            return;
        }

        if (event.target.closest('input[type="checkbox"]')) return;

        const target = event.target.closest('[data-alert-open]');
        if (!target) return;
        const article = target.closest('[data-alert-id]');
        const notification = notifications.find((item) => Number(item.id) === Number(article?.dataset.alertId));
        if (!notification) return;

        if (!notification.is_read) {
            await markNotificationsRead([notification.id]);
            notification.is_read = true;
            article?.classList.remove('border-l-4', 'border-l-blue-600', 'dark:border-l-blue-500');
            article?.querySelector('[aria-label="Unread"]')?.remove();
        }

        // If it's a registration notification, open the modal with full user details
        if (isRegistrationNotification(notification)) {
            await openRegistrationDetailsModal(notification);
            return;
        }

        if (notification.action_url) {
            window.location.assign(notification.action_url);
        } else {
            await load();
        }
    });

    // View Toggler (Notifications vs Audit Logs)
    const btnToggleNotifs = document.getElementById('view-toggle-notifications');
    const btnToggleAudit = document.getElementById('view-toggle-audit');
    const notifsContainer = document.getElementById('notifications-view-container');
    const auditContainer = document.getElementById('audit-logs-view-container');
    const refreshAuditBtn = document.getElementById('btn-refresh-audit-logs');

    const setActiveView = (view) => {
        const isNotifs = view === 'notifications';
        if (notifsContainer) notifsContainer.classList.toggle('hidden', !isNotifs);
        if (auditContainer) auditContainer.classList.toggle('hidden', isNotifs);

        if (btnToggleNotifs) {
            if (isNotifs) {
                btnToggleNotifs.className = 'cursor-pointer inline-flex items-center gap-2 rounded-md bg-white px-3.5 py-1.5 text-xs font-bold text-gray-900 shadow-xs transition-all dark:bg-gray-800 dark:text-white';
            } else {
                btnToggleNotifs.className = 'cursor-pointer inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-all dark:text-gray-400 dark:hover:text-white';
            }
        }

        if (btnToggleAudit) {
            if (!isNotifs) {
                btnToggleAudit.className = 'cursor-pointer inline-flex items-center gap-2 rounded-md bg-white px-3.5 py-1.5 text-xs font-bold text-gray-900 shadow-xs transition-all dark:bg-gray-800 dark:text-white';
                void loadAuditLogs();
            } else {
                btnToggleAudit.className = 'cursor-pointer inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-all dark:text-gray-400 dark:hover:text-white';
            }
        }
    };

    btnToggleNotifs?.addEventListener('click', () => setActiveView('notifications'));
    btnToggleAudit?.addEventListener('click', () => setActiveView('audit'));
    refreshAuditBtn?.addEventListener('click', () => void loadAuditLogs());

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