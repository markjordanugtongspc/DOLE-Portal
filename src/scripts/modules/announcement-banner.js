/**
 * DOLE Portal - Announcement Marketing CTA Banner Module
 * Renders a responsive Flowbite Marketing CTA announcement banner positioned cleanly above the Dashboard Image Banner.
 * Automatically rotates announcements in loop, pauses on hover, expandable/collapsible, and supports interactive feature highlights.
 */

import { Modal } from 'flowbite';

/* START ANNOUNCEMENT DATA LIST - Top items are prioritized and sequenced first */
export const PORTAL_ANNOUNCEMENTS = [
    {
        id: 'announcement-spes-monitoring-2026',
        text: 'SPES Monitoring Update: Fixed multiple bugs, improved lists of Implementors Date records, and fixed Payroll bugs.',
        ctaText: '',
        ctaUrl: '',
        noCta: true
    },
    {
        id: 'announcement-draggable-chatbot-2026',
        text: 'The DOLE Chatbot is now draggable anywhere on mobile with automatic magnetic edge snapping. Tap and place it wherever convenient!',
        ctaText: 'Try Chatbot',
        ctaUrl: '#',
        actionType: 'open-chatbot'
    },
    {
        id: 'announcement-forgot-password-sms-2026',
        text: 'You can now reset your password via SMS OTP if you forgot it. Ensure your mobile number is updated in Profile Settings!',
        ctaText: 'Try It Out',
        ctaUrl: '#',
        actionType: 'forgot-password-guide'
    },
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
let forgotTourModalInstance = null;

/* START REMOVE DRAWER BACKDROP - Cleans up any full-screen dark drawer overlay to keep page and highlights fully visible */
export const removeDrawerBackdrop = () => {
    document.querySelectorAll('[drawer-backdrop], div[drawer-backdrop]').forEach((el) => {
        el.remove();
    });
};
/* END REMOVE DRAWER BACKDROP */

/* START ENSURE MOBILE SIDEBAR OPEN - Opens Flowbite sidebar drawer on mobile/tablet so tour and highlight elements are visible */
export const ensureMobileSidebarOpen = () => {
    const isMobileOrTablet = window.innerWidth < 1024 || window.matchMedia('(max-width: 1023px)').matches;
    const sidebarEl = document.getElementById('default-sidebar');
    if (!sidebarEl) return false;

    // Check if sidebar is currently closed / hidden off-screen on mobile
    const isSidebarClosed = sidebarEl.classList.contains('-translate-x-full') || 
                            sidebarEl.classList.contains('translate-x-full');

    if (isMobileOrTablet && isSidebarClosed) {
        const toggleBtn = document.querySelector('[data-drawer-toggle="default-sidebar"]') ||
                          document.querySelector('[data-drawer-target="default-sidebar"]');
        if (toggleBtn) {
            toggleBtn.click();
            setTimeout(removeDrawerBackdrop, 50);
            setTimeout(removeDrawerBackdrop, 350);
            return true;
        }
    }
    removeDrawerBackdrop();
    return false;
};
/* END ENSURE MOBILE SIDEBAR OPEN */

/* START TOUR SPOTLIGHT & STEP TOOLTIP OVERLAY SYSTEM */
export const showTourOverlay = (onDismiss) => {
    let overlay = document.getElementById('portal-tour-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'portal-tour-overlay';
        overlay.className = 'fixed inset-0 z-[90] bg-black/25 transition-opacity duration-300 pointer-events-auto cursor-pointer animate-fade-in';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', () => {
            endPortalTour();
            if (typeof onDismiss === 'function') onDismiss();
        });
    }
    return overlay;
};

export const hideTourOverlay = () => {
    const overlay = document.getElementById('portal-tour-overlay');
    if (overlay) {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 200);
    }
};

