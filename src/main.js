/* START MODERN DEBUGGER SYSTEM - Activated for Authenticated Admin Users and Admin Views */
const isAdminUser = () => {
    try {
        const session = window.__PORTAL_SESSION || JSON.parse(localStorage.getItem('portal_user_session') || sessionStorage.getItem('portal_user_session') || '{}');
        const roleId = Number(session?.role_id);
        const isAdminRole = roleId === 1;
        const isAdminPath = /\/src\/pages\/user\/admin\//.test(window.location.pathname);
        const isDebugForced = localStorage.getItem('force_debug') === 'true';
        return isAdminRole || isAdminPath || isDebugForced;
    } catch {
        return false;
    }
};

const isDebugActive = () => isAdminUser();

window.DEBUG = {
    isEnabled: () => isDebugActive(),
    log: (module, message, data = '') => {
        if (isDebugActive()) {
            console.log(`%c[DEBUG:${module}] %c${message}`, 'color: #1d4ed8; font-weight: bold; font-size: 11px;', 'color: inherit;', data);
        }
    },
    error: (module, message, err = '') => {
        if (isDebugActive()) {
            console.error(`%c[DEBUG-ERROR:${module}] %c${message}`, 'color: #dc2626; font-weight: bold; font-size: 11px;', 'color: inherit;', err);
        }
    },
    success: (module, message, data = '') => {
        if (isDebugActive()) {
            console.log(`%c[DEBUG-SUCCESS:${module}] %c${message}`, 'color: #16a34a; font-weight: bold; font-size: 11px;', 'color: inherit;', data);
        }
    },
    warn: (module, message, data = '') => {
        if (isDebugActive()) {
            console.warn(`%c[DEBUG-WARN:${module}] %c${message}`, 'color: #d97706; font-weight: bold; font-size: 11px;', 'color: inherit;', data);
        }
    },
    flow: (module, message, data = '') => {
        if (isDebugActive()) {
            console.log(`%c[FLOW:${module}] %c${message}`, 'color: #7c3aed; font-weight: bold; font-size: 11px;', 'color: inherit;', data);
        }
    },
    event: (module, message, data = '') => {
        if (isDebugActive()) {
            console.log(`%c[EVENT:${module}] %c${message}`, 'color: #0891b2; font-weight: bold; font-size: 11px;', 'color: inherit;', data);
        }
    }
};

