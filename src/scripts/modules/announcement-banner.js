/**
 * DOLE Portal - Announcement Marketing CTA Banner Module
 * Renders a responsive Flowbite Marketing CTA announcement banner positioned cleanly above the Dashboard Image Banner.
 * Automatically rotates announcements in loop, pauses on hover, expandable/collapsible, and supports interactive feature highlights.
 */

/* START ANNOUNCEMENT DATA LIST - Top items are prioritized and sequenced first */
export const PORTAL_ANNOUNCEMENTS = [
    {
        id: 'announcement-ticket-ux-2026',
        text: 'Enhanced Ticket UI/UX and chat sizes for desktop and laptop view.',
        ctaText: 'View Tickets',
        ctaUrl: '/src/pages/user/staff/tickets/',
        actionType: 'tickets-highlight'
    },
    {
        id: 'announcement-profile-settings-2026',
        text: 'Updated Profile Settings to be hoverable with instant reveal and click toggle.',
        ctaText: 'Settings',
        ctaUrl: '#',
        actionType: 'settings-highlight'
    },
    {
        id: 'announcement-image-upload-2026',
        text: 'Only Image Upload is currently available on Ticket chat. File and voice coming soon.',
        ctaText: 'View Updates',
        ctaUrl: '#',
        disabled: true
    }
];
/* END ANNOUNCEMENT DATA LIST */

export const ANNOUNCEMENT_STORAGE_DISMISSED_KEY = 'dole_announcement_banner_dismissed';

let bannerLoopInterval = null;
let currentAnnouncementIndex = 0;
let isBannerPaused = false;

/* START HIGHLIGHT PROFILE SETTINGS - Pulses emerald border and auto-toggles card preview twice */
const triggerSettingsHighlight = () => {
    const userCard = document.getElementById('sidebar-user-card');
    const profileInfoBtn = document.getElementById('sidebar-user-profile-info');
    if (!userCard) return;

    // Scroll sidebar into view if on mobile/small screen or sidebar needs focus
    userCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add Emerald Pulse Glow Ring
    userCard.classList.add('ring-4', 'ring-emerald-500', 'ring-offset-2', 'dark:ring-offset-gray-950', 'animate-pulse', 'border-emerald-500');

    // Simulate double toggle demo (open -> close -> return)
    if (profileInfoBtn) {
        setTimeout(() => {
            profileInfoBtn.click(); // Open 1st time
        }, 400);

        setTimeout(() => {
            profileInfoBtn.click(); // Close 1st time
        }, 1800);

        setTimeout(() => {
            profileInfoBtn.click(); // Open 2nd time demo
        }, 2600);

        setTimeout(() => {
            profileInfoBtn.click(); // Return to default/saved state
        }, 4000);
    }

    // Clean up animation classes after 4.5 seconds
    setTimeout(() => {
        userCard.classList.remove('ring-4', 'ring-emerald-500', 'ring-offset-2', 'dark:ring-offset-gray-950', 'animate-pulse', 'border-emerald-500');
    }, 4500);
};
/* END HIGHLIGHT PROFILE SETTINGS */

/* START HIGHLIGHT TICKETS - Directs user to the appropriate tickets page and triggers target highlight */
const triggerTicketsHighlight = () => {
    const isAdminOrHr = window.location.pathname.includes('/admin/') || 
                        window.__PORTAL_SESSION?.roles?.name?.toLowerCase() === 'admin' || 
                        window.__PORTAL_SESSION?.roles?.name?.toLowerCase() === 'hr';

    const targetUrl = isAdminOrHr
        ? '/src/pages/user/admin/tickets/?highlight=chat'
        : '/src/pages/user/staff/tickets/?highlight=chat';

    const ticketNavBtn = document.querySelector('a[data-nav-id="tickets"]') || document.querySelector('a[href*="/tickets/"]');
    if (ticketNavBtn) {
        ticketNavBtn.classList.add('ring-4', 'ring-emerald-500', 'animate-pulse', 'bg-emerald-50', 'dark:bg-emerald-950/40', 'border', 'border-emerald-400');
        setTimeout(() => {
            window.location.href = targetUrl;
        }, 600);
    } else {
        window.location.href = targetUrl;
    }
};
/* END HIGHLIGHT TICKETS */

