import { Modal } from 'flowbite';
import {
    getCurrentUser,
    isHashedCredential,
    loginWithEmail,
    loginWithPhone,
    loginWithUsername,
    registerPendingUser,
    saveSession
} from '@/backend/api/auth.api.js';
import { createGip } from '@/backend/api/gips.api.js';
import { fetchOffices, fetchRoles } from '@/backend/api/users.api.js';
import {
    clearRememberedLogin,
    getRememberedLogin,
    setRememberedLogin
} from '@/scripts/modules/storage.js';

const ROLE_ROUTES = {
    admin: '/src/pages/user/admin/dashboard/',
    staff: '/src/pages/user/staff/dashboard/'
};

const ROLE_GROUPS = {
    admin: [1],
    staff: [2, 3]
};

const ERROR_TEXT_CLASS = 'mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400';
const ERROR_INPUT_CLASSES = ['border-red-400', 'focus:border-red-500', 'focus:ring-red-500', 'dark:border-red-500'];
const DEFAULT_INPUT_CLASSES = ['border-gray-300', 'focus:border-blue-500', 'focus:ring-blue-500', 'dark:border-gray-700'];
const REGISTER_FIELDS = ['name', 'office', 'username', 'email', 'phone', 'password', 'confirm'];
const REGISTER_STEP_TITLES = ['Account Details', 'Security', 'Optional GIP'];
const MAX_REGISTER_GIPS = 2;

let authViewMode = 'login';
let registrationRoleId = 3;
const registerStepState = { desktop: 0, mobile: 0 };
const registerOfficeDropdowns = {};

const getRoleGroup = (roleId) => {
    const numericRoleId = Number(roleId);
    if (ROLE_GROUPS.admin.includes(numericRoleId)) return 'admin';
    if (ROLE_GROUPS.staff.includes(numericRoleId)) return 'staff';
    return null;
};

const getDashboardRoute = (user) => ROLE_ROUTES[getRoleGroup(user?.role_id)] || '/';
const isProtectedPage = () => /\/src\/pages\/user\/(admin|staff)\//.test(window.location.pathname);
const getRequiredRole = () => window.location.pathname.match(/\/src\/pages\/user\/(admin|staff)\//)?.[1] || null;
const getFormByPrefix = (prefix) => document.getElementById(`${prefix}-username`)?.closest('form') || null;
const getCurrentMode = (prefix) => getFormByPrefix(prefix)?.dataset.authMode || 'username';
/* START GET CREDENTIAL INPUT - Returns the active password or PIN input for a login form */
const getCredentialInput = (prefix, mode = getCurrentMode(prefix)) => document.getElementById(`${prefix}-${mode === 'phone' ? 'pin' : 'password'}`);
/* END GET CREDENTIAL INPUT */

/* START APPLY REMEMBERED LOGIN - Restores saved username and credential into login fields */
const applyRememberedLogin = () => {
    const rememberedLogin = getRememberedLogin();
    if (!rememberedLogin) return;

    ['desktop', 'mobile'].forEach((prefix) => {
        if (rememberedLogin.mode === 'email') {
            document.getElementById(`${prefix}-email-btn`)?.click();
        } else if (rememberedLogin.mode === 'phone') {
            document.getElementById(`${prefix}-phone-btn`)?.click();
        }

        const identityInput = document.getElementById(`${prefix}-username`);
        const credentialInput = getCredentialInput(prefix, rememberedLogin.mode);
        const rememberInput = document.getElementById(`${prefix}-remember`);

        if (identityInput) identityInput.value = rememberedLogin.identifier;
        if (credentialInput) {
            credentialInput.value = rememberedLogin.credential;
            if (credentialInput.id.endsWith('-password')) credentialInput.type = 'password';
        }
        if (rememberInput) rememberInput.checked = true;
    });
};
/* END APPLY REMEMBERED LOGIN */

/* START CREATE AUTH NOTICE MODAL - Builds the buttonless Flowbite auth notice */
const createAuthNoticeModal = () => {
    let modalEl = document.getElementById('auth-notice-modal');
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.id = 'auth-notice-modal';
    modalEl.tabIndex = -1;
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.className = 'hidden overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-[80] justify-center items-center w-full md:inset-0 h-[calc(100%-1rem)] max-h-full p-4';
    modalEl.innerHTML = `
        <div class="relative w-full max-w-md max-h-full">
            <div class="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-red-100 dark:border-red-900/60">
                <div class="p-5 sm:p-6 text-center">
                    <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                        <svg class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 12.75v6.75A2.25 2.25 0 0 0 6.75 21.75Z"/></svg>
                    </div>
                    <h3 id="auth-notice-title" class="mb-2 text-lg font-extrabold text-gray-900 dark:text-white">Login required</h3>
                    <p id="auth-notice-message" class="mb-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">You must login first before opening this page.</p>
                    <p class="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">Redirecting...</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);
    return modalEl;
};
/* END CREATE AUTH NOTICE MODAL */

/* START SHOW AUTH NOTICE - Shows notice, auto-closes it, then runs redirect callback */
const showAuthNotice = ({ title, message, onAction, autoCloseMs = 3000 }) => {
    const modalEl = createAuthNoticeModal();
    modalEl.querySelector('#auth-notice-title').textContent = title;
    modalEl.querySelector('#auth-notice-message').textContent = message;

    let handled = false;
    const runAction = () => {
        if (handled) return;
        handled = true;
        if (typeof onAction === 'function') onAction();
    };

    const modal = new Modal(modalEl, {
        backdrop: 'static',
        closable: false,
        onHide: runAction
    });

    modal.show();
    window.setTimeout(() => {
        modal.hide();
        runAction();
    }, autoCloseMs);

    return modal;
};
/* END SHOW AUTH NOTICE */

/* START SET FORM MODE - Stores the active login method on the current form */
const setFormMode = (prefix, mode) => {
    const form = getFormByPrefix(prefix);
    if (form) form.dataset.authMode = mode;
};
/* END SET FORM MODE */

/* START REDIRECT TO INDEX WITH NOTICE - Sends protected route visitors back to login */
const redirectToIndexWithNotice = () => {
    if (window.location.pathname === '/') return;
    window.location.replace('/?auth=login_required');
};
/* END REDIRECT TO INDEX WITH NOTICE */

/* START BLOCK PROTECTED PAGE RENDER - Prevents denied pages from booting widgets behind auth notices */
const blockProtectedPageRender = () => {
    window.__AUTH_ROUTE_BLOCKED = true;
    document.documentElement.classList.add('overflow-hidden');
    Array.from(document.body?.children || []).forEach((child) => {
        if (child.id === 'auth-notice-modal') return;
        child.classList.add('hidden');
        child.setAttribute('data-auth-hidden', 'true');
    });
};
/* END BLOCK PROTECTED PAGE RENDER */

/* START SETUP ROUTE GUARD - Blocks anonymous users and wrong roles from protected pages */
const setupRouteGuard = () => {
    if (!isProtectedPage()) {
        const params = new URLSearchParams(window.location.search);
        if (params.get('auth') === 'login_required') {
            showAuthNotice({
                title: 'Login required',
                message: 'You must login first before opening the portal pages.',
                autoCloseMs: 3000,
                onAction: () => {
                    params.delete('auth');
                    const nextQuery = params.toString();
                    window.history.replaceState({}, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`);
                }
            });
        }
        return;
    }

    const user = getCurrentUser();
    if (!user) {
        window.__AUTH_ROUTE_BLOCKED = true;
        document.documentElement.classList.add('overflow-hidden');
        document.body?.classList.add('hidden');
        redirectToIndexWithNotice();
        return;
    }

    const requiredRole = getRequiredRole();
    const userRole = getRoleGroup(user.role_id);
    if (requiredRole && userRole !== requiredRole) {
        const redirectRoute = getDashboardRoute(user);
        blockProtectedPageRender();
        showAuthNotice({
            title: 'Access denied',
            message: 'Your account does not have permission to open that page. Redirecting you to your dashboard.',
            autoCloseMs: 1200,
            onAction: () => {
                window.location.replace(redirectRoute);
            }
        });
    }
};
/* END SETUP ROUTE GUARD */

