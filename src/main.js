/* START MODERN DEBUGGER SYSTEM */
const ENABLE_DEBUG = true; // Global Toggle: set to true to enable logging, false to disable

window.DEBUG = {
    log: (module, message, data = '') => {
        if (ENABLE_DEBUG) {
            console.log(`%c[DEBUG:${module}] %c${message}`, 'color: #1d4ed8; font-weight: bold; font-size: 11px;', 'color: inherit;', data);
        }
    },
    error: (module, message, err = '') => {
        if (ENABLE_DEBUG) {
            console.error(`%c[DEBUG-ERROR:${module}] %c${message}`, 'color: #dc2626; font-weight: bold; font-size: 11px;', 'color: inherit;', err);
        }
    },
    success: (module, message, data = '') => {
        if (ENABLE_DEBUG) {
            console.log(`%c[DEBUG-SUCCESS:${module}] %c${message}`, 'color: #16a34a; font-weight: bold; font-size: 11px;', 'color: inherit;', data);
        }
    },
    warn: (module, message, data = '') => {
        if (ENABLE_DEBUG) {
            console.warn(`%c[DEBUG-WARN:${module}] %c${message}`, 'color: #d97706; font-weight: bold; font-size: 11px;', 'color: inherit;', data);
        }
    },
    flow: (module, message, data = '') => {
        if (ENABLE_DEBUG) {
            console.log(`%c[FLOW:${module}] %c${message}`, 'color: #7c3aed; font-weight: bold; font-size: 11px;', 'color: inherit;', data);
        }
    },
    event: (module, message, data = '') => {
        if (ENABLE_DEBUG) {
            console.log(`%c[EVENT:${module}] %c${message}`, 'color: #0891b2; font-weight: bold; font-size: 11px;', 'color: inherit;', data);
        }
    }
};

window.DEBUG.success('SYSTEM', 'Overall Debugger initialized and active.');
if (ENABLE_DEBUG) {
    window.addEventListener('error', (event) => {
        window.DEBUG.error('WINDOW', event.message, { file: event.filename, line: event.lineno, column: event.colno, error: event.error });
    });

    window.addEventListener('unhandledrejection', (event) => {
        window.DEBUG.error('PROMISE', 'Unhandled promise rejection', event.reason);
    });

    document.addEventListener('click', (event) => {
        const target = event.target.closest('button, a, [data-modal-target], [data-drawer-show], [data-drawer-toggle], [data-collapse-toggle], input[type="checkbox"]');
        if (!target) return;

        window.DEBUG.event('CLICK', 'Interactive element clicked', {
            tag: target.tagName,
            id: target.id || null,
            classes: target.className || null,
            text: target.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) || null,
            dataset: { ...target.dataset },
            href: target.getAttribute('href')
        });
    }, true);
}
/* END MODERN DEBUGGER SYSTEM */

/* START AUTO COPYRIGHT YEAR SYSTEM */
const updateCopyrightYear = () => {
    const currentYear = new Date().getFullYear();
    const elements = document.querySelectorAll('.copyright-year');
    elements.forEach(el => {
        el.textContent = currentYear;
    });
    if (window.DEBUG) {
        window.DEBUG.success('SYSTEM', `Copyright years updated to: ${currentYear}`);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateCopyrightYear);
} else {
    updateCopyrightYear();
}
/* END AUTO COPYRIGHT YEAR SYSTEM */

import './style.css'
import 'flowbite';
/* START APP MODULE BOOTSTRAP - Imports page modules after the debugger exists */
const importModule = async (label, loader) => {
    window.DEBUG?.flow('IMPORT', `Loading ${label}...`);
    try {
        await loader();
        window.DEBUG?.success('IMPORT', `${label} imported.`);
    } catch (error) {
        window.DEBUG?.error('IMPORT', `${label} failed to import.`, error);
    }
};

const bootAppModules = async () => {
    await importModule('Supabase API module', () => import('@/backend/api/supabase.js'));
    await importModule('Auth module', () => import('@/scripts/modules/auth.js'));
    if (window.__AUTH_ROUTE_BLOCKED) {
        window.DEBUG?.warn('IMPORT', 'Protected page boot halted by auth route guard.');
        return;
    }
    await importModule('Theme toggler module', () => import('@/scripts/modules/theme-toggler.js'));
    await importModule('Slider module', () => import('@/scripts/modules/slider.js'));
    await importModule('Drawer/systems module', () => import('@/scripts/modules/drawer.js'));
    await importModule('Sidebar module', () => import('@/scripts/modules/sidebar.js'));
    await importModule('Charts module', () => import('@/scripts/modules/charts.js'));
    await importModule('Dashboard module', () => import('@/scripts/modules/dashboard.js'));
    await importModule('Staffs management module', () => import('@/scripts/modules/staffs-manage.js'));
    await importModule('Ticket support module', () => import('@/scripts/modules/ticket-support.js'));
    await importModule('Assistants management module', () => import('@/scripts/modules/assistants-manage.js'));
    await importModule('Articles browse/view module', () => import('@/scripts/modules/articles-manage.js'));
};

bootAppModules();
/* END APP MODULE BOOTSTRAP */
