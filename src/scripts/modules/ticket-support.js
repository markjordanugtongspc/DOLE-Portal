/* START TICKET SUPPORT APP SYSTEM */

// Mock Database for Tickets
const MOCK_TICKETS = [
    { id: 'TK-2401', subject: 'Access Denied to GIP Payroll System', priority: 'High', implementor: 'Juan Dela Cruz', date: '2026-07-01', lastActivity: '2 hours ago', category: 'Support Requests', unreadCount: 2, status: 'Open', team: 'Technical Support', notes: 'User reported 403 Forbidden error on GIP payroll.' },
    { id: 'TK-2402', subject: 'Implementor dropdown search crash', priority: 'High', implementor: 'Cardo Dalisay', date: '2026-07-02', lastActivity: '1 day ago', category: 'Bug Report', unreadCount: 0, status: 'Open', team: 'Technical Support', notes: 'Regex parsing crash due to whitespaces.' },
    { id: 'TK-2403', subject: 'Request Export to Excel for GIP roster', priority: 'Low', implementor: 'Jane Smith', date: '2026-07-03', lastActivity: '3 hours ago', category: 'Feature Request', unreadCount: 1, status: 'Pending', team: 'Customer Service', notes: 'Backlog item for data reports.' },
    { id: 'TK-2404', subject: 'Password reset for office encoder', priority: 'Medium', implementor: 'Maria Clara', date: '2026-07-04', lastActivity: 'Just now', category: 'Support Requests', unreadCount: 0, status: 'Closed', team: 'Customer Service', notes: 'Reset done to standard DoleLinamon2026!.' },
    { id: 'TK-2405', subject: 'Sidebar navigation items layout shift', priority: 'Medium', implementor: 'Robert Lim', date: '2026-07-05', lastActivity: '12 mins ago', category: 'Bug Report', unreadCount: 3, status: 'Open', team: 'Technical Support', notes: 'Layout issue on small viewports.' },
    { id: 'TK-2406', subject: 'Add filter by municipality to report', priority: 'Low', implementor: 'Pedro Penduko', date: '2026-07-05', lastActivity: '5 hours ago', category: 'Feature Request', unreadCount: 0, status: 'Pending', team: 'Technical Support', notes: 'Needs database schema updates.' },
    { id: 'TK-2407', subject: 'HR portal file upload size limit increase', priority: 'High', implementor: 'Alyana Arevalo', date: '2026-07-06', lastActivity: '2 days ago', category: 'Support Requests', unreadCount: 0, status: 'Closed', team: 'Customer Service', notes: 'Increased to 50MB handbooks limit.' },
    { id: 'TK-2408', subject: 'Dark mode contrast issues in staff profile', priority: 'Medium', implementor: 'Lola Basyang', date: '2026-07-07', lastActivity: '4 hours ago', category: 'Bug Report', unreadCount: 0, status: 'Open', team: 'Technical Support', notes: 'Contrast styling issues on table heads.' }
];