/* START SET LOADING - Updates login submit buttons while credentials are checked */
const setLoading = (form, isLoading) => {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle('opacity-70', isLoading);
    submitBtn.classList.toggle('pointer-events-none', isLoading);
    submitBtn.textContent = isLoading ? 'SIGNING IN...' : 'SIGN IN';
};
/* END SET LOADING */

/* START FIELD ERROR HELPERS - Shows and clears inline validation errors */
const setFieldError = (wrapper, message) => {
    if (!wrapper) return;

    let errorEl = wrapper.querySelector('[data-auth-error]');
    if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.dataset.authError = 'true';
        errorEl.className = ERROR_TEXT_CLASS;
        wrapper.appendChild(errorEl);
    }
    errorEl.textContent = message;

    const input = wrapper.querySelector('input');
    if (input) {
        input.classList.remove(...DEFAULT_INPUT_CLASSES);
        input.classList.add(...ERROR_INPUT_CLASSES);
        input.setAttribute('aria-invalid', 'true');
    }
};

const clearFieldError = (wrapper) => {
    if (!wrapper) return;

    const errorEl = wrapper.querySelector('[data-auth-error]');
    if (errorEl) errorEl.remove();

    const input = wrapper.querySelector('input');
    if (input) {
        input.classList.remove(...ERROR_INPUT_CLASSES);
        input.classList.add(...DEFAULT_INPUT_CLASSES);
        input.removeAttribute('aria-invalid');
    }
};

const clearFormErrors = (prefix) => {
    clearFieldError(document.getElementById(`${prefix}-username-wrapper`));
    clearFieldError(document.getElementById(`${prefix}-password-wrapper`));
};

const setupInputErrorReset = (prefix) => {
    ['username-wrapper', 'password-wrapper'].forEach((suffix) => {
        const wrapper = document.getElementById(`${prefix}-${suffix}`);
        if (!wrapper || wrapper.dataset.authErrorResetBound) return;
        wrapper.dataset.authErrorResetBound = 'true';
        wrapper.addEventListener('input', () => clearFieldError(wrapper));
    });
};
/* END FIELD ERROR HELPERS */

