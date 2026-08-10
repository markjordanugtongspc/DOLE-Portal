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
        });
    }

    imageModalInstance.show();
}

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
        unassignedSystemModalInstance = new Modal(modal, { placement: 'center', backdrop: 'dynamic', closable: true });
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
    modal.className = 'fixed inset-0 z-50 hidden h-full w-full overflow-y-auto overflow-x-hidden p-2 sm:p-4 md:inset-0';
    modal.innerHTML = `
        <div class="relative mx-auto my-2 w-full max-w-3xl sm:my-4 md:my-8">
            <div class="relative rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <div class="flex items-center justify-between rounded-t-xl border-b border-gray-200 p-3 dark:border-gray-700 sm:p-4 md:p-5">
                    <div>
                        <h2 class="text-lg font-extrabold text-gray-900 dark:text-white sm:text-xl">Settings</h2>
                        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Manage your Portal profile and security settings.</p>
                    </div>
                    <button type="button" data-settings-modal-close class="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white" aria-label="Close settings">
                        <svg class="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 14 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1l6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/></svg>
                    </button>
                </div>
                <form id="global-settings-form">
                    <div class="grid gap-4 p-3 sm:gap-5 sm:p-4 md:grid-cols-[180px_1fr] md:gap-6 md:p-6">
                        <div class="flex flex-col items-center gap-2 sm:gap-3">
                            <img id="settings-avatar-preview" class="h-24 w-24 rounded-full border-4 sm:h-28 sm:w-28 md:h-32 md:w-32 border-blue-100 object-cover shadow-sm dark:border-blue-900" alt="Profile avatar" />
                            <label for="settings-avatar-file" class="cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Change avatar</label>
                            <input id="settings-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" />
                            <p class="text-center text-[11px] text-gray-500 dark:text-gray-400">PNG, JPG, or WEBP<br />Maximum 3MB</p>
                        </div>
                        <div class="space-y-4 sm:space-y-5">
                            <div class="grid gap-3 sm:gap-4 sm:grid-cols-2">
                                ${settingsField('full_name', 'Full name', 'text', 'autocomplete="name" required maxlength="160"')}
                                ${settingsField('birthday', 'Birthday', 'date', 'autocomplete="bday"')}
                            </div>
                            <div class="grid gap-3 sm:gap-4 sm:grid-cols-2">
                                ${settingsField('username', 'Username', 'text', 'autocomplete="username" required maxlength="80"')}
                                ${settingsField('email', 'Email', 'email', 'autocomplete="email" required maxlength="180"')}
                            </div>
                            ${settingsField('phone', 'Phone number', 'tel', 'autocomplete="tel" maxlength="40"')}
                            <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                                <h3 class="text-sm font-extrabold text-amber-900 dark:text-amber-200">Change password</h3>
                                <p class="mt-1 text-xs text-amber-800 dark:text-amber-300">Leave all four fields empty to keep your current password.</p>
                                <div class="mt-3 grid gap-3 sm:mt-4 sm:gap-4 sm:grid-cols-2">
                                    ${settingsField('current_password', 'Current password', 'password', 'autocomplete="current-password" minlength="1"')}
                                    ${settingsField('current_password_confirm', 'Confirm current password', 'password', 'autocomplete="current-password" minlength="1"')}
                                    ${settingsField('new_password', 'New password', 'password', 'autocomplete="new-password" minlength="12" maxlength="256"')}
                                    ${settingsField('new_password_confirm', 'Confirm new password', 'password', 'autocomplete="new-password" minlength="12" maxlength="256"')}
                                </div>
                            </div>
                            <p id="settings-form-status" class="hidden rounded-lg p-3 text-sm font-semibold" role="alert"></p>
                        </div>
                    </div>
                    <div class="flex flex-col-reverse gap-2 rounded-b-xl border-t border-gray-200 p-3 dark:border-gray-700 sm:flex-row sm:justify-end sm:gap-3 md:p-6">
                        <button type="button" data-settings-modal-close class="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 sm:px-5 sm:py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
                        <button id="settings-save-button" type="submit" class="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 sm:px-5 sm:py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">Save settings</button>
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
    settingsModalInstance = new Modal(modal, { placement: 'center', backdrop: 'dynamic', closable: true });
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