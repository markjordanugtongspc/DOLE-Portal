import { getPreference, setPreference } from './cookies.js';
import ApexCharts from 'apexcharts';
import { Modal } from 'flowbite';

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

        this.defaultSystems = [
            {
                id: 'sys-1',
                name: 'GIP Monitoring System',
                desc: 'Government Internship Program monitoring portal for tracking student interns across all regional offices.',
                url: 'https://gip.dole.gov.ph',
                color: '#10b981', // Emerald
                image: '/src/assets/images/slider/sl1.jpg'
            },
            {
                id: 'sys-2',
                name: 'SPES Monitoring System',
                desc: 'Special Program for Employment of Students system for managing beneficiary records and work assignments.',
                url: 'https://spes.dole.gov.ph',
                color: '#3b82f6', // Blue
                image: '/src/assets/images/slider/sl3.jpg'
            },
            {
                id: 'sys-3',
                name: 'TUPAD System',
                desc: 'Tulong Panghanapbuhay sa Ating Displaced/Disadvantaged Workers — assistance distribution tracking system.',
                url: '#',
                color: '#ef4444', // Red
                image: '/src/assets/images/slider/sl5.jpg'
            },
            {
                id: 'sys-4',
                name: 'Livelihood Assistance System',
                desc: 'Tracks livelihood grants, project proposals, and beneficiary disbursements across all target municipalities.',
                url: '#',
                color: '#8b5cf6', // Violet
                image: '/src/assets/images/slider/sl1.jpg'
            },
            {
                id: 'sys-5',
                name: 'Career Guidance Portal',
                desc: 'Provides graduating students with career matching algorithms, vocational counseling, and guidance tools.',
                url: '#',
                color: '#ec4899', // Pink
                image: '/src/assets/images/slider/sl3.jpg'
            },
            {
                id: 'sys-6',
                name: 'Labor Inspectorate System',
                desc: 'Manages establishment inspection schedules, compliance report checklists, and enforcement alerts.',
                url: '#',
                color: '#f59e0b', // Amber
                image: '/src/assets/images/slider/sl5.jpg'
            },
            {
                id: 'sys-7',
                name: 'Single Entry Approach (SENA)',
                desc: 'Coordinates labor dispute facilitation, case scheduling, and settlement agreements dynamically.',
                url: '#',
                color: '#06b6d4', // Cyan
                image: '/src/assets/images/slider/sl1.jpg'
            },
            {
                id: 'sys-8',
                name: 'Alien Employment Permit (AEP)',
                desc: 'Processes work permit applications, foreign national credentials auditing, and visa issuance logs.',
                url: '#',
                color: '#14b8a6', // Teal
                image: '/src/assets/images/slider/sl3.jpg'
            },
            {
                id: 'sys-9',
                name: 'JobFair Portal',
                desc: 'Coordinating system for nationwide employment fairs, registration barcodes, and employer slots.',
                url: '#',
                color: '#6366f1', // Indigo
                image: '/src/assets/images/slider/sl5.jpg'
            }
        ];

        // Load systems from localStorage or set default list containing 9 systems
        this.systems = JSON.parse(localStorage.getItem('dole_systems'));
        // If it does not exist or has less than 4 systems, populate the full default set of 9 systems
        if (!this.systems || this.systems.length < 4) {
            this.systems = this.defaultSystems;
            localStorage.setItem('dole_systems', JSON.stringify(this.systems));
        }

        // Pagination limit
        this.limit = 3;
        this.searchFilter = '';

        // Initialize Flowbite Modal for Intruder Detection
        const modalEl = document.getElementById('intruder-modal');
        this.intruderModal = modalEl ? new Modal(modalEl) : null;

        this.initEvents();
        this.render();
        this.initNetworkChart();
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
            sys.name.toLowerCase().includes(this.searchFilter.toLowerCase()) || 
            sys.desc.toLowerCase().includes(this.searchFilter.toLowerCase())
        ).length;
    }

    render() {
        this.gridEl.innerHTML = '';
        
        // Filter systems based on search text
        const filteredSystems = this.systems.filter(sys => 
            sys.name.toLowerCase().includes(this.searchFilter.toLowerCase()) || 
            sys.desc.toLowerCase().includes(this.searchFilter.toLowerCase())
        );

        // Determine if we show paginated limit or show all when search is active
        const visibleSystems = (this.searchFilter.length > 0) ? filteredSystems : filteredSystems.slice(0, this.limit);

        visibleSystems.forEach(sys => {
            const card = document.createElement('div');
            const sysColor = sys.color || '#3b82f6';
            card.className = 'system-card cursor-pointer border border-transparent flex flex-col justify-between hover:scale-[1.01] hover:shadow-[0_0_15px_var(--glow-color)] transition-all duration-300 relative group min-h-[320px] rounded-base overflow-hidden text-white';
            card.style.setProperty('--sys-color', sysColor);
            card.setAttribute('data-url', sys.url);
            card.setAttribute('data-id', sys.id);

            const clickCount = localStorage.getItem('sys_clicks_' + sys.id) || 0;
            
            card.innerHTML = `
                <div class="relative z-10 flex flex-col h-full justify-between">
                    <!-- System Preview Image Full Width at Top -->
                    <div class="w-full overflow-hidden">
                        <img class="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100" src="${sys.image || '/src/assets/logos/dole_logo.png'}" alt="${sys.name}" />
                    </div>
                    
                    <div class="p-6 flex-1 flex flex-col justify-between">
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <h3 class="text-lg font-bold text-white transition-colors">${sys.name}</h3>
                                <span class="text-[10px] bg-white/20 px-2 py-0.5 rounded font-extrabold uppercase select-none flex items-center gap-1">
                                    <svg class="w-3.5 h-3.5 text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 15l-6 6m0 0l-6-6m6 6V9a6 6 0 0112 0v3"/>
                                    </svg>
                                    Clicks: <span class="click-display">${clickCount}</span>
                                </span>
                            </div>
                            <p class="text-xs font-semibold text-white/70">${sys.desc}</p>
                        </div>
                    </div>
                </div>
            `;
            this.gridEl.appendChild(card);
        });

        // Add Click listener to cards
        this.gridEl.querySelectorAll('.system-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-id');
                const url = card.getAttribute('data-url');
                
                // Track click
                let clickCount = parseInt(localStorage.getItem('sys_clicks_' + id) || '0', 10);
                clickCount++;
                localStorage.setItem('sys_clicks_' + id, clickCount);

                // Update card UI click display instantly
                const clickDisplay = card.querySelector('.click-display');
                if (clickDisplay) {
                    clickDisplay.textContent = clickCount;
                }

                // Redirect
                if (url && url !== '#' && url.trim() !== '') {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            });
        });

        // Update Show More Button State
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
        const chartEl = document.getElementById('staff-network-chart');
        if (!chartEl) return;

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
                        return value + ' Gbps';
                    }
                }
            },
            series: [
                {
                    name: "Incoming Traffic",
                    data: [2.5, 3.1, 2.8, 3.5, 3.8, 3.2, 4.0],
                    color: brandColor,
                },
                {
                    name: "Outgoing Traffic",
                    data: [1.2, 1.8, 1.5, 2.1, 2.4, 2.0, 2.6],
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

        const areaChart = new ApexCharts(chartEl, areaOptions);
        areaChart.render();
    }
}
/* END STAFF-EXCLUSIVE DASHBOARD CONTROLLER */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initThemeToggler();
        initQuickActionsSwitcher();
        new StaffDashboardController();
    });
} else {
    initThemeToggler();
    initQuickActionsSwitcher();
    new StaffDashboardController();
}