export const showTourStepTooltip = (targetEl, { step, totalSteps, title, description, badgeColor = 'blue' }) => {
    hideTourStepTooltip();
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.id = 'portal-tour-step-tooltip';
    tooltip.className = 'fixed z-[110] transition-all duration-300 pointer-events-auto bg-gray-900/95 dark:bg-gray-800/95 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-blue-500/40 backdrop-blur-md max-w-[280px] sm:max-w-xs animate-fade-in';

    const colorBadgeClasses = badgeColor === 'red'
        ? 'bg-red-600/30 text-red-300 border-red-400/30'
        : (badgeColor === 'emerald' ? 'bg-emerald-600/30 text-emerald-300 border-emerald-400/30' : 'bg-blue-600/30 text-blue-300 border-blue-400/30');

    const dotColor = badgeColor === 'red' ? 'bg-red-400' : (badgeColor === 'emerald' ? 'bg-emerald-400' : 'bg-blue-400');

    tooltip.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${colorBadgeClasses} border shadow-xs">
                <span class="w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse"></span>
                STEP ${step} OF ${totalSteps}
            </span>
            <button type="button" data-dismiss-tour-tooltip class="text-gray-400 hover:text-white text-xs p-1 rounded-md cursor-pointer transition-colors" title="Close Tour">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        <h4 class="text-xs sm:text-sm font-extrabold text-white mb-1 leading-snug">${title}</h4>
        <p class="text-[11px] sm:text-xs text-gray-300 leading-relaxed">${description}</p>
    `;

    document.body.appendChild(tooltip);

    tooltip.querySelector('[data-dismiss-tour-tooltip]')?.addEventListener('click', () => {
        endPortalTour();
    });

    // Position tooltip smartly relative to targetEl
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = rect.bottom + 12;
    let left = rect.left;

    // If placed on sidebar or left side
    if (rect.left < viewportWidth / 2) {
        left = Math.min(rect.right + 16, viewportWidth - tooltipRect.width - 16);
        top = Math.max(16, Math.min(rect.top, viewportHeight - tooltipRect.height - 16));
    } else {
        left = Math.max(16, rect.left - tooltipRect.width - 16);
        top = Math.max(16, Math.min(rect.top, viewportHeight - tooltipRect.height - 16));
    }

    // Fallback if overflowing bottom
    if (top + tooltipRect.height > viewportHeight - 16) {
        top = Math.max(16, rect.top - tooltipRect.height - 12);
    }

    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.style.left = `${Math.round(left)}px`;
};

export const hideTourStepTooltip = () => {
    const tooltip = document.getElementById('portal-tour-step-tooltip');
    if (tooltip) tooltip.remove();
};

export const endPortalTour = () => {
    hideTourOverlay();
    hideTourStepTooltip();
    updateTourUrlParam(null);
    document.querySelectorAll('.portal-tour-highlighted').forEach(el => {
        el.classList.remove(
            'portal-tour-highlighted',
            'relative', 'z-[95]',
            'ring-4', 'ring-blue-500', 'ring-emerald-500', 'ring-red-500', 'ring-red-400',
            'ring-offset-2', 'dark:ring-offset-gray-950', 'dark:ring-offset-gray-900',
            'animate-pulse', 'border-blue-500', 'border-emerald-500', 'border-red-500',
            'bg-blue-50', 'dark:bg-blue-950/50', 'bg-emerald-50', 'dark:bg-emerald-950/40'
        );
    });
};
window.__dismissPortalTour = endPortalTour;
/* END TOUR SPOTLIGHT & STEP TOOLTIP OVERLAY SYSTEM */

/* START FORGOT PASSWORD INTERACTIVE TOUR SYSTEM */
const updateTourUrlParam = (step) => {
    const url = new URL(window.location.href);
    if (step) {
        url.searchParams.set('tour', step);
    } else {
        url.searchParams.delete('tour');
    }
    window.history.replaceState({}, '', url.toString());
};

export const startProfilePhoneTour = () => {
    const wasClosed = ensureMobileSidebarOpen();
    const delay = wasClosed ? 350 : 0;
    removeDrawerBackdrop();

    setTimeout(() => {
        removeDrawerBackdrop();
        const userCard = document.getElementById('sidebar-user-card');
        const profileInfoBtn = document.getElementById('sidebar-user-profile-info');
        const settingsBtn = document.getElementById('sidebar-profile-settings-btn');
        if (!userCard) return;

        // --- STEP 1: Blur & Tooltip (Reading Phase) ---
        showTourOverlay();
        updateTourUrlParam('profile-dropdown');
        userCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        userCard.classList.add('portal-tour-highlighted', 'relative', 'z-[95]', 'ring-4', 'ring-blue-500', 'ring-offset-2', 'dark:ring-offset-gray-950', 'animate-pulse', 'border-blue-500');

        showTourStepTooltip(userCard, {
            step: 1,
            totalSteps: 4,
            title: 'Open Profile Menu',
            description: 'Click on your user profile card in the sidebar to reveal account options.',
            badgeColor: 'blue'
        });

        // After reading time: Return to default, then perform action
        setTimeout(() => {
            hideTourStepTooltip();
            hideTourOverlay();
            userCard.classList.remove('portal-tour-highlighted', 'relative', 'z-[95]', 'ring-4', 'ring-blue-500', 'ring-offset-2', 'dark:ring-offset-gray-950', 'animate-pulse', 'border-blue-500');
            
            const container = document.getElementById('sidebar-user-actions-container');
            const isClosed = container?.classList.contains('grid-rows-[0fr]');
            if (isClosed && profileInfoBtn) {
                profileInfoBtn.click();
            }

            // --- STEP 2: Blur & Tooltip (Reading Phase) ---
            setTimeout(() => {
                showTourOverlay();
                updateTourUrlParam('profile-settings');
                if (settingsBtn) {
                    settingsBtn.classList.add('portal-tour-highlighted', 'relative', 'z-[95]', 'ring-4', 'ring-blue-500', 'animate-pulse', 'bg-blue-50', 'dark:bg-blue-950/50', 'border-blue-400');
                    showTourStepTooltip(settingsBtn, {
                        step: 2,
                        totalSteps: 4,
                        title: 'Click Profile Settings',
                        description: 'Select Profile Settings to edit your contact and security details.',
                        badgeColor: 'blue'
                    });
                }

                // After reading time: Return to default, then open modal
                setTimeout(() => {
                    hideTourStepTooltip();
                    hideTourOverlay();
                    if (settingsBtn) {
                        settingsBtn.classList.remove('portal-tour-highlighted', 'relative', 'z-[95]', 'ring-4', 'ring-blue-500', 'animate-pulse', 'bg-blue-50', 'dark:bg-blue-950/50', 'border-blue-400');
                        settingsBtn.click();
                    }

                    // --- STEP 3: Inside Modal - Input Highlight & Tooltip (No overlay/blur to keep form crystal clear) ---
                    setTimeout(() => {
                        updateTourUrlParam('phone-number-field');
                        const phoneInput = document.getElementById('phone') || document.getElementById('settings-phone');
                        const saveBtn = document.getElementById('settings-save-button');

                        if (phoneInput) {
                            phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            phoneInput.focus();
                            phoneInput.classList.add('portal-tour-highlighted', 'relative', 'z-[105]', 'ring-4', 'ring-blue-500', 'animate-pulse', 'border-blue-500', 'bg-blue-50/50', 'dark:bg-blue-950/30');

                            showTourStepTooltip(phoneInput, {
                                step: 3,
                                totalSteps: 4,
                                title: 'Register Philippine Mobile Number',
                                description: 'Ensure your active 11-digit mobile number is entered to receive SMS OTP reset codes.',
                                badgeColor: 'blue'
                            });
                        }

                        // After reading time: Return to default, transition to save button
                        setTimeout(() => {
                            hideTourStepTooltip();
                            if (phoneInput) {
                                phoneInput.classList.remove('portal-tour-highlighted', 'relative', 'z-[105]', 'ring-4', 'ring-blue-500', 'animate-pulse', 'border-blue-500', 'bg-blue-50/50', 'dark:bg-blue-950/30');
                            }

                            // --- STEP 4: Save Settings - Button Highlight & Tooltip ---
                            setTimeout(() => {
                                updateTourUrlParam('save-settings');
                                sessionStorage.setItem('dole_forgot_pwd_tour_step', 'awaiting_profile_save');

                                if (saveBtn) {
                                    saveBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    saveBtn.classList.add('portal-tour-highlighted', 'relative', 'z-[105]', 'ring-4', 'ring-emerald-500', 'ring-offset-2', 'dark:ring-offset-gray-900', 'animate-pulse');

                                    showTourStepTooltip(saveBtn, {
                                        step: 4,
                                        totalSteps: 4,
                                        title: 'Save Profile Changes',
                                        description: 'Click Save Settings to link your mobile number for SMS password recovery.',
                                        badgeColor: 'emerald'
                                    });
                                }

                                setTimeout(() => {
                                    endPortalTour();
                                }, 3200);
                            }, 400);
                        }, 3000);
                    }, 600);
                }, 2800);
            }, 500);
        }, 2800);
    }, delay);
};

export const startLogoutTour = () => {
    sessionStorage.setItem('dole_forgot_pwd_tour', 'active');
    const wasClosed = ensureMobileSidebarOpen();
    const delay = wasClosed ? 350 : 0;
    removeDrawerBackdrop();

    setTimeout(() => {
        removeDrawerBackdrop();
        const userCard = document.getElementById('sidebar-user-card');
        const profileInfoBtn = document.getElementById('sidebar-user-profile-info');
        const logoutBtn = document.getElementById('sidebar-profile-logout-btn');
        if (!userCard) return;

        // --- STEP 1: Blur & Tooltip (Reading Phase) ---
        showTourOverlay();
        updateTourUrlParam('logout-dropdown');
        userCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        userCard.classList.add('portal-tour-highlighted', 'relative', 'z-[95]', 'ring-4', 'ring-red-500', 'ring-offset-2', 'dark:ring-offset-gray-950', 'animate-pulse', 'border-red-500');

        showTourStepTooltip(userCard, {
            step: 1,
            totalSteps: 3,
            title: 'Profile Menu',
            description: 'Open your profile menu to sign out and test password recovery.',
            badgeColor: 'red'
        });

        // After reading: Return to default, expand accordion
        setTimeout(() => {
            hideTourStepTooltip();
            hideTourOverlay();
            userCard.classList.remove('portal-tour-highlighted', 'relative', 'z-[95]', 'ring-4', 'ring-red-500', 'ring-offset-2', 'dark:ring-offset-gray-950', 'animate-pulse', 'border-red-500');

            const container = document.getElementById('sidebar-user-actions-container');
            const isClosed = container?.classList.contains('grid-rows-[0fr]');
            if (isClosed && profileInfoBtn) {
                profileInfoBtn.click();
            }

            // --- STEP 2: Blur & Tooltip (Reading Phase) ---
            setTimeout(() => {
                showTourOverlay();
                updateTourUrlParam('logout-button');
                if (logoutBtn) {
                    logoutBtn.classList.add('portal-tour-highlighted', 'relative', 'z-[95]', 'ring-4', 'ring-red-400', 'ring-offset-1', 'animate-pulse');
                    showTourStepTooltip(logoutBtn, {
                        step: 2,
                        totalSteps: 3,
                        title: 'Click Logout',
                        description: 'Click Log Out to open the confirmation dialog.',
                        badgeColor: 'red'
                    });
                }

                // After reading: Return to default, click logout
                setTimeout(() => {
                    hideTourStepTooltip();
                    hideTourOverlay();
                    if (logoutBtn) {
                        logoutBtn.classList.remove('portal-tour-highlighted', 'relative', 'z-[95]', 'ring-4', 'ring-red-400', 'ring-offset-1', 'animate-pulse');
                        logoutBtn.click();
                    }

                    // --- STEP 3: Inside Confirmation Modal (Button Highlight & Tooltip) ---
                    setTimeout(() => {
                        updateTourUrlParam('confirm-logout');
                        const confirmLogoutBtn = document.getElementById('sidebar-logout-confirm-btn');
                        if (confirmLogoutBtn) {
                            confirmLogoutBtn.classList.add('portal-tour-highlighted', 'relative', 'z-[105]', 'ring-4', 'ring-red-500', 'ring-offset-2', 'dark:ring-offset-gray-900', 'animate-pulse');
                            showTourStepTooltip(confirmLogoutBtn, {
                                step: 3,
                                totalSteps: 3,
                                title: 'Confirm Sign Out',
                                description: 'Confirm logout to return to the sign-in screen and test SMS OTP reset.',
                                badgeColor: 'red'
                            });
                        }

                        setTimeout(() => {
                            endPortalTour();
                        }, 3200);
                    }, 600);
                }, 2800);
            }, 500);
        }, 2800);
    }, delay);
};

// Listen for successful profile save during tour to transition into logout phase
window.addEventListener('portal:tour-profile-saved', () => {
    const saveBtn = document.getElementById('settings-save-button');
    if (saveBtn) {
        saveBtn.classList.remove('ring-4', 'ring-emerald-500', 'ring-offset-2', 'dark:ring-offset-gray-900', 'animate-pulse');
    }
    setTimeout(() => {
        startLogoutTour();
    }, 600);
});

export const showForgotPasswordTourModal = () => {
    let modalEl = document.getElementById('forgot-password-tour-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'forgot-password-tour-modal';
        modalEl.tabIndex = -1;
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.className = 'fixed inset-0 z-[100] hidden h-full w-full items-center justify-center overflow-y-auto overflow-x-hidden p-4';
        modalEl.innerHTML = `
            <div class="relative w-full max-w-md">
                <div class="relative rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                    <!-- Top Gradient Header -->
                    <div class="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-5 text-white flex items-center justify-between">
                        <div class="flex items-center gap-2.5">
                            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-xs text-white shadow-xs shrink-0">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                                </svg>
                            </span>
                            <div>
                                <h3 class="text-base font-extrabold text-white leading-tight">SMS Password Reset</h3>
                                <p class="text-[11px] text-blue-200/80">Account Security & Recovery</p>
                            </div>
                        </div>
                        <button type="button" data-tour-modal-close class="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors" aria-label="Close dialog">
                            <svg class="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 14 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1l6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/></svg>
                        </button>
                    </div>

                    <!-- Modal Body -->
                    <div class="p-5 sm:p-6 space-y-3">
                        <p class="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                            Have you already registered your active <strong>Philippine mobile number</strong> in your <strong>Profile Settings</strong>?
                        </p>
                        <div class="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/20 p-3 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                            <svg class="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                            </svg>
                            <span>Your mobile number is required to receive one-time OTP SMS verification codes when recovering your password.</span>
                        </div>
                    </div>

                    <!-- Footer Choices -->
                    <div class="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/30 p-4 sm:p-5">
                        <button type="button" id="btn-tour-no-update" class="cursor-pointer w-full sm:w-auto rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors shadow-xs">
                            No, update my profile
                        </button>
                        <button type="button" id="btn-tour-yes-proceed" class="cursor-pointer w-full sm:w-auto rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors focus:ring-4 focus:ring-blue-300">
                            Yes, I have
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        forgotTourModalInstance = new Modal(modalEl, {
            placement: 'center',
            backdrop: 'dynamic',
            closable: true,
            onShow: () => window.dispatchEvent(new CustomEvent('portal:modal-open')),
            onHide: () => window.dispatchEvent(new CustomEvent('portal:modal-close'))
        });

        modalEl.querySelectorAll('[data-tour-modal-close]').forEach((btn) => {
            btn.addEventListener('click', () => {
                forgotTourModalInstance?.hide();
                updateTourUrlParam(null);
            });
        });

        document.getElementById('btn-tour-no-update')?.addEventListener('click', () => {
            forgotTourModalInstance?.hide();
            startProfilePhoneTour();
        });

        document.getElementById('btn-tour-yes-proceed')?.addEventListener('click', () => {
            forgotTourModalInstance?.hide();
            startLogoutTour();
        });
    }

    forgotTourModalInstance.show();
};
/* END FORGOT PASSWORD INTERACTIVE TOUR SYSTEM */

