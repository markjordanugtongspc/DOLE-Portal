import ApexCharts from 'apexcharts';
import { fetchTickets } from '@/backend/api/tickets.api.js';

const getTailwindColor = (name, fallback) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--color-' + name).trim();
    return value || fallback;
};

/* START TICKET REASONS CHART CONTROLLER */
class TicketReasonsChartController {
    constructor() {
        this.chartEl = document.getElementById('bar-chart');
        this.chart = null;
        this.rows = [];
    }

    async init() {
        if (!this.chartEl) return;

        if (window.DEBUG) {
            window.DEBUG.log('CHARTS', 'Initializing Supabase-backed ticket reasons chart...');
        }

        await this.load();
        this.bindThemeUpdates();
    }

    isDarkMode() {
        return document.documentElement.classList.contains('dark');
    }

    getThemePalette() {
        const isDark = this.isDarkMode();
        return {
            labelColor: getTailwindColor(isDark ? 'gray-300' : 'gray-600', isDark ? '#d1d5db' : '#4b5563'),
            gridColor: getTailwindColor(isDark ? 'gray-700' : 'gray-200', isDark ? '#374151' : '#e5e7eb'),
            tooltipTheme: isDark ? 'dark' : 'light',
            colors: isDark
                ? ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6']
                : ['#2563eb', '#059669', '#ea580c', '#dc2626', '#7c3aed']
        };
    }

    async load() {
        this.renderLoading();
        const { data: tickets, error } = await fetchTickets();
        if (error) {
            this.renderError();
            return;
        }

        this.rows = this.buildCategoryRows(tickets);
        await this.renderChart();
    }

    buildCategoryRows(tickets) {
        const counts = new Map();
        tickets.forEach((ticket) => {
            const categoryName = ticket.ticket_categories?.name || 'Uncategorized';
            counts.set(categoryName, (counts.get(categoryName) || 0) + 1);
        });

        const total = tickets.length;
        if (!total) {
            return [{ category: 'No tickets', count: 0, percentage: 0 }];
        }

        return Array.from(counts.entries())
            .map(([category, count]) => ({
                category,
                count,
                percentage: Math.round((count / total) * 100)
            }))
            .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
            .slice(0, 5);
    }

    renderLoading() {
        this.chartEl.innerHTML = `
            <div role="status" class="h-[280px] w-full animate-pulse px-2 pb-2 pt-3" aria-label="Loading ticket reasons chart">
                <div class="relative h-full overflow-hidden border-b border-gray-100 dark:border-gray-800">
                    <div class="absolute left-2 top-0 space-y-3">
                        <div class="h-2 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                        <div class="h-2 w-7 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                        <div class="h-2 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                        <div class="h-2 w-7 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                        <div class="h-2 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                    </div>
                    <div class="absolute inset-x-12 top-4 h-px bg-gray-100 dark:bg-gray-800"></div>
                    <div class="absolute inset-x-12 top-[23%] h-px bg-gray-100 dark:bg-gray-800"></div>
                    <div class="absolute inset-x-12 top-[41%] h-px bg-gray-100 dark:bg-gray-800"></div>
                    <div class="absolute inset-x-12 top-[59%] h-px bg-gray-100 dark:bg-gray-800"></div>
                    <div class="absolute inset-x-12 top-[77%] h-px bg-gray-100 dark:bg-gray-800"></div>
                    <div class="absolute inset-x-10 bottom-0 flex h-[230px] items-end gap-4 px-3 sm:gap-6 md:gap-8">
                        <div class="flex min-w-0 flex-1 flex-col items-center gap-3">
                            <div class="h-6 w-full max-w-20 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-32 w-full max-w-14 rounded-t-lg bg-gray-200 dark:bg-gray-700"></div>
                        </div>
                        <div class="flex min-w-0 flex-1 flex-col items-center gap-3">
                            <div class="h-6 w-full max-w-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-24 w-full max-w-14 rounded-t-lg bg-gray-200 dark:bg-gray-700"></div>
                        </div>
                        <div class="flex min-w-0 flex-1 flex-col items-center gap-3">
                            <div class="h-6 w-full max-w-24 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-40 w-full max-w-14 rounded-t-lg bg-gray-200 dark:bg-gray-700"></div>
                        </div>
                        <div class="flex min-w-0 flex-1 flex-col items-center gap-3">
                            <div class="h-6 w-full max-w-14 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-28 w-full max-w-14 rounded-t-lg bg-gray-200 dark:bg-gray-700"></div>
                        </div>
                        <div class="flex min-w-0 flex-1 flex-col items-center gap-3">
                            <div class="h-6 w-full max-w-[4.5rem] rounded-full bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-36 w-full max-w-14 rounded-t-lg bg-gray-200 dark:bg-gray-700"></div>
                        </div>
                    </div>
                </div>
                <span class="sr-only">Loading ticket reasons chart...</span>
            </div>
        `;
    }