/* START SETUP PASSWORD TOGGLE - Binds password visibility icons for desktop and mobile */
const setupPasswordToggle = () => {
    const openEyeSvg = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0Z" /></svg>`;
    const slashedEyeSvg = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>`;

    const bindToggle = (inputId, toggleId) => {
        const inputEl = document.getElementById(inputId);
        const toggleBtn = document.getElementById(toggleId);
        if (!inputEl || !toggleBtn || toggleBtn.dataset.authToggleBound) return;

        toggleBtn.dataset.authToggleBound = 'true';
        toggleBtn.addEventListener('click', () => {
            const isHidden = inputEl.type === 'password';
            inputEl.type = isHidden ? 'text' : 'password';
            toggleBtn.innerHTML = isHidden ? openEyeSvg : slashedEyeSvg;
        });
    };

    bindToggle('desktop-password', 'desktop-password-toggle');
    bindToggle('mobile-password', 'mobile-password-toggle');
};
/* END SETUP PASSWORD TOGGLE */

/* START SETUP AUTH METHOD SWITCHER - Switches username, email, and phone login forms */
const setupAuthMethodSwitcher = () => {
    const SVG_EMAIL = `<svg class="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path></svg>`;
    const SVG_PHONE = `<svg class="w-4 h-4 mr-2 text-violet-600 dark:text-violet-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>`;
    const SVG_USER = `<svg class="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path></svg>`;

    const originalPasswordHTML = {
        desktop: document.getElementById('desktop-password-wrapper')?.innerHTML || '',
        mobile: document.getElementById('mobile-password-wrapper')?.innerHTML || ''
    };

    const createButton = (id, svg, text, roundedClass, onClick) => {
        const btn = document.createElement('button');
        btn.id = id;
        btn.type = 'button';
        btn.className = `cursor-pointer w-full text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-800 hover:text-blue-700 dark:hover:text-blue-400 font-bold ${roundedClass} text-xs px-3 py-2.5 text-center inline-flex items-center justify-center dark:bg-gray-800 dark:text-white dark:border-gray-600 shadow-sm transition-all hover:shadow-md`;
        btn.innerHTML = `${svg}${text}`;
        btn.addEventListener('click', onClick);
        return btn;
    };

    const restorePasswordField = (prefix) => {
        const passwordWrapper = document.getElementById(`${prefix}-password-wrapper`);
        if (!passwordWrapper || !originalPasswordHTML[prefix]) return;
        passwordWrapper.innerHTML = originalPasswordHTML[prefix];
        passwordWrapper.classList.remove('hidden');
        setupPasswordToggle();
    };

    const switchMode = (prefix, mode) => {
        const usernameWrapper = document.getElementById(`${prefix}-username-wrapper`);
        const passwordWrapper = document.getElementById(`${prefix}-password-wrapper`);
        const methodsContainer = document.getElementById(`${prefix}-methods-container`);
        if (!usernameWrapper || !passwordWrapper || !methodsContainer) return;

        const isMobile = prefix === 'mobile';
        const roundedClass = isMobile ? 'rounded-xl' : 'rounded-lg';
        const roundedLeftClass = isMobile ? 'rounded-l-xl' : 'rounded-l-lg';
        const roundedRightClass = isMobile ? 'rounded-r-xl' : 'rounded-r-lg';

        if (mode === 'phone') {
            usernameWrapper.innerHTML = `
                <label for="${prefix}-username" class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Phone</label>
                <div class="flex items-center">
                    <span class="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-2.5 text-sm font-bold ${roundedLeftClass} border-r-0 select-none">+63</span>
                    <input type="tel" id="${prefix}-username" name="phone" class="bg-gray-50 border border-gray-300 text-gray-900 ${roundedRightClass} rounded-l-none focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-400 dark:text-white text-sm transition-colors" placeholder="9123456789" required>
                </div>`;
            passwordWrapper.innerHTML = `
                <div class="flex justify-between items-center mb-1.5">
                    <label for="${prefix}-pin" class="block text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">PIN</label>
                </div>
                <input type="text" id="${prefix}-pin" name="pin" class="bg-gray-50 border border-gray-300 text-gray-900 ${roundedClass} focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-400 dark:text-white text-sm transition-colors text-center tracking-[1em] font-mono font-bold" placeholder="1234" required>`;

            document.getElementById(`${prefix}-username`)?.addEventListener('input', (event) => {
                let value = event.target.value.replace(/\D/g, '');
                if (value.length > 0 && value[0] !== '9') value = `9${value.substring(1)}`;
                event.target.value = value.slice(0, 10);
            });
            document.getElementById(`${prefix}-pin`)?.addEventListener('input', (event) => {
                event.target.value = event.target.value.replace(/\D/g, '').slice(0, 4);
            });
        } else if (mode === 'email') {
            usernameWrapper.innerHTML = `
                <label for="${prefix}-username" class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Email</label>
                <input type="email" id="${prefix}-username" name="email" class="bg-gray-50 border border-gray-300 text-gray-900 ${roundedClass} focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-400 dark:text-white text-sm transition-colors" placeholder="name@domain.com" required>`;
            restorePasswordField(prefix);
        } else {
            usernameWrapper.innerHTML = `
                <label for="${prefix}-username" class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Username</label>
                <input type="text" id="${prefix}-username" name="username" class="bg-gray-50 border border-gray-300 text-gray-900 ${roundedClass} focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-400 dark:text-white text-sm transition-colors" placeholder="Enter your username" required>`;
            restorePasswordField(prefix);
        }

        setFormMode(prefix, mode);
        clearFormErrors(prefix);
        setupInputErrorReset(prefix);

        methodsContainer.innerHTML = '';
        if (mode === 'username') {
            methodsContainer.appendChild(createButton(`${prefix}-email-btn`, SVG_EMAIL, 'Email', roundedClass, () => switchMode(prefix, 'email')));
            methodsContainer.appendChild(createButton(`${prefix}-phone-btn`, SVG_PHONE, 'Phone', roundedClass, () => switchMode(prefix, 'phone')));
        } else if (mode === 'email') {
            methodsContainer.appendChild(createButton(`${prefix}-username-btn`, SVG_USER, 'Username', roundedClass, () => switchMode(prefix, 'username')));
            methodsContainer.appendChild(createButton(`${prefix}-phone-btn`, SVG_PHONE, 'Phone', roundedClass, () => switchMode(prefix, 'phone')));
        } else {
            methodsContainer.appendChild(createButton(`${prefix}-username-btn`, SVG_USER, 'Username', roundedClass, () => switchMode(prefix, 'username')));
            methodsContainer.appendChild(createButton(`${prefix}-email-btn`, SVG_EMAIL, 'Email', roundedClass, () => switchMode(prefix, 'email')));
        }
    };

    ['desktop', 'mobile'].forEach((prefix) => {
        setFormMode(prefix, 'username');
        document.getElementById(`${prefix}-email-btn`)?.addEventListener('click', () => switchMode(prefix, 'email'));
        document.getElementById(`${prefix}-phone-btn`)?.addEventListener('click', () => switchMode(prefix, 'phone'));
    });
};
/* END SETUP AUTH METHOD SWITCHER */