/* START HIGHLIGHT PROFILE SETTINGS - Pulses emerald border with tour overlay and preview tooltip */
const triggerSettingsHighlight = () => {
    const wasClosed = ensureMobileSidebarOpen();
    const delay = wasClosed ? 350 : 0;
    removeDrawerBackdrop();
    showTourOverlay();

    setTimeout(() => {
        removeDrawerBackdrop();
        const userCard = document.getElementById('sidebar-user-card');
        const profileInfoBtn = document.getElementById('sidebar-user-profile-info');
        if (!userCard) return;

        userCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        userCard.classList.add('portal-tour-highlighted', 'relative', 'z-[95]', 'ring-4', 'ring-emerald-500', 'ring-offset-2', 'dark:ring-offset-gray-950', 'animate-pulse', 'border-emerald-500');

        showTourStepTooltip(userCard, {
            step: 1,
            totalSteps: 1,
            title: 'Profile Settings & Preview',
            description: 'Hover or click your profile card to view quick account details and settings.',
            badgeColor: 'emerald'
        });

        if (profileInfoBtn) {
            setTimeout(() => {
                profileInfoBtn.click();
            }, 600);

            setTimeout(() => {
                profileInfoBtn.click();
            }, 2400);

            setTimeout(() => {
                profileInfoBtn.click();
            }, 3800);

            setTimeout(() => {
                profileInfoBtn.click();
            }, 5200);
        }

        setTimeout(() => {
            userCard.classList.remove('portal-tour-highlighted', 'relative', 'z-[95]', 'ring-4', 'ring-emerald-500', 'ring-offset-2', 'dark:ring-offset-gray-950', 'animate-pulse', 'border-emerald-500');
            hideTourStepTooltip();
            hideTourOverlay();
        }, 6000);
    }, delay);
};
/* END HIGHLIGHT PROFILE SETTINGS */

