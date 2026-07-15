import { getPreference, setPreference } from './cookies.js';
import ApexCharts from 'apexcharts';
import { Modal } from 'flowbite';
import { DashboardCarousel } from './slider.js';
import { fetchUserDashboardCounts } from '@/backend/api/users.api.js';
import { fetchSystems } from '@/backend/api/systems.api.js';
import { fetchTickets } from '@/backend/api/tickets.api.js';

/* START THEME TOGGLER */
const initThemeToggler = () => {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const darkIcon = document.getElementById('theme-toggle-dark-icon');
    const lightIcon = document.getElementById('theme-toggle-light-icon');

    if (!themeToggleBtn) return;

    // Check current theme and update icons
    if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        lightIcon?.classList.remove('hidden');
        document.documentElement.classList.add('dark');
    } else {
        darkIcon?.classList.remove('hidden');
        document.documentElement.classList.remove('dark');
    }

    themeToggleBtn.addEventListener('click', function() {
        // toggle icons
        darkIcon?.classList.toggle('hidden');
        lightIcon?.classList.toggle('hidden');

        // if set via local storage previously
        if (localStorage.getItem('color-theme')) {
            if (localStorage.getItem('color-theme') === 'light') {
                document.documentElement.classList.add('dark');
                localStorage.setItem('color-theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('color-theme', 'light');
            }
        // if NOT set via local storage previously
        } else {
            if (document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('color-theme', 'light');
            } else {
                document.documentElement.classList.add('dark');
                localStorage.setItem('color-theme', 'dark');
            }
        }
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
        this.metricEls = {
            totalStaff: document.getElementById('admin-total-staff-value'),
            totalTickets: document.getElementById('admin-total-tickets-value'),
            openTickets: document.getElementById('admin-open-tickets-value'),
            totalResigned: document.getElementById('admin-total-resigned-value'),
        };

        if (!Object.values(this.metricEls).some(Boolean)) return;

        this.renderUserMetrics();
        this.renderTicketMetrics();
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

    async renderTicketMetrics() {
        const { data: tickets, error } = await fetchTickets();
        if (error) {
            this.setMetric('totalTickets', null);
            this.setMetric('openTickets', null);
            return;
        }

        const openStatuses = new Set(['open', 'pending']);
        const totalTickets = tickets.length;
        const openTickets = tickets.filter(ticket => openStatuses.has(String(ticket.status || '').toLowerCase())).length;

        this.setMetric('totalTickets', totalTickets);
        this.setMetric('openTickets', openTickets);
    }
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
    }

    getFilteredCount() {
        return this.systems.filter(sys => 
            sys.title.toLowerCase().includes(this.searchFilter.toLowerCase()) ||
            sys.description.toLowerCase().includes(this.searchFilter.toLowerCase())
        ).length;
    }

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

    bindCardClick(card, sysId) {
        card.addEventListener('click', () => {
            const url = card.getAttribute('data-url');
            
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

            // Redirect
            if (url && url.trim() !== '') {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        });
    }

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
        try {
            const session = JSON.parse(localStorage.getItem('dole_session') || '{}');
            return session.id || 'default';
        } catch {
            return 'default';
        }
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

    initNetworkChart() {
        const brandColor = '#1A56DB'; // Tailwind blue-700
        const brandSecondaryColor = '#0E9F6E'; // Tailwind emerald-600

        const areaOptions = {
            xaxis: {
                show: true,
                categories: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
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
                    name: "Peak Users",
                    data: [420, 580, 810, 850, 720, 930, 890],
                    color: brandColor,
                },
                {
                    name: "Active Users",
                    data: [310, 420, 680, 710, 620, 780, 750],
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
                x: { show: false },
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