/* START REGISTRATION FLOW - Builds and controls the public registration panel without changing the original login design */
const registerButtonClass = (prefix, variant = 'primary') => {
    const rounded = prefix === 'mobile' ? 'rounded-xl' : 'rounded-lg';
    const base = `cursor-pointer inline-flex shrink-0 items-center justify-center whitespace-nowrap ${rounded} px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-4`;
    if (variant === 'secondary') return `${base} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700`;
    return `${base} bg-blue-700 text-white hover:bg-blue-800 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700`;
};

const buildRegisterGipBlock = (prefix, index) => {
    const rounded = prefix === 'mobile' ? 'rounded-xl' : 'rounded-lg';
    return `
        <div class="border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50 ${rounded}" data-register-gip-block="true">
            <div class="mb-3 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
                <span class="text-xs font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400">GIP Implementor #${index}</span>
                <button type="button" class="btn-remove-register-gip cursor-pointer text-xs font-bold text-red-600 dark:text-red-400">Remove</button>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
                <input type="text" name="gip_name[]" placeholder="Full name" class="bg-white border border-gray-300 text-gray-900 text-sm block w-full p-2.5 ${rounded} focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required>
                <input type="text" name="gip_username[]" placeholder="Username" class="bg-white border border-gray-300 text-gray-900 text-sm block w-full p-2.5 ${rounded} focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required>
                <input type="email" name="gip_email[]" placeholder="Email address" class="bg-white border border-gray-300 text-gray-900 text-sm block w-full p-2.5 ${rounded} focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required>
                <input type="tel" name="gip_phone[]" placeholder="Phone number (optional)" class="bg-white border border-gray-300 text-gray-900 text-sm block w-full p-2.5 ${rounded} focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                <input type="password" name="gip_password[]" placeholder="Password" class="bg-white border border-gray-300 text-gray-900 text-sm block w-full p-2.5 ${rounded} focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required>
                <input type="password" name="gip_confirm_password[]" placeholder="Confirm password" class="bg-white border border-gray-300 text-gray-900 text-sm block w-full p-2.5 ${rounded} focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required>
            </div>
        </div>`;
};