// Mock Conversation Messages for each Ticket
const MOCK_CONVERSATIONS = {
    'TK-2401': [
        { sender: 'Juan Dela Cruz', avatar: 'https://ui-avatars.com/api/?name=Juan+Dela+Cruz&background=random', time: '10:15 AM', type: 'text', content: 'Hi Admin, I cannot access the GIP payroll dashboard. It shows 403 Forbidden. Can you help?' },
        { sender: 'Admin', avatar: 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff', time: '10:20 AM', type: 'text', content: 'Hello Juan, let me check your account configuration. I will update you in a few minutes.' },
        { sender: 'Juan Dela Cruz', avatar: 'https://ui-avatars.com/api/?name=Juan+Dela+Cruz&background=random', time: '10:22 AM', type: 'file', fileName: 'GIP_Payroll_Error_Log.pdf', fileSize: '1.2 MB', filePages: '2 Pages' },
        { sender: 'Admin', avatar: 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff', time: '10:30 AM', type: 'text', content: 'Done. I\'ve reset your permission groups. Can you try logging in again?' },
        { sender: 'Juan Dela Cruz', avatar: 'https://ui-avatars.com/api/?name=Juan+Dela+Cruz&background=random', time: '10:32 AM', type: 'text', content: 'It works perfectly now! Thanks for the quick support. 😅' }
    ],
    'TK-2402': [
        { sender: 'Cardo Dalisay', avatar: 'https://ui-avatars.com/api/?name=Cardo+Dalisay&background=random', time: 'Yesterday', type: 'text', content: 'The search dropdown on the implementors table crashes when typing spaces.' },
        { sender: 'Admin', avatar: 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff', time: 'Yesterday', type: 'text', content: 'Hello Cardo, we found the issue. It was a RegExp parsing error with whitespace. Here is the console crash log screenshot.' },
        { sender: 'Cardo Dalisay', avatar: 'https://ui-avatars.com/api/?name=Cardo+Dalisay&background=random', time: 'Yesterday', type: 'image', imageUrl: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=300', content: 'Here is the screenshot' }
    ],
    'TK-2403': [
        { sender: 'Jane Smith', avatar: 'https://ui-avatars.com/api/?name=Jane+Smith&background=random', time: '2 days ago', type: 'text', content: 'Can we have an excel export button on the admin dashboard? It would save us a lot of time.' },
        { sender: 'Admin', avatar: 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff', time: '2 days ago', type: 'link', content: 'Check out this open-source UI component library based on Tailwind CSS:', url: 'https://github.com/themesberg/flowbite', previewImage: 'https://flowbite.com/docs/images/og-image.png', previewTitle: 'GitHub - themesberg/flowbite: The most popular and open source library...', previewDomain: 'github.com' }
    ],
    'TK-2404': [
        { sender: 'Maria Clara', avatar: 'https://ui-avatars.com/api/?name=Maria+Clara&background=random', time: '3 days ago', type: 'text', content: 'Here are the design assets for the new Linamon portal updates.' },
        { sender: 'Maria Clara', avatar: 'https://ui-avatars.com/api/?name=Maria+Clara&background=random', time: '3 days ago', type: 'gallery', images: [
            'https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=150',
            'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=150',
            'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?q=80&w=150'
        ], content: 'Here are the templates.' }
    ],
    'TK-2405': [
        { sender: 'Robert Lim', avatar: 'https://ui-avatars.com/api/?name=Robert+Lim&background=random', time: '12 mins ago', type: 'text', content: 'The sidebar navigation items shift out of place when expanding the drawer.' },
        { sender: 'Robert Lim', avatar: 'https://ui-avatars.com/api/?name=Robert+Lim&background=random', time: '12 mins ago', type: 'text', content: 'Any ETA on the fix?' },
        { sender: 'Robert Lim', avatar: 'https://ui-avatars.com/api/?name=Robert+Lim&background=random', time: '12 mins ago', type: 'text', content: 'It happens specifically on 13-inch displays.' }
    ],
    'TK-2406': [
        { sender: 'Pedro Penduko', avatar: 'https://ui-avatars.com/api/?name=Pedro+Penduko&background=random', time: '5 hours ago', type: 'text', content: 'Can we add a filter by municipality to the generated report? I have to do it manually in Excel right now.' }
    ],
    'TK-2407': [
        { sender: 'Alyana Arevalo', avatar: 'https://ui-avatars.com/api/?name=Alyana+Arevalo&background=random', time: '2 days ago', type: 'text', content: 'I get an error when uploading the HR handbook PDF.' },
        { sender: 'Admin', avatar: 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff', time: '2 days ago', type: 'text', content: 'The file upload limit has been increased to 50MB. Can you try again?' }
    ],
    'TK-2408': [
        { sender: 'Lola Basyang', avatar: 'https://ui-avatars.com/api/?name=Lola+Basyang&background=random', time: '4 hours ago', type: 'text', content: 'The text in the staff profile page is invisible when dark mode is turned on.' }
    ]
};

// Mock Database for Knowledge Base Articles
const MOCK_KB_ARTICLES = {
    'kb-art-1': {
        title: 'Account Creation and Management',
        category: 'Article',
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
        title: 'Configuring GIP Payroll Options',
        category: 'Tutorial',
        readTime: '5 Minutes read',
        summary: 'Guide to diagnosing user access tokens, resetting 403 Forbidden permission errors, and editing municipal payroll lists correctly.',
        suggestText: 'I\'ll just need to gather a bit more information. Then we can schedule a quick assessment and propose a solution. Wait i\'ll send you the reset link.'
    },
    'kb-art-4': {
        title: 'Resetting Staff Account Credentials',
        category: 'FAQ',
        readTime: '3 Minutes read',
        summary: 'Procedures for managing passwords, resetting user profiles, and generating temporary security passes for office staff and implementors.',
        suggestText: 'Temporary password reset: default credentials have been configured as DoleLinamon2026!. Please ask the staff to change it immediately after login.'
    }
};

/**
 * TicketSupportApp (Parent Class)
 * Manages the high-level application state, communication between components, and initialization.
 */
class TicketSupportApp {
    /* START constructor */
    constructor() {
        if (window.DEBUG) {
            window.DEBUG.log('TICKET-SUPPORT', 'Initializing TicketSupportApp...');
        }
        this.tickets = [...MOCK_TICKETS].map(t => ({
            ...t,
            tags: t.tags || ['Question', 'Problem']
        }));
        this.selectedCategory = 'All';
        this.searchQuery = '';
        this.priorityFilter = 'All';
        this.dateFilter = 'All';

        // Chat View states
        this.activeView = 'table'; // 'table' or 'chat'
        this.selectedTicketId = null;
        this.chatSearchQuery = '';
        this.chatSortDirection = 'newest';
        this.activeDetailsTab = 'details'; // 'details' or 'kb'

        // Child components
        this.drawer = new CategoryDrawer(this);
        this.table = new TicketTable(this);
    }
    /* END constructor */

    /* START init */
    async init() {
        this.drawer.init();
        this.table.init();
        this.updateBadgeCounts();
        await this.populateFilterDropdowns();
        this.bindChatViewEvents();

        // Check URL or localStorage for ticket query parameters to auto-open ticket on load/refresh
        const urlParams = new URLSearchParams(window.location.search);
        let ticketIdFromUrl = urlParams.get('ticket') || urlParams.get('id');
        if (!ticketIdFromUrl) {
            const rawSearch = decodeURIComponent(window.location.search);
            const match = rawSearch.match(/(TK-\d+|TC-\d+)/i);
            if (match) {
                ticketIdFromUrl = match[1].toUpperCase();
            }
        }
        if (!ticketIdFromUrl) {
            ticketIdFromUrl = localStorage.getItem('active-ticket-id');
        }
        if (ticketIdFromUrl) {
            const ticketExists = this.tickets.some(t => t.id === ticketIdFromUrl);
            if (ticketExists) {
                this.openTicket(ticketIdFromUrl);
            }
        }

        if (window.DEBUG) {
            window.DEBUG.success('TICKET-SUPPORT', 'TicketSupportApp fully initialized.');
        }
    }
    /* END init */

    /* START fetchFilterOptions */
    async fetchFilterOptions() {
        // Simulating Supabase / Backend API fetch delay
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    types: ['Support Requests', 'Bug Report', 'Feature Request'],
                    priorities: ['High', 'Medium', 'Low'],
                    dates: [
                        { label: 'Today (July 7)', value: 'today' },
                        { label: 'Last 7 Days', value: 'week' },
                        { label: 'This Month', value: 'month' }
                    ]
                });
            }, 300);
        });
    }
    /* END fetchFilterOptions */

    /* START populateFilterDropdowns */
    async populateFilterDropdowns() {
        try {
            const data = await this.fetchFilterOptions();

            // Populate Types
            const typeSelect = document.getElementById('filter-type');
            if (typeSelect) {
                data.types.forEach(type => {
                    const opt = document.createElement('option');
                    opt.value = type;
                    opt.textContent = type;
                    typeSelect.appendChild(opt);
                });
            }

            // Populate Priorities
            const prioritySelect = document.getElementById('filter-priority');
            if (prioritySelect) {
                data.priorities.forEach(priority => {
                    const opt = document.createElement('option');
                    opt.value = priority;
                    opt.textContent = priority;
                    prioritySelect.appendChild(opt);
                });
            }

            // Populate Dates
            const dateSelect = document.getElementById('filter-date');
            if (dateSelect) {
                data.dates.forEach(date => {
                    const opt = document.createElement('option');
                    opt.value = date.value;
                    opt.textContent = date.label;
                    dateSelect.appendChild(opt);
                });
            }
        } catch (err) {
            if (window.DEBUG) {
                window.DEBUG.error('TICKET-SUPPORT', 'Failed populating dropdown filters', err);
            }
        }
    }
    /* END populateFilterDropdowns */

    /* START updateBadgeCounts */
    updateBadgeCounts() {
        const counts = {
            'All': this.tickets.length,
            'Support Requests': this.tickets.filter(t => t.category === 'Support Requests').length,
            'Bug Report': this.tickets.filter(t => t.category === 'Bug Report').length,
            'Feature Request': this.tickets.filter(t => t.category === 'Feature Request').length
        };

        this.drawer.renderBadges(counts);
    }
    /* END updateBadgeCounts */

    /* START setCategory */
    setCategory(category, origin = 'drawer') {
        this.selectedCategory = category;
        
        // Sync Type select value if the change originated from the drawer
        if (origin === 'drawer') {
            const typeSelect = document.getElementById('filter-type');
            if (typeSelect && typeSelect.value !== category) {
                typeSelect.value = category;
            }
        } else if (origin === 'dropdown') {
            // Highlight the correct category button in drawer if dropdown changed
            this.drawer.setActiveCategoryUI(category);
        }

        this.table.render();
    }
    /* END setCategory */

    /* START bindChatViewEvents */
    bindChatViewEvents() {
        // Back to Table Button
        const backBtn = document.getElementById('btn-back-to-table');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.closeTicket());
        }

        // Close Chat Button
        const closeBtn = document.getElementById('btn-close-chat');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeTicket());
        }

        // Chat Sidebar Search
        const chatSearch = document.getElementById('chat-search-tickets');
        if (chatSearch) {
            chatSearch.addEventListener('input', (e) => {
                this.chatSearchQuery = e.target.value.toLowerCase().trim();
                this.renderChatSidebar();
            });
        }

        // Chat Sidebar Sort Dropdown
        const chatSort = document.getElementById('chat-sort-dropdown');
        if (chatSort) {
            chatSort.addEventListener('change', (e) => {
                this.chatSortDirection = e.target.value;
                this.renderChatSidebar();
            });
        }

        // Chat Message Submit Form
        const inputForm = document.getElementById('chat-input-form');
        if (inputForm) {
            inputForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSendMessage();
            });
        }

        // Right details panel Tab switching
        const tabBtnDetails = document.getElementById('tab-btn-details');
        const tabBtnKb = document.getElementById('tab-btn-kb');
        if (tabBtnDetails && tabBtnKb) {
            tabBtnDetails.addEventListener('click', () => this.switchDetailsTab('details'));
            tabBtnKb.addEventListener('click', () => this.switchDetailsTab('kb'));
        }

        // Details Panel Assignee input
        const detailsAssignee = document.getElementById('details-assignee');
        if (detailsAssignee) {
            detailsAssignee.addEventListener('change', (e) => {
                const val = e.target.value;
                const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
                if (ticket) {
                    ticket.implementor = val;
                    // Update attributes UI
                    document.getElementById('attr-cust-name').textContent = val;
                    document.getElementById('attr-cust-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(val)}&background=random`;
                    this.renderChatSidebar();
                    this.table.render();
                }
            });
        }

        // Details Panel Team input
        const detailsTeam = document.getElementById('details-team');
        if (detailsTeam) {
            detailsTeam.addEventListener('change', (e) => {
                const val = e.target.value;
                const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
                if (ticket) {
                    ticket.team = val;
                }
            });
        }

        // Details Panel Ticket Type input
        const detailsType = document.getElementById('details-type');
        if (detailsType) {
            detailsType.addEventListener('change', (e) => {
                const val = e.target.value;
                const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
                if (ticket) {
                    ticket.category = val;
                    this.updateBadgeCounts();
                    this.table.render();
                }
            });
        }

        // Details Panel Status input
        const detailsStatus = document.getElementById('details-status');
        if (detailsStatus) {
            detailsStatus.addEventListener('change', (e) => {
                const val = e.target.value;
                const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
                if (ticket) {
                    ticket.status = val;
                }
            });
        }

        // Details Panel Subject input
        const detailsSubject = document.getElementById('details-subject');
        if (detailsSubject) {
            detailsSubject.addEventListener('input', (e) => {
                const val = e.target.value;
                const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
                if (ticket) {
                    ticket.subject = val;
                    // Update main header subject & side list & main table list
                    document.getElementById('chat-header-ticket-subject').textContent = val;
                    this.renderChatSidebar();
                    this.table.render();
                }
            });
        }

        // Details Panel Priority buttons
        const priorityPills = document.querySelectorAll('.priority-pill');
        priorityPills.forEach(pill => {
            pill.addEventListener('click', () => {
                const priority = pill.getAttribute('data-priority-btn');
                const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
                if (ticket) {
                    ticket.priority = priority;
                    this.updatePriorityPillsUI(priority);
                    this.table.render();
                }
            });
        });

        // Details Panel Notes input
        const detailsNotes = document.getElementById('details-notes');
        if (detailsNotes) {
            detailsNotes.addEventListener('input', (e) => {
                const val = e.target.value;
                const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
                if (ticket) {
                    ticket.notes = val;
                }
            });
        }

        // Knowledge Base Article Cards Popover click trigger
        const kbArticles = document.querySelectorAll('[data-kb-id]');
        kbArticles.forEach(art => {
            art.addEventListener('click', () => {
                const kbId = art.getAttribute('data-kb-id');
                this.showKBArticlePopover(kbId, art);
            });
        });
    }
    /* END bindChatViewEvents */

    /* START openTicket */
    openTicket(ticketId) {
        this.selectedTicketId = ticketId;
        this.activeView = 'chat';

        // Update URL dynamically without page reload
        const cleanUrl = `${window.location.pathname}?ticket=${ticketId}`;
        window.history.pushState({ ticketId }, '', cleanUrl);

        // Save active ticket to localStorage
        localStorage.setItem('active-ticket-id', ticketId);

        // UI transitions: Hide table view containers, show chat containers
        document.getElementById('table-breadcrumbs').classList.add('hidden');
        document.getElementById('table-view-container').classList.add('hidden');
        document.getElementById('chat-breadcrumbs').classList.remove('hidden');
        document.getElementById('chat-view-container').classList.remove('hidden');

        // Update Breadcrumb contents
        const ticket = this.tickets.find(t => t.id === ticketId);
        if (ticket) {
            document.getElementById('chat-header-ticket-id').textContent = ticket.id;
            document.getElementById('chat-header-ticket-subject').textContent = ticket.subject;

            // Clear unread counts upon viewing
            ticket.unreadCount = 0;
            this.updateBadgeCounts();

            // Populate the right side details panel inputs
            const detailsAssignee = document.getElementById('details-assignee');
            if (detailsAssignee) detailsAssignee.value = ticket.implementor;

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

            // Populate attributes block
            document.getElementById('attr-id').textContent = ticket.id;
            document.getElementById('attr-cust-name').textContent = ticket.implementor;
            document.getElementById('attr-cust-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.implementor)}&background=random`;
            document.getElementById('attr-date').textContent = ticket.date;

            // Highlight priority selector buttons
            this.updatePriorityPillsUI(ticket.priority);

            // Render ticket tags
            this.renderTags(ticket);
        }

        // Return to standard details tab when opening a new ticket
        this.switchDetailsTab('details');

        // Hide popover if open
        const popover = document.getElementById('kb-article-popover');
        if (popover) popover.classList.add('hidden');

        this.renderChatSidebar();
        this.renderConversation(ticketId);

        // Auto-scroll the sidebar list to center or show the active ticket item
        setTimeout(() => {
            const activeItem = document.querySelector(`[data-chat-id="${ticketId}"]`);
            if (activeItem) {
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 100);
    }
    /* END openTicket */

    /* START closeTicket */
    closeTicket() {
        this.activeView = 'table';
        this.selectedTicketId = null;

        // Reset URL query parameter
        const cleanUrl = window.location.pathname;
        window.history.pushState({}, '', cleanUrl);

        // Remove active ticket from localStorage
        localStorage.removeItem('active-ticket-id');

        // UI transitions: Hide chat containers, show table containers
        document.getElementById('chat-breadcrumbs').classList.add('hidden');
        document.getElementById('chat-view-container').classList.add('hidden');
        document.getElementById('table-breadcrumbs').classList.remove('hidden');
        document.getElementById('table-view-container').classList.remove('hidden');

        // Hide KB Popover
        const popover = document.getElementById('kb-article-popover');
        if (popover) popover.classList.add('hidden');

        this.table.render();
    }
    /* END closeTicket */

    /* START renderTags */
    renderTags(ticket) {
        const container = document.getElementById('details-tags-container');
        if (!container) return;

        let html = '';
        const tags = ticket.tags || [];
        tags.forEach((tag, idx) => {
            html += `
                <span class="inline-flex items-center gap-1 text-[10px] font-bold bg-gray-900 text-white dark:bg-gray-950 dark:text-white px-2 py-0.5 rounded-md">
                    ${tag} <button type="button" class="cursor-pointer text-gray-400 hover:text-white font-bold select-none remove-tag-btn" data-tag-idx="${idx}">×</button>
                </span>
            `;
        });

        // Add inline input to add tags
        html += `
            <input type="text" id="details-tags-input" class="bg-transparent border-0 outline-none text-[10px] text-gray-900 dark:text-white p-0 focus:ring-0 flex-1 min-w-[60px]" placeholder="+ Add tag..." />
        `;
        container.innerHTML = html;

        // Bind delete events
        container.querySelectorAll('.remove-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-tag-idx'));
                ticket.tags.splice(idx, 1);
                this.renderTags(ticket);
            });
        });

        // Bind keypress for Enter key on the inline tags input
        const input = document.getElementById('details-tags-input');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const newTag = input.value.trim();
                    if (newTag) {
                        if (!ticket.tags) ticket.tags = [];
                        if (!ticket.tags.includes(newTag)) {
                            ticket.tags.push(newTag);
                        }
                        this.renderTags(ticket);
                    }
                }
            });
        }
    }
    /* END renderTags */

    /* START updatePriorityPillsUI */
    updatePriorityPillsUI(priority) {
        const priorityPills = document.querySelectorAll('.priority-pill');
        priorityPills.forEach(pill => {
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

        // Hide KB Popover on tab switches
        if (popover) popover.classList.add('hidden');

        // Remove active highlights on KB articles
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

        // Set popover details
        document.getElementById('popover-badge').textContent = article.category;
        document.getElementById('popover-readtime').textContent = article.readTime;
        document.getElementById('popover-title').textContent = article.title;
        document.getElementById('popover-summary').textContent = article.summary;

        // Highlight clicked article item card
        document.querySelectorAll('[data-kb-id]').forEach(card => {
            const cardId = card.getAttribute('data-kb-id');
            if (cardId === kbId) {
                card.className = 'flex gap-2.5 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 cursor-pointer border border-blue-200 dark:border-blue-800 transition-all duration-200 shadow-xs';
            } else {
                card.className = 'flex gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/55 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-all duration-200';
            }
        });

        // Clean event listeners by replacing buttons
        const suggestBtn = document.getElementById('popover-btn-suggest');
        const editBtn = document.getElementById('popover-btn-edit');
        const closeBtn = document.getElementById('popover-btn-close');

        const newSuggestBtn = suggestBtn.cloneNode(true);
        suggestBtn.parentNode.replaceChild(newSuggestBtn, suggestBtn);

        const newEditBtn = editBtn.cloneNode(true);
        editBtn.parentNode.replaceChild(newEditBtn, editBtn);

        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

        // Click handler: suggest text template insertion into editor
        newSuggestBtn.addEventListener('click', () => {
            const editor = document.getElementById('chat-editor');
            if (editor) {
                editor.value = article.suggestText;
                editor.focus();
            }
            popover.classList.add('hidden');
            // Reset active card highlights
            document.querySelectorAll('[data-kb-id]').forEach(card => {
                card.className = 'flex gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/55 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-colors';
            });
        });

        // Click handler: SweetAlert2 edit warning
        newEditBtn.addEventListener('click', () => {
            if (window.Swal) {
                window.Swal.fire({
                    title: 'Access Restricted',
                    text: `Editing article "${article.title}" requires higher credentials than standard portal admin access.`,
                    icon: 'warning',
                    confirmButtonText: 'Acknowledge',
                    confirmButtonColor: '#3b82f6',
                    customClass: {
                        confirmButton: 'cursor-pointer text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg font-bold text-sm shadow-xs border-0 select-none'
                    }
                });
            } else {
                alert('Access Restricted. High admin credentials required.');
            }
        });

        // Click handler: Close popover
        newCloseBtn.addEventListener('click', () => {
            popover.classList.add('hidden');
            document.querySelectorAll('[data-kb-id]').forEach(card => {
                card.className = 'flex gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/55 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-colors';
            });
        });

        // Toggle popover visible
        popover.classList.remove('hidden');

        // Dynamically position the popover relative to the clicked article element
        if (element) {
            const container = document.getElementById('chat-view-container');
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const elemRect = element.getBoundingClientRect();
                let topPos = elemRect.top - containerRect.top;

                const popoverHeight = popover.offsetHeight;
                const containerHeight = container.clientHeight;

                // Keep popover within container boundaries
                if (topPos + popoverHeight > containerHeight) {
                    topPos = Math.max(10, containerHeight - popoverHeight - 16);
                }
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

        // 1. Filter tickets list based on search query
        let filtered = this.tickets.filter(ticket => {
            if (this.chatSearchQuery) {
                const query = this.chatSearchQuery;
                return ticket.id.toLowerCase().includes(query) || 
                       ticket.subject.toLowerCase().includes(query) || 
                       ticket.implementor.toLowerCase().includes(query);
            }
            return true;
        });

        // 2. Sort tickets list
        filtered.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return this.chatSortDirection === 'newest' ? dateB - dateA : dateA - dateB;
        });

        // Update total ticket count element
        document.getElementById('chat-tickets-count').textContent = filtered.length;

        // 3. Render HTML
        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center py-8 text-xs text-gray-500">No chats match search query.</div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(ticket => {
            const isActive = ticket.id === this.selectedTicketId;
            const activeClass = isActive 
                ? 'bg-blue-50/70 dark:bg-blue-950/20 border-l-4 border-blue-600 dark:border-blue-500 pl-2 font-black' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-800/60 pl-3';

            const unreadBadge = ticket.unreadCount > 0 
                ? `<span class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-md shadow-sm">
                        ${ticket.unreadCount}
                   </span>`
                : '';

            html += `
                <div data-chat-id="${ticket.id}" class="cursor-pointer p-3 rounded-lg border border-transparent transition-all duration-200 ${activeClass}">
                    <div class="flex items-start gap-2.5">
                        <img class="w-8 h-8 rounded-full object-cover" src="https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.implementor)}&background=random" alt="Avatar">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-start justify-between">
                                <div class="flex flex-col">
                                    <span class="text-xs font-bold text-gray-900 dark:text-white leading-none mb-1">${ticket.id}</span>
                                    <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">${ticket.implementor}</div>
                                </div>
                                <div class="flex flex-col items-end gap-1.5 shrink-0">
                                    <span class="text-[10px] text-gray-400 dark:text-gray-500 leading-none">${ticket.lastActivity}</span>
                                    ${unreadBadge}
                                </div>
                            </div>
                            <p class="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-1">${ticket.subject}</p>
                        </div>
                    </div>
                </div>
            `;
        });
        listContainer.innerHTML = html;

        // Bind clicks to sidebar items
        listContainer.querySelectorAll('[data-chat-id]').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-chat-id');
                this.openTicket(id);
            });
        });
    }
    /* END renderChatSidebar */

    /* START renderConversation */
    renderConversation(ticketId) {
        const viewport = document.getElementById('chat-messages-viewport');
        if (!viewport) return;

        const messages = MOCK_CONVERSATIONS[ticketId] || [];

        if (messages.length === 0) {
            // Render basic starter conversation if none exists
            viewport.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center py-12 text-gray-500 dark:text-gray-400">
                    <svg class="w-10 h-10 text-gray-300 dark:text-gray-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p class="text-sm font-semibold">No messages yet. Send a reply to start the conversation.</p>
                </div>
            `;
            return;
        }

        let html = '';
        messages.forEach((msg, idx) => {
            const isAdmin = msg.sender === 'Admin';
            
            // Layout alignment: Right for Admin, Left for Implementor/Staff
            const bubbleAlign = isAdmin ? 'justify-end' : 'justify-start';
            const flexRowClass = isAdmin ? 'flex-row-reverse' : '';
            const textBg = isAdmin 
                ? 'bg-blue-600 text-white rounded-s-xl rounded-b-xl' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-e-xl rounded-b-xl';

            let bubbleContent = '';

            if (msg.type === 'text') {
                bubbleContent = `<p class="text-sm leading-normal">${msg.content}</p>`;
            } else if (msg.type === 'file') {
                bubbleContent = `
                    <div class="flex items-start bg-white/10 dark:bg-gray-900/40 rounded-lg p-2.5 max-w-xs border border-white/10 dark:border-gray-700/50">
                        <div class="me-2.5">
                            <span class="flex items-center gap-2 text-sm font-medium text-current pb-1.5">
                                <svg fill="none" aria-hidden="true" class="w-5 h-5 shrink-0" viewBox="0 0 20 21">
                                    <g clip-path="url(#clip0_3173_1381)">
                                        <path fill="#E2E5E7" d="M5.024.5c-.688 0-1.25.563-1.25 1.25v17.5c0 .688.562 1.25 1.25 1.25h12.5c.687 0 1.25-.563 1.25-1.25V5.5l-5-5h-8.75z"/>
                                        <path fill="#B0B7BD" d="M15.024 5.5h3.75l-5-5v3.75c0 .688.562 1.25 1.25 1.25z"/>
                                        <path fill="#CAD1D8" d="M18.774 9.25l-3.75-3.75h3.75v3.75z"/>
                                        <path fill="#F15642" d="M16.274 16.75a.627.627 0 01-.625.625H1.899a.627.627 0 01-.625-.625V10.5c0-.344.281-.625.625-.625h13.75c.344 0 .625.281.625.625v6.25z"/>
                                        <path fill="#fff" d="M3.998 12.342c0-.165.13-.345.34-.345h1.154c.65 0 1.235.435 1.235 1.269 0 .79-.585 1.23-1.235 1.23h-.834v.66c0 .22-.14.344-.32.344a.337.337 0 01-.34-.344v-2.814zm.66.284v1.245h.834c.335 0 .6-.295.6-.605 0-.35-.265-.64-.6-.64h-.834zM7.706 15.5c-.165 0-.345-.09-.345-.31v-2.838c0-.18.18-.31.345-.31H8.85c2.284 0 2.234 3.458.045 3.458h-1.19zm.315-2.848v2.239h.83c1.349 0 1.409-2.24 0-2.24h-.83zM11.894 13.486h1.274c.18 0 .36.18.36.355 0 .165-.18.3-.36.3h-1.274v1.049c0 .175-.124.31-.3.31-.22 0-.354-.135-.354-.31v-2.839c0-.18.135-.31.355-.31h1.754c.22 0 .35.13.35.31 0 .16-.13.34-.35.34h-1.455v.795z"/>
                                        <path fill="#CAD1D8" d="M15.649 17.375H3.774V18h11.875a.627.627 0 00.625-.625v-.625a.627.627 0 01-.625.625z"/>
                                    </g>
                                    <defs>
                                        <clipPath id="clip0_3173_1381">
                                            <path fill="#fff" d="M0 0h20v20H0z" transform="translate(0 .5)"/>
                                        </clipPath>
                                    </defs>
                                </svg>
                                ${msg.fileName}
                            </span>
                            <span class="flex text-[10px] opacity-75 gap-1.5 font-normal">
                                ${msg.filePages} • ${msg.fileSize} • PDF
                            </span>
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
                    <p class="text-sm mb-2 font-normal">${msg.content}</p>
                    <div class="group relative max-w-[240px]">
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center z-10">
                            <button type="button" class="cursor-pointer inline-flex items-center justify-center rounded-full h-8 w-8 bg-white/30 hover:bg-white/50 transition-colors">
                                <svg class="w-4 h-4 text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2m-8 1V4m0 12-4-4m4 4 4-4"/></svg>
                            </button>
                        </div>
                        <img src="${msg.imageUrl}" class="rounded-lg object-cover w-full h-auto border border-gray-200 dark:border-gray-800" alt="Shared Image">
                    </div>
                `;
            } else if (msg.type === 'gallery') {
                let imagesHTML = '';
                msg.images.forEach((imgSrc, imgIdx) => {
                    imagesHTML += `
                        <div class="group relative">
                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center z-10">
                                <button type="button" class="cursor-pointer inline-flex items-center justify-center rounded-full h-7 w-7 bg-white/30 hover:bg-white/50 transition-colors">
                                    <svg class="w-3.5 h-3.5 text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2m-8 1V4m0 12-4-4m4 4 4-4"/></svg>
                                </button>
                            </div>
                            <img src="${imgSrc}" class="rounded-lg object-cover w-full h-24 border border-gray-200 dark:border-gray-800" alt="Gallery image">
                        </div>
                    `;
                });

                bubbleContent = `
                    <p class="text-sm mb-2 font-normal">${msg.content}</p>
                    <div class="grid grid-cols-3 gap-2 max-w-[280px]">
                        ${imagesHTML}
                    </div>
                `;
            } else if (msg.type === 'link') {
                bubbleContent = `
                    <p class="text-sm mb-2 font-normal">${msg.content}</p>
                    <p class="text-sm pb-2"><a href="${msg.url}" target="_blank" class="underline hover:no-underline break-all font-semibold text-blue-600 dark:text-blue-400">${msg.url}</a></p>
                    <a href="${msg.url}" target="_blank" class="block bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all duration-200">
                        <img src="${msg.previewImage}" class="rounded-md w-full h-28 object-cover mb-2" alt="Preview Image" />
                        <span class="text-xs font-bold text-gray-900 dark:text-white leading-tight block line-clamp-2">${msg.previewTitle}</span>
                        <p class="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1 uppercase tracking-wider">${msg.previewDomain}</p>
                    </a>
                `;
            }

            html += `
                <div class="flex items-start gap-2.5 ${bubbleAlign}">
                    <div class="flex ${flexRowClass} items-start gap-2.5 max-w-[80%]">
                        <img class="w-8 h-8 rounded-full object-cover flex-shrink-0" src="${msg.avatar}" alt="${msg.sender}">
                        <div class="flex flex-col gap-1.5">
                            <div class="flex items-center space-x-2 ${isAdmin ? 'justify-end' : 'justify-start'} rtl:space-x-reverse">
                                <span class="text-xs font-bold text-gray-900 dark:text-white">${msg.sender}</span>
                                <span class="text-[9px] text-gray-400 dark:text-gray-500">${msg.time}</span>
                            </div>
                            <div class="leading-relaxed p-4 shadow-sm ${textBg}">
                                ${bubbleContent}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        viewport.innerHTML = html;

        // Scroll to the bottom of the message viewport
        viewport.scrollTop = viewport.scrollHeight;
    }
    /* END renderConversation */

    /* START handleSendMessage */
    handleSendMessage() {
        const editor = document.getElementById('chat-editor');
        if (!editor || !this.selectedTicketId) return;

        const val = editor.value.trim();
        if (!val) return;

        // Create new message object
        const newMessage = {
            sender: 'Admin',
            avatar: 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff',
            time: 'Just now',
            type: 'text',
            content: val
        };

        // Push to conversations mock database
        if (!MOCK_CONVERSATIONS[this.selectedTicketId]) {
            MOCK_CONVERSATIONS[this.selectedTicketId] = [];
        }
        MOCK_CONVERSATIONS[this.selectedTicketId].push(newMessage);

        // Update ticket last activity
        const ticket = this.tickets.find(t => t.id === this.selectedTicketId);
        if (ticket) {
            ticket.lastActivity = 'Just now';
        }

        // Re-render conversation and sidebars
        this.renderConversation(this.selectedTicketId);
        this.renderChatSidebar();

        // Reset editor field
        editor.value = '';
    }
    /* END handleSendMessage */
}