window.addEventListener('error', (event) => {
    if (isDebugActive()) {
        window.DEBUG.error('WINDOW', event.message, { file: event.filename, line: event.lineno, column: event.colno, error: event.error });
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (isDebugActive()) {
        window.DEBUG.error('PROMISE', 'Unhandled promise rejection', event.reason);
    }
});

document.addEventListener('click', (event) => {
    if (!isDebugActive()) return;
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
import sidebarTemplate from '@/components/sidebar.html?raw';

/* Render the shared sidebar shell before the async module queue starts. The
 * role-specific links are intentionally still skeletons until sidebar.js has
 * the authenticated user and can safely select the correct navigation. */
const renderSidebarShell = () => {
    const sidebarEl = document.getElementById('sidebar');
    if (!sidebarEl || sidebarEl.dataset.shellRendered) return;

    sidebarEl.innerHTML = sidebarTemplate;
    sidebarEl.dataset.shellRendered = 'true';
};

renderSidebarShell();
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
    await window.__PORTAL_SESSION_READY;
    if (window.__AUTH_ROUTE_BLOCKED) {
        window.DEBUG?.warn('IMPORT', 'Protected page boot halted by auth route guard.');
        return;
    }
    await importModule('Settings modal module', () => import('@/scripts/modules/modals.js'));
    await importModule('Sidebar module', () => import('@/scripts/modules/sidebar.js'));
    await importModule('Theme toggler module', () => import('@/scripts/modules/theme-toggler.js'));
    await importModule('Slider module', () => import('@/scripts/modules/slider.js'));
    await importModule('Drawer/systems module', () => import('@/scripts/modules/drawer.js'));
    await importModule('Staff assignment drawer module', () => import('@/scripts/modules/assignment-drawer.js'));
    await importModule('External systems controller', () => import('@/scripts/modules/externals.js'));
    await importModule('Charts module', () => import('@/scripts/modules/charts.js'));
    await importModule('Dashboard module', () => import('@/scripts/modules/dashboard.js'));
    await importModule('Staffs management module', () => import('@/scripts/modules/staffs-manage.js'));
    await importModule('Ticket support module', () => import('@/scripts/modules/ticket-support.js'));
    await importModule('Assistants management module', () => import('@/scripts/modules/assistants-manage.js'));
    await importModule('Articles browse/view module', () => import('@/scripts/modules/articles-manage.js'));
    await importModule('Alerts module', () => import('@/scripts/modules/alerts.js'));
    await importModule('OCR Converter module', () => import('@/scripts/modules/ocr-converter.js'));
    await importModule('About page module', () => import('@/scripts/pages/about.js'));
    await importModule('DOLE Support Chatbot module', () => import('@/scripts/modules/chatbot.js'));
};

bootAppModules();
/* END APP MODULE BOOTSTRAP */

/* START VERCEL STATUS PAGE SYSTEM */
const fetchVercelStatusSummary = async () => {
    const percentageEls = document.querySelectorAll('[data-vercel-status-percentage]');
    const descriptionEls = document.querySelectorAll('[data-vercel-status-description]');

    if (!percentageEls.length && !descriptionEls.length) return;

    try {
        const response = await fetch('https://www.vercel-status.com/api/v2/summary.json');
        if (!response.ok) throw new Error(`Vercel status API HTTP ${response.status}`);
        const data = await response.json();

        const components = data.components || [];
        const statusObj = data.status || {};
        const indicator = statusObj.indicator || 'none';

        let calculatedPercentage = 99.99;
        if (components.length > 0) {
            let totalScore = 0;
            components.forEach((c) => {
                const st = String(c.status || '').toLowerCase();
                if (st === 'operational') totalScore += 1;
                else if (st === 'degraded_performance') totalScore += 0.9;
                else if (st === 'partial_outage') totalScore += 0.75;
                else if (st === 'major_outage' || st === 'under_maintenance') totalScore += 0.5;
                else totalScore += 1;
            });
            const ratio = (totalScore / components.length) * 100;
            calculatedPercentage = Math.min(99.99, Math.round(ratio * 100) / 100);
            if (ratio === 100) calculatedPercentage = 99.99;
        } else if (indicator === 'minor') {
            calculatedPercentage = 98.50;
        } else if (indicator === 'major') {
            calculatedPercentage = 92.00;
        } else if (indicator === 'critical') {
            calculatedPercentage = 85.00;
        }

        const formattedPercentage = `${calculatedPercentage.toFixed(2)}%`;
        percentageEls.forEach((el) => {
            el.textContent = formattedPercentage;
        });

        const isNormal = indicator === 'none' || String(statusObj.description || '').toLowerCase().includes('operational');
        const isMinor = indicator === 'minor';
        let descText = statusObj.description || (isNormal ? 'All Systems Normal' : 'Partial Outage');
        if (!descText.startsWith('●')) {
            descText = `● ${descText}`;
        }

        descriptionEls.forEach((el) => {
            el.textContent = descText;
            el.classList.remove('text-emerald-400', 'text-amber-400', 'text-rose-400', 'text-green-400');
            if (isNormal) {
                el.classList.add('text-emerald-400');
            } else if (isMinor) {
                el.classList.add('text-amber-400');
            } else {
                el.classList.add('text-rose-400');
            }
        });

        if (window.DEBUG) {
            window.DEBUG.success('VERCEL_STATUS', `Fetched Vercel Status: ${formattedPercentage} (${descText})`);
        }
    } catch (err) {
        if (window.DEBUG) {
            window.DEBUG.error('VERCEL_STATUS', 'Failed to fetch live Vercel status page API', err);
        }
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchVercelStatusSummary);
} else {
    fetchVercelStatusSummary();
}
/* END VERCEL STATUS PAGE SYSTEM */
