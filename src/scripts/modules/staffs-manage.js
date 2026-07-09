export const initStaffsManage = () => {
    // Only run on the staffs page (or wherever sorting-table is present)
    const tableEl = document.getElementById("sorting-table");
    if (tableEl && typeof simpleDatatables !== 'undefined' && typeof simpleDatatables.DataTable !== 'undefined') {
        const dataTable = new simpleDatatables.DataTable("#sorting-table", {
            searchable: false,
            perPageSelect: false,
            paging: false,
            sortable: true
        });

        // Apply overflow wrapper for scroll
        const tableWrapper = document.querySelector('.dataTable-wrapper');
        if (tableWrapper) {
            tableWrapper.classList.add('overflow-y-auto', 'max-h-[600px]');
        }

        // ----------------------------------------------------------------
        // MODAL ELEMENT REFERENCES
        // ----------------------------------------------------------------
        const modalTitle    = document.getElementById('modal-title');
        const submitBtn     = document.querySelector('#editUserModal button[type="submit"]');

        const staffNameSec          = document.getElementById('modal-staff-selector-sec');
        const staffNameInput        = document.getElementById('name'); // now a text input
        const gipNameSec            = document.getElementById('modal-gip-name-sec');
        const gipNameInput          = document.getElementById('gip-name-input');

        const positionSec           = document.getElementById('modal-position-sec');
        const officeSec             = document.getElementById('modal-office-sec');

        const usernameInput         = document.getElementById('username');
        const emailInput            = document.getElementById('email');
        const phoneInput            = document.getElementById('phone');

        const passwordSec           = document.getElementById('modal-password-sec');
        const passwordInput         = document.getElementById('password');
        const confirmPasswordSec    = document.getElementById('modal-confirm-password-sec');
        const confirmPasswordInput  = document.getElementById('confirm-password');

        const gipListSec            = document.getElementById('modal-gip-list-sec');
        const gipsFormContainer     = document.getElementById('gips-form-container');
        const btnAddGip             = document.getElementById('btn-add-gip');

        const MAX_GIP = 2;

        // ----------------------------------------------------------------
        // HELPER: Update Add GIP button state (disabled after max)
        // ----------------------------------------------------------------
        const updateGipBtnState = () => {
            if (!btnAddGip || !gipsFormContainer) return;
            const count = gipsFormContainer.children.length;
            if (count >= MAX_GIP) {
                btnAddGip.disabled = true;
                btnAddGip.classList.add('opacity-50', 'cursor-not-allowed');
                btnAddGip.classList.remove('cursor-pointer', 'hover:bg-blue-800', 'dark:hover:bg-blue-700');
            } else {
                btnAddGip.disabled = false;
                btnAddGip.classList.remove('opacity-50', 'cursor-not-allowed');
                btnAddGip.classList.add('cursor-pointer', 'hover:bg-blue-800', 'dark:hover:bg-blue-700');
            }
        };

        // ----------------------------------------------------------------
        // HELPER: Reset the form to a blank state
        // ----------------------------------------------------------------
        const resetForm = () => {
            if (staffNameInput) { staffNameInput.value = ''; staffNameInput.required = false; }
            if (gipNameInput)   { gipNameInput.value = ''; gipNameInput.required = false; }
            if (usernameInput)  { usernameInput.value = ''; }
            if (emailInput)     { emailInput.value = ''; }
            if (phoneInput)     { phoneInput.value = ''; }
            if (passwordInput)  { passwordInput.value = ''; passwordInput.required = false; passwordInput.placeholder = '••••••••'; }
            if (confirmPasswordInput) { confirmPasswordInput.value = ''; confirmPasswordInput.required = false; }
            if (gipsFormContainer) gipsFormContainer.innerHTML = '';
            updateGipBtnState();
        };

        // ----------------------------------------------------------------
        // HELPER: Configure modal for ADD STAFF mode
        // ----------------------------------------------------------------
        const configureAddMode = () => {
            resetForm();
            if (modalTitle)  modalTitle.textContent = 'Add Staff';
            if (submitBtn)   submitBtn.textContent  = 'Add Staff';

            // Show staff name input, hide GIP name input
            if (staffNameSec) staffNameSec.classList.remove('hidden');
            if (gipNameSec)   gipNameSec.classList.add('hidden');
            if (staffNameInput) staffNameInput.required = true;
            if (gipNameInput)   gipNameInput.required  = false;

            // Show position + office
            if (positionSec) positionSec.classList.remove('hidden');
            if (officeSec)   officeSec.classList.remove('hidden');

            // Username & email required
            if (usernameInput) usernameInput.required = true;
            if (emailInput)    emailInput.required    = true;

            // Password required, confirm password visible
            if (passwordInput)        { passwordInput.required = true; passwordInput.placeholder = '••••••••'; }
            if (confirmPasswordSec)   confirmPasswordSec.classList.remove('hidden');
            if (confirmPasswordInput) confirmPasswordInput.required = true;

            // Show GIP section
            if (gipListSec) gipListSec.classList.remove('hidden');
            updateGipBtnState();
        };

        // ----------------------------------------------------------------
        // HELPER: Configure modal for EDIT STAFF (parent) mode
        // ----------------------------------------------------------------
        const configureEditStaffMode = (data = {}) => {
            resetForm();
            if (modalTitle) modalTitle.textContent = 'Edit Staff';
            if (submitBtn)  submitBtn.textContent  = 'Save Changes';

            // Show staff name input, prefill
            if (staffNameSec) staffNameSec.classList.remove('hidden');
            if (gipNameSec)   gipNameSec.classList.add('hidden');
            if (staffNameInput) { staffNameInput.required = true; staffNameInput.value = data.name || ''; }
            if (gipNameInput)   gipNameInput.required = false;

            // Show position + office
            if (positionSec) positionSec.classList.remove('hidden');
            if (officeSec)   officeSec.classList.remove('hidden');

            // Prefill user fields
            if (usernameInput) { usernameInput.value = data.username || ''; usernameInput.required = true; }
            if (emailInput)    { emailInput.value    = data.email    || ''; emailInput.required    = true; }
            if (phoneInput)    { phoneInput.value    = data.phone    || ''; }

            // Password optional (update only if filled), hide confirm password
            if (passwordInput)        { passwordInput.required = false; passwordInput.placeholder = 'Leave blank to keep current'; }
            if (confirmPasswordSec)   confirmPasswordSec.classList.add('hidden');
            if (confirmPasswordInput) confirmPasswordInput.required = false;

            // Show GIP section
            if (gipListSec) gipListSec.classList.remove('hidden');
            updateGipBtnState();
        };

        // ----------------------------------------------------------------
        // HELPER: Configure modal for EDIT GIP ASSISTANT mode
        // ----------------------------------------------------------------
        const configureEditGipMode = (data = {}) => {
            resetForm();
            if (modalTitle) modalTitle.textContent = 'Edit GIP Assistant';
            if (submitBtn)  submitBtn.textContent  = 'Save Changes';

            // Hide staff name input, show GIP name input
            if (staffNameSec) staffNameSec.classList.add('hidden');
            if (gipNameSec)   gipNameSec.classList.remove('hidden');
            if (staffNameInput) staffNameInput.required = false;
            if (gipNameInput)   { gipNameInput.required = true; gipNameInput.value = data.name || ''; }

            // Hide position + office (GIP inherits from parent)
            if (positionSec) positionSec.classList.add('hidden');
            if (officeSec)   officeSec.classList.add('hidden');

            // Prefill user fields
            if (usernameInput) { usernameInput.value = data.username || ''; usernameInput.required = true; }
            if (emailInput)    { emailInput.value    = data.email    || ''; emailInput.required    = true; }
            if (phoneInput)    { phoneInput.value    = data.phone    || ''; }

            // Password optional, hide confirm password
            if (passwordInput)        { passwordInput.required = false; passwordInput.placeholder = 'Leave blank to keep current'; }
            if (confirmPasswordSec)   confirmPasswordSec.classList.add('hidden');
            if (confirmPasswordInput) confirmPasswordInput.required = false;

            // Hide GIP list section (not relevant when editing a GIP directly)
            if (gipListSec) gipListSec.classList.add('hidden');
        };

        // ----------------------------------------------------------------
        // ADD STAFF button click handler
        // ----------------------------------------------------------------
        const addStaffBtn = document.getElementById('btn-add-staff');
        if (addStaffBtn) {
            addStaffBtn.addEventListener('click', () => {
                configureAddMode();
            });
        }

        // ----------------------------------------------------------------
        // Event delegation: collapse/expand implementor sub-rows
        // ----------------------------------------------------------------
        tableEl.addEventListener('click', (e) => {
            const button = e.target.closest('[data-collapse-toggle]');
            if (!button) return;
            e.stopPropagation();

            const targetId = button.getAttribute('data-collapse-toggle');
            document.querySelectorAll(`.${targetId}, #${targetId}`).forEach(row => {
                row.classList.toggle('hidden');
            });

            const arrow = button.querySelector('svg');
            if (arrow) arrow.classList.toggle('rotate-180');
        });

        // ----------------------------------------------------------------
        // Event delegation: PARENT row → View modal (click on row body)
        // ----------------------------------------------------------------
        tableEl.addEventListener('click', (e) => {
            if (e.target.closest('[data-collapse-toggle]') ||
                e.target.closest('input[type="checkbox"]') ||
                e.target.closest('button') ||
                e.target.closest('a') ||
                e.target.closest('svg')) {
                return;
            }

            const row = e.target.closest('.parent-row');
            if (!row) return;

            const avatarSrc    = row.querySelector('img')?.getAttribute('src') || '';
            const nameText     = row.querySelector('.text-base.font-semibold')?.textContent.trim() || '';
            const emailText    = row.querySelector('.font-normal.text-xs')?.textContent.trim() || '';
            const positionText = row.querySelector('td:nth-child(3)')?.textContent.trim() || '';
            const officeText   = row.querySelector('td:nth-child(4)')?.textContent.trim() || '';
            const statusEl     = row.querySelector('td:nth-child(5) span');
            const statusText   = statusEl?.textContent.trim() || '';
            const isOnline     = statusText.toLowerCase().includes('online');

            // GIP children
            const toggleBtn = row.querySelector('[data-collapse-toggle]');
            const targetClass = toggleBtn ? toggleBtn.getAttribute('data-collapse-toggle') : '';
            const gips = [];
            if (targetClass) {
                document.querySelectorAll(`.${targetClass}`).forEach(childRow => {
                    const identityBlock = childRow.querySelector('td:nth-child(2) .flex-col');
                    const identityText  = identityBlock ? Array.from(identityBlock.querySelectorAll('span')) : [];
                    const gipName       = identityText[0]?.textContent.trim() || '';
                    const gipEmail      = identityText[1]?.textContent.trim() || '';
                    const gipImg        = childRow.querySelector('img')?.getAttribute('src') || '';
                    if (gipName) gips.push({ name: gipName, email: gipEmail, img: gipImg });
                });
            }

            // Populate View Modal — new premium layout
            const modalAvatar = document.getElementById('view-avatar');
            if (modalAvatar) modalAvatar.src = avatarSrc;
            const modalName = document.getElementById('view-name');
            if (modalName) modalName.textContent = nameText;
            const modalEmail = document.getElementById('view-email');
            if (modalEmail) modalEmail.textContent = emailText;
            const modalPosition = document.getElementById('view-position');
            if (modalPosition) modalPosition.textContent = positionText;
            const modalOffice = document.getElementById('view-office');
            if (modalOffice) modalOffice.textContent = officeText;

            // Online dot indicator
            const onlineDot = document.getElementById('view-online-dot');
            if (onlineDot) {
                if (isOnline) {
                    onlineDot.className = 'absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-[3px] border-white dark:border-gray-800 rounded-full';
                } else {
                    onlineDot.className = 'absolute -bottom-1 -right-1 w-5 h-5 bg-rose-500 border-[3px] border-white dark:border-gray-800 rounded-full';
                }
            }

            // Status badge
            const modalStatus = document.getElementById('view-status');
            if (modalStatus) {
                if (isOnline) {
                    modalStatus.className = 'inline-flex items-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold px-2.5 py-1 rounded-md text-xs border border-emerald-200 dark:border-emerald-800/40 gap-1.5 select-none';
                    modalStatus.innerHTML = '<span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>Online';
                } else {
                    modalStatus.className = 'inline-flex items-center bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold px-2.5 py-1 rounded-md text-xs border border-rose-200 dark:border-rose-800/40 gap-1.5 select-none';
                    modalStatus.innerHTML = '<span class="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>Offline';
                }
            }

            // GIP cards — new layout with email and horizontal badges
            const gipsContainer = document.getElementById('view-gips-container');
            if (gipsContainer) {
                gipsContainer.innerHTML = '';
                if (gips.length === 0) {
                    gipsContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 italic">No linked GIP implementors</p>';
                } else {
                    gips.forEach(gip => {
                        gipsContainer.innerHTML += `
                            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800/50 transition-colors">
                                <img class="w-9 h-9 rounded-lg object-cover ring-2 ring-white dark:ring-gray-700 shadow-sm" src="${gip.img}" alt="${gip.name}">
                                <div class="flex-1 min-w-0">
                                    <h5 class="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">${gip.name}</h5>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">${gip.email}</p>
                                </div>
                                <span class="inline-flex items-center bg-gradient-to-r from-blue-800 to-blue-950 text-white dark:from-blue-500 dark:via-blue-600 dark:to-blue-400 dark:shadow-[0_0_8px_rgba(59,130,246,0.5)] font-semibold px-1.5 py-0.5 rounded text-[9px] select-none border-none shrink-0">GIP</span>
                            </div>
                        `;
                    });
                }
            }

            const triggerBtn = document.getElementById('trigger-view-modal-dummy');
            if (triggerBtn) triggerBtn.click();
        });

        // ----------------------------------------------------------------
        // Event delegation: edit button → configure Edit Staff or Edit GIP
        // ----------------------------------------------------------------
        tableEl.addEventListener('click', (e) => {
            const editBtn = e.target.closest('button[data-modal-target="editUserModal"]');
            if (!editBtn) return;
            e.stopPropagation();

            const parentRow = editBtn.closest('.parent-row');
            const childRow  = editBtn.closest('tr:not(.parent-row)');

            if (parentRow) {
                const nameText  = parentRow.querySelector('.text-base.font-semibold')?.textContent.trim() || '';
                const emailText = parentRow.querySelector('.font-normal.text-xs')?.textContent.trim() || '';
                configureEditStaffMode({ name: nameText, email: emailText });
            } else if (childRow) {
                const gipName  = childRow.querySelector('.font-semibold.text-sm')?.textContent.trim() || '';
                const gipEmail = childRow.querySelector('.flex-col span:nth-child(2)')?.textContent.trim()
                              || childRow.querySelector('.flex-col span:last-child')?.textContent.trim() || '';
                configureEditGipMode({ name: gipName, email: gipEmail });
            }
        });

        // ----------------------------------------------------------------
        // Dynamic GIP form block (Add GIP button inside the modal)
        // Max 2 GIP assistants per implementor
        // ----------------------------------------------------------------
        if (btnAddGip && gipsFormContainer) {
            btnAddGip.addEventListener('click', () => {
                if (gipsFormContainer.children.length >= MAX_GIP) return;

                const blockIndex = gipsFormContainer.children.length + 1;
                const gipBlock = document.createElement('div');
                gipBlock.className = 'p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-3 relative';
                gipBlock.innerHTML = `
                    <div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                        <span class="text-xs font-extrabold text-blue-600 dark:text-blue-500 uppercase tracking-wider">GIP Assistant #${blockIndex}</span>
                        <button type="button" class="cursor-pointer text-red-600 hover:text-red-500 dark:text-red-500 dark:hover:text-red-400 font-bold text-xs inline-flex items-center gap-1 btn-remove-gip transition-colors">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
                            </svg>
                            Remove
                        </button>
                    </div>
                    <div class="grid gap-3 grid-cols-2">
                        <div class="col-span-2 sm:col-span-1">
                            <label class="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">Full Name <span class="text-red-500">*</span></label>
                            <input type="text" name="gip_name[]" placeholder="Enter GIP full name" class="bg-white border border-gray-300 text-gray-900 text-xs focus:ring-blue-600 focus:border-blue-600 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" required>
                        </div>
                        <div class="col-span-2 sm:col-span-1">
                            <label class="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">Username <span class="text-red-500">*</span></label>
                            <input type="text" name="gip_username[]" placeholder="Enter GIP username" class="bg-white border border-gray-300 text-gray-900 text-xs focus:ring-blue-600 focus:border-blue-600 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" required>
                        </div>
                        <div class="col-span-2 sm:col-span-1">
                            <label class="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">Email Address <span class="text-red-500">*</span></label>
                            <input type="email" name="gip_email[]" placeholder="gip@dole.gov.ph" class="bg-white border border-gray-300 text-gray-900 text-xs focus:ring-blue-600 focus:border-blue-600 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" required>
                        </div>
                        <div class="col-span-2 sm:col-span-1">
                            <label class="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">Phone Number <span class="text-gray-400 font-normal">(Optional)</span></label>
                            <input type="tel" name="gip_phone[]" placeholder="e.g. +63 912 345 6789" class="bg-white border border-gray-300 text-gray-900 text-xs focus:ring-blue-600 focus:border-blue-600 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500">
                        </div>
                        <div class="col-span-2 sm:col-span-1">
                            <label class="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">Password <span class="text-red-500">*</span></label>
                            <input type="password" name="gip_password[]" placeholder="••••••••" class="bg-white border border-gray-300 text-gray-900 text-xs focus:ring-blue-600 focus:border-blue-600 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" required>
                        </div>
                        <div class="col-span-2 sm:col-span-1">
                            <label class="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">Confirm Password <span class="text-red-500">*</span></label>
                            <input type="password" name="gip_confirm_password[]" placeholder="••••••••" class="bg-white border border-gray-300 text-gray-900 text-xs focus:ring-blue-600 focus:border-blue-600 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" required>
                        </div>
                    </div>
                `;

                gipBlock.querySelector('.btn-remove-gip').addEventListener('click', () => {
                    gipBlock.remove();
                    // Re-index remaining blocks
                    Array.from(gipsFormContainer.children).forEach((child, idx) => {
                        const label = child.querySelector('span');
                        if (label) label.textContent = `GIP Assistant #${idx + 1}`;
                    });
                    updateGipBtnState();
                });

                gipsFormContainer.appendChild(gipBlock);
                updateGipBtnState();
            });
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStaffsManage);
} else {
    initStaffsManage();
}
