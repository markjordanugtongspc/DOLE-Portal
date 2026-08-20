/**
 * DOLE Portal — About Page Loader Module
 * Injects the shared about.html component into the standalone About page.
 */

import aboutTemplate from '@/components/about.html?raw';

/* START INIT ABOUT PAGE SYSTEM */
export const initAboutPage = () => {
    /* START INJECT ABOUT COMPONENT */
    const slot = document.getElementById('about-component-slot');
    if (!slot) return;

    slot.innerHTML = aboutTemplate;
    if (window.DEBUG) {
        window.DEBUG.success('ABOUT', 'About page component rendered.');
    }
    /* END INJECT ABOUT COMPONENT */
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAboutPage);
} else {
    initAboutPage();
}
/* END INIT ABOUT PAGE SYSTEM */