/**
 * CategoryDrawer (Child Class of TicketSupportApp)
 * Controls the persistent collapsible sidebar/drawer panel and active states.
 */
class CategoryDrawer {
    /* START constructor */
    constructor(app) {
        this.app = app;
        this.drawerEl = document.getElementById('category-drawer');
        this.toggleBtns = document.querySelectorAll('.toggle-category-drawer');
        this.categoryBtns = document.querySelectorAll('.category-btn');
    }
    /* END constructor */

    /* START init */
    init() {
        if (!this.drawerEl) return;

        // Bind toggle buttons
        this.toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => this.toggle());
        });

        // Bind category selection click handlers
        this.categoryBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = btn.getAttribute('data-category');
                this.setActiveCategoryUI(category);
                this.app.setCategory(category, 'drawer');
            });
        });

        // Highlight default ('All') category button on start
        this.setActiveCategoryUI('All');
    }
    /* END init */

    /* START toggle */
    toggle() {
        const isCollapsed = this.drawerEl.classList.toggle('w-0');
        this.drawerEl.classList.toggle('w-72', !isCollapsed);
        this.drawerEl.classList.toggle('p-5', !isCollapsed);
        this.drawerEl.classList.toggle('p-0', isCollapsed);
        this.drawerEl.classList.toggle('border', !isCollapsed);
        this.drawerEl.classList.toggle('border-0', isCollapsed);
        this.drawerEl.classList.toggle('opacity-0', isCollapsed);
        this.drawerEl.classList.toggle('pointer-events-none', isCollapsed);

        // Toggle toggle buttons hover/active indicator if needed
        this.toggleBtns.forEach(btn => {
            btn.classList.toggle('text-blue-600', !isCollapsed);
        });

        if (window.DEBUG) {
            window.DEBUG.log('TICKET-SUPPORT', `Category drawer toggled. Collapsed: ${isCollapsed}`);
        }
    }
    /* END toggle */

    /* START setActiveCategoryUI */
    setActiveCategoryUI(category) {
        // Update active class styles for category list buttons
        this.categoryBtns.forEach(btn => {
            const btnCategory = btn.getAttribute('data-category');
            if (btnCategory === category) {
                // Add Selected styles (Bolder black / white)
                btn.className = 'category-btn flex items-center justify-between w-full p-2.5 rounded-lg text-left text-gray-950 hover:text-gray-950 dark:text-white dark:hover:text-white bg-blue-50/70 dark:bg-blue-950/20 transition-all duration-200 cursor-pointer font-black text-sm border-l-4 border-blue-600 dark:border-blue-500 pl-2';
                
                const activeBadge = btn.querySelector('.category-badge');
                if (activeBadge) {
                    activeBadge.className = 'category-badge text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white dark:bg-blue-500 dark:text-white';
                }
            } else {
                // Reset to unselected text-gray styling
                btn.className = 'category-btn flex items-center justify-between w-full p-2.5 rounded-lg text-left text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 cursor-pointer font-medium text-sm';
                
                const badge = btn.querySelector('.category-badge');
                if (badge) {
                    badge.className = 'category-badge text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
                }
            }
        });

        // Dynamically update Main content H1 header category name
        const h1Header = document.getElementById('selected-category-title');
        if (h1Header) {
            h1Header.textContent = category;
        }
    }
    /* END setActiveCategoryUI */

    /* START renderBadges */
    renderBadges(counts) {
        this.categoryBtns.forEach(btn => {
            const category = btn.getAttribute('data-category');
            const badge = btn.querySelector('.category-badge');
            if (badge && counts[category] !== undefined) {
                badge.textContent = counts[category];
            }
        });
    }
    /* END renderBadges */
}

