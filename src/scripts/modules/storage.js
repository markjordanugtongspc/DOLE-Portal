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
    setRememberedLogin({ mode, identifier }) {
        writeValue(REMEMBERED_LOGIN_KEY, JSON.stringify({
            mode: mode || 'username',
            identifier: identifier || ''
        }));
    },

    getRememberedLogin() {
        try {
            const raw = readValue(REMEMBERED_LOGIN_KEY);
            if (!raw) return null;
            const rememberedLogin = JSON.parse(raw);
            if (!rememberedLogin?.identifier) {
                removeValue(REMEMBERED_LOGIN_KEY);
                return null;
            }
            // Remove credentials left by the previous insecure Remember Me implementation.
            if (Object.hasOwn(rememberedLogin, 'credential')) {
                const safeLogin = { mode: rememberedLogin.mode || 'username', identifier: rememberedLogin.identifier };
                writeValue(REMEMBERED_LOGIN_KEY, JSON.stringify(safeLogin));
                return safeLogin;
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
    },

    setUserSession(user) {
        try {
            if (user) {
                const raw = JSON.stringify(user);
                sessionStorage.setItem('portal_user', raw);
                localStorage.setItem('portal_user_backup', raw);
            } else {
                sessionStorage.removeItem('portal_user');
                localStorage.removeItem('portal_user_backup');
            }
        } catch (error) {
            console.error('Error saving user session to storage:', error);
        }
    },

    getUserSession() {
        try {
            const rawSession = sessionStorage.getItem('portal_user');
            if (rawSession) return JSON.parse(rawSession);
            const rawBackup = localStorage.getItem('portal_user_backup');
            if (rawBackup) return JSON.parse(rawBackup);
            return null;
        } catch (error) {
            return null;
        }
    },

    clearUserSession() {
        try {
            sessionStorage.removeItem('portal_user');
            localStorage.removeItem('portal_user_backup');
        } catch (error) {
            console.error('Error clearing user session from storage:', error);
        }
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

/* START USER ADD-MODAL DRAFT STORAGE */
const USER_ADD_DRAFT_TTL_MS = 25 * 60 * 1000;

const createTtlDraftStorage = (key) => ({
    saveDraft(data) {
        try {
            writeValue(key, JSON.stringify({ data, expiresAt: Date.now() + USER_ADD_DRAFT_TTL_MS }));
        } catch (error) {
            console.error('Error saving user add-modal draft:', error);
        }
    },

    getDraft() {
        try {
            const raw = readValue(key);
            if (!raw) return null;
            const payload = JSON.parse(raw);
            if (!payload?.expiresAt || Date.now() > payload.expiresAt) {
                removeValue(key);
                return null;
            }
            return payload.data || null;
        } catch {
            removeValue(key);
            return null;
        }
    },

    clearDraft() {
        removeValue(key);
    }
});

export const staffAddDraftStorage = createTtlDraftStorage('dole_staff_add_draft');
export const assistantAddDraftStorage = createTtlDraftStorage('dole_assistant_add_draft');
/* END USER ADD-MODAL DRAFT STORAGE */
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

/* START OCR IMAGE INDEXEDDB STORAGE */
const OCR_DB_NAME = 'dole_ocr_db';
const OCR_DB_VERSION = 1;
const OCR_STORE_NAME = 'ocr_images';

const openOcrDatabase = () => {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            return reject(new Error('IndexedDB is not supported in this browser.'));
        }

        const request = indexedDB.open(OCR_DB_NAME, OCR_DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(OCR_STORE_NAME)) {
                const store = db.createObjectStore(OCR_STORE_NAME, { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('status', 'status', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject(event.target.error || new Error('Failed to open OCR IndexedDB'));
        };
    });
};

export const ocrImageStorage = {
    async saveImage(item) {
        if (!item || !item.id) throw new Error('Invalid image item with missing id.');
        const db = await openOcrDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OCR_STORE_NAME, 'readwrite');
            const store = tx.objectStore(OCR_STORE_NAME);
            const req = store.put(item);
            req.onsuccess = () => resolve(item);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async saveImages(items = []) {
        if (!Array.isArray(items) || items.length === 0) return [];
        const db = await openOcrDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OCR_STORE_NAME, 'readwrite');
            const store = tx.objectStore(OCR_STORE_NAME);
            items.forEach(item => {
                store.put(item);
            });
            tx.oncomplete = () => resolve(items);
            tx.onerror = (e) => reject(e.target.error);
        });
    },

    async getAllImages() {
        const db = await openOcrDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OCR_STORE_NAME, 'readonly');
            const store = tx.objectStore(OCR_STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => {
                const results = req.result || [];
                results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                resolve(results);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async getImageById(id) {
        if (!id) return null;
        const db = await openOcrDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OCR_STORE_NAME, 'readonly');
            const store = tx.objectStore(OCR_STORE_NAME);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async updateImageOcr(id, updates = {}) {
        if (!id) return null;
        const existing = await this.getImageById(id);
        if (!existing) return null;

        const updated = {
            ...existing,
            ...updates,
            updatedAt: Date.now()
        };

        return await this.saveImage(updated);
    },

    async deleteImage(id) {
        if (!id) return;
        const db = await openOcrDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OCR_STORE_NAME, 'readwrite');
            const store = tx.objectStore(OCR_STORE_NAME);
            const req = store.delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async countImages() {
        const db = await openOcrDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OCR_STORE_NAME, 'readonly');
            const store = tx.objectStore(OCR_STORE_NAME);
            const req = store.count();
            req.onsuccess = () => resolve(req.result || 0);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async clearAllImages() {
        const db = await openOcrDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(OCR_STORE_NAME, 'readwrite');
            const store = tx.objectStore(OCR_STORE_NAME);
            const req = store.clear();
            req.onsuccess = () => resolve(true);
            req.onerror = (e) => reject(e.target.error);
        });
    }
};
/* END OCR IMAGE INDEXEDDB STORAGE */

export const appStorage = {
    auth: authStorage,
    preferences: preferencesStorage,
    articleDraft: articleDraftStorage,
    staffAddDraft: staffAddDraftStorage,
    assistantAddDraft: assistantAddDraftStorage,
    ticketCache: ticketCacheStorage,
    ocrImages: ocrImageStorage
};

export const setPreference = (...args) => preferencesStorage.set(...args);
export const getPreference = (...args) => preferencesStorage.get(...args);
export const setRememberedLogin = (...args) => authStorage.setRememberedLogin(...args);
export const getRememberedLogin = (...args) => authStorage.getRememberedLogin(...args);
export const clearRememberedLogin = (...args) => authStorage.clearRememberedLogin(...args);