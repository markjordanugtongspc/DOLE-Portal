/**
 * DOLE Portal â€” Centralized Modals System (Flowbite Integration)
 * Standardized image preview modal using Flowbite Modal and Tailwind CSS.
 */

import { Modal } from 'flowbite';
import { fetchCurrentProfile, updateCurrentProfile, uploadUserAvatar } from '@/backend/api/profile.api.js';

let imageModalInstance = null;
let currentPreviewUrl = '';

/**
 * Triggers a direct file download for an image URL.
 * @param {string} url
 * @param {string} filename
 */
export function downloadImageFile(url, filename = 'attachment-image.png') {
    if (!url) return;
    fetch(url)
        .then(res => res.blob())
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        })
        .catch(() => {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
}

/**
 * Show a clean, borderless large image preview pop-up modal using Flowbite Modal.
 * @param {string} imageUrl â€” URL of the image to display
 */
export function showImagePreviewModal(imageUrl) {
    if (!imageUrl) return;
    currentPreviewUrl = imageUrl;

    let modalEl = document.getElementById('flowbite-image-preview-modal');

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'flowbite-image-preview-modal';
        modalEl.tabIndex = -1;
        modalEl.className = 'hidden overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-[calc(100%-1rem)] max-h-full bg-black/80 backdrop-blur-md transition-all duration-300';
        modalEl.innerHTML = `
            <div class="relative p-2 w-full max-w-5xl max-h-full">
                <div class="relative bg-transparent rounded-2xl shadow-2xl overflow-hidden flex flex-col items-center">
                    <!-- Floating Top Right Action Controls Bar -->
                    <div class="absolute top-3 right-3 z-50 flex items-center gap-2">
                        <!-- Download Button -->
                        <button type="button" id="download-image-preview-modal-btn" class="cursor-pointer p-2 rounded-full bg-gray-900/80 hover:bg-gray-900 text-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-xs transition-colors shadow-lg" title="Download Image">
                            <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 13V4M7 14H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-2m-1-5-4 5-4-5m9 8h.01"/></svg>
                        </button>
                        <!-- Close Button -->
                        <button type="button" id="close-image-preview-modal-btn" class="cursor-pointer p-2 rounded-full bg-gray-900/80 hover:bg-gray-900 text-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-xs transition-colors shadow-lg" title="Close Preview">
                            <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                            </svg>
                            <span class="sr-only">Close modal</span>
                        </button>
                    </div>

                    <!-- Clean Borderless Image View -->
                    <div class="p-0 flex items-center justify-center w-full max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl">
                        <img id="image-preview-modal-img" src="${imageUrl}" class="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl" alt="Preview Image" />
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        document.getElementById('close-image-preview-modal-btn')?.addEventListener('click', () => {
            if (imageModalInstance) imageModalInstance.hide();
        });

        document.getElementById('download-image-preview-modal-btn')?.addEventListener('click', () => {
            if (currentPreviewUrl) downloadImageFile(currentPreviewUrl);
        });
    } else {
        const imgEl = document.getElementById('image-preview-modal-img');
        if (imgEl) imgEl.src = imageUrl;
    }

    if (!imageModalInstance) {
        imageModalInstance = new Modal(modalEl, {
            placement: 'center',
            backdrop: 'dynamic',
            closable: true,
            onShow: () => window.dispatchEvent(new CustomEvent('portal:modal-open')),
            onHide: () => window.dispatchEvent(new CustomEvent('portal:modal-close'))
        });
    }

    window.dispatchEvent(new CustomEvent('portal:modal-open'));
    imageModalInstance.show();
}

/* START ASSISTANT DETAILS VIEW MODAL */
let assistantDetailsModalInstance = null;

export function showAssistantDetailsModal(assistant = {}) {
    if (!assistant) return;

    let modalEl = document.getElementById('viewAssistantModal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'viewAssistantModal';
        modalEl.tabIndex = -1;
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.className = 'hidden overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-[calc(100%-1rem)] max-h-full';
        modalEl.innerHTML = `
            <div class="relative p-4 w-full max-w-md max-h-full">
                <div class="relative bg-white border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl dark:bg-gray-800 overflow-hidden">
                    <div class="bg-gradient-to-r from-blue-700 to-indigo-800 dark:from-blue-900 dark:to-indigo-950 p-6 flex flex-col items-center relative text-white">
                        <button type="button" class="absolute top-4 right-4 cursor-pointer text-white/80 hover:text-white bg-transparent hover:bg-white/10 rounded-lg text-sm w-8 h-8 flex justify-center items-center" data-modal-hide="viewAssistantModal">
                            <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 17.94 6M18 18 6.06 6"/></svg>
                            <span class="sr-only">Close modal</span>
                        </button>
                        <div class="relative mt-2">
                            <img id="view-avatar" class="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-md bg-white" src="${assistant.avatar || ''}" alt="Avatar">
                            <span id="view-online-dot" class="absolute -bottom-1 -right-1 w-5 h-5 ${assistant.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'} border-[3px] border-white dark:border-gray-800 rounded-full"></span>
                        </div>
                        <h3 id="view-name" class="text-lg font-extrabold mt-3 truncate max-w-full text-center">${assistant.name || ''}</h3>
                        <p id="view-email" class="text-xs text-blue-200 mt-0.5 truncate max-w-full text-center">${assistant.email || ''}</p>
                    </div>
                    <div class="p-6 space-y-4">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Access Level</span>
                            <span class="inline-flex items-center bg-gradient-to-r from-blue-800 to-blue-950 text-white dark:from-blue-500 dark:via-blue-600 dark:to-blue-400 font-semibold px-2 py-0.5 rounded text-[10px] select-none border-none">GIP Assistant</span>
                        </div>
                        <hr class="border-gray-100 dark:border-gray-700">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Username</span>
                                <span id="view-username" class="text-sm font-semibold text-gray-900 dark:text-white">${assistant.username || ''}</span>
                            </div>
                            <div>
                                <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone</span>
                                <span id="view-phone" class="text-sm font-semibold text-gray-900 dark:text-white">${assistant.phone || 'None'}</span>
                            </div>
                            <div class="col-span-2">
                                <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</span>
                                <span id="view-status" class="inline-flex items-center ${assistant.status === 'Active' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/40' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/40'} font-semibold px-2 py-0.5 rounded text-xs border mt-1 select-none">
                                    <span class="w-1.5 h-1.5 ${assistant.status === 'Active' ? 'bg-emerald-500 rounded-full animate-pulse' : 'bg-rose-500 rounded-full'} mr-1"></span>${assistant.status || 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-end px-6 py-4 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/20">
                        <button data-modal-hide="viewAssistantModal" type="button" class="cursor-pointer text-white bg-blue-700 hover:bg-blue-800 font-bold rounded-lg text-sm px-5 py-2.5 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors shadow-sm">
                            Close Details
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    } else {
        const viewAvatar = modalEl.querySelector('#view-avatar');
        const viewOnlineDot = modalEl.querySelector('#view-online-dot');
        const viewName = modalEl.querySelector('#view-name');
        const viewEmail = modalEl.querySelector('#view-email');
        const viewUsername = modalEl.querySelector('#view-username');
        const viewPhone = modalEl.querySelector('#view-phone');
        const viewStatus = modalEl.querySelector('#view-status');

        if (viewAvatar) viewAvatar.src = assistant.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(assistant.name || 'GIP')}&background=random`;
        if (viewName) viewName.textContent = assistant.name || '';
        if (viewEmail) viewEmail.textContent = assistant.email || '';
        if (viewUsername) viewUsername.textContent = assistant.username || '';
        if (viewPhone) viewPhone.textContent = assistant.phone || 'None';

        if (viewOnlineDot) {
            viewOnlineDot.className = `absolute -bottom-1 -right-1 w-5 h-5 ${assistant.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'} border-[3px] border-white dark:border-gray-800 rounded-full`;
        }
        if (viewStatus) {
            const badgeColor = assistant.status === 'Active' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/40' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/40';
            const dotColor = assistant.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500';
            viewStatus.className = `inline-flex items-center ${badgeColor} border font-semibold px-2 py-0.5 rounded text-xs mt-1 select-none`;
            viewStatus.innerHTML = `<span class="w-1.5 h-1.5 ${dotColor} rounded-full mr-1"></span>${assistant.status || 'Offline'}`;
        }
    }

    if (!assistantDetailsModalInstance) {
        assistantDetailsModalInstance = new Modal(modalEl, {
            placement: 'center',
            backdrop: 'dynamic',
            closable: true,
            onShow: () => window.dispatchEvent(new CustomEvent('portal:modal-open')),
            onHide: () => window.dispatchEvent(new CustomEvent('portal:modal-close'))
        });

        modalEl.querySelectorAll('[data-modal-hide="viewAssistantModal"]').forEach(btn => {
            btn.addEventListener('click', () => assistantDetailsModalInstance.hide());
        });
    }

    window.dispatchEvent(new CustomEvent('portal:modal-open'));
    assistantDetailsModalInstance.show();
}
/* END ASSISTANT DETAILS VIEW MODAL */

