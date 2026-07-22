import sidebarTemplate from '@/components/sidebar.html?raw';
import { supabase } from '@/backend/api/supabase.js';
import pkg from '../../../package.json';
import { logout } from '@/backend/api/auth.api.js';
import { Drawer } from 'flowbite';

let sidebarDrawerInstance = null;


/* START SIDEBAR LOGOUT SYSTEM */
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
        confirmBtn.textContent = 'Logging out...';
        try {
            await logout();
        } catch (error) {
            if (window.DEBUG) window.DEBUG.error('SIDEBAR', 'Logout failed', error);
            localStorage.removeItem('dole_session');
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

/* START DYNAMIC ROLE-BASED SIDEBAR SYSTEM */
const setupDynamicSidebar = () => {
    const sidebarEl = document.getElementById('sidebar');
    if (!sidebarEl) return;

    if (window.DEBUG) {
        window.DEBUG.log('SIDEBAR', 'Initializing dynamic sidebar...');
    }

    const role = sidebarEl.getAttribute('data-role') || 'staff';
    const activeItem = sidebarEl.getAttribute('data-active') || 'dashboard';

    // Inject base template
    sidebarEl.innerHTML = sidebarTemplate;

    // Initialize Flowbite Drawer programmatically since it is dynamically injected
    const sidebarNode = document.getElementById('default-sidebar');
    const toggleBtn = document.querySelector('[data-drawer-toggle="default-sidebar"]');
    if (sidebarNode && toggleBtn) {
        sidebarDrawerInstance = new Drawer(sidebarNode, {
            placement: 'left',
            backdrop: true,
            bodyScrolling: false,
            edge: false,
            edgeOffset: '',
        });

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            sidebarDrawerInstance.toggle();
        });
    }

    // Update Role Badge
    const badgeEl = document.getElementById('sidebar-role-badge');
    if (badgeEl) {
        badgeEl.textContent = role === 'admin' ? 'Admin Access' : 'Staff Access';
    }

    // Role-based navigation items configuration with SVGs
    const SVG_DASHBOARD = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6.025A7.5 7.5 0 1 0 17.975 14H10V6.025Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 3c-.169 0-.334.014-.5.025V11h7.975c.011-.166.025-.331.025-.5A7.5 7.5 0 0 0 13.5 3Z"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path d="M13.5 2c-.178 0-.356.013-.492.022l-.074.005a1 1 0 0 0-.934.998V11a1 1 0 0 0 1 1h7.975a1 1 0 0 0 .998-.934l.005-.074A7.04 7.04 0 0 0 22 10.5 8.5 8.5 0 0 0 13.5 2Z"/>
  <path d="M11 6.025a1 1 0 0 0-1.065-.998 8.5 8.5 0 1 0 9.038 9.039A1 1 0 0 0 17.975 13H11V6.025Z"/>
</svg>
`;
    const SVG_STAFFS_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 17H4a1 1 0 0 1-1-1 3 3 0 0 1 3-3h1m0-3.05A2.5 2.5 0 1 1 9 5.5M19.5 17h.5a1 1 0 0 0 1-1 3 3 0 0 0-3-3h-1m0-3.05a2.5 2.5 0 1 0-2-4.45m.5 13.5h-7a1 1 0 0 1-1-1 3 3 0 0 1 3-3h3a3 3 0 0 1 3 3 1 1 0 0 1-1 1Zm-1-9.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 6a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm-1.5 8a4 4 0 0 0-4 4 2 2 0 0 0 2 2h7a2 2 0 0 0 2-2 4 4 0 0 0-4-4h-3Zm6.82-3.096a5.51 5.51 0 0 0-2.797-6.293 3.5 3.5 0 1 1 2.796 6.292ZM19.5 18h.5a2 2 0 0 0 2-2 4 4 0 0 0-4-4h-1.1a5.503 5.503 0 0 1-.471.762A5.998 5.998 0 0 1 19.5 18ZM4 7.5a3.5 3.5 0 0 1 5.477-2.889 5.5 5.5 0 0 0-2.796 6.293A3.501 3.501 0 0 1 4 7.5ZM7.1 12H6a4 4 0 0 0-4 4 2 2 0 0 0 2 2h.5a5.998 5.998 0 0 1 3.071-5.238A5.505 5.505 0 0 1 7.1 12Z" clip-rule="evenodd"/></svg>`;

    const SVG_REPORTS = `<svg class="w-5 h-5 transition duration-75 group-hover:text-blue-600 dark:group-hover:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v14M9 5v14M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg>`;
    const SVG_EXPORTS = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linejoin="round" stroke-width="2" d="M16.444 18H19a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h2.556M17 11V5a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v6h10ZM7 15h10v4a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-4Z"/>
</svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M8 3a2 2 0 0 0-2 2v3h12V5a2 2 0 0 0-2-2H8Zm-3 7a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1v-4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4h1a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H5Zm4 11a1 1 0 0 1-1-1v-4h8v4a1 1 0 0 1-1 1H9Z" clip-rule="evenodd"/>
</svg>
`;
    
    const SVG_ASSISTANTS = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 19h4a1 1 0 0 0 1-1v-1a3 3 0 0 0-3-3h-2m-2.236-4a3 3 0 1 0 0-4M3 18v-1a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Zm8-10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
</svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2 9a4 4 0 0 0-4 4v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1a4 4 0 0 0-4-4H6Zm7.25-2.095c.478-.86.75-1.85.75-2.905a5.973 5.973 0 0 0-.75-2.906 4 4 0 1 1 0 5.811ZM15.466 20c.34-.588.535-1.271.535-2v-1a5.978 5.978 0 0 0-1.528-4H18a4 4 0 0 1 4 4v1a2 2 0 0 1-2 2h-4.535Z" clip-rule="evenodd"/>
</svg>
`;

    const SVG_EXPORTS_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 10V4a1 1 0 0 0-1-1H9.914a1 1 0 0 0-.707.293L5.293 7.207A1 1 0 0 0 5 7.914V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2M10 3v4a1 1 0 0 1-1 1H5m5 6h9m0 0-2-2m2 2-2 2"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M9 7V2.221a2 2 0 0 0-.5.365L4.586 6.5a2 2 0 0 0-.365.5H9Zm2 0V2h7a2 2 0 0 1 2 2v9.293l-2-2a1 1 0 0 0-1.414 1.414l.293.293h-6.586a1 1 0 1 0 0 2h6.586l-.293.293A1 1 0 0 0 18 16.707l2-2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9h5a2 2 0 0 0 2-2Z" clip-rule="evenodd"/></svg>`;

    const SVG_TICKETS_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.5 12A2.5 2.5 0 0 1 21 9.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v2.5a2.5 2.5 0 0 1 0 5V17a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-2.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 0-2 2v2.5a1 1 0 0 0 1 1 1.5 1.5 0 1 1 0 3 1 1 0 0 0-1 1V17a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2.5a1 1 0 0 0-1-1 1.5 1.5 0 1 1 0-3 1 1 0 0 0 1-1V7a2 2 0 0 0-2-2H4Z"/></svg>`;

    const SVG_SYSTEMS_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.35709 16V5.78571c0-.43393.34822-.78571.77777-.78571H18.5793c.4296 0 .7778.35178.7778.78571V16M5.35709 16h-1c-.55229 0-1 .4477-1 1v1c0 .5523.44771 1 1 1H20.3571c.5523 0 1-.4477 1-1v-1c0-.5523-.4477-1-1-1h-1M5.35709 16H19.3571M9.35709 8l2.62501 2.5L9.35709 13m4.00001 0h2"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M4 5.78571C4 4.80909 4.78639 4 5.77778 4H18.2222C19.2136 4 20 4.80909 20 5.78571V15H4V5.78571ZM12 12c0-.5523.4477-1 1-1h2c.5523 0 1 .4477 1 1s-.4477 1-1 1h-2c-.5523 0-1-.4477-1-1ZM8.27586 6.31035c.38089-.39993 1.01387-.41537 1.4138-.03449l2.62504 2.5c.1981.18875.3103.45047.3103.72414 0 .27368-.1122.5354-.3103.7241l-2.62504 2.5c-.39993.3809-1.03291.3655-1.4138-.0344-.38088-.4-.36544-1.033.03449-1.4138L10.175 9.5 8.31035 7.72414c-.39993-.38089-.41537-1.01386-.03449-1.41379Z" clip-rule="evenodd"/><path d="M2 17v1c0 1.1046.89543 2 2 2h16c1.1046 0 2-.8954 2-2v-1H2Z"/></svg>`;

    const SVG_ARTICLES_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v13H7a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h12M9 3v14m7 0v4"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M6 2a2 2 0 0 0-2 2v15a3 3 0 0 0 3 3h12a1 1 0 1 0 0-2h-2v-2h2a1 1 0 0 0 1-1V4a2 2 0 0 0-2-2h-8v16h5v2H7a1 1 0 1 1 0-2h1V2H6Z" clip-rule="evenodd"/></svg>`;

    const SVG_TOOLS = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13v-2a1 1 0 0 0-1-1h-.757l-.707-1.707.535-.536a1 1 0 0 0 0-1.414l-1.414-1.414a1 1 0 0 0-1.414 0l-.536.535L14 4.757V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v.757l-1.707.707-.536-.535a1 1 0 0 0-1.414 0L4.929 6.343a1 1 0 0 0 0 1.414l.536.536L4.757 10H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h.757l.707 1.707-.535.536a1 1 0 0 0 0 1.414l1.414 1.414a1 1 0 0 0 1.414 0l.536-.535 1.707.707V20a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-.757l1.707-.708.536.536a1 1 0 0 0 1.414 0l1.414-1.414a1 1 0 0 0 0-1.414l-.535-.536.707-1.707H20a1 1 0 0 0 1-1Z"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
</svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M9.586 2.586A2 2 0 0 1 11 2h2a2 2 0 0 1 2 2v.089l.473.196.063-.063a2.002 2.002 0 0 1 2.828 0l1.414 1.414a2 2 0 0 1 0 2.827l-.063.064.196.473H20a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-.089l-.196.473.063.063a2.002 2.002 0 0 1 0 2.828l-1.414 1.414a2 2 0 0 1-2.828 0l-.063-.063-.473.196V20a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-.089l-.473-.196-.063.063a2.002 2.002 0 0 1-2.828 0l-1.414-1.414a2 2 0 0 1 0-2.827l.063-.064L4.089 15H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h.09l.195-.473-.063-.063a2 2 0 0 1 0-2.828l1.414-1.414a2 2 0 0 1 2.827 0l.064.063L9 4.089V4a2 2 0 0 1 .586-1.414ZM8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clip-rule="evenodd"/>
</svg>`;

    const SVG_SPRC_CONVERTER = `
<svg class="w-4 h-4 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10V7.914a1 1 0 0 1 .293-.707l3.914-3.914A1 1 0 0 1 9.914 3H18a1 1 0 0 1 1 1v6M5 19v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1M10 3v4a1 1 0 0 1-1 1H5m2.665 9H6.647A1.647 1.647 0 0 1 5 15.353v-1.706A1.647 1.647 0 0 1 6.647 12h1.018M16 12l1.443 4.773L19 12m-6.057-.152-.943-.02a1.34 1.34 0 0 0-1.359 1.22 1.32 1.32 0 0 0 1.172 1.421l.536.059a1.273 1.273 0 0 1 1.226 1.718c-.2.571-.636.754-1.337.754h-1.13"/>
</svg>
<svg class="w-4 h-4 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
  <path fill-rule="evenodd" d="M9 2.221V7H4.221a2 2 0 0 1 .365-.5L8.5 2.586A2 2 0 0 1 9 2.22ZM11 2v5a2 2 0 0 1-2 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2 2 2 0 0 0 2 2h12a2 2 0 0 0 2-2 2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2V4a2 2 0 0 0-2-2h-7Zm1.018 8.828a2.34 2.34 0 0 0-2.373 2.13v.008a2.32 2.32 0 0 0 2.06 2.497l.535.059a.993.993 0 0 0 .136.006.272.272 0 0 1 .263.367l-.008.02a.377.377 0 0 1-.018.044.49.49 0 0 1-.078.02 1.689 1.689 0 0 1-.297.021h-1.13a1 1 0 1 0 0 2h1.13c.417 0 .892-.05 1.324-.279.47-.248.78-.648.953-1.134a2.272 2.272 0 0 0-2.115-3.06l-.478-.052a.32.32 0 0 1-.285-.341.34.34 0 0 1 .344-.306l.94.02a1 1 0 1 0 .043-2l-.943-.02h-.003Zm7.933 1.482a1 1 0 1 0-1.902-.62l-.57 1.747-.522-1.726a1 1 0 0 0-1.914.578l1.443 4.773a1 1 0 0 0 1.908.021l1.557-4.773Zm-13.762.88a.647.647 0 0 1 .458-.19h1.018a1 1 0 1 0 0-2H6.647A2.647 2.647 0 0 0 4 13.647v1.706A2.647 2.647 0 0 0 6.647 18h1.018a1 1 0 1 0 0-2H6.647A.647.647 0 0 1 6 15.353v-1.706c0-.172.068-.336.19-.457Z" clip-rule="evenodd"/>
