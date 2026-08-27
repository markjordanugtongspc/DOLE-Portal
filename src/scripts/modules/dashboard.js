import { getPreference, setPreference } from './storage.js';
import ApexCharts from 'apexcharts';
import { Modal, initTooltips } from 'flowbite';
import { DashboardCarousel } from './slider.js';
import { fetchUserDashboardCounts, fetchUsers } from '@/backend/api/users.api.js';
import { fetchSystems } from '@/backend/api/systems.api.js';
import { fetchTickets } from '@/backend/api/tickets.api.js';
import { getCachedCurrentUser } from '@/backend/api/auth.api.js';
import { countGipsByStaff, fetchGipsByStaff } from '@/backend/api/gips.api.js';

/* START THEME TOGGLER */
const initThemeToggler = () => {
    const themeToggleBtns = Array.from(document.querySelectorAll('.theme-toggle-btn[data-theme-target]'));
    if (!themeToggleBtns.length) return;

    const updateThemeButtons = () => {
        const activeTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        themeToggleBtns.forEach((btn) => {
            const isActive = btn.dataset.themeTarget === activeTheme;
            btn.classList.toggle('bg-white', isActive);
            btn.classList.toggle('dark:bg-gray-900', isActive);
            btn.classList.toggle('text-gray-900', isActive);
            btn.classList.toggle('dark:text-white', isActive);
            btn.classList.toggle('shadow-sm', isActive);
            btn.classList.toggle('text-gray-500', !isActive);
            btn.classList.toggle('dark:text-gray-400', !isActive);
        });
    };

    updateThemeButtons();

    themeToggleBtns.forEach((btn) => {
        if (btn.dataset.dashboardThemeBound) return;
        btn.dataset.dashboardThemeBound = 'true';
        btn.addEventListener('click', () => window.requestAnimationFrame(updateThemeButtons));
    });
};
/* END THEME TOGGLER */

/* START QUICK ACTIONS SWITCHER */
const initQuickActionsSwitcher = () => {
    const btnStats = document.getElementById('btn-toggle-stats');
    const btnQuick = document.getElementById('btn-toggle-quick');
    const statsViewContainer = document.getElementById('stats-view-container');
    const quickActionsContainer = document.getElementById('quick-actions-container');

    if (!btnStats || !btnQuick || !statsViewContainer || !quickActionsContainer) return;

    // Default Classes for states
    const activeClasses = ['bg-white', 'dark:bg-gray-700', 'text-gray-900', 'dark:text-white', 'shadow-sm'];
    const inactiveClasses = ['text-gray-500', 'dark:bg-gray-800', 'dark:text-gray-400', 'hover:text-gray-900', 'dark:hover:text-white'];

    const updateView = (viewType) => {
        if (viewType === 'quick') {
            // Activate Quick
            btnQuick.classList.add(...activeClasses);
            btnQuick.classList.remove(...inactiveClasses);
            
            // Deactivate Stats
            btnStats.classList.add(...inactiveClasses);
            btnStats.classList.remove(...activeClasses);

            statsViewContainer.classList.add('hidden');
            quickActionsContainer.classList.remove('hidden');
        } else {
            // Activate Stats (Default)
            btnStats.classList.add(...activeClasses);
            btnStats.classList.remove(...inactiveClasses);
            
            // Deactivate Quick
            btnQuick.classList.add(...inactiveClasses);
            btnQuick.classList.remove(...activeClasses);

            quickActionsContainer.classList.add('hidden');
            statsViewContainer.classList.remove('hidden');
            
            // Trigger resize so ApexCharts properly re-renders its dimensions 
            // if it was initialized while the container was hidden
            window.dispatchEvent(new Event('resize'));
        }
    };

    // Load initial preference
    const savedPreference = getPreference('dashboard_right_panel_view', 'stats');
    updateView(savedPreference);

    // Bind events
    btnStats.addEventListener('click', () => {
        setPreference('dashboard_right_panel_view', 'stats');
        updateView('stats');
    });

    btnQuick.addEventListener('click', () => {
        setPreference('dashboard_right_panel_view', 'quick');
        updateView('quick');
    });
};
/* END QUICK ACTIONS SWITCHER */

/* START ADMIN-EXCLUSIVE DASHBOARD CONTROLLER */
class AdminDashboardController {
    constructor() {
        this.staffListEl = document.getElementById('staff-list-container');
        this.staffListLimit = 5;

        this.metricEls = {
            totalStaff: document.getElementById('admin-total-staff-value'),
            totalTickets: document.getElementById('admin-total-tickets-value'),
            openTickets: document.getElementById('admin-open-tickets-value'),
            totalResigned: document.getElementById('admin-total-resigned-value'),
            ticketsReceived: document.getElementById('admin-dashboard-tickets-received'),
            resolvedRate: document.getElementById('admin-dashboard-resolved-rate'),
        };

        if (!Object.values(this.metricEls).some(Boolean)) return;

        this.renderUserMetrics();
        this.renderTicketMetrics();
        this.renderStaffList();
    }

    setMetric(metricName, value) {
        const el = this.metricEls[metricName];
        if (!el) return;

        const hasValue = Number.isFinite(value) && value > 0;
        el.textContent = hasValue ? value.toLocaleString() : 'N/A';
        el.classList.toggle('text-red-100', !hasValue);
    }