const buildRegisterPanel = (prefix) => {
    const rounded = prefix === 'mobile' ? 'rounded-xl' : 'rounded-lg';
    const headingClass = prefix === 'mobile' ? 'text-3xl text-center' : 'text-4xl';
    return `
        <section class="w-1/2 shrink-0 ${prefix === 'mobile' ? '' : 'pl-8'}">
            <div class="mb-5 flex items-start justify-between gap-3">
                <div>
                    <p class="text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-500">Registration Request</p>
                    <h2 class="${headingClass} font-extrabold text-gray-900 dark:text-white mt-1">Request Portal Access</h2>
                    <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm leading-relaxed">Approval is required before a registered account can log in.</p>
                </div>
                <button id="${prefix}-register-login-btn" type="button" class="${prefix === 'desktop' ? 'hidden' : registerButtonClass(prefix, 'secondary')} px-4 py-2.5">Login</button>
            </div>
            <form id="${prefix}-register-form" class="space-y-5 text-left">
                <div class="border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40 ${rounded}">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-500">Step <span id="${prefix}-register-step-number">1</span> of 3</p>
                    <p id="${prefix}-register-step-title" class="mt-1 text-sm font-bold text-gray-900 dark:text-white">Account Details</p>
                </div>
                <div id="${prefix}-register-step-0" data-register-step="0" class="space-y-4">
                    <div id="${prefix}-register-name-wrapper"><label class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Full Name</label><input id="${prefix}-register-name" type="text" class="bg-gray-50 border border-gray-300 text-gray-900 ${rounded} focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm" placeholder="Enter your full name" required></div>
                    <div id="${prefix}-register-office-wrapper" class="relative"><label class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Office</label><input type="hidden" id="${prefix}-register-office"><button type="button" id="${prefix}-register-office-dropdown-btn" class="cursor-pointer bg-gray-50 border border-gray-300 text-gray-900 text-sm ${rounded} focus:ring-2 focus:ring-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-left flex justify-between items-center"><span>Loading offices...</span><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m19 9-7 7-7-7"></path></svg></button><div id="${prefix}-register-office-dropdown-list" class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${rounded} shadow-lg hidden"><div class="border-b border-gray-200 dark:border-gray-700 p-2"><input type="text" id="${prefix}-register-office-search" class="bg-gray-50 border border-gray-300 text-gray-900 rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full p-2 dark:bg-gray-900 dark:border-gray-700 dark:text-white text-xs" placeholder="Search offices..." autocomplete="off"></div><div class="options-container max-h-48 overflow-y-auto p-1"></div></div></div>
                    <div class="grid gap-4 sm:grid-cols-2"><div id="${prefix}-register-username-wrapper"><label class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Username</label><input id="${prefix}-register-username" type="text" class="bg-gray-50 border border-gray-300 text-gray-900 ${rounded} focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm" placeholder="Choose a username" required></div><div id="${prefix}-register-email-wrapper"><label class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Email Address</label><input id="${prefix}-register-email" type="email" class="bg-gray-50 border border-gray-300 text-gray-900 ${rounded} focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm" placeholder="name@domain.com" required></div></div>
                    <div id="${prefix}-register-phone-wrapper"><label class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Phone Number <span class="font-medium text-gray-400">(Optional)</span></label><input id="${prefix}-register-phone" type="tel" class="bg-gray-50 border border-gray-300 text-gray-900 ${rounded} focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm" placeholder="09123456789"></div>
                </div>
                <div id="${prefix}-register-step-1" data-register-step="1" class="hidden space-y-4">
                    <div class="border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 ${rounded}">After submitting, please wait for HR or a portal administrator to approve the account before logging in.</div>
                    <div id="${prefix}-register-password-wrapper"><label class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Password</label><input id="${prefix}-register-password" type="password" class="bg-gray-50 border border-gray-300 text-gray-900 ${rounded} focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm" placeholder="Create a password" required></div>
                    <div id="${prefix}-register-confirm-wrapper"><label class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Confirm Password</label><input id="${prefix}-register-confirm" type="password" class="bg-gray-50 border border-gray-300 text-gray-900 ${rounded} focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm" placeholder="Confirm your password" required></div>
                </div>
                <div id="${prefix}-register-step-2" data-register-step="2" class="hidden space-y-4">
                    <div class="border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/50 ${rounded}"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 class="text-sm font-extrabold text-gray-900 dark:text-white">Optional GIP Implementors</h3><p class="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Add up to 2 linked GIP implementors only when needed.</p></div><button id="${prefix}-register-add-gip-btn" type="button" class="${registerButtonClass(prefix)} px-4 py-2.5">Add GIP</button></div><p id="${prefix}-register-gip-limit" class="mt-3 text-xs font-semibold text-gray-500 dark:text-gray-400">0 / 2 GIP implementors added.</p><div id="${prefix}-register-gips-form-container" class="mt-3 space-y-3"></div></div>
                </div>
                <div class="flex items-center justify-between gap-3 pt-1"><button id="${prefix}-register-back-btn" type="button" class="${registerButtonClass(prefix, 'secondary')} hidden" hidden>Back</button><div class="ml-auto flex gap-3"><button id="${prefix}-register-next-btn" type="button" class="${registerButtonClass(prefix)}">Next</button><button id="${prefix}-register-submit-btn" type="submit" class="${registerButtonClass(prefix)} hidden" hidden>Submit Registration</button></div></div>
            </form>
        </section>`;
};

const renderRegistrationShell = () => {
    [['desktop', document.getElementById('desktop-auth-content')], ['mobile', document.getElementById('mobile-auth-content')]].forEach(([prefix, root]) => {
        if (!root || root.dataset.registerShellReady) return;
        const loginMarkup = root.innerHTML;
        root.innerHTML = `<div class="overflow-hidden"><div id="${prefix}-auth-track" class="flex w-[200%] transition-transform duration-500 ease-in-out"><section class="w-1/2 shrink-0">${loginMarkup}</section>${buildRegisterPanel(prefix)}</div></div>`;
        root.dataset.registerShellReady = 'true';
    });
};

const getDesktopMotionPanels = () => {
    const app = document.getElementById('app');
    return {
        sliderPanel: app?.children?.[0] || null,
        desktopPanel: app?.children?.[2] || null
    };
};

const setupDesktopPanelMotion = () => {
    const { sliderPanel, desktopPanel } = getDesktopMotionPanels();
    [sliderPanel, desktopPanel].forEach((panel) => panel?.classList.add('transition-transform', 'duration-500', 'ease-in-out'));
};

const syncDesktopPanelMotion = () => {
    const { sliderPanel, desktopPanel } = getDesktopMotionPanels();
    if (!sliderPanel || !desktopPanel) return;
    const shouldSwap = authViewMode === 'register' && window.innerWidth >= 1024;
    sliderPanel.style.transform = shouldSwap ? 'translateX(66.666667%)' : 'translateX(0)';
    desktopPanel.style.transform = shouldSwap ? 'translateX(-150%)' : 'translateX(0)';
};

