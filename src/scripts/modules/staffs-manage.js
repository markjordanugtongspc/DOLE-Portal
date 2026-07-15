
import { Modal } from 'flowbite';
import { archiveGip, createGip, fetchAllGips, updateGip } from '@/backend/api/gips.api.js';
import { archiveUser, createUser, fetchOffices, fetchRoles, fetchUsers, updateUser } from '@/backend/api/users.api.js';

export const initStaffsManage = () => {
    const table = document.getElementById('sorting-table');
    const tbody = document.getElementById('staffs-table-body') || table?.querySelector('tbody');
    const addBtn = document.getElementById('btn-add-staff');
    if (!table || !tbody || !addBtn) return;
    window.DEBUG?.flow('STAFFS', 'Booting Supabase-backed staff manager.');

    const editEl = document.getElementById('editUserModal');
    const viewEl = document.getElementById('viewUserModal');
    const editModal = editEl ? new Modal(editEl) : null;
    const viewModal = viewEl ? new Modal(viewEl) : null;
    const form = editEl?.querySelector('form');
    const q = (id) => document.getElementById(id);
    const els = {
        title: q('modal-title'), submit: editEl?.querySelector('button[type="submit"]'),
        staffSec: q('modal-staff-selector-sec'), staffName: q('name'), gipSec: q('modal-gip-name-sec'), gipName: q('gip-name-input'),
        roleSec: q('modal-position-sec'), role: q('position'), officeSec: q('modal-office-sec'), office: q('office'),
        username: q('username'), email: q('email'), phone: q('phone'), password: q('password'), confirmSec: q('modal-confirm-password-sec'), confirm: q('confirm-password'),
        gipList: q('modal-gip-list-sec'), gipBox: q('gips-form-container'), addGip: q('btn-add-gip'), search: q('input-group-1'), selectAll: q('table-checkbox-45'),
        birthdaySec: q('modal-birthday-sec'), birthday: q('birthday'), pinSec: q('modal-pin-sec'), pin: q('pin'),
        pinRequiredStar: q('pin-required-star'), pwdRequiredStar: q('pwd-required-star'), confPwdRequiredStar: q('conf-pwd-required-star')
    };

    let users = [], gips = [], roles = [], offices = [], dt = null, mode = 'add-staff', recordId = null, staffId = null, positionDropdown = null, officeDropdown = null;
    const MAX_GIP = 2;
    const esc = (v = '') => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const avatar = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`;
    const na = (v) => v ? esc(v) : '<span class="italic text-gray-400 dark:text-gray-600">N/A</span>';
    const roleName = (u) => u?.roles?.name || roles.find(r => Number(r.id) === Number(u?.role_id))?.name || `Role ${u?.role_id || 'N/A'}`;
    const officeName = (u) => u?.offices?.name || offices.find(o => Number(o.id) === Number(u?.office_id))?.name || 'N/A';
    const staffGips = (id) => gips.filter(g => Number(g.created_by) === Number(id));
    const badge = (status = 'offline') => {
        const online = String(status).toLowerCase() === 'online';
        return `<span class="inline-flex items-center ${online ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'} font-semibold px-2.5 py-1 rounded-md text-xs select-none gap-1.5"><span class="w-1.5 h-1.5 ${online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'} rounded-full"></span>${online ? 'Online' : 'Offline'}</span>`;
    };
    const destroyTable = () => { if (dt) { dt.destroy(); dt = null; } };
    const initTable = () => {
        if (typeof simpleDatatables === 'undefined' || typeof simpleDatatables.DataTable === 'undefined') return;
        dt = new simpleDatatables.DataTable('#sorting-table', { searchable: false, perPageSelect: false, paging: false, sortable: true });
        document.querySelector('.dataTable-wrapper')?.classList.add('overflow-y-auto', 'max-h-[600px]');
    };

    const render = (list = users) => {
        destroyTable();
        tbody.innerHTML = '';
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-10 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">No staff records found in Supabase.</td></tr>';
            return;
        }
        list.forEach(user => {
            const kids = staffGips(user.id), childClass = `impl-row-${user.id}`;
            tbody.insertAdjacentHTML('beforeend', `
                <tr class="parent-row cursor-pointer bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" data-id="${user.id}">
                    <td class="w-4 p-4 text-center align-middle"><input type="checkbox" value="${user.id}" class="row-checkbox w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-sm focus:ring-blue-500 focus:ring-2 cursor-pointer"></td>
                    <td class="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap text-left"><div class="flex items-center gap-3"><img class="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-800" src="${avatar(user.full_name)}" alt="${esc(user.full_name)}"><div class="flex flex-col justify-start text-left"><div class="flex items-center gap-2"><span class="text-base font-semibold text-gray-900 dark:text-white leading-tight">${na(user.full_name)}</span>${kids.length ? `<button data-collapse-toggle="${childClass}" class="cursor-pointer text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none transition-colors" type="button" title="View GIP assistants"><svg class="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"></path></svg></button>` : ''}</div><div class="font-normal text-xs text-gray-500 dark:text-gray-400 leading-normal">${na(user.email)}</div></div></div></td>
                    <td class="px-6 py-4 text-left align-middle text-sm text-gray-900 dark:text-white font-medium">${esc(roleName(user))}</td>
                    <td class="px-6 py-4 text-left align-middle text-gray-500 dark:text-gray-400">${esc(officeName(user))}</td>
                    <td class="px-6 py-4 text-left align-middle"><div class="flex items-center justify-start">${badge(user.status)}</div></td>
                    <td class="px-6 py-4 text-left align-middle"><div class="flex items-center justify-start gap-1.5"><button type="button" data-action="edit-staff" data-id="${user.id}" class="cursor-pointer p-2 rounded-lg text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800" title="Edit staff"><svg class="w-5 h-5 pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button><button type="button" data-action="archive-staff" data-id="${user.id}" class="cursor-pointer p-2 rounded-lg text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800" title="Archive staff"><svg class="w-5 h-5 pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M20 10H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM9 13v-1h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" clip-rule="evenodd"/><path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 1 1 0 4H4a2 2 0 0 1-2-2Z"/></svg></button></div></td>
                </tr>`);
            kids.forEach(gip => tbody.insertAdjacentHTML('beforeend', `
                <tr class="${childClass} hidden bg-gray-50/80 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-800" data-id="${gip.id}" data-parent-id="${user.id}">
                    <td class="w-4 p-4 text-center align-middle"><input type="checkbox" value="gip:${gip.id}" class="row-checkbox w-4 h-4 text-blue-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-sm focus:ring-blue-500 focus:ring-2 cursor-pointer"></td>
                    <td class="px-6 py-3 text-left"><div class="ms-8 flex items-center gap-3"><img class="w-8 h-8 rounded-lg object-cover ring-2 ring-white dark:ring-gray-700" src="${avatar(gip.full_name)}" alt="${esc(gip.full_name)}"><div class="flex flex-col"><span class="font-semibold text-sm text-gray-900 dark:text-white">${na(gip.full_name)}</span><span class="text-xs text-gray-500 dark:text-gray-400">${na(gip.email)}</span></div><span class="inline-flex items-center bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 text-[10px] font-black px-1.5 py-0.5 rounded">GIP</span></div></td>
                    <td class="px-6 py-3 text-left text-sm text-gray-900 dark:text-white font-medium">Assistant</td><td class="px-6 py-3 text-left text-gray-500 dark:text-gray-400">Assigned to ${esc(user.full_name || 'staff')}</td><td class="px-6 py-3 text-left">${badge(gip.status)}</td>
                    <td class="px-6 py-3 text-left"><button type="button" data-action="edit-gip" data-id="${gip.id}" class="cursor-pointer p-2 rounded-lg text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800" title="Edit assistant"><svg class="w-5 h-5 pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg></button><button type="button" data-action="archive-gip" data-id="${gip.id}" class="cursor-pointer p-2 rounded-lg text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800" title="Archive assistant"><svg class="w-5 h-5 pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M20 10H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM9 13v-1h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" clip-rule="evenodd"/><path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 1 1 0 4H4a2 2 0 0 1-2-2Z"/></svg></button></td>
                </tr>`));
        });
        initTable();
        if (els.selectAll) els.selectAll.checked = false;
        window.DEBUG?.success('STAFFS', 'Rendered staff table from Supabase.', { users: list.length, gips: gips.length });
    };

    const populateSelects = () => {
        const roleOptions = roles.length ? roles : [{ id: 3, name: 'Staff' }, { id: 4, name: 'HR' }];
        if (positionDropdown) {
            positionDropdown.updateOptions(roleOptions.map(r => ({ value: r.id, label: r.name || `Role ${r.id}` })));
        }
        if (officeDropdown) {
            const officeOptions = [{ value: '', label: 'No office assigned' }, ...offices.map(o => ({ value: o.id, label: o.name || `Office ${o.id}` }))];
            officeDropdown.updateOptions(officeOptions);
            const skeleton = document.getElementById('office-loading-skeleton');
            if (skeleton) skeleton.classList.add('hidden');
            const officeBtn = document.getElementById('office-dropdown-btn');
            if (officeBtn) officeBtn.classList.remove('hidden');
        }
    };
    const load = async () => {
        destroyTable();
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-10 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">Loading staff records...</td></tr>';
        window.DEBUG?.flow('STAFFS', 'Fetching users, roles, offices, and GIP assistants.');
        const [ur, gr, rr, or] = await Promise.all([fetchUsers(), fetchAllGips(), fetchRoles(), fetchOffices()]);
        if (ur.error) window.DEBUG?.error('STAFFS', 'Users fetch failed.', ur.error);
        if (gr.error) window.DEBUG?.error('STAFFS', 'GIPs fetch failed.', gr.error);
        users = ur.data || []; gips = gr.data || []; roles = rr.data || []; offices = or.data || [];
        populateSelects(); render(users);
    };

    const gipBtnState = () => {
        if (!els.addGip || !els.gipBox) return;
        const remaining = MAX_GIP - (staffId ? staffGips(staffId).length : 0);
        const disabled = els.gipBox.children.length >= remaining;
        els.addGip.disabled = disabled;
        els.addGip.classList.toggle('opacity-50', disabled);
        els.addGip.classList.toggle('cursor-not-allowed', disabled);
    };
    const resetForm = () => {
        form?.reset();
        recordId = null;
        staffId = null;
        if (els.gipBox) els.gipBox.innerHTML = '';
        if (els.birthday) els.birthday.value = '';
        if (els.pin) els.pin.value = '';
        if (positionDropdown) positionDropdown.setValue('');
        if (officeDropdown) officeDropdown.setValue('');
        gipBtnState();
    };
    const showSections = ({ gipMode = false, staffMode = true, gipList = true }) => {
        els.staffSec?.classList.toggle('hidden', gipMode); els.gipSec?.classList.toggle('hidden', !gipMode);
        els.roleSec?.classList.toggle('hidden', !staffMode); els.officeSec?.classList.toggle('hidden', !staffMode); els.gipList?.classList.toggle('hidden', !gipList);
        els.birthdaySec?.classList.toggle('hidden', gipMode); els.pinSec?.classList.toggle('hidden', gipMode);
        if (els.staffName) els.staffName.required = !gipMode; if (els.gipName) els.gipName.required = gipMode; if (els.role) els.role.required = staffMode;
    };
    const addMode = () => {
        resetForm(); mode = 'add-staff'; showSections({ gipMode: false, staffMode: true, gipList: true });
        if (els.title) els.title.textContent = 'Add Staff'; if (els.submit) els.submit.textContent = 'Add Staff';
        if (els.password) { els.password.required = true; els.password.placeholder = 'Password'; }
        if (els.confirm) { els.confirm.required = true; }
        if (els.pin) { els.pin.required = true; els.pin.placeholder = 'e.g. 1234'; }
        els.confirmSec?.classList.remove('hidden');
        if (els.pwdRequiredStar) els.pwdRequiredStar.classList.remove('hidden');
        if (els.confPwdRequiredStar) els.confPwdRequiredStar.classList.remove('hidden');
        if (els.pinRequiredStar) els.pinRequiredStar.classList.remove('hidden');
        gipBtnState();
        window.DEBUG?.flow('STAFFS', 'Configured Add Staff modal.');
    };
    const editStaffMode = (u) => {
        resetForm(); mode = 'edit-staff'; recordId = u.id; staffId = u.id; showSections({ gipMode: false, staffMode: true, gipList: true });
        if (els.title) els.title.textContent = 'Edit Staff'; if (els.submit) els.submit.textContent = 'Save Changes';
        if (els.staffName) els.staffName.value = u.full_name || '';
        if (els.birthday) els.birthday.value = u.birthday || '';
        if (positionDropdown) positionDropdown.setValue(u.role_id || '');
        if (officeDropdown) officeDropdown.setValue(u.office_id || '');
        if (els.username) els.username.value = u.username || ''; if (els.email) els.email.value = u.email || ''; if (els.phone) els.phone.value = u.phone || '';
        if (els.password) { els.password.required = false; els.password.placeholder = 'Leave blank to keep current'; }
        if (els.confirm) { els.confirm.required = false; }
        if (els.pin) { els.pin.required = false; els.pin.placeholder = 'Leave blank to keep current'; }
        els.confirmSec?.classList.add('hidden');
        if (els.pwdRequiredStar) els.pwdRequiredStar.classList.add('hidden');
        if (els.confPwdRequiredStar) els.confPwdRequiredStar.classList.add('hidden');
        if (els.pinRequiredStar) els.pinRequiredStar.classList.add('hidden');
        gipBtnState();
    };
    const editGipMode = (g) => {
        resetForm(); mode = 'edit-gip'; recordId = g.id; staffId = g.created_by; showSections({ gipMode: true, staffMode: false, gipList: false });
        if (els.title) els.title.textContent = 'Edit GIP Assistant'; if (els.submit) els.submit.textContent = 'Save Changes';
        if (els.gipName) els.gipName.value = g.full_name || ''; if (els.username) els.username.value = g.username || ''; if (els.email) els.email.value = g.email || ''; if (els.phone) els.phone.value = g.phone || '';
        if (els.password) { els.password.required = false; els.password.placeholder = 'Leave blank to keep current'; } if (els.confirm) els.confirm.required = false; els.confirmSec?.classList.add('hidden');
    };
    const addGipBlock = () => {
        if (!els.gipBox) return;
        const n = els.gipBox.children.length + 1, block = document.createElement('div');
        block.className = 'p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-3 relative';
        block.innerHTML = `<div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2 mb-2"><span class="text-xs font-extrabold text-blue-600 dark:text-blue-500 uppercase tracking-wider">GIP Assistant #${n}</span><button type="button" class="cursor-pointer text-red-600 font-bold text-xs btn-remove-gip">Remove</button></div><div class="grid gap-3 grid-cols-2"><input type="text" name="gip_name[]" placeholder="Full name" class="col-span-2 sm:col-span-1 bg-white border border-gray-300 text-gray-900 text-xs block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required><input type="text" name="gip_username[]" placeholder="Username" class="col-span-2 sm:col-span-1 bg-white border border-gray-300 text-gray-900 text-xs block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required><input type="email" name="gip_email[]" placeholder="Email address" class="col-span-2 sm:col-span-1 bg-white border border-gray-300 text-gray-900 text-xs block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required><input type="tel" name="gip_phone[]" placeholder="Phone number" class="col-span-2 sm:col-span-1 bg-white border border-gray-300 text-gray-900 text-xs block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"><input type="password" name="gip_password[]" placeholder="Password" class="col-span-2 sm:col-span-1 bg-white border border-gray-300 text-gray-900 text-xs block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required><input type="password" name="gip_confirm_password[]" placeholder="Confirm password" class="col-span-2 sm:col-span-1 bg-white border border-gray-300 text-gray-900 text-xs block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required></div>`;
        block.querySelector('.btn-remove-gip')?.addEventListener('click', () => { block.remove(); gipBtnState(); });
        els.gipBox.appendChild(block); gipBtnState();
    };
    const collectGips = () => Array.from(els.gipBox?.children || []).map(b => ({ full_name: b.querySelector('[name="gip_name[]"]')?.value.trim() || '', username: b.querySelector('[name="gip_username[]"]')?.value.trim() || '', email: b.querySelector('[name="gip_email[]"]')?.value.trim() || '', phone: b.querySelector('[name="gip_phone[]"]')?.value.trim() || null, password: b.querySelector('[name="gip_password[]"]')?.value || '', confirm: b.querySelector('[name="gip_confirm_password[]"]')?.value || '' }));
    const saveGipBlocks = async (ownerId) => {
        for (const g of collectGips()) {
            if (g.password !== g.confirm) return `Passwords do not match for ${g.full_name || 'a GIP assistant'}.`;
            const { confirm, ...payload } = g;
            const res = await createGip({ ...payload, created_by: ownerId, status: 'offline' });
            if (res.error) return res.error;
        }
        return null;
    };

    const staffPayload = () => ({
        full_name: els.staffName?.value.trim() || '',
        birthday: els.birthday?.value || null,
        role_id: Number(els.role?.value || 0),
        office_id: els.office?.value ? Number(els.office.value) : null,
        username: els.username?.value.trim() || '',
        email: els.email?.value.trim() || null,
        phone: els.phone?.value.trim() || null,
        status: 'offline'
    });
    const submitForm = async (e) => {
        e.preventDefault();
        if (mode === 'add-staff' || mode === 'edit-staff') {
            if (!els.role?.value) {
                alert('Position is required.');
                return;
            }
        }
        if (!form?.checkValidity()) { form?.reportValidity(); return; }
        els.submit.disabled = true; els.submit.classList.add('opacity-70', 'pointer-events-none');
        window.DEBUG?.flow('STAFFS', `Submitting staff modal: ${mode}`);
        try {
            if (mode === 'add-staff') {
                if (els.password.value !== els.confirm.value) throw new Error('Passwords do not match.');
                const pinVal = els.pin?.value.trim();
                if (!pinVal) throw new Error('PIN is required.');
                if (pinVal.length !== 4 || isNaN(Number(pinVal))) throw new Error('PIN must be a 4-digit number.');
                const res = await createUser({ ...staffPayload(), password: els.password.value, pin: pinVal });
                if (res.error) throw new Error(res.error);
                const gipError = await saveGipBlocks(res.data.id); if (gipError) throw new Error(gipError);
                window.DEBUG?.success('STAFFS', 'Staff created.', res.data);
            } else if (mode === 'edit-staff') {
                const updates = staffPayload();
                if (els.password.value) updates.password = els.password.value;
                if (els.pin?.value.trim()) {
                    const pinVal = els.pin.value.trim();
                    if (pinVal.length !== 4 || isNaN(Number(pinVal))) throw new Error('PIN must be a 4-digit number.');
                    updates.pin = pinVal;
                }
                const res = await updateUser(recordId, updates); if (res.error) throw new Error(res.error);
                const gipError = await saveGipBlocks(recordId); if (gipError) throw new Error(gipError);
                window.DEBUG?.success('STAFFS', 'Staff updated.', res.data);
            } else if (mode === 'edit-gip') {
                const updates = { full_name: els.gipName?.value.trim() || '', username: els.username?.value.trim() || '', email: els.email?.value.trim() || null, phone: els.phone?.value.trim() || null };
                if (els.password.value) updates.password = els.password.value;
                const res = await updateGip(recordId, updates); if (res.error) throw new Error(res.error);
                window.DEBUG?.success('STAFFS', 'GIP assistant updated.', res.data);
            }
            editModal?.hide(); await load();
        } catch (error) {
            window.DEBUG?.error('STAFFS', 'Save failed.', error.message || error);
            alert(error.message || 'Unable to save record. Check console debugger.');
        } finally {
            els.submit.disabled = false; els.submit.classList.remove('opacity-70', 'pointer-events-none');
        }
    };
    const viewStaff = (u) => {
        const setText = (id, value) => { const el = q(id); if (el) el.textContent = value || 'N/A'; };
        q('view-avatar')?.setAttribute('src', avatar(u.full_name)); setText('view-name', u.full_name); setText('view-email', u.email); setText('view-position', roleName(u)); setText('view-office', officeName(u));
        const s = q('view-status'); if (s) s.innerHTML = badge(u.status);
        const dot = q('view-online-dot'); if (dot) dot.className = `absolute -bottom-1 -right-1 w-5 h-5 ${u.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'} border-[3px] border-white dark:border-gray-800 rounded-full`;
        const box = q('view-gips-container'), kids = staffGips(u.id);
        if (box) box.innerHTML = kids.length ? kids.map(g => `<div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800"><img class="w-9 h-9 rounded-lg object-cover ring-2 ring-white dark:ring-gray-700 shadow-sm" src="${avatar(g.full_name)}" alt="${esc(g.full_name)}"><div class="flex-1 min-w-0"><h5 class="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">${na(g.full_name)}</h5><p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">${na(g.email)}</p></div><span class="inline-flex items-center bg-gradient-to-r from-blue-800 to-blue-950 text-white dark:from-blue-500 dark:to-blue-400 font-semibold px-1.5 py-0.5 rounded text-[9px] select-none shrink-0">GIP</span></div>`).join('') : '<p class="text-sm text-gray-500 dark:text-gray-400 italic">No linked GIP assistants</p>';
    };

    addBtn.addEventListener('click', () => { addMode(); editModal?.show(); });
    els.addGip?.addEventListener('click', addGipBlock);
    form?.addEventListener('submit', submitForm);
    table.addEventListener('click', async (e) => {
        // Handle checkbox cell click separately to toggle checkbox
        const checkboxCell = e.target.closest('td:first-child');
        if (checkboxCell) {
            const cb = checkboxCell.querySelector('input[type="checkbox"]');
            if (cb && e.target.tagName !== 'INPUT') {
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return;
        }

        const collapse = e.target.closest('[data-collapse-toggle]');
        if (collapse) { e.stopPropagation(); const cls = collapse.getAttribute('data-collapse-toggle'); document.querySelectorAll(`.${cls}`).forEach(r => r.classList.toggle('hidden')); collapse.querySelector('svg')?.classList.toggle('rotate-180'); window.DEBUG?.event('STAFFS', 'Toggled GIP rows.', cls); return; }
        if (e.target.closest('input[type="checkbox"]')) return;
        const btn = e.target.closest('[data-action]');
        if (btn) {
            e.stopPropagation(); const action = btn.dataset.action, id = Number(btn.dataset.id); window.DEBUG?.event('STAFFS', `Action: ${action}`, { id });
            if (action === 'edit-staff') { const u = users.find(x => Number(x.id) === id); if (u) { editStaffMode(u); editModal?.show(); } }
            if (action === 'edit-gip') { const g = gips.find(x => Number(x.id) === id); if (g) { editGipMode(g); editModal?.show(); } }
            if (action === 'archive-staff' && confirm('Archive this staff account?')) { const r = await archiveUser(id); if (r.error) window.DEBUG?.error('STAFFS', 'Archive staff failed.', r.error); await load(); }
            if (action === 'archive-gip' && confirm('Archive this GIP assistant?')) { const r = await archiveGip(id); if (r.error) window.DEBUG?.error('STAFFS', 'Archive GIP failed.', r.error); await load(); }
            return;
        }
        const row = e.target.closest('.parent-row'); if (!row) return;
        const u = users.find(x => Number(x.id) === Number(row.dataset.id)); if (u) { viewStaff(u); viewModal?.show(); }
    });

    table.addEventListener('change', (e) => {
        if (e.target.id === 'table-checkbox-45') {
            const checked = e.target.checked;
            document.querySelectorAll('.row-checkbox').forEach(cb => {
                cb.checked = checked;
            });
            window.DEBUG?.event('STAFFS', 'Select-all changed.', { checked });
        }
    });
    els.search?.addEventListener('input', (e) => { const s = e.target.value.toLowerCase().trim(); render(users.filter(u => [u.full_name, u.username, u.email, roleName(u), officeName(u)].some(v => String(v || '').toLowerCase().includes(s)))); });
    const selectedUserIds = () => Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.value).filter(v => !String(v).startsWith('gip:')).map(Number);
    q('bulk-approved')?.addEventListener('click', (e) => { e.preventDefault(); window.DEBUG?.warn('STAFFS', 'Approved clicked, but users table has no approval column.', selectedUserIds()); });
    q('bulk-declined')?.addEventListener('click', (e) => { e.preventDefault(); window.DEBUG?.warn('STAFFS', 'Declined clicked, but users table has no approval column.', selectedUserIds()); });
    q('bulk-archived')?.addEventListener('click', async (e) => { e.preventDefault(); const ids = selectedUserIds(); if (!ids.length || !confirm(`Archive ${ids.length} selected staff account(s)?`)) return; for (const id of ids) await archiveUser(id); await load(); });
    editEl?.querySelectorAll('[data-modal-hide="editUserModal"]').forEach(b => b.addEventListener('click', () => editModal?.hide()));
    viewEl?.querySelectorAll('[data-modal-hide="viewUserModal"]').forEach(b => b.addEventListener('click', () => viewModal?.hide()));

    const initDropdowns = () => {
        positionDropdown = initSearchableDropdown({
            hiddenInputId: 'position',
            btnId: 'position-dropdown-btn',
            listId: 'position-dropdown-list',
            searchId: 'position-search',
            placeholder: 'Select a position...',
            options: []
        });

        officeDropdown = initSearchableDropdown({
            hiddenInputId: 'office',
            btnId: 'office-dropdown-btn',
            listId: 'office-dropdown-list',
            searchId: 'office-search',
            placeholder: 'Select an office...',
            options: []
        });
    };
    initDropdowns();
    load();
};

