/**
 * DOLE Iligan Portal — Ticket Messages API
 * CRUD for ticket conversation messages (chat view in ticket-support.js).
 *
 * Message types: text | image | file | gallery | link
 * Each type uses the `metadata` JSONB column for type-specific payload.
 */

import { supabase } from './supabase.js';

/**
 * Fetch all messages for a given ticket, ordered oldest → newest (chat order).
 * @param {number} ticketId
 * @returns {{ data: Array, error: string|null }}
 */
export async function fetchMessages(ticketId) {
    const runQuery = () => supabase
        .from('ticket_messages')
        .select(`
            id,
            ticket_id,
            sender_id,
            sender_name,
            sender_type,
            message_type,
            content,
            metadata,
            is_read,
            created_at
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

    let { data, error } = await runQuery();

    if (error && /failed to fetch/i.test(error.message || '')) {
        await new Promise(resolve => setTimeout(resolve, 450));
        ({ data, error } = await runQuery());
    }

    if (error) {
        if (window.DEBUG) window.DEBUG.error('MESSAGES-API', `Fetch messages for ticket ${ticketId} failed`, error.message);
        return { data: [], error: error.message };
    }
    return { data: data || [], error: null };
}

/**
 * Send a text message.
 * @param {number} ticketId
 * @param {number|null} senderId
 * @param {string} senderName
 * @param {'staff'|'gip'|'admin'|'system'} senderType
 * @param {string} content
 * @returns {{ data: object|null, error: string|null }}
 */
export async function sendTextMessage(ticketId, senderId, senderName, senderType, content) {
    return _insertMessage({
        ticket_id:    ticketId,
        sender_id:    senderId,
        sender_name:  senderName,
        sender_type:  senderType,
        message_type: 'text',
        content,
        metadata:     null,
        is_read:      false,
    });
}

/**
 * Send a link embed message.
 * @param {number} ticketId
 * @param {number|null} senderId
 * @param {string} senderName
 * @param {'staff'|'gip'|'admin'|'system'} senderType
 * @param {string} content      — Display text
 * @param {object} linkMeta     — { url, preview_title, preview_image, domain }
 * @returns {{ data: object|null, error: string|null }}
 */
export async function sendLinkMessage(ticketId, senderId, senderName, senderType, content, linkMeta) {
    return _insertMessage({
        ticket_id:    ticketId,
        sender_id:    senderId,
        sender_name:  senderName,
        sender_type:  senderType,
        message_type: 'link',
        content,
        metadata:     linkMeta,
        is_read:      false,
    });
}

const STORAGE_BUCKET = import.meta.env?.VITE_SUPABASE_STORAGE_BUCKET || 'system-images';

/**
 * Upload an attachment file for a ticket message to Supabase Storage.
 * @param {File} file - Attachment file to upload
 * @returns {Promise<{ url: string|null, error: string|null }>}
 */
export async function uploadChatAttachment(file) {
    if (!file) return { url: null, error: 'No file provided' };

    try {
        const ext = file.name.split('.').pop().toLowerCase();
        const filePath = `chat-attachments/chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true,
                contentType: file.type || 'application/octet-stream',
            });

        if (uploadError) {
            if (window.DEBUG) window.DEBUG.warn('MESSAGES-API', 'Attachment storage upload failed, falling back to data URL', uploadError.message);
            return { url: null, error: uploadError.message };
        }

        const { data } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

        if (window.DEBUG) window.DEBUG.success('MESSAGES-API', `Attachment uploaded to storage: ${data.publicUrl}`);
        return { url: data.publicUrl, error: null };
    } catch (err) {
        if (window.DEBUG) window.DEBUG.error('MESSAGES-API', 'Attachment storage upload exception', err.message);
        return { url: null, error: err.message };
    }
}

/**
 * Send a file attachment message.
 * @param {number} ticketId
 * @param {number|null} senderId
 * @param {string} senderName
 * @param {'staff'|'gip'|'admin'|'system'} senderType
 * @param {object} fileMeta     — { file_name, file_size, file_pages?, file_url? }
 * @param {string|null} content — Optional text content accompanying attachment
 * @returns {{ data: object|null, error: string|null }}
 */