const setAuthViewMode = (mode) => {
    authViewMode = mode === 'register' ? 'register' : 'login';
    document.querySelectorAll('[id$="-auth-track"]').forEach((track) => {
        track.style.transform = authViewMode === 'register' ? 'translateX(-50%)' : 'translateX(0)';
    });
    const heroBtn = document.getElementById('hero-register-btn');
    if (heroBtn) heroBtn.textContent = authViewMode === 'register' ? 'Login' : 'Register';
    syncDesktopPanelMotion();
};
const showAuthStatusModal = ({ title, message, tone = 'info', onClose } = {}) => {
    const existing = document.getElementById('auth-status-modal');
    if (existing) existing.remove();
    const modalEl = document.createElement('div');
    modalEl.id = 'auth-status-modal';
    modalEl.tabIndex = -1;
    modalEl.className = 'hidden overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-[90] justify-center items-center w-full md:inset-0 h-[calc(100%-1rem)] max-h-full p-4';
    const toneClass = tone === 'danger' ? 'text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400' : tone === 'success' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400' : 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300';
    modalEl.innerHTML = `<div class="relative w-full max-w-md"><div class="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800"><div class="p-6 text-center"><div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg ${toneClass}"><svg class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path></svg></div><h3 class="mb-2 text-lg font-extrabold text-gray-900 dark:text-white">${title || 'Notice'}</h3><p class="text-sm leading-relaxed text-gray-500 dark:text-gray-400">${message || ''}</p><button type="button" id="auth-status-close" class="cursor-pointer mt-5 w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700">Close</button></div></div></div>`;
    document.body.appendChild(modalEl);
    const modal = new Modal(modalEl, { onHide: () => { if (typeof onClose === 'function') onClose(); modalEl.remove(); } });
    modalEl.querySelector('#auth-status-close')?.addEventListener('click', () => modal.hide());
    modal.show();
};

const initRegisterOfficeDropdown = (prefix, offices) => {
    const hidden = document.getElementById(`${prefix}-register-office`);
    const btn = document.getElementById(`${prefix}-register-office-dropdown-btn`);
    const list = document.getElementById(`${prefix}-register-office-dropdown-list`);
    const search = document.getElementById(`${prefix}-register-office-search`);
    const box = list?.querySelector('.options-container');
    if (!hidden || !btn || !list || !search || !box) return;
    const options = offices.map((office) => ({ value: office.id, label: office.name || `Office ${office.id}` }));
    const paint = (items = options) => {
        box.innerHTML = items.length ? '' : '<div class="p-2 text-xs italic text-center text-gray-500 dark:text-gray-400">No results found</div>';
        items.forEach((item) => {
            const node = document.createElement('button');
            node.type = 'button';
            node.className = 'cursor-pointer block w-full rounded-md p-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700';
            node.textContent = item.label;
            node.addEventListener('click', () => {
                hidden.value = item.value;
                btn.querySelector('span').textContent = item.label;
                list.classList.add('hidden');
                clearRegisterFieldError(prefix, 'office');
            });
            box.appendChild(node);
        });
    };
    btn.querySelector('span').textContent = options.length ? 'Select an office...' : 'No offices available';
    btn.addEventListener('click', (event) => { event.stopPropagation(); list.classList.toggle('hidden'); search.value = ''; paint(); search.focus(); });
    search.addEventListener('input', () => paint(options.filter((item) => item.label.toLowerCase().includes(search.value.toLowerCase().trim()))));
    document.addEventListener('click', (event) => { if (!list.contains(event.target) && !btn.contains(event.target)) list.classList.add('hidden'); });
    registerOfficeDropdowns[prefix] = { reset: () => { hidden.value = ''; btn.querySelector('span').textContent = options.length ? 'Select an office...' : 'No offices available'; } };
    paint();
};

const setRegisterFieldError = (prefix, field, message) => {
    const wrapper = document.getElementById(`${prefix}-register-${field}-wrapper`);
    if (!wrapper) return;
    let error = wrapper.querySelector('[data-register-error]');
    if (!error) {
        error = document.createElement('p');
        error.dataset.registerError = 'true';
        error.className = ERROR_TEXT_CLASS;
        wrapper.appendChild(error);
    }
    error.textContent = message;
};

const clearRegisterFieldError = (prefix, field) => document.getElementById(`${prefix}-register-${field}-wrapper`)?.querySelector('[data-register-error]')?.remove();
const clearRegisterErrors = (prefix) => REGISTER_FIELDS.forEach((field) => clearRegisterFieldError(prefix, field));

const showRegisterStep = (prefix, index) => {
    registerStepState[prefix] = index;
    document.querySelectorAll(`#${prefix}-register-form [data-register-step]`).forEach((step) => step.classList.toggle('hidden', Number(step.dataset.registerStep) !== index));
    const number = document.getElementById(`${prefix}-register-step-number`);
    const title = document.getElementById(`${prefix}-register-step-title`);
    const back = document.getElementById(`${prefix}-register-back-btn`);
    const next = document.getElementById(`${prefix}-register-next-btn`);
    const submit = document.getElementById(`${prefix}-register-submit-btn`);
    const setHidden = (element, isHidden) => {
        if (!element) return;
        element.hidden = isHidden;
        element.classList.toggle('hidden', isHidden);
    };
    if (number) number.textContent = String(index + 1);
    if (title) title.textContent = REGISTER_STEP_TITLES[index];
    setHidden(back, index === 0);
    setHidden(next, index === 2);
    setHidden(submit, index !== 2);
};