const initSearchableDropdown = (config) => {
    const {
        hiddenInputId,
        btnId,
        listId,
        searchId,
        placeholder,
        options,
        onChange
    } = config;

    const input = document.getElementById(hiddenInputId);
    const btn = document.getElementById(btnId);
    const list = document.getElementById(listId);
    const search = document.getElementById(searchId);
    if (!input || !btn || !list || !search) return null;

    const optionsContainer = list.querySelector('.options-container');

    const renderOptions = (filteredOptions) => {
        if (!optionsContainer) return;
        optionsContainer.innerHTML = '';
        if (filteredOptions.length === 0) {
            optionsContainer.innerHTML = '<div class="p-2 text-xs text-gray-500 dark:text-gray-400 italic text-center">No results found</div>';
            return;
        }

        filteredOptions.forEach(opt => {
            const isSelected = String(input.value) === String(opt.value);
            const item = document.createElement('div');
            item.className = `cursor-pointer p-2 text-xs rounded-md ${isSelected ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'} transition-colors`;
            item.textContent = opt.label;
            item.setAttribute('data-value', opt.value);
            item.addEventListener('click', () => {
                selectOption(opt);
            });
            optionsContainer.appendChild(item);
        });
    };

    const selectOption = (opt) => {
        input.value = opt.value;
        const textSpan = btn.querySelector('span');
        if (textSpan) textSpan.textContent = opt.label;
        list.classList.add('hidden');
        if (onChange) onChange(opt.value);
    };

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('[id$="-dropdown-list"]').forEach(el => {
            if (el.id !== listId) el.classList.add('hidden');
        });
        const isHidden = list.classList.toggle('hidden');
        if (!isHidden) {
            search.value = '';
            renderOptions(options);
            search.focus();
        }
    });

    document.addEventListener('click', (e) => {
        if (!list.contains(e.target) && !btn.contains(e.target)) {
            list.classList.add('hidden');
        }
    });

    search.addEventListener('input', () => {
        const query = search.value.toLowerCase().trim();
        const filtered = options.filter(opt => opt.label.toLowerCase().includes(query));
        renderOptions(filtered);
    });

    search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const query = search.value.toLowerCase().trim();
            const filtered = options.filter(opt => opt.label.toLowerCase().includes(query));
            if (filtered.length > 0) {
                selectOption(filtered[0]);
            }
        }
    });

    renderOptions(options);

    return {
        updateOptions: (newOpts) => {
            options.length = 0;
            options.push(...newOpts);
            renderOptions(options);
        },
        setValue: (val) => {
            input.value = val;
            const found = options.find(opt => String(opt.value) === String(val));
            const textSpan = btn.querySelector('span');
            if (textSpan) {
                textSpan.textContent = found ? found.label : placeholder;
            }
        }
    };
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initStaffsManage);
else initStaffsManage();
