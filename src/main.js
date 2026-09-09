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
import { inject } from '@vercel/analytics';
import sidebarTemplate from '@/components/sidebar.html?raw';

/* START INIT VERCEL WEB ANALYTICS - Collects page views and visitor analytics */
const initWebAnalytics = () => {
    try {
        inject();
        if (window.DEBUG) {
            window.DEBUG.success('SYSTEM', 'Vercel Web Analytics initialized successfully');
        }
    } catch (err) {
        if (window.DEBUG) {
            window.DEBUG.error('SYSTEM', 'Failed to initialize Vercel Web Analytics', err);
        }
    }
};

initWebAnalytics();
/* END INIT VERCEL WEB ANALYTICS */

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
    // 1. Core authentication & Supabase client (always required)
    await importModule('Supabase API module', () => import('@/backend/api/supabase.js'));
    await importModule('Auth module', () => import('@/scripts/modules/auth.js'));
    await window.__PORTAL_SESSION_READY;
    if (window.__AUTH_ROUTE_BLOCKED) {
        window.DEBUG?.warn('IMPORT', 'Protected page boot halted by auth route guard.');
        return;
    }

    // 2. Global application shell components (required across all authenticated pages)
    await importModule('Settings modal module', () => import('@/scripts/modules/modals.js'));
    await importModule('Sidebar module', () => import('@/scripts/modules/sidebar.js'));
    await importModule('Theme toggler module', () => import('@/scripts/modules/theme-toggler.js'));

    const pathname = window.location.pathname;

    // 3. Conditional Route & DOM-Aware Feature Modules (load ONLY what the current page requires)

    // Landing / Slider
    if (document.getElementById('slider-container') || document.getElementById('animation-carousel')) {
        await importModule('Slider module', () => import('@/scripts/modules/slider.js'));
    }

    // Login Drawer / Systems Drawer
    if (document.getElementById('login-drawer') || document.getElementById('add-system-drawer') || document.getElementById('systems-grid')) {
        await importModule('Drawer/systems module', () => import('@/scripts/modules/drawer.js'));
    }

    // Staff Assignment Drawer (Staff and Assistant management pages)
    if (document.getElementById('assign-user-drawer') || pathname.includes('/staffs/') || pathname.includes('/assistants/')) {
        await importModule('Staff assignment drawer module', () => import('@/scripts/modules/assignment-drawer.js'));
    }

    // External systems controller (SSO launches & links)
    await importModule('External systems controller', () => import('@/scripts/modules/externals.js'));

    // Dashboard & Charts
    const isDashboard = document.getElementById('staff-systems-grid') || 
                        document.getElementById('staff-list-container') || 
                        document.getElementById('admin-total-staff-value') || 
                        document.getElementById('chart-container') || 
                        pathname.includes('/dashboard/');
    if (isDashboard) {
        await importModule('Charts module', () => import('@/scripts/modules/charts.js'));
        await importModule('Dashboard module', () => import('@/scripts/modules/dashboard.js'));
    }

    // Staff Management
    if (document.getElementById('btn-add-staff') || document.getElementById('staffs-table-body') || pathname.includes('/staffs/')) {
        await importModule('Staffs management module', () => import('@/scripts/modules/staffs-manage.js'));
    }

    // Assistants Management
    if (document.getElementById('assistants-table-body') || pathname.includes('/assistants/')) {
        await importModule('Assistants management module', () => import('@/scripts/modules/assistants-manage.js'));
    }

    // Tickets Support
    if (document.getElementById('category-drawer') || document.getElementById('tickets-table-body') || document.getElementById('chat-view-container') || pathname.includes('/tickets/')) {
        await importModule('Ticket support module', () => import('@/scripts/modules/ticket-support.js'));
    }

    // Articles (Knowledge Base)
    if (document.getElementById('articles-grid') || document.getElementById('article-view-skeleton') || pathname.includes('/articles/')) {
        await importModule('Articles browse/view module', () => import('@/scripts/modules/articles-manage.js'));
    }

    // Alerts Management
    if (document.getElementById('alerts-page') || document.getElementById('alerts-list') || pathname.includes('/alerts/')) {
        await importModule('Alerts module', () => import('@/scripts/modules/alerts.js'));
    }

    // OCR Converter Tool (ONLY on OCR converter page - paused on all other pages)
    if (document.getElementById('ocr-main-content') || pathname.includes('/ocr-converter/')) {
        await importModule('OCR Converter module', () => import('@/scripts/modules/ocr-converter.js'));
    }

    // About Page
    if (document.getElementById('about-component-slot') || pathname.includes('/about/')) {
        await importModule('About page module', () => import('@/scripts/pages/about.js'));
    }

    // DOLE Support Chatbot (Global floating assistant)
    await importModule('DOLE Support Chatbot module', () => import('@/scripts/modules/chatbot.js'));
};

bootAppModules();
/* END APP MODULE BOOTSTRAP */

/* START VERCEL STATUS PAGE SYSTEM - Live health check with sessionStorage caching */
const VERCEL_STATUS_CACHE_KEY = 'portal_vercel_status_cache';
const VERCEL_STATUS_TTL_MS = 5 * 60 * 1000; // 5 minutes

const applyVercelStatusUi = (percentageEls, descriptionEls, formattedPercentage, descText, colorClass) => {
    percentageEls.forEach((el) => {
        el.textContent = formattedPercentage;
    });
    descriptionEls.forEach((el) => {
        el.textContent = descText;
        el.classList.remove('text-emerald-400', 'text-emerald-300', 'text-emerald-200', 'text-amber-400', 'text-amber-300', 'text-amber-200', 'text-rose-400', 'text-rose-300', 'text-rose-200', 'text-green-400');
        el.classList.add(colorClass);
    });
};

const fetchVercelStatusSummary = async () => {
    const percentageEls = document.querySelectorAll('[data-vercel-status-percentage]');
    const descriptionEls = document.querySelectorAll('[data-vercel-status-description]');

    if (!percentageEls.length && !descriptionEls.length) return;

    // Check sessionStorage cache first to eliminate unnecessary network round-trips
    try {
        const cached = sessionStorage.getItem(VERCEL_STATUS_CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < VERCEL_STATUS_TTL_MS && parsed.data) {
                applyVercelStatusUi(percentageEls, descriptionEls, parsed.data.formattedPercentage, parsed.data.descText, parsed.data.colorClass);
                if (window.DEBUG) {
                    window.DEBUG.log('VERCEL_STATUS', 'Applied cached Vercel Status from sessionStorage', parsed.data);
                }
                return;
            }
        }
    } catch {
        // Cache read failed, proceed to network fetch
    }

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

        const isNormal = indicator === 'none' || String(statusObj.description || '').toLowerCase().includes('operational');
        const isMinor = indicator === 'minor';
        let descText = statusObj.description || (isNormal ? 'All Systems Normal' : 'Partial Outage');
        if (!descText.startsWith('●')) {
            descText = `● ${descText}`;
        }

        const colorClass = isNormal ? 'text-emerald-200' : (isMinor ? 'text-amber-200' : 'text-rose-200');

        applyVercelStatusUi(percentageEls, descriptionEls, formattedPercentage, descText, colorClass);

        // Store in sessionStorage for 5 minutes
        try {
            sessionStorage.setItem(VERCEL_STATUS_CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: { formattedPercentage, descText, colorClass }
            }));
        } catch {
            // Storage quota or private mode fallback
        }

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