const validateRegisterStep = (prefix, index) => {
    clearRegisterErrors(prefix);
    let ok = true;
    const value = (id) => document.getElementById(`${prefix}-register-${id}`)?.value.trim() || '';
    if (index === 0) {
        if (!value('name')) { setRegisterFieldError(prefix, 'name', 'Full name is required.'); ok = false; }
        if (!value('office')) { setRegisterFieldError(prefix, 'office', 'Office selection is required.'); ok = false; }
        if (!value('username')) { setRegisterFieldError(prefix, 'username', 'Username is required.'); ok = false; }
        if (!value('email')) { setRegisterFieldError(prefix, 'email', 'Email address is required.'); ok = false; }
        const phone = value('phone').replace(/\s+/g, '');
        if (phone && !/^((\+63|0)?9\d{9})$/.test(phone)) { setRegisterFieldError(prefix, 'phone', 'Enter a valid Philippine mobile number.'); ok = false; }
    }
    if (index === 1) {
        if (!value('password')) { setRegisterFieldError(prefix, 'password', 'Password is required.'); ok = false; }
        if (!value('confirm')) { setRegisterFieldError(prefix, 'confirm', 'Please confirm your password.'); ok = false; }
        if (value('password') && value('confirm') && value('password') !== value('confirm')) { setRegisterFieldError(prefix, 'confirm', 'Passwords do not match.'); ok = false; }
    }
    return ok;
};

const updateRegisterGipState = (prefix) => {
    const container = document.getElementById(`${prefix}-register-gips-form-container`);
    const add = document.getElementById(`${prefix}-register-add-gip-btn`);
    const limit = document.getElementById(`${prefix}-register-gip-limit`);
    const count = container?.querySelectorAll('[data-register-gip-block="true"]').length || 0;
    if (limit) limit.textContent = `${count} / ${MAX_REGISTER_GIPS} GIP implementors added.`;
    if (add) { add.disabled = count >= MAX_REGISTER_GIPS; add.classList.toggle('opacity-50', count >= MAX_REGISTER_GIPS); }
};

const addRegisterGip = (prefix) => {
    const container = document.getElementById(`${prefix}-register-gips-form-container`);
    if (!container) return;
    const count = container.querySelectorAll('[data-register-gip-block="true"]').length;
    if (count >= MAX_REGISTER_GIPS) return;
    const temp = document.createElement('div');
    temp.innerHTML = buildRegisterGipBlock(prefix, count + 1);
    const block = temp.firstElementChild;
    block.querySelector('.btn-remove-register-gip')?.addEventListener('click', () => { block.remove(); updateRegisterGipState(prefix); });
    container.appendChild(block);
    updateRegisterGipState(prefix);
};

const collectRegisterPayload = (prefix) => {
    if (!validateRegisterStep(prefix, 0) || !validateRegisterStep(prefix, 1)) return null;
    const get = (id) => document.getElementById(`${prefix}-register-${id}`)?.value.trim() || '';
    const gips = Array.from(document.querySelectorAll(`#${prefix}-register-gips-form-container [data-register-gip-block="true"]`)).map((block) => ({
        full_name: block.querySelector('[name="gip_name[]"]')?.value.trim() || '',
        username: block.querySelector('[name="gip_username[]"]')?.value.trim() || '',
        email: block.querySelector('[name="gip_email[]"]')?.value.trim() || '',
        phone: block.querySelector('[name="gip_phone[]"]')?.value.trim() || null,
        password: block.querySelector('[name="gip_password[]"]')?.value || '',
        confirm: block.querySelector('[name="gip_confirm_password[]"]')?.value || ''
    }));
    for (const gip of gips) {
        if (!gip.full_name || !gip.username || !gip.email || !gip.password || !gip.confirm) { showAuthStatusModal({ title: 'Incomplete GIP form', message: 'Please complete every required GIP field before submitting.', tone: 'warning' }); return null; }
        if (gip.password !== gip.confirm) { showAuthStatusModal({ title: 'GIP password mismatch', message: `Passwords do not match for ${gip.full_name}.`, tone: 'warning' }); return null; }
    }
    return { user: { full_name: get('name'), office_id: Number(get('office')), role_id: registrationRoleId, username: get('username'), email: get('email'), phone: get('phone').replace(/\s+/g, '') || null, password: get('password') }, gips };
};

