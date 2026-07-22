/**
 * DOLE Iligan Portal — Articles API
 * CRUD operations for the kb_articles table.
 */

import { supabase } from './supabase.js';

/**
 * Fetch all knowledge base articles.
 * @returns {Promise<{ data: Array, error: string|null }>}
 */
export async function fetchArticles() {
    const { data, error } = await supabase
        .from('kb_articles')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        if (window.DEBUG) window.DEBUG.error('ARTICLES-API', 'Failed to fetch articles', error.message);
        return { data: [], error: error.message };
    }
    return { data: data || [], error: null };
}

/**
 * Create a new knowledge base article.
 * @param {object} payload - { title, category, summary, read_time, suggest_text }
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function createArticle(payload) {
    const { data, error } = await supabase
        .from('kb_articles')
        .insert([payload])
        .select()
        .single();

    if (error) {
        if (window.DEBUG) window.DEBUG.error('ARTICLES-API', 'Create article failed', error.message);
        return { data: null, error: error.message };
    }
    if (window.DEBUG) window.DEBUG.success('ARTICLES-API', `Article created: "${payload.title}"`);
    return { data, error: null };
}

/**
 * Update an existing knowledge base article.
 * @param {number|string} id - The article ID to update
 * @param {object} payload - Fields to update
 * @returns {Promise<{ data: object|null, error: string|null }>}
 */
export async function fetchArticleById(id) {
    const { data, error } = await supabase
        .from('kb_articles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        if (window.DEBUG) window.DEBUG.error('ARTICLES-API', `Fetch article #${id} failed`, error.message);
        return { data: null, error: error.message };
    }

    return { data, error: null };
}

export async function updateArticle(id, payload) {
    const { data, error } = await supabase
        .from('kb_articles')
        .update(payload)
        .eq('id', id)
        .select('*')
        .maybeSingle();

    if (error) {
        if (window.DEBUG) window.DEBUG.error('ARTICLES-API', `Update article #${id} failed`, error.message);
        return { data: null, error: error.message };
    }

    if (!data) {
        const message = `No article row was updated for id #${id}. Please check Supabase UPDATE/RLS permissions for kb_articles.`;
        if (window.DEBUG) window.DEBUG.error('ARTICLES-API', message, { id, payload });
        return { data: null, error: message };
    }

    if (window.DEBUG) window.DEBUG.success('ARTICLES-API', `Article #${id} updated: "${data.title || payload.title}"`, data);
    return { data, error: null };
}

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'system-images';

/**
 * Upload an image file for a knowledge base article to Supabase Storage.
 * @param {File} file - Image file to upload
 * @returns {Promise<{ url: string|null, error: string|null }>}
 */
export async function uploadArticleImage(file) {
    if (!file) return { url: null, error: 'No file provided' };

    const ext = file.name.split('.').pop().toLowerCase();
    const filePath = `articles/article-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type,
        });

    if (uploadError) {
        if (window.DEBUG) window.DEBUG.error('ARTICLES-API', 'Article image upload failed', uploadError.message);
        return { url: null, error: uploadError.message };
    }

    const { data } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

    if (window.DEBUG) window.DEBUG.success('ARTICLES-API', `Article image uploaded: ${data.publicUrl}`);
    return { url: data.publicUrl, error: null };
}