/* START UNASSIGNED EXTERNAL SYSTEM MODAL */
let unassignedSystemModalInstance = null;
let unassignedSystemCountdownTimer = null;

export const showUnassignedSystemModal = ({ systemName = 'This system', url = '', openInNewTab = false } = {}) => {
    const targetUrl = String(url || '').trim();
    const canOpenTarget = /^https?:\/\//i.test(targetUrl);
    if (!canOpenTarget) {
        window.DEBUG?.warn('EXTERNALS', 'System link is unavailable for an unassigned account.', { systemName });
        return false;
    }

    let modal = document.getElementById('unassigned-system-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'unassigned-system-modal';
        modal.tabIndex = -1;
        modal.className = 'fixed inset-0 z-[90] hidden h-full w-full items-center justify-center overflow-y-auto overflow-x-hidden p-4';
        modal.innerHTML = `
            <div class="relative w-full max-w-md">
                <div class="relative rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
                    <div class="flex items-start justify-between border-b border-gray-200 p-5 dark:border-gray-700">
                        <div>
                            <h2 id="unassigned-system-modal-title" class="text-lg font-extrabold text-gray-900 dark:text-white">System account not assigned</h2>
                            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">External system access notice</p>
                        </div>
                        <button type="button" data-unassigned-system-close class="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white" aria-label="Close notice">
                            <svg class="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 14 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1l6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/></svg>
                        </button>
                    </div>
                    <div class="p-5">
                        <p id="unassigned-system-modal-message" class="text-sm leading-relaxed text-gray-600 dark:text-gray-300"></p>
                        <p id="unassigned-system-modal-countdown" class="mt-4 rounded-lg bg-blue-50 p-3 text-center text-sm font-bold text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"></p>
                    </div>
                    <div class="flex flex-col-reverse gap-3 border-t border-gray-200 p-5 sm:flex-row sm:justify-end dark:border-gray-700">
                        <button type="button" data-unassigned-system-close class="cursor-pointer rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
                        <button type="button" data-unassigned-system-open class="cursor-pointer rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700">Open now</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
        unassignedSystemModalInstance = new Modal(modal, {
            placement: 'center',
            backdrop: 'dynamic',
            closable: true,
            onShow: () => window.dispatchEvent(new CustomEvent('portal:modal-open')),
            onHide: () => window.dispatchEvent(new CustomEvent('portal:modal-close'))
        });
    }

    const message = modal.querySelector('#unassigned-system-modal-message');
    const countdown = modal.querySelector('#unassigned-system-modal-countdown');
    const openButton = modal.querySelector('[data-unassigned-system-open]');
    let remaining = 3;
    let cancelled = false;
    const openTarget = () => {
        if (cancelled) return;
        window.clearInterval(unassignedSystemCountdownTimer);
        document.activeElement?.blur();
        unassignedSystemModalInstance?.hide();
        if (openInNewTab) window.open(targetUrl, '_blank', 'noopener,noreferrer');
        else window.location.href = targetUrl;
    };
    const closeModal = () => {
        cancelled = true;
        window.clearInterval(unassignedSystemCountdownTimer);
        document.activeElement?.blur();
        unassignedSystemModalInstance?.hide();
    };

    message.textContent = `${systemName} is not yet assigned to your Portal account. Please register in this system or contact an administrator to get assigned.`;
    countdown.textContent = `Opening ${systemName} in ${remaining} seconds...`;
    openButton.onclick = openTarget;
    modal.querySelectorAll('[data-unassigned-system-close]').forEach((button) => { button.onclick = closeModal; });
    window.dispatchEvent(new CustomEvent('portal:modal-open'));
    unassignedSystemModalInstance?.show();
    unassignedSystemCountdownTimer = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) return openTarget();
        countdown.textContent = `Opening ${systemName} in ${remaining} seconds...`;
    }, 1000);
    return true;
};
/* END UNASSIGNED EXTERNAL SYSTEM MODAL */
/* START GLOBAL SETTINGS MODAL */
let settingsModalInstance = null;
let settingsProfile = null;
let settingsAvatarFile = null;

const escapeSettingsHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const settingsAvatarFallback = (user = {}) => {
    const profile = user || {};
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || profile.username || 'User')}&background=DBEAFE&color=1D4ED8&bold=true`;
};

const settingsField = (id, label, type = 'text', extra = '') => `
    <div>
        <label for="${id}" class="mb-1 block text-xs font-bold sm:mb-1.5 uppercase tracking-wide text-gray-700 dark:text-gray-300">${label}</label>
        <input id="${id}" name="${id}" type="${type}" placeholder="Enter ${label.toLowerCase()}" ${extra} class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2 sm:p-2.5 text-sm text-gray-900 focus:border-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
    </div>`;

const createSettingsModal = () => {
    if (document.getElementById('global-settings-modal')) return document.getElementById('global-settings-modal');
    const modal = document.createElement('div');
    modal.id = 'global-settings-modal';
    modal.tabIndex = -1;
    modal.setAttribute('aria-hidden', 'true');
    modal.className = 'fixed inset-0 z-50 hidden h-full w-full overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:inset-0';
    modal.innerHTML = `
        <div class="relative mx-auto my-3 w-full max-w-sm sm:max-w-xl md:max-w-3xl sm:my-4 md:my-8">
            <div class="relative rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <!-- Modal Header with image bg accent -->
                <div class="flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-3 dark:border-gray-700 sm:p-4">
                    <div>
                        <h2 class="text-base font-extrabold text-white sm:text-lg">Profile Settings</h2>
                        <p class="mt-0.5 text-[11px] text-blue-200/80">Manage your profile and security settings.</p>
                    </div>
                    <button type="button" data-settings-modal-close class="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close settings">
                        <svg class="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 14 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1l6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/></svg>
                    </button>
                </div>
                <form id="global-settings-form">
                    <div class="p-3 sm:p-4 md:p-6">
                        <!-- Avatar + Profile Info Row (compact on mobile) -->
                        <div class="flex items-center gap-3 mb-4 sm:mb-5">
                            <div class="relative shrink-0">
                                <img id="settings-avatar-preview" class="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-4 border-blue-100 object-cover shadow-sm dark:border-blue-900" alt="Profile avatar" />
                            </div>
                            <div class="flex flex-col gap-1 min-w-0">
                                <label for="settings-avatar-file" class="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 w-fit">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                                    Change Avatar
                                </label>
                                <input id="settings-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" />
                                <p class="text-[10px] text-gray-400 dark:text-gray-500">PNG, JPG, WEBP &bull; Max 3MB</p>
                            </div>
                        </div>

                        <!-- Fields Grid -->
                        <div class="space-y-3 sm:space-y-4">
                            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                ${settingsField('full_name', 'Full Name', 'text', 'autocomplete="name" required maxlength="160"')}
                                ${settingsField('birthday', 'Birthday', 'date', 'autocomplete="bday"')}
                            </div>
                            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                ${settingsField('username', 'Username', 'text', 'autocomplete="username" required maxlength="80"')}
                                ${settingsField('email', 'Email', 'email', 'autocomplete="email" required maxlength="180"')}
                            </div>
                            ${settingsField('phone', 'Phone Number', 'tel', 'autocomplete="tel" maxlength="40"')}

                            <!-- Change Password Section -->
                            <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                                <h3 class="text-xs font-extrabold text-amber-900 dark:text-amber-200">Change Password</h3>
                                <p class="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">Leave all four fields empty to keep your current password.</p>
                                <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    ${settingsField('current_password', 'Current Password', 'password', 'autocomplete="current-password" minlength="1"')}
                                    ${settingsField('current_password_confirm', 'Confirm Current', 'password', 'autocomplete="current-password" minlength="1"')}
                                    ${settingsField('new_password', 'New Password', 'password', 'autocomplete="new-password" minlength="12" maxlength="256"')}
                                    ${settingsField('new_password_confirm', 'Confirm New', 'password', 'autocomplete="new-password" minlength="12" maxlength="256"')}
                                </div>
                            </div>

                            <p id="settings-form-status" class="hidden rounded-lg p-2.5 text-xs font-semibold" role="alert"></p>
                        </div>
                    </div>

                    <!-- Footer Actions -->
                    <div class="flex flex-col-reverse gap-2 rounded-b-xl border-t border-gray-200 p-3 dark:border-gray-700 sm:flex-row sm:justify-end sm:gap-3 sm:p-4">
                        <button type="button" data-settings-modal-close class="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
                        <button id="settings-save-button" type="submit" class="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">Save Settings</button>
                    </div>
                </form>
            </div>
        </div>`;
    document.body.appendChild(modal);
    return modal;
};

const setSettingsStatus = (message = '', type = 'error') => {
    const el = document.getElementById('settings-form-status');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('hidden', !message);
    el.className = `${el.className.replace(/text-(red|emerald)-\d+|bg-(red|emerald)-\d+\/\d+|border-(red|emerald)-\d+/g, '')} ${type === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'}`;
};

const populateSettings = (user) => {
    settingsProfile = user;
    ['full_name', 'birthday', 'username', 'email', 'phone'].forEach((field) => {
        const input = document.getElementById(field) || document.getElementById(`settings-${field}`);
        if (input) input.value = user?.[field] || '';
    });
    const preview = document.getElementById('settings-avatar-preview');
    if (preview) preview.src = user?.avatar_url || settingsAvatarFallback(user);
};

export const initSettingsModal = () => {
    // START SETTINGS MODAL TRIGGER WIRING
    // The sidebar is injected asynchronously, so delegated handling is required.
    if (document.documentElement.dataset.settingsModalWired === 'true') return;
    document.documentElement.dataset.settingsModalWired = 'true';

    const modal = createSettingsModal();
    settingsModalInstance = new Modal(modal, {
        placement: 'center',
        backdrop: 'dynamic',
        closable: true,
        onShow: () => window.dispatchEvent(new CustomEvent('portal:modal-open')),
        onHide: () => window.dispatchEvent(new CustomEvent('portal:modal-close'))
    });
    modal.querySelectorAll('[data-settings-modal-close]').forEach((button) => {
        button.addEventListener('click', () => {
            document.activeElement?.blur();
            settingsModalInstance?.hide();
        });
    });
    document.getElementById('settings-avatar-file')?.addEventListener('change', (event) => {
        settingsAvatarFile = event.target.files?.[0] || null;
        if (settingsAvatarFile) document.getElementById('settings-avatar-preview').src = URL.createObjectURL(settingsAvatarFile);
    });
    document.getElementById('global-settings-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const saveButton = document.getElementById('settings-save-button');
        const data = Object.fromEntries(new FormData(form).entries());
        const passwordFields = ['current_password', 'current_password_confirm', 'new_password', 'new_password_confirm'];
        const hasPasswordInput = passwordFields.some((field) => data[field]);
        if (hasPasswordInput && data.current_password !== data.current_password_confirm) return setSettingsStatus('Current password and confirmation must match.');
        if (hasPasswordInput && data.new_password !== data.new_password_confirm) return setSettingsStatus('New password and confirmation must match.');
        if (hasPasswordInput && String(data.new_password || '').length < 12) return setSettingsStatus('The new password must be at least 12 characters long.');
        saveButton.disabled = true;
        setSettingsStatus('Saving your settings...', 'success');
        if (settingsAvatarFile) {
            const upload = await uploadUserAvatar(settingsAvatarFile, settingsProfile?.id);
            if (upload.error) { saveButton.disabled = false; return setSettingsStatus(upload.error); }
            data.avatar_url = upload.url;
        } else {
            data.avatar_url = settingsProfile?.avatar_url || null;
        }
        const result = await updateCurrentProfile(data);
        saveButton.disabled = false;
        if (result.error) return setSettingsStatus(result.error);
        populateSettings(result.data);
        settingsAvatarFile = null;
        setSettingsStatus('Settings saved successfully.', 'success');
        window.setTimeout(() => {
            document.activeElement?.blur();
            settingsModalInstance?.hide();
        }, 700);
    });

    document.addEventListener('click', async (event) => {
        const trigger = event.target.closest('[data-settings-modal-open], #sidebar-profile-settings-btn');
        if (!trigger) return;
        event.preventDefault();
        trigger.blur();
        window.DEBUG?.event('SETTINGS', 'Settings modal trigger clicked', { id: trigger.id || null });
        settingsAvatarFile = null;
        setSettingsStatus('Loading your profile...', 'success');
        settingsModalInstance.show();
        const result = await fetchCurrentProfile();
        if (result.error || !result.data) return setSettingsStatus(result.error || 'Unable to load your profile.');
        populateSettings(result.data);
        setSettingsStatus('');
    }, true);
    // END SETTINGS MODAL TRIGGER WIRING
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSettingsModal);
else initSettingsModal();
/* END GLOBAL SETTINGS MODAL */