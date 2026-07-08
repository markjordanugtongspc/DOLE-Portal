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
