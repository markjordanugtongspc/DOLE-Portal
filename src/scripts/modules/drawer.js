import { fetchSystems, createSystem, updateSystem, archiveSystem, restoreSystem, uploadSystemImage } from '@/backend/api/systems.api.js';
import { supabase } from '@/backend/api/supabase.js';

/* START initDrawer FUNCTIONALITY - Initializes manual mobile login drawer behaviors and toggles */
const initDrawer = () => {
    if (window.DEBUG) {
        window.DEBUG.log('DRAWER', 'Initializing manual mobile login drawer...');
    }

    const drawerEl = document.getElementById('login-drawer');
    const backdropEl = document.getElementById('drawer-backdrop');
    const heroEl = document.getElementById('mobile-hero-content');
    const drawerHeroEl = document.getElementById('mobile-drawer-hero-text');
    const showBtn = document.getElementById('show-login-drawer');
    const hideBtn = document.getElementById('hide-login-drawer');

    if (window.DEBUG) {
        window.DEBUG.log('DRAWER', 'DOM elements parsed status:', {
            drawerExists: !!drawerEl,
            backdropExists: !!backdropEl,
            heroExists: !!heroEl,
            drawerHeroExists: !!drawerHeroEl,
            showBtnExists: !!showBtn,
            hideBtnExists: !!hideBtn
        });
    }

    /* START showDrawer FUNCTIONALITY - Opens mobile login drawer and reveals backdrop */
    const showDrawer = () => {
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Action: Opening drawer...');
        if (drawerEl) {
            drawerEl.classList.remove('translate-y-full');
            drawerEl.classList.add('translate-y-0');
        }
        if (backdropEl) {
            backdropEl.classList.remove('hidden');
        }
        if (heroEl) {
            heroEl.classList.add('hidden');
        }
        if (drawerHeroEl) {
            drawerHeroEl.classList.remove('hidden');
        }

        window.dispatchEvent(new CustomEvent('portal:drawer-open'));
        if (window.DEBUG) window.DEBUG.success('DRAWER', 'Drawer opened.');
    };
    /* END showDrawer FUNCTIONALITY */

    /* START hideDrawer FUNCTIONALITY - Closes mobile login drawer and hides backdrop */
    const hideDrawer = () => {
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Action: Closing drawer...');
        if (drawerEl) {
            drawerEl.classList.remove('translate-y-0');
            drawerEl.classList.add('translate-y-full');
        }
        if (backdropEl) {
            backdropEl.classList.add('hidden');
        }
        if (heroEl) {
            heroEl.classList.remove('hidden');
        }
        if (drawerHeroEl) {
            drawerHeroEl.classList.add('hidden');
        }

        window.dispatchEvent(new CustomEvent('portal:drawer-close'));
        if (window.DEBUG) window.DEBUG.success('DRAWER', 'Drawer closed.');
    };
    /* END hideDrawer FUNCTIONALITY */

    if (showBtn) {
        showBtn.addEventListener('click', showDrawer);
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Trigger click event bound to Get Started.');
    }
    if (hideBtn) {
        hideBtn.addEventListener('click', hideDrawer);
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Trigger click event bound to Close Button.');
    }
    if (backdropEl) {
        backdropEl.addEventListener('click', hideDrawer);
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Trigger click event bound to Backdrop.');
    }
};
/* END initDrawer FUNCTIONALITY */

// Robust readyState check to avoid DOMContentLoaded race conditions in ES modules
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDrawer);
} else {
    initDrawer();
}

