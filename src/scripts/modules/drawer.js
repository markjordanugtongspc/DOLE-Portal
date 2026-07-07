/* START AUTH DRAWER FUNCTIONALITY */
const initDrawer = () => {
    if (window.DEBUG) {
        window.DEBUG.log('DRAWER', 'Initializing manual mobile login drawer...');
    }

    const drawerEl = document.getElementById('login-drawer');
    const backdropEl = document.getElementById('drawer-backdrop');
    const heroEl = document.getElementById('mobile-hero-content');
    const drawerHeroEl = document.getElementById('mobile-drawer-hero-text');
    const showBtn = document.getElementById('show-login-drawer');
    const hideBtn = document.getElementById('hide-login-drawer');

    if (window.DEBUG) {
        window.DEBUG.log('DRAWER', 'DOM elements parsed status:', {
            drawerExists: !!drawerEl,
            backdropExists: !!backdropEl,
            heroExists: !!heroEl,
            drawerHeroExists: !!drawerHeroEl,
            showBtnExists: !!showBtn,
            hideBtnExists: !!hideBtn
        });
    }

    const showDrawer = () => {
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Action: Opening drawer...');
        if (drawerEl) {
            drawerEl.classList.remove('translate-y-full');
            drawerEl.classList.add('translate-y-0');
        }
        if (backdropEl) {
            backdropEl.classList.remove('hidden');
        }
        if (heroEl) {
            heroEl.classList.add('hidden');
        }
        if (drawerHeroEl) {
            drawerHeroEl.classList.remove('hidden');
        }
        if (window.DEBUG) window.DEBUG.success('DRAWER', 'Drawer opened.');
    };

    const hideDrawer = () => {
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Action: Closing drawer...');
        if (drawerEl) {
            drawerEl.classList.remove('translate-y-0');
            drawerEl.classList.add('translate-y-full');
        }
        if (backdropEl) {
            backdropEl.classList.add('hidden');
        }
        if (heroEl) {
            heroEl.classList.remove('hidden');
        }
        if (drawerHeroEl) {
            drawerHeroEl.classList.add('hidden');
        }
        if (window.DEBUG) window.DEBUG.success('DRAWER', 'Drawer closed.');
    };

    if (showBtn) {
        showBtn.addEventListener('click', showDrawer);
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Trigger click event bound to Get Started.');
    }
    if (hideBtn) {
        hideBtn.addEventListener('click', hideDrawer);
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Trigger click event bound to Close Button.');
    }
    if (backdropEl) {
        backdropEl.addEventListener('click', hideDrawer);
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Trigger click event bound to Backdrop.');
    }
};

// Robust readyState check to avoid DOMContentLoaded race conditions in ES modules
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDrawer);
} else {
    initDrawer();
}
/* END AUTH DRAWER FUNCTIONALITY */
