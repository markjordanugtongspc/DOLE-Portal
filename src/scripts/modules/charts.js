import ApexCharts from 'apexcharts';
import { fetchTickets } from '@/backend/api/tickets.api.js';

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
            labelColor: isDark ? '#d1d5db' : '#4b5563',
            gridColor: isDark ? '#374151' : '#e5e7eb',
            tooltipTheme: isDark ? 'dark' : 'light',
            colors: isDark
                ? ['#60a5fa', '#34d399', '#fbbf24', '#fb7185', '#a78bfa']
                : ['#1d4ed8', '#059669', '#d97706', '#e11d48', '#7c3aed'],
            gradientToColors: isDark
                ? ['#1e40af', '#047857', '#b45309', '#be123c', '#6d28d9']
                : ['#93c5fd', '#6ee7b7', '#fde68a', '#fda4af', '#c4b5fd']
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
                type: 'gradient',
                gradient: {
                    shade: this.isDarkMode() ? 'dark' : 'light',
                    type: 'vertical',
                    shadeIntensity: 0.35,
                    inverseColors: false,
                    opacityFrom: 0.95,
                    opacityTo: 0.82,
                    stops: [0, 100],
                    gradientToColors: theme.gradientToColors
                }
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
/* START APEXCHARTS AND CUSTOM CALENDAR SYSTEM */
const initDashboardChartsAndPopovers = () => {
    // 1. Initialize ApexCharts ticket reasons bar chart
    new TicketReasonsChartController().init();

    // 2. Initialize Area Chart (Tickets Support)
    const labelsChartEl = document.getElementById("labels-chart");
    if (labelsChartEl) {
        if (window.DEBUG) {
            window.DEBUG.log('CHARTS', 'Initializing dashboard area chart...');
        }
        const brandColor = "#1A56DB"; // Tailwind blue-700
        const brandSecondaryColor = "#0E9F6E"; // Tailwind emerald-600

        const areaOptions = {
            xaxis: {
                show: true,
                categories: ['01 Feb', '02 Feb', '03 Feb', '04 Feb', '05 Feb', '06 Feb', '07 Feb'],
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
                        return value;
                    }
                }
            },
            series: [
                {
                    name: "Received tickets",
                    data: [150, 141, 145, 152, 135, 125, 160],
                    color: brandColor,
                },
                {
                    name: "Solved tickets",
                    data: [43, 13, 65, 12, 42, 73, 90],
                    color: brandSecondaryColor,
                },
            ],
            chart: {
                sparkline: { enabled: false },
                height: "100%",
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
            legend: { show: false },
            grid: {
                show: true,
                strokeDashArray: 4,
                borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb',
                padding: {
                    left: 15,
                    right: 35,
                    top: 15,
                    bottom: 10
                }
            },
        };

        const areaChart = new ApexCharts(labelsChartEl, areaOptions);
        areaChart.render();
    }

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