/* START initSystemsManager FUNCTIONALITY - Main manager for systems CRUD, inline confirmation toggles, and undo snackbars */
const initSystemsManager = () => {
    const gridEl = document.getElementById('systems-grid');
    if (!gridEl) return;

    if (window.DEBUG) {
        window.DEBUG.log('SYSTEMS', 'Initializing backend systems manager...');
    }

    const formEl = document.getElementById('system-form');
    const nameInput = document.getElementById('system-name');
    const descInput = document.getElementById('system-desc');
    const urlInput = document.getElementById('system-url');
    const idInput = document.getElementById('system-id');
    const drawerTitle = document.getElementById('drawer-title-mode');
    const submitBtnText = document.getElementById('btn-submit-text');
    const addBtn = document.getElementById('btn-add-system');
    const sortAllBtn = document.getElementById('btn-systems-sort-all');
    const archivedBtn = document.getElementById('btn-systems-archived');
    const closeBtn = document.getElementById('close-drawer-btn');
    const colorInput = document.getElementById('system-color');
    const imageInput = document.getElementById('system-image');
    const dropzoneContent = document.getElementById('dropzone-content');
    const imagePreview = document.getElementById('system-image-preview');
    const imageChangeOverlay = document.getElementById('image-change-overlay');
    const imageErrorMsg = document.getElementById('image-error-msg');
    const submitBtn = formEl?.querySelector('button[type="submit"]');
    const drawerEl = document.getElementById('add-system-drawer');
    const mainContent = document.getElementById('main-content');

    let systems = [];
    let selectedImageFile = null;
    let isSaving = false;
    let suppressNextGridClick = false;
    let viewMode = 'all';
    let activeConfirm = null; // { id: string, action: 'archive' | 'restore' }

    /* START escapeHtml FUNCTIONALITY - Escapes special characters to avoid XSS vulnerabilities */
    const escapeHtml = (value = '') => String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    /* END escapeHtml FUNCTIONALITY */

    // Active notification stacks for deck layering
    const activeToastStack = [];
    const activeSnackbarTopStack = [];
    const activeSnackbarBottomStack = [];

    /* START updateToastStackView FUNCTIONALITY - Updates 3D-like stacked deck transform and opacity for toasts */
    const updateToastStackView = () => {
        activeToastStack.forEach((item, index) => {
            const el = item.el;
            if (!el || !el.isConnected) return;
            el.style.zIndex = String(50 - index);

            if (index === 0) {
                // Front active toast
                el.style.transform = 'translateY(0px) scale(1)';
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
                el.style.filter = 'none';
            } else if (index === 1) {
                // 1st card peeking behind
                el.style.transform = 'translateY(-16px) scale(0.96)';
                el.style.opacity = '0.95';
                el.style.pointerEvents = 'auto';
                el.style.filter = 'brightness(0.96)';
            } else if (index === 2) {
                // 2nd card peeking behind
                el.style.transform = 'translateY(-30px) scale(0.92)';
                el.style.opacity = '0.88';
                el.style.pointerEvents = 'auto';
                el.style.filter = 'brightness(0.92)';
            } else if (index === 3) {
                // 3rd card peeking behind
                el.style.transform = 'translateY(-42px) scale(0.88)';
                el.style.opacity = '0.75';
                el.style.pointerEvents = 'auto';
                el.style.filter = 'brightness(0.88)';
            } else {
                // Deeper cards hidden
                el.style.transform = 'translateY(-52px) scale(0.84)';
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
            }
        });
    };
    /* END updateToastStackView FUNCTIONALITY */

    /* START updateSnackbarStackView FUNCTIONALITY - Updates 3D-like stacked deck transform and opacity for snackbars */
    const updateSnackbarStackView = (position = 'top-center') => {
        const stack = position === 'bottom-center' ? activeSnackbarBottomStack : activeSnackbarTopStack;
        const isBottom = position === 'bottom-center';

        stack.forEach((item, index) => {
            const el = item.el;
            if (!el || !el.isConnected) return;
            el.style.zIndex = String(50 - index);

            if (index === 0) {
                // Front active snackbar
                el.style.transform = 'translateY(0px) scale(1)';
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
                el.style.filter = 'none';
            } else if (index === 1) {
                // 1st card peeking behind
                el.style.transform = isBottom ? 'translateY(-16px) scale(0.96)' : 'translateY(16px) scale(0.96)';
                el.style.opacity = '0.95';
                el.style.pointerEvents = 'auto';
                el.style.filter = 'brightness(0.96)';
            } else if (index === 2) {
                // 2nd card peeking behind
                el.style.transform = isBottom ? 'translateY(-30px) scale(0.92)' : 'translateY(30px) scale(0.92)';
                el.style.opacity = '0.88';
                el.style.pointerEvents = 'auto';
                el.style.filter = 'brightness(0.92)';
            } else {
                // Deeper cards hidden
                el.style.transform = isBottom ? 'translateY(-42px) scale(0.88)' : 'translateY(42px) scale(0.88)';
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
            }
        });
    };
    /* END updateSnackbarStackView FUNCTIONALITY */

    /* START getSnackbarContainer FUNCTIONALITY - Creates or returns grid snackbar container based on position */
    const getSnackbarContainer = (position = 'top-center') => {
        const id = position === 'bottom-center' ? 'systems-snackbar-container-bottom' : 'systems-snackbar-container-top';
        let container = document.getElementById(id);
        if (container) return container;

        container = document.createElement('div');
        container.id = id;
        container.className = position === 'bottom-center'
            ? 'fixed z-[100] bottom-5 left-1/2 -translate-x-1/2 grid grid-cols-1 grid-rows-1 items-end justify-items-center pointer-events-none w-[calc(100%-2rem)] max-w-sm sm:max-w-md md:max-w-lg'
            : 'fixed z-[100] top-5 left-1/2 -translate-x-1/2 grid grid-cols-1 grid-rows-1 items-start justify-items-center pointer-events-none w-[calc(100%-2rem)] max-w-sm sm:max-w-md md:max-w-lg';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
        return container;
    };
    /* END getSnackbarContainer FUNCTIONALITY */

    /* START showSnackbar FUNCTIONALITY - Displays stacked snackbar notification at bottom-center with 5.5s auto-close, click-to-front and undo callback */
    const showSnackbar = ({ type = 'success', position = 'bottom-center', message = '', onUndo = null, duration = 5500 } = {}) => {
        const icons = {
            success: `<div class="inline-flex items-center justify-center shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-none stroke-current" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                </svg>
            </div>`,
            danger: `<div class="inline-flex items-center justify-center shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 shadow-xs">
                <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-none stroke-current" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                </svg>
            </div>`,
            warning: `<div class="inline-flex items-center justify-center shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 shadow-xs">
                <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-none stroke-current" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/>
                </svg>
            </div>`
        };

        const iconHtml = icons[type] || icons.success;
        const container = getSnackbarContainer(position);
        const stack = position === 'bottom-center' ? activeSnackbarBottomStack : activeSnackbarTopStack;
        const isBottom = position === 'bottom-center';

        const snackbar = document.createElement('div');
        snackbar.className = `snackbar-item col-start-1 row-start-1 w-full pointer-events-auto cursor-pointer flex items-center justify-between gap-3 p-3 sm:p-3.5 bg-stone-100 dark:bg-gray-900 text-gray-900 dark:text-white backdrop-blur-md border border-stone-300 dark:border-gray-700/90 rounded-xl shadow-2xl transition-all duration-300 ease-out ${isBottom ? 'origin-bottom' : 'origin-top'} opacity-0 select-none`;
        snackbar.setAttribute('role', 'alert');

        snackbar.innerHTML = `
            <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                ${iconHtml}
                <p class="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 break-words leading-snug">${escapeHtml(message)}</p>
            </div>
            <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
                ${onUndo ? `
                    <button type="button" class="btn-snackbar-undo cursor-pointer text-xs sm:text-sm font-bold text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 underline underline-offset-2 transition-colors px-1 select-none whitespace-nowrap">
                        Undo
                    </button>
                ` : ''}
                <button type="button" class="btn-snackbar-close cursor-pointer text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1 sm:p-1.5 rounded-lg transition-colors" aria-label="Close snackbar">
                    <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-current" fill="none" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;

        const itemRecord = { el: snackbar, timeout: null };
        stack.unshift(itemRecord);

        /* START removeSnackbar FUNCTIONALITY - Dismisses snackbar and steps stacked cards forward */
        const removeSnackbar = () => {
            if (itemRecord.timeout) clearTimeout(itemRecord.timeout);
            snackbar.classList.add('opacity-0', isBottom ? 'translate-y-3' : '-translate-y-3', 'scale-95');
            window.setTimeout(() => {
                snackbar.remove();
                const idx = stack.indexOf(itemRecord);
                if (idx !== -1) stack.splice(idx, 1);
                updateSnackbarStackView(position);
            }, 250);
        };
        /* END removeSnackbar FUNCTIONALITY */

        // Clicking a card behind brings it to the front
        snackbar.addEventListener('click', (e) => {
            if (e.target.closest('.btn-snackbar-close') || e.target.closest('.btn-snackbar-undo')) return;
            const currentIdx = stack.indexOf(itemRecord);
            if (currentIdx > 0) {
                stack.splice(currentIdx, 1);
                stack.unshift(itemRecord);
                updateSnackbarStackView(position);
            }
        });

        snackbar.querySelector('.btn-snackbar-close')?.addEventListener('click', (e) => {
            e.stopPropagation();
            removeSnackbar();
        });

        if (onUndo) {
            snackbar.querySelector('.btn-snackbar-undo')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                removeSnackbar();
                try {
                    await onUndo();
                } catch (err) {
                    if (window.DEBUG) window.DEBUG.error('SNACKBAR', 'Undo execution failed', err);
                }
            });
        }

        container.appendChild(snackbar);
        updateSnackbarStackView(position);

        itemRecord.timeout = window.setTimeout(removeSnackbar, duration);
    };
    /* END showSnackbar FUNCTIONALITY */

    /* START getToastContainer FUNCTIONALITY - Creates or returns responsive grid toast container (bottom-center on mobile, bottom-right on desktop) */
    const getToastContainer = () => {
        let container = document.getElementById('systems-toast-container-br');
        if (container) return container;

        container = document.createElement('div');
        container.id = 'systems-toast-container-br';
        container.className = 'fixed z-[100] bottom-5 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-5 w-[calc(100%-2rem)] max-w-xs sm:max-w-sm grid grid-cols-1 grid-rows-1 items-end justify-items-center md:justify-items-end pointer-events-none transition-all duration-300';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
        return container;
    };
    /* END getToastContainer FUNCTIONALITY */

    /* START showToast FUNCTIONALITY - Displays stacked toast notification with 5.5s auto-close and click-to-front */
    const showToast = ({ type = 'success', title = '', message = '', duration = 5500 } = {}) => {
        const icons = {
            success: `<div class="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-teal-500/10 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 border border-teal-500/30 dark:border-teal-700/50 shadow-inner">
                <svg class="w-4 h-4 fill-none stroke-current" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                </svg>
            </div>`,
            danger: `<div class="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-rose-500/10 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-500/30 dark:border-rose-700/50 shadow-inner">
                <svg class="w-4 h-4 fill-none stroke-current" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                </svg>
            </div>`,
            warning: `<div class="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-amber-500/10 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-500/30 dark:border-amber-700/50 shadow-inner">
                <svg class="w-4 h-4 fill-none stroke-current" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/>
                </svg>
            </div>`
        };

        const iconHtml = icons[type] || icons.success;
        const container = getToastContainer();

        const toast = document.createElement('div');
        toast.className = 'toast-item col-start-1 row-start-1 w-full pointer-events-auto cursor-pointer flex items-start gap-3 p-3.5 sm:p-4 bg-stone-100 dark:bg-gray-900 text-gray-900 dark:text-white backdrop-blur-md border border-stone-300 dark:border-gray-700 rounded-none shadow-2xl transition-all duration-300 ease-out origin-bottom opacity-0 select-none';
        toast.setAttribute('role', 'alert');

        const defaultTitle = type === 'success' ? 'SUCCESS' : type === 'danger' ? 'ERROR' : 'NOTICE';
        const displayTitle = title || defaultTitle;

        toast.innerHTML = `
            ${iconHtml}
            <div class="flex-1 min-w-0 pt-0.5">
                <h4 class="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white mb-0.5">${escapeHtml(displayTitle)}</h4>
                <p class="text-xs font-medium text-gray-600 dark:text-gray-300 break-words leading-relaxed">${escapeHtml(message)}</p>
            </div>
            <button type="button" class="btn-toast-close cursor-pointer text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 hover:bg-stone-200 dark:hover:bg-gray-800 transition-colors" aria-label="Close toast">
                <svg class="w-3.5 h-3.5 stroke-current" fill="none" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                </svg>
            </button>
        `;

        const itemRecord = { el: toast, timeout: null };
        activeToastStack.unshift(itemRecord);

        /* START removeToast FUNCTIONALITY - Dismisses toast and steps stacked cards forward */
        const removeToast = () => {
            if (itemRecord.timeout) clearTimeout(itemRecord.timeout);
            toast.classList.add('opacity-0', 'translate-y-3', 'scale-95');
            window.setTimeout(() => {
                toast.remove();
                const idx = activeToastStack.indexOf(itemRecord);
                if (idx !== -1) activeToastStack.splice(idx, 1);
                updateToastStackView();
            }, 250);
        };
        /* END removeToast FUNCTIONALITY */

        // Clicking a card behind brings it to the front
        toast.addEventListener('click', (e) => {
            if (e.target.closest('.btn-toast-close')) return;
            const currentIdx = activeToastStack.indexOf(itemRecord);
            if (currentIdx > 0) {
                activeToastStack.splice(currentIdx, 1);
                activeToastStack.unshift(itemRecord);
                updateToastStackView();
            }
        });

        toast.querySelector('.btn-toast-close')?.addEventListener('click', (e) => {
            e.stopPropagation();
            removeToast();
        });

        container.appendChild(toast);
        updateToastStackView();

        itemRecord.timeout = window.setTimeout(removeToast, duration);
    };
    /* END showToast FUNCTIONALITY */

    /* START normalizeSystem FUNCTIONALITY - Normalizes database system row into UI model */
    const normalizeSystem = (system) => {
        const systemUrl = system.system_url?.trim() || '';

        return {
            id: String(system.id),
            title: system.title || 'Untitled System',
            description: system.description || 'No description provided.',
            systemUrl: systemUrl === '#' ? '' : systemUrl,
            color: system.color || '#3b82f6',
            imageUrl: system.image_url || '/src/assets/images/slider/default.png',
            createdAt: system.created_at || null,
            archivedAt: system.archived_at || null,
            isActive: typeof system.is_active === 'boolean' ? system.is_active : true
        };
    };
    /* END normalizeSystem FUNCTIONALITY */

    /* START isDrawerOpen FUNCTIONALITY - Checks if the right-side add/edit drawer is open */
    const isDrawerOpen = () => drawerEl && !drawerEl.classList.contains('translate-x-full');
    /* END isDrawerOpen FUNCTIONALITY */

    /* START setImagePreview FUNCTIONALITY - Sets or clears preview inside drawer image dropzone */
    const setImagePreview = (src = '') => {
        if (!imagePreview) return;

        if (src) {
            imagePreview.src = src;
            imagePreview.classList.remove('hidden');
            dropzoneContent?.classList.add('hidden');
            imageChangeOverlay?.classList.remove('hidden');
        } else {
            imagePreview.removeAttribute('src');
            imagePreview.classList.add('hidden');
            dropzoneContent?.classList.remove('hidden');
            imageChangeOverlay?.classList.add('hidden');
        }
    };
    /* END setImagePreview FUNCTIONALITY */

    /* START resetForm FUNCTIONALITY - Resets system form to default pristine state */
    const resetForm = () => {
        formEl?.reset();
        if (idInput) idInput.value = '';
        if (colorInput) colorInput.value = '#10b981';
        if (drawerTitle) drawerTitle.textContent = 'Add New System';
        if (submitBtnText) submitBtnText.textContent = 'Add System';
        if (imageInput) imageInput.value = '';
        if (imageErrorMsg) imageErrorMsg.classList.add('hidden');
        selectedImageFile = null;
        setImagePreview('');
    };
    /* END resetForm FUNCTIONALITY */

    /* START setPageScrollLock FUNCTIONALITY - Disables page scrolling when modal or drawer is open */
    const setPageScrollLock = (locked) => {
        document.body.classList.toggle('overflow-hidden', Boolean(locked));
    };
    /* END setPageScrollLock FUNCTIONALITY */

    /* START forceCloseDrawer FUNCTIONALITY - Forces drawer to close and removes UI blur filters */
    const forceCloseDrawer = () => {
        if (!drawerEl) return;
        drawerEl.classList.add('translate-x-full');
        drawerEl.classList.remove('transform-none');
        drawerEl.setAttribute('aria-hidden', 'true');
        mainContent?.classList.remove('blur-[2px]');
        setPageScrollLock(false);
        gridEl.classList.remove('pointer-events-none');
        const sidebar = document.getElementById('default-sidebar');
        if (sidebar) {
            sidebar.classList.remove('blur-[2px]', 'pointer-events-none');
            sidebar.style.zIndex = '';
        }
    };
    /* END forceCloseDrawer FUNCTIONALITY */

    /* START openDrawer FUNCTIONALITY - Handles opening the right drawer smoothly */
    const openDrawer = () => {
        if (!drawerEl) return;
        drawerEl.classList.remove('translate-x-full');
        drawerEl.classList.add('transform-none');
        drawerEl.setAttribute('aria-hidden', 'false');
        setPageScrollLock(true);
    };
    /* END openDrawer FUNCTIONALITY */

    /* START closeDrawer FUNCTIONALITY - Handles closing the right drawer gracefully */
    const closeDrawer = () => {
        if (closeBtn) {
            closeBtn.click();
            return;
        }
        if (drawerEl) {
            drawerEl.classList.add('translate-x-full');
            drawerEl.classList.remove('transform-none');
            drawerEl.setAttribute('aria-hidden', 'true');
            setPageScrollLock(false);
        }
    };
    /* END closeDrawer FUNCTIONALITY */

    /* START renderSkeletons FUNCTIONALITY - Renders placeholder pulse skeletons during load */
    const renderSkeletons = () => {
        gridEl.innerHTML = Array.from({ length: 4 }).map(() => `
            <div role="status" class="min-h-[320px] rounded-base overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 animate-pulse">
                <div class="h-40 bg-gray-200 dark:bg-gray-700"></div>
                <div class="p-6">
                    <div class="h-5 w-2/3 rounded-full bg-gray-200 dark:bg-gray-700 mb-4"></div>
                    <div class="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700 mb-2"></div>
                    <div class="h-3 w-4/5 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                </div>
                <span class="sr-only">Loading systems...</span>
            </div>
        `).join('');
    };
    /* END renderSkeletons FUNCTIONALITY */

    /* START renderError FUNCTIONALITY - Renders inline error state in systems grid */
    const renderError = (message) => {
        gridEl.innerHTML = `
            <div class="col-span-full border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-6 text-center rounded-base">
                <p class="text-sm font-bold text-red-700 dark:text-red-300">${escapeHtml(message)}</p>
            </div>
        `;
    };
    /* END renderError FUNCTIONALITY */

    /* START getVisibleSystems FUNCTIONALITY - Filters and sorts systems by ID ascending (1-10+) based on current active tab */
    const getVisibleSystems = () => systems
        .filter((system) => viewMode === 'archived' ? Boolean(system.archivedAt) : !system.archivedAt)
        .sort((left, right) => {
            const leftId = Number(left.id) || 0;
            const rightId = Number(right.id) || 0;
            return leftId - rightId;
        });
    /* END getVisibleSystems FUNCTIONALITY */

    /* START updateSortControls FUNCTIONALITY - Synchronizes tab button styles for ALL and ARCHIVED views */
    const updateSortControls = () => {
        const setActive = (button, active) => {
            if (!button) return;
            button.classList.toggle('bg-white', active);
            button.classList.toggle('dark:bg-gray-700', active);
            button.classList.toggle('text-gray-900', active);
            button.classList.toggle('dark:text-white', active);
            button.classList.toggle('shadow-sm', active);
            button.classList.toggle('text-gray-500', !active);
            button.classList.toggle('dark:bg-gray-800', !active);
            button.classList.toggle('dark:text-gray-400', !active);
            button.classList.toggle('hover:text-gray-900', !active);
            button.classList.toggle('dark:hover:text-white', !active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        };

        setActive(sortAllBtn, viewMode === 'all');
        setActive(archivedBtn, viewMode === 'archived');
    };
    /* END updateSortControls FUNCTIONALITY */

    /* START renderSystems FUNCTIONALITY - Renders system cards with seamless confirmation bar and action buttons */
    const renderSystems = () => {
        const visibleSystems = getVisibleSystems();
        if (visibleSystems.length === 0) {
            gridEl.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-sm font-semibold text-gray-500 dark:text-gray-400">${viewMode === 'archived' ? 'No archived systems yet.' : 'No systems found yet. Click "Add System" to create one.'}</p>
                </div>
            `;
            return;
        }

        gridEl.innerHTML = '';
        visibleSystems.forEach((sys) => {
            const card = document.createElement('div');
            const sysColor = sys.color || '#3b82f6';
            const isArchived = Boolean(sys.archivedAt);
            const isConfirming = activeConfirm && String(activeConfirm.id) === String(sys.id);

            card.className = 'system-card cursor-pointer border border-transparent flex flex-col justify-between hover:scale-[1.01] hover:shadow-[0_0_15px_var(--glow-color)] transition-all duration-300 relative group min-h-[320px] rounded-base text-white hover:z-30';
            card.style.setProperty('--sys-color', sysColor);
            card.setAttribute('data-url', sys.systemUrl);
            card.setAttribute('data-has-link', sys.systemUrl ? 'true' : 'false');
            card.setAttribute('data-system-id', sys.id);

            // Widened Yin-Yang Confirmation Control with full edge-to-edge orange pending coverage and bold icons
            const inlineConfirmBoxHtml = `
                <div class="inline-confirm-box inline-flex items-stretch rounded-lg overflow-hidden border border-amber-500/50 dark:border-amber-400/50 shadow-md select-none animate-fadeIn h-7.5 sm:h-7 min-w-[135px] sm:min-w-[130px]">
                    <!-- Left Half: Full-bleed Amber Pending "CONFIRM?" with no empty gaps -->
                    <div class="flex items-center justify-center px-3 sm:px-2.5 bg-amber-500 text-gray-950 font-black text-[11px] sm:text-[10px] uppercase tracking-wider select-none">
                        CONFIRM?
                    </div>
                    <!-- Right Half: Dark toggle section with Check and X -->
                    <div class="flex items-center bg-gray-900/90 dark:bg-black/90 px-1.5 sm:px-1 gap-1 sm:gap-0.5 border-s border-amber-600/30">
                        <!-- YES / CHECK button with emerald hover & tooltip -->
                        <div class="relative group/check flex items-center">
                            <button type="button" class="btn-confirm-check cursor-pointer flex items-center justify-center p-1 rounded hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 transition-colors" data-id="${escapeHtml(sys.id)}" data-action="${isArchived ? 'restore' : 'archive'}" aria-label="Confirm">
                                <svg class="w-4 h-4 sm:w-3.5 sm:h-3.5 fill-none stroke-current" stroke-width="3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                                </svg>
                            </button>
                            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/check:block bg-emerald-600 dark:bg-emerald-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                                Yes, ${isArchived ? 'Restore' : 'Archive'}
                            </div>
                        </div>
                        <!-- NO / CANCEL button with rose hover & tooltip -->
                        <div class="relative group/cancel flex items-center">
                            <button type="button" class="btn-confirm-cancel cursor-pointer flex items-center justify-center p-1 rounded hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 transition-colors" data-id="${escapeHtml(sys.id)}" aria-label="Cancel">
                                <svg class="w-4 h-4 sm:w-3.5 sm:h-3.5 fill-none stroke-current" stroke-width="3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                                </svg>
                            </button>
                            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/cancel:block bg-rose-600 dark:bg-rose-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                                Cancel
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Action section: stays in its original slot (left for restore, right for archive)
            let actionSectionHtml = '';
            if (isArchived) {
                actionSectionHtml = `
                    <div class="relative flex items-center">
                        ${isConfirming ? inlineConfirmBoxHtml : `
                            <div class="relative group/restore">
                                <button type="button" class="btn-restore-system cursor-pointer text-emerald-400 md:text-white/70 md:hover:text-emerald-400 transition-colors p-1" data-id="${escapeHtml(sys.id)}" aria-label="Restore ${escapeHtml(sys.title)}">
                                    <svg class="w-5 h-5 fill-current" id='Restore_24' width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><g transform="matrix(0.83 0 0 0.83 12 12)" ><path style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: currentColor; fill-rule: nonzero; opacity: 1;" transform=" translate(-16, -16)" d="M 16 4 C 12.419075 4 9.2009645 5.5771818 7 8.0722656 L 7 5 L 5 5 L 5 12 L 12 12 L 12 10 L 8.0214844 10 C 9.8446785 7.5779146 12.726292 6 16 6 C 21.534534 6 26 10.465466 26 16 C 26 21.534534 21.534534 26 16 26 C 10.465466 26 6 21.534534 6 16 L 4 16 C 4 22.615466 9.3845336 28 16 28 C 22.615466 28 28 22.615466 28 16 C 28 9.3845336 22.615466 4 16 4 z M 16 13 C 15.083334 13 14.268559 13.379756 13.751953 13.960938 C 13.235347 14.542118 13 15.277778 13 16 C 13 16.722222 13.235347 17.457881 13.751953 18.039062 C 14.268559 18.620244 15.083334 19 16 19 C 16.916666 19 17.731441 18.620244 18.248047 18.039062 C 18.764653 17.457881 19 16.722222 19 16 C 19 15.277778 18.764653 14.542119 18.248047 13.960938 C 17.731441 13.379755 16.916666 13 16 13 z M 16 15 C 16.416666 15 16.601893 15.120244 16.751953 15.289062 C 16.902014 15.457882 17 15.722222 17 16 C 17 16.277778 16.90201 16.542119 16.751953 16.710938 C 16.601893 16.879756 16.416666 17 16 17 C 15.583334 17 15.398107 16.879756 15.248047 16.710938 C 15.097986 16.542119 15 16.277778 15 16 C 15 15.722222 15.097986 15.457881 15.248047 15.289062 C 15.398107 15.120245 15.583334 15 16 15 z" stroke-linecap="round" /></g></svg>
                                </button>
                                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/restore:block bg-gray-900 dark:bg-gray-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                                    Restore System
                                </div>
                            </div>
                        `}
                    </div>
                    <div class="relative group/edit">
                        <button type="button" class="btn-edit-system cursor-pointer text-white md:text-white/70 md:hover:text-white transition-colors p-1" data-id="${escapeHtml(sys.id)}" aria-label="Edit ${escapeHtml(sys.title)}">
                            <svg class="w-5 h-5 hidden md:block group-hover/edit:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m14.304 4.844 2.852 2.852M7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4.5m2.409-9.91a2.017 2.017 0 0 1 0 2.853l-6.844 6.844L8 14l.713-3.565 6.844-6.844a2.015 2.015 0 0 1 2.852 0Z"/></svg>
                            <svg class="w-5 h-5 block md:hidden md:group-hover/edit:block text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M11.32 6.176H5c-1.105 0-2 .949-2 2.118v10.588C3 20.052 3.895 21 5 21h11c1.105 0 2-.948 2-2.118v-7.75l-3.914 4.144A2.46 2.46 0 0 1 12.81 16l-2.681.568c-1.75.37-3.292-1.263-2.942-3.115l.536-2.839c.097-.512.335-.983.684-1.352l2.914-3.086Z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M19.846 4.318a2.148 2.148 0 0 0-.437-.692 2.014 2.014 0 0 0-.654-.463 1.92 1.92 0 0 0-1.544 0 2.014 2.014 0 0 0-.654.463l-.546.578 2.852 3.02.546-.579a2.14 2.14 0 0 0 .437-.692 2.244 2.244 0 0 0 0-1.635ZM17.45 8.721 14.597 5.7 9.82 10.76a.54.54 0 0 0-.137.27l-.536 2.84c-.07.37.239.696.588.622l2.682-.567a.492.492 0 0 0 .255-.145l4.778-5.06Z" clip-rule="evenodd"/></svg>
                        </button>
                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/edit:block bg-gray-900 dark:bg-gray-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                            Edit System
                        </div>
                    </div>
                `;
            } else {
                actionSectionHtml = `
                    <div class="relative group/edit">
                        <button type="button" class="btn-edit-system cursor-pointer text-white md:text-white/70 md:hover:text-white transition-colors p-1" data-id="${escapeHtml(sys.id)}" aria-label="Edit ${escapeHtml(sys.title)}">
                            <svg class="w-5 h-5 hidden md:block group-hover/edit:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m14.304 4.844 2.852 2.852M7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4.5m2.409-9.91a2.017 2.017 0 0 1 0 2.853l-6.844 6.844L8 14l.713-3.565 6.844-6.844a2.015 2.015 0 0 1 2.852 0Z"/></svg>
                            <svg class="w-5 h-5 block md:hidden md:group-hover/edit:block text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M11.32 6.176H5c-1.105 0-2 .949-2 2.118v10.588C3 20.052 3.895 21 5 21h11c1.105 0 2-.948 2-2.118v-7.75l-3.914 4.144A2.46 2.46 0 0 1 12.81 16l-2.681.568c-1.75.37-3.292-1.263-2.942-3.115l.536-2.839c.097-.512.335-.983.684-1.352l2.914-3.086Z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M19.846 4.318a2.148 2.148 0 0 0-.437-.692 2.014 2.014 0 0 0-.654-.463 1.92 1.92 0 0 0-1.544 0 2.014 2.014 0 0 0-.654.463l-.546.578 2.852 3.02.546-.579a2.14 2.14 0 0 0 .437-.692 2.244 2.244 0 0 0 0-1.635ZM17.45 8.721 14.597 5.7 9.82 10.76a.54.54 0 0 0-.137.27l-.536 2.84c-.07.37.239.696.588.622l2.682-.567a.492.492 0 0 0 .255-.145l4.778-5.06Z" clip-rule="evenodd"/></svg>
                        </button>
                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/edit:block bg-gray-900 dark:bg-gray-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                            Edit System
                        </div>
                    </div>
                    <div class="relative flex items-center">
                        ${isConfirming ? inlineConfirmBoxHtml : `
                            <div class="relative group/archive">
                                <button type="button" class="btn-archive-system cursor-pointer text-red-400 md:text-white/70 md:hover:text-red-300 transition-colors p-1" data-id="${escapeHtml(sys.id)}" aria-label="Archive ${escapeHtml(sys.title)}">
                                    <svg class="w-5 h-5 fill-none stroke-current" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>
                                </button>
                                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/archive:block bg-gray-900 dark:bg-gray-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                                    Archive System
                                </div>
                            </div>
                        `}
                    </div>
                `;
            }

            card.innerHTML = `
                <!-- Click Loading Spinner Overlay (hidden by default) -->
                <div class="card-loading-overlay absolute inset-0 z-30 hidden items-center justify-center bg-black/60 backdrop-blur-[2px] flex-col gap-3 pointer-events-none select-none">
                    <svg class="animate-spin w-10 h-10 text-white drop-shadow-lg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-white text-xs font-bold tracking-widest uppercase opacity-90">Opening...</span>
                </div>
                <div class="relative z-10 flex flex-col h-full justify-between">
                    <div class="w-full overflow-hidden rounded-t-base">
                        <img class="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100" src="${escapeHtml(sys.imageUrl)}" alt="${escapeHtml(sys.title)}" />
                    </div>
                    <div class="p-6 flex-1 flex flex-col justify-between">
                        <div>
                            <h3 class="text-lg font-bold text-white mb-2 transition-colors">${escapeHtml(sys.title)}</h3>
                            <p class="text-xs font-semibold text-white/70">${escapeHtml(sys.description)}</p>
                        </div>
                        <div class="flex items-center justify-between mt-4 pt-4 border-t border-white/20">
                            ${actionSectionHtml}
                        </div>
                    </div>
                </div>
            `;
            gridEl.appendChild(card);
        });
    };
    /* END renderSystems FUNCTIONALITY */

    /* START loadSystems FUNCTIONALITY - Fetches latest systems data from database and triggers grid render */
    const loadSystems = async () => {
        renderSkeletons();
        const { data, error } = await fetchSystems({ activeOnly: false, includeArchived: true });
        if (error) {
            renderError('Unable to load systems from the database. Please check Supabase policies and table access.');
            return;
        }
        systems = data.map(normalizeSystem);
        updateSortControls();
        renderSystems();
    };
    /* END loadSystems FUNCTIONALITY */

    // Supabase Realtime: Systems
    // Subscribe to systems table changes and refresh the grid live.
    const _systemsChannel = supabase
        .channel('drawer-systems-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'systems' }, async (payload) => {
            if (window.DEBUG) window.DEBUG.flow('DRAWER', `Systems realtime: ${payload.eventType}`);
            const { data, error } = await fetchSystems({ activeOnly: false, includeArchived: true });
            if (!error) {
                systems = data.map(normalizeSystem);
                updateSortControls();
                renderSystems();
            }
        })
        .subscribe((status) => {
            if (window.DEBUG) window.DEBUG.flow('DRAWER', `Systems realtime channel: ${status}`);
        });

    window.addEventListener('beforeunload', () => {
        supabase.removeChannel(_systemsChannel);
    });

    /* START setSavingState FUNCTIONALITY - Toggles submit button disabled and text states during async operations */
    const setSavingState = (saving) => {
        isSaving = saving;
        if (submitBtn) submitBtn.disabled = saving;
        if (submitBtnText) submitBtnText.textContent = saving ? 'Saving...' : (idInput?.value ? 'Update System' : 'Add System');
    };
    /* END setSavingState FUNCTIONALITY */

    if (imageInput) {
        imageInput.addEventListener('change', (event) => {
            imageErrorMsg?.classList.add('hidden');
            const file = event.target.files?.[0] || null;
            selectedImageFile = null;
            if (!file) return;

            const isImage = file.type.startsWith('image/png') || file.type.startsWith('image/jpeg') || /\.(png|jpg|jpeg)$/i.test(file.name);
            if (!isImage || file.size > 3 * 1024 * 1024) {
                imageErrorMsg?.classList.remove('hidden');
                imageInput.value = '';
                setImagePreview(idInput?.value ? systems.find((sys) => sys.id === idInput.value)?.imageUrl : '');
                return;
            }

            selectedImageFile = file;
            const reader = new FileReader();
            reader.onload = (readerEvent) => setImagePreview(readerEvent.target.result);
            reader.readAsDataURL(file);
        });
    }

    addBtn?.addEventListener('click', () => {
        resetForm();
        openDrawer();
    });

    sortAllBtn?.addEventListener('click', () => {
        viewMode = 'all';
        activeConfirm = null;
        updateSortControls();
        renderSystems();
    });

    archivedBtn?.addEventListener('click', () => {
        viewMode = 'archived';
        activeConfirm = null;
        updateSortControls();
        renderSystems();
    });

    /* START handleGridInteractions FUNCTIONALITY - Central handler for edit, archive, restore, and inline confirmation events */
    gridEl.addEventListener('click', async (event) => {
        if (suppressNextGridClick || isDrawerOpen()) {
            suppressNextGridClick = false;
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        const editBtn = event.target.closest('.btn-edit-system');
        const archiveBtn = event.target.closest('.btn-archive-system');
        const restoreBtn = event.target.closest('.btn-restore-system');
        const checkBtn = event.target.closest('.btn-confirm-check');
        const cancelBtn = event.target.closest('.btn-confirm-cancel');
        const card = event.target.closest('.system-card');

        // Edit button click
        if (editBtn) {
            event.preventDefault();
            event.stopPropagation();
            const system = systems.find((sys) => sys.id === editBtn.dataset.id);
            if (!system) return;

            if (idInput) idInput.value = system.id;
            if (nameInput) nameInput.value = system.title;
            if (descInput) descInput.value = system.description;
            if (urlInput) urlInput.value = system.systemUrl;
            if (colorInput) colorInput.value = system.color || '#3b82f6';
            if (drawerTitle) drawerTitle.textContent = 'Edit System';
            if (submitBtnText) submitBtnText.textContent = 'Update System';
            if (imageInput) imageInput.value = '';
            imageErrorMsg?.classList.add('hidden');
            selectedImageFile = null;
            setImagePreview(system.imageUrl);
            openDrawer();
            return;
        }

        // Archive trigger button click -> Open inline confirmation
        if (archiveBtn) {
            event.preventDefault();
            event.stopPropagation();
            activeConfirm = { id: archiveBtn.dataset.id, action: 'archive' };
            renderSystems();
            return;
        }

        // Restore trigger button click -> Open inline confirmation
        if (restoreBtn) {
            event.preventDefault();
            event.stopPropagation();
            activeConfirm = { id: restoreBtn.dataset.id, action: 'restore' };
            renderSystems();
            return;
        }

        // Cancel inline confirmation button click
        if (cancelBtn) {
            event.preventDefault();
            event.stopPropagation();
            activeConfirm = null;
            renderSystems();
            return;
        }

        // Confirm YES check button click
        if (checkBtn) {
            event.preventDefault();
            event.stopPropagation();
            const id = Number(checkBtn.dataset.id);
            const action = checkBtn.dataset.action;
            const system = systems.find((sys) => String(sys.id) === String(id));
            const systemTitle = system?.title || 'System';

            activeConfirm = null;

            if (action === 'archive') {
                const { error } = await archiveSystem(id);
                if (error) {
                    renderError(`Unable to archive "${systemTitle}". ${error}`);
                    showSnackbar({ position: 'bottom-center', type: 'danger', message: `Unable to archive "${systemTitle}". ${error}` });
                    return;
                }

                await loadSystems();

                showSnackbar({
                    position: 'bottom-center',
                    type: 'success',
                    message: `"${systemTitle}" was archived successfully.`,
                    onUndo: async () => {
                        const { error: undoErr } = await restoreSystem(id);
                        if (undoErr) {
                            showSnackbar({ position: 'bottom-center', type: 'danger', message: `Failed to undo archive: ${undoErr}` });
                            return;
                        }
                        await loadSystems();
                        showSnackbar({
                            position: 'bottom-center',
                            type: 'success',
                            message: `Archive undone. "${systemTitle}" was restored.`
                        });
                    }
                });
            } else if (action === 'restore') {
                const { error } = await restoreSystem(id);
                if (error) {
                    renderError(`Unable to restore "${systemTitle}". ${error}`);
                    showSnackbar({ position: 'bottom-center', type: 'danger', message: `Unable to restore "${systemTitle}". ${error}` });
                    return;
                }

                await loadSystems();

                showSnackbar({
                    position: 'bottom-center',
                    type: 'success',
                    message: `"${systemTitle}" was restored successfully.`,
                    onUndo: async () => {
                        const { error: undoErr } = await archiveSystem(id);
                        if (undoErr) {
                            showSnackbar({ position: 'bottom-center', type: 'danger', message: `Failed to undo restore: ${undoErr}` });
                            return;
                        }
                        await loadSystems();
                        showSnackbar({
                            position: 'bottom-center',
                            type: 'success',
                            message: `Restore undone. "${systemTitle}" was archived.`
                        });
                    }
                });
            }
            return;
        }

        // Card navigation click (if not clicking an action button)
        if (card) {
            if (activeConfirm) {
                activeConfirm = null;
                renderSystems();
                return;
            }

            const url = card.getAttribute('data-url');
            const system = systems.find((item) => String(item.id) === String(card.dataset.systemId));
            const title = String(system?.title || '').toLowerCase();
            const systemKey = title.includes('spes') ? 'SPES' : title.includes('gip') ? 'GIP' : null;
            const openInNewTab = Boolean(event.ctrlKey || event.metaKey || event.button === 1);

            if (url && url.trim() !== '') {
                // Show loading spinner overlay on the card to confirm click
                const overlay = card.querySelector('.card-loading-overlay');
                if (overlay) {
                    overlay.classList.remove('hidden');
                    overlay.classList.add('flex');
                    card.classList.add('pointer-events-none', 'scale-[0.99]');
                }
                const clearSpinner = () => {
                    if (overlay) {
                        overlay.classList.add('hidden');
                        overlay.classList.remove('flex');
                        card.classList.remove('pointer-events-none', 'scale-[0.99]');
                    }
                };
                const spinnerTimeout = window.setTimeout(clearSpinner, 8000);

                if (systemKey) {
                    window.dispatchEvent(new CustomEvent('portal:system-launch', {
                        detail: { systemKey, url, system, openInNewTab }
                    }));
                    window.addEventListener('portal:system-launch-done', () => {
                        window.clearTimeout(spinnerTimeout);
                        clearSpinner();
                    }, { once: true });
                } else if (openInNewTab) {
                    window.clearTimeout(spinnerTimeout);
                    window.open(url, '_blank', 'noopener,noreferrer');
                    clearSpinner();
                } else {
                    window.location.href = url;
                }
            }
        }
    });
    /* END handleGridInteractions FUNCTIONALITY */

    /* START handleFormSubmit FUNCTIONALITY - Validates, processes, uploads image, and creates or updates system */
    formEl?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (isSaving) return;

        const systemId = idInput?.value || '';
        const isUpdate = Boolean(systemId);
        const existingSystem = systems.find((sys) => sys.id === systemId);
        const payload = {
            title: nameInput?.value.trim() || '',
            description: descInput?.value.trim() || '',
            system_url: urlInput?.value.trim() || null,
            color: colorInput?.value || '#3b82f6',
            is_active: true
        };

        setSavingState(true);

        if (systemId) {
            let imageUrl = existingSystem?.imageUrl || null;
            if (selectedImageFile) {
                const upload = await uploadSystemImage(selectedImageFile, Number(systemId));
                if (upload.error) {
                    setSavingState(false);
                    renderError(`System was not saved because the image upload failed. ${upload.error}`);
                    showToast({
                        type: 'danger',
                        title: 'Image Upload Failed',
                        message: `System "${payload.title}" was not saved because the image upload failed. ${upload.error}`
                    });
                    return;
                }
                imageUrl = upload.url;
            }

            const { error } = await updateSystem(Number(systemId), { ...payload, image_url: imageUrl });
            setSavingState(false);
            if (error) {
                renderError(`Unable to update "${payload.title}". ${error}`);
                showToast({
                    type: 'danger',
                    title: 'Update Failed',
                    message: `Unable to update "${payload.title}". ${error}`
                });
                return;
            }

            resetForm();
            closeDrawer();
            await loadSystems();

            showToast({
                type: 'success',
                title: 'System Updated',
                message: `System "${payload.title}" configuration has been updated successfully.`
            });
        } else {
            const created = await createSystem({ ...payload, image_url: null });
            if (created.error || !created.data) {
                setSavingState(false);
                renderError(`Unable to add "${payload.title}". ${created.error || 'No database row was returned.'}`);
                showToast({
                    type: 'danger',
                    title: 'Creation Failed',
                    message: `Unable to add "${payload.title}". ${created.error || 'No database row was returned.'}`
                });
                return;
            }

            let finalImageUrl = null;
            if (selectedImageFile) {
                const upload = await uploadSystemImage(selectedImageFile, created.data.id);
                if (upload.error) {
                    setSavingState(false);
                    renderError(`System was added, but the image upload failed. ${upload.error}`);
                    showToast({
                        type: 'danger',
                        title: 'Image Upload Failed',
                        message: `System "${payload.title}" was created, but saving the image failed.`
                    });
                    await loadSystems();
                    return;
                }
                finalImageUrl = upload.url;
                const updated = await updateSystem(created.data.id, { image_url: upload.url });
                if (updated.error) {
                    setSavingState(false);
                    renderError(`System was added, but saving the image URL failed. ${updated.error}`);
                    showToast({
                        type: 'danger',
                        title: 'Save Image URL Failed',
                        message: `System "${payload.title}" was added, but saving the image URL failed.`
                    });
                    await loadSystems();
                    return;
                }
            }
            setSavingState(false);

            resetForm();
            closeDrawer();
            await loadSystems();

            showToast({
                type: 'success',
                title: 'System Added',
                message: `System "${payload.title}" was added successfully.`
            });
        }
    });
    /* END handleFormSubmit FUNCTIONALITY */

    document.addEventListener('pointerdown', (event) => {
        // Reset active inline confirm if clicking outside the card
        if (activeConfirm && !event.target.closest('.inline-confirm-box') && !event.target.closest('.btn-archive-system') && !event.target.closest('.btn-restore-system')) {
            activeConfirm = null;
            renderSystems();
        }

        if (!isDrawerOpen()) return;
        if (isSaving) return;
        if (drawerEl.contains(event.target)) return;
        if (event.target.closest('[data-drawer-show="add-system-drawer"], .btn-edit-system')) return;
        suppressNextGridClick = true;
        closeDrawer();
        window.setTimeout(() => { suppressNextGridClick = false; }, 0);
    });

    if (drawerEl && mainContent) {
        const observer = new MutationObserver(() => {
            const isClosed = drawerEl.classList.contains('translate-x-full');
            const sidebar = document.getElementById('default-sidebar');
            mainContent.classList.toggle('blur-[2px]', !isClosed);
            gridEl.classList.toggle('pointer-events-none', !isClosed);
            setPageScrollLock(!isClosed);
            if (sidebar) {
                sidebar.classList.toggle('blur-[2px]', !isClosed);
                sidebar.classList.toggle('pointer-events-none', !isClosed);
                sidebar.style.zIndex = isClosed ? '' : '30';
            }
        });
        observer.observe(drawerEl, { attributes: true, attributeFilter: ['class'] });
    }

    forceCloseDrawer();
    updateSortControls();
    loadSystems();
};
/* END initSystemsManager FUNCTIONALITY */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSystemsManager);
} else {
    initSystemsManager();
}
