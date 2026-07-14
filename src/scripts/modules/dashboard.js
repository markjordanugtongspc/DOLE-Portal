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

        this.systems = data.map(system => {
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
        this.render();
    }

    renderLoading() {
        this.gridEl.innerHTML = Array.from({ length: 3 }).map(() => `
            <div role="status" class="min-h-[320px] rounded-none overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 animate-pulse">
                <div class="h-40 bg-gray-200 dark:bg-gray-700"></div>
                <div class="p-6">
                    <div class="h-5 w-2/3 rounded-full bg-gray-200 dark:bg-gray-700 mb-4"></div>
                    <div class="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700 mb-2"></div>
                    <div class="h-3 w-4/5 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                </div>
                <span class="sr-only">Loading systems...</span>
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
        card.className = 'system-card cursor-pointer border border-transparent flex flex-col justify-between hover:scale-[1.01] hover:shadow-[0_0_15px_var(--glow-color)] transition-all duration-300 relative group min-h-[320px] rounded-none overflow-hidden text-white';
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
                            <span class="shrink-0 whitespace-nowrap text-[10px] bg-white/20 px-2 py-0.5 font-extrabold uppercase">ID #${this.escapeHtml(sys.id)}</span>
                        </div>
                        <p class="text-xs font-semibold text-white/70">${this.escapeHtml(sys.description)}</p>
                        <p class="mt-4 break-words text-[10px] font-semibold text-white/50">${this.escapeHtml(sys.systemUrl || 'No link')}</p>
                    </div>
                </div>
            </div>
        `;
        return card;
    }

    bindCardClick(card) {
        card.addEventListener('click', () => {
            const url = card.getAttribute('data-url');
            
            // Redirect

            if (url && url.trim() !== '') {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        });
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
            this.bindCardClick(card);
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
                    this.bindCardClick(card);

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
        const btnShowMore = document.getElementById('btn-show-more');
        const btnShowMoreText = document.getElementById('btn-show-more-text');
        
        if (btnShowMore && btnShowMoreText) {
            const totalFiltered = filteredSystems.length;
            if (totalFiltered <= 3 || this.searchFilter.length > 0) {
                btnShowMore.classList.add('hidden');
            } else {
                btnShowMore.classList.remove('hidden');
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
        this.statsCarousel = new DashboardCarousel(carouselEl, items, options);

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
        this.systemsCarousel = new DashboardCarousel(carouselEl, items, options);

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

        this.chartsCarousel = new DashboardCarousel(carouselEl, items, options);

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

