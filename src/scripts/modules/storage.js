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

/* === ARTICLE DRAFT STORAGE (25-MINUTE TTL) === */
const ARTICLE_DRAFT_KEY = 'dole_article_draft';
const DRAFT_TTL_MS = 25 * 60 * 1000; // 25 minutes

export const articleDraftStorage = {
    saveDraft(draftData) {
        try {
            const payload = {
                data: draftData,
                expiresAt: Date.now() + DRAFT_TTL_MS
            };
            writeValue(ARTICLE_DRAFT_KEY, JSON.stringify(payload));
        } catch (err) {
            console.error('Error saving article draft:', err);
        }
    },

    getDraft() {
        try {
            const raw = readValue(ARTICLE_DRAFT_KEY);
            if (!raw) return null;

            const payload = JSON.parse(raw);
            if (!payload || !payload.expiresAt || Date.now() > payload.expiresAt) {
                removeValue(ARTICLE_DRAFT_KEY);
                return null;
            }

            return payload.data;
        } catch (err) {
            removeValue(ARTICLE_DRAFT_KEY);
            return null;
        }
    },

    clearDraft() {
        removeValue(ARTICLE_DRAFT_KEY);
    }
};

export const saveArticleDraft = (draft) => articleDraftStorage.saveDraft(draft);
export const getArticleDraft = () => articleDraftStorage.getDraft();
export const clearArticleDraft = () => articleDraftStorage.clearDraft();
/* === END ARTICLE DRAFT STORAGE === */

/* === TICKET CONVERSATION CACHE STORAGE === */
const TICKET_MESSAGES_KEY_PREFIX = 'dole_ticket_msgs_';

const cleanDataUrlsFromMessages = (messages = []) => {
    if (!Array.isArray(messages)) return [];
    return messages.slice(-50).map(msg => {
        const copy = { ...msg };
        delete copy._raw;
        if (copy.imageUrl && copy.imageUrl.startsWith('data:')) {
            delete copy.imageUrl;
        }
        if (Array.isArray(copy.images)) {
            copy.images = copy.images.filter(img => !img.startsWith('data:'));
        }
        return copy;
    });
};

const purgeOldTicketCaches = (exceptKey) => {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(TICKET_MESSAGES_KEY_PREFIX) && k !== exceptKey) {
                keysToRemove.push(k);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
};

export const ticketCacheStorage = {
    saveMessages(ticketDbId, messages) {
        if (!ticketDbId) return;
        try {
            const sanitized = cleanDataUrlsFromMessages(messages);
            const key = `${TICKET_MESSAGES_KEY_PREFIX}${ticketDbId}`;
            const payload = JSON.stringify({
                messages: sanitized,
                cachedAt: Date.now()
            });

            try {
                localStorage.setItem(key, payload);
            } catch (quotaErr) {
                purgeOldTicketCaches(key);
                try {
                    localStorage.setItem(key, payload);
                } catch {
                    // Fail silently without throwing QuotaExceededError
                }
            }
        } catch (err) {
            // Silence storage errors
        }
    },

    getMessages(ticketDbId) {
        if (!ticketDbId) return null;
        try {
            const raw = readValue(`${TICKET_MESSAGES_KEY_PREFIX}${ticketDbId}`);
            if (!raw) return null;
            const payload = JSON.parse(raw);
            return payload?.messages || null;
        } catch (err) {
            return null;
        }
    },

    clearMessages(ticketDbId) {
        if (ticketDbId) {
            removeValue(`${TICKET_MESSAGES_KEY_PREFIX}${ticketDbId}`);
        }
    }
};

export const appStorage = {
    auth: authStorage,
    preferences: preferencesStorage,
    articleDraft: articleDraftStorage,
    ticketCache: ticketCacheStorage
};

export const setPreference = (...args) => preferencesStorage.set(...args);
export const getPreference = (...args) => preferencesStorage.get(...args);
export const setRememberedLogin = (...args) => authStorage.setRememberedLogin(...args);
export const getRememberedLogin = (...args) => authStorage.getRememberedLogin(...args);
export const clearRememberedLogin = (...args) => authStorage.clearRememberedLogin(...args);