/**
 * TicketTable (Child Class of TicketSupportApp)
 * Controls ticket rendering, searching, filtering, and table headers sorting.
 */
class TicketTable {
    /* START constructor */
    constructor(app) {
        this.app = app;
        this.tbodyEl = document.getElementById('tickets-table-body');
        this.searchEl = document.getElementById('search-tickets');
        this.typeFilterEl = document.getElementById('filter-type');
        this.dateFilterEl = document.getElementById('filter-date');
        this.priorityFilterEl = document.getElementById('filter-priority');
        this.sortHeaders = document.querySelectorAll('th[data-sort]');
        
        // Sorting state
        this.currentSortColumn = 'id';
        this.currentSortDirection = 'asc';
    }
    /* END constructor */

    /* START init */
    init() {
        if (!this.tbodyEl) return;

        // Bind search input
        if (this.searchEl) {
            this.searchEl.addEventListener('input', (e) => {
                this.app.searchQuery = e.target.value.toLowerCase().trim();
                this.render();
            });
        }

        // Bind Type filter dropdown
        if (this.typeFilterEl) {
            this.typeFilterEl.addEventListener('change', (e) => {
                this.app.setCategory(e.target.value, 'dropdown');
            });
        }

        // Bind Date filter dropdown
        if (this.dateFilterEl) {
            this.dateFilterEl.addEventListener('change', (e) => {
                this.app.dateFilter = e.target.value;
                this.render();
            });
        }

        // Bind Priority filter dropdown
        if (this.priorityFilterEl) {
            this.priorityFilterEl.addEventListener('change', (e) => {
                this.app.priorityFilter = e.target.value;
                this.render();
            });
        }

        // Bind click events on sortable headers
        this.sortHeaders.forEach(th => {
            th.classList.add('cursor-pointer', 'select-none', 'group');
            th.addEventListener('click', () => {
                const column = th.getAttribute('data-sort');
                this.handleSort(column, true);
            });
        });

        // Perform initial render
        this.render();
    }
    /* END init */