/* START HIGHLIGHT TICKETS - Directs user to the appropriate tickets page with preview tooltip */
const triggerTicketsHighlight = () => {
    const wasClosed = ensureMobileSidebarOpen();
    const delay = wasClosed ? 350 : 0;
    removeDrawerBackdrop();
    showTourOverlay();

    setTimeout(() => {
        removeDrawerBackdrop();
        const isAdminOrHr = window.location.pathname.includes('/admin/') || 
                            window.__PORTAL_SESSION?.roles?.name?.toLowerCase() === 'admin' || 
                            window.__PORTAL_SESSION?.roles?.name?.toLowerCase() === 'hr';

        const targetUrl = isAdminOrHr
            ? '/src/pages/user/admin/tickets/?highlight=chat'
            : '/src/pages/user/staff/tickets/?highlight=chat';

        const ticketNavBtn = document.querySelector('a[data-nav-id="tickets"]') || document.querySelector('a[href*="/tickets/"]');
        if (ticketNavBtn) {
            ticketNavBtn.classList.add('portal-tour-highlighted', 'relative', 'z-[95]', 'ring-4', 'ring-emerald-500', 'animate-pulse', 'bg-emerald-50', 'dark:bg-emerald-950/40', 'border', 'border-emerald-400');
            
            showTourStepTooltip(ticketNavBtn, {
                step: 1,
                totalSteps: 1,
                title: 'Helpdesk & Ticket Support',
                description: 'Opening Tickets Support to view realtime chats and messages...',
                badgeColor: 'emerald'
            });

            setTimeout(() => {
                hideTourStepTooltip();
                hideTourOverlay();
                window.location.href = targetUrl;
            }, 1200);
        } else {
            hideTourStepTooltip();
            hideTourOverlay();
            window.location.href = targetUrl;
        }
    }, delay);
};
/* END HIGHLIGHT TICKETS */