    renderError() {
        this.chartEl.innerHTML = '<div class="flex h-[280px] items-center justify-center text-sm font-semibold text-red-600 dark:text-red-400">Unable to load ticket category data.</div>';
    }

    getOptions() {
        const theme = this.getThemePalette();
        const rows = this.rows;

        return {
            series: [{
                name: 'Ticket category share',
                data: rows.map(row => row.percentage)
            }],
            colors: theme.colors,
            chart: {
                sparkline: { enabled: false },
                type: 'bar',
                width: '100%',
                height: 280,
                fontFamily: 'Inter, sans-serif',
                toolbar: { show: false }
            },
            fill: {
                type: 'solid',
                opacity: 1
            },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: '52%',
                    borderRadiusApplication: 'end',
                    borderRadius: 7,
                    distributed: true,
                    dataLabels: { position: 'top' }
                }
            },
            legend: { show: false },
            dataLabels: { enabled: false },
            tooltip: {
                theme: theme.tooltipTheme,
                shared: false,
                intersect: false,
                y: {
                    formatter: (value, context) => {
                        const row = rows[context.dataPointIndex];
                        if (!row) return `${value}%`;
                        return `${value}% (${row.count.toLocaleString()} ticket${row.count === 1 ? '' : 's'})`;
                    }
                }
            },
            xaxis: {
                position: 'top',
                categories: rows.map(row => row.category),
                labels: {
                    show: true,
                    trim: true,
                    rotate: 0,
                    style: {
                        fontFamily: 'Inter, sans-serif',
                        colors: rows.map(() => theme.labelColor),
                        fontWeight: 700
                    }
                },
                axisTicks: { show: false },
                axisBorder: { show: false }
            },
            yaxis: {
                max: 100,
                labels: {
                    show: true,
                    style: {
                        fontFamily: 'Inter, sans-serif',
                        colors: [theme.labelColor]
                    },
                    formatter: (value) => `${Math.round(value)}%`
                }
            },
            grid: {
                show: true,
                strokeDashArray: 4,
                borderColor: theme.gridColor,
                padding: {
                    left: 15,
                    right: 35,
                    top: 20,
                    bottom: 10
                }
            }
        };
    }

    async renderChart() {
        if (this.chart) {
            await this.chart.updateOptions(this.getOptions(), true, true);
            return;
        }

        this.chartEl.innerHTML = '';
        this.chart = new ApexCharts(this.chartEl, this.getOptions());
        await this.chart.render();
    }

    bindThemeUpdates() {
        if (this.chartEl.dataset.ticketReasonsThemeBound === 'true') return;
        this.chartEl.dataset.ticketReasonsThemeBound = 'true';

        const refreshTheme = () => {
            if (!this.chart) return;
            this.chart.updateOptions(this.getOptions(), false, true);
        };

        window.addEventListener('theme:changed', refreshTheme);
        window.addEventListener('theme-toggle:sync', refreshTheme);
    }
}
/* END TICKET REASONS CHART CONTROLLER */
/* START TICKETS AREA CHART CONTROLLER */
class TicketsAreaChartController {
    constructor() {
        this.chartEl = document.getElementById('labels-chart');
        this.countEl = document.getElementById('admin-tickets-period-count');
        this.sublabelEl = document.getElementById('admin-tickets-period-sublabel');
        this.percentageEl = document.getElementById('admin-tickets-percentage-badge');
        this.dropdownBtn = document.getElementById('dropdownLastDays9Button');
        this.dropdownMenu = document.getElementById('LastDays9dropdown');
        this.periodLabelEl = document.getElementById('tickets-area-period-label');

        this.chart = null;
        this.tickets = [];
        this.activePeriod = 'last-7-days';
    }

