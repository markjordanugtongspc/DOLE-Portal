import { getPreference, setPreference } from './cookies.js';

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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initThemeToggler();
        initQuickActionsSwitcher();
    });
} else {
    initThemeToggler();
    initQuickActionsSwitcher();
}