/* START RENDER MARKETING CTA BANNER - Builds inline accordion announcement banner on Dashboard above Image Banner */
export const initAnnouncementBanner = (targetContainerSelector = '#announcement-banner-slot') => {
    const targetSlot = document.querySelector(targetContainerSelector);
    if (!targetSlot) return;

    if (!PORTAL_ANNOUNCEMENTS || PORTAL_ANNOUNCEMENTS.length === 0) return;

    const isDismissed = localStorage.getItem(ANNOUNCEMENT_STORAGE_DISMISSED_KEY) === 'true';

    targetSlot.innerHTML = '';

    const bannerWrapper = document.createElement('div');
    bannerWrapper.id = 'marketing-banner-wrapper';
    bannerWrapper.className = `w-full transition-all duration-300 ease-out overflow-hidden ${isDismissed ? 'grid grid-rows-[0fr] opacity-0 mb-0' : 'grid grid-rows-[1fr] opacity-100 mb-4'}`;

    bannerWrapper.innerHTML = `
        <div class="min-h-0 overflow-hidden">
            <div id="marketing-banner" class="w-full flex flex-col md:flex-row items-center justify-between p-3.5 sm:p-4 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl shadow-xs transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-800">
                <div id="announcement-content-box" class="flex items-center w-full min-w-0 mb-3 md:mb-0 md:me-4 gap-2.5 sm:gap-3 cursor-pointer group select-none">
                    <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs shrink-0 transition-transform group-hover:scale-105">
                        <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 9h6m-6 3h6m-6 3h6M6.996 9h.01m-.01 3h.01m-.01 3h.01M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/>
                        </svg>
                    </span>
                    <div class="min-w-0 flex-1 overflow-hidden transition-all duration-300 ease-in-out">
                        <p id="announcement-text" class="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 transition-all duration-300 line-clamp-1 sm:line-clamp-none leading-relaxed">
                            ${PORTAL_ANNOUNCEMENTS[0].text}
                        </p>
                    </div>
                    <span id="announcement-expand-icon" class="sm:hidden text-gray-400 dark:text-gray-500 transition-transform duration-300 shrink-0 p-1" title="Tap to expand or collapse">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </span>
                </div>
                <div class="flex items-center justify-between sm:justify-end w-full md:w-auto shrink-0 gap-2 border-t md:border-t-0 border-gray-100 dark:border-gray-800 pt-2.5 md:pt-0">
                    <a id="announcement-cta" href="${PORTAL_ANNOUNCEMENTS[0].ctaUrl || '#'}" class="cursor-pointer ${(!PORTAL_ANNOUNCEMENTS[0].ctaText || PORTAL_ANNOUNCEMENTS[0].noCta) ? 'hidden' : 'inline-flex'} items-center justify-center text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-900/50 shadow-xs font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all select-none">
                        ${PORTAL_ANNOUNCEMENTS[0].ctaText || ''}
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
    const contentBox = bannerWrapper.querySelector('#announcement-content-box');
    const expandIcon = bannerWrapper.querySelector('#announcement-expand-icon');
    const bannerBox = bannerWrapper.querySelector('#marketing-banner');

    let isExpanded = false;

    // Mobile tap-to-toggle expandable text wrap with smooth animation
    if (contentBox && textEl) {
        contentBox.addEventListener('click', (e) => {
            // Ignore click if user clicked on a link or button
            if (e.target.closest('a, button')) return;

            isExpanded = !isExpanded;
            if (isExpanded) {
                textEl.classList.remove('line-clamp-1');
                expandIcon?.classList.add('rotate-180');
            } else {
                textEl.classList.add('line-clamp-1');
                expandIcon?.classList.remove('rotate-180');
            }
        });
    }

    const updateBannerContent = (index) => {
        const item = PORTAL_ANNOUNCEMENTS[index];
        if (!item || !textEl || !ctaBtn) return;

        textEl.style.opacity = '0';

        setTimeout(() => {
            textEl.textContent = item.text;
            
            if (item.noCta || !item.ctaText) {
                ctaBtn.classList.add('hidden');
                ctaBtn.classList.remove('inline-flex');
            } else {
                ctaBtn.classList.remove('hidden');
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
            }

            textEl.style.opacity = '1';
        }, 300);
    };

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

            if (currentItem.actionType === 'open-chatbot') {
                e.preventDefault();
                document.getElementById('dole-chatbot-fab')?.click();
            } else if (currentItem.actionType === 'forgot-password-guide') {
                e.preventDefault();
                showForgotPasswordTourModal();
            } else if (currentItem.actionType === 'settings-highlight') {
                e.preventDefault();
                triggerSettingsHighlight();
            } else if (currentItem.actionType === 'tickets-highlight') {
                e.preventDefault();
                triggerTicketsHighlight(currentItem.ctaUrl);
            }
        });
    }

    // Dismiss button
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

/* START RESET ANNOUNCEMENT DISMISSAL */
export const resetAnnouncementDismissal = () => {
    try {
        localStorage.removeItem(ANNOUNCEMENT_STORAGE_DISMISSED_KEY);
    } catch {}
};
/* END RESET ANNOUNCEMENT DISMISSAL */