    /* START handleSort */
    handleSort(column, toggle = true) {
        if (toggle && this.currentSortColumn === column) {
            // Toggle direction
            this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSortColumn = column;
            this.currentSortDirection = 'asc';
        }

        // Update Sort Headers UI chevrons
        this.sortHeaders.forEach(th => {
            const thColumn = th.getAttribute('data-sort');
            const iconContainer = th.querySelector('.sort-icon-container');
            if (!iconContainer) return;

            if (thColumn === this.currentSortColumn) {
                if (this.currentSortDirection === 'asc') {
                    iconContainer.innerHTML = `
                        <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5"></path>
                        </svg>
                    `;
                } else {
                    iconContainer.innerHTML = `
                        <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"></path>
                        </svg>
                    `;
                }
            } else {
                // Default double chevron (unsorted)
                iconContainer.innerHTML = `
                    <svg class="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"></path>
                    </svg>
                `;
            }
        });

        this.render();
    }
    /* END handleSort */

    /* START getPriorityBadge */
    getPriorityBadge(priority) {
        let classes = '';
        switch(priority) {
            case 'High':
                classes = 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50';
                break;
            case 'Medium':
                classes = 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
                break;
            case 'Low':
            default:
                classes = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';
                break;
        }

        return `
            <span class="inline-flex items-center border font-semibold px-2.5 py-1 rounded-md text-xs select-none ${classes}">
                ${priority}
            </span>
        `;
    }
    /* END getPriorityBadge */

