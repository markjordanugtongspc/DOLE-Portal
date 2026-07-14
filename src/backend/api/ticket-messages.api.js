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
    const { data, error } = await supabase
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
        is_read:      senderType === 'admin', // Admin messages are pre-read
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
        is_read:      senderType === 'admin',
    });
}

/**
 * Send a file attachment message.
 * @param {number} ticketId
 * @param {number|null} senderId
 * @param {string} senderName
 * @param {'staff'|'gip'|'admin'|'system'} senderType
 * @param {object} fileMeta     — { file_name, file_size, file_pages?, file_url? }
 * @returns {{ data: object|null, error: string|null }}
 */
export async function sendFileMessage(ticketId, senderId, senderName, senderType, fileMeta) {
    return _insertMessage({
        ticket_id:    ticketId,
        sender_id:    senderId,
        sender_name:  senderName,
        sender_type:  senderType,
        message_type: 'file',
        content:      null,
        metadata:     fileMeta,
        is_read:      senderType === 'admin',
    });
}

/**
 * Send an image message.
 * @param {number} ticketId
 * @param {number|null} senderId
 * @param {string} senderName
 * @param {'staff'|'gip'|'admin'|'system'} senderType
 * @param {string} imageUrl
 * @returns {{ data: object|null, error: string|null }}
 */
export async function sendImageMessage(ticketId, senderId, senderName, senderType, imageUrl) {
    return _insertMessage({
        ticket_id:    ticketId,
        sender_id:    senderId,
        sender_name:  senderName,
        sender_type:  senderType,
        message_type: 'image',
        content:      null,
        metadata:     { image_url: imageUrl },
        is_read:      senderType === 'admin',
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

    // Update parent ticket last_activity and increment unread for non-admin messages
    const ticketUpdate = { last_activity: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (payload.sender_type !== 'admin') {
        // Increment unread_count using RPC or client-side read-modify-write
        const { data: ticket } = await supabase
            .from('tickets')
            .select('unread_count')
            .eq('id', payload.ticket_id)
            .single();

        if (ticket) {
            ticketUpdate.unread_count = (ticket.unread_count || 0) + 1;
        }
    }

    await supabase.from('tickets').update(ticketUpdate).eq('id', payload.ticket_id);

    return { data, error: null };
}