    async renderUserMetrics() {
        const { data, error } = await fetchUserDashboardCounts();
        if (error) {
            this.setMetric('totalStaff', null);
            this.setMetric('totalResigned', null);
            return;
        }

        this.setMetric('totalStaff', data.totalStaff);
        this.setMetric('totalResigned', data.totalResigned);
    }
    /* START ADMIN STAFF LIST RENDERER */
    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    getStaffAvatarUrl(user) {
        const directAvatar = user?.avatar_url || user?.profile_image_url || user?.photo_url || user?.image_url || user?.avatar;
        if (directAvatar) return directAvatar;

        const name = user?.full_name || user?.username || user?.email || 'Staff';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1A56DB&color=fff&bold=true`;
    }

    isStaffUser(user) {
        const roleName = String(user?.roles?.name || '').trim().toLowerCase();
        return ['hr', 'staff'].includes(roleName);
    }

    getApprovalState(user) {
        return String(user?.approval_status || 'APPROVED').toUpperCase();
    }

    isPendingStaff(user) {
        return this.getApprovalState(user) === 'PENDING';
    }

    isActiveStaff(user) {
        if (this.isPendingStaff(user)) return false;

        const status = String(user?.status || '').toLowerCase();
        if (['active', 'online'].includes(status)) return true;

        const lastSeenTime = new Date(user?.last_seen || '').getTime();
        if (!Number.isFinite(lastSeenTime)) return false;

        return Date.now() - lastSeenTime <= 5 * 60 * 1000;
    }

    getRelativeTime(value) {
        const timestamp = new Date(value || '').getTime();
        if (!Number.isFinite(timestamp)) return '';

        const diffMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
        if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }

    getStaffStatusMeta(user) {
        if (this.isPendingStaff(user)) {
            return { dotClass: 'bg-amber-500', label: 'Pending' };
        }

        if (this.isActiveStaff(user)) {
            return { dotClass: 'bg-green-500', label: 'Active' };
        }

        const offlineSince = this.getRelativeTime(user?.last_seen);
        return { dotClass: 'bg-red-500', label: offlineSince ? `Offline ${offlineSince}` : 'Offline' };
    }

    getSortedStaff(users) {
        return users
            .filter(user => this.isStaffUser(user))
            .sort((a, b) => {
                const pendingDiff = Number(this.isPendingStaff(a)) - Number(this.isPendingStaff(b));
                if (pendingDiff !== 0) return pendingDiff;

                return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
            })
            .slice(0, this.staffListLimit);
    }

    renderStaffListLoading() {
        if (!this.staffListEl) return;

        this.staffListEl.setAttribute('role', 'status');
        this.staffListEl.innerHTML = `
            <div class="animate-pulse space-y-4">
                ${Array.from({ length: 3 }).map((_, index) => `
                    <div class="flex items-center justify-between py-2 ${index < 2 ? 'border-b border-gray-100 dark:border-gray-800' : ''}">
                        <div class="flex min-w-0 items-center gap-3">
                            <div class="h-10 w-10 shrink-0 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                            <div class="min-w-0 space-y-2">
                                <div class="h-3 ${index === 1 ? 'w-24' : 'w-28'} rounded-full bg-gray-200 dark:bg-gray-700"></div>
                                <div class="h-2.5 ${index === 2 ? 'w-40' : 'w-36'} rounded-full bg-gray-200 dark:bg-gray-700"></div>
                            </div>
                        </div>
                        <div class="h-3 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                    </div>
                `).join('')}
            </div>
            <span class="sr-only">Loading staff list...</span>
        `;
    }

    renderStaffRow(user, index, total) {
        const name = user?.full_name || user?.username || 'Unnamed staff';
        const email = user?.email || 'No email provided';
        const avatarUrl = this.getStaffAvatarUrl(user);
        const fallbackAvatarUrl = this.getStaffAvatarUrl({ full_name: name });
        const statusMeta = this.getStaffStatusMeta(user);
        const borderClass = index < total - 1 ? 'border-b border-gray-100 dark:border-gray-800' : '';
        const pendingClass = this.isPendingStaff(user) ? ' opacity-55 hover:opacity-75' : '';
        const pendingTitle = this.isPendingStaff(user) ? ' title="This user is pending for approval"' : '';

        return `
            <div class="flex items-center justify-between gap-3 py-2 transition-opacity ${borderClass}${pendingClass}"${pendingTitle}>
                <div class="flex min-w-0 items-center gap-3">
                    <img class="h-10 w-10 shrink-0 rounded-full object-cover" src="${this.escapeHtml(avatarUrl)}" alt="${this.escapeHtml(name)}" onerror="this.onerror=null;this.src='${this.escapeHtml(fallbackAvatarUrl)}';">
                    <div class="min-w-0">
                        <h4 class="truncate text-sm font-bold leading-tight text-gray-900 dark:text-white">${this.escapeHtml(name)}</h4>
                        <p class="truncate text-xs text-gray-500 dark:text-gray-400">${this.escapeHtml(email)}</p>
                    </div>
                </div>
                <div class="flex shrink-0 items-center gap-1.5 text-right">
                    <div class="h-2.5 w-2.5 shrink-0 rounded-full ${statusMeta.dotClass}"></div>
                    <span class="max-w-20 text-wrap text-left text-xs font-semibold leading-tight text-gray-600 dark:text-gray-400 sm:max-w-none sm:text-nowrap">${this.escapeHtml(statusMeta.label)}</span>
                </div>
            </div>
        `;
    }

    renderStaffListEmpty() {
        if (!this.staffListEl) return;

        this.staffListEl.removeAttribute('role');
        this.staffListEl.innerHTML = '<div class="py-8 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">No staff registered yet.</div>';
    }

    renderStaffListError() {
        if (!this.staffListEl) return;

        this.staffListEl.removeAttribute('role');
        this.staffListEl.innerHTML = '<div class="py-8 text-center text-sm font-semibold text-red-600 dark:text-red-400">Unable to load staff list.</div>';
    }

    async renderStaffList() {
        if (!this.staffListEl) return;

        this.renderStaffListLoading();
        const { data: users, error } = await fetchUsers();
        if (error) {
            this.renderStaffListError();
            return;
        }

        const staff = this.getSortedStaff(users || []);
        if (!staff.length) {
            this.renderStaffListEmpty();
            return;
        }

        this.staffListEl.removeAttribute('role');
        this.staffListEl.innerHTML = staff.map((user, index) => this.renderStaffRow(user, index, staff.length)).join('');
    }
    /* END ADMIN STAFF LIST RENDERER */


    /* START ADMIN TICKET INSIGHT METRICS */
    setTextMetric(metricName, value, fallback = 'N/A') {
        const el = this.metricEls[metricName];
        if (!el) return;

        el.textContent = value || fallback;
        el.removeAttribute('role');
        el.classList.remove('inline-flex', 'h-4', 'w-10', 'w-12', 'animate-pulse', 'align-middle', 'rounded-full', 'bg-gray-200', 'text-transparent', 'dark:bg-gray-700');
        el.classList.add('font-extrabold', 'text-gray-900', 'dark:text-white');
    }

    getResolvedRate(tickets) {
        const totalTickets = tickets.length;
        if (!totalTickets) return null;

        const closedStatuses = new Set(['closed', 'resolved']);
        const resolvedTickets = tickets.filter(ticket => closedStatuses.has(String(ticket.status || '').toLowerCase())).length;
        return Math.round((resolvedTickets / totalTickets) * 100);
    }

    async renderTicketMetrics() {
        const { data: tickets, error } = await fetchTickets();
        if (error) {
            this.setMetric('totalTickets', null);
            this.setMetric('openTickets', null);
            this.setTextMetric('ticketsReceived', null);
            this.setTextMetric('resolvedRate', null);
            return;
        }

        const openStatuses = new Set(['open', 'pending']);
        const totalTickets = tickets.length;
        const openTickets = tickets.filter(ticket => openStatuses.has(String(ticket.status || '').toLowerCase())).length;
        const resolvedRate = this.getResolvedRate(tickets);

        this.setMetric('totalTickets', totalTickets);
        this.setMetric('openTickets', openTickets);
        this.setTextMetric('ticketsReceived', totalTickets.toLocaleString());
        this.setTextMetric('resolvedRate', resolvedRate === null ? 'N/A' : `${resolvedRate}%`);
    }
    /* END ADMIN TICKET INSIGHT METRICS */
}
/* END ADMIN-EXCLUSIVE DASHBOARD CONTROLLER */
/* START STAFF-EXCLUSIVE DASHBOARD CONTROLLER */
/**
 * Class exclusive for the `/src/pages/user/staff` user dashboard operations.
 * Handles sub-systems rendering, click tracking, dynamic pagination, and security alert modals.
 */
class StaffDashboardController {
    constructor() {
        this.gridEl = document.getElementById('staff-systems-grid');
        if (!this.gridEl) return;

        if (window.DEBUG) {
            window.DEBUG.log('STAFF_DASHBOARD', 'Initializing staff dashboard sub-systems and charts...');
        }
        this.systems = [];
        // Pagination limit
        this.limit = 3;
        this.searchFilter = '';

        // Initialize Flowbite Modal for Intruder Detection
        const modalEl = document.getElementById('intruder-modal');
        this.intruderModal = modalEl ? new Modal(modalEl) : null;
        this.initEvents();
        this.loadSystems();
        this.initNetworkChart();
        this.initMobileCarousel();
        this.initChartsMobileCarousel();
        this.renderOfficeStatus();
        this.renderActiveAssistantsMetric();
        this.renderActiveStaffsMetric();
        // TEMPORARILY DISABLED: this.renderRecentActiveStaff();
        this.initPHHolidayCalendar();
    }

    async loadSystems() {
        this.renderLoading();
        const { data, error } = await fetchSystems({ activeOnly: false });
        if (error) {
            this.systems = [];
            this.renderError('Unable to load systems from the database.');
            return;
        }

        const rawSystems = data.map(system => {
            const systemUrl = system.system_url?.trim() || '';

            return {
                id: String(system.id),
                title: system.title || 'Untitled System',
                description: system.description || 'No description provided.',
                systemUrl: systemUrl === '#' ? '' : systemUrl,
                color: system.color || '#3b82f6',
                imageUrl: system.image_url || '/src/assets/logos/dole_logo.png'
            };
        });

        // Apply saved order preference
        const userId = this.getCurrentUserId();
        const savedOrder = this.getSavedSystemOrder(userId);
        if (savedOrder && savedOrder.length > 0) {
            rawSystems.sort((a, b) => {
                const indexA = savedOrder.indexOf(a.id);
                const indexB = savedOrder.indexOf(b.id);
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
        }

        this.systems = rawSystems;
        this.render();
    }

    renderLoading() {
        this.gridEl.innerHTML = Array.from({ length: 3 }).map(() => `
            <div role="status" class="w-full p-4 border border-gray-200 dark:border-gray-800 rounded-none shadow-sm animate-pulse md:p-6 sm:w-[calc(50%-12px)] lg:w-[calc(33.3333%-16px)]">
                <div class="flex items-center justify-center h-40 w-full bg-gray-200 dark:bg-gray-700 rounded-none mb-4 sm:mb-6">
                    <svg class="w-10 h-10 text-gray-300 dark:text-gray-600" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linejoin="round" stroke-width="2" d="M10 3v4a1 1 0 0 1-1 1H5m14-4v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7.914a1 1 0 0 1 .293-.707l3.914-3.914A1 1 0 0 1 9.914 3H18a1 1 0 0 1 1 1ZM9 12h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Zm5.697 2.395v-.733l1.269-1.219v2.984l-1.268-1.032Z"/></svg>
                </div>
                <div class="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full w-48 mb-4"></div>
                <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-2.5"></div>
                <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-2.5"></div>
                <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div class="flex items-center mt-4">
                    <svg id='link_24' class="w-8 h-8 text-gray-300 dark:text-gray-600 me-3" viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'><rect width='24' height='24' stroke='none' fill='#000000' opacity='0'/>
                    <g transform="matrix(1 0 0 1 12 12)" >
                    <g style="" >
                    <g transform="matrix(1 0 0 1 0 0)" >
                    <path style="stroke: none; stroke-width: 2; stroke-dasharray: none; stroke-linecap: round; stroke-dashoffset: 0; stroke-linejoin: round; stroke-miterlimit: 4; fill: none; fill-rule: nonzero; opacity: 1;" transform=" translate(-12, -12)" d="M 0 0 L 24 0 L 24 24 L 0 24 z" stroke-linecap="round" />
                    </g>
                    <g transform="matrix(1 0 0 1 3.02 -2.49)" >
                    <path style="stroke: currentColor; stroke-width: 2; stroke-dasharray: none; stroke-linecap: round; stroke-dashoffset: 0; stroke-linejoin: round; stroke-miterlimit: 4; fill: none; fill-rule: nonzero; opacity: 1;" transform=" translate(-15.02, -9.51)" d="M 10 14 C 10.658311336286156 14.67188619407951 11.559359328288686 15.050510257216821 12.5 15.050510257216821 C 13.440640671711314 15.050510257216821 14.341688663713846 14.671886194079509 15 14 L 19 10 C 20.380711874576985 8.619288125423015 20.380711874576985 6.380711874576984 19 5 C 17.61928812542302 3.619288125423016 15.380711874576985 3.619288125423017 14 5 L 13.5 5.5" stroke-linecap="round" />
                    </g>
                    <g transform="matrix(1 0 0 1 -3.02 2.49)" >
                    <path style="stroke: currentColor; stroke-width: 2; stroke-dasharray: none; stroke-linecap: round; stroke-dashoffset: 0; stroke-linejoin: round; stroke-miterlimit: 4; fill: none; fill-rule: nonzero; opacity: 1;" transform=" translate(-8.98, -14.49)" d="M 14 10 C 13.341688663713844 9.32811380592049 12.440640671711314 8.949489742783179 11.5 8.949489742783179 C 10.559359328288686 8.949489742783179 9.658311336286154 9.328113805920491 9 10 L 5 14 C 3.6192881254230165 15.380711874576985 3.619288125423016 17.619288125423015 5 19 C 6.380711874576984 20.38071187457698 8.619288125423017 20.380711874576985 10 19 L 10.5 18.5" stroke-linecap="round" />
                    </g>
                    </g>
                    </g>
                    </svg>
                    <div>
                        <div class="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full w-32 mb-2"></div>
                        <div class="w-48 h-2 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    </div>
                </div>
                <span class="sr-only">Loading...</span>
            </div>
        `).join('');
    }

    renderError(message) {
        this.gridEl.innerHTML = `
            <div class="col-span-full border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-6 text-center">
                <p class="text-sm font-bold text-red-700 dark:text-red-300">${message}</p>
            </div>
        `;
    }
    escapeHtml(value = '') {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }
    initEvents() {
        // Show More Action
        const btnShowMore = document.getElementById('btn-show-more');
        if (btnShowMore) {
            btnShowMore.addEventListener('click', () => {
                if (this.limit >= this.getFilteredCount()) {
                    // Reset to 3 if all systems are currently shown
                    this.limit = 3;
                } else {
                    // Expand by showing 3 more cards
                    this.limit += 3;
                }
                this.render();
            });
        }

        // Search Input Action
        const searchInput = document.getElementById('search-systems');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                this.searchFilter = query;

                // Trigger Threat Alert modal on exact match "PDL" or "INTRUDER"
                const upperQuery = query.toUpperCase();
                if (upperQuery === 'PDL' || upperQuery === 'INTRUDER') {
                    if (this.intruderModal) {
                        const typeEl = document.getElementById('intruder-type');
                        if (typeEl) {
                            typeEl.textContent = `${upperQuery} MATCH DETECTED`;
                        }
                        this.intruderModal.show();
                    }
                    // Clear input to reset
                    searchInput.value = '';
                    this.searchFilter = '';
                }

                this.render();
            });
        }

        // TEMPORARILY DISABLED: Refresh Recent Active Staff Action (Real-time Supabase Refetch)
        // const bindRefresh = (btnId) => {
        //     const btn = document.getElementById(btnId);
        //     if (!btn) return;
        //     btn.addEventListener('click', async (e) => {
        //         e.preventDefault();
        //         const svg = btn.querySelector('svg');
        //         if (svg) svg.classList.add('animate-spin');
        //         await this.renderRecentActiveStaff();
        //         await this.renderActiveStaffsMetric();
        //         if (svg) {
        //             setTimeout(() => svg.classList.remove('animate-spin'), 500);
        //         }
        //     });
        // };
        // bindRefresh('btn-refresh-recent-staff');
        // bindRefresh('mobile-btn-refresh-recent-staff');

        // Intruder Modal Close Action
        const intruderModalEl = document.getElementById('intruder-modal');
        if (intruderModalEl) {
            intruderModalEl.querySelectorAll('[data-intruder-modal-close]').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.intruderModal?.hide();
                });
            });
        }
    }

    getFilteredCount() {
        return this.systems.filter(sys => 
            sys.title.toLowerCase().includes(this.searchFilter.toLowerCase()) ||
            sys.description.toLowerCase().includes(this.searchFilter.toLowerCase())
        ).length;
    }

    /* START createSystemCardHtml METHOD - Builds an interactive system card DOM element with spinner overlay */
    createSystemCardHtml(sys) {
        const card = document.createElement('div');
        const sysColor = sys.color || '#3b82f6';
        card.className = 'system-card cursor-pointer border border-transparent flex flex-col justify-between hover:scale-[1.01] hover:shadow-[0_0_15px_var(--glow-color)] transition-all duration-300 relative group min-h-[320px] rounded-none overflow-hidden text-white sm:w-[calc(50%-12px)] lg:w-[calc(33.3333%-16px)]';
        card.style.setProperty('--sys-color', sysColor);
        card.setAttribute('data-url', sys.systemUrl);
        card.setAttribute('data-has-link', sys.systemUrl ? 'true' : 'false');
        card.setAttribute('data-system-id', sys.id);
        card.setAttribute('data-id', sys.id);
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
                <!-- System Preview Image Full Width at Top -->
                <div class="w-full overflow-hidden">
                    <img class="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100" src="${this.escapeHtml(sys.imageUrl)}" alt="${this.escapeHtml(sys.title)}" />
                </div>
                
                <div class="p-6 flex-1 flex flex-col justify-between">
                    <div>
                        <div class="flex items-start justify-between gap-3 mb-2">
                            <h3 class="text-lg font-bold text-white transition-colors">${this.escapeHtml(sys.title)}</h3>
                            <span class="shrink-0 whitespace-nowrap text-[10px] bg-white/20 px-2 py-0.5 font-extrabold uppercase" id="click-counter-${sys.id}">CLICKS ${parseInt(localStorage.getItem(`system_clicks_${sys.id}`) || '0', 10)}</span>
                        </div>
                        <p class="text-xs font-semibold text-white/70">${this.escapeHtml(sys.description)}</p>
                        <p class="mt-4 break-words text-[10px] font-semibold text-white/50">${this.escapeHtml(sys.systemUrl || 'No link')}</p>
                    </div>
                </div>
            </div>
        `;
        return card;
    }
    /* END createSystemCardHtml METHOD */

