import sidebarTemplate from '@/components/sidebar.html?raw';
import { supabase } from '@/backend/api/supabase.js';
import { countUnreadNotifications } from '@/backend/api/notifications.api.js';
import pkg from '../../../package.json';
import { getCachedCurrentUser, logout } from '@/backend/api/auth.api.js';
import { authStorage } from '@/scripts/modules/storage.js';
import { Drawer } from 'flowbite';

let sidebarDrawerInstance = null;
let sidebarRealtimeChannel = null;
let lastSidebarTicketCount = null;

/* START PLAY SIDEBAR PING - Plays audio notification chime for incoming tickets */
const playSidebarPing = () => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    } catch { /* Audio Context restricted */ }
};
/* END PLAY SIDEBAR PING */

/* START UPDATE SIDEBAR TICKETS BADGE - Fetches unread ticket count and renders badge */
const updateSidebarTicketsBadge = async (role, userId) => {
    const badgeEl = document.getElementById('sidebar-badge-tickets');
    if (!badgeEl) return;

    try {
        let count = 0;
        // Only Admin works the global support inbox. HR uses the Staff ticket
        // route, so its badge is scoped to Admin replies on HR-owned tickets.
        if (role === 'admin') {
            const { data, error } = await supabase
                .from('ticket_messages')
                .select('id')
                .eq('is_read', false)
                .neq('sender_type', 'admin');

            if (!error && data) {
                count = data.length;
            }
        } else {
            const { data, error } = await supabase
                .from('ticket_messages')
                .select('ticket_id, tickets!inner(created_by)')
                .eq('is_read', false)
                .eq('sender_type', 'admin')
                .eq('tickets.created_by', userId);

            if (!error && data) {
                count = data.length;
            }
        }

        if (count > 0) {
            if (lastSidebarTicketCount !== null && count > lastSidebarTicketCount) {
                playSidebarPing();
            }
            lastSidebarTicketCount = count;

            badgeEl.textContent = count > 99 ? '99+' : String(count);
            badgeEl.classList.remove('hidden');
            badgeEl.classList.add('inline-flex', 'animate-pulse');
        } else {
            lastSidebarTicketCount = 0;
            badgeEl.classList.add('hidden');
            badgeEl.classList.remove('inline-flex', 'animate-pulse');
            badgeEl.textContent = '';
        }
    } catch (err) {
        console.error('Failed to update sidebar badge:', err);
    }
};
/* END UPDATE SIDEBAR TICKETS BADGE */

/* START UPDATE SIDEBAR ALERTS BADGE - Fetches unread alerts count and renders badge */
const updateSidebarAlertsBadge = async (role) => {
    const badgeEl = document.getElementById('sidebar-badge-alerts');
    const recipientRole = role === 'admin' ? 'admin' : role === 'hr' ? 'hr' : null;
    if (!badgeEl || !recipientRole) return;

    const { count, error } = await countUnreadNotifications(recipientRole);
    if (error) {
        window.DEBUG?.warn('SIDEBAR', 'Unable to update alerts badge.', error);
        return;
    }
    badgeEl.textContent = count > 99 ? '99+' : String(count);
    badgeEl.classList.toggle('hidden', count === 0);
    badgeEl.classList.toggle('inline-flex', count > 0);
};
/* END UPDATE SIDEBAR ALERTS BADGE */

/* START SETUP SIDEBAR REALTIME - Subscribes to ticket and alert Postgres changes */
const setupSidebarRealtime = (role, userId) => {
    if (sidebarRealtimeChannel) {
        supabase.removeChannel(sidebarRealtimeChannel);
    }

    sidebarRealtimeChannel = supabase
        .channel('sidebar-realtime-notifications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
            updateSidebarTicketsBadge(role, userId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_messages' }, () => {
            updateSidebarTicketsBadge(role, userId);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
            updateSidebarAlertsBadge(role);
        })
        .subscribe();
};
/* END SETUP SIDEBAR REALTIME */

