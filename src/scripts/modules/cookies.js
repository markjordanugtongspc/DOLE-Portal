/**
 * Cookies Module
 * Handles saving and retrieving user preferences from localStorage.
 */

export const setPreference = (key, value) => {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        console.error('Error saving preference:', error);
    }
};

export const getPreference = (key, defaultValue = null) => {
    try {
        const item = localStorage.getItem(key);
        return item !== null ? item : defaultValue;
    } catch (error) {
        console.error('Error retrieving preference:', error);
        return defaultValue;
    }
};
const REMEMBERED_LOGIN_KEY = 'dole_remembered_login';

export const setRememberedLogin = ({ mode, identifier, credentialHash }) => {
    try {
        localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify({
            mode: mode || 'username',
            identifier: identifier || '',
            credentialHash: credentialHash || ''
        }));
    } catch (error) {
        console.error('Error saving remembered login:', error);
    }
};

export const getRememberedLogin = () => {
    try {
        const raw = localStorage.getItem(REMEMBERED_LOGIN_KEY);
        if (!raw) return null;

        const rememberedLogin = JSON.parse(raw);
        if (!rememberedLogin?.identifier || !rememberedLogin?.credentialHash) {
            localStorage.removeItem(REMEMBERED_LOGIN_KEY);
            return null;
        }

        return rememberedLogin;
    } catch (error) {
        localStorage.removeItem(REMEMBERED_LOGIN_KEY);
        console.error('Error retrieving remembered login:', error);
        return null;
    }
};

export const clearRememberedLogin = () => {
    try {
        localStorage.removeItem(REMEMBERED_LOGIN_KEY);
    } catch (error) {
        console.error('Error clearing remembered login:', error);
    }
};