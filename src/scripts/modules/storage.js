/**
 * Storage Module
 * Groups browser localStorage responsibilities for auth and preferences.
 */

const REMEMBERED_LOGIN_KEY = 'dole_remembered_login';

const readValue = (key, defaultValue = null) => {
    try {
        const item = localStorage.getItem(key);
        return item !== null ? item : defaultValue;
    } catch (error) {
        console.error('Error retrieving storage value:', error);
        return defaultValue;
    }
};

const writeValue = (key, value) => {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        console.error('Error saving storage value:', error);
    }
};

const removeValue = (key) => {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error('Error clearing storage value:', error);
    }
};

export const preferencesStorage = {
    set(key, value) {
        writeValue(key, value);
    },

    get(key, defaultValue = null) {
        return readValue(key, defaultValue);
    }
};

export const authStorage = {
    setRememberedLogin({ mode, identifier, credential }) {
        writeValue(REMEMBERED_LOGIN_KEY, JSON.stringify({
            mode: mode || 'username',
            identifier: identifier || '',
            credential: credential || ''
        }));
    },

    getRememberedLogin() {
        try {
            const raw = readValue(REMEMBERED_LOGIN_KEY);
            if (!raw) return null;

            const rememberedLogin = JSON.parse(raw);
            if (!rememberedLogin?.identifier || !rememberedLogin?.credential) {
                removeValue(REMEMBERED_LOGIN_KEY);
                return null;
            }

            return rememberedLogin;
        } catch (error) {
            removeValue(REMEMBERED_LOGIN_KEY);
            console.error('Error retrieving remembered login:', error);
            return null;
        }
    },

    clearRememberedLogin() {
        removeValue(REMEMBERED_LOGIN_KEY);
    }
};

export const appStorage = {
    auth: authStorage,
    preferences: preferencesStorage
};

export const setPreference = (...args) => preferencesStorage.set(...args);
export const getPreference = (...args) => preferencesStorage.get(...args);
export const setRememberedLogin = (...args) => authStorage.setRememberedLogin(...args);
export const getRememberedLogin = (...args) => authStorage.getRememberedLogin(...args);
export const clearRememberedLogin = (...args) => authStorage.clearRememberedLogin(...args);