/* START SIDEBAR LOGOUT SYSTEM - Handles sidebar logout modal and user session clearance */
const setupSidebarLogout = () => {
    const logoutBtn = document.getElementById('sidebar-profile-logout-btn');
    const modalEl = document.getElementById('sidebar-logout-confirmation');
    const confirmBtn = document.getElementById('sidebar-logout-confirm-btn');
    const cancelBtn = document.getElementById('sidebar-logout-cancel-btn');
    const closeTriggers = document.querySelectorAll('[data-logout-close="true"]');
    const sidebarEl = document.getElementById('default-sidebar');
    if (!logoutBtn || !modalEl || !confirmBtn || !cancelBtn || logoutBtn.dataset.logoutBound) return;
    let lastFocusedElement = null;
    let isLoggingOut = false;
    const setModalState = (isOpen) => {
        modalEl.classList.toggle('hidden', !isOpen);
        modalEl.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        document.documentElement.classList.toggle('overflow-hidden', isOpen);
        document.body.classList.toggle('overflow-hidden', isOpen);
        if (sidebarEl) {
            sidebarEl.inert = isOpen;
        }
    };
    const closeSidebarBeforeModal = () => {
        const isMobileViewport = window.matchMedia('(max-width: 639px)').matches;
        if (!isMobileViewport || !sidebarEl) return;
        const isSidebarOpen = !sidebarEl.classList.contains('-translate-x-full');
        if (isSidebarOpen && sidebarDrawerInstance) {
            sidebarDrawerInstance.hide();
        }
    };
    const openModal = () => {
        lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        lastFocusedElement?.blur();
        closeSidebarBeforeModal();
        setModalState(true);
        window.setTimeout(() => confirmBtn.focus(), 0);
    };
    const closeModal = () => {
        if (isLoggingOut) return;
        setModalState(false);
        lastFocusedElement?.focus?.();
    };
    logoutBtn.dataset.logoutBound = 'true';
    logoutBtn.addEventListener('click', (event) => {
        event.preventDefault();
        openModal();
    });
    closeTriggers.forEach((trigger) => {
        if (trigger.dataset.logoutCloseBound) return;
        trigger.dataset.logoutCloseBound = 'true';
        trigger.addEventListener('click', closeModal);
    });
    confirmBtn.addEventListener('click', async () => {
        if (isLoggingOut) return;
        isLoggingOut = true;
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        confirmBtn.classList.add('opacity-70', 'pointer-events-none');
        cancelBtn.classList.add('opacity-70', 'pointer-events-none');
        /* START LOGOUT DOTS LOADING ANIMATION */
        confirmBtn.setAttribute('aria-label', 'Logging out');
        confirmBtn.innerHTML = `Logging out<span aria-hidden="true" class="ms-0.5 inline-flex items-end gap-0.5 leading-none"><span class="animate-bounce [animation-delay:-300ms]">.</span><span class="animate-bounce [animation-delay:-150ms]">.</span><span class="animate-bounce">.</span></span>`;
        /* END LOGOUT DOTS LOADING ANIMATION */
        try {
            await logout();
        } catch (error) {
            if (window.DEBUG) window.DEBUG.error('SIDEBAR', 'Logout failed', error);
            // The HttpOnly session is cleared by the backend logout endpoint.
        } finally {
            window.location.replace('/');
        }
    });
    if (!modalEl.dataset.logoutEscapeBound) {
        modalEl.dataset.logoutEscapeBound = 'true';
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modalEl.getAttribute('aria-hidden') === 'false') {
                closeModal();
            }
        });
    }
};
/* END SIDEBAR LOGOUT SYSTEM */

