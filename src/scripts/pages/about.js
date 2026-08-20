/**
 * DOLE Portal — About Page Loader Module
 * Injects the shared about.html component into the standalone About page
 * and binds touch/tap toggle functionality for mobile screens.
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

    /* START BIND MOBILE CARD PHOTO FOCUS TOGGLE */
    const cards = slot.querySelectorAll('[data-about-card="true"]');
    cards.forEach((card) => {
        card.addEventListener('click', (e) => {
            // Allow default link behavior when clicking social icons or interactive buttons
            if (e.target.closest('a') || e.target.closest('button')) return;

            const isFocused = card.classList.contains('is-photo-focused');
            if (isFocused) {
                card.classList.remove('is-photo-focused');
            } else {
                // Focus this card and collapse others
                cards.forEach((c) => c.classList.remove('is-photo-focused'));
                card.classList.add('is-photo-focused');
            }
        });
    });
    /* END BIND MOBILE CARD PHOTO FOCUS TOGGLE */
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAboutPage);
} else {
    initAboutPage();
}
/* END INIT ABOUT PAGE SYSTEM */