    /* START bindCardClick METHOD - Handles system card click with loading spinner feedback and redirect */
    bindCardClick(card, sysId) {
        card.addEventListener('click', (e) => {
            const url = card.getAttribute('data-url');
            const system = this.systems.find((item) => String(item.id) === String(sysId));
            const title = String(system?.title || '').toLowerCase();
            const systemKey = title.includes('spes') ? 'SPES' : title.includes('gip') ? 'GIP' : null;
            const openInNewTab = Boolean(e.ctrlKey || e.metaKey || e.button === 1);

            // Increment click counter
            if (sysId) {
                let clicks = parseInt(localStorage.getItem(`system_clicks_${sysId}`) || '0', 10);
                clicks++;
                localStorage.setItem(`system_clicks_${sysId}`, clicks);
                const counterEl = document.getElementById(`click-counter-${sysId}`);
                if (counterEl) {
                    counterEl.textContent = `CLICKS ${clicks}`;
                }
            }

            // Show loading spinner overlay on card before redirecting
            if (url && url.trim() !== '') {
                const overlay = card.querySelector('.card-loading-overlay');
                if (overlay) {
                    overlay.classList.remove('hidden');
                    overlay.classList.add('flex');
                    card.classList.add('pointer-events-none', 'scale-[0.99]');
                }

                // Auto-clear spinner safety fallback (e.g. if navigation is blocked)
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
                    // Clear spinner on system-launch complete (SSO check) if not navigating
                    window.addEventListener('portal:system-launch-done', () => {
                        clearTimeout(spinnerTimeout);
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
        });
    }
    /* END bindCardClick METHOD */

    bindDragAndDrop(card, sysId) {
        if (this.searchFilter.length > 0) {
            card.setAttribute('draggable', 'false');
            return;
        }
        card.setAttribute('draggable', 'true');

        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', sysId);
            card.classList.add('opacity-40');
            this.draggedId = sysId;
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('opacity-40');
            this.draggedId = null;
            this.gridEl.querySelectorAll('.system-card').forEach(c => {
                c.classList.remove('border-blue-500', 'scale-[0.98]');
            });
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.draggedId && this.draggedId !== sysId) {
                card.classList.add('border-blue-500', 'scale-[0.98]');
            }
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('border-blue-500', 'scale-[0.98]');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            const sourceId = e.dataTransfer.getData('text/plain');
            const targetId = sysId;

            if (sourceId && targetId && sourceId !== targetId) {
                const sourceIndex = this.systems.findIndex(s => s.id === sourceId);
                const targetIndex = this.systems.findIndex(s => s.id === targetId);

                if (sourceIndex !== -1 && targetIndex !== -1) {
                    const [draggedSystem] = this.systems.splice(sourceIndex, 1);
                    this.systems.splice(targetIndex, 0, draggedSystem);

                    this.saveCurrentSystemOrder();
                    this.render();
                }
            }
        });
    }

