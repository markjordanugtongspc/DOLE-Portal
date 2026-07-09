import ApexCharts from 'apexcharts';

/* START APEXCHARTS AND CUSTOM CALENDAR SYSTEM */
const initDashboardChartsAndPopovers = () => {
    // 1. Initialize ApexCharts horizontal bar chart
    const chartEl = document.getElementById('bar-chart');
    if (chartEl) {
        if (window.DEBUG) {
            window.DEBUG.log('CHARTS', 'Initializing dashboard bar chart...');
        }

        const options = {
            series: [{
                name: "Tickets",
                data: [41, 22, 15, 12, 10]
            }],
            colors: ['#1A56DB', '#0E9F6E', '#FF8A4C', '#E74694', '#9061F9'],
            chart: {
                sparkline: {
                    enabled: false,
                },
                type: "bar",
                width: "100%",
                height: 280,
                toolbar: {
                    show: false,
                }
            },
            fill: {
                type: "gradient",
                gradient: {
                    shade: "dark",
                    type: "vertical",
                    shadeIntensity: 0.5,
                    inverseColors: false,
                    opacityFrom: 1,
                    opacityTo: 1,
                    stops: [0, 100],
                    gradientToColors: ['#0f172a', '#0f172a', '#0f172a', '#0f172a', '#0f172a']
                }
            },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: "50%",
                    borderRadiusApplication: "end",
                    borderRadius: 6,
                    distributed: true,
                    dataLabels: {
                        position: "top",
                    },
                },
            },
            legend: {
                show: false,
            },
            dataLabels: {
                enabled: false,
            },
            tooltip: {
                shared: false,
                intersect: false,
                y: {
                    formatter: function (value) {
                        return value + "%";
                    }
                }
            },
            xaxis: {
                position: 'top',
                labels: {
                    show: true,
                    style: {
                        fontFamily: "Inter, sans-serif",
                        colors: '#6b7280'
                    }
                },
                categories: ["Product", "Tech", "Payment", "Issue", "New Acc"],
                axisTicks: {
                    show: false,
                },
                axisBorder: {
                    show: false,
                },
            },
            yaxis: {
                labels: {
                    show: true,
                    style: {
                        fontFamily: "Inter, sans-serif",
                        colors: '#6b7280'
                    },
                    formatter: function(value) {
                        return value + "%";
                    }
                }
            },
            grid: {
                show: true,
                strokeDashArray: 4,
                borderColor: '#e5e7eb',
                padding: {
                    left: 10,
                    right: 10,
                    top: 20
                },
            }
        };

        const chart = new ApexCharts(chartEl, options);
        chart.render();
    }

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
            grid: { show: false },
        };

        const areaChart = new ApexCharts(labelsChartEl, areaOptions);
        areaChart.render();
    }

    // 3. Custom datepicker and calendar popover logic
    const dropdownBtn = document.getElementById('dropdownLastDays3Button');
    const dropdownMenu = document.getElementById('LastDays3dropdown');
    const dateStartBtn = document.getElementById('datepicker-start-btn');
    const dateEndBtn = document.getElementById('datepicker-end-btn');
    const calendarEl = document.getElementById('mini-calendar');
    const calendarDays = document.getElementById('calendar-days');

    if (dropdownBtn && dropdownMenu) {
        // Toggle main dropdown
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('hidden');
        });

        // Hide dropdown on click away
        document.addEventListener('click', (e) => {
            if (!dropdownMenu.contains(e.target) && e.target !== dropdownBtn) {
                dropdownMenu.classList.add('hidden');
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
