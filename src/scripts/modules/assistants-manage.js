import { Modal } from 'flowbite';
import { fetchGipsByStaff, createGip, updateGip, archiveGip } from '@/backend/api/gips.api.js';

/* START STAFF ASSISTANTS MANAGEMENT CONTROLLER */
export const initAssistantsManage = () => {
    const tableEl = document.getElementById("sorting-table");
    const tableBody = document.getElementById("assistants-table-body");
    if (!tableEl || !tableBody) return;

    if (window.DEBUG) {
        window.DEBUG.log('ASSISTANTS', 'Initializing GIP assistants Supabase management system...');
    }

    let assistants = [];

    // Modal References
    const editModalEl = document.getElementById('editAssistantModal');
    const viewModalEl = document.getElementById('viewAssistantModal');
    const archiveModalEl = document.getElementById('archiveAssistantModal');
    const editModal = editModalEl ? new Modal(editModalEl) : null;
    const viewModal = viewModalEl ? new Modal(viewModalEl) : null;
    const archiveModal = archiveModalEl ? new Modal(archiveModalEl) : null;

    const modalTitle = document.getElementById('modal-title');
    const submitBtn = document.getElementById('submit-btn');
    const form = document.getElementById('assistant-form');

    const idInput = document.getElementById('assistant-id');
    const nameInput = document.getElementById('name');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    const pwdRequiredStar = document.getElementById('pwd-required-star');
    const confPwdRequiredStar = document.getElementById('conf-pwd-required-star');

    let currentDataTable = null;

    const escapeHtml = (str) => {
        return String(str || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    };

    const getToastContainer = () => {
        let container = document.getElementById('assistants-toast-container');
        if (container) return container;

        container = document.createElement('div');
        container.id = 'assistants-toast-container';
        container.className = 'fixed bottom-4 right-4 z-[9999] flex w-[calc(100%-2rem)] max-w-xs flex-col gap-2 pointer-events-none';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
        return container;
    };

    const showToast = (type, message, onCloseCallback = null) => {
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
        toast.className = `flex items-start w-full p-3 text-gray-700 bg-white border ${config.borderClass} rounded-lg shadow-lg dark:bg-gray-900 dark:text-gray-200 transition-all duration-300 ease-out pointer-events-auto cursor-pointer`;
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
            <button type="button" class="cursor-pointer ms-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-900 focus:outline-none dark:hover:bg-gray-800 dark:hover:text-white" aria-label="Close">
                <span class="sr-only">Close</span>
                <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 17.94 6M18 18 6.06 6"/></svg>
            </button>
        `;

        let timerId = null;
        let isClosed = false;

        const removeToast = (isManual = false) => {
            if (isClosed) return;
            isClosed = true;
            if (timerId) clearTimeout(timerId);
            toast.classList.add('opacity-0', 'translate-y-3');
            window.setTimeout(() => {
                toast.remove();
                if (onCloseCallback) onCloseCallback(isManual);
            }, 300);
        };

        toast.querySelector('button')?.addEventListener('click', (e) => {
            e.stopPropagation();
            removeToast(true);
        });

        getToastContainer().appendChild(toast);
        timerId = window.setTimeout(() => removeToast(false), 5000);
        return removeToast;
    };

    const renderTable = () => {
        // Destroy existing Datatable to restore the original table DOM structure
        if (currentDataTable) {
            currentDataTable.destroy();
        }

        const dynamicTableBody = document.getElementById("assistants-table-body");
        if (!dynamicTableBody) return;

        dynamicTableBody.innerHTML = '';
        
        // Filter out archived assistants from view
        const activeAssistants = assistants.filter(asst => asst.status !== 'Archived');

        activeAssistants.forEach(asst => {
            const row = document.createElement('tr');
            row.className = 'assistant-row cursor-pointer bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors';
            row.setAttribute('data-id', asst.id);

            const isOnline = asst.status === 'Active';
            
            row.innerHTML = `
                <td class="w-4 p-4 text-center align-middle cursor-pointer">
                    <div class="flex items-center justify-center mt-3">
                        <input type="checkbox" value="${asst.id}" class="row-checkbox w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-sm focus:ring-blue-500 focus:ring-2 cursor-pointer">
                    </div>
                </td>
                <td class="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap text-left">
                    <div class="flex items-center gap-3">
                        <img class="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-800" src="${asst.avatar}" alt="${asst.name}">
                        <div class="flex flex-col justify-start text-left">
                            <span class="text-base font-semibold text-gray-900 dark:text-white leading-tight">${asst.name}</span>
                            <span class="font-normal text-xs text-gray-500 dark:text-gray-400 leading-normal">${asst.email}</span>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-left align-middle text-sm text-gray-900 dark:text-white font-medium">
                    ${asst.username}
                </td>
                <td class="px-6 py-4 text-left align-middle text-gray-500 dark:text-gray-400">
                    ${asst.phone || '<span class="italic text-gray-300 dark:text-gray-700 font-normal">None</span>'}
                </td>
                <td class="px-6 py-4 text-left align-middle">
                    <div class="flex items-center justify-start">
                        <span class="inline-flex items-center ${asst.status === 'Active' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' : asst.status === 'Archived' ? 'bg-gray-50 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800/50' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'} font-semibold px-2.5 py-1 rounded-md text-xs select-none gap-1.5">
                            <span class="w-1.5 h-1.5 ${asst.status === 'Active' ? 'bg-emerald-500' : asst.status === 'Archived' ? 'bg-gray-400' : 'bg-rose-500'} rounded-full"></span>
                            ${asst.status}
                        </span>
                    </div>
                </td>
                <td class="px-6 py-4 text-left align-middle">
                    <div class="flex items-center justify-start gap-1.5">
                        <!-- Edit Action -->
                        <div class="relative flex items-center justify-center">
                            <button type="button" title="Edit" class="btn-edit cursor-pointer p-2 rounded-lg text-blue-600 hover:text-gray-500 dark:text-blue-500 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <svg class="w-5 h-5 pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                </svg>
                            </button>
                        </div>
                        <!-- Archive Action -->
                        <div class="relative flex items-center justify-center">
                            <button type="button" title="Archive" class="btn-archive cursor-pointer p-2 rounded-lg text-red-600 hover:text-gray-500 dark:text-red-500 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <svg class="w-5 h-5 pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
                                    <path fill-rule="evenodd" d="M20 10H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM9 13v-1h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" clip-rule="evenodd"/>
                                    <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 1 1 0 4H4a2 2 0 0 1-2-2Z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </td>
            `;
            dynamicTableBody.appendChild(row);
        });

        // Initialize DataTable only if it isn't already initialized by another module
        if (typeof simpleDatatables !== 'undefined' && typeof simpleDatatables.DataTable !== 'undefined') {
            const isInitialized = document.querySelector('.dataTable-wrapper #sorting-table');
            if (!isInitialized) {
                currentDataTable = new simpleDatatables.DataTable("#sorting-table", {
                    searchable: false,
                    perPageSelect: false,
                    paging: false,
                    sortable: true
                });
                const wrapper = document.querySelector('.dataTable-wrapper');
                if (wrapper) wrapper.classList.add('overflow-y-auto', 'max-h-[600px]');
            }
        }

        renderGrid(activeAssistants);

        // Update counts using only active assistants
        const count = activeAssistants.length;
        const showingCount = document.getElementById('showing-count');
        const showingTotal1 = document.getElementById('showing-total-1');
        const showingTotal2 = document.getElementById('showing-total-2');
        if (showingCount) showingCount.textContent = count > 0 ? 1 : 0;
        if (showingTotal1) showingTotal1.textContent = count;
        if (showingTotal2) showingTotal2.textContent = count;

        // Enforce max 2 assistants limit
        const btnAddAsst = document.getElementById('btn-add-assistant');
        if (btnAddAsst) {
            if (count >= 2) {
                btnAddAsst.disabled = true;
                btnAddAsst.classList.add('opacity-50', 'cursor-not-allowed');
                btnAddAsst.classList.remove('cursor-pointer', 'hover:bg-blue-800', 'dark:hover:bg-blue-700', 'group', 'hover:-skew-x-12');
                btnAddAsst.setAttribute('title', 'Maximum of 2 assistants allowed per implementor');
            } else {
                btnAddAsst.disabled = false;
                btnAddAsst.classList.remove('opacity-50', 'cursor-not-allowed');
                btnAddAsst.classList.add('cursor-pointer', 'hover:bg-blue-800', 'dark:hover:bg-blue-700', 'group', 'hover:-skew-x-12');
                btnAddAsst.removeAttribute('title');
            }
        }
    };

    const renderGrid = (activeAssistants) => {
        const gridContainer = document.getElementById("grid-container");
        if (!gridContainer) return;

        gridContainer.innerHTML = '';
        if (!activeAssistants) activeAssistants = assistants.filter(a => a.status !== 'Archived');
        
        activeAssistants.forEach(asst => {
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-gray-800 shadow-md hover:shadow-lg border border-gray-200 dark:border-gray-700 transition-all overflow-hidden flex flex-col cursor-pointer group rounded-none';
            card.innerHTML = `
                <div class="p-6 flex-1">
                    <div class="flex justify-between items-start mb-6">
                        <img class="w-20 h-20 object-cover ring-4 ring-gray-100 dark:ring-gray-700/50 group-hover:scale-105 transition-transform duration-300 rounded-none shadow-sm" src="${asst.avatar}" alt="${asst.name}">
                        <span class="inline-flex items-center ${asst.status === 'Active' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' : asst.status === 'Archived' ? 'bg-gray-50 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800/50' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'} font-semibold px-2.5 py-1 rounded-md text-[10px] select-none gap-1.5 uppercase tracking-wider">
                            <span class="w-1.5 h-1.5 ${asst.status === 'Active' ? 'bg-emerald-500' : asst.status === 'Archived' ? 'bg-gray-400' : 'bg-rose-500'} rounded-full"></span>
                            ${asst.status}
                        </span>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white leading-tight mb-1 truncate">${asst.name}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 truncate mb-5">${asst.email}</p>
                    
                    <div class="space-y-3">
                        <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <svg class="w-4 h-4 mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                            <span class="truncate">${asst.username}</span>
                        </div>
                        <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <svg class="w-4 h-4 mr-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.069-3.769-6.665-6.666l1.292-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>
                            <span class="truncate">${asst.phone || 'None'}</span>
                        </div>
                    </div>
                </div>
                <div class="border-t border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800 p-4 flex justify-end gap-3">
                    <button type="button" title="Edit" class="grid-btn-edit cursor-pointer p-2 text-blue-600 hover:text-white dark:text-blue-500 dark:hover:text-white hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors rounded-none border border-transparent hover:border-blue-700" data-id="${asst.id}">
                        <svg class="w-5 h-5 pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                    </button>
                    <button type="button" title="Archive" class="grid-btn-archive cursor-pointer p-2 text-red-600 hover:text-white dark:text-red-500 dark:hover:text-white hover:bg-red-600 dark:hover:bg-red-600 transition-colors rounded-none border border-transparent hover:border-red-700" data-id="${asst.id}">
                        <svg class="w-5 h-5 pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M20 10H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM9 13v-1h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" clip-rule="evenodd"/><path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 1 1 0 4H4a2 2 0 0 1-2-2Z"/></svg>
                    </button>
                </div>
            `;
            gridContainer.appendChild(card);
        });
    };

    // Reset Form Helper
    const resetForm = () => {
        if (form) form.reset();
        if (idInput) idInput.value = '';
    };

    // Configure Add Mode
    const configureAddMode = () => {
        resetForm();
        if (modalTitle) modalTitle.textContent = 'Add Assistant';
        if (submitBtn) submitBtn.textContent = 'Add Assistant';
        if (passwordInput) { passwordInput.required = true; passwordInput.placeholder = '••••••••'; }
        if (confirmPasswordInput) confirmPasswordInput.required = true;
        if (pwdRequiredStar) pwdRequiredStar.classList.remove('hidden');
        if (confPwdRequiredStar) confPwdRequiredStar.classList.remove('hidden');
    };

    // Configure Edit Mode
    const configureEditMode = (asst) => {
        resetForm();
        if (modalTitle) modalTitle.textContent = 'Edit Assistant';
        if (submitBtn) submitBtn.textContent = 'Save Changes';

        if (idInput) idInput.value = asst.id;
        if (nameInput) nameInput.value = asst.name;
        if (usernameInput) usernameInput.value = asst.username;
        if (emailInput) emailInput.value = asst.email;
        if (phoneInput) phoneInput.value = asst.phone || '';

        // Passwords optional on edit
        if (passwordInput) { passwordInput.required = false; passwordInput.placeholder = 'Leave blank to keep current'; }
        if (confirmPasswordInput) confirmPasswordInput.required = false;
        if (pwdRequiredStar) pwdRequiredStar.classList.add('hidden');
        if (confPwdRequiredStar) confPwdRequiredStar.classList.add('hidden');
    };

    // Attach close listeners to modals explicitly
    const setupModalClose = (modalEl, modalInstance) => {
        if (!modalEl || !modalInstance) return;
        const closeBtns = modalEl.querySelectorAll('[data-modal-hide]');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modalInstance.hide();
            });
        });
    };
    setupModalClose(editModalEl, editModal);
    setupModalClose(viewModalEl, viewModal);
    setupModalClose(archiveModalEl, archiveModal);

    // Button Add Click
    const btnAdd = document.getElementById('btn-add-assistant');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            configureAddMode();
            if (editModal) editModal.show();
        });
    }

    const getUserId = () => {
        try {
            const session = JSON.parse(localStorage.getItem('dole_session') || '{}');
            return session.id;
        } catch {
            return null;
        }
    };

    const load = async () => {
        const staffId = getUserId();
        if (!staffId) return;

        const { data, error } = await fetchGipsByStaff(staffId);
        if (error) {
            window.DEBUG?.error('ASSISTANTS', 'Fetch failed', error);
            return;
        }
        
        assistants = data.map(g => ({
            id: String(g.id),
            name: g.full_name,
            username: g.username,
            email: g.email || '',
            phone: g.phone || '',
            status: g.status === 'online' ? 'Active' : 'Offline',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(g.full_name)}&background=random`
        }));

        renderTable();
    };

    const populateViewModal = (asst) => {
        const viewAvatar = document.getElementById('view-avatar');
        const viewOnlineDot = document.getElementById('view-online-dot');
        const viewName = document.getElementById('view-name');
        const viewEmail = document.getElementById('view-email');
        const viewUsername = document.getElementById('view-username');
        const viewPhone = document.getElementById('view-phone');
        const viewStatus = document.getElementById('view-status');

        if (viewAvatar) viewAvatar.src = asst.avatar;
        if (viewName) viewName.textContent = asst.name;
        if (viewEmail) viewEmail.textContent = asst.email;
        if (viewUsername) viewUsername.textContent = asst.username;
        if (viewPhone) viewPhone.textContent = asst.phone || 'None';
        
        if (viewOnlineDot) {
            viewOnlineDot.className = `absolute -bottom-1 -right-1 w-5 h-5 ${asst.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'} border-[3px] border-white dark:border-gray-800 rounded-full`;
        }
        if (viewStatus) {
            const badgeColor = asst.status === 'Active' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/40' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/40';
            const dotColor = asst.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500';
            viewStatus.className = `inline-flex items-center ${badgeColor} border font-semibold px-2 py-0.5 rounded text-xs mt-1 select-none`;
            viewStatus.innerHTML = `<span class="w-1.5 h-1.5 ${dotColor} rounded-full mr-1"></span>${asst.status}`;
        }
    };

    // Submit handler
    if (submitBtn && form) {
        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Check form validity natively
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const id = idInput.value;
            const name = nameInput.value.trim();
            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const phone = phoneInput.value.trim();
            const password = passwordInput.value;
            const confirm = confirmPasswordInput.value;

            // Password mismatch validation
            if (password !== confirm) {
                alert('Passwords do not match!');
                return;
            }

            const staffId = getUserId();
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-70', 'pointer-events-none');

            try {
                if (!id) {
                    // ADD
                    const payload = {
                        full_name: name,
                        username,
                        email: email || null,
                        phone: phone || null,
                        password,
                        created_by: staffId,
                        status: 'offline'
                    };
                    const res = await createGip(payload);
                    if (res.error) throw new Error(res.error);
                } else {
                    // EDIT
                    const updates = {
                        full_name: name,
                        username,
                        email: email || null,
                        phone: phone || null
                    };
                    if (password) {
                        updates.password = password;
                    }
                    const res = await updateGip(id, updates);
                    if (res.error) throw new Error(res.error);
                }

                await load();
                if (editModal) editModal.hide();
                if (document.activeElement) {
                    document.activeElement.blur();
                }
                showToast('success', `Assistant "${name}" saved successfully.`);
            } catch (err) {
                if (editModal) editModal.hide();
                showToast('danger', err.message || 'Failed to save assistant.', (isManual) => {
                    if (!isManual) {
                        if (editModal) editModal.show();
                    }
                });
            } finally {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-70', 'pointer-events-none');
            }
        });
    }

    // Archive Variables
    let assistantToArchiveId = null;
    const btnConfirmArchive = document.getElementById('btn-confirm-archive');
    const archiveAssistantName = document.getElementById('archive-assistant-name');

    if (btnConfirmArchive) {
        btnConfirmArchive.addEventListener('click', async () => {
            if (assistantToArchiveId) {
                btnConfirmArchive.disabled = true;
                const res = await archiveGip(assistantToArchiveId);
                btnConfirmArchive.disabled = false;
                if (res.error) {
                    alert('Error archiving assistant: ' + res.error);
                } else {
                    await load();
                }
                if (archiveModal) archiveModal.hide();
                assistantToArchiveId = null;
            }
        });
    }

    // Process Table Actions Delegation (View, Edit, Delete)
    document.addEventListener('click', (e) => {
        const table = e.target.closest('#sorting-table');
        if (!table) return;

        // Handle checkbox cell click separately to toggle checkbox
        const checkboxCell = e.target.closest('td:first-child');
        if (checkboxCell) {
            const cb = checkboxCell.querySelector('input[type="checkbox"]');
            if (cb && e.target.tagName !== 'INPUT') {
                cb.checked = !cb.checked;
            }
            return;
        }

        // Exclude inputs, checkboxes, headers
        if (e.target.closest('thead') || e.target.closest('input[type="checkbox"]')) return;

        const row = e.target.closest('.assistant-row');
        if (!row) return;

        const id = row.getAttribute('data-id');
        const asst = assistants.find(a => a.id === id);
        if (!asst) return;

        // Check if user clicked action buttons
        const editBtn = e.target.closest('.btn-edit');
        const archiveBtn = e.target.closest('.btn-archive');

        if (editBtn) {
            e.stopPropagation();
            configureEditMode(asst);
            if (editModal) editModal.show();
        } else if (archiveBtn) {
            e.stopPropagation();
            assistantToArchiveId = asst.id;
            if (archiveAssistantName) archiveAssistantName.textContent = asst.name;
            if (archiveModal) archiveModal.show();
        } else {
            // View Details Modal
            populateViewModal(asst);
            const triggerBtn = document.getElementById('trigger-view-modal-dummy');
            if (triggerBtn) triggerBtn.click();
        }
    });

    // Checkbox All toggle
    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'table-checkbox-all') {
            const checked = e.target.checked;
            document.querySelectorAll('.row-checkbox').forEach(cb => {
                cb.checked = checked;
            });
        }
    });

    // Live search input
    const searchInput = document.getElementById('input-group-1');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            document.querySelectorAll('.assistant-row').forEach(row => {
                const id = row.getAttribute('data-id');
                const asst = assistants.find(a => a.id === id);
                if (asst) {
                    const match = asst.name.toLowerCase().includes(query) ||
                                  asst.username.toLowerCase().includes(query) ||
                                  asst.email.toLowerCase().includes(query);
                    if (match) {
                        row.classList.remove('hidden');
                    } else {
                        row.classList.add('hidden');
                    }
                }
            });
        });
    }

    // Action Dropdown Bulk operations
    const bulkActivate = document.getElementById('bulk-activate');
    const bulkDeactivate = document.getElementById('bulk-deactivate');
    const bulkDelete = document.getElementById('bulk-delete');

    const getCheckedIds = () => {
        const ids = [];
        document.querySelectorAll('.row-checkbox:checked').forEach(cb => {
            ids.push(cb.value);
        });
        return ids;
    };

    if (bulkActivate) {
        bulkActivate.addEventListener('click', async (e) => {
            e.preventDefault();
            const checkedIds = getCheckedIds();
            if (checkedIds.length === 0) return;
            for (const id of checkedIds) {
                await updateGip(id, { status: 'online' });
            }
            await load();
            if (checkboxAll) checkboxAll.checked = false;
        });
    }

    if (bulkDeactivate) {
        bulkDeactivate.addEventListener('click', async (e) => {
            e.preventDefault();
            const checkedIds = getCheckedIds();
            if (checkedIds.length === 0) return;
            for (const id of checkedIds) {
                await updateGip(id, { status: 'offline' });
            }
            await load();
            if (checkboxAll) checkboxAll.checked = false;
        });
    }

    if (bulkDelete) {
        bulkDelete.addEventListener('click', async (e) => {
            e.preventDefault();
            const checkedIds = getCheckedIds();
            if (checkedIds.length === 0) return;
            if (confirm(`Are you sure you want to archive the ${checkedIds.length} selected assistants?`)) {
                for (const id of checkedIds) {
                    await archiveGip(id);
                }
                await load();
                if (checkboxAll) checkboxAll.checked = false;
            }
        });
    }

    // Toggle View Logic
    const btnViewTable = document.getElementById('btn-view-table');
    const btnViewGrid = document.getElementById('btn-view-grid');
    const gridContainer = document.getElementById('grid-container');
    const tableContainer = document.querySelector('.overflow-x-auto');

    const setActiveViewBtn = (activeBtn, inactiveBtn) => {
        activeBtn.classList.add('bg-gray-100', 'text-blue-700', 'dark:bg-gray-700');
        activeBtn.classList.remove('text-gray-900', 'dark:text-white');
        inactiveBtn.classList.remove('bg-gray-100', 'text-blue-700', 'dark:bg-gray-700');
        inactiveBtn.classList.add('text-gray-900', 'dark:text-white');
    };

    if (btnViewTable && btnViewGrid && gridContainer && tableContainer) {
        btnViewTable.addEventListener('click', () => {
            gridContainer.classList.add('hidden');
            gridContainer.classList.remove('grid');
            tableContainer.classList.remove('hidden');
            setActiveViewBtn(btnViewTable, btnViewGrid);
        });

        btnViewGrid.addEventListener('click', () => {
            tableContainer.classList.add('hidden');
            gridContainer.classList.remove('hidden');
            gridContainer.classList.add('grid');
            setActiveViewBtn(btnViewGrid, btnViewTable);
        });
    }

    // Grid Event Delegation for Edit/Archive
    if (gridContainer) {
        gridContainer.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.grid-btn-edit');
            const archiveBtn = e.target.closest('.grid-btn-archive');
            
            if (editBtn) {
                e.stopPropagation();
                const id = editBtn.getAttribute('data-id');
                const asst = assistants.find(a => a.id === id);
                if (asst) {
                    configureEditMode(asst);
                    if (editModal) editModal.show();
                }
            } else if (archiveBtn) {
                e.stopPropagation();
                const id = archiveBtn.getAttribute('data-id');
                const asst = assistants.find(a => a.id === id);
                if (asst) {
                    assistantToArchiveId = asst.id;
                    if (archiveAssistantName) archiveAssistantName.textContent = asst.name;
                    if (archiveModal) archiveModal.show();
                }
            } else {
                // View action
                const card = e.target.closest('.bg-white.dark\\:bg-gray-800');
                if (card) {
                    const editGridBtn = card.querySelector('.grid-btn-edit');
                    if (editGridBtn) {
                        const id = editGridBtn.getAttribute('data-id');
                        const asst = assistants.find(a => a.id === id);
                        if (asst) {
                            populateViewModal(asst);
                            if (viewModal) viewModal.show();
                        }
                    }
                }
            }
        });
    }

    // Initial render
    load();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAssistantsManage);
} else {
    initAssistantsManage();
}
/* END STAFF ASSISTANTS MANAGEMENT CONTROLLER */