const setupRegistrationFlow = async () => {
    const [rolesResult, officesResult] = await Promise.all([fetchRoles(), fetchOffices()]);
    const roles = rolesResult.data || [];
    registrationRoleId = Number(roles.find((role) => Number(role.id) === 3)?.id || roles.find((role) => /staff|implementor/i.test(role.name || ''))?.id || 3);
    ['desktop', 'mobile'].forEach((prefix) => {
        initRegisterOfficeDropdown(prefix, officesResult.data || []);
        showRegisterStep(prefix, 0);
        document.getElementById(`${prefix}-register-login-btn`)?.addEventListener('click', () => setAuthViewMode('login'));
        document.getElementById(`${prefix}-register-next-btn`)?.addEventListener('click', () => { const step = registerStepState[prefix] || 0; if (validateRegisterStep(prefix, step)) showRegisterStep(prefix, Math.min(step + 1, 2)); });
        document.getElementById(`${prefix}-register-back-btn`)?.addEventListener('click', () => showRegisterStep(prefix, Math.max((registerStepState[prefix] || 0) - 1, 0)));
        document.getElementById(`${prefix}-register-add-gip-btn`)?.addEventListener('click', () => addRegisterGip(prefix));
        document.getElementById(`${prefix}-register-form`)?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const payload = collectRegisterPayload(prefix);
            if (!payload) return;
            const submit = document.getElementById(`${prefix}-register-submit-btn`);
            if (submit) { submit.disabled = true; submit.textContent = 'Submitting...'; }
            const result = await registerPendingUser(payload.user);
            if (result.error) {
                if (result.field) setRegisterFieldError(prefix, result.field, result.error);
                else showAuthStatusModal({ title: 'Registration failed', message: result.error, tone: 'danger' });
                if (submit) { submit.disabled = false; submit.textContent = 'Submit Registration'; }
                return;
            }
            for (const gip of payload.gips) {
                const { confirm, ...gipPayload } = gip;
                const gipResult = await createGip({ ...gipPayload, created_by: result.data.id, status: 'offline' });
                if (gipResult.error) showAuthStatusModal({ title: 'Registration partially saved', message: gipResult.error, tone: 'warning' });
            }
            event.target.reset();
            document.getElementById(`${prefix}-register-gips-form-container`).innerHTML = '';
            registerOfficeDropdowns[prefix]?.reset();
            updateRegisterGipState(prefix);
            showRegisterStep(prefix, 0);
            setAuthViewMode('login');
            showAuthStatusModal({ title: 'Registration submitted', message: 'Your registration request is now pending approval. Please wait for HR or a portal administrator to approve your account before logging in.', tone: 'success' });
            if (submit) { submit.disabled = false; submit.textContent = 'Submit Registration'; }
        });
        updateRegisterGipState(prefix);
    });
};
/* END REGISTRATION FLOW */
/* START SETUP LOGIN FORMS - Validates input, logs in, saves session, and routes by role */
const setupLoginForms = () => {
    const bindForm = (prefix) => {
        const form = getFormByPrefix(prefix);
        if (!form || form.dataset.authSubmitBound) return;
        form.dataset.authSubmitBound = 'true';
        form.dataset.authMode = form.dataset.authMode || 'username';
        setupInputErrorReset(prefix);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearFormErrors(prefix);

            const mode = getCurrentMode(prefix);
            const identityWrapper = document.getElementById(`${prefix}-username-wrapper`);
            const credentialWrapper = document.getElementById(`${prefix}-password-wrapper`);
            const identityValue = document.getElementById(`${prefix}-username`)?.value.trim() || '';
            const credentialValue = mode === 'phone'
                ? (document.getElementById(`${prefix}-pin`)?.value.trim() || '')
                : (document.getElementById(`${prefix}-password`)?.value || '');

            let hasError = false;
            if (!identityValue) {
                setFieldError(identityWrapper, mode === 'email' ? 'Email is required.' : mode === 'phone' ? 'Phone number is required.' : 'Username is required.');
                hasError = true;
            }
            if (!credentialValue) {
                setFieldError(credentialWrapper, mode === 'phone' ? 'PIN is required.' : 'Password is required.');
                hasError = true;
            }
            if (mode === 'phone' && identityValue.length !== 10) {
                setFieldError(identityWrapper, 'Enter a valid 10-digit phone number.');
                hasError = true;
            }
            if (mode === 'phone' && !isHashedCredential(credentialValue) && credentialValue.length !== 4) {
                setFieldError(credentialWrapper, 'Enter your 4-digit PIN.');
                hasError = true;
            }
            if (hasError) return;

            setLoading(form, true);
            try {
                const result = mode === 'email'
                    ? await loginWithEmail(identityValue, credentialValue)
                    : mode === 'phone'
                        ? await loginWithPhone(identityValue, credentialValue)
                        : await loginWithUsername(identityValue, credentialValue);

                if (result.error) {
                    if (result.code === 'approval_pending') {
                        showAuthStatusModal({ title: 'Account pending approval', message: result.error, tone: 'warning' });
                        return;
                    }
                    if (result.code === 'approval_declined') {
                        showAuthStatusModal({ title: 'Account request declined', message: result.error, tone: 'danger' });
                        return;
                    }
                    setFieldError(result.field === 'credential' ? credentialWrapper : identityWrapper, result.error);
                    return;
                }

                const rememberInput = document.getElementById(`${prefix}-remember`);
                if (rememberInput?.checked) {
                    setRememberedLogin({
                        mode,
                        identifier: identityValue,
                        credential: credentialValue
                    });
                } else {
                    clearRememberedLogin();
                }

                saveSession(result.data);
                window.location.href = getDashboardRoute(result.data);
            } catch (error) {
                if (window.DEBUG) window.DEBUG.error('AUTH', 'Login request failed', error);
                setFieldError(credentialWrapper, 'Login failed. Please check your connection and try again.');
            } finally {
                setLoading(form, false);
            }
        });
    };

    bindForm('desktop');
    bindForm('mobile');
};
/* END SETUP LOGIN FORMS */

/* START INITIALIZE AUTH - Boots route guard, login fields, register transition, and submit handlers */
const initializeAuth = async () => {
    renderRegistrationShell();
    setupDesktopPanelMotion();
    setupRouteGuard();
    setupPasswordToggle();
    setupAuthMethodSwitcher();
    applyRememberedLogin();
    setupLoginForms();
    document.getElementById('hero-register-btn')?.addEventListener('click', () => {
        const nextMode = authViewMode === 'login' ? 'register' : 'login';
        setAuthViewMode(nextMode);
        if (nextMode === 'register' && window.innerWidth < 1024) document.getElementById('show-login-drawer')?.click();
    });
    await setupRegistrationFlow();
    setAuthViewMode('login');
    window.addEventListener('resize', () => setAuthViewMode(authViewMode));
};
/* END INITIALIZE AUTH */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuth);
} else {
    initializeAuth();
}