export async function sendFileMessage(ticketId, senderId, senderName, senderType, fileMeta, content = null) {
    return _insertMessage({
        ticket_id:    ticketId,
        sender_id:    senderId,
        sender_name:  senderName,
        sender_type:  senderType,
        message_type: 'file',
        content:      content || null,
        metadata:     fileMeta,
        is_read:      false,
    });
}

/**
 * Send an image message.
 * @param {number} ticketId
 * @param {number|null} senderId
 * @param {string} senderName
 * @param {'staff'|'gip'|'admin'|'system'} senderType
 * @param {string} imageUrl
 * @param {string|null} content — Optional text content accompanying image
 * @returns {{ data: object|null, error: string|null }}
 */
export async function sendImageMessage(ticketId, senderId, senderName, senderType, imageUrl, content = null) {
    return _insertMessage({
        ticket_id:    ticketId,
        sender_id:    senderId,
        sender_name:  senderName,
        sender_type:  senderType,
        message_type: 'image',
        content:      content || null,
        metadata:     { image_url: imageUrl },
        is_read:      false,
    });
}

/**
 * Mark all unread messages in a ticket as read.
 * Called when admin opens a ticket.
 * @param {number} ticketId
 * @returns {{ error: string|null }}
 */
export async function markMessagesRead(ticketId) {
    const { error } = await supabase
        .from('ticket_messages')
        .update({ is_read: true })
        .eq('ticket_id', ticketId)
        .neq('sender_type', 'admin')
        .eq('is_read', false);

    if (error) return { error: error.message };
    return { error: null };
}

/**
 * Mark all unread admin messages in a ticket as read.
 * Called when staff opens a ticket.
 * @param {number} ticketId
 * @returns {{ error: string|null }}
 */
export async function markAdminMessagesRead(ticketId) {
    const { error } = await supabase
        .from('ticket_messages')
        .update({ is_read: true })
        .eq('ticket_id', ticketId)
        .eq('sender_type', 'admin')
        .eq('is_read', false);

    if (error) return { error: error.message };
    return { error: null };
}

/**
 * Count unread messages for a ticket (from staff/gip senders).
 * @param {number} ticketId
 * @returns {number}
 */
export async function countUnreadMessages(ticketId) {
    const { count, error } = await supabase
        .from('ticket_messages')
        .select('*', { count: 'exact', head: true })
        .eq('ticket_id', ticketId)
        .eq('is_read', false)
        .neq('sender_type', 'admin');

    if (error) return 0;
    return count || 0;
}

// ─── Internal Helper ───────────────────────────────────────────────────────────

async function _insertMessage(payload) {
    const { data, error } = await supabase
        .from('ticket_messages')
        .insert([payload])
        .select()
        .single();

    if (error) {
        if (window.DEBUG) window.DEBUG.error('MESSAGES-API', 'Send message failed', error.message);
        return { data: null, error: error.message };
    }

    updateParentTicketAfterMessage(payload).catch((err) => {
        if (window.DEBUG) window.DEBUG.error('MESSAGES-API', 'Parent ticket activity update failed', err?.message || err);
    });

    return { data, error: null };
}

async function updateParentTicketAfterMessage(payload) {
    const ticketUpdate = { last_activity: new Date().toISOString(), updated_at: new Date().toISOString() };

    if (payload.sender_type !== 'admin') {
        const { data: ticket, error: fetchError } = await supabase
            .from('tickets')
            .select('unread_count')
            .eq('id', payload.ticket_id)
            .single();

        if (fetchError) {
            if (window.DEBUG) window.DEBUG.error('MESSAGES-API', 'Unread count lookup failed', fetchError.message);
        } else if (ticket) {
            ticketUpdate.unread_count = (ticket.unread_count || 0) + 1;
        }
    }

    const { error } = await supabase
        .from('tickets')
        .update(ticketUpdate)
        .eq('id', payload.ticket_id);

    if (error) throw new Error(error.message);
}