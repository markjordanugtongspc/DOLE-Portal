import { fetchExternalUsers, getExternalSystemConfigs } from '@/backend/api/external-systems.api.js';
import { fetchExternalAccountLinks, deleteExternalAccountLink } from '@/backend/api/external-links.api.js';

/* START STAFF ACCOUNT ASSIGNMENT DRAWER */
const initStaffAssignmentDrawer = () => {
    const assignAction = document.getElementById('bulk-assign');
    if (!assignAction || document.getElementById('assign-user-drawer')) return;

    const escapeHtml = (value) => String(value ?? 'N/A')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const displayValue = (value) => escapeHtml(value || 'N/A');
    const systemPlaceholders = getExternalSystemConfigs();

    const backdrop = document.createElement('div');
    backdrop.id = 'assign-user-drawer-backdrop';
    backdrop.className = 'fixed inset-0 z-[70] hidden bg-gray-950/30 backdrop-blur-sm transition-opacity';
    backdrop.setAttribute('aria-hidden', 'true');

    const drawer = document.createElement('aside');
    drawer.id = 'assign-user-drawer';
    drawer.className = 'fixed end-0 top-0 z-[80] flex h-screen w-full max-w-2xl translate-x-full flex-col overflow-hidden border-s border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-gray-700 dark:bg-gray-900';
    drawer.tabIndex = -1;
    drawer.setAttribute('aria-labelledby', 'assign-user-drawer-title');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = `
        <div class="flex shrink-0 items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700 sm:px-6">
            <div class="min-w-0 pe-4">
                <p class="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">Staff account linking</p>
                <h2 id="assign-user-drawer-title" class="text-xl font-extrabold text-gray-950 dark:text-white">ASSIGN USER</h2>
                <p class="mt-1 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">Review this Portal account and match it with the corresponding account in another system.</p>
            </div>
            <button type="button" data-assign-drawer-close class="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white" aria-label="Close assignment drawer">
                <svg class="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
        </div>
        <div id="assign-user-drawer-content" class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6"></div>
        <div class="grid shrink-0 grid-cols-2 gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-950 sm:px-6">
            <button type="button" data-assign-drawer-submit class="cursor-pointer inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">Assign</button>
            <button type="button" data-assign-drawer-close class="cursor-pointer inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:ring-gray-700">Cancel</button>
        </div>`;

    document.body.append(backdrop, drawer);
    const content = drawer.querySelector('#assign-user-drawer-content');

    const infoRows = (user) => {
        const officeLocation = user.offices ? [user.offices.name, user.offices.location].filter(Boolean).join(' / ') : user.office;
        return [
            ['FULL NAME', user.full_name], ['ID', user.id], ['POSITION', user.roles?.name || user.role?.name || user.position],
            ['OFFICE / LOCATION', officeLocation], ['USERNAME', user.username], ['EMAIL', user.email],
            ['APPROVAL STATUS', user.approval_status || 'APPROVED']
        ].map(([label, value]) => `<div class="min-w-0"><dt class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">${label}</dt><dd class="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-white" title="${displayValue(value)}">${displayValue(value)}</dd></div>`).join('');
    };

    /* Each detected system owns its own full-name search and safe account match. */
    const matchedSystems = new Map();
    let activePortalUser = null;
    const candidateMarkup = (candidate, index) => `<button type="button" data-system-candidate="${index}" class="cursor-pointer block w-full border border-gray-200 bg-white p-3 text-left transition-colors hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"><dl class="grid grid-cols-1 gap-4">${infoRows(candidate)}</dl><span class="mt-3 inline-flex text-xs font-bold text-blue-700 dark:text-blue-400">Select this account</span></button>`;
    
    const systemCard = (system, user, existingLink, index) => {
        const hasLink = Boolean(existingLink?.external_user_id && String(existingLink.external_user_id).trim() && String(existingLink.external_user_id).toUpperCase() !== 'N/A');
        return `<section class="border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/70 sm:p-5" data-system-card="${index}" data-system-key="${system.key}">
        <div class="mb-4 flex items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-700"><div><p class="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">${system.label}</p><h4 class="mt-1 text-base font-extrabold text-gray-950 dark:text-white">${system.name}</h4></div><span class="bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-300">DETECTED</span></div>
        
        <form data-system-user-search class="flex flex-col gap-2 ${hasLink ? 'hidden' : ''}"><label class="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400" for="system-user-search-${index}">Search user full name</label><div class="flex gap-2"><input id="system-user-search-${index}" data-system-user-search-input type="search" class="cursor-pointer min-h-10 min-w-0 flex-1 border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white" placeholder="Enter full name..." autocomplete="off"><button type="submit" class="cursor-pointer min-h-10 bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700">Search</button></div></form>
        
        ${hasLink ? `
        <div data-system-assigned-info class="border-t border-gray-100 pt-3 dark:border-gray-700 mt-2">
            <div class="mb-2 flex items-center justify-between">
                <p class="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">ASSIGNED ACCOUNT</p>
                <div class="flex items-center gap-3"><button type="button" data-system-user-reassign class="cursor-pointer text-[10px] font-bold text-blue-700 hover:underline dark:text-blue-400">Reassign</button><button type="button" data-system-user-unassign class="cursor-pointer text-[10px] font-bold text-red-600 hover:underline dark:text-red-400">Unassign</button></div>
            </div>
            <div class="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/40 p-3 rounded-lg">
                <dl class="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                        <dt class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">FULL NAME</dt>
                        <dd class="text-xs font-semibold text-gray-950 dark:text-white truncate" title="${escapeHtml(existingLink.external_full_name)}">${escapeHtml(existingLink.external_full_name)}</dd>
                    </div>
                    <div>
                        <dt class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">EXTERNAL ID / USERNAME</dt>
                        <dd class="text-xs font-semibold text-gray-950 dark:text-white truncate" title="${escapeHtml(existingLink.external_user_id)}">${escapeHtml(existingLink.external_user_id)}${existingLink.external_username ? ` / ${escapeHtml(existingLink.external_username)}` : ''}</dd>
                    </div>
                </dl>
            </div>
        </div>
        ` : ''}

        <div data-system-user-result class="mt-4 hidden border-t border-gray-100 pt-4 dark:border-gray-700"><div class="mb-3 flex items-center justify-between gap-3"><p class="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">MATCHING ACCOUNTS</p><button type="button" data-system-user-clear class="cursor-pointer text-xs font-bold text-blue-700 hover:underline dark:text-blue-400">Search again</button></div><div data-system-candidates class="grid grid-cols-1 gap-3"></div></div>
        <p data-system-user-empty class="mt-4 hidden border-t border-dashed border-gray-200 pt-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"></p>
    </section>`;
    };

    const render = (user, existingLinks = []) => {
        matchedSystems.clear();
        activePortalUser = user;
        const submitButton = drawer.querySelector('[data-assign-drawer-submit]');
        const updateAssignState = () => {
            const ready = matchedSystems.size > 0;
            submitButton.disabled = !ready;
            submitButton.classList.toggle('cursor-not-allowed', !ready);
            submitButton.classList.toggle('opacity-50', !ready);
            submitButton.title = ready ? 'Assign the selected system accounts' : 'Search and select at least one system account';
        };
        content.innerHTML = `<div class="space-y-5">
            <section class="border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/20 sm:p-5"><div class="mb-4 flex items-center gap-3"><div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-sm font-black text-white dark:bg-blue-600">${escapeHtml(String(user.full_name || 'U').trim().charAt(0).toUpperCase())}</div><div class="min-w-0"><p class="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">PORTAL USER</p><h3 class="truncate text-lg font-extrabold text-gray-950 dark:text-white">${displayValue(user.full_name)}</h3></div></div><dl class="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">${infoRows(user)}</dl></section>
            <div class="flex justify-center" aria-hidden="true"><svg class="h-10 w-10 text-gray-400 dark:text-gray-500" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v15m0 0 6-6m-6 6-6-6" /></svg></div>
            <section><div class="mb-3"><h3 class="text-sm font-extrabold uppercase tracking-wider text-gray-900 dark:text-white">Other system accounts</h3><p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Systems were detected automatically. Search each system by the user's full name, then select the matched account.</p></div><div data-system-cards class="grid grid-cols-1 gap-4 lg:grid-cols-2">${systemPlaceholders.map((system, index) => {
                const link = existingLinks.find((l) => String(l.system_key).toUpperCase() === String(system.key).toUpperCase());
                return systemCard(system, user, link, index);
            }).join('')}</div></section>
        </div>`;
        updateAssignState();
        content.querySelectorAll('[data-system-user-search]').forEach((form) => {
            const card = form.closest('[data-system-card]');
            const index = Number(card.dataset.systemCard);
            const systemKey = card.dataset.systemKey;
            const input = form.querySelector('[data-system-user-search-input]');
            const result = card.querySelector('[data-system-user-result]');
            const candidates = card.querySelector('[data-system-candidates]');
            const empty = card.querySelector('[data-system-user-empty]');
            const clear = card.querySelector('[data-system-user-clear]');

            const reassignBtn = card.querySelector('[data-system-user-reassign]');
            const unassignBtn = card.querySelector('[data-system-user-unassign]');
            unassignBtn?.addEventListener('click', async () => {
                if (!activePortalUser) return;
                unassignBtn.disabled = true;
                unassignBtn.textContent = 'Unassigning...';
                const response = await deleteExternalAccountLink(activePortalUser.id, systemKey);
                if (response.error) {
                    unassignBtn.disabled = false;
                    unassignBtn.textContent = 'Unassign';
                    empty.textContent = response.error;
                    empty.classList.remove('hidden');
                    return;
                }
                matchedSystems.delete(index);
                card.querySelector('[data-system-assigned-info]')?.remove();
                form.classList.remove('hidden');
                input.value = '';
                empty.textContent = 'This account is now unassigned. Search for a new account or leave it unassigned.';
                empty.classList.remove('hidden');
                updateAssignState();
                input.focus();
            });
            reassignBtn?.addEventListener('click', () => {
                const info = card.querySelector('[data-system-assigned-info]');
                if (info) info.classList.add('hidden');
                form.classList.remove('hidden');
                input.value = '';
                input.focus();
            });

            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const term = input.value.trim();
                if (term.length < 2) {
                    empty.textContent = 'Enter at least 2 characters of the user full name.';
                    empty.classList.remove('hidden');
                    result.classList.add('hidden');
                    return;
                }
                const submit = form.querySelector('button[type="submit"]');
                submit.disabled = true;
                submit.classList.add('cursor-not-allowed', 'opacity-60');
                const response = await fetchExternalUsers({ systemKey, fullName: term });
                submit.disabled = false;
                submit.classList.remove('cursor-not-allowed', 'opacity-60');
                matchedSystems.delete(index);
                if (response.error || !response.data.length) {
                    empty.textContent = response.error || 'No matching full name found in this system.';
                    empty.classList.remove('hidden');
                    result.classList.add('hidden');
                    return;
                }
                empty.classList.add('hidden');
                candidates.innerHTML = response.data.map(candidateMarkup).join('');
                form.classList.add('hidden');
                result.classList.remove('hidden');
                candidates.querySelectorAll('[data-system-candidate]').forEach((candidateButton) => {
                    candidateButton.addEventListener('click', () => {
                        const candidate = response.data[Number(candidateButton.dataset.systemCandidate)];
                        matchedSystems.set(index, candidate);
                        candidates.querySelectorAll('[data-system-candidate]').forEach((button) => button.classList.remove('border-blue-600', 'bg-blue-50', 'dark:border-blue-500', 'dark:bg-blue-950/30'));
                        candidateButton.classList.add('border-blue-600', 'bg-blue-50', 'dark:border-blue-500', 'dark:bg-blue-950/30');
                        candidateButton.querySelector('span').textContent = 'Selected account';
                        updateAssignState();
                    });
                });
            });
            clear?.addEventListener('click', () => { matchedSystems.delete(index); result.classList.add('hidden'); empty.classList.add('hidden'); candidates.innerHTML = ''; form.classList.remove('hidden'); input.value = ''; input.focus(); updateAssignState(); });
        });    };
    const close = () => { drawer.classList.add('translate-x-full'); backdrop.classList.add('hidden'); drawer.setAttribute('aria-hidden', 'true'); backdrop.setAttribute('aria-hidden', 'true'); document.body.classList.remove('overflow-hidden'); };
    const open = async (user) => {
        content.innerHTML = `<div class="flex items-center justify-center py-16"><svg class="animate-spin h-8 w-8 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>`;
        drawer.classList.remove('translate-x-full');
        backdrop.classList.remove('hidden');
        drawer.setAttribute('aria-hidden', 'false');
        backdrop.setAttribute('aria-hidden', 'false');
        document.body.classList.add('overflow-hidden');
        drawer.focus();

        const response = await fetchExternalAccountLinks(user.id);
        render(user, response.data || []);
    };

    assignAction.addEventListener('click', (event) => { event.preventDefault(); window.dispatchEvent(new CustomEvent('portal:request-assignment')); });
    window.addEventListener('portal:assign-user', (event) => { if (event.detail?.user) open(event.detail.user); });
    drawer.querySelectorAll('[data-assign-drawer-close]').forEach((button) => button.addEventListener('click', close));
    backdrop.addEventListener('click', close);
    drawer.querySelector('[data-assign-drawer-submit]')?.addEventListener('click', () => { if (drawer.querySelector('[data-assign-drawer-submit]').disabled || !activePortalUser) return; window.dispatchEvent(new CustomEvent('portal:assign-user-confirmed', { detail: { user: activePortalUser, matches: Array.from(matchedSystems.values()) } })); close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && drawer.getAttribute('aria-hidden') === 'false') close(); });
};
/* END STAFF ACCOUNT ASSIGNMENT DRAWER */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStaffAssignmentDrawer);
} else {
    initStaffAssignmentDrawer();
}