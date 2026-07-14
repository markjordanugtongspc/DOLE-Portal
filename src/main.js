/* START MODERN DEBUGGER SYSTEM */
const ENABLE_DEBUG = false; // Global Toggle: set to true to enable logging, false to disable

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
    success: (module, message) => {
        if (ENABLE_DEBUG) {
            console.log(`%c[DEBUG-SUCCESS:${module}] %c${message}`, 'color: #16a34a; font-weight: bold; font-size: 11px;', 'color: inherit;');
        }
    }
};

window.DEBUG.success('SYSTEM', 'Overall Debugger initialized and active.');
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

/* START BACKEND — Initialize Supabase Client */
// Must be imported first so all page modules can use the shared client instance
import '@/backend/api/supabase.js';
/* END BACKEND */

// Import our modules
import '@/scripts/modules/auth.js';
import '@/scripts/modules/theme-toggler.js';
import '@/scripts/modules/slider.js';
import '@/scripts/modules/drawer.js';
import '@/scripts/modules/sidebar.js';
import '@/scripts/modules/charts.js';
import '@/scripts/modules/dashboard.js';
import '@/scripts/modules/staffs-manage.js';
import '@/scripts/modules/ticket-support.js';
import '@/scripts/modules/assistants-manage.js';