</svg>`;

    const navConfigurations = {
        admin: [
            { id: 'dashboard', label: 'Dashboard', url: '/src/pages/user/admin/dashboard/', svg: SVG_DASHBOARD },
            { id: 'systems', label: 'Manage Systems', url: '/src/pages/user/admin/systems/', svg: SVG_SYSTEMS_ADMIN },
            { id: 'staffs', label: 'Manage Staffs', url: '/src/pages/user/admin/staffs/', svg: SVG_STAFFS_ADMIN },
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
            { id: 'tools', label: 'Tools', url: '#', svg: SVG_TOOLS, dropdown: [{ id: 'sprc-converter', label: 'SPRC Converter', url: '#', svg: SVG_SPRC_CONVERTER }] }
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
            { id: 'tools', label: 'Tools', url: '#', svg: SVG_TOOLS, dropdown: [{ id: 'sprc-converter', label: 'SPRC Converter', url: '#', svg: SVG_SPRC_CONVERTER }] }
        ]
    };

    const items = navConfigurations[role] || [];
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

            let svgContent = item.svg;
            if (isActive) {
                svgContent = svgContent.replace('group-hover:hidden', 'hidden').replace('hidden group-hover:block', 'block');
                // For single SVG items
                svgContent = svgContent.replace('group-hover:text-blue-600 dark:group-hover:text-blue-500', 'text-blue-700 dark:text-blue-500');
            }

            if (item.dropdown) {
                const dynamicBadge = item.id === 'tickets'
                    ? `<span id="sidebar-badge-tickets" class="hidden items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-md shadow-sm mr-1"></span>`
                    : '';

                listHTML += `
                <li>
                    <div class="w-full relative">
                        <a href="${item.url}" class="${linkClass} flex items-center w-full" onclick="document.getElementById('dropdown-${item.id}')?.classList.toggle('hidden');">
                            ${svgContent}
                            <span class="ms-3 mr-1">${item.label}</span>
                            <span class="cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1 z-10" aria-controls="dropdown-${item.id}">
                                <svg class="w-4 h-4 transition duration-200" aria-hidden="true" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/></svg>
                            </span>
                            <div class="flex-1"></div>
                            ${dynamicBadge}
                        </a>
                    </div>
                    <ul id="dropdown-${item.id}" class="${(isChildActive || isActive) ? '' : 'hidden'} py-1 space-y-1 mt-1 ml-7">
                `;
                item.dropdown.forEach(child => {
                    const isSubActive = child.id === activeItem;
                    const subLinkClass = isSubActive
                        ? 'cursor-pointer flex items-center px-2 py-1.5 text-blue-700 dark:text-blue-500 font-bold bg-blue-50 dark:bg-blue-950/30 rounded-lg group transition-colors'
                        : 'cursor-pointer flex items-center px-2 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group';
                    
                    let childSvg = child.svg;
                    if (isSubActive) {
                        childSvg = childSvg.replace('group-hover:hidden', 'hidden').replace('hidden group-hover:block', 'block');
                        childSvg = childSvg.replace('group-hover:text-blue-600 dark:group-hover:text-blue-500', 'text-blue-700 dark:text-blue-500');
                    }

                    listHTML += `
                        <li class="relative">
                            <!-- L-shaped tree branch bend -->
                            <div class="absolute -left-3 top-0 w-3 h-1/2 border-l-2 border-b-2 border-gray-200 dark:border-gray-700 rounded-bl-lg"></div>
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
                const dynamicBadge = item.id === 'tickets'
                    ? `<span id="sidebar-badge-tickets" class="hidden items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-md shadow-sm"></span>`
                    : '';

                listHTML += `
                <li>
                    <a href="${item.url}" class="${linkClass}">
                        ${svgContent}
                        <span class="flex-1 ms-3">${item.label}</span>
                        ${dynamicBadge}
                    </a>
                </li>
                `;
            }
        });
        listEl.innerHTML = listHTML;
    }

    if (window.DEBUG) {
        window.DEBUG.success('SIDEBAR', `Sidebar loaded for role: ${role}`);
    }
    
    setupSidebarLogout();

    // Inject Version
    const versionEl = document.getElementById('app-version-display');
    if (versionEl) {
        versionEl.textContent = `v${pkg.version}`;
    }

    // Populate user profile info dynamically from session
    const rawSession = localStorage.getItem('dole_session');
    const user = rawSession ? JSON.parse(rawSession) : null;
    if (user) {
        const userNameEl = document.getElementById('sidebar-user-name');
        const userSubtitleEl = document.getElementById('sidebar-user-subtitle');
        const userRoleEl = document.getElementById('sidebar-user-role-pill');
        const userAvatarEl = document.getElementById('sidebar-user-avatar');

        if (userNameEl) userNameEl.textContent = user.full_name || user.username || 'System User';
        if (userSubtitleEl) userSubtitleEl.textContent = user.email || 'portal@dole.local';
        if (userRoleEl) userRoleEl.textContent = role === 'admin' ? 'Admin' : 'Staff';
        if (userAvatarEl) {
            const initials = (user.full_name || user.username || 'SU')
                .split(' ')
                .map(n => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
            userAvatarEl.textContent = initials;
        }

        // Dynamic global unread badge with realtime notifications
        updateSidebarTicketsBadge(role, user.id);
        setupSidebarRealtime(role, user.id);
    }
};

let sidebarRealtimeChannel = null;

const updateSidebarTicketsBadge = async (role, userId) => {
    const badgeEl = document.getElementById('sidebar-badge-tickets');
    if (!badgeEl) return;

    try {
        let count = 0;
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
            badgeEl.textContent = count;
            badgeEl.classList.remove('hidden');
            badgeEl.classList.add('inline-flex');
        } else {
            badgeEl.classList.add('hidden');
            badgeEl.classList.remove('inline-flex');
            badgeEl.textContent = '';
        }
    } catch (err) {
        console.error('Failed to update sidebar badge:', err);
    }
};

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
        .subscribe();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDynamicSidebar);
} else {
    setupDynamicSidebar();
}
/* END DYNAMIC ROLE-BASED SIDEBAR SYSTEM */