/* START RENDER MARKETING CTA BANNER - Builds inline accordion announcement banner on Dashboard above Image Banner */
export const initAnnouncementBanner = (targetContainerSelector = '#announcement-banner-slot') => {
    const targetSlot = document.querySelector(targetContainerSelector);
    if (!targetSlot) return;

    if (!PORTAL_ANNOUNCEMENTS || PORTAL_ANNOUNCEMENTS.length === 0) return;

    // Check if dismissed in localStorage
    const isDismissed = localStorage.getItem(ANNOUNCEMENT_STORAGE_DISMISSED_KEY) === 'true';

    // Clear any existing banner in slot
    targetSlot.innerHTML = '';

    const bannerWrapper = document.createElement('div');
    bannerWrapper.id = 'marketing-banner-wrapper';
    bannerWrapper.className = `w-full transition-all duration-300 ease-out overflow-hidden ${isDismissed ? 'grid grid-rows-[0fr] opacity-0 mb-0' : 'grid grid-rows-[1fr] opacity-100 mb-4'}`;

    bannerWrapper.innerHTML = `
        <div class="min-h-0 overflow-hidden">
            <div id="marketing-banner" class="w-full flex flex-col md:flex-row items-center justify-between p-3.5 sm:p-4 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl shadow-xs transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-800">
                <div class="flex items-center w-full min-w-0 mb-3 md:mb-0 md:me-4 gap-3">
                    <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs shrink-0">
                        <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 9h6m-6 3h6m-6 3h6M6.996 9h.01m-.01 3h.01m-.01 3h.01M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/>
                        </svg>
                    </span>
                    <div class="min-w-0 flex-1 overflow-hidden">
                        <p id="announcement-text" class="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 transition-opacity duration-300 truncate sm:whitespace-normal">
                            ${PORTAL_ANNOUNCEMENTS[0].text}
                        </p>
                    </div>
                </div>
                <div class="flex items-center justify-between sm:justify-end w-full md:w-auto shrink-0 gap-2 border-t md:border-t-0 border-gray-100 dark:border-gray-800 pt-2.5 md:pt-0">
                    <a id="announcement-cta" href="${PORTAL_ANNOUNCEMENTS[0].ctaUrl}" class="cursor-pointer inline-flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-900/50 shadow-xs font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all select-none">
                        ${PORTAL_ANNOUNCEMENTS[0].ctaText}
                    </a>
                    <button id="btn-dismiss-announcement" type="button" class="cursor-pointer shrink-0 inline-flex justify-center text-sm w-7 h-7 items-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus:outline-none" title="Dismiss announcement">
                        <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 17.94 6M18 18 6.06 6"/>
                        </svg>
                        <span class="sr-only">Close banner</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    targetSlot.appendChild(bannerWrapper);

    const ctaBtn = bannerWrapper.querySelector('#announcement-cta');
    const dismissBtn = bannerWrapper.querySelector('#btn-dismiss-announcement');
    const textEl = bannerWrapper.querySelector('#announcement-text');
    const bannerBox = bannerWrapper.querySelector('#marketing-banner');

    const updateBannerContent = (index) => {
        const item = PORTAL_ANNOUNCEMENTS[index];
        if (!item || !textEl || !ctaBtn) return;

        textEl.style.opacity = '0';

        setTimeout(() => {
            textEl.textContent = item.text;
            ctaBtn.textContent = item.ctaText || 'Learn More';
            ctaBtn.href = item.ctaUrl || '#';

            if (item.disabled) {
                ctaBtn.removeAttribute('href');
                ctaBtn.setAttribute('disabled', 'true');
                ctaBtn.className = 'cursor-not-allowed inline-flex items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-bold text-xs px-3.5 py-1.5 rounded-lg opacity-60 select-none pointer-events-none';
            } else {
                ctaBtn.removeAttribute('disabled');
                ctaBtn.className = 'cursor-pointer inline-flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-900/50 shadow-xs font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all select-none';
            }

            textEl.style.opacity = '1';
        }, 300);
    };

    // Sequential loop every 5.5 seconds if not dismissed
    const nextAnnouncement = () => {
        if (isBannerPaused) return;
        currentAnnouncementIndex = (currentAnnouncementIndex + 1) % PORTAL_ANNOUNCEMENTS.length;
        updateBannerContent(currentAnnouncementIndex);
    };

    const startLoop = () => {
        if (bannerLoopInterval) clearInterval(bannerLoopInterval);
        if (PORTAL_ANNOUNCEMENTS.length > 1) {
            bannerLoopInterval = setInterval(nextAnnouncement, 5500);
        }
    };

    if (!isDismissed) {
        startLoop();
    }

    // Hover pause mechanism: Pauses loop sequence when user hovers over the banner
    if (bannerBox) {
        bannerBox.addEventListener('mouseenter', () => {
            isBannerPaused = true;
        });

        bannerBox.addEventListener('mouseleave', () => {
            isBannerPaused = false;
        });
    }

    // Interactive CTA Click Handling
    if (ctaBtn) {
        ctaBtn.addEventListener('click', (e) => {
            const currentItem = PORTAL_ANNOUNCEMENTS[currentAnnouncementIndex];
            if (!currentItem || currentItem.disabled) {
                e.preventDefault();
                return;
            }

            if (currentItem.actionType === 'settings-highlight') {
                e.preventDefault();
                triggerSettingsHighlight();
            } else if (currentItem.actionType === 'tickets-highlight') {
                e.preventDefault();
                triggerTicketsHighlight(currentItem.ctaUrl);
            }
        });
    }

    // Dismiss button: Smoothly collapses accordion and saves state
    if (dismissBtn) {
        dismissBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (bannerLoopInterval) {
                clearInterval(bannerLoopInterval);
                bannerLoopInterval = null;
            }
            localStorage.setItem(ANNOUNCEMENT_STORAGE_DISMISSED_KEY, 'true');
            bannerWrapper.classList.remove('grid-rows-[1fr]', 'opacity-100', 'mb-4');
            bannerWrapper.classList.add('grid-rows-[0fr]', 'opacity-0', 'mb-0');
        });
    }
};
/* END RENDER MARKETING CTA BANNER */

/* START RESET ANNOUNCEMENT DISMISSAL - Clears dismissed state on logout or inactivity timeout */
export const resetAnnouncementDismissal = () => {
    try {
        localStorage.removeItem(ANNOUNCEMENT_STORAGE_DISMISSED_KEY);
    } catch {}
};
/* END RESET ANNOUNCEMENT DISMISSAL */