/* START DYNAMIC ROLE-BASED SIDEBAR SYSTEM - Renders role-specific or guest navigation and updates user display */
const setupDynamicSidebar = () => {
    const sidebarEl = document.getElementById('sidebar');
    if (!sidebarEl) return;

    if (window.DEBUG) {
        window.DEBUG.log('SIDEBAR', 'Initializing dynamic sidebar...');
    }

    const requestedRole = sidebarEl.getAttribute('data-role');
    const sessionUser = getCachedCurrentUser() || window.__PORTAL_SESSION || authStorage.getUserSession();
    const sessionRoleId = Number(sessionUser?.role_id);
    const isGip = Boolean(sessionUser?.is_gip || sessionUser?.gip_id);
    const isPublic = !sessionUser || (!sessionRoleId && !requestedRole);
    const role = isPublic
        ? 'public'
        : isGip
            ? 'gip'
            : sessionRoleId === 1
                ? 'admin'
                : sessionRoleId === 2
                    ? 'hr'
                    : sessionRoleId === 3
                        ? 'staff'
                        : (requestedRole === 'alerts' ? 'admin' : (requestedRole || 'staff'));
    const activeItem = sidebarEl.getAttribute('data-active') || (isPublic ? 'about-developer' : 'dashboard');

    // Keep the shell rendered by main.js during module startup, but repair the
    // mount if this module is loaded on a page without the early shell.
    if (!sidebarEl.dataset.shellRendered) {
        sidebarEl.innerHTML = sidebarTemplate;
        sidebarEl.dataset.shellRendered = 'true';
    }

    // Initialize Flowbite Drawer programmatically since it is dynamically injected
    const sidebarNode = document.getElementById('default-sidebar');
    const toggleBtns = document.querySelectorAll('[data-drawer-toggle="default-sidebar"]');
    if (sidebarNode && toggleBtns.length > 0) {
        if (sidebarDrawerInstance) {
            try { sidebarDrawerInstance.destroy(); } catch {}
        }
        sidebarDrawerInstance = new Drawer(sidebarNode, {
            placement: 'right',
            backdrop: true,
            bodyScrolling: false,
            edge: false,
            edgeOffset: '',
        });

        toggleBtns.forEach((btn) => {
            if (btn.dataset.drawerToggleBound) return;
            btn.dataset.drawerToggleBound = 'true';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (sidebarDrawerInstance) {
                    sidebarDrawerInstance.toggle();
                }
            });
        });
    }

    // Update Role Badge
    const badgeEl = document.getElementById('sidebar-role-badge');
    if (badgeEl) {
        badgeEl.textContent = role === 'admin'
            ? 'Admin Access'
            : role === 'hr'
                ? 'HR Access'
                : role === 'staff'
                    ? 'Staff Access'
                    : 'Public Access';
    }

    // Role-based navigation items configuration with SVGs
    const SVG_DASHBOARD = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6.025A7.5 7.5 0 1 0 17.975 14H10V6.025Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 3c-.169 0-.334.014-.5.025V11h7.975c.011-.166.025-.331.025-.5A7.5 7.5 0 0 0 13.5 3Z"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path d="M13.5 2c-.178 0-.356.013-.492.022l-.074.005a1 1 0 0 0-.934.998V11a1 1 0 0 0 1 1h7.975a1 1 0 0 0 .998-.934l.005-.074A7.04 7.04 0 0 0 22 10.5 8.5 8.5 0 0 0 13.5 2Z"/>
  <path d="M11 6.025a1 1 0 0 0-1.065-.998 8.5 8.5 0 1 0 9.038 9.039A1 1 0 0 0 17.975 13H11V6.025Z"/>
</svg>
`;
    const SVG_ALERTS = `
<svg class="hidden w-6 h-6 text-gray-800 dark:text-white sm:block sm:group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5.365V3m0 2.365a5.338 5.338 0 0 1 5.133 5.368v1.8c0 2.386 1.867 2.982 1.867 4.175 0 .593 0 1.292-.538 1.292H5.538C5 18 5 17.301 5 16.708c0-1.193 1.867-1.789 1.867-4.175v-1.8A5.338 5.338 0 0 1 12 5.365ZM8.733 18c.094.852.306 1.54.944 2.112a3.48 3.48 0 0 0 4.646 0c.638-.572 1.236-1.26 1.33-2.112h-6.92Z"/>
</svg>
<svg class="hidden w-6 h-6 text-gray-800 dark:text-white max-sm:block sm:group-hover:block sm:text-blue-600 sm:dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path d="M17.133 12.632v-1.8a5.406 5.406 0 0 0-4.154-5.262.955.955 0 0 0 .021-.106V3.1a1 1 0 0 0-2 0v2.364a.955.955 0 0 0 .021.106 5.406 5.406 0 0 0-4.154 5.262v1.8C6.867 15.018 5 15.614 5 16.807 5 17.4 5 18 5.538 18h12.924C19 18 19 17.4 19 16.807c0-1.193-1.867-1.789-1.867-4.175ZM8.823 19a3.453 3.453 0 0 0 6.354 0H8.823Z"/>
</svg>`;
    const SVG_ALERTS_ACTIVE = `
