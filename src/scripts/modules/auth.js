/* START PASSWORD VISIBILITY TOGGLE FUNCTIONALITY */
const setupPasswordToggle = () => {
    if (window.DEBUG) {
        window.DEBUG.log('AUTH', 'Initializing password togglers...');
    }

    const openEyeSvg = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0Z" /></svg>`;
    const slashedEyeSvg = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>`;

    const bindToggle = (inputSelector, toggleSelector) => {
        const inputEl = document.getElementById(inputSelector);
        const toggleBtn = document.getElementById(toggleSelector);

        if (inputEl && toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (window.DEBUG) {
                    window.DEBUG.log('AUTH', `Toggling visibility for: ${inputSelector}`);
                }
                if (inputEl.type === 'password') {
                    inputEl.type = 'text';
                    toggleBtn.innerHTML = openEyeSvg;
                } else {
                    inputEl.type = 'password';
                    toggleBtn.innerHTML = slashedEyeSvg;
                }
            });
            if (window.DEBUG) {
                window.DEBUG.success('AUTH', `Successfully bound visibility toggles for: ${inputSelector}`);
            }
        }
    };

    // Bind both desktop and mobile toggle triggers
    bindToggle('desktop-password', 'desktop-password-toggle');
    bindToggle('mobile-password', 'mobile-password-toggle');
};

// Password toggle setup completed.


/* START AUTH METHOD SWITCHER FUNCTIONALITY */
const setupAuthMethodSwitcher = () => {
    if (window.DEBUG) {
        window.DEBUG.log('AUTH', 'Initializing auth method switcher...');
    }

    const SVG_EMAIL = `<svg class="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path></svg>`;
    const SVG_PHONE = `<svg class="w-4 h-4 mr-2 text-violet-600 dark:text-violet-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>`;
    const SVG_USER = `<svg class="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path></svg>`;

    const originalPasswordHTML = {
        desktop: '',
        mobile: ''
    };

    const desktopPasswordEl = document.getElementById('desktop-password-wrapper');
    if (desktopPasswordEl) {
        originalPasswordHTML.desktop = desktopPasswordEl.innerHTML;
    }
    const mobilePasswordEl = document.getElementById('mobile-password-wrapper');
    if (mobilePasswordEl) {
        originalPasswordHTML.mobile = mobilePasswordEl.innerHTML;
    }

    const switchMode = (prefix, mode) => {
        if (window.DEBUG) {
            window.DEBUG.log('AUTH', `Switching ${prefix} to ${mode} mode`);
        }

        const usernameWrapper = document.getElementById(`${prefix}-username-wrapper`);
        const passwordWrapper = document.getElementById(`${prefix}-password-wrapper`);
        const methodsContainer = document.getElementById(`${prefix}-methods-container`);
        const isMobile = prefix === 'mobile';
        const roundedClass = isMobile ? 'rounded-xl' : 'rounded-lg';
        const roundedLeftClass = isMobile ? 'rounded-l-xl' : 'rounded-l-lg';
        const roundedRightClass = isMobile ? 'rounded-r-xl' : 'rounded-r-lg';

        if (!usernameWrapper || !passwordWrapper || !methodsContainer) return;

        // 1. Update Username/Email/Phone inputs & labels
        if (mode === 'phone') {
            usernameWrapper.innerHTML = `
                <label for="${prefix}-username" class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Phone</label>
                <div class="flex items-center">
                    <span class="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-2.5 text-sm font-bold ${roundedLeftClass} border-r-0 select-none">+63</span>
                    <input type="tel" id="${prefix}-username" name="phone" class="bg-gray-50 border border-gray-300 text-gray-900 ${roundedRightClass} rounded-l-none focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-400 dark:text-white text-sm transition-colors" placeholder="9123456789" required>
                </div>
            `;
            // Attach restriction listeners for Phone
            const inputEl = document.getElementById(`${prefix}-username`);
            if (inputEl) {
                inputEl.addEventListener('input', (e) => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length > 0 && val[0] !== '9') {
                        val = '9' + val.substring(1);
                    }
                    if (val.length > 10) {
                        val = val.slice(0, 10);
                    }
                    e.target.value = val;
                });
            }

            // Replace password field with a 4-digit PIN input field
            passwordWrapper.innerHTML = `
                <div class="flex justify-between items-center mb-1.5">
                    <label for="${prefix}-pin" class="block text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">PIN</label>
                </div>
                <input type="text" id="${prefix}-pin" name="pin" class="bg-gray-50 border border-gray-300 text-gray-900 ${roundedClass} focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-400 dark:text-white text-sm transition-colors text-center tracking-[1em] font-mono font-bold" placeholder="1234" required>
            `;
            passwordWrapper.classList.remove('hidden');

            // Attach restriction listeners for PIN
            const pinEl = document.getElementById(`${prefix}-pin`);
            if (pinEl) {
                pinEl.addEventListener('input', (e) => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length > 4) {
                        val = val.slice(0, 4);
                    }
                    e.target.value = val;
                });
            }
        } else if (mode === 'email') {
            usernameWrapper.innerHTML = `
                <label for="${prefix}-username" class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Email</label>
                <input type="email" id="${prefix}-username" name="email" class="bg-gray-50 border border-gray-300 text-gray-900 ${roundedClass} focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-400 dark:text-white text-sm transition-colors" placeholder="name@domain.com" required>
            `;
            passwordWrapper.classList.add('hidden');
        } else {
            // Default Username Mode
            usernameWrapper.innerHTML = `
                <label for="${prefix}-username" class="block mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-500 uppercase tracking-wide">Username</label>
                <input type="text" id="${prefix}-username" name="username" class="bg-gray-50 border border-gray-300 text-gray-900 ${roundedClass} focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-400 dark:text-white text-sm transition-colors" placeholder="Enter your username" required>
            `;
            // Restore password HTML
            if (originalPasswordHTML[prefix]) {
                passwordWrapper.innerHTML = originalPasswordHTML[prefix];
            }
            passwordWrapper.classList.remove('hidden');
            setupPasswordToggle(); // Rebind password visibility toggles
        }

        // 2. Update Social / alternative buttons layout
        methodsContainer.innerHTML = '';
        if (mode === 'username') {
            methodsContainer.appendChild(createButton(`${prefix}-email-btn`, SVG_EMAIL, 'Email', roundedClass, () => switchMode(prefix, 'email')));
            methodsContainer.appendChild(createButton(`${prefix}-phone-btn`, SVG_PHONE, 'Phone', roundedClass, () => switchMode(prefix, 'phone')));
        } else if (mode === 'email') {
            methodsContainer.appendChild(createButton(`${prefix}-username-btn`, SVG_USER, 'Username', roundedClass, () => switchMode(prefix, 'username')));
            methodsContainer.appendChild(createButton(`${prefix}-phone-btn`, SVG_PHONE, 'Phone', roundedClass, () => switchMode(prefix, 'phone')));
        } else if (mode === 'phone') {
            methodsContainer.appendChild(createButton(`${prefix}-username-btn`, SVG_USER, 'Username', roundedClass, () => switchMode(prefix, 'username')));
            methodsContainer.appendChild(createButton(`${prefix}-email-btn`, SVG_EMAIL, 'Email', roundedClass, () => switchMode(prefix, 'email')));
        }
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

    // Bind initial buttons
    const desktopEmailBtn = document.getElementById('desktop-email-btn');
    const desktopPhoneBtn = document.getElementById('desktop-phone-btn');
    if (desktopEmailBtn) {
        desktopEmailBtn.addEventListener('click', () => switchMode('desktop', 'email'));
    }
    if (desktopPhoneBtn) {
        desktopPhoneBtn.addEventListener('click', () => switchMode('desktop', 'phone'));
    }

    const mobileEmailBtn = document.getElementById('mobile-email-btn');
    const mobilePhoneBtn = document.getElementById('mobile-phone-btn');
    if (mobileEmailBtn) {
        mobileEmailBtn.addEventListener('click', () => switchMode('mobile', 'email'));
    }
    if (mobilePhoneBtn) {
        mobilePhoneBtn.addEventListener('click', () => switchMode('mobile', 'phone'));
    }
};
/* END AUTH METHOD SWITCHER FUNCTIONALITY */

// Execute initialization once everything is defined
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupPasswordToggle();
        setupAuthMethodSwitcher();
    });
} else {
    setupPasswordToggle();
    setupAuthMethodSwitcher();
}