    /* START render */
    render() {
        if (!this.tbodyEl) return;

        // 1. Filter Tickets
        let filtered = this.app.tickets.filter(ticket => {
            // Category / Type check
            if (this.app.selectedCategory !== 'All' && ticket.category !== this.app.selectedCategory) {
                return false;
            }

            // Priority check
            if (this.app.priorityFilter !== 'All' && ticket.priority !== this.app.priorityFilter) {
                return false;
            }

            // Date filter check
            if (this.app.dateFilter !== 'All') {
                if (this.app.dateFilter === 'today' && ticket.date !== '2026-07-07') {
                    return false;
                }
                if (this.app.dateFilter === 'week' && new Date(ticket.date).getTime() < new Date('2026-07-01').getTime()) {
                    return false;
                }
            }

            // Search query check
            if (this.app.searchQuery) {
                const term = this.app.searchQuery;
                const matchId = ticket.id.toLowerCase().includes(term);
                const matchSubject = ticket.subject.toLowerCase().includes(term);
                const matchImplementor = ticket.implementor.toLowerCase().includes(term);
                return matchId || matchSubject || matchImplementor;
            }

            return true;
        });

        // 2. Sort Tickets
        filtered.sort((a, b) => {
            let fieldA = a[this.currentSortColumn].toLowerCase();
            let fieldB = b[this.currentSortColumn].toLowerCase();

            // Date sorting helper
            if (this.currentSortColumn === 'date') {
                fieldA = new Date(a.date).getTime();
                fieldB = new Date(b.date).getTime();
            }

            if (fieldA < fieldB) {
                return this.currentSortDirection === 'asc' ? -1 : 1;
            }
            if (fieldA > fieldB) {
                return this.currentSortDirection === 'asc' ? 1 : -1;
            }
            return 0;
        });

        // 3. Render Table HTML
        if (filtered.length === 0) {
            this.tbodyEl.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                            <span class="text-sm font-semibold">No tickets found matching current filters.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        filtered.forEach(ticket => {
            html += `
                <tr class="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800/50 hover:bg-blue-500/[0.06] dark:hover:bg-blue-500/10 transition-colors duration-200 cursor-pointer">
                    <td class="px-6 py-4 font-mono font-bold text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        ${ticket.id}
                    </td>
                    <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white max-w-xs truncate" title="${ticket.subject}">
                        ${ticket.subject}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${this.getPriorityBadge(ticket.priority)}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        ${ticket.implementor}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        ${ticket.date}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        ${ticket.lastActivity}
                    </td>
                </tr>
            `;
        });
        this.tbodyEl.innerHTML = html;

        // Add Click listener to Table Rows to open ticket
        const trs = this.tbodyEl.querySelectorAll('tr');
        trs.forEach(tr => {
            if (tr.querySelector('td[colspan]')) return; // Skip empty state row
            tr.addEventListener('click', () => {
                const ticketId = tr.querySelector('td:first-child').textContent.trim();
                this.app.openTicket(ticketId);
            });
        });
    }
    /* END render */
}

// Instantiate and initialize on DOM content load
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we are on the tickets page
    if (document.getElementById('category-drawer') || document.getElementById('tickets-table-body')) {
        const app = new TicketSupportApp();
        app.init();
        window.TicketSupportAppInstance = app; // Expose to global scope for debugging if needed
    }
});

/* END TICKET SUPPORT APP SYSTEM */