<svg class="w-6 h-6 text-blue-700 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path d="M17.133 12.632v-1.8a5.406 5.406 0 0 0-4.154-5.262.955.955 0 0 0 .021-.106V3.1a1 1 0 0 0-2 0v2.364a.955.955 0 0 0 .021.106 5.406 5.406 0 0 0-4.154 5.262v1.8C6.867 15.018 5 15.614 5 16.807 5 17.4 5 18 5.538 18h12.924C19 18 19 17.4 19 16.807c0-1.193-1.867-1.789-1.867-4.175ZM8.823 19a3.453 3.453 0 0 0 6.354 0H8.823Z"/>
</svg>`;
    const SVG_STAFFS_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 17H4a1 1 0 0 1-1-1 3 3 0 0 1 3-3h1m0-3.05A2.5 2.5 0 1 1 9 5.5M19.5 17h.5a1 1 0 0 0 1-1 3 3 0 0 0-3-3h-1m0-3.05a2.5 2.5 0 1 0-2-4.45m.5 13.5h-7a1 1 0 0 1-1-1 3 3 0 0 1 3-3h3a3 3 0 0 1 3 3 1 1 0 0 1-1 1Zm-1-9.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 6a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm-1.5 8a4 4 0 0 0-4 4 2 2 0 0 0 2 2h7a2 2 0 0 0 2-2 4 4 0 0 0-4-4h-3Zm6.82-3.096a5.51 5.51 0 0 0-2.797-6.293 3.5 3.5 0 1 1 2.796 6.292ZM19.5 18h.5a2 2 0 0 0 2-2 4 4 0 0 0-4-4h-1.1a5.503 5.503 0 0 1-.471.762A5.998 5.998 0 0 1 19.5 18ZM4 7.5a3.5 3.5 0 0 1 5.477-2.889 5.5 5.5 0 0 0-2.796 6.293A3.501 3.501 0 0 1 4 7.5ZM7.1 12H6a4 4 0 0 0-4 4 2 2 0 0 0 2 2h.5a5.998 5.998 0 0 1 3.071-5.238A5.505 5.505 0 0 1 7.1 12Z" clip-rule="evenodd"/></svg>`;

    const SVG_TOOLS = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13v-2a1 1 0 0 0-1-1h-.757l-.707-1.707.535-.536a1 1 0 0 0 0-1.414l-1.414-1.414a1 1 0 0 0-1.414 0l-.536.535L14 4.757V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v.757l-1.707.707-.536-.535a1 1 0 0 0-1.414 0L4.929 6.343a1 1 0 0 0 0 1.414l.536.536L4.757 10H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h.757l.707 1.707-.535.536a1 1 0 0 0 0 1.414l1.414 1.414a1 1 0 0 0 1.414 0l.536-.535 1.707.707V20a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-.757l1.707-.708.536.536a1 1 0 0 0 1.414 0l1.414-1.414a1 1 0 0 0 0-1.414l-.535-.536.707-1.707H20a1 1 0 0 0 1-1Z"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
</svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M9.586 2.586A2 2 0 0 1 11 2h2a2 2 0 0 1 2 2v.089l.473.196.063-.063a2.002 2.002 0 0 1 2.828 0l1.414 1.414a2 2 0 0 1 0 2.827l-.063.064.196.473H20a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-.089l-.196.473.063.063a2.002 2.002 0 0 1 0 2.828l-1.414 1.414a2 2 0 0 1-2.828 0l-.063-.063-.473.196V20a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-.089l-.473-.196-.063.063a2.002 2.002 0 0 1-2.828 0l-1.414-1.414a2 2 0 0 1 0-2.827l.063-.064L4.089 15H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h.09l.195-.473-.063-.063a2 2 0 0 1 0-2.828l1.414-1.414a2 2 0 0 1 2.827 0l.064.063L9 4.089V4a2 2 0 0 1 .586-1.414ZM8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clip-rule="evenodd"/>
</svg>`;

    const SVG_ASSISTANTS = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 19h4a1 1 0 0 0 1-1v-1a3 3 0 0 0-3-3h-2m-2.236-4a3 3 0 1 0 0-4M3 18v-1a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Zm8-10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
</svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2 9a4 4 0 0 0-4 4v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1a4 4 0 0 0-4-4H6Zm7.25-2.095c.478-.86.75-1.85.75-2.905a5.973 5.973 0 0 0-.75-2.906 4 4 0 1 1 0 5.811ZM15.466 20c.34-.588.535-1.271.535-2v-1a5.978 5.978 0 0 0-1.528-4H18a4 4 0 0 1 4 4v1a2 2 0 0 1-2 2h-4.535Z" clip-rule="evenodd"/>
</svg>
`;

    const SVG_TICKETS_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.5 12A2.5 2.5 0 0 1 21 9.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v2.5a2.5 2.5 0 0 1 0 5V17a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-2.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 0-2 2v2.5a1 1 0 0 0 1 1 1.5 1.5 0 1 1 0 3 1 1 0 0 0-1 1V17a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2.5a1 1 0 0 0-1-1 1.5 1.5 0 1 1 0-3 1 1 0 0 0 1-1V7a2 2 0 0 0-2-2H4Z"/></svg>`;

    const SVG_SYSTEMS_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.35709 16V5.78571c0-.43393.34822-.78571.77777-.78571H18.5793c.4296 0 .7778.35178.7778.78571V16M5.35709 16h-1c-.55229 0-1 .4477-1 1v1c0 .5523.44771 1 1 1H20.3571c.5523 0 1-.4477 1-1v-1c0-.5523-.4477-1-1-1h-1M5.35709 16H19.3571M9.35709 8l2.62501 2.5L9.35709 13m4.00001 0h2"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M4 5.78571C4 4.80909 4.78639 4 5.77778 4H18.2222C19.2136 4 20 4.80909 20 5.78571V15H4V5.78571ZM12 12c0-.5523.4477-1 1-1h2c.5523 0 1 .4477 1 1s-.4477 1-1 1h-2c-.5523 0-1-.4477-1-1ZM8.27586 6.31035c.38089-.39993 1.01387-.41537 1.4138-.03449l2.62504 2.5c.1981.18875.3103.45047.3103.72414 0 .27368-.1122.5354-.3103.7241l-2.62504 2.5c-.39993.3809-1.03291.3655-1.4138-.0344-.38088-.4-.36544-1.033.03449-1.4138L10.175 9.5 8.31035 7.72414c-.39993-.38089-.41537-1.01386-.03449-1.41379Z" clip-rule="evenodd"/><path d="M2 17v1c0 1.1046.89543 2 2 2h16c1.1046 0 2-.8954 2-2v-1H2Z"/></svg>`;

    const SVG_ARTICLES_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v13H7a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h12M9 3v14m7 0v4"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M6 2a2 2 0 0 0-2 2v15a3 3 0 0 0 3 3h12a1 1 0 1 0 0-2h-2v-2h2a1 1 0 0 0 1-1V4a2 2 0 0 0-2-2h-8v16h5v2H7a1 1 0 1 1 0-2h1V2H6Z" clip-rule="evenodd"/></svg>`;

    const SVG_SPRC_CONVERTER = `
<svg class="w-4 h-4 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10V7.914a1 1 0 0 1 .293-.707l3.914-3.914A1 1 0 0 1 9.914 3H18a1 1 0 0 1 1 1v6M5 19v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1M10 3v4a1 1 0 0 1-1 1H5m2.665 9H6.647A1.647 1.647 0 0 1 5 15.353v-1.706A1.647 1.647 0 0 1 6.647 12h1.018M16 12l1.443 4.773L19 12m-6.057-.152-.943-.02a1.34 1.34 0 0 0-1.359 1.22 1.32 1.32 0 0 0 1.172 1.421l.536.059a1.273 1.273 0 0 1 1.226 1.718c-.2.571-.636.754-1.337.754h-1.13"/>
</svg>
<svg class="w-4 h-4 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M9 2.221V7H4.221a2 2 0 0 1 .365-.5L8.5 2.586A2 2 0 0 1 9 2.22ZM11 2v5a2 2 0 0 1-2 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2 2 2 0 0 0 2 2h12a2 2 0 0 0 2-2 2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2V4a2 2 0 0 0-2-2h-7Zm1.018 8.828a2.34 2.34 0 0 0-2.373 2.13v.008a2.32 2.32 0 0 0 2.06 2.497l.535.059a.993.993 0 0 0 .136.006.272.272 0 0 1 .263.367l-.008.02a.377.377 0 0 1-.018.044.49.49 0 0 1-.078.02 1.689 1.689 0 0 1-.297.021h-1.13a1 1 0 1 0 0 2h1.13c.417 0 .892-.05 1.324-.279.47-.248.78-.648.953-1.134a2.272 2.272 0 0 0-2.115-3.06l-.478-.052a.32.32 0 0 1-.285-.341.34.34 0 0 1 .344-.306l.94.02a1 1 0 1 0 .043-2l-.943-.02h-.003Zm7.933 1.482a1 1 0 1 0-1.902-.62l-.57 1.747-.522-1.726a1 1 0 0 0-1.914.578l1.443 4.773a1 1 0 0 0 1.908.021l1.557-4.773Zm-13.762.88a.647.647 0 0 1 .458-.19h1.018a1 1 0 1 0 0-2H6.647A2.647 2.647 0 0 0 4 13.647v1.706A2.647 2.647 0 0 0 6.647 18h1.018a1 1 0 1 0 0-2H6.647A.647.647 0 0 1 6 15.353v-1.706c0-.172.068-.336.19-.457Z" clip-rule="evenodd"/>
</svg>`;

    const SVG_OCR_CONVERTER = `
<svg class="w-4 h-4 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2m-10 0H5a2 2 0 0 1-2-2v-2m4-5h10m-8 4h6m-4-8h2"/>
</svg>
<svg class="w-4 h-4 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4Zm4 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H9Z" clip-rule="evenodd"/>
</svg>`;

    const SVG_ABOUT_DEV = `
<svg class="w-5 h-5 transition duration-150 ease-in-out group-hover:text-blue-600 dark:group-hover:text-blue-500 group-hover:stroke-[2.5]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
</svg>`;

    const navConfigurations = {
        public: [
            { id: 'about-developer', label: 'About Developer', url: '/src/pages/about/', svg: SVG_ABOUT_DEV, hasSeparator: false }
        ],
        admin: [
            { id: 'dashboard', label: 'Dashboard', url: '/src/pages/user/admin/dashboard/', svg: SVG_DASHBOARD },
            { id: 'systems', label: 'Manage Systems', url: '/src/pages/user/admin/systems/', svg: SVG_SYSTEMS_ADMIN },
            { id: 'staffs', label: 'Manage Staffs', url: '/src/pages/user/admin/staffs/', svg: SVG_STAFFS_ADMIN },
            { id: 'alerts', label: 'Alerts', url: '/src/pages/user/admin/alerts/', svg: SVG_ALERTS },
            {
                id: 'tickets',
                label: 'Manage Tickets',
                url: '/src/pages/user/admin/tickets/',
                svg: SVG_TICKETS_ADMIN,
                badge: null,
                dropdown: [
                    { id: 'articles', label: 'Manage Articles', url: '/src/pages/user/admin/articles/', svg: SVG_ARTICLES_ADMIN }
                ]
            },
            {
                id: 'tools',
                label: 'Tools',
                url: '#',
                svg: SVG_TOOLS,
                dropdown: [
                    { id: 'sprc-converter', label: 'SPRC Converter', url: '#', svg: SVG_SPRC_CONVERTER },
                    { id: 'ocr-converter', label: 'OCR Converter', url: '/src/pages/tools/ocr-converter/', svg: SVG_OCR_CONVERTER }
                ]
            },
            { id: 'about-developer', label: 'About Developer', url: '/src/pages/about/', svg: SVG_ABOUT_DEV, hasSeparator: true }
        ],
        hr: [
            { id: 'dashboard', label: 'Dashboard', url: '/src/pages/user/staff/dashboard/', svg: SVG_DASHBOARD },
            { id: 'alerts', label: 'Alerts', url: '/src/pages/user/admin/alerts/', svg: SVG_ALERTS },
            { id: 'assistants', label: 'Manage Assistants', url: '/src/pages/user/staff/assistants/', svg: SVG_ASSISTANTS },
            {
                id: 'tickets',
                label: 'My Tickets',
                url: '/src/pages/user/staff/tickets/',
                svg: SVG_TICKETS_ADMIN,
                badge: null,
                dropdown: [
                    { id: 'articles', label: 'Browse Articles', url: '/src/pages/user/staff/articles/', svg: SVG_ARTICLES_ADMIN }
                ]
            },
            {
                id: 'tools',
                label: 'Tools',
                url: '#',
                svg: SVG_TOOLS,
                dropdown: [
                    { id: 'sprc-converter', label: 'SPRC Converter', url: '#', svg: SVG_SPRC_CONVERTER },
                    { id: 'ocr-converter', label: 'OCR Converter', url: '/src/pages/tools/ocr-converter/', svg: SVG_OCR_CONVERTER }
                ]
            },
            { id: 'about-developer', label: 'About Developer', url: '/src/pages/about/', svg: SVG_ABOUT_DEV, hasSeparator: true }
        ],
        staff: [
            { id: 'dashboard', label: 'Dashboard', url: '/src/pages/user/staff/dashboard/', svg: SVG_DASHBOARD },
            { id: 'assistants', label: 'Manage Assistants', url: '/src/pages/user/staff/assistants/', svg: SVG_ASSISTANTS },
            {
                id: 'tickets',
                label: 'My Tickets',
                url: '/src/pages/user/staff/tickets/',
                svg: SVG_TICKETS_ADMIN,
                badge: null,
                dropdown: [
                    { id: 'articles', label: 'Browse Articles', url: '/src/pages/user/staff/articles/', svg: SVG_ARTICLES_ADMIN }
                ]
            },
            {
                id: 'tools',
                label: 'Tools',
                url: '#',
                svg: SVG_TOOLS,
                dropdown: [
                    { id: 'sprc-converter', label: 'SPRC Converter', url: '#', svg: SVG_SPRC_CONVERTER },
                    { id: 'ocr-converter', label: 'OCR Converter', url: '/src/pages/tools/ocr-converter/', svg: SVG_OCR_CONVERTER }
                ]
            },
            { id: 'about-developer', label: 'About Developer', url: '/src/pages/about/', svg: SVG_ABOUT_DEV, hasSeparator: true }
        ],
        gip: [
            { id: 'dashboard', label: 'Dashboard', url: '/src/pages/user/staff/dashboard/', svg: SVG_DASHBOARD },
            {
                id: 'tickets',
                label: 'My Tickets',
                url: '/src/pages/user/staff/tickets/',
                svg: SVG_TICKETS_ADMIN,
                badge: null,
                dropdown: [
                    { id: 'articles', label: 'Browse Articles', url: '/src/pages/user/staff/articles/', svg: SVG_ARTICLES_ADMIN }
                ]
            },
            {
                id: 'tools',
                label: 'Tools',
                url: '#',
                svg: SVG_TOOLS,
                dropdown: [
                    { id: 'sprc-converter', label: 'SPRC Converter', url: '#', svg: SVG_SPRC_CONVERTER },
                    { id: 'ocr-converter', label: 'OCR Converter', url: '/src/pages/tools/ocr-converter/', svg: SVG_OCR_CONVERTER }
                ]
            },
            { id: 'about-developer', label: 'About Developer', url: '/src/pages/about/', svg: SVG_ABOUT_DEV, hasSeparator: true }
        ]
    };

    const items = navConfigurations[role] || navConfigurations.public;
    const listEl = document.getElementById('sidebar-nav-list');

    if (listEl) {
        let listHTML = '';
        items.forEach(item => {
            const isChildActive = item.dropdown ? item.dropdown.some(child => child.id === activeItem) : false;
            const isActive = item.id === activeItem;

            // Style matching Flowbite defaults with rich support
            const linkClass = isActive
                ? 'cursor-pointer flex items-center px-2 py-1.5 text-blue-700 dark:text-blue-500 font-bold bg-blue-50 dark:bg-blue-950/30 rounded-lg group transition-colors'
                : 'cursor-pointer flex items-center px-2 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group';

            let svgContent = isActive && item.id === 'alerts' ? SVG_ALERTS_ACTIVE : item.svg;
            if (isActive && item.id !== 'alerts') {
                svgContent = svgContent.replace('group-hover:hidden', 'hidden').replace('hidden group-hover:block', 'block');
                // For single SVG items
                svgContent = svgContent.replace('group-hover:text-blue-600 dark:group-hover:text-blue-500', 'text-blue-700 dark:text-blue-500');
                svgContent = svgContent.replace(/text-gray-800 dark:text-white/g, 'text-blue-700 dark:text-blue-500');
            }

            const itemWrapperClass = item.hasSeparator ? 'pt-2 mt-2 border-t border-gray-200 dark:border-gray-800' : '';

            if (item.dropdown) {
                const dynamicBadge = item.id === 'tickets' || item.id === 'alerts'
                    ? `<span id="sidebar-badge-${item.id}" class="hidden items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-md shadow-sm mr-1"></span>`
                    : '';

                listHTML += `
                <li class="${itemWrapperClass}">
                    <div class="w-full relative flex items-center">
                        <a href="${item.url}" class="${linkClass} flex-1 flex items-center">
                            ${svgContent}
                            <span class="ms-3 mr-1">${item.label}</span>
                            <div class="flex-1"></div>
                            ${dynamicBadge}
                        </a>
                        <button type="button" class="cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1.5 z-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" onclick="event.preventDefault(); event.stopPropagation(); const el = document.getElementById('dropdown-${item.id}'); if (el) el.classList.toggle('hidden');" aria-controls="dropdown-${item.id}">
                            <svg class="w-4 h-4 transition duration-200" aria-hidden="true" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/></svg>
                        </button>
                    </div>
                    <ul id="dropdown-${item.id}" class="${(isChildActive || isActive) ? '' : 'hidden'} py-1 space-y-1 mt-1 ml-7">
                `;
                item.dropdown.forEach((child, index) => {
                    const isLast = index === item.dropdown.length - 1;
                    const isSubActive = child.id === activeItem;
                    const subLinkClass = isSubActive
                        ? 'cursor-pointer flex items-center px-2 py-1.5 text-blue-700 dark:text-blue-500 font-bold bg-blue-50 dark:bg-blue-950/30 rounded-lg group transition-colors'
                        : 'cursor-pointer flex items-center px-2 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group';

                    let childSvg = child.svg;
                    if (isSubActive) {
                        childSvg = childSvg.replace('group-hover:hidden', 'hidden').replace('hidden group-hover:block', 'block');
                        childSvg = childSvg.replace('group-hover:text-blue-600 dark:group-hover:text-blue-500', 'text-blue-700 dark:text-blue-500');
                        childSvg = childSvg.replace(/text-gray-800 dark:text-white/g, 'text-blue-700 dark:text-blue-500');
                    }

                    // Connected vertical stem line for non-last items, with smooth L-hooks
                    const stemLine = !isLast
                        ? `<div class="absolute -left-3 top-0 bottom-[-6px] border-l-2 border-gray-200 dark:border-gray-700 pointer-events-none"></div>`
                        : '';

                    listHTML += `
                        <li class="relative">
                            ${stemLine}
                            <!-- L-shaped tree branch bend -->
                            <div class="absolute -left-3 top-0 w-3 h-1/2 border-l-2 border-b-2 border-gray-200 dark:border-gray-700 rounded-bl-lg pointer-events-none"></div>
                            <a href="${child.url}" class="${subLinkClass}">
                                ${childSvg}
                                <span class="flex-1 ms-3 text-sm">${child.label}</span>
                            </a>
                        </li>
                    `;
                });
                listHTML += `
                    </ul>
                </li>
                `;
            } else {
                const dynamicBadge = item.id === 'tickets' || item.id === 'alerts'
                    ? `<span id="sidebar-badge-${item.id}" class="hidden items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-md shadow-sm"></span>`
                    : '';

                listHTML += `
                <li class="${itemWrapperClass}">
                    <a href="${item.url}" data-nav-id="${item.id}" class="${linkClass}">
                        ${svgContent}
                        <span class="flex-1 ms-3">${item.label}</span>
                        ${dynamicBadge}
                    </a>
                </li>
                `;
            }
        });
        listEl.innerHTML = listHTML;
        listEl.removeAttribute('aria-busy');
        listEl.removeAttribute('aria-label');
    }

    if (window.DEBUG) {
        window.DEBUG.success('SIDEBAR', `Sidebar loaded for role: ${role}`);
    }

    // Toggle footer user card between Authenticated and Guest modes
    const profileInfoEl = document.getElementById('sidebar-user-profile-info');
    const userActionsEl = document.getElementById('sidebar-user-actions');
    const guestActionsEl = document.getElementById('sidebar-guest-actions');

    if (isPublic) {
        if (profileInfoEl) profileInfoEl.classList.add('hidden');
        if (userActionsEl) userActionsEl.classList.add('hidden');
        if (guestActionsEl) guestActionsEl.classList.remove('hidden');
    } else {
        if (profileInfoEl) profileInfoEl.classList.remove('hidden');
        if (userActionsEl) userActionsEl.classList.remove('hidden');
        if (guestActionsEl) guestActionsEl.classList.add('hidden');
        setupSidebarLogout();
    }

    // Inject Version
    const versionEl = document.getElementById('app-version-display');
    if (versionEl) {
        versionEl.textContent = `v${pkg.version}`;
    }

    // Populate user profile info dynamically from session if authenticated
    if (!isPublic && sessionUser) {
        const userNameEl = document.getElementById('sidebar-user-name');
        const userSubtitleEl = document.getElementById('sidebar-user-subtitle');
        const userRoleEl = document.getElementById('sidebar-user-role-pill');
        const userAvatarEl = document.getElementById('sidebar-user-avatar');

        if (userNameEl) userNameEl.textContent = sessionUser.full_name || sessionUser.username || 'System User';
        if (userSubtitleEl) userSubtitleEl.textContent = sessionUser.email || 'portal@dole.local';
        if (userRoleEl) userRoleEl.textContent = role === 'admin' ? 'Admin' : role === 'hr' ? 'HR' : 'Staff';
        if (userAvatarEl) {
            const initials = (sessionUser.full_name || sessionUser.username || 'SU')
                .split(' ')
                .map(n => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
            if (sessionUser.avatar_url) {
                userAvatarEl.textContent = '';
                userAvatarEl.style.backgroundImage = `url("${sessionUser.avatar_url}")`;
                userAvatarEl.style.backgroundSize = 'cover';
                userAvatarEl.style.backgroundPosition = 'center';
            } else {
                userAvatarEl.textContent = initials;
                userAvatarEl.style.backgroundImage = '';
            }
        }

        // Dynamic global unread badge with realtime notifications
        updateSidebarTicketsBadge(role, sessionUser.id);
        updateSidebarAlertsBadge(role);
        setupSidebarRealtime(role, sessionUser.id);
    }
};
/* END DYNAMIC ROLE-BASED SIDEBAR SYSTEM */

/* START LIVE PROFILE AVATAR REFRESH */
window.addEventListener('portal:profile-updated', (event) => {
    const user = event.detail || {};
    const nameEl = document.getElementById('sidebar-user-name');
    const subtitleEl = document.getElementById('sidebar-user-subtitle');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    if (nameEl) nameEl.textContent = user.full_name || user.username || 'System User';
    if (subtitleEl) subtitleEl.textContent = user.email || 'portal@dole.local';
    if (!avatarEl) return;
    if (user.avatar_url) {
        avatarEl.textContent = '';
        avatarEl.style.backgroundImage = `url("${user.avatar_url}")`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
    } else {
        avatarEl.textContent = (user.full_name || user.username || 'SU').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
        avatarEl.style.backgroundImage = '';
    }
});
/* END LIVE PROFILE AVATAR REFRESH */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDynamicSidebar);
} else {
    setupDynamicSidebar();
}
