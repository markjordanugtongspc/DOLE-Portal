import { fetchSystems, createSystem, updateSystem, archiveSystem, restoreSystem, uploadSystemImage } from '@/backend/api/systems.api.js';
import { Modal } from 'flowbite';

/* START AUTH DRAWER FUNCTIONALITY */
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
        if (window.DEBUG) window.DEBUG.success('DRAWER', 'Drawer opened.');
    };

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
        if (window.DEBUG) window.DEBUG.success('DRAWER', 'Drawer closed.');
    };

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

// Robust readyState check to avoid DOMContentLoaded race conditions in ES modules
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDrawer);
} else {
    initDrawer();
}
/* END AUTH DRAWER FUNCTIONALITY */

/* START MANAGE SYSTEMS DRAWER FUNCTIONALITY */
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
    let confirmModal = null;
    let pendingAction = null; // { type: 'archive' | 'restore', id: number, system: object }

    const escapeHtml = (value = '') => String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const getToastContainer = () => {
        let container = document.getElementById('systems-toast-container');
        if (container) return container;

        container = document.createElement('div');
        container.id = 'systems-toast-container';
        container.className = 'fixed bottom-4 right-4 z-[80] flex w-[calc(100%-2rem)] max-w-xs flex-col gap-2 sm:right-4 sm:w-full';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
        return container;
    };

    const showToast = (type, message) => {
        const toastTypes = {
            success: {
                label: 'Success',
                iconClass: 'text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300',
                borderClass: 'border-green-200 dark:border-green-900/70',
                icon: '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11.917 9.724 16.5 19 7.5"/>'
            },
            danger: {
                label: 'Error',
                iconClass: 'text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300',
                borderClass: 'border-red-200 dark:border-red-900/70',
                icon: '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 17.94 6M18 18 6.06 6"/>'
            },
            warning: {
                label: 'Warning',
                iconClass: 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300',
                borderClass: 'border-yellow-200 dark:border-yellow-900/70',
                icon: '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 13V8m0 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>'
            }
        };
        const config = toastTypes[type] || toastTypes.success;

        const toast = document.createElement('div');
        toast.className = `flex items-start w-full p-3 text-gray-700 bg-white border ${config.borderClass} rounded-base shadow-lg dark:bg-gray-900 dark:text-gray-200 transition-all duration-200 ease-out`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="inline-flex items-center justify-center shrink-0 w-7 h-7 rounded ${config.iconClass}">
                <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">${config.icon}</svg>
                <span class="sr-only">${config.label} icon</span>
            </div>
            <div class="ms-3 min-w-0 flex-1">
                <p class="text-[11px] font-extrabold uppercase tracking-wider text-gray-900 dark:text-white">${config.label}</p>
                <p class="mt-0.5 break-words text-xs font-medium text-gray-600 dark:text-gray-300">${escapeHtml(message)}</p>
            </div>
            <button type="button" class="ms-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:hover:bg-gray-800 dark:hover:text-white" aria-label="Close">
                <span class="sr-only">Close</span>
                <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 17.94 6M18 18 6.06 6"/></svg>
            </button>
        `;

        const removeToast = () => {
            toast.classList.add('opacity-0', 'translate-x-3');
            window.setTimeout(() => toast.remove(), 200);
        };

        toast.querySelector('button')?.addEventListener('click', removeToast);
        getToastContainer().appendChild(toast);
        window.setTimeout(removeToast, type === 'danger' ? 6000 : 4000);
    };

    const normalizeSystem = (system) => {
        const systemUrl = system.system_url?.trim() || '';

        return {
            id: String(system.id),
            title: system.title || 'Untitled System',
            description: system.description || 'No description provided.',
            systemUrl: systemUrl === '#' ? '' : systemUrl,
            color: system.color || '#3b82f6',
            imageUrl: system.image_url || '/src/assets/logos/dole_logo.png',
            createdAt: system.created_at || null,
            archivedAt: system.archived_at || null
        };
    };

    const isDrawerOpen = () => drawerEl && !drawerEl.classList.contains('translate-x-full');

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


    const setPageScrollLock = (locked) => {
        document.documentElement.classList.toggle('overflow-hidden', locked);
        document.body.classList.toggle('overflow-hidden', locked);
    };
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
    const openDrawer = () => {
        if (drawerEl) {
            drawerEl.classList.remove('translate-x-full');
            drawerEl.classList.add('transform-none');
            drawerEl.setAttribute('aria-hidden', 'false');
            setPageScrollLock(true);
        }
    };

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

    const renderError = (message) => {
        gridEl.innerHTML = `
            <div class="col-span-full border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-6 text-center">
                <p class="text-sm font-bold text-red-700 dark:text-red-300">${escapeHtml(message)}</p>
            </div>
        `;
    };

    const getVisibleSystems = () => systems
        .filter((system) => viewMode === 'archived' ? Boolean(system.archivedAt) : !system.archivedAt)
        .sort((left, right) => {
            const leftTime = new Date(left.createdAt || 0).getTime();
            const rightTime = new Date(right.createdAt || 0).getTime();
            return rightTime - leftTime;
        });

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
            card.className = 'system-card cursor-pointer border border-transparent flex flex-col justify-between hover:scale-[1.01] hover:shadow-[0_0_15px_var(--glow-color)] transition-all duration-300 relative group min-h-[320px] rounded-base text-white hover:z-30';
            card.style.setProperty('--sys-color', sysColor);
            card.setAttribute('data-url', sys.systemUrl);
            card.setAttribute('data-has-link', sys.systemUrl ? 'true' : 'false');
            card.setAttribute('data-system-id', sys.id);
            card.innerHTML = `
                <div class="relative z-10 flex flex-col h-full justify-between">
                    <div class="w-full overflow-hidden rounded-t-base">
                        <img class="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100" src="${escapeHtml(sys.imageUrl)}" alt="${escapeHtml(sys.title)}" />
                    </div>
                    <div class="p-6 flex-1 flex flex-col justify-between">
                        <div>
                            <h3 class="text-lg font-bold text-white mb-2 transition-colors">${escapeHtml(sys.title)}</h3>
                            <p class="text-xs font-semibold text-white/70">${escapeHtml(sys.description)}</p>
                        </div>
                        <div class="flex items-start justify-between gap-3 mt-6 pt-4 border-t border-white/20 text-[10px] font-extrabold uppercase tracking-wider text-white/60">
                            <span class="shrink-0 whitespace-nowrap">ID #${escapeHtml(sys.id)}</span>
                            <span class="min-w-0 flex-1 break-words normal-case font-semibold tracking-normal text-white/50 text-right">${escapeHtml(sys.systemUrl || 'No link')}</span>
                        </div>
                        <div class="relative z-20 flex items-center justify-between mt-3">
                            ${sys.archivedAt ? `
                            <div class="relative group/restore">
                                <button type="button" class="btn-restore-system cursor-pointer text-white/70 hover:text-emerald-400 transition-colors p-1" data-id="${escapeHtml(sys.id)}" aria-label="Restore ${escapeHtml(sys.title)}">
                                    <svg class="w-5 h-5 fill-current" id='Restore_24' width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><g transform="matrix(0.83 0 0 0.83 12 12)" ><path style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: currentColor; fill-rule: nonzero; opacity: 1;" transform=" translate(-16, -16)" d="M 16 4 C 12.419075 4 9.2009645 5.5771818 7 8.0722656 L 7 5 L 5 5 L 5 12 L 12 12 L 12 10 L 8.0214844 10 C 9.8446785 7.5779146 12.726292 6 16 6 C 21.534534 6 26 10.465466 26 16 C 26 21.534534 21.534534 26 16 26 C 10.465466 26 6 21.534534 6 16 L 4 16 C 4 22.615466 9.3845336 28 16 28 C 22.615466 28 28 22.615466 28 16 C 28 9.3845336 22.615466 4 16 4 z M 16 13 C 15.083334 13 14.268559 13.379756 13.751953 13.960938 C 13.235347 14.542118 13 15.277778 13 16 C 13 16.722222 13.235347 17.457881 13.751953 18.039062 C 14.268559 18.620244 15.083334 19 16 19 C 16.916666 19 17.731441 18.620244 18.248047 18.039062 C 18.764653 17.457881 19 16.722222 19 16 C 19 15.277778 18.764653 14.542119 18.248047 13.960938 C 17.731441 13.379755 16.916666 13 16 13 z M 16 15 C 16.416666 15 16.601893 15.120244 16.751953 15.289062 C 16.902014 15.457882 17 15.722222 17 16 C 17 16.277778 16.90201 16.542119 16.751953 16.710938 C 16.601893 16.879756 16.416666 17 16 17 C 15.583334 17 15.398107 16.879756 15.248047 16.710938 C 15.097986 16.542119 15 16.277778 15 16 C 15 15.722222 15.097986 15.457881 15.248047 15.289062 C 15.398107 15.120245 15.583334 15 16 15 z" stroke-linecap="round" /></g></svg>
                                </button>
                                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/restore:block bg-gray-900 dark:bg-gray-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                                    Restore System
                                </div>
                            </div>
                            <div class="relative group/edit">
                                <button type="button" class="btn-edit-system cursor-pointer text-white/70 hover:text-white transition-colors p-1" data-id="${escapeHtml(sys.id)}" aria-label="Edit ${escapeHtml(sys.title)}">
                                    <svg class="w-5 h-5 hidden md:block group-hover/edit:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m14.304 4.844 2.852 2.852M7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4.5m2.409-9.91a2.017 2.017 0 0 1 0 2.853l-6.844 6.844L8 14l.713-3.565 6.844-6.844a2.015 2.015 0 0 1 2.852 0Z"/></svg>
                                    <svg class="w-5 h-5 block md:hidden md:group-hover/edit:block text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M11.32 6.176H5c-1.105 0-2 .949-2 2.118v10.588C3 20.052 3.895 21 5 21h11c1.105 0 2-.948 2-2.118v-7.75l-3.914 4.144A2.46 2.46 0 0 1 12.81 16l-2.681.568c-1.75.37-3.292-1.263-2.942-3.115l.536-2.839c.097-.512.335-.983.684-1.352l2.914-3.086Z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M19.846 4.318a2.148 2.148 0 0 0-.437-.692 2.014 2.014 0 0 0-.654-.463 1.92 1.92 0 0 0-1.544 0 2.014 2.014 0 0 0-.654.463l-.546.578 2.852 3.02.546-.579a2.14 2.14 0 0 0 .437-.692 2.244 2.244 0 0 0 0-1.635ZM17.45 8.721 14.597 5.7 9.82 10.76a.54.54 0 0 0-.137.27l-.536 2.84c-.07.37.239.696.588.622l2.682-.567a.492.492 0 0 0 .255-.145l4.778-5.06Z" clip-rule="evenodd"/></svg>
                                </button>
                                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/edit:block bg-gray-900 dark:bg-gray-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                                    Edit System
                                </div>
                            </div>
                            ` : `
                            <div class="relative group/edit">
                                <button type="button" class="btn-edit-system cursor-pointer text-white/70 hover:text-white transition-colors p-1" data-id="${escapeHtml(sys.id)}" aria-label="Edit ${escapeHtml(sys.title)}">
                                    <svg class="w-5 h-5 hidden md:block group-hover/edit:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m14.304 4.844 2.852 2.852M7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4.5m2.409-9.91a2.017 2.017 0 0 1 0 2.853l-6.844 6.844L8 14l.713-3.565 6.844-6.844a2.015 2.015 0 0 1 2.852 0Z"/></svg>
                                    <svg class="w-5 h-5 block md:hidden md:group-hover/edit:block text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M11.32 6.176H5c-1.105 0-2 .949-2 2.118v10.588C3 20.052 3.895 21 5 21h11c1.105 0 2-.948 2-2.118v-7.75l-3.914 4.144A2.46 2.46 0 0 1 12.81 16l-2.681.568c-1.75.37-3.292-1.263-2.942-3.115l.536-2.839c.097-.512.335-.983.684-1.352l2.914-3.086Z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M19.846 4.318a2.148 2.148 0 0 0-.437-.692 2.014 2.014 0 0 0-.654-.463 1.92 1.92 0 0 0-1.544 0 2.014 2.014 0 0 0-.654.463l-.546.578 2.852 3.02.546-.579a2.14 2.14 0 0 0 .437-.692 2.244 2.244 0 0 0 0-1.635ZM17.45 8.721 14.597 5.7 9.82 10.76a.54.54 0 0 0-.137.27l-.536 2.84c-.07.37.239.696.588.622l2.682-.567a.492.492 0 0 0 .255-.145l4.778-5.06Z" clip-rule="evenodd"/></svg>
                                </button>
                                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/edit:block bg-gray-900 dark:bg-gray-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                                    Edit System
                                </div>
                            </div>
                            <div class="relative group/archive">
                                <button type="button" class="btn-archive-system cursor-pointer text-white/70 hover:text-red-300 transition-colors p-1" data-id="${escapeHtml(sys.id)}" aria-label="Archive ${escapeHtml(sys.title)}">
                                    <svg class="w-5 h-5 fill-none stroke-current" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>
                                </button>
                                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/archive:block bg-gray-900 dark:bg-gray-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                                    Archive System
                                </div>
                            </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
            gridEl.appendChild(card);
        });
    };

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

    const setSavingState = (saving) => {
        isSaving = saving;
        if (submitBtn) submitBtn.disabled = saving;
        if (submitBtnText) submitBtnText.textContent = saving ? 'Saving...' : (idInput?.value ? 'Update System' : 'Add System');
    };

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
        updateSortControls();
        renderSystems();
    });

    archivedBtn?.addEventListener('click', () => {
        viewMode = 'archived';
        updateSortControls();
        renderSystems();
    });

    gridEl.addEventListener('click', async (event) => {
        if (suppressNextGridClick || isDrawerOpen()) {
            suppressNextGridClick = false;
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        const editBtn = event.target.closest('.btn-edit-system');
        const archiveBtn = event.target.closest('.btn-archive-system');
        const card = event.target.closest('.system-card');

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

        if (archiveBtn) {
            event.preventDefault();
            event.stopPropagation();
            const system = systems.find((sys) => sys.id === archiveBtn.dataset.id);
            if (!system) return;

            pendingAction = { type: 'archive', id: Number(system.id), system };
            const titleEl = document.getElementById('confirm-modal-title');
            const textEl = document.getElementById('confirm-modal-text');
            const yesBtn = document.getElementById('btn-confirm-yes');
            const noBtn = document.getElementById('btn-confirm-no');
            if (titleEl) titleEl.textContent = 'Archive System';
            if (textEl) textEl.textContent = `Are you sure you want to archive system "${system.title}" (ID #${system.id})?`;
            
            if (yesBtn) yesBtn.className = "cursor-pointer text-gray-500 bg-white hover:bg-gray-100 hover:text-gray-900 focus:ring-4 focus:outline-none focus:ring-gray-200 border border-gray-200 font-medium rounded-lg text-xs px-4 py-2 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 dark:focus:ring-gray-700 transition-colors";
            if (noBtn) noBtn.className = "cursor-pointer text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-bold rounded-lg text-xs px-5 py-2.5 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900 transition-colors";
            
            confirmModal?.show();
            return;
        }

        // START RESTORE SYSTEM FUNCTIONALITY
        const restoreBtn = event.target.closest('.btn-restore-system');
        if (restoreBtn) {
            event.preventDefault();
            event.stopPropagation();
            const system = systems.find((sys) => sys.id === restoreBtn.dataset.id);
            if (!system) return;

            pendingAction = { type: 'restore', id: Number(system.id), system };
            const titleEl = document.getElementById('confirm-modal-title');
            const textEl = document.getElementById('confirm-modal-text');
            const yesBtn = document.getElementById('btn-confirm-yes');
            const noBtn = document.getElementById('btn-confirm-no');
            if (titleEl) titleEl.textContent = 'Restore System';
            if (textEl) textEl.textContent = `Are you sure you want to restore system "${system.title}" (ID #${system.id})?`;
            
            if (yesBtn) yesBtn.className = "cursor-pointer text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:outline-none focus:ring-emerald-300 font-bold rounded-lg text-xs px-5 py-2.5 dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus:ring-emerald-800 transition-colors";
            if (noBtn) noBtn.className = "cursor-pointer text-gray-500 bg-white hover:bg-gray-100 hover:text-gray-900 focus:ring-4 focus:outline-none focus:ring-gray-200 border border-gray-200 font-medium rounded-lg text-xs px-4 py-2 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 dark:focus:ring-gray-700 transition-colors";
            
            confirmModal?.show();
            return;
        }
        // END RESTORE SYSTEM FUNCTIONALITY

        if (card) {
            const url = card.getAttribute('data-url');
            if (url && url.trim() !== '') window.open(url, '_blank', 'noopener,noreferrer');
        }
    });

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
                    showToast('danger', `System was not saved because the image upload failed. ${upload.error}`);
                    return;
                }
                imageUrl = upload.url;
            }

            const { error } = await updateSystem(Number(systemId), { ...payload, image_url: imageUrl });
            setSavingState(false);
            if (error) {
                renderError(`Unable to update "${payload.title}". ${error}`);
                showToast('danger', `Unable to update "${payload.title}". ${error}`);
                return;
            }
        } else {
            const created = await createSystem({ ...payload, image_url: null });
            if (created.error || !created.data) {
                setSavingState(false);
                renderError(`Unable to add "${payload.title}". ${created.error || 'No database row was returned.'}`);
                showToast('danger', `Unable to add "${payload.title}". ${created.error || 'No database row was returned.'}`);
                return;
            }

            if (selectedImageFile) {
                const upload = await uploadSystemImage(selectedImageFile, created.data.id);
                if (upload.error) {
                    setSavingState(false);
                    renderError(`System was added, but the image upload failed. ${upload.error}`);
                    showToast('warning', `System was added, but the image upload failed. ${upload.error}`);
                    await loadSystems();
                    return;
                }
                const updated = await updateSystem(created.data.id, { image_url: upload.url });
                if (updated.error) {
                    setSavingState(false);
                    renderError(`System was added, but saving the image URL failed. ${updated.error}`);
                    showToast('warning', `System was added, but saving the image URL failed. ${updated.error}`);
                    await loadSystems();
                    return;
                }
            }
            setSavingState(false);
        }

        showToast('success', `System "${payload.title}" was ${isUpdate ? 'updated' : 'added'} successfully.`);
        resetForm();
        closeDrawer();
        await loadSystems();
    });

    document.addEventListener('pointerdown', (event) => {
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

    // Initialize confirm modal
    const confirmEl = document.getElementById('confirmActionModal');
    if (confirmEl) {
        confirmModal = new Modal(confirmEl);
        confirmEl.querySelectorAll('[data-modal-hide="confirmActionModal"]').forEach(b => {
            b.addEventListener('click', () => confirmModal?.hide());
        });
    }

    document.getElementById('btn-confirm-yes')?.addEventListener('click', async () => {
        if (!pendingAction) return;
        const { type, id, system } = pendingAction;
        confirmModal?.hide();

        if (type === 'archive') {
            const { error } = await archiveSystem(id);
            if (error) {
                renderError(`Unable to archive "${system.title}". ${error}`);
                showToast('danger', `Unable to archive "${system.title}". ${error}`);
                return;
            }
            showToast('success', `"${system.title}" was archived successfully.`);
        } else if (type === 'restore') {
            const { error } = await restoreSystem(id);
            if (error) {
                renderError(`Unable to restore "${system.title}". ${error}`);
                showToast('danger', `Unable to restore "${system.title}". ${error}`);
                return;
            }
            showToast('success', `"${system.title}" was restored successfully.`);
        }
        pendingAction = null;
        await loadSystems();
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSystemsManager);
} else {
    initSystemsManager();
}
/* END MANAGE SYSTEMS DRAWER FUNCTIONALITY */
