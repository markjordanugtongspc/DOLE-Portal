/**
 * DOLE Iligan Portal — Backend API Barrel Export
 * Import from this file for convenient single-line imports in modules.
 *
 * Usage:
 *   import { loginWithUsername, fetchTickets, createGip } from '@/backend/api/index.js';
 */

// ─── Auth ──────────────────────────────────────────────────────────────────────
export {
    loginWithUsername,
    loginWithEmail,
    loginWithPhone,
    getCurrentUser,
    saveSession,
    logout,
    hashCredential,
} from './auth.api.js';

// ─── Users ─────────────────────────────────────────────────────────────────────
export {
    fetchUsers,
    fetchUserById,
    createUser,
    updateUser,
    archiveUser,
    fetchRoles,
    fetchOffices,
} from './users.api.js';

// ─── GIP Assistants ────────────────────────────────────────────────────────────
export {
    fetchGipsByStaff,
    fetchAllGips,
    countGipsByStaff,
    createGip,
    updateGip,
    archiveGip,
    updateGipStatus,
} from './gips.api.js';

// ─── Tickets ───────────────────────────────────────────────────────────────────
export {
    fetchTickets,
    fetchTicketByNumber,
    createTicket,
    openTicket,
    updateTicket,
    closeTicket,
    archiveTicket,
    fetchTicketCategoryCounts,
    fetchTicketCategories,
} from './tickets.api.js';

// ─── Ticket Messages ───────────────────────────────────────────────────────────
export {
    fetchMessages,
    sendTextMessage,
    sendLinkMessage,
    sendFileMessage,
    sendImageMessage,
    markMessagesRead,
    countUnreadMessages,
} from './ticket-messages.api.js';

// ─── Systems ───────────────────────────────────────────────────────────────────
export {
    fetchSystems,
    fetchSystemById,
    createSystem,
    updateSystem,
    archiveSystem,
    uploadSystemImage,
} from './systems.api.js';

// ─── Supabase Client (raw access when needed) ──────────────────────────────────
export { supabase } from './supabase.js';
