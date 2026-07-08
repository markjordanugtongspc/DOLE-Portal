import sidebarTemplate from '@/components/sidebar.html?raw';
import pkg from '../../../package.json';

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

    // Update Role Badge
    const badgeEl = document.getElementById('sidebar-role-badge');
    if (badgeEl) {
        badgeEl.textContent = role === 'admin' ? 'Admin Access' : 'Staff Access';
    }

    // Role-based navigation items configuration with SVGs
    const SVG_DASHBOARD = `<svg class="w-5 h-5 transition duration-75 group-hover:text-blue-600 dark:group-hover:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6.025A7.5 7.5 0 1 0 17.975 14H10V6.025Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 3c-.169 0-.334.014-.5.025V11h7.975c.011-.166.025-.331.025-.5A7.5 7.5 0 0 0 13.5 3Z"/></svg>`;
    const SVG_STAFFS_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M4.5 17H4a1 1 0 0 1-1-1 3 3 0 0 1 3-3h1m0-3.05A2.5 2.5 0 1 1 9 5.5M19.5 17h.5a1 1 0 0 0 1-1 3 3 0 0 0-3-3h-1m0-3.05a2.5 2.5 0 1 0-2-4.45m.5 13.5h-7a1 1 0 0 1-1-1 3 3 0 0 1 3-3h3a3 3 0 0 1 3 3 1 1 0 0 1-1 1Zm-1-9.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 6a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm-1.5 8a4 4 0 0 0-4 4 2 2 0 0 0 2 2h7a2 2 0 0 0 2-2 4 4 0 0 0-4-4h-3Zm6.82-3.096a5.51 5.51 0 0 0-2.797-6.293 3.5 3.5 0 1 1 2.796 6.292ZM19.5 18h.5a2 2 0 0 0 2-2 4 4 0 0 0-4-4h-1.1a5.503 5.503 0 0 1-.471.762A5.998 5.998 0 0 1 19.5 18ZM4 7.5a3.5 3.5 0 0 1 5.477-2.889 5.5 5.5 0 0 0-2.796 6.293A3.501 3.501 0 0 1 4 7.5ZM7.1 12H6a4 4 0 0 0-4 4 2 2 0 0 0 2 2h.5a5.998 5.998 0 0 1 3.071-5.238A5.505 5.505 0 0 1 7.1 12Z" clip-rule="evenodd"/></svg>`;

    const SVG_REPORTS = `<svg class="w-5 h-5 transition duration-75 group-hover:text-blue-600 dark:group-hover:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v14M9 5v14M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg>`;
    const SVG_EXPORTS = `<svg class="w-5 h-5 transition duration-75 group-hover:text-blue-600 dark:group-hover:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2m-8-4-4 4m0 0 4 4m-4-4h12"/></svg>`;
    
    const SVG_EXPORTS_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 10V4a1 1 0 0 0-1-1H9.914a1 1 0 0 0-.707.293L5.293 7.207A1 1 0 0 0 5 7.914V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2M10 3v4a1 1 0 0 1-1 1H5m5 6h9m0 0-2-2m2 2-2 2"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M9 7V2.221a2 2 0 0 0-.5.365L4.586 6.5a2 2 0 0 0-.365.5H9Zm2 0V2h7a2 2 0 0 1 2 2v9.293l-2-2a1 1 0 0 0-1.414 1.414l.293.293h-6.586a1 1 0 1 0 0 2h6.586l-.293.293A1 1 0 0 0 18 16.707l2-2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9h5a2 2 0 0 0 2-2Z" clip-rule="evenodd"/></svg>`;

    const SVG_TICKETS_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.5 12A2.5 2.5 0 0 1 21 9.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v2.5a2.5 2.5 0 0 1 0 5V17a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-2.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 0-2 2v2.5a1 1 0 0 0 1 1 1.5 1.5 0 1 1 0 3 1 1 0 0 0-1 1V17a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2.5a1 1 0 0 0-1-1 1.5 1.5 0 1 1 0-3 1 1 0 0 0 1-1V7a2 2 0 0 0-2-2H4Z"/></svg>`;

    const SVG_SYSTEMS_ADMIN = `
<svg class="w-5 h-5 transition duration-75 group-hover:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.35709 16V5.78571c0-.43393.34822-.78571.77777-.78571H18.5793c.4296 0 .7778.35178.7778.78571V16M5.35709 16h-1c-.55229 0-1 .4477-1 1v1c0 .5523.44771 1 1 1H20.3571c.5523 0 1-.4477 1-1v-1c0-.5523-.4477-1-1-1h-1M5.35709 16H19.3571M9.35709 8l2.62501 2.5L9.35709 13m4.00001 0h2"/></svg>
<svg class="w-5 h-5 transition duration-75 hidden group-hover:block text-blue-600 dark:text-blue-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M4 5.78571C4 4.80909 4.78639 4 5.77778 4H18.2222C19.2136 4 20 4.80909 20 5.78571V15H4V5.78571ZM12 12c0-.5523.4477-1 1-1h2c.5523 0 1 .4477 1 1s-.4477 1-1 1h-2c-.5523 0-1-.4477-1-1ZM8.27586 6.31035c.38089-.39993 1.01387-.41537 1.4138-.03449l2.62504 2.5c.1981.18875.3103.45047.3103.72414 0 .27368-.1122.5354-.3103.7241l-2.62504 2.5c-.39993.3809-1.03291.3655-1.4138-.0344-.38088-.4-.36544-1.033.03449-1.4138L10.175 9.5 8.31035 7.72414c-.39993-.38089-.41537-1.01386-.03449-1.41379Z" clip-rule="evenodd"/><path d="M2 17v1c0 1.1046.89543 2 2 2h16c1.1046 0 2-.8954 2-2v-1H2Z"/></svg>`;

    const navConfigurations = {
        admin: [
            { id: 'dashboard', label: 'Dashboard', url: '/src/pages/user/admin/dashboard/index.html', svg: SVG_DASHBOARD },
            { id: 'systems', label: 'Manage Systems', url: '#', svg: SVG_SYSTEMS_ADMIN },
            { id: 'staffs', label: 'Manage Staffs', url: '#', svg: SVG_STAFFS_ADMIN },
            { id: 'tickets', label: 'Manage Tickets', url: '#', svg: SVG_TICKETS_ADMIN },
            { id: 'exports', label: 'Exports', url: '#', svg: SVG_EXPORTS_ADMIN }
        ],
        staff: [
            { id: 'dashboard', label: 'Dashboard', url: '/src/pages/user/staff/dashboard/index.html', svg: SVG_DASHBOARD },
            { id: 'records', label: 'Employment Records', url: '#', svg: SVG_REPORTS },
            { id: 'exports', label: 'Data Exports', url: '#', svg: SVG_EXPORTS }
        ]
    };

    const items = navConfigurations[role] || [];
    const listEl = document.getElementById('sidebar-nav-list');
    
    if (listEl) {
        let listHTML = '';
        items.forEach(item => {
            const isActive = item.id === activeItem;
            // Style matching Flowbite defaults with rich support
            const linkClass = isActive
                ? 'cursor-pointer flex items-center px-2 py-1.5 text-blue-700 dark:text-blue-500 font-bold bg-blue-50 dark:bg-blue-950/30 rounded-lg group'
                : 'cursor-pointer flex items-center px-2 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors group';
            
            listHTML += `
                <li>
                    <a href="${item.url}" class="${linkClass}">
                        ${item.svg}
                        <span class="ms-3">${item.label}</span>
                    </a>
                </li>
            `;
        });
        listEl.innerHTML = listHTML;
    }

    if (window.DEBUG) {
        window.DEBUG.success('SIDEBAR', `Sidebar loaded for role: ${role}`);
    }
    
    // Inject Version
    const versionEl = document.getElementById('app-version-display');
    if (versionEl) {
        versionEl.textContent = `v${pkg.version}`;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDynamicSidebar);
} else {
    setupDynamicSidebar();
}
/* END DYNAMIC ROLE-BASED SIDEBAR SYSTEM */
