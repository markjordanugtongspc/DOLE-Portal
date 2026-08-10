import { supabase } from './supabase.js';
import { saveSession } from './auth.api.js';

const profileRequest = async (method = 'GET', body = null) => {
    try {
        const response = await fetch('/api/profile', {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { data: null, error: payload.error || 'Unable to load your profile.', field: payload.field };
        return { data: payload.data || null, error: null };
    } catch {
        return { data: null, error: 'Unable to reach the profile service.' };
    }
};

export const fetchCurrentProfile = () => profileRequest('GET');

export const updateCurrentProfile = async (updates) => {
    const result = await profileRequest('PUT', updates);
    if (!result.error && result.data) {
        saveSession(result.data);
        window.dispatchEvent(new CustomEvent('portal:profile-updated', { detail: result.data }));
    }
    return result;
};

export async function uploadUserAvatar(file, userId) {
    if (!file || !userId) return { url: null, error: 'Choose an image first.' };
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type) || file.size > 3 * 1024 * 1024) {
        return { url: null, error: 'Avatar must be PNG, JPG, or WEBP and smaller than 3MB.' };
    }

    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `avatars/${Number(userId)}-${Date.now()}.${extension}`;
    const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'system-images';
    const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (error) return { url: null, error: error.message };
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: data?.publicUrl || null, error: data?.publicUrl ? null : 'Storage did not return a public avatar URL.' };
}