    async init() {
        if (!this.chartEl) return;

        if (window.DEBUG) {
            window.DEBUG.log('CHARTS', 'Initializing Supabase-backed Tickets Area Chart Controller...');
        }

        this.bindDropdownEvents();
        this.bindThemeUpdates();
        await this.load();
    }

    bindDropdownEvents() {
        if (!this.dropdownBtn || !this.dropdownMenu) return;

        // Toggle dropdown visibility with viewport detection
        this.dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const willShow = this.dropdownMenu.classList.contains('hidden');
            if (willShow) {
                this.positionDropdown();
            }
            this.dropdownMenu.classList.toggle('hidden');
        });

        // Reposition on window resize if open
        window.addEventListener('resize', () => {
            if (this.dropdownMenu && !this.dropdownMenu.classList.contains('hidden')) {
                this.positionDropdown();
            }
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.dropdownMenu.contains(e.target) && !this.dropdownBtn.contains(e.target)) {
                this.dropdownMenu.classList.add('hidden');
            }
        });

        // Handle period option clicks
        const optionLinks = this.dropdownMenu.querySelectorAll('a[data-period]');
        optionLinks.forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const period = link.getAttribute('data-period');
                const labelText = link.textContent.trim();

                if (this.periodLabelEl) {
                    this.periodLabelEl.textContent = labelText;
                }
                this.dropdownMenu.classList.add('hidden');

                if (period && period !== this.activePeriod) {
                    this.activePeriod = period;
                    this.updateChartData();
                }
            });
        });
    }

    positionDropdown() {
        if (!this.dropdownBtn || !this.dropdownMenu) return;

        // Reset positioning classes
        this.dropdownMenu.classList.remove('bottom-full', 'mb-2', 'top-full', 'mt-2', 'right-0', 'left-0', 'left-auto', 'right-auto');

        const isHidden = this.dropdownMenu.classList.contains('hidden');
        if (isHidden) {
            this.dropdownMenu.style.visibility = 'hidden';
            this.dropdownMenu.classList.remove('hidden');
        }

        const btnRect = this.dropdownBtn.getBoundingClientRect();
        const menuRect = this.dropdownMenu.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

        const spaceBelow = viewportHeight - btnRect.bottom;
        const spaceAbove = btnRect.top;

        // If no room below and enough room above, flip up
        if (spaceBelow < menuRect.height && spaceAbove >= menuRect.height) {
            this.dropdownMenu.classList.add('bottom-full', 'mb-2');
        } else {
            this.dropdownMenu.classList.add('top-full', 'mt-2');
        }

        // If no room on left (overflows right), align right
        const spaceRight = viewportWidth - btnRect.left;
        if (spaceRight < menuRect.width && btnRect.right >= menuRect.width) {
            this.dropdownMenu.classList.add('right-0', 'left-auto');
        } else {
            this.dropdownMenu.classList.add('left-0', 'right-auto');
        }

        if (isHidden) {
            this.dropdownMenu.classList.add('hidden');
            this.dropdownMenu.style.visibility = '';
        }
    }

    isDarkMode() {
        return document.documentElement.classList.contains('dark');
    }

    getThemePalette() {
        const isDark = this.isDarkMode();
        return {
            brandColor: getTailwindColor(isDark ? 'blue-500' : 'blue-700', isDark ? '#3b82f6' : '#1d4ed8'),
            brandSecondaryColor: getTailwindColor(isDark ? 'emerald-400' : 'emerald-600', isDark ? '#34d399' : '#059669'),
            labelColor: getTailwindColor(isDark ? 'gray-400' : 'gray-500', isDark ? '#9ca3af' : '#6b7280'),
            gridColor: getTailwindColor(isDark ? 'gray-800' : 'gray-100', isDark ? '#1f2937' : '#f3f4f6'),
            tooltipTheme: isDark ? 'dark' : 'light',
        };
    }

    async load() {
        this.renderLoadingState();
        const { data, error } = await fetchTickets();
        if (error) {
            if (window.DEBUG) window.DEBUG.error('CHARTS', 'Failed to fetch tickets for area chart', error);
            this.tickets = [];
        } else {
            this.tickets = data || [];
        }
        await this.updateChartData();
    }

    renderLoadingState() {
        if (this.countEl) {
            this.countEl.innerHTML = `<span class="inline-block h-7 w-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse align-middle"><span class="sr-only">Loading count...</span></span>`;
        }
        if (this.percentageEl) {
            this.percentageEl.innerHTML = `<span class="inline-block h-5 w-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse align-middle"><span class="sr-only">Loading percentage...</span></span>`;
        }
        if (this.chartEl && !this.chart) {
            this.chartEl.innerHTML = `
                <div role="status" class="h-[280px] w-full animate-pulse px-2 pb-2 pt-3" aria-label="Loading area chart">
                    <div class="relative h-full overflow-hidden border-b border-gray-100 dark:border-gray-800">
                        <div class="absolute left-2 top-0 space-y-3">
                            <div class="h-2 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-2 w-7 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-2 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                        </div>
                        <div class="absolute inset-x-12 top-4 h-px bg-gray-100 dark:bg-gray-800"></div>
                        <div class="absolute inset-x-12 top-[40%] h-px bg-gray-100 dark:bg-gray-800"></div>
                        <div class="absolute inset-x-12 top-[80%] h-px bg-gray-100 dark:bg-gray-800"></div>
                        <div class="absolute inset-x-10 bottom-0 flex h-[220px] items-end justify-between px-4">
                            <div class="h-32 w-12 rounded-t-lg bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-24 w-12 rounded-t-lg bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-40 w-12 rounded-t-lg bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-28 w-12 rounded-t-lg bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-36 w-12 rounded-t-lg bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-20 w-12 rounded-t-lg bg-gray-200 dark:bg-gray-700"></div>
                            <div class="h-44 w-12 rounded-t-lg bg-gray-200 dark:bg-gray-700"></div>
                        </div>
                    </div>
                    <span class="sr-only">Loading area chart...</span>
                </div>
            `;
        }
    }

    calculateTimeframeMetrics() {
        const now = new Date();
        let categories = [];
        let receivedCounts = [];
        let solvedCounts = [];
        let sublabel = 'Tickets this week';
        let currentStart, currentEnd, priorStart, priorEnd;

        if (this.activePeriod === 'yesterday') {
            sublabel = 'Tickets yesterday';
            const yStart = new Date(now);
            yStart.setDate(now.getDate() - 1);
            yStart.setHours(0, 0, 0, 0);

            const yEnd = new Date(yStart);
            yEnd.setHours(23, 59, 59, 999);

            currentStart = yStart;
            currentEnd = yEnd;

            priorStart = new Date(yStart);
            priorStart.setDate(yStart.getDate() - 1);
            priorEnd = new Date(priorStart);
            priorEnd.setHours(23, 59, 59, 999);

            // 6 intervals of 4 hours for yesterday
            categories = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
            receivedCounts = new Array(6).fill(0);
            solvedCounts = new Array(6).fill(0);

            this.tickets.forEach(ticket => {
                const created = new Date(ticket.created_at || ticket.rawCreatedAt);
                if (created >= yStart && created <= yEnd) {
                    const hour = created.getHours();
                    const idx = Math.min(Math.floor(hour / 4), 5);
                    receivedCounts[idx]++;
                    if (String(ticket.status).toLowerCase() === 'closed' || String(ticket.status).toLowerCase() === 'resolved') {
                        solvedCounts[idx]++;
                    }
                }
            });
        } else if (this.activePeriod === 'today') {
            sublabel = 'Tickets today';
            const tStart = new Date(now);
            tStart.setHours(0, 0, 0, 0);

            const tEnd = new Date(now);
            tEnd.setHours(23, 59, 59, 999);

            currentStart = tStart;
            currentEnd = tEnd;

            priorStart = new Date(tStart);
            priorStart.setDate(tStart.getDate() - 1);
            priorEnd = new Date(priorStart);
            priorEnd.setHours(23, 59, 59, 999);

            categories = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
            receivedCounts = new Array(6).fill(0);
            solvedCounts = new Array(6).fill(0);

            this.tickets.forEach(ticket => {
                const created = new Date(ticket.created_at || ticket.rawCreatedAt);
                if (created >= tStart && created <= tEnd) {
                    const hour = created.getHours();
                    const idx = Math.min(Math.floor(hour / 4), 5);
                    receivedCounts[idx]++;
                    if (String(ticket.status).toLowerCase() === 'closed' || String(ticket.status).toLowerCase() === 'resolved') {
                        solvedCounts[idx]++;
                    }
                }
            });
        } else if (this.activePeriod === 'last-30-days') {
            sublabel = 'Tickets this month';
            currentEnd = new Date(now);
            currentStart = new Date(now);
            currentStart.setDate(now.getDate() - 29);
            currentStart.setHours(0, 0, 0, 0);

            priorEnd = new Date(currentStart);
            priorEnd.setMilliseconds(-1);
            priorStart = new Date(currentStart);
            priorStart.setDate(currentStart.getDate() - 30);

            // 6 intervals of 5 days
            receivedCounts = new Array(6).fill(0);
            solvedCounts = new Array(6).fill(0);

            for (let i = 0; i < 6; i++) {
                const d = new Date(currentStart);
                d.setDate(currentStart.getDate() + (i * 5));
                categories.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
            }

            this.tickets.forEach(ticket => {
                const created = new Date(ticket.created_at || ticket.rawCreatedAt);
                if (created >= currentStart && created <= currentEnd) {
                    const diffDays = Math.floor((created - currentStart) / (1000 * 60 * 60 * 24));
                    const idx = Math.min(Math.floor(diffDays / 5), 5);
                    receivedCounts[idx]++;
                    if (String(ticket.status).toLowerCase() === 'closed' || String(ticket.status).toLowerCase() === 'resolved') {
                        solvedCounts[idx]++;
                    }
                }
            });
        } else if (this.activePeriod === 'last-90-days') {
            sublabel = 'Tickets last 90 days';
            currentEnd = new Date(now);
            currentStart = new Date(now);
            currentStart.setDate(now.getDate() - 89);
            currentStart.setHours(0, 0, 0, 0);

            priorEnd = new Date(currentStart);
            priorEnd.setMilliseconds(-1);
            priorStart = new Date(currentStart);
            priorStart.setDate(currentStart.getDate() - 90);

            // 6 intervals of 15 days
            receivedCounts = new Array(6).fill(0);
            solvedCounts = new Array(6).fill(0);

            for (let i = 0; i < 6; i++) {
                const d = new Date(currentStart);
                d.setDate(currentStart.getDate() + (i * 15));
                categories.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
            }

            this.tickets.forEach(ticket => {
                const created = new Date(ticket.created_at || ticket.rawCreatedAt);
                if (created >= currentStart && created <= currentEnd) {
                    const diffDays = Math.floor((created - currentStart) / (1000 * 60 * 60 * 24));
                    const idx = Math.min(Math.floor(diffDays / 15), 5);
                    receivedCounts[idx]++;
                    if (String(ticket.status).toLowerCase() === 'closed' || String(ticket.status).toLowerCase() === 'resolved') {
                        solvedCounts[idx]++;
                    }
                }
            });
        } else {
            // Default: 'last-7-days'
            sublabel = 'Tickets this week';
            currentEnd = new Date(now);
            currentStart = new Date(now);
            currentStart.setDate(now.getDate() - 6);
            currentStart.setHours(0, 0, 0, 0);

            priorEnd = new Date(currentStart);
            priorEnd.setMilliseconds(-1);
            priorStart = new Date(currentStart);
            priorStart.setDate(currentStart.getDate() - 7);

            receivedCounts = new Array(7).fill(0);
            solvedCounts = new Array(7).fill(0);

            for (let i = 0; i < 7; i++) {
                const d = new Date(currentStart);
                d.setDate(currentStart.getDate() + i);
                categories.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
            }

            this.tickets.forEach(ticket => {
                const created = new Date(ticket.created_at || ticket.rawCreatedAt);
                if (created >= currentStart && created <= currentEnd) {
                    const diffDays = Math.floor((created - currentStart) / (1000 * 60 * 60 * 24));
                    const idx = Math.min(Math.max(diffDays, 0), 6);
                    receivedCounts[idx]++;
                    if (String(ticket.status).toLowerCase() === 'closed' || String(ticket.status).toLowerCase() === 'resolved') {
                        solvedCounts[idx]++;
                    }
                }
            });
        }

        // Compute current and prior totals for header numbers
        let currentTotal = 0;
        let priorTotal = 0;

        this.tickets.forEach(ticket => {
            const created = new Date(ticket.created_at || ticket.rawCreatedAt);
            if (created >= currentStart && created <= currentEnd) {
                currentTotal++;
            } else if (created >= priorStart && created <= priorEnd) {
                priorTotal++;
            }
        });

        // Compute percentage change
        let percentageChange = 0;
        if (priorTotal > 0) {
            percentageChange = Math.round(((currentTotal - priorTotal) / priorTotal) * 100);
        } else if (currentTotal > 0) {
            percentageChange = 100;
        }

        return {
            sublabel,
            categories,
            receivedCounts,
            solvedCounts,
            currentTotal,
            priorTotal,
            percentageChange
        };
    }

    async updateChartData() {
        const metrics = this.calculateTimeframeMetrics();

        // 1. Update text metrics
        if (this.countEl) {
            this.countEl.textContent = metrics.currentTotal.toLocaleString();
        }
        if (this.sublabelEl) {
            this.sublabelEl.textContent = metrics.sublabel;
        }
        if (this.percentageEl) {
            const isPositive = metrics.percentageChange >= 0;
            const textClass = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
            const iconSvg = isPositive
                ? `<svg class="w-5 h-5 me-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v13m0-13 4 4m-4-4-4 4"/></svg>`
                : `<svg class="w-5 h-5 me-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18V5m0 13-4-4m4 4 4-4"/></svg>`;

            this.percentageEl.className = `flex items-center px-2.5 py-0.5 font-bold ${textClass} text-center`;
            this.percentageEl.innerHTML = `${iconSvg} ${Math.abs(metrics.percentageChange)}%`;
        }

        // 2. Render or Update ApexChart
        const theme = this.getThemePalette();
        const areaOptions = {
            xaxis: {
                show: true,
                categories: metrics.categories,
                labels: {
                    show: true,
                    style: {
                        fontFamily: "Inter, sans-serif",
                        colors: metrics.categories.map(() => theme.labelColor),
                        cssClass: 'text-xs font-normal'
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
                        colors: [theme.labelColor],
                        cssClass: 'text-xs font-normal'
                    },
                    formatter: function (value) {
                        return Math.round(value);
                    }
                }
            },
            series: [
                {
                    name: "Received tickets",
                    data: metrics.receivedCounts,
                    color: theme.brandColor,
                },
                {
                    name: "Solved tickets",
                    data: metrics.solvedCounts,
                    color: theme.brandSecondaryColor,
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
                theme: theme.tooltipTheme,
                x: { show: true },
            },
            fill: {
                type: "gradient",
                gradient: {
                    opacityFrom: 0.45,
                    opacityTo: 0.05,
                    shade: theme.brandColor,
                    gradientToColors: [theme.brandColor, theme.brandSecondaryColor],
                },
            },
            dataLabels: { enabled: false },
            stroke: { width: 3, curve: 'smooth' },
            legend: { show: false },
            grid: {
                show: true,
                strokeDashArray: 4,
                borderColor: theme.gridColor,
                padding: {
                    left: 15,
                    right: 35,
                    top: 15,
                    bottom: 10
                }
            },
        };

        if (this.chart) {
            await this.chart.updateOptions(areaOptions, true, true);
        } else {
            this.chartEl.innerHTML = '';
            this.chart = new ApexCharts(this.chartEl, areaOptions);
            await this.chart.render();
        }
    }

    bindThemeUpdates() {
        if (this.chartEl?.dataset.ticketsAreaThemeBound === 'true') return;
        if (this.chartEl) this.chartEl.dataset.ticketsAreaThemeBound = 'true';

        const refreshTheme = () => {
            if (!this.chart) return;
            this.updateChartData();
        };

        window.addEventListener('theme:changed', refreshTheme);
        window.addEventListener('theme-toggle:sync', refreshTheme);
    }
}
/* END TICKETS AREA CHART CONTROLLER */

/* START APEXCHARTS AND CUSTOM CALENDAR SYSTEM */
const initDashboardChartsAndPopovers = () => {
    // 1. Initialize ApexCharts ticket reasons bar chart
    new TicketReasonsChartController().init();

    // 2. Initialize Area Chart (Tickets Support)
    new TicketsAreaChartController().init();

    // 3. Custom datepicker and calendar popover logic
    const dropdownBtn = document.getElementById('dropdownLastDays3Button');
    const dropdownMenu = document.getElementById('LastDays3dropdown');
    const periodLabel = document.getElementById('staff-list-period-label');
    const dateStartBtn = document.getElementById('datepicker-start-btn');
    const dateEndBtn = document.getElementById('datepicker-end-btn');
    const calendarEl = document.getElementById('mini-calendar');
    const calendarDays = document.getElementById('calendar-days');

    if (dropdownBtn && dropdownMenu) {
        const periodOptions = Array.from(dropdownMenu.querySelectorAll('ul a'));

        // Toggle main dropdown
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('hidden');
        });

        periodOptions.forEach((option) => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const label = option.textContent.trim();
                if (periodLabel && label) periodLabel.textContent = label;
                dropdownMenu.classList.add('hidden');
                calendarEl?.classList.add('hidden');
                activeDatePicker = null;
            });
        });

        // Hide dropdown on click away
        document.addEventListener('click', (e) => {
            if (!dropdownMenu.contains(e.target) && !dropdownBtn.contains(e.target)) {
                dropdownMenu.classList.add('hidden');
                calendarEl?.classList.add('hidden');
                activeDatePicker = null;
            }
        });
    }

    let activeDatePicker = null; // 'start' or 'end'

    const toggleCalendar = (type) => {
        if (activeDatePicker === type) {
            calendarEl.classList.add('hidden');
            activeDatePicker = null;
        } else {
            activeDatePicker = type;
            calendarEl.classList.remove('hidden');
            renderCalendarDays();
        }
    };

    if (dateStartBtn && dateEndBtn && calendarEl) {
        dateStartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCalendar('start');
        });

        dateEndBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCalendar('end');
        });
    }

    // Render static July 2026 Calendar
    const renderCalendarDays = () => {
        if (!calendarDays) return;
        calendarDays.innerHTML = '';

        // July 2026 starts on a Wednesday (3 empty spots)
        const emptySpots = 3;
        const totalDays = 31;

        // Empty cells for alignment
        for (let i = 0; i < emptySpots; i++) {
            const cell = document.createElement('div');
            cell.className = 'py-1 text-transparent select-none';
            cell.textContent = '';
            calendarDays.appendChild(cell);
        }

        // Days cells
        for (let day = 1; day <= totalDays; day++) {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'cursor-pointer py-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded font-semibold text-gray-700 dark:text-gray-200 text-center transition-colors';
            cell.textContent = day;
            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.DEBUG) {
                    window.DEBUG.log('CALENDAR', `Selected day: ${day} for picker: ${activeDatePicker}`);
                }
                const formattedDate = `07/${day < 10 ? '0' + day : day}/2026`;
                if (periodLabel) periodLabel.textContent = 'Custom period';
                if (activeDatePicker === 'start') {
                    dateStartBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"></path></svg> ${formattedDate}`;
                } else if (activeDatePicker === 'end') {
                    dateEndBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"></path></svg> ${formattedDate}`;
                }
                calendarEl.classList.add('hidden');
                activeDatePicker = null;
            });
            calendarDays.appendChild(cell);
        }
    };
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboardChartsAndPopovers);
} else {
    initDashboardChartsAndPopovers();
}
/* END APEXCHARTS AND CUSTOM CALENDAR SYSTEM */