    getCurrentUserId() {
        return getCachedCurrentUser()?.id || 'default';
    }

    getSavedSystemOrder(userId) {
        try {
            const raw = localStorage.getItem(`system_order_${userId}`);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    saveCurrentSystemOrder() {
        const userId = this.getCurrentUserId();
        const cardIds = this.systems.map(sys => sys.id);
        localStorage.setItem(`system_order_${userId}`, JSON.stringify(cardIds));
    }

    render() {
        // 1. Render Desktop Grid
        this.gridEl.innerHTML = '';
        const filteredSystems = this.systems.filter(sys => 
            sys.title.toLowerCase().includes(this.searchFilter.toLowerCase()) ||
            sys.description.toLowerCase().includes(this.searchFilter.toLowerCase())
        );

        const visibleSystems = (this.searchFilter.length > 0) ? filteredSystems : filteredSystems.slice(0, this.limit);

        visibleSystems.forEach(sys => {
            const card = this.createSystemCardHtml(sys);
            this.gridEl.appendChild(card);
        });

        // Add Click listener to desktop cards
        this.gridEl.querySelectorAll('.system-card').forEach(card => {
            const sysId = card.getAttribute('data-system-id');
            this.bindCardClick(card, sysId);
            this.bindDragAndDrop(card, sysId);
        });

        // 2. Render Mobile Carousel
        const mobileWrapper = document.getElementById('systems-mobile-carousel-wrapper');
        const mobileIndicators = document.getElementById('systems-mobile-indicators');

        if (mobileWrapper && mobileIndicators) {
            mobileWrapper.innerHTML = '';
            mobileIndicators.innerHTML = '';

            if (filteredSystems.length === 0) {
                mobileWrapper.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <p class="text-sm font-semibold">No systems match your search query.</p>
                    </div>
                `;
            } else {
                filteredSystems.forEach((sys, index) => {
                    const slideItem = document.createElement('div');
                    slideItem.className = 'hidden duration-700 ease-in-out px-2';
                    slideItem.setAttribute('data-carousel-item', index === 0 ? 'active' : '');

                    const card = this.createSystemCardHtml(sys);
                    // Force full height to fit carousel bounds
                    card.classList.remove('min-h-[320px]');
                    card.classList.add('h-[320px]', 'w-full');
                    
                    slideItem.appendChild(card);
                    mobileWrapper.appendChild(slideItem);

                    // Add click handler
                    this.bindCardClick(card, sys.id);

                    // Create indicator dot
                    const indicator = document.createElement('button');
                    indicator.type = 'button';
                    indicator.className = 'w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-700 cursor-pointer';
                    indicator.setAttribute('aria-current', index === 0 ? 'true' : 'false');
                    indicator.setAttribute('aria-label', `Slide ${index + 1}`);
                    indicator.setAttribute('data-carousel-slide-to', index.toString());
                    mobileIndicators.appendChild(indicator);
                });

                // Dynamically re-initialize systems carousel script
                this.initMobileSystemsCarousel();
            }
        }

        // Update Show More Button State (Desktop only)
        const btnShowMoreContainer = document.getElementById('btn-show-more-container');
        const btnShowMoreText = document.getElementById('btn-show-more-text');
        
        if (btnShowMoreContainer && btnShowMoreText) {
            const totalFiltered = filteredSystems.length;
            if (totalFiltered <= 3 || this.searchFilter.length > 0) {
                btnShowMoreContainer.style.display = 'none';
            } else {
                btnShowMoreContainer.style.display = ''; // Let Tailwind sm:flex apply
                if (this.limit >= totalFiltered) {
                    btnShowMoreText.textContent = 'Show Less';
                } else {
                    btnShowMoreText.textContent = `Show More (+${Math.min(3, totalFiltered - this.limit)})`;
                }
            }
        }
    }

    async initNetworkChart() {
        const brandColor = '#1A56DB';
        const brandSecondaryColor = '#0E9F6E'; // Tailwind emerald-600

        let categories = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        let receivedData = [14, 22, 19, 28, 24, 11, 8];
        let resolvedData = [12, 18, 16, 25, 21, 9, 7];

        try {
            const { data: tickets } = await fetchTickets();
            if (Array.isArray(tickets) && tickets.length > 0) {
                const receivedCounts = [0, 0, 0, 0, 0, 0, 0];
                const resolvedCounts = [0, 0, 0, 0, 0, 0, 0];

                tickets.forEach(ticket => {
                    if (!ticket.created_at) return;
                    const d = new Date(ticket.created_at);
                    let dayIdx = d.getDay() - 1; // 0 = Mon, 6 = Sun
                    if (dayIdx === -1) dayIdx = 6; // Sunday

                    receivedCounts[dayIdx]++;
                    const st = String(ticket.status || '').toUpperCase();
                    if (['RESOLVED', 'CLOSED'].includes(st)) {
                        resolvedCounts[dayIdx]++;
                    }
                });

                if (receivedCounts.some(c => c > 0)) {
                    receivedData = receivedCounts;
                    resolvedData = resolvedCounts;
                }
            }
        } catch (e) {
            // fallback to default trend
        }

        const areaOptions = {
            xaxis: {
                show: true,
                categories: categories,
                labels: {
                    show: true,
                    style: {
                        fontFamily: "Inter, sans-serif",
                        cssClass: 'text-xs font-normal fill-gray-500 dark:fill-gray-400'
                    }
                },
                axisBorder: { show: false },
                axisTicks: { show: false },
            },
            yaxis: {
                show: true,
                labels: {
                    show: true,
                    style: {
                        fontFamily: "Inter, sans-serif",
                        cssClass: 'text-xs font-normal fill-gray-500 dark:fill-gray-400'
                    },
                    formatter: function (value) {
                        return Math.round(value);
                    }
                }
            },
            series: [
                {
                    name: "Received Tickets",
                    data: receivedData,
                    color: brandColor,
                },
                {
                    name: "Resolved Tickets",
                    data: resolvedData,
                    color: brandSecondaryColor,
                },
            ],
            chart: {
                sparkline: { enabled: false },
                height: 280,
                width: "100%",
                type: "area",
                fontFamily: "Inter, sans-serif",
                dropShadow: { enabled: false },
                toolbar: { show: false },
            },
            tooltip: {
                enabled: true,
                x: { show: true },
            },
            fill: {
                type: "gradient",
                gradient: {
                    opacityFrom: 0.55,
                    opacityTo: 0,
                    shade: brandColor,
                    gradientToColors: [brandColor],
                },
            },
            dataLabels: { enabled: false },
            stroke: { width: 4 },
            legend: { show: true, position: 'bottom', horizontalAlign: 'center', labels: { colors: '#6b7280' } },
            grid: {
                show: true,
                strokeDashArray: 4,
                borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb',
                padding: {
                    left: 15,
                    right: 35,
                    top: 20,
                    bottom: 10
                },
            }
        };

        const chartEl = document.getElementById('staff-active-users-chart');
        if (chartEl) {
            const areaChart = new ApexCharts(chartEl, areaOptions);
            areaChart.render();
        }

        const chartElMobile = document.getElementById('staff-active-users-chart-mobile');
        if (chartElMobile) {
            const mobileOptions = { ...areaOptions, chart: { ...areaOptions.chart, height: 240 } };
            const areaChartMobile = new ApexCharts(chartElMobile, mobileOptions);
            areaChartMobile.render();
        }
    }

    /* START MOBILE CAROUSEL INITIALIZATION */
    initMobileCarousel() {
        const carouselEl = document.getElementById('stats-mobile-carousel');
        if (!carouselEl) return;

        // Collect all slide items and indicators
        const items = Array.from(carouselEl.querySelectorAll('[data-carousel-item]')).map((el, index) => ({
            position: index,
            el: el
        }));

        const indicatorItems = Array.from(carouselEl.querySelectorAll('[data-carousel-slide-to]')).map((el, index) => ({
            position: index,
            el: el
        }));

        const options = {
            defaultPosition: 0,
            interval: 0,
            type: 'slide',
            indicators: {
                activeClasses: 'bg-blue-600 dark:bg-white scale-110',
                inactiveClasses: 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600',
                items: indicatorItems
            }
        };

        // Initialize Flowbite Carousel programmatically using DashboardCarousel
        const instanceOptions = { id: carouselEl.id, override: true };
        this.statsCarousel = new DashboardCarousel(carouselEl, items, options, instanceOptions);

        // Bind touch swipe support manually
        let touchStartX = 0;
        let touchEndX = 0;

        carouselEl.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        carouselEl.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            if (touchEndX < touchStartX - 50) {
                this.statsCarousel.next();
            }
            if (touchEndX > touchStartX + 50) {
                this.statsCarousel.prev();
            }
        }, { passive: true });
    }
    /* END MOBILE CAROUSEL INITIALIZATION */

    /* START MOBILE SYSTEMS CAROUSEL INITIALIZATION */
    initMobileSystemsCarousel() {
        const carouselEl = document.getElementById('systems-mobile-carousel');
        if (!carouselEl) return;

        const items = Array.from(carouselEl.querySelectorAll('[data-carousel-item]')).map((el, index) => ({
            position: index,
            el: el
        }));

        const indicatorItems = Array.from(carouselEl.querySelectorAll('[data-carousel-slide-to]')).map((el, index) => ({
            position: index,
            el: el
        }));

        const options = {
            defaultPosition: 0,
            interval: 0,
            type: 'slide',
            indicators: {
                activeClasses: 'bg-blue-600 dark:bg-white scale-110',
                inactiveClasses: 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600',
                items: indicatorItems
            }
        };

        if (this.systemsCarousel) {
            // Clean up intervals of previous carousel instance
            this.systemsCarousel.pause();
        }

        // Initialize Flowbite Carousel programmatically using DashboardCarousel
        const instanceOptions = { id: carouselEl.id, override: true };
        this.systemsCarousel = new DashboardCarousel(carouselEl, items, options, instanceOptions);

        // Bind touch swipe support manually (ensure only bound once)
        if (!this.systemsSwipeBound) {
            let touchStartX = 0;
            let touchEndX = 0;

            carouselEl.addEventListener('touchstart', e => {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });

            carouselEl.addEventListener('touchend', e => {
                touchEndX = e.changedTouches[0].screenX;
                if (this.systemsCarousel) {
                    if (touchEndX < touchStartX - 50) {
                        this.systemsCarousel.next();
                    }
                    if (touchEndX > touchStartX + 50) {
                        this.systemsCarousel.prev();
                    }
                }
            }, { passive: true });

            this.systemsSwipeBound = true;
        }
    }
    /* END MOBILE SYSTEMS CAROUSEL INITIALIZATION */

    /* START MOBILE CHARTS CAROUSEL INITIALIZATION */
    initChartsMobileCarousel() {
        const carouselEl = document.getElementById('charts-mobile-carousel');
        if (!carouselEl) return;

        const items = Array.from(carouselEl.querySelectorAll('[data-carousel-item]')).map((el, index) => ({
            position: index,
            el: el
        }));

        const indicatorItems = Array.from(carouselEl.querySelectorAll('[data-carousel-slide-to]')).map((el, index) => ({
            position: index,
            el: el
        }));

        const options = {
            defaultPosition: 0,
            interval: 0,
            type: 'slide',
            indicators: {
                activeClasses: 'bg-blue-600 dark:bg-white scale-110',
                inactiveClasses: 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600',
                items: indicatorItems
            },
            onChange: () => {
                // Trigger window resize so ApexCharts recalculates its dimensions when shown
                window.dispatchEvent(new Event('resize'));
            }
        };

        const instanceOptions = { id: carouselEl.id, override: true };
        this.chartsCarousel = new DashboardCarousel(carouselEl, items, options, instanceOptions);

        // Bind touch swipe support manually
        let touchStartX = 0;
        let touchEndX = 0;

        carouselEl.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        carouselEl.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            if (this.chartsCarousel) {
                if (touchEndX < touchStartX - 50) {
                    this.chartsCarousel.next();
                }
                if (touchEndX > touchStartX + 50) {
                    this.chartsCarousel.prev();
                }
            }
        }, { passive: true });
    }
    /* END MOBILE CHARTS CAROUSEL INITIALIZATION */

    /* START STAFF OFFICE HOURS SYSTEM */
    renderOfficeStatus() {
        const valueEls = document.querySelectorAll('[data-staff-office-status-value], #staff-office-status-value, #mobile-office-status-value');
        const subtextEls = document.querySelectorAll('[data-staff-office-status-subtext], #staff-office-status-subtext, #mobile-office-status-subtext');

        if (!valueEls.length && !subtextEls.length) return;

        const now = new Date();
        const day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const currentMinutes = hours * 60 + minutes;

        let statusText = 'CLOSED';
        let subtext = '● Office Closed';
        let colorClass = 'text-rose-500 dark:text-rose-400';

        if (day === 0 || day === 6) {
            // Weekend
            statusText = 'CLOSED';
            subtext = '● Closed on Weekends';
            colorClass = 'text-rose-500 dark:text-rose-400';
        } else {
            // Monday - Friday
            const openMorning = 8 * 60; // 8:00 AM (480 mins)
            const lunchStart = 12 * 60 + 1; // 12:01 PM (721 mins)
            const lunchEnd = 13 * 60; // 1:00 PM (780 mins)
            const openAfternoonEnd = 17 * 60 + 1; // 5:01 PM (1021 mins)

            if (currentMinutes < openMorning) {
                statusText = 'CLOSED';
                subtext = '● Opens at 8:00 AM';
                colorClass = 'text-rose-500 dark:text-rose-400';
            } else if (currentMinutes >= openMorning && currentMinutes < lunchStart) {
                statusText = 'OPEN';
                subtext = '● Mon - Fri (8:00 AM - 5:00 PM)';
                colorClass = 'text-emerald-500 dark:text-emerald-400';
            } else if (currentMinutes >= lunchStart && currentMinutes <= lunchEnd) {
                statusText = 'LUNCH BREAK';
                subtext = '● Resumes at 1:01 PM';
                colorClass = 'text-amber-500 dark:text-amber-400';
            } else if (currentMinutes > lunchEnd && currentMinutes <= openAfternoonEnd) {
                statusText = 'OPEN';
                subtext = '● Mon - Fri (8:00 AM - 5:00 PM)';
                colorClass = 'text-emerald-500 dark:text-emerald-400';
            } else {
                statusText = 'CLOSED';
                subtext = '● Office Closed';
                colorClass = 'text-rose-500 dark:text-rose-400';
            }
        }

        valueEls.forEach(el => {
            el.textContent = statusText;
        });

        subtextEls.forEach(el => {
            el.textContent = subtext;
            el.className = `block text-[9px] font-bold ${colorClass} mt-1 uppercase tracking-wider`;
        });

        if (window.DEBUG) {
            window.DEBUG.success('OFFICE_HOURS', `DOLE Office Status: ${statusText} (${subtext})`);
        }
    }
    /* END STAFF OFFICE HOURS SYSTEM */

    async renderActiveAssistantsMetric() {
        const valEls = document.querySelectorAll('[data-staff-active-assistants-value], #staff-active-assistants-value, #mobile-active-assistants-value');
        if (!valEls.length) return;

        const currentUser = getCachedCurrentUser();
        const userId = currentUser?.id;
        if (!userId) {
            valEls.forEach(el => { el.textContent = '0'; });
            return;
        }

        const { data: gips, error } = await fetchGipsByStaff(userId);
        if (error || !Array.isArray(gips)) {
            valEls.forEach(el => { el.textContent = '0'; });
            return;
        }

        let onlineCount = 0;
        let offlineCount = 0;

        gips.forEach(gip => {
            const status = String(gip?.status || '').toLowerCase();
            const isOnline = ['active', 'online'].includes(status);
            if (isOnline) {
                onlineCount++;
            } else {
                offlineCount++;
            }
        });

        const netCount = onlineCount - offlineCount;
        const displayCount = Math.max(0, netCount);
        valEls.forEach(el => {
            el.textContent = displayCount.toLocaleString();
        });
    }

    /* TEMPORARILY DISABLED: START RECENT ACTIVE STAFF SYSTEM
    async renderRecentActiveStaff() {
        const desktopContainer = document.getElementById('staff-recent-active-list');
        const mobileContainer = document.getElementById('mobile-recent-active-list');

        if (!desktopContainer && !mobileContainer) return;

        const { data: users, error } = await fetchUsers();
        if (error || !Array.isArray(users) || users.length === 0) {
            const errHtml = '<p class="text-xs text-gray-500 dark:text-gray-400 py-2">No active staff found.</p>';
            if (desktopContainer) desktopContainer.innerHTML = errHtml;
            if (mobileContainer) mobileContainer.innerHTML = errHtml;
            return;
        }

        // Filter staff & hr users
        const staffUsers = users.filter(user => {
            const roleName = String(user?.roles?.name || '').trim().toLowerCase();
            return ['hr', 'staff'].includes(roleName) || [2, 3].includes(Number(user?.role_id));
        });

        const parseTime = (u) => {
            if (u.last_seen) return new Date(u.last_seen).getTime();
            if (u.created_at) return new Date(u.created_at).getTime();
            return 0;
        };

        const onlineStaff = staffUsers
            .filter(u => ['active', 'online'].includes(String(u.status || '').toLowerCase()))
            .sort((a, b) => parseTime(b) - parseTime(a));

        const offlineStaff = staffUsers
            .filter(u => !['active', 'online'].includes(String(u.status || '').toLowerCase()))
            .sort((a, b) => parseTime(b) - parseTime(a));

        let selectedOnline = onlineStaff.slice(0, 3);
        let selectedOffline = offlineStaff.slice(0, 2);

        if (selectedOnline.length < 3) {
            const fillCount = 3 - selectedOnline.length;
            selectedOffline = [...selectedOffline, ...offlineStaff.slice(2, 2 + fillCount)];
        }

        if (selectedOffline.length < 2) {
            const fillCount = 2 - selectedOffline.length;
            selectedOnline = [...selectedOnline, ...onlineStaff.slice(3, 3 + fillCount)];
        }

        const finalStaffList = [...selectedOnline, ...selectedOffline].slice(0, 5);

        const timeAgo = (timestamp) => {
            if (!timestamp) return 'Recently';
            const now = Date.now();
            const diffSec = Math.max(0, Math.floor((now - new Date(timestamp).getTime()) / 1000));
            if (diffSec < 60) return 'Just now';
            if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
            if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
            return `${Math.floor(diffSec / 86400)}d ago`;
        };

        const renderItems = (items, isMobile = false) => {
            if (!items.length) {
                return '<p class="text-xs text-gray-500 dark:text-gray-400 py-2">No staff activity recorded.</p>';
            }

            const badgeStyles = [
                'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-700/50',
                'bg-slate-200 text-slate-700 border-slate-400 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-500',
                'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700/50',
                'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
                'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
            ];

            return items.map((staff, idx) => {
                const name = this.escapeHtml(staff.full_name || staff.username || 'Staff Member');
                const isOnline = ['active', 'online'].includes(String(staff.status || '').toLowerCase());
                const lastSeenText = timeAgo(staff.last_seen || staff.created_at);
                const badgeStyle = badgeStyles[idx] || badgeStyles[3];
                const statusBadge = isOnline
                    ? '<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded dark:bg-emerald-900/60 dark:text-emerald-400">● Online</span>'
                    : '<span class="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded dark:bg-rose-900/60 dark:text-rose-400">● Offline</span>';

                const pyClass = isMobile ? 'py-1.5' : 'py-2';
                const borderClass = idx < items.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : '';

                return `
                    <div class="flex items-center justify-between ${pyClass} ${borderClass}">
                        <div class="flex items-center gap-3">
                            <div class="flex items-center justify-center w-6 h-6 rounded-full font-extrabold text-xs border shadow-sm ${badgeStyle}">
                                ${idx + 1}
                            </div>
                            <div>
                                <h4 class="text-xs font-bold text-gray-900 dark:text-white leading-tight">${name}</h4>
                                <p class="text-[10px] text-gray-500 dark:text-gray-400">${isOnline ? 'Online' : 'Offline'} • ${lastSeenText}</p>
                            </div>
                        </div>
                        ${statusBadge}
                    </div>
                `;
            }).join('');
        };

        const desktopHtml = renderItems(finalStaffList, false);
        const mobileHtml = renderItems(finalStaffList, true);

        if (desktopContainer) desktopContainer.innerHTML = desktopHtml;
        if (mobileContainer) mobileContainer.innerHTML = mobileHtml;
    }
    END TEMPORARILY DISABLED: RECENT ACTIVE STAFF SYSTEM */

    /* START PH HOLIDAY CALENDAR & DIRECTORY SYSTEM */
    getPHHolidayWorkStatus(holiday) {
        const name = String(holiday?.name || '').toLowerCase();
        const localName = String(holiday?.localName || '').toLowerCase();

        // 1. Regular National Holidays (Mandatory No Work in Gov/Private + Classes Suspended)
        const regularHolidays = [
            "new year's day", "maundy thursday", "good friday", "day of valor", "araw ng kagitingan",
            "labour day", "labor day", "independence day", "national heroes day", "bonifacio day",
            "christmas day", "rizal day", "eidul fitr", "eid'l fitr", "eid al-fitr", "eid al-adha", "eidul adha"
        ];

        // 2. Special Working Days / Half-Day / Observances
        const specialWorkingHolidays = [
            "all saints' day eve", "christmas eve", "last day of the year", "edsa people power"
        ];

        const isRegular = regularHolidays.some(k => name.includes(k) || localName.includes(k));
        const isSpecialWorking = specialWorkingHolidays.some(k => name.includes(k) || localName.includes(k));

        if (isRegular) {
            return {
                category: 'Regular Holiday',
                workStatus: 'No Work (Classes & Gov Suspended)',
                typeKey: 'no-work',
                bgClass: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300',
                badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/70 dark:text-rose-300 border-rose-300 dark:border-rose-700',
                dotClass: 'bg-rose-500',
                statusBadge: 'bg-red-600 text-white font-black'
            };
        } else if (isSpecialWorking) {
            return {
                category: 'Special Working / Eve Observance',
                workStatus: 'Regular / Half-Day Operations',
                typeKey: 'special',
                bgClass: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300',
                badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-300 border-blue-300 dark:border-blue-700',
                dotClass: 'bg-blue-500',
                statusBadge: 'bg-blue-600 text-white font-bold'
            };
        } else {
            // Special Non-Working Day (e.g., Chinese New Year, Ninoy Aquino Day, All Saints Day, Immaculate Conception, Holy Saturday)
            return {
                category: 'Special Non-Working Holiday',
                workStatus: 'No Work (No Class / Non-Working)',
                typeKey: 'no-work',
                bgClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300',
                badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-300 border-amber-300 dark:border-amber-700',
                dotClass: 'bg-amber-500',
                statusBadge: 'bg-amber-600 text-white font-bold'
            };
        }
    }

    async fetchPHHolidays(year) {
        const cacheKey = `ph_holidays_v3_${year}`;
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
            // ignore storage errors
        }

        try {
            const res = await fetch(`https://date.nager.at/Api/v3/PublicHolidays/${year}/PH`);
            if (!res.ok) {
                throw new Error(`PH Holidays API HTTP ${res.status}`);
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify(data));
                } catch (e) {}
                window.DEBUG?.success('HOLIDAYS', `Fetched ${data.length} PH holidays for ${year}.`);
                return data;
            }
            return [];
        } catch (err) {
            window.DEBUG?.warn('HOLIDAYS', `Failed to fetch PH holidays for ${year}`, err);
            return [];
        }
    }

    initPHHolidayCalendar() {
        const desktopPanel = document.getElementById('ph-holiday-calendar-panel');
        const mobileCard = document.getElementById('ph-holiday-mobile-card');
        const directoryPanel = document.getElementById('ph-holidays-directory-panel');
        if (!desktopPanel && !mobileCard && !directoryPanel) return;

        const now = new Date();
        this.phCalMonth = now.getMonth();
        this.phCalYear = now.getFullYear();
        this.phActiveFilter = 'all';

        const bindNav = (prevId, nextId) => {
            const prevBtn = document.getElementById(prevId);
            const nextBtn = document.getElementById(nextId);

            prevBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                const oldYear = this.phCalYear;
                this.phCalMonth--;
                if (this.phCalMonth < 0) {
                    this.phCalMonth = 11;
                    this.phCalYear--;
                }
                this.renderPHHolidayCalendar();
                if (oldYear !== this.phCalYear) {
                    this.renderPHHolidaysDirectory();
                }
            });

            nextBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                const oldYear = this.phCalYear;
                this.phCalMonth++;
                if (this.phCalMonth > 11) {
                    this.phCalMonth = 0;
                    this.phCalYear++;
                }
                this.renderPHHolidayCalendar();
                if (oldYear !== this.phCalYear) {
                    this.renderPHHolidaysDirectory();
                }
            });
        };

        bindNav('ph-cal-prev-btn', 'ph-cal-next-btn');
        bindNav('mobile-ph-cal-prev-btn', 'mobile-ph-cal-next-btn');

        // Filter button clicks (Desktop Directory)
        const filterBtns = document.querySelectorAll('.holiday-filter-btn[data-holiday-filter]');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.phActiveFilter = btn.dataset.holidayFilter || 'all';

                filterBtns.forEach(b => {
                    const isActive = b.dataset.holidayFilter === this.phActiveFilter;
                    if (isActive) {
                        b.className = 'cursor-pointer holiday-filter-btn px-2.5 py-1 text-[11px] font-bold rounded-md bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-xs transition-colors';
                    } else {
                        b.className = 'cursor-pointer holiday-filter-btn px-2.5 py-1 text-[11px] font-bold rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors';
                    }
                });

                this.renderPHHolidaysDirectory();
            });
        });

        // Filter button clicks (Mobile Drawer)
        const mobileFilterBtns = document.querySelectorAll('.mobile-drawer-filter-btn[data-mobile-filter]');
        mobileFilterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.phActiveFilter = btn.dataset.mobileFilter || 'all';

                mobileFilterBtns.forEach(b => {
                    const isActive = b.dataset.mobileFilter === this.phActiveFilter;
                    if (isActive) {
                        b.className = 'cursor-pointer mobile-drawer-filter-btn px-2.5 py-1 text-[11px] font-bold rounded-md bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-xs transition-colors';
                    } else {
                        b.className = 'cursor-pointer mobile-drawer-filter-btn px-2.5 py-1 text-[11px] font-bold rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors';
                    }
                });

                this.renderPHHolidaysDirectory();
            });
        });

        this.renderPHHolidayCalendar();
        this.renderPHHolidaysDirectory();
    }

    async renderPHHolidaysDirectory() {
        const listContainer = document.getElementById('ph-holidays-full-list');
        const mobileDrawerContainer = document.getElementById('mobile-holidays-drawer-list');
        const yearBadge = document.getElementById('ph-holiday-list-year-badge');
        const mobileDrawerYearBadge = document.getElementById('mobile-drawer-year-badge');

        if (yearBadge) yearBadge.textContent = String(this.phCalYear);
        if (mobileDrawerYearBadge) mobileDrawerYearBadge.textContent = String(this.phCalYear);

        if (!listContainer && !mobileDrawerContainer) return;

        const holidays = await this.fetchPHHolidays(this.phCalYear);
        if (!Array.isArray(holidays) || holidays.length === 0) {
            const emptyHtml = '<p class="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">No holiday schedules found for this year.</p>';
            if (listContainer) listContainer.innerHTML = emptyHtml;
            if (mobileDrawerContainer) mobileDrawerContainer.innerHTML = emptyHtml;
            return;
        }

        let noWorkCount = 0;
        let specialCount = 0;

        holidays.forEach(h => {
            const status = this.getPHHolidayWorkStatus(h);
            if (status.typeKey === 'no-work') noWorkCount++;
            else specialCount++;
        });

        // Update Desktop & Mobile Drawer Counts
        const countMap = {
            'count-filter-all': holidays.length,
            'count-filter-nowork': noWorkCount,
            'count-filter-special': specialCount,
            'mobile-drawer-count-all': holidays.length,
            'mobile-drawer-count-nowork': noWorkCount,
            'mobile-drawer-count-special': specialCount
        };

        Object.entries(countMap).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });

        const filteredHolidays = holidays.filter(h => {
            if (this.phActiveFilter === 'all') return true;
            const status = this.getPHHolidayWorkStatus(h);
            return status.typeKey === this.phActiveFilter;
        });

        if (!filteredHolidays.length) {
            const noMatchHtml = '<p class="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">No holidays match the selected filter.</p>';
            if (listContainer) listContainer.innerHTML = noMatchHtml;
            if (mobileDrawerContainer) mobileDrawerContainer.innerHTML = noMatchHtml;
            return;
        }

        const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        const html = filteredHolidays.map((holiday) => {
            const status = this.getPHHolidayWorkStatus(holiday);
            const dateObj = new Date(holiday.date);
            const monthStr = monthShortNames[dateObj.getMonth()] || '';
            const dayNum = dateObj.getDate() || '';
            const dayOfWeek = dayNames[dateObj.getDay()] || '';

            const localNameHtml = holiday.localName && holiday.localName !== holiday.name
                ? `<span class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 break-words"> • 🇵🇭 ${this.escapeHtml(holiday.localName)}</span>`
                : '';

            return `
                <div class="group p-3 rounded-lg border transition-all duration-200 hover:shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${status.bgClass}">
                  <div class="flex items-start sm:items-center gap-3">
                    <!-- Date badge -->
                    <div class="flex flex-col items-center justify-center min-w-[48px] py-1 px-1.5 rounded-md bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs shrink-0 text-center">
                      <span class="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 leading-tight">${monthStr}</span>
                      <span class="text-base font-black text-gray-900 dark:text-white leading-none">${dayNum}</span>
                    </div>

                    <!-- Holiday Information with responsive text wrapping -->
                    <div class="min-w-0 flex-1">
                      <div class="flex items-baseline gap-1.5 flex-wrap">
                        <h4 class="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white leading-snug break-words text-wrap">
                          ${this.escapeHtml(holiday.name)}
                        </h4>
                        ${localNameHtml}
                      </div>
                      <div class="flex items-center gap-2 mt-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium flex-wrap">
                        <span>${dayOfWeek}</span>
                        <span>•</span>
                        <span class="inline-flex items-center gap-1 font-semibold ${status.typeKey === 'no-work' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}">
                          <span class="w-1.5 h-1.5 rounded-full ${status.dotClass}"></span>
                          ${status.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Work / School Status Tag -->
                  <div class="shrink-0 flex items-center gap-2 mt-1 sm:mt-0">
                    <span class="inline-flex items-center text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-full shadow-xs text-wrap leading-tight text-center ${status.statusBadge}">
                      ${status.workStatus}
                    </span>
                  </div>
                </div>
            `;
        }).join('');

        if (listContainer) listContainer.innerHTML = html;
        if (mobileDrawerContainer) mobileDrawerContainer.innerHTML = html;
    }

    async renderPHHolidayCalendar() {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const monthLabel = `${monthNames[this.phCalMonth]} ${this.phCalYear}`;
        const desktopLabelEl = document.getElementById('ph-cal-month-label');
        const mobileLabelEl = document.getElementById('mobile-ph-cal-month-label');
        if (desktopLabelEl) desktopLabelEl.textContent = monthLabel;
        if (mobileLabelEl) mobileLabelEl.textContent = monthLabel;

        const desktopDaysEl = document.getElementById('ph-cal-days-grid');
        const mobileDaysEl = document.getElementById('mobile-ph-cal-days-grid');
        const tooltipsContainer = document.getElementById('ph-cal-tooltips-container');

        const holidays = await this.fetchPHHolidays(this.phCalYear);

        // Map holidays for current month by day number
        const currentMonthPrefix = `${this.phCalYear}-${String(this.phCalMonth + 1).padStart(2, '0')}`;
        const holidaysByDay = {};
        const monthHolidays = [];

        holidays.forEach(h => {
            if (typeof h?.date === 'string' && h.date.startsWith(currentMonthPrefix)) {
                const dayNum = parseInt(h.date.split('-')[2], 10);
                if (!isNaN(dayNum)) {
                    holidaysByDay[dayNum] = h;
                    monthHolidays.push(h);
                }
            }
        });

        const holidayCountText = `${monthHolidays.length} holiday${monthHolidays.length === 1 ? '' : 's'}`;
        const countEl = document.getElementById('ph-cal-holiday-count');
        const mobileCountEl = document.getElementById('mobile-ph-cal-holiday-count');
        if (countEl) countEl.textContent = holidayCountText;
        if (mobileCountEl) mobileCountEl.textContent = holidayCountText;

        // Date math
        const firstDayOfWeek = new Date(this.phCalYear, this.phCalMonth, 1).getDay(); // 0 = Sun, 1 = Mon ...
        const totalDaysInMonth = new Date(this.phCalYear, this.phCalMonth + 1, 0).getDate();

        const today = new Date();
        const isCurrentMonthNow = today.getFullYear() === this.phCalYear && today.getMonth() === this.phCalMonth;
        const currentTodayDate = today.getDate();

        let daysHtml = '';
        let tooltipsHtml = '';

        // Empty offset cells
        for (let i = 0; i < firstDayOfWeek; i++) {
            daysHtml += '<div class="h-8 flex items-center justify-center text-transparent select-none"></div>';
        }

        // Days
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const holiday = holidaysByDay[day];
            const isToday = isCurrentMonthNow && day === currentTodayDate;
            const tooltipId = `tooltip-ph-${this.phCalYear}-${this.phCalMonth}-${day}`;
            const todayTooltipId = `tooltip-today-${this.phCalYear}-${this.phCalMonth}-${day}`;

            if (holiday) {
                const status = this.getPHHolidayWorkStatus(holiday);
                const tooltipTitle = `${holiday.name}${holiday.localName && holiday.localName !== holiday.name ? ` (${holiday.localName})` : ''} - ${status.category}`;
                
                daysHtml += `
                    <div class="relative h-9 w-full flex flex-col items-center justify-center rounded-lg font-black text-rose-700 dark:text-rose-300 bg-rose-50/95 dark:bg-rose-950/50 border border-rose-300/80 dark:border-rose-800/80 hover:bg-rose-100 dark:hover:bg-rose-900/70 hover:scale-105 transition-all select-none cursor-pointer group shadow-xs"
                         data-tooltip-target="${tooltipId}"
                         data-tooltip-placement="top"
                         title="${this.escapeHtml(tooltipTitle)}"
                         role="button"
                         tabindex="0"
                         aria-label="${this.escapeHtml(holiday.name)}">
                      <span class="text-xs leading-none">${day}</span>
                      <span class="w-1.5 h-1.5 rounded-full ${status.dotClass} mt-1 ring-2 ring-rose-200 dark:ring-rose-900"></span>
                    </div>
                `;

                const localNameHtml = holiday.localName && holiday.localName !== holiday.name
                    ? `<div class="text-[11px] text-amber-300 font-semibold mt-0.5">🇵🇭 ${this.escapeHtml(holiday.localName)}</div>`
                    : '';

                tooltipsHtml += `
                    <div id="${tooltipId}" role="tooltip" class="absolute z-50 invisible inline-block px-3.5 py-2.5 text-xs font-medium text-white transition-opacity duration-300 bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-xs rounded-lg shadow-xl opacity-0 tooltip border border-gray-700/80 max-w-[260px] text-left pointer-events-none">
                      <div class="font-black text-white text-xs flex items-center gap-1.5 leading-snug">
                        <span class="w-2 h-2 rounded-full ${status.dotClass} inline-block shrink-0"></span>
                        <span>${this.escapeHtml(holiday.name)}</span>
                      </div>
                      ${localNameHtml}
                      <div class="mt-2 pt-1.5 border-t border-gray-700/60 flex flex-col gap-1 text-[10px] text-gray-300">
                        <div class="flex items-center justify-between gap-1">
                          <span class="font-bold text-rose-300 uppercase">${status.category}</span>
                          <span class="font-mono text-gray-400">${this.escapeHtml(holiday.date)}</span>
                        </div>
                        <div class="text-[9px] font-black uppercase text-amber-400 bg-black/40 px-1.5 py-0.5 rounded text-center">
                          ${status.workStatus}
                        </div>
                      </div>
                      <div class="tooltip-arrow" data-popper-arrow></div>
                    </div>
                `;
            } else if (isToday) {
                const todayFormatted = `${monthNames[this.phCalMonth]} ${day}, ${this.phCalYear}`;
                daysHtml += `
                    <div class="relative h-9 w-full flex flex-col items-center justify-center rounded-lg font-black text-blue-700 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-950/60 ring-2 ring-blue-500 dark:ring-blue-400 shadow-xs hover:scale-105 transition-all select-none cursor-pointer"
                         data-tooltip-target="${todayTooltipId}"
                         data-tooltip-placement="top"
                         title="Today - ${todayFormatted}"
                         role="button"
                         tabindex="0">
                      <span class="text-xs leading-none font-black">${day}</span>
                      <span class="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-1 animate-ping"></span>
                    </div>
                `;

                tooltipsHtml += `
                    <div id="${todayTooltipId}" role="tooltip" class="absolute z-50 invisible inline-block px-3 py-2 text-xs font-medium text-white transition-opacity duration-300 bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-xs rounded-lg shadow-xl opacity-0 tooltip border border-gray-700 max-w-[200px] text-left pointer-events-none">
                      <div class="font-extrabold text-blue-400 flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                        <span>Today</span>
                      </div>
                      <div class="text-[11px] text-gray-300 mt-0.5 font-medium">${todayFormatted}</div>
                      <div class="tooltip-arrow" data-popper-arrow></div>
                    </div>
                `;
            } else {
                daysHtml += `
                    <div class="h-9 w-full flex items-center justify-center rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors select-none cursor-default">
                      <span class="text-xs">${day}</span>
                    </div>
                `;
            }
        }

        if (desktopDaysEl) desktopDaysEl.innerHTML = daysHtml;
        if (mobileDaysEl) mobileDaysEl.innerHTML = daysHtml;
        if (tooltipsContainer) {
            tooltipsContainer.innerHTML = tooltipsHtml;
        }

        // Re-initialize Flowbite tooltips dynamically
        try {
            initTooltips();
        } catch (e) {
            window.DEBUG?.warn('FLOWBITE', 'Tooltip auto-init skipped', e);
        }
    }
    /* END PH HOLIDAY CALENDAR & DIRECTORY SYSTEM */

    async renderActiveStaffsMetric() {
        const valEls = document.querySelectorAll('[data-staff-active-staffs-value], #staff-active-staffs-value, #mobile-active-staffs-value');
        if (!valEls.length) return;

        const { data: users, error } = await fetchUsers();
        if (error || !Array.isArray(users)) {
            valEls.forEach(el => { el.textContent = '0'; });
            return;
        }

        let onlineCount = 0;

        users.forEach(user => {
            const roleName = String(user?.roles?.name || '').trim().toLowerCase();
            const isStaff = ['hr', 'staff'].includes(roleName) || [2, 3].includes(Number(user?.role_id));
            if (isStaff) {
                const status = String(user?.status || '').toLowerCase();
                const isOnline = ['active', 'online'].includes(status);
                if (isOnline) {
                    onlineCount++;
                }
            }
        });

        // START ONLINE STAFF COUNT FIX
        // This card represents currently online staff, not online minus offline.
        const onlineStaffCount = Math.max(0, onlineCount);
        valEls.forEach(el => {
            el.textContent = onlineStaffCount.toLocaleString();
        });
        // END ONLINE STAFF COUNT FIX
    }
}
/* END STAFF-EXCLUSIVE DASHBOARD CONTROLLER */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initThemeToggler();
        initQuickActionsSwitcher();
        new AdminDashboardController();
        new StaffDashboardController();
    });
} else {
    initThemeToggler();
    initQuickActionsSwitcher();
    new AdminDashboardController();
    new StaffDashboardController();
}
