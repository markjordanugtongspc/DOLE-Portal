/* START TICKET SUPPORT APP SYSTEM */

import { supabase } from '@/backend/api/supabase.js';
import {
    fetchTickets,
    fetchTicketsByUser,
    fetchTicketCategoryCounts,
    fetchTicketCategories,
    createTicket,
    openTicket as openTicketApi,
    updateTicket,
    closeTicket as closeTicketApi,
} from '@/backend/api/tickets.api.js';
import {
    fetchMessages,
    sendTextMessage,
    markMessagesRead,
    markAdminMessagesRead,
} from '@/backend/api/ticket-messages.api.js';
import { Modal } from 'flowbite';

// Knowledge Base Articles (static content — not from DB)
const MOCK_KB_ARTICLES = {
    'kb-art-1': {
        title: 'Account Creation and Management',
        category: 'Tutorial',
        readTime: '4 Minutes read',
        summary: 'Instructions on establishing new user directories, allocating staff credentials, and managing security parameters for GIP payroll and portal accounts.',
        suggestText: 'For GIP account creation, please head to the Systems Roster tab, choose "Add Staff", and configure their access group details.'
    },
    'kb-art-2': {
        title: 'Adding Systems & Services',
        category: 'User Guide',
        readTime: '6 Minutes read',
        summary: 'Detailed instructions on linking separate district portals, web applications, and database indexes directly into the DOLE unified portal administration console.',
        suggestText: 'To add a new service portal, register its host domain inside the Systems module, copy the credentials token, and add it to theme-toggler config.'
    },
    'kb-art-3': {
        title: 'Troubleshooting Login Errors',
        category: 'Troubleshooting',
        readTime: '5 Minutes read',
        summary: 'Guide to diagnosing user access tokens, fixing Active Directory syncs, and repairing session failures.',
        suggestText: 'I\'ll need to check the Active Directory sync logs for your session. Can you please wait a moment while I pull up the audit trail?'
    },
    'kb-art-4': {
        title: 'Password Recovery Methods',
        category: 'Tutorial',
        readTime: '3 Minutes read',
        summary: 'Procedures for managing passwords, handling Email OTPs, and executing admin overrides for locked out credentials.',
        suggestText: 'Password reset has been completed through the approved secure reset workflow. Please ask the staff to change it immediately after login via Email OTP.'
    }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const esc = (v = '') => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const avatar = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`;

const fmtDate = (iso) => {
    if (!iso) return 'N/A';
    try {
        return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return iso; }
};

const fmtTime = (iso) => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
};

const timeAgo = (iso) => {
    if (!iso) return 'N/A';
    try {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
        const days = Math.floor(hrs / 24);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } catch { return iso; }
};

// Normalize a DB ticket row to the shape this app uses internally
const normalizeTicket = (row) => ({
    id: row.ticket_number || String(row.id),
    dbId: row.id,
    subject: row.subject || '(No Subject)',
    priority: row.priority || 'Low',
    implementor: row.users?.full_name || row.users?.username || 'Unknown',
    implementorId: row.created_by,
    date: row.created_at ? fmtDate(row.created_at) : 'N/A',
    lastActivity: row.last_activity ? timeAgo(row.last_activity) : 'N/A',
    category: row.ticket_categories?.name || 'Support Requests',
    unreadCount: row.unread_count || 0,
    status: row.status || 'Pending',
    team: row.team || 'Technical Support',
    notes: '',
    tags: Array.isArray(row.tags) ? row.tags : (row.tags ? [row.tags] : ['Question', 'Problem']),
    rawCreatedAt: row.created_at,
    rawLastActivity: row.last_activity,
});

// Normalize a DB message row to the chat bubble shape
const normalizeMessage = (row) => {
    const isAdmin = row.sender_type === 'admin';
    const meta = row.metadata || {};
    let type = row.message_type || 'text';

    return {
        sender: row.sender_name || (isAdmin ? 'Admin' : 'Staff'),
        avatar: isAdmin
            ? `https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff`
            : avatar(row.sender_name),
        time: fmtTime(row.created_at),
        type,
        content: row.content || '',
        // file metadata
        fileName: meta.file_name,
        fileSize: meta.file_size,
        filePages: meta.file_pages,
        // image
        imageUrl: meta.image_url,
        // gallery
        images: meta.images,
        // link
        url: meta.url,
        previewImage: meta.preview_image,
        previewTitle: meta.preview_title,
        previewDomain: meta.domain,
        // raw
        _raw: row,
    };
};

/**
 * TicketSupportApp (Parent Class)
 * Manages high-level state, Supabase data, realtime subscriptions, and component communication.
 */
class TicketSupportApp {
    /* START constructor */
    constructor() {
        if (window.DEBUG) window.DEBUG.log('TICKET-SUPPORT', 'Initializing TicketSupportApp (Supabase mode)...');

        // Read session from localStorage
        try {
            const raw = localStorage.getItem('dole_session');
            this.session = raw ? JSON.parse(raw) : null;
        } catch { this.session = null; }

        const roleId = Number(this.session?.role_id || 0);
        this.isAdmin = roleId === 1 || roleId === 2;
        this.sessionUserId = this.session?.id || null;
        this.sessionUserName = this.session?.full_name || this.session?.username || 'Admin';

        // App state
        this.tickets = [];
        this.selectedCategory = 'All';
        this.searchQuery = '';
        this.priorityFilter = 'All';
        this.dateFilter = 'All';
        this.ticketCategories = [];

        // Chat view state
        this.activeView = 'table';
        this.selectedTicketId = null;
        this.selectedTicketDbId = null;
        this.chatSearchQuery = '';
        this.chatSortDirection = 'newest';
        this.activeDetailsTab = 'details';

        // Realtime channels
        this._ticketsChannel = null;
        this._messagesChannel = null;
        this._globalMessagesChannel = null;

        // Child components
        this.drawer = new CategoryDrawer(this);
        this.table = new TicketTable(this);
    }
    /* END constructor */

    /* START init */
    async init() {
        this.drawer.init();
        this.table.init();
        this.bindChatViewEvents();
        this.initCreateTicketDrawer();

        // Initialize Flowbite Modal for Close Ticket Confirmation
        const modalEl = document.getElementById('close-ticket-modal');
        if (modalEl) {
            this.closeTicketModal = new Modal(modalEl);
            
            // Handle Yes click
            document.getElementById('confirm-close-ticket-btn')?.addEventListener('click', () => {
                this.closeTicketModal.hide();
                this.proceedCloseTicket();
            });

            // Handle data-modal-hide triggers
            document.querySelectorAll('[data-modal-hide="close-ticket-modal"]').forEach(btn => {
                btn.addEventListener('click', () => this.closeTicketModal.hide());
            });
        }

        await this.loadTickets();
        await this.populateFilterDropdowns();
        this._subscribeTickets();

        // Check URL for auto-open ticket
        const urlParams = new URLSearchParams(window.location.search);
        let ticketIdFromUrl = urlParams.get('ticket') || urlParams.get('id');
        if (!ticketIdFromUrl) {
            const rawSearch = decodeURIComponent(window.location.search);
            const match = rawSearch.match(/(TK-\d+|TC-\d+)/i);
            if (match) ticketIdFromUrl = match[1].toUpperCase();
        }
        if (ticketIdFromUrl) {
            const exists = this.tickets.find(t => t.id === ticketIdFromUrl);
            if (exists) {
                this.openTicket(ticketIdFromUrl);
            } else if (!this.isAdmin) {
                this.showStaffConversationView();
            }
        } else if (!this.isAdmin) {
            this.showStaffConversationView();
        }

        if (window.DEBUG) window.DEBUG.success('TICKET-SUPPORT', 'TicketSupportApp fully initialized (Supabase realtime active).');

        // Handle window focus to mark active ticket messages as read
        window.addEventListener('focus', async () => {
            if (this.selectedTicketDbId) {
                if (this.isAdmin) {
                    await markMessagesRead(this.selectedTicketDbId).catch(() => {});
                    await supabase.from('tickets').update({ unread_count: 0 }).eq('id', this.selectedTicketDbId).catch(() => {});
                } else {
                    await markAdminMessagesRead(this.selectedTicketDbId).catch(() => {});
                }
                await this.loadTickets();
            }
        });

        // Cleanup on unload
        window.addEventListener('beforeunload', () => this._cleanup());
    }
    /* END init */

    /* START loadTickets */
    async loadTickets() {
        try {
            let result;
            if (this.isAdmin) {
                result = await fetchTickets();
            } else {
                result = await fetchTicketsByUser(this.sessionUserId);
            }
            if (result.error) {
                if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', 'Failed to load tickets', result.error);
                this.tickets = [];
            } else {
                this.tickets = (result.data || []).map(normalizeTicket);
                
                // For Staff, compute unread messages based on Admin's unread messages
                if (!this.isAdmin && this.tickets.length > 0) {
                    const ticketIds = this.tickets.map(t => t.dbId);
                    const { data: unreadMsgs } = await supabase
                        .from('ticket_messages')
                        .select('ticket_id')
                        .eq('is_read', false)
                        .eq('sender_type', 'admin')
                        .in('ticket_id', ticketIds);

                    const unreadMap = {};
                    (unreadMsgs || []).forEach(msg => {
                        unreadMap[msg.ticket_id] = (unreadMap[msg.ticket_id] || 0) + 1;
                    });

                    this.tickets.forEach(t => {
                        if (t.id === this.selectedTicketId && document.hasFocus()) {
                            t.unreadCount = 0;
                        } else {
                            t.unreadCount = unreadMap[t.dbId] || 0;
                        }
                    });
                } else if (this.isAdmin && this.tickets.length > 0) {
                    // Force open ticket unread count to 0 for admin to avoid race conditions
                    this.tickets.forEach(t => {
                        if (t.id === this.selectedTicketId && document.hasFocus()) {
                            t.unreadCount = 0;
                        }
                    });
                }
            }
            this.table.render();
            this.renderChatSidebar();
            await this._updateBadgeCountsFromApi();

            if (!this.isAdmin && !this.selectedTicketId) {
                this.updateStaffHeader();
                this.renderStaffWelcomeState();
                this.syncStaffComposerState();
            }
        } catch (err) {
            if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', 'loadTickets exception', err);
        }
    }
    /* END loadTickets */

    /* START _subscribeTickets */
    _subscribeTickets() {
        // Unsubscribe any existing channel first
        if (this._ticketsChannel) {
            supabase.removeChannel(this._ticketsChannel);
        }

        const filter = this.isAdmin
            ? { event: '*', schema: 'public', table: 'tickets' }
            : { event: '*', schema: 'public', table: 'tickets', filter: `created_by=eq.${this.sessionUserId}` };

        this._ticketsChannel = supabase
            .channel('ticket-support-tickets')
            .on('postgres_changes', filter, async (payload) => {
                if (window.DEBUG) window.DEBUG.flow('TICKET-SUPPORT', `Tickets realtime: ${payload.eventType}`);
                await this.loadTickets();

                // If the currently open ticket was updated, refresh sidebar + badge
                if (this.selectedTicketId) {
                    const updated = this.tickets.find(t => t.id === this.selectedTicketId);
                    if (updated) {
                        this.renderChatSidebar();
                    }
                }
            })
            .subscribe((status) => {
                if (window.DEBUG) window.DEBUG.flow('TICKET-SUPPORT', `Tickets channel: ${status}`);
            });

        this._globalMessagesChannel = supabase
            .channel('ticket-support-global-messages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_messages' }, async (payload) => {
                if (window.DEBUG) window.DEBUG.flow('TICKET-SUPPORT', `Global message realtime: ${payload.eventType}`);
                await this.loadTickets();
            })
            .subscribe((status) => {
                if (window.DEBUG) window.DEBUG.flow('TICKET-SUPPORT', `Global messages channel: ${status}`);
            });
    }
    /* END _subscribeTickets */

    /* START _subscribeMessages */
    _subscribeMessages(ticketDbId) {
        if (!ticketDbId) return;

        // Prevent disconnecting and reconnecting if already subscribed to this ticket
        if (this._messagesChannel && this._currentMessagesTicketId === ticketDbId) {
            return;
        }

        // Unsubscribe previous message channel if switching tickets
        if (this._messagesChannel) {
            supabase.removeChannel(this._messagesChannel);
            this._messagesChannel = null;
        }

        this._currentMessagesTicketId = ticketDbId;

        this._messagesChannel = supabase
            .channel(`ticket-messages-${ticketDbId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'ticket_messages',
                filter: `ticket_id=eq.${ticketDbId}`,
            }, async (payload) => {
                if (window.DEBUG) window.DEBUG.flow('TICKET-SUPPORT', 'New message realtime', payload.new);
                // Re-render conversation with fresh data
                await this._loadAndRenderConversation(ticketDbId);
            })
            .subscribe((status) => {
                if (window.DEBUG) window.DEBUG.flow('TICKET-SUPPORT', `Messages channel [${ticketDbId}]: ${status}`);
            });
    }
    /* END _subscribeMessages */

    /* START _cleanup */
    _cleanup() {
        if (this._ticketsChannel) supabase.removeChannel(this._ticketsChannel);
        if (this._messagesChannel) supabase.removeChannel(this._messagesChannel);
        if (this._globalMessagesChannel) supabase.removeChannel(this._globalMessagesChannel);
    }
    /* END _cleanup */

    /* START _updateBadgeCountsFromApi */
    async _updateBadgeCountsFromApi() {
        try {
            const counts = {
                'All': this.tickets.filter(t => t.status !== 'Closed').length,
                'Support Requests': this.tickets.filter(t => t.category === 'Support Requests' && t.status !== 'Closed').length,
                'Bug Report': this.tickets.filter(t => t.category === 'Bug Report' && t.status !== 'Closed').length,
                'Feature Request': this.tickets.filter(t => t.category === 'Feature Request' && t.status !== 'Closed').length,
                'Closed Tickets': this.tickets.filter(t => t.status === 'Closed').length,
            };
            this.drawer.renderBadges(counts);
        } catch (err) {
            if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', 'Badge count update failed', err);
        }
    }
    /* END _updateBadgeCountsFromApi */

    /* START populateFilterDropdowns */
    async populateFilterDropdowns() {
        try {
            const { data: cats } = await fetchTicketCategories();
            this.ticketCategories = cats || [];

            const typeSelect = document.getElementById('filter-type');
            if (typeSelect) {
                // Clear existing dynamic options (keep default 'All Types')
                while (typeSelect.options.length > 1) typeSelect.remove(1);
                (cats || []).forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat.name;
                    opt.textContent = cat.name;
                    typeSelect.appendChild(opt);
                });
            }

            const prioritySelect = document.getElementById('filter-priority');
            if (prioritySelect && prioritySelect.options.length <= 1) {
                ['High', 'Medium', 'Low'].forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p;
                    opt.textContent = p;
                    prioritySelect.appendChild(opt);
                });
            }

            const dateSelect = document.getElementById('filter-date');
            if (dateSelect && dateSelect.options.length <= 1) {
                [
                    { label: 'Today', value: 'today' },
                    { label: 'Last 7 Days', value: 'week' },
                    { label: 'This Month', value: 'month' },
                ].forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.value;
                    opt.textContent = d.label;
                    dateSelect.appendChild(opt);
                });
            }
        } catch (err) {
            if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', 'populateFilterDropdowns failed', err);
        }
    }
    /* END populateFilterDropdowns */

    /* START updateBadgeCounts */
    updateBadgeCounts() {
        const counts = {
            'All': this.tickets.filter(t => t.status !== 'Closed').length,
            'Support Requests': this.tickets.filter(t => t.category === 'Support Requests' && t.status !== 'Closed').length,
            'Bug Report': this.tickets.filter(t => t.category === 'Bug Report' && t.status !== 'Closed').length,
            'Feature Request': this.tickets.filter(t => t.category === 'Feature Request' && t.status !== 'Closed').length,
            'Closed Tickets': this.tickets.filter(t => t.status === 'Closed').length,
        };
        this.drawer.renderBadges(counts);
    }
    /* END updateBadgeCounts */

    /* START setCategory */
    setCategory(category, origin = 'drawer') {
        this.selectedCategory = category;

        if (origin === 'drawer') {
            const typeSelect = document.getElementById('filter-type');
            if (typeSelect && typeSelect.value !== category) typeSelect.value = category;
        } else if (origin === 'dropdown') {
            this.drawer.setActiveCategoryUI(category);
        }

        this.table.render();
    }
    /* END setCategory */

    /* START bindChatViewEvents */
    bindChatViewEvents() {
        document.getElementById('btn-back-to-table')?.addEventListener('click', () => this.closeTicket());
        document.getElementById('btn-close-chat')?.addEventListener('click', () => this.handleCloseTicketStatus());
        document.getElementById('btn-create-ticket')?.addEventListener('click', () => this.handleCreateTicket());
        document.getElementById('btn-upload-image')?.addEventListener('click', () => {
            document.getElementById('chat-image-upload')?.click();
        });

        document.getElementById('chat-search-tickets')?.addEventListener('input', (e) => {
            this.chatSearchQuery = e.target.value.toLowerCase().trim();
            this.renderChatSidebar();
        });

        const chatSortSelect = document.getElementById('chat-sort-dropdown');
        if (chatSortSelect) {
            const adjustWidth = () => {
                const tempSpan = document.createElement('span');
                tempSpan.style.visibility = 'hidden';
                tempSpan.style.position = 'absolute';
                tempSpan.style.whiteSpace = 'nowrap';
                tempSpan.style.font = window.getComputedStyle(chatSortSelect).font;
                tempSpan.textContent = chatSortSelect.options[chatSortSelect.selectedIndex]?.text || '';
                document.body.appendChild(tempSpan);
                const width = tempSpan.getBoundingClientRect().width;
                document.body.removeChild(tempSpan);
                chatSortSelect.style.width = `${width + 42}px`;
            };

            adjustWidth();
            chatSortSelect.addEventListener('change', (e) => {
                this.chatSortDirection = e.target.value;
                adjustWidth();
                this.renderChatSidebar();
            });
        }

        const fileInput = document.getElementById('chat-image-upload');
        const previewContainer = document.getElementById('attachment-preview-container');

        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                if (previewContainer) {
                    previewContainer.innerHTML = `
                        <div class="relative inline-block w-16 h-16 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden group shadow-xs">
                            <img src="${event.target.result}" class="w-full h-full object-cover">
                            <button id="btn-remove-attachment" type="button" class="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-md cursor-pointer transition-colors z-10">
                                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    `;
                    previewContainer.classList.remove('hidden');
                    previewContainer.classList.add('flex');

                    document.getElementById('btn-remove-attachment')?.addEventListener('click', () => {
                        fileInput.value = '';
                        previewContainer.innerHTML = '';
                        previewContainer.classList.add('hidden');
                        previewContainer.classList.remove('flex');
                    });
                }
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('chat-input-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSendMessage();
        });

        document.getElementById('tab-btn-details')?.addEventListener('click', () => this.switchDetailsTab('details'));
        document.getElementById('tab-btn-kb')?.addEventListener('click', () => this.switchDetailsTab('kb'));

        // Details panel inputs — update ticket in DB on change
        document.getElementById('details-assignee')?.addEventListener('change', (e) => {
            const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
            if (ticket) {
                ticket.implementor = e.target.value;
                document.getElementById('attr-cust-name').textContent = e.target.value;
                document.getElementById('attr-cust-img').src = avatar(e.target.value);
                this.renderChatSidebar();
                this.table.render();
            }
        });

        document.getElementById('details-team')?.addEventListener('change', (e) => {
            const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
            if (ticket) {
                ticket.team = e.target.value;
                if (this.selectedTicketDbId) updateTicket(this.selectedTicketDbId, { team: e.target.value });
            }
        });

        document.getElementById('details-type')?.addEventListener('change', (e) => {
            const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
            if (ticket) {
                ticket.category = e.target.value;
                this.updateBadgeCounts();
                this.table.render();
            }
        });

        document.getElementById('details-status')?.addEventListener('change', (e) => {
            const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
            if (ticket) {
                ticket.status = e.target.value;
                if (this.selectedTicketDbId) updateTicket(this.selectedTicketDbId, { status: e.target.value });
            }
        });

        document.getElementById('details-subject')?.addEventListener('input', (e) => {
            const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
            if (ticket) {
                ticket.subject = e.target.value;
                document.getElementById('chat-header-ticket-subject').textContent = e.target.value;
                this.renderChatSidebar();
                this.table.render();
            }
        });

        document.querySelectorAll('.priority-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const priority = pill.getAttribute('data-priority-btn');
                const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
                if (ticket) {
                    ticket.priority = priority;
                    this.updatePriorityPillsUI(priority);
                    this.table.render();
                    if (this.selectedTicketDbId) updateTicket(this.selectedTicketDbId, { priority });
                }
            });
        });

        document.getElementById('details-notes')?.addEventListener('input', (e) => {
            const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
            if (ticket) ticket.notes = e.target.value;
        });

        document.querySelectorAll('[data-kb-id]').forEach(art => {
            art.addEventListener('click', () => this.showKBArticlePopover(art.getAttribute('data-kb-id'), art));
        });
    }
    /* END bindChatViewEvents */

    /* START openTicket */
    async openTicket(ticketId) {
        this.selectedTicketId = ticketId;
        this.activeView = 'chat';

        window.history.pushState({ ticketId }, '', `${window.location.pathname}?ticket=${ticketId}`);

        this.showChatView();

        const ticket = this.tickets.find(t => t.id === ticketId);
        if (ticket) {
            this.selectedTicketDbId = ticket.dbId;

            this.updateCloseButtonState(ticket);

            if (!this.isAdmin) {
                this.updateStaffHeader(ticket);
            } else {
                document.getElementById('chat-header-ticket-id').textContent = ticket.id;
                document.getElementById('chat-header-ticket-subject').textContent = ticket.subject;
            }

            ticket.unreadCount = 0;
            this.updateBadgeCounts();

            const detailsAssignee = document.getElementById('details-assignee');
            if (detailsAssignee) {
                const names = [...new Set(this.tickets.map(t => t.implementor))].filter(Boolean);
                detailsAssignee.innerHTML = names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
                detailsAssignee.value = ticket.implementor;
            }

            const detailsTeam = document.getElementById('details-team');
            if (detailsTeam) detailsTeam.value = ticket.team || 'Technical Support';

            const detailsType = document.getElementById('details-type');
            if (detailsType) detailsType.value = ticket.category;

            const detailsStatus = document.getElementById('details-status');
            if (detailsStatus) detailsStatus.value = ticket.status || 'Open';

            const detailsSubject = document.getElementById('details-subject');
            if (detailsSubject) detailsSubject.value = ticket.subject;

            const detailsNotes = document.getElementById('details-notes');
            if (detailsNotes) detailsNotes.value = ticket.notes || '';

            const attrId = document.getElementById('attr-id');
            if (attrId) attrId.textContent = ticket.id;
            const attrCustomerName = document.getElementById('attr-cust-name');
            if (attrCustomerName) attrCustomerName.textContent = ticket.implementor;
            const attrCustomerImage = document.getElementById('attr-cust-img');
            if (attrCustomerImage) attrCustomerImage.src = avatar(ticket.implementor);
            const attrDate = document.getElementById('attr-date');
            if (attrDate) attrDate.textContent = ticket.date;

            this.updatePriorityPillsUI(ticket.priority);
            this.renderTags(ticket);

            // Mark ticket as Open in Supabase (admin action)
            if (document.hasFocus()) {
                if (this.isAdmin && ticket.dbId) {
                    openTicketApi(ticket.dbId).catch(() => {});
                    markMessagesRead(ticket.dbId).catch(() => {});
                } else if (!this.isAdmin && ticket.dbId) {
                    markAdminMessagesRead(ticket.dbId).catch(() => {});
                }
            }
        }

        this.switchDetailsTab('details');
        document.getElementById('kb-article-popover')?.classList.add('hidden');

        this.syncStaffComposerState();
        this.renderChatSidebar();
        await this._loadAndRenderConversation(this.selectedTicketDbId);

        // Subscribe to realtime messages for this ticket
        this._subscribeMessages(this.selectedTicketDbId);

        setTimeout(() => {
            document.querySelector(`[data-chat-id="${ticketId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }

    showChatView() {
        document.getElementById('table-breadcrumbs')?.classList.add('hidden');
        document.getElementById('table-view-container')?.classList.add('hidden');
        document.getElementById('chat-breadcrumbs')?.classList.remove('hidden');
        document.getElementById('chat-view-container')?.classList.remove('hidden');
    }

    updateStaffCreateTicketVisibility() {
        if (this.isAdmin) return;

        const headerCreateBtn = document.getElementById('btn-create-ticket');
        const hasTickets = this.tickets.length > 0;
        
        if (headerCreateBtn) {
            const hasSelection = Boolean(this.selectedTicketId && this.selectedTicketDbId);
            
            if (hasSelection) {
                const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
                const isClosed = ticket?.status === 'Closed';

                if (isClosed) {
                    // Change to Re-open Ticket button (Blue)
                    headerCreateBtn.classList.remove('hidden');
                    headerCreateBtn.classList.add('inline-flex');
                    
                    headerCreateBtn.className = 'cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 px-3.5 py-2 rounded-lg transition-colors shadow-sm';
                    headerCreateBtn.innerHTML = `
                        <span>Re-open Ticket</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"></path>
                        </svg>
                    `;
                } else {
                    // Change to Close Ticket button (Red)
                    headerCreateBtn.classList.remove('hidden');
                    headerCreateBtn.classList.add('inline-flex');
                    
                    headerCreateBtn.className = 'cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 px-3.5 py-2 rounded-lg transition-colors shadow-sm';
                    headerCreateBtn.innerHTML = `
                        <span>Close Ticket</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    `;
                }
            } else {
                // Change to Create Ticket button (Green)
                headerCreateBtn.classList.toggle('hidden', !hasTickets);
                headerCreateBtn.classList.toggle('inline-flex', hasTickets);
                
                headerCreateBtn.className = 'cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 px-3.5 py-2 rounded-lg transition-colors shadow-sm';
                headerCreateBtn.innerHTML = `
                    <span>Create Ticket</span>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14"></path>
                    </svg>
                `;
            }
        }

        const emptyCreateBtn = document.getElementById('staff-empty-create-ticket');
        if (emptyCreateBtn) {
            emptyCreateBtn.classList.toggle('hidden', hasTickets);
            emptyCreateBtn.classList.toggle('inline-flex', !hasTickets);
        }
    }

    updateStaffHeader(ticket = null) {
        if (this.isAdmin) return;

        const titleEl = document.getElementById('chat-header-ticket-id');
        const subtitleEl = document.getElementById('chat-header-ticket-subject');
        const separatorEl = document.getElementById('chat-header-separator');
        const underlineEl = document.getElementById('chat-header-subject-underline');
        const innerHeader = document.getElementById('staff-chat-header');
        if (!titleEl || !subtitleEl) return;

        this.updateStaffCreateTicketVisibility();

        if (ticket) {
            titleEl.textContent = ticket.id;
            subtitleEl.textContent = ticket.subject;

            if (separatorEl) separatorEl.classList.remove('hidden');
            if (underlineEl) {
                underlineEl.classList.remove('w-0');
                underlineEl.classList.add('w-full');
            }

            if (innerHeader) {
                innerHeader.classList.remove('hidden');
                innerHeader.classList.add('flex');
                
                const headerId = document.getElementById('staff-chat-header-id');
                const headerSubject = document.getElementById('staff-chat-header-subject');
                const headerCategory = document.getElementById('staff-chat-header-category');
                const headerPriority = document.getElementById('staff-chat-header-priority');

                if (headerId) headerId.textContent = ticket.id;
                if (headerSubject) headerSubject.textContent = ticket.subject;
                if (headerCategory) headerCategory.textContent = ticket.category;
                if (headerPriority && this.table) {
                    headerPriority.innerHTML = this.table.getPriorityBadge(ticket.priority);
                }
            }
            return;
        }

        titleEl.textContent = 'Tickets';
        subtitleEl.textContent = 'View and manage your tickets here.';
        if (separatorEl) separatorEl.classList.add('hidden');
        if (underlineEl) {
            underlineEl.classList.remove('w-full');
            underlineEl.classList.add('w-0');
        }
        if (innerHeader) {
            innerHeader.classList.add('hidden');
            innerHeader.classList.remove('flex');
        }
    }

    updateCloseButtonState(ticket) {
        const isClosed = ticket.status === 'Closed';
        
        if (this.isAdmin) {
            const adminCloseBtn = document.getElementById('btn-close-chat');
            if (adminCloseBtn) {
                if (isClosed) {
                    adminCloseBtn.className = 'cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm';
                    adminCloseBtn.innerHTML = `
                        <span>Re-open</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"></path>
                        </svg>
                    `;
                } else {
                    adminCloseBtn.className = 'cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm';
                    adminCloseBtn.innerHTML = `
                        <span>Close</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    `;
                }
            }
        } else {
            this.updateStaffCreateTicketVisibility();
        }
    }

    syncStaffComposerState() {
        if (this.isAdmin) return;

        const shell = document.getElementById('chat-composer-shell');
        const form = document.getElementById('chat-input-form');
        const editor = document.getElementById('chat-editor');
        const sendBtn = document.getElementById('chat-send-button') || document.querySelector('#chat-input-form button[type="submit"]');
        const helperText = document.getElementById('chat-composer-helper');
        const labelText = document.getElementById('chat-composer-label');
        if (!editor || !sendBtn || !shell || !form) return;

        const hasSelection = Boolean(this.selectedTicketId && this.selectedTicketDbId);
        editor.disabled = !hasSelection;
        editor.value = hasSelection ? editor.value : '';
        editor.placeholder = hasSelection ? 'Type your reply here...' : '';

        shell.classList.toggle('hidden', !hasSelection);
        form.classList.toggle('pointer-events-none', !hasSelection);

        if (helperText) {
            helperText.textContent = 'Your replies appear in the selected ticket conversation.';
        }

        if (labelText) {
            labelText.textContent = 'Message';
        }

        sendBtn.disabled = !hasSelection;
        sendBtn.classList.toggle('opacity-60', !hasSelection);
        sendBtn.classList.toggle('pointer-events-none', !hasSelection);
    }
    renderStaffWelcomeState() {
        if (this.isAdmin) return;

        const viewport = document.getElementById('chat-messages-viewport');
        if (!viewport) return;

        const hasTickets = this.tickets.length > 0;
        const eyebrow = hasTickets ? 'No active ticket selected' : 'No tickets yet';
        const title = hasTickets ? 'Click any ticket or create a new one.' : 'Create a new ticket first.';
        const body = hasTickets
            ? 'Choose any ticket from the left side to open its conversation, or create a new ticket if you want to submit another concern.'
            : 'You have not created any tickets yet. Create a new ticket first and the conversation will appear here.';

        viewport.innerHTML = `
            <div class="flex h-full min-h-[360px] items-center justify-center px-6">
                <div class="max-w-lg text-center">
                    <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                        <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    <p class="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">${eyebrow}</p>
                    <h2 class="mt-3 text-xl font-bold text-gray-900 dark:text-white">${title}</h2>
                    <p class="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">${body}</p>
                    <button id="staff-empty-create-ticket" type="button" class="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14" />
                        </svg>
                        Create Ticket
                    </button>
                </div>
            </div>
        `;

        this.updateStaffCreateTicketVisibility();
        document.getElementById('staff-empty-create-ticket')?.addEventListener('click', () => this.handleCreateTicket());
    }

    showStaffConversationView() {
        this.activeView = 'chat';
        this.selectedTicketId = null;
        this.selectedTicketDbId = null;
        this.showChatView();
        this.updateStaffHeader();
        this.renderChatSidebar();
        this.renderStaffWelcomeState();
        this.syncStaffComposerState();
    }

    handleCreateTicket() {
        if (this.isAdmin || !this.sessionUserId) return;

        // If a ticket is open, act as Close Ticket
        if (this.selectedTicketId) {
            this.handleCloseTicketStatus();
            return;
        }

        const drawerEl = document.getElementById('drawer-create-ticket');
        if (drawerEl) {
            drawerEl.classList.remove('translate-x-full');
            drawerEl.classList.add('transform-none');
            document.body.classList.add('overflow-hidden');

            // Create and append backdrop
            let backdrop = document.getElementById('drawer-create-ticket-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.id = 'drawer-create-ticket-backdrop';
                backdrop.className = 'fixed inset-0 z-[45] bg-gray-900/50 dark:bg-gray-900/80 backdrop-blur-sm transition-opacity cursor-pointer';
                document.body.appendChild(backdrop);

                // Clicking the backdrop closes the drawer
                backdrop.addEventListener('click', () => {
                    drawerEl.classList.add('translate-x-full');
                    drawerEl.classList.remove('transform-none');
                    document.body.classList.remove('overflow-hidden');
                    backdrop.remove();
                });
            }
            
            // Reset form
            document.getElementById('form-create-ticket')?.reset();
            
            // Reset priority to Medium
            document.querySelectorAll('.create-priority-pill').forEach(btn => {
                const isActive = btn.dataset.priorityBtn === 'Medium';
                btn.classList.toggle('active', isActive);
                if (isActive) {
                    btn.classList.add('ring-2', 'ring-blue-500', 'bg-gray-100', 'dark:bg-gray-700');
                } else {
                    btn.classList.remove('ring-2', 'ring-blue-500', 'bg-gray-100', 'dark:bg-gray-700');
                }
            });
            
            // Reset tags
            const tagsContainer = document.getElementById('create-ticket-tags-container');
            const tagsInput = document.getElementById('create-ticket-tags-input');
            if (tagsContainer && tagsInput) {
                Array.from(tagsContainer.querySelectorAll('span.create-tag-badge')).forEach(el => el.remove());
                tagsInput.value = '';
            }
        }
    }
    
    initCreateTicketDrawer() {
        if (this.isAdmin) return;

        const drawerEl = document.getElementById('drawer-create-ticket');
        if (!drawerEl) return;

        const closeBtns = document.querySelectorAll('[data-drawer-hide="drawer-create-ticket"]');
        const hideDrawer = () => {
            drawerEl.classList.add('translate-x-full');
            drawerEl.classList.remove('transform-none');
            document.body.classList.remove('overflow-hidden');
            document.getElementById('drawer-create-ticket-backdrop')?.remove();
        };
        closeBtns.forEach(btn => btn.addEventListener('click', hideDrawer));

        // Priority Pills Logic
        const priorityBtns = document.querySelectorAll('.create-priority-pill');
        priorityBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                priorityBtns.forEach(b => {
                    b.classList.remove('active', 'ring-2', 'ring-blue-500', 'bg-gray-100', 'dark:bg-gray-700');
                });
                btn.classList.add('active', 'ring-2', 'ring-blue-500', 'bg-gray-100', 'dark:bg-gray-700');
            });
        });

        // Tags Logic
        const tagsContainer = document.getElementById('create-ticket-tags-container');
        const tagsInput = document.getElementById('create-ticket-tags-input');
        
        const createTag = (text) => {
            const span = document.createElement('span');
            span.className = 'create-tag-badge inline-flex items-center gap-1 text-[10px] font-bold bg-gray-900 text-white dark:bg-gray-950 px-2 py-0.5 rounded-md';
            span.innerHTML = `${text.replace(/</g, "&lt;")} <button type="button" class="cursor-pointer text-gray-400 hover:text-white font-bold select-none remove-tag-btn">&times;</button>`;
            span.dataset.value = text;
            
            span.querySelector('.remove-tag-btn').addEventListener('click', () => span.remove());
            tagsContainer.insertBefore(span, tagsInput);
        };

        if (tagsContainer && tagsInput) {
            tagsContainer.addEventListener('click', () => tagsInput.focus());
            tagsInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const val = tagsInput.value.trim().replace(/^,|,$/g, '');
                    if (val) createTag(val);
                    tagsInput.value = '';
                } else if (e.key === 'Backspace' && tagsInput.value === '') {
                    const lastTag = tagsContainer.querySelector('.create-tag-badge:last-of-type');
                    if (lastTag) lastTag.remove();
                }
            });
            tagsInput.addEventListener('blur', () => {
                const val = tagsInput.value.trim().replace(/^,|,$/g, '');
                if (val) createTag(val);
                tagsInput.value = '';
            });
        }

        // Form Submission
        const form = document.getElementById('form-create-ticket');
        const submitBtn = document.getElementById('btn-submit-create-ticket');
        
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.sessionUserId || submitBtn.disabled) return;

            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Submitting...';
            
            const subject = document.getElementById('create-ticket-subject').value;
            const team = document.getElementById('create-ticket-team').value;
            const categoryName = document.getElementById('create-ticket-category').value;
            const message = document.getElementById('create-ticket-message').value;
            
            const activePriorityBtn = document.querySelector('.create-priority-pill.active');
            const priority = activePriorityBtn ? activePriorityBtn.dataset.priorityBtn : 'Medium';
            
            const tags = Array.from(document.querySelectorAll('.create-tag-badge')).map(el => el.dataset.value);
            
            const category = this.ticketCategories.find(c => c.name === categoryName) || this.ticketCategories[0];

            try {
                const result = await createTicket({
                    created_by: this.sessionUserId,
                    category_id: category?.id || null,
                    subject,
                    priority,
                    team,
                    tags
                });

                if (result.error) {
                    if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', 'Create ticket failed', result.error);
                    this.showToast('danger', `Failed to create ticket: ${result.error}`);
                } else {
                    const createdTicket = result.data;
                    const ticketDbId = createdTicket?.id;
                    
                    if (ticketDbId && message.trim()) {
                        const msgResult = await sendTextMessage(
                            ticketDbId,
                            this.sessionUserId,
                            this.sessionUserName,
                            'staff',
                            message
                        );
                        if (msgResult.error && window.DEBUG) {
                            window.DEBUG.error('TICKET-SUPPORT', 'Failed to send initial message', msgResult.error);
                        }
                    }

                    this.showToast('success', `Ticket ${createdTicket?.ticket_number || ''} submitted successfully!`);
                    hideDrawer();
                    await this.loadTickets();
                    const createdTicketId = createdTicket?.ticket_number || this.tickets[0]?.id;
                    if (createdTicketId) {
                        await this.openTicket(createdTicketId);
                    }
                }
            } catch (error) {
                if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', 'Submit Exception', error);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14"></path></svg>Submit`;
            }
        });
    }
    /* END openTicket */

    /* START closeTicket */
    closeTicket() {
        this.selectedTicketId = null;
        this.selectedTicketDbId = null;

        // Unsubscribe message channel when leaving chat
        if (this._messagesChannel) {
            supabase.removeChannel(this._messagesChannel);
            this._messagesChannel = null;
        }

        window.history.pushState({}, '', window.location.pathname);
        localStorage.removeItem('active-ticket-id');
        document.getElementById('kb-article-popover')?.classList.add('hidden');

        if (!this.isAdmin) {
            this.showStaffConversationView();
            return;
        }

        this.activeView = 'table';
        document.getElementById('chat-breadcrumbs')?.classList.add('hidden');
        document.getElementById('chat-view-container')?.classList.add('hidden');
        document.getElementById('table-breadcrumbs')?.classList.remove('hidden');
        document.getElementById('table-view-container')?.classList.remove('hidden');
        this.table.render();
    }
    /* END closeTicket */

    /* START handleCloseTicketStatus */
    handleCloseTicketStatus() {
        if (!this.selectedTicketDbId) return;
        
        const ticket = this.tickets.find(t => t.dbId === this.selectedTicketDbId);
        const isClosed = ticket?.status === 'Closed';

        if (isClosed) {
            this.proceedReopenTicket();
        } else {
            if (this.closeTicketModal) {
                this.closeTicketModal.show();
            } else if (confirm('Are you sure you want to close this ticket?')) {
                this.proceedCloseTicket();
            }
        }
    }
    /* END handleCloseTicketStatus */

    /* START proceedCloseTicket */
    async proceedCloseTicket() {
        try {
            const btn = document.getElementById('btn-close-chat') || document.getElementById('btn-create-ticket');
            if (btn && btn.querySelector('span')) {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.querySelector('span').textContent = 'Closing...';
            }

            const result = await closeTicketApi(this.selectedTicketDbId);
            
            if (result.error) {
                if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', 'Failed to close ticket', result.error);
                this.showToast('danger', `Failed to close ticket: ${result.error}`);
                return;
            }

            this.showToast('success', 'Ticket closed successfully!');
            await this.loadTickets();
            this.closeTicket(); // Go back to table/welcome view
            
            // Re-render sidebars and badges
            if (this.isAdmin) {
                this.renderChatSidebar();
            }
        } catch (error) {
            if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', 'proceedCloseTicket exception', error);
        } finally {
            const btn = document.getElementById('btn-close-chat') || document.getElementById('btn-create-ticket');
            if (btn && btn.querySelector('span')) {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }
    /* END proceedCloseTicket */

    /* START proceedReopenTicket */
    async proceedReopenTicket() {
        try {
            const btn = document.getElementById('btn-close-chat') || document.getElementById('btn-create-ticket');
            if (btn && btn.querySelector('span')) {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.querySelector('span').textContent = 'Opening...';
            }

            const result = await updateTicket(this.selectedTicketDbId, { status: 'Open' });
            
            if (result.error) {
                if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', 'Failed to reopen ticket', result.error);
                this.showToast('danger', `Failed to reopen ticket: ${result.error}`);
                return;
            }

            this.showToast('success', 'Ticket re-opened successfully!');
            await this.loadTickets();
            
            const ticket = this.tickets.find(t => t.dbId === this.selectedTicketDbId);
            if (ticket) {
                this.updateCloseButtonState(ticket);
                if (!this.isAdmin) {
                    this.updateStaffHeader(ticket);
                }
            }

            this.renderChatSidebar();
        } catch (error) {
            if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', 'proceedReopenTicket exception', error);
        } finally {
            const btn = document.getElementById('btn-close-chat') || document.getElementById('btn-create-ticket');
            if (btn && btn.querySelector('span')) {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }
    /* END proceedReopenTicket */

    showToast(type, message) {
        let container = document.getElementById('ticket-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'ticket-toast-container';
            container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 w-full max-w-xs px-4 sm:px-0';
            document.body.appendChild(container);
        }

        const toastTypes = {
            success: {
                label: 'Success',
                iconClass: 'text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300',
                borderClass: 'border-green-200 dark:border-green-900/70',
                icon: '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11.917 9.724 16.5 19 7.5"/>'
            },
            danger: {
                label: 'Error',
                iconClass: 'text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300',
                borderClass: 'border-red-200 dark:border-red-900/70',
                icon: '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 17.94 6M18 18 6.06 6"/>'
            }
        };

        const config = toastTypes[type] || toastTypes.success;
        const toast = document.createElement('div');
        toast.className = `flex items-start w-full p-4 text-gray-700 bg-white border ${config.borderClass} rounded-lg shadow-lg dark:bg-gray-900 dark:text-gray-200 transition-all duration-300 transform translate-y-2 opacity-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="inline-flex items-center justify-center shrink-0 w-7 h-7 rounded ${config.iconClass}">
                <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">${config.icon}</svg>
                <span class="sr-only">${config.label} icon</span>
            </div>
            <div class="ms-3 min-w-0 flex-1">
                <p class="text-[11px] font-extrabold uppercase tracking-wider text-gray-900 dark:text-white">${config.label}</p>
                <p class="mt-0.5 break-words text-xs font-medium text-gray-600 dark:text-gray-300">${esc(message)}</p>
            </div>
            <button type="button" class="ms-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:hover:bg-gray-800 dark:hover:text-white" aria-label="Close">
                <span class="sr-only">Close</span>
                <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 17.94 6M18 18 6.06 6"/></svg>
            </button>
        `;

        const removeToast = () => {
            toast.classList.add('opacity-0', 'translate-y-2');
            window.setTimeout(() => toast.remove(), 300);
        };

        toast.querySelector('button')?.addEventListener('click', removeToast);
        container.appendChild(toast);

        // trigger fade-in
        window.setTimeout(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        }, 10);

        window.setTimeout(removeToast, 4000);
    }

    /* START _loadAndRenderConversation */
    async _loadAndRenderConversation(ticketDbId) {
        const viewport = document.getElementById('chat-messages-viewport');
        if (!viewport || !ticketDbId) return;

        // Role-based guard: staff can only view their own ticket messages
        const ticket = this.tickets.find(t => t.dbId === ticketDbId);
        if (!this.isAdmin && ticket && ticket.implementorId !== this.sessionUserId) {
            viewport.innerHTML = `<div class="flex items-center justify-center h-full text-center py-12 text-gray-500 dark:text-gray-400"><p class="text-sm font-semibold">Access denied: You can only view your own ticket conversations.</p></div>`;
            return;
        }

        const { data, error } = await fetchMessages(ticketDbId);
        if (error) {
            if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', `Failed to load messages for ticket ${ticketDbId}`, error);
            viewport.innerHTML = `<div class="flex items-center justify-center h-full py-12 text-red-500"><p class="text-sm font-semibold">Failed to load conversation. Please try again.</p></div>`;
            return;
        }

        const messages = (data || []).map(normalizeMessage);
        this.renderConversation(messages);
        
        // Mark messages as read since they are now viewed
        if (document.hasFocus()) {
            if (this.isAdmin) {
                markMessagesRead(ticketDbId).catch(() => {});
                supabase.from('tickets').update({ unread_count: 0 }).eq('id', ticketDbId).then(({ error }) => { if (error) console.error(error); });
            } else {
                markAdminMessagesRead(ticketDbId).catch(() => {});
            }
        }
    }
    /* END _loadAndRenderConversation */

    /* START renderTags */
    renderTags(ticket) {
        const container = document.getElementById('details-tags-container');
        if (!container) return;

        let html = '';
        const tags = ticket.tags || [];
        tags.forEach((tag, idx) => {
            html += `<span class="inline-flex items-center gap-1 text-[10px] font-bold bg-gray-900 text-white dark:bg-gray-950 dark:text-white px-2 py-0.5 rounded-md">${esc(tag)} <button type="button" class="cursor-pointer text-gray-400 hover:text-white font-bold select-none remove-tag-btn" data-tag-idx="${idx}">×</button></span>`;
        });
        html += `<input type="text" id="details-tags-input" class="bg-transparent border-0 outline-none text-[10px] text-gray-900 dark:text-white p-0 focus:ring-0 flex-1 min-w-[60px]" placeholder="+ Add tag..." />`;
        container.innerHTML = html;

        container.querySelectorAll('.remove-tag-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-tag-idx'));
                ticket.tags.splice(idx, 1);
                this.renderTags(ticket);
            });
        });

        const input = document.getElementById('details-tags-input');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const newTag = input.value.trim();
                    if (newTag) {
                        if (!ticket.tags) ticket.tags = [];
                        if (!ticket.tags.includes(newTag)) ticket.tags.push(newTag);
                        this.renderTags(ticket);
                    }
                }
            });
        }
    }
    /* END renderTags */

    /* START updatePriorityPillsUI */
    updatePriorityPillsUI(priority) {
        document.querySelectorAll('.priority-pill').forEach(pill => {
            const pillPriority = pill.getAttribute('data-priority-btn');
            if (pillPriority === priority) {
                if (priority === 'Low') {
                    pill.className = 'priority-pill flex-1 py-1.5 text-xs rounded-md bg-emerald-50 border-2 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400 font-bold cursor-pointer transition-colors flex items-center justify-center gap-1 shadow-xs';
                } else if (priority === 'Medium') {
                    pill.className = 'priority-pill flex-1 py-1.5 text-xs rounded-md bg-amber-50 border-2 border-amber-500 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400 font-bold cursor-pointer transition-colors flex items-center justify-center gap-1 shadow-xs';
                } else if (priority === 'High') {
                    pill.className = 'priority-pill flex-1 py-1.5 text-xs rounded-md bg-rose-50 border-2 border-rose-500 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400 font-bold cursor-pointer transition-colors flex items-center justify-center gap-1 shadow-xs';
                }
            } else {
                pill.className = 'priority-pill flex-1 py-1.5 text-xs font-semibold rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer transition-colors flex items-center justify-center gap-1';
            }
        });
    }
    /* END updatePriorityPillsUI */

    /* START switchDetailsTab */
    switchDetailsTab(tab) {
        this.activeDetailsTab = tab;
        const detailsContent = document.getElementById('details-tab-content');
        const kbContent = document.getElementById('kb-tab-content');
        const tabBtnDetails = document.getElementById('tab-btn-details');
        const tabBtnKb = document.getElementById('tab-btn-kb');
        const popover = document.getElementById('kb-article-popover');

        if (!detailsContent || !kbContent || !tabBtnDetails || !tabBtnKb) return;
        if (popover) popover.classList.add('hidden');

        document.querySelectorAll('[data-kb-id]').forEach(card => {
            card.className = 'flex gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/55 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-colors';
        });

        if (tab === 'details') {
            detailsContent.classList.remove('hidden');
            kbContent.classList.add('hidden');
            tabBtnDetails.className = 'tab-icon-btn cursor-pointer w-8 h-8 rounded-full flex items-center justify-center transition-all bg-blue-600 text-white dark:bg-blue-600 dark:text-white';
            tabBtnKb.className = 'tab-icon-btn cursor-pointer w-8 h-8 rounded-full flex items-center justify-center transition-all text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800';
        } else if (tab === 'kb') {
            detailsContent.classList.add('hidden');
            kbContent.classList.remove('hidden');
            tabBtnKb.className = 'tab-icon-btn cursor-pointer w-8 h-8 rounded-full flex items-center justify-center transition-all bg-blue-600 text-white dark:bg-blue-600 dark:text-white';
            tabBtnDetails.className = 'tab-icon-btn cursor-pointer w-8 h-8 rounded-full flex items-center justify-center transition-all text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800';
        }
    }
    /* END switchDetailsTab */

    /* START showKBArticlePopover */
    showKBArticlePopover(kbId, element) {
        const article = MOCK_KB_ARTICLES[kbId];
        if (!article) return;

        const popover = document.getElementById('kb-article-popover');
        if (!popover) return;

        document.getElementById('popover-badge').textContent = article.category;
        document.getElementById('popover-readtime').textContent = article.readTime;
        document.getElementById('popover-title').textContent = article.title;
        document.getElementById('popover-summary').textContent = article.summary;

        document.querySelectorAll('[data-kb-id]').forEach(card => {
            card.className = card.getAttribute('data-kb-id') === kbId
                ? 'flex gap-2.5 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 cursor-pointer border border-blue-200 dark:border-blue-800 transition-all duration-200 shadow-xs'
                : 'flex gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/55 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-all duration-200';
        });

        const suggestBtn = document.getElementById('popover-btn-suggest');
        const editBtn = document.getElementById('popover-btn-edit');
        const closeBtn = document.getElementById('popover-btn-close');

        const newSuggestBtn = suggestBtn.cloneNode(true);
        suggestBtn.parentNode.replaceChild(newSuggestBtn, suggestBtn);
        const newEditBtn = editBtn.cloneNode(true);
        editBtn.parentNode.replaceChild(newEditBtn, editBtn);
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

        newSuggestBtn.addEventListener('click', () => {
            const editor = document.getElementById('chat-editor');
            if (editor) {
                const linkUrl = `https://portal.dole.gov.ph/kb/${kbId}`;
                editor.value = `${article.suggestText}\n\nRead more: ${linkUrl}`;
                editor.setAttribute('data-embed-url', linkUrl);
                editor.setAttribute('data-embed-title', article.title);
                editor.setAttribute('data-embed-domain', 'portal.dole.gov.ph');
                editor.focus();
            }
            popover.classList.add('hidden');
            document.querySelectorAll('[data-kb-id]').forEach(card => {
                card.className = 'flex gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/55 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-colors';
            });
        });

        newEditBtn.addEventListener('click', () => {
            if (window.Swal) {
                window.Swal.fire({
                    title: 'Access Restricted',
                    text: `Editing article "${article.title}" requires higher credentials than standard portal admin access.`,
                    icon: 'warning',
                    confirmButtonText: 'Acknowledge',
                    confirmButtonColor: '#3b82f6',
                    customClass: { confirmButton: 'cursor-pointer text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg font-bold text-sm shadow-xs border-0 select-none' }
                });
            } else {
                alert('Access Restricted. High admin credentials required.');
            }
        });

        newCloseBtn.addEventListener('click', () => {
            popover.classList.add('hidden');
            document.querySelectorAll('[data-kb-id]').forEach(card => {
                card.className = 'flex gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/55 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-colors';
            });
        });

        popover.classList.remove('hidden');
        popover.classList.remove('top-10');

        if (element) {
            const container = document.getElementById('chat-view-container');
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const elemRect = element.getBoundingClientRect();
                let topPos = elemRect.top - containerRect.top;
                const popoverHeight = popover.offsetHeight;
                const containerHeight = container.clientHeight;
                if (topPos + popoverHeight > containerHeight) topPos = Math.max(10, containerHeight - popoverHeight - 16);
                topPos = Math.max(10, topPos);
                popover.style.top = `${topPos}px`;
            }
        }
    }
    /* END showKBArticlePopover */

    /* START renderChatSidebar */
    renderChatSidebar() {
        const listContainer = document.getElementById('chat-tickets-list');
        if (!listContainer) return;

        let filtered = this.tickets.filter(ticket => {
            if (this.chatSortDirection === 'closed') {
                if (ticket.status !== 'Closed') return false;
            } else {
                if (ticket.status === 'Closed') return false;
            }

            if (!this.chatSearchQuery) return true;
            const q = this.chatSearchQuery;
            return ticket.id.toLowerCase().includes(q) ||
                ticket.subject.toLowerCase().includes(q) ||
                ticket.implementor.toLowerCase().includes(q);
        });

        filtered.sort((a, b) => {
            const dateA = new Date(a.rawCreatedAt || a.date).getTime();
            const dateB = new Date(b.rawCreatedAt || b.date).getTime();
            return (this.chatSortDirection === 'oldest') ? dateA - dateB : dateB - dateA;
        });

        const chatTicketsCount = document.getElementById('chat-tickets-count');
        if (chatTicketsCount) {
            chatTicketsCount.textContent = this.tickets.filter(t => {
                return (this.chatSortDirection === 'closed') ? (t.status === 'Closed') : (t.status !== 'Closed');
            }).length;
        }

        if (filtered.length === 0) {
            const hasTickets = this.tickets.length > 0;
            listContainer.innerHTML = hasTickets
                ? `<div class="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">No tickets match your current search.</div>`
                : `<div class="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center dark:border-gray-800"><p class="text-xs font-semibold text-gray-600 dark:text-gray-300">You do not have any tickets yet.</p><button id="staff-sidebar-create-ticket" type="button" class="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-emerald-700"><svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14" /></svg>Create Ticket</button></div>`;
            document.getElementById('staff-sidebar-create-ticket')?.addEventListener('click', () => this.handleCreateTicket());
            return;
        }

        let html = '';
        filtered.forEach(ticket => {
            const isActive = ticket.id === this.selectedTicketId;
            const activeClass = isActive
                ? 'border border-blue-200 bg-blue-50/80 dark:border-blue-800 dark:bg-blue-950/20'
                : 'border border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-800 dark:hover:bg-gray-800/60';

            const unreadBadge = ticket.unreadCount > 0
                ? `<span class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-md shadow-sm">${ticket.unreadCount}</span>`
                : '';

            html += `
                <div data-chat-id="${esc(ticket.id)}" class="cursor-pointer rounded-xl p-3 transition-all duration-200 ${activeClass}">
                    <div class="flex items-start gap-3">
                        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">${esc(ticket.id.slice(-2))}</div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <p class="truncate text-xs font-bold text-gray-900 dark:text-white">${esc(ticket.id)}</p>
                                    <p class="mt-1 truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">${esc(ticket.subject)}</p>
                                </div>
                                <div class="flex flex-col items-end gap-1 shrink-0">
                                    <span class="text-[10px] text-gray-400 dark:text-gray-500">${esc(ticket.lastActivity)}</span>
                                    ${unreadBadge}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        listContainer.innerHTML = html;

        listContainer.querySelectorAll('[data-chat-id]').forEach(item => {
            item.addEventListener('click', () => this.openTicket(item.getAttribute('data-chat-id')));
        });
    }
    /* END renderChatSidebar */

    /* START renderConversation */
    renderConversation(messages) {
        const viewport = document.getElementById('chat-messages-viewport');
        if (!viewport) return;

        if (!messages || messages.length === 0) {
            viewport.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full min-h-[320px] text-center py-12 text-gray-500 dark:text-gray-400">
                    <svg class="mb-3 h-10 w-10 text-gray-300 dark:text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">This ticket does not have any messages yet.</p>
                    <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Send the first reply below to start the conversation.</p>
                </div>
            `;
            return;
        }

        let html = '';
        messages.forEach((msg) => {
            const isMsgAdmin = msg.sender === 'Admin' || (msg._raw && msg._raw.sender_type === 'admin');
            const isMine = (this.isAdmin && isMsgAdmin) || (!this.isAdmin && !isMsgAdmin);

            const bubbleAlign = isMine ? 'justify-end' : 'justify-start';
            const flexRowClass = isMine ? 'flex-row-reverse' : '';
            const textBg = isMine
                ? 'bg-blue-600 text-white rounded-s-xl rounded-b-xl'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-e-xl rounded-b-xl';

            let bubbleContent = '';

            if (msg.type === 'text') {
                bubbleContent = `<p class="text-sm leading-normal">${esc(msg.content)}</p>`;
            } else if (msg.type === 'file') {
                bubbleContent = `
                    <div class="flex items-start bg-white/10 dark:bg-gray-900/40 rounded-lg p-2.5 max-w-xs border border-white/10 dark:border-gray-700/50">
                        <div class="me-2.5">
                            <span class="flex items-center gap-2 text-sm font-medium text-current pb-1.5">
                                <svg fill="none" aria-hidden="true" class="w-5 h-5 shrink-0" viewBox="0 0 20 21"><g clip-path="url(#clip0_3173_1381)"><path fill="#E2E5E7" d="M5.024.5c-.688 0-1.25.563-1.25 1.25v17.5c0 .688.562 1.25 1.25 1.25h12.5c.687 0 1.25-.563 1.25-1.25V5.5l-5-5h-8.75z"/><path fill="#B0B7BD" d="M15.024 5.5h3.75l-5-5v3.75c0 .688.562 1.25 1.25 1.25z"/><path fill="#CAD1D8" d="M18.774 9.25l-3.75-3.75h3.75v3.75z"/><path fill="#F15642" d="M16.274 16.75a.627.627 0 01-.625.625H1.899a.627.627 0 01-.625-.625V10.5c0-.344.281-.625.625-.625h13.75c.344 0 .625.281.625.625v6.25z"/><path fill="#fff" d="M3.998 12.342c0-.165.13-.345.34-.345h1.154c.65 0 1.235.435 1.235 1.269 0 .79-.585 1.23-1.235 1.23h-.834v.66c0 .22-.14.344-.32.344a.337.337 0 01-.34-.344v-2.814zm.66.284v1.245h.834c.335 0 .6-.295.6-.605 0-.35-.265-.64-.6-.64h-.834zM7.706 15.5c-.165 0-.345-.09-.345-.31v-2.838c0-.18.18-.31.345-.31H8.85c2.284 0 2.234 3.458.045 3.458h-1.19zm.315-2.848v2.239h.83c1.349 0 1.409-2.24 0-2.24h-.83zM11.894 13.486h1.274c.18 0 .36.18.36.355 0 .165-.18.3-.36.3h-1.274v1.049c0 .175-.124.31-.3.31-.22 0-.354-.135-.354-.31v-2.839c0-.18.135-.31.355-.31h1.754c.22 0 .35.13.35.31 0 .16-.13.34-.35.34h-1.455v.795z"/><path fill="#CAD1D8" d="M15.649 17.375H3.774V18h11.875a.627.627 0 00.625-.625v-.625a.627.627 0 01-.625.625z"/></g><defs><clipPath id="clip0_3173_1381"><path fill="#fff" d="M0 0h20v20H0z" transform="translate(0 .5)"/></clipPath></defs></svg>
                                ${esc(msg.fileName || 'File')}
                            </span>
                            <span class="flex text-[10px] opacity-75 gap-1.5 font-normal">${esc(msg.filePages || '')} • ${esc(msg.fileSize || '')} • PDF</span>
                        </div>
                        <div class="inline-flex self-center">
                            <button type="button" class="cursor-pointer p-1.5 text-current hover:bg-black/10 dark:hover:bg-white/10 rounded-md transition-colors" title="Download">
                                <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 13V4M7 14H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-2m-1-5-4 5-4-5m9 8h.01"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            } else if (msg.type === 'image') {
                bubbleContent = `
                    <p class="text-sm mb-2 font-normal">${esc(msg.content)}</p>
                    <div class="group relative max-w-[240px]">
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center z-10">
                            <button type="button" class="cursor-pointer inline-flex items-center justify-center rounded-full h-8 w-8 bg-white/30 hover:bg-white/50 transition-colors">
                                <svg class="w-4 h-4 text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2m-8 1V4m0 12-4-4m4 4 4-4"/></svg>
                            </button>
                        </div>
                        <img src="${esc(msg.imageUrl || '')}" class="rounded-lg object-cover w-full h-auto border border-gray-200 dark:border-gray-800" alt="Shared Image">
                    </div>
                `;
            } else if (msg.type === 'gallery') {
                const imgs = Array.isArray(msg.images) ? msg.images : [];
                const imagesHTML = imgs.map(imgSrc => `
                    <div class="group relative">
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center z-10">
                            <button type="button" class="cursor-pointer inline-flex items-center justify-center rounded-full h-7 w-7 bg-white/30 hover:bg-white/50 transition-colors">
                                <svg class="w-3.5 h-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2m-8 1V4m0 12-4-4m4 4 4-4"/></svg>
                            </button>
                        </div>
                        <img src="${esc(imgSrc)}" class="rounded-lg object-cover w-full h-24 border border-gray-200 dark:border-gray-800" alt="Gallery image">
                    </div>
                `).join('');
                bubbleContent = `<p class="text-sm mb-2 font-normal">${esc(msg.content)}</p><div class="grid grid-cols-3 gap-2 max-w-[280px]">${imagesHTML}</div>`;
            } else if (msg.type === 'link') {
                bubbleContent = `
                    <p class="text-sm mb-2 font-normal">${esc(msg.content)}</p>
                    <p class="text-sm pb-2"><a href="${esc(msg.url || '')}" target="_blank" class="underline hover:no-underline break-all font-semibold text-blue-600 dark:text-blue-400">${esc(msg.url || '')}</a></p>
                    <a href="${esc(msg.url || '')}" target="_blank" class="block bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all duration-200">
                        ${msg.previewImage ? `<img src="${esc(msg.previewImage)}" class="rounded-md w-full h-28 object-cover mb-2" alt="Preview Image" />` : ''}
                        <span class="text-xs font-bold text-gray-900 dark:text-white leading-tight block line-clamp-2">${esc(msg.previewTitle || '')}</span>
                        <p class="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1 uppercase tracking-wider">${esc(msg.previewDomain || '')}</p>
                    </a>
                `;
            }

            if (isMine) {
                html += `
                    <div class="flex items-start gap-2.5 justify-end">
                        <div class="flex flex-col gap-1.5 items-end max-w-[80%]">
                            <!-- Name header -->
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-bold text-gray-900 dark:text-white">${esc(msg.sender)}</span>
                            </div>
                            <!-- Bubble and Avatar row -->
                            <div class="flex flex-row-reverse items-end gap-2.5 w-full">
                                <img class="w-8 h-8 rounded-full object-cover flex-shrink-0" src="${msg.avatar}" alt="${esc(msg.sender)}">
                                <div class="relative group leading-normal px-3 py-2 shadow-sm rounded-2xl w-fit max-w-full text-sm ${textBg}">
                                    ${bubbleContent}
                                    <!-- Hover Tooltip -->
                                    <div class="absolute top-1/2 -translate-y-1/2 right-full mr-2 hidden group-hover:flex items-center bg-gray-900/90 text-white dark:bg-gray-800/95 text-[10px] font-bold py-1 px-2 rounded shadow-md pointer-events-none select-none z-30 whitespace-nowrap">
                                        ${esc(msg.time)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="flex items-start gap-2.5 justify-start">
                        <div class="flex items-end gap-2.5 max-w-[80%]">
                            <img class="w-8 h-8 rounded-full object-cover flex-shrink-0" src="${msg.avatar}" alt="${esc(msg.sender)}">
                            <div class="flex flex-col gap-1.5 items-start">
                                <!-- Name header -->
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-bold text-gray-900 dark:text-white">${esc(msg.sender)}</span>
                                </div>
                                <div class="relative group leading-normal px-3 py-2 shadow-sm rounded-2xl w-fit max-w-full text-sm ${textBg}">
                                    ${bubbleContent}
                                    <!-- Hover Tooltip -->
                                    <div class="absolute top-1/2 -translate-y-1/2 left-full ml-2 hidden group-hover:flex items-center bg-gray-900/90 text-white dark:bg-gray-800/95 text-[10px] font-bold py-1 px-2 rounded shadow-md pointer-events-none select-none z-30 whitespace-nowrap">
                                        ${esc(msg.time)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        viewport.innerHTML = html;
        viewport.scrollTop = viewport.scrollHeight;
    }
    /* END renderConversation */

    /* START handleSendMessage */
    async handleSendMessage() {
        const editor = document.getElementById('chat-editor');
        if (!editor || !this.selectedTicketId || !this.selectedTicketDbId) return;

        const val = editor.value.trim();
        if (!val) return;

        const submitBtn = document.querySelector('#chat-input-form button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; }

        try {
            const senderType = this.isAdmin ? 'admin' : 'staff';
            const senderId = this.sessionUserId;
            const senderName = this.sessionUserName;

            const embedUrl = editor.getAttribute('data-embed-url');
            let result;

            if (embedUrl) {
                const { sendLinkMessage } = await import('@/backend/api/ticket-messages.api.js');
                result = await sendLinkMessage(
                    this.selectedTicketDbId,
                    senderId,
                    senderName,
                    senderType,
                    val,
                    {
                        url: embedUrl,
                        preview_title: editor.getAttribute('data-embed-title'),
                        domain: editor.getAttribute('data-embed-domain'),
                    }
                );
                editor.removeAttribute('data-embed-url');
                editor.removeAttribute('data-embed-title');
                editor.removeAttribute('data-embed-domain');
            } else {
                result = await sendTextMessage(
                    this.selectedTicketDbId,
                    senderId,
                    senderName,
                    senderType,
                    val
                );
            }

            if (result.error) {
                if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', 'Send message failed', result.error);
            } else {
                editor.value = '';
                // Clear file upload & preview
                const fileInput = document.getElementById('chat-image-upload');
                const previewContainer = document.getElementById('attachment-preview-container');
                if (fileInput) fileInput.value = '';
                if (previewContainer) {
                    previewContainer.innerHTML = '';
                    previewContainer.classList.add('hidden');
                    previewContainer.classList.remove('flex');
                }
                // Realtime subscription will auto-render new message
                // But we also do an immediate re-fetch in case realtime is delayed
                await this._loadAndRenderConversation(this.selectedTicketDbId);
                this.renderChatSidebar();
            }
        } catch (err) {
            if (window.DEBUG) window.DEBUG.error('TICKET-SUPPORT', 'handleSendMessage exception', err);
        } finally {
            if (submitBtn) { submitBtn.disabled = false; }
        }
    }
    /* END handleSendMessage */
}

/**
 * CategoryDrawer (Child Class)
 * Controls the persistent collapsible sidebar/drawer panel and active states.
 */
class CategoryDrawer {
    constructor(app) {
        this.app = app;
        this.drawerEl = document.getElementById('category-drawer');
        this.toggleBtns = document.querySelectorAll('.toggle-category-drawer');
        this.categoryBtns = document.querySelectorAll('.category-btn');
    }

    init() {
        if (!this.drawerEl) return;
        this.toggleBtns.forEach(btn => btn.addEventListener('click', () => this.toggle()));
        this.categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.getAttribute('data-category');
                this.setActiveCategoryUI(category);
                this.app.setCategory(category, 'drawer');
            });
        });
        this.setActiveCategoryUI('All');
    }

    toggle() {
        const isCollapsed = this.drawerEl.classList.toggle('w-0');
        this.drawerEl.classList.toggle('w-72', !isCollapsed);
        this.drawerEl.classList.toggle('p-5', !isCollapsed);
        this.drawerEl.classList.toggle('p-0', isCollapsed);
        this.drawerEl.classList.toggle('border', !isCollapsed);
        this.drawerEl.classList.toggle('border-0', isCollapsed);
        this.drawerEl.classList.toggle('opacity-0', isCollapsed);
        this.drawerEl.classList.toggle('pointer-events-none', isCollapsed);
        this.toggleBtns.forEach(btn => btn.classList.toggle('text-blue-600', !isCollapsed));
        if (window.DEBUG) window.DEBUG.log('TICKET-SUPPORT', `Category drawer toggled. Collapsed: ${isCollapsed}`);
    }

    setActiveCategoryUI(category) {
        this.categoryBtns.forEach(btn => {
            const btnCategory = btn.getAttribute('data-category');
            if (btnCategory === category) {
                btn.className = 'category-btn flex items-center justify-between w-full p-2.5 rounded-lg text-left text-gray-950 hover:text-gray-950 dark:text-white dark:hover:text-white bg-blue-50/70 dark:bg-blue-950/20 transition-all duration-200 cursor-pointer font-black text-sm border-l-4 border-blue-600 dark:border-blue-500 pl-2';
                const badge = btn.querySelector('.category-badge');
                if (badge) badge.className = 'category-badge text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white dark:bg-blue-500 dark:text-white';
            } else {
                btn.className = 'category-btn flex items-center justify-between w-full p-2.5 rounded-lg text-left text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 cursor-pointer font-medium text-sm';
                const badge = btn.querySelector('.category-badge');
                if (badge) badge.className = 'category-badge text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
            }
        });

        const h1Header = document.getElementById('selected-category-title');
        if (h1Header) h1Header.textContent = category;
    }

    renderBadges(counts) {
        this.categoryBtns.forEach(btn => {
            const category = btn.getAttribute('data-category');
            const badge = btn.querySelector('.category-badge');
            if (badge && counts[category] !== undefined) badge.textContent = counts[category];
        });
    }
}

/**
 * TicketTable (Child Class)
 * Controls ticket rendering, searching, filtering, and table header sorting.
 */
class TicketTable {
    constructor(app) {
        this.app = app;
        this.tbodyEl = document.getElementById('tickets-table-body');
        this.searchEl = document.getElementById('search-tickets');
        this.typeFilterEl = document.getElementById('filter-type');
        this.dateFilterEl = document.getElementById('filter-date');
        this.priorityFilterEl = document.getElementById('filter-priority');
        this.sortHeaders = document.querySelectorAll('th[data-sort]');
        this.currentSortColumn = 'id';
        this.currentSortDirection = 'asc';
    }

    init() {
        if (!this.tbodyEl) return;
        this.searchEl?.addEventListener('input', (e) => { this.app.searchQuery = e.target.value.toLowerCase().trim(); this.render(); });
        this.typeFilterEl?.addEventListener('change', (e) => { this.app.setCategory(e.target.value, 'dropdown'); });
        this.dateFilterEl?.addEventListener('change', (e) => { this.app.dateFilter = e.target.value; this.render(); });
        this.priorityFilterEl?.addEventListener('change', (e) => { this.app.priorityFilter = e.target.value; this.render(); });

        this.sortHeaders.forEach(th => {
            th.classList.add('cursor-pointer', 'select-none', 'group');
            th.addEventListener('click', () => this.handleSort(th.getAttribute('data-sort'), true));
        });
        this.render();
    }

    handleSort(column, toggle = true) {
        if (toggle && this.currentSortColumn === column) {
            this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSortColumn = column;
            this.currentSortDirection = 'asc';
        }
        this.sortHeaders.forEach(th => {
            const thColumn = th.getAttribute('data-sort');
            const iconContainer = th.querySelector('.sort-icon-container');
            if (!iconContainer) return;
            if (thColumn === this.currentSortColumn) {
                iconContainer.innerHTML = this.currentSortDirection === 'asc'
                    ? `<svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5"></path></svg>`
                    : `<svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"></path></svg>`;
            } else {
                iconContainer.innerHTML = `<svg class="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"></path></svg>`;
            }
        });
        this.render();
    }

    getPriorityBadge(priority) {
        let classes = '';
        switch (priority) {
            case 'High': classes = 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50'; break;
            case 'Medium': classes = 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'; break;
            default: classes = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'; break;
        }
        return `<span class="inline-flex items-center border font-semibold px-2.5 py-1 rounded-md text-xs select-none ${classes}">${esc(priority)}</span>`;
    }

    getStatusBadge(status) {
        let classes = '';
        switch (status) {
            case 'Open': classes = 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'; break;
            case 'Pending': classes = 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'; break;
            case 'Closed': classes = 'bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700/50'; break;
            default: classes = 'bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700/50'; break;
        }
        return `<span class="inline-flex items-center border font-semibold px-2.5 py-1 rounded-md text-xs select-none ${classes}">${esc(status)}</span>`;
    }

    render() {
        if (!this.tbodyEl) return;

        // Update Table Header Text dynamically based on active category
        const isClosedView = this.app.selectedCategory === 'Closed Tickets';
        const headerPrioritySpan = document.querySelector('th[data-sort="priority"] span');
        if (headerPrioritySpan) {
            headerPrioritySpan.textContent = isClosedView ? 'STATUS' : 'PRIORITY';
        }

        let filtered = this.app.tickets.filter(ticket => {
            if (isClosedView) {
                if (ticket.status !== 'Closed') return false;
            } else {
                if (ticket.status === 'Closed') return false;
                if (this.app.selectedCategory !== 'All' && ticket.category !== this.app.selectedCategory) return false;
            }

            if (this.app.priorityFilter !== 'All' && ticket.priority !== this.app.priorityFilter) return false;
            if (this.app.dateFilter !== 'All') {
                const ticketDate = new Date(ticket.rawCreatedAt || ticket.date);
                const now = new Date();
                if (this.app.dateFilter === 'today') {
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    if (ticketDate < today) return false;
                } else if (this.app.dateFilter === 'week') {
                    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    if (ticketDate < week) return false;
                } else if (this.app.dateFilter === 'month') {
                    const month = new Date(now.getFullYear(), now.getMonth(), 1);
                    if (ticketDate < month) return false;
                }
            }
            if (this.app.searchQuery) {
                const term = this.app.searchQuery;
                return ticket.id.toLowerCase().includes(term) ||
                    ticket.subject.toLowerCase().includes(term) ||
                    ticket.implementor.toLowerCase().includes(term);
            }
            return true;
        });

        filtered.sort((a, b) => {
            let fieldA = String(a[this.currentSortColumn] || '').toLowerCase();
            let fieldB = String(b[this.currentSortColumn] || '').toLowerCase();
            if (this.currentSortColumn === 'date') {
                fieldA = new Date(a.rawCreatedAt || a.date).getTime();
                fieldB = new Date(b.rawCreatedAt || b.date).getTime();
            } else if (this.currentSortColumn === 'lastActivity') {
                fieldA = new Date(a.rawLastActivity || 0).getTime();
                fieldB = new Date(b.rawLastActivity || 0).getTime();
            }
            if (fieldA < fieldB) return this.currentSortDirection === 'asc' ? -1 : 1;
            if (fieldA > fieldB) return this.currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        if (filtered.length === 0) {
            this.tbodyEl.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            <span class="text-sm font-semibold">No tickets found matching current filters.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach(ticket => {
            const unreadBadge = ticket.unreadCount > 0
                ? `<span class="absolute top-2.5 left-1 inline-flex items-center justify-center min-w-[15px] h-[15px] px-0.5 text-[8px] font-bold text-white bg-red-600 rounded-md shadow-sm select-none animate-pulse">${ticket.unreadCount}</span>`
                : '';

            html += `
                <tr data-ticket-id="${esc(ticket.id)}" class="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800/50 hover:bg-blue-500/[0.06] dark:hover:bg-blue-500/10 transition-colors duration-200 cursor-pointer">
                    <td class="px-6 py-4 font-mono font-bold text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap relative">
                        ${unreadBadge}
                        <span>${esc(ticket.id)}</span>
                    </td>
                    <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white max-w-xs truncate" title="${esc(ticket.subject)}">${esc(ticket.subject)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${isClosedView ? this.getStatusBadge(ticket.status) : this.getPriorityBadge(ticket.priority)}</td>
                    <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">${esc(ticket.implementor)}</td>
                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">${esc(ticket.date)}</td>
                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">${esc(ticket.lastActivity)}</td>
                </tr>
            `;
        });
        this.tbodyEl.innerHTML = html;

        this.tbodyEl.querySelectorAll('tr').forEach(tr => {
            if (tr.querySelector('td[colspan]')) return;
            tr.addEventListener('click', () => {
                const ticketId = tr.getAttribute('data-ticket-id');
                this.app.openTicket(ticketId);
            });
        });
    }
}

const initTicketApp = () => {
    if (document.getElementById('category-drawer') || document.getElementById('tickets-table-body')) {
        const app = new TicketSupportApp();
        app.init();
        window.TicketSupportAppInstance = app;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTicketApp);
} else {
    initTicketApp();
}

/* END TICKET SUPPORT APP SYSTEM */










