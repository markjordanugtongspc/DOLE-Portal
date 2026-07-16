import { Modal } from 'flowbite';
import {
    getCurrentUser,
    isHashedCredential,
    loginWithEmail,
    loginWithPhone,
    loginWithUsername,
    saveSession
} from '@/backend/api/auth.api.js';
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
    admin: [1, 2],
    staff: [3, 4]
};

const ERROR_TEXT_CLASS = 'mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400';
const ERROR_INPUT_CLASSES = ['border-red-400', 'focus:border-red-500', 'focus:ring-red-500', 'dark:border-red-500'];
const DEFAULT_INPUT_CLASSES = ['border-gray-300', 'focus:border-blue-500', 'focus:ring-blue-500', 'dark:border-gray-700'];

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
        document.documentElement.classList.add('overflow-hidden');
        document.body?.classList.add('hidden');
        redirectToIndexWithNotice();
        return;
    }

    const requiredRole = getRequiredRole();
    const userRole = getRoleGroup(user.role_id);
    if (requiredRole && userRole !== requiredRole) {
        const redirectRoute = getDashboardRoute(user);
        showAuthNotice({
            title: 'Access denied',
            message: 'Your account does not have permission to open that page. Redirecting you to your dashboard.',
            autoCloseMs: 3000,
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

/* START INITIALIZE AUTH - Boots route guard, login fields, and submit handlers */
const initializeAuth = () => {
    setupRouteGuard();
    setupPasswordToggle();
    setupAuthMethodSwitcher();
    applyRememberedLogin();
    setupLoginForms();
};
/* END INITIALIZE AUTH */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuth);
} else {
    initializeAuth();
}