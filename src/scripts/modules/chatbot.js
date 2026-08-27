import chatbotTemplate from '@/components/chatbot.html?raw';

/* START ANTI-TOKEN-DRAIN & CODING BYPASS GUARDRAIL */
const OUT_OF_SCOPE_REFUSAL = 'I am the official DOLE AI Support Assistant dedicated exclusively to DOLE Region X portal navigation, GIP/SPES programs, TUPAD/DILP services, and support ticket inquiries. I cannot generate code or build custom software. How can I assist you with DOLE programs today?';
const LOGIN_REQUIRED_REFUSAL = '🔒 **Authentication Required**: Inquiries about internal portal modules, employee tools, staff dashboards, and ticket submission require an active DOLE Portal login. Please log in first with your employee, implementer, or staff credentials to access these features. If you need public assistance for DOLE Region X programs (such as TUPAD, SPES, GIP, or DILP), feel free to ask!';

const GREETING_RESPONSE = `Hello! 👋 Welcome to the **DOLE Region X Support Assistant** (Lanao del Norte Provincial Field Office).

I can assist you with:
• **DOLE Programs & Employment Services**: TUPAD, SPES, GIP, DILP livelihood assistance, and PESO job matching.
• **Office Information & Inquiries**: Provincial Field Office address, hotlines, emails, and operating hours.
• **Portal Navigation & Ticket Support**: Guidance on ticket management and knowledge base self-help guides (login required for employee tools).

How can I help you today? Feel free to ask a question or select any suggested topic above!`;

const isGreetingOnly = (text = '') => {
    const trimmed = String(text).trim().toLowerCase().replace(/[!.,?]+$/, '');
    const greetingMatches = [
        'hi', 'hello', 'hi there', 'hello there', 'hey', 'hey there',
        'good morning', 'good afternoon', 'good evening', 'good day',
        'kumusta', 'kamusta', 'greetings', 'morning', 'afternoon', 'evening'
    ];
    return greetingMatches.includes(trimmed);
};

const isCodingOrBypassQuery = (text = '') => {
    const q = String(text).toLowerCase();
    const codingPatterns = [
        /\b(how to code|how to program|write (a )?(code|script|program|html|css|javascript|js|php|sql|python|java|c\+\+|bash|react|vue|node))\b/i,
        /\b(create|build|make|generate|develop) (a )?(website|system|app|software|database|script|code|bot|api|backend|frontend) for me\b/i,
        /\b(write|give me|show me) (the )?(html|css|tailwind|flowbite|javascript|php|sql|python|java|c\+\+|regex) code\b/i,
        /\b(can you code|can you program|can you write script|teach me (how to )?coding)\b/i,
        /\b(generate (an? )?sql query|select \* from|insert into|drop table)\b/i,
        /\b(solve this (math|calculus|physics) (equation|problem)|write an essay about)\b/i
    ];
    return codingPatterns.some((pattern) => pattern.test(q));
};

const isInternalPortalQuery = (text = '') => {
    const q = String(text).toLowerCase();
    const internalPatterns = [
        /\b(ticket|tickets)\b/i,
        /\bhow (to|do i).*(ticket|portal|dashboard|ocr|payroll|article|staff)\b/i,
        /\b(submit|create|file|track|open|manage|view).*(ticket)\b/i,
        /\b(how to (use|navigate|access|login|log in) (the )?portal)\b/i,
        /\b(staff dashboard|admin dashboard|staff management|manage staff)\b/i,
        /\b(ocr converter|convert (a )?documents?|ocr tool)\b/i,
        /\b(spes payroll|auto payroll|payroll monitoring|payroll calculation)\b/i,
        /\b(how to assign gip|manage articles|publish articles)\b/i,
        /\b(external systems directory|sso authorize)\b/i
    ];
    return internalPatterns.some((pattern) => pattern.test(q));
};
/* END ANTI-TOKEN-DRAIN & CODING BYPASS GUARDRAIL */

/* ========================================================================== */
/* CUTTER: PARENT MODULE - DOLE CHATBOT CONTROLLER                           */
/* ========================================================================== */

/* START DoleChatbotController PARENT CLASS */
export class DoleChatbotController {
    constructor() {
        this.currentTopic = 'portal';
        this.audience = 'public';
        this.isProcessing = false;
        this.isOpen = false;
        this.lastUserScope = null;

        // Instantiate subchild modules
        this.storage = new ChatbotStorage(this);
        this.limiter = new ChatbotRateLimiter(this);
        this.ui = new ChatbotUI(this);
        this.api = new ChatbotApiClient(this);
    }

    /* START init METHOD - Mounts HTML shell and binds event listeners */
    init() {
        if (window.DEBUG) {
            window.DEBUG.log('CHATBOT', 'Initializing DOLE Chatbot Controller...');
        }

        // Mount HTML template into the document body if not already present
        this.mountTemplate();

        // Initialize UI DOM references and bind event listeners
        this.ui.initElements();
        this.bindEvents();

        // Observe modals and drawers to automatically hide FAB while overlays are active
        this.ui.setupOverlayObserver();

        // Apply correct FAB position based on auth state
        this.applyFabPositionMode();

        // Restore cached messages and check active lockdown state for current user scope
        this.restoreSession(true);

        if (window.DEBUG) {
            window.DEBUG.success('CHATBOT', 'DOLE Chatbot Controller fully initialized.');
        }
    }
    /* END init METHOD */

    /* START getAudience METHOD - Dynamically determines audience by active user role */
    getAudience() {
        const userScope = this.storage.getCurrentUserIdentifier();
        if (userScope.startsWith('admin')) return 'admin';
        if (userScope.startsWith('hr')) return 'hr';
        if (userScope.startsWith('gip')) return 'gip';
        if (userScope.startsWith('staff') || userScope.startsWith('role')) return 'staff';
        return 'public';
    }
    /* END getAudience METHOD */

    /* START mountTemplate METHOD */
    mountTemplate() {
        if (document.getElementById('dole-chatbot-fab')) return;
        const container = document.createElement('div');
        container.id = 'dole-chatbot-root';
        container.innerHTML = chatbotTemplate;
        document.body.appendChild(container);
    }
    /* END mountTemplate METHOD */

    /* START bindEvents METHOD */
    bindEvents() {
        const fab = document.getElementById('dole-chatbot-fab');
        const closeBtn = document.getElementById('dole-chatbot-close-btn');
        const clearBtn = document.getElementById('dole-chatbot-clear-btn');
        const form = document.getElementById('dole-chatbot-form');
        const input = document.getElementById('dole-chatbot-input');
        const topicPills = document.querySelectorAll('.chatbot-topic-pill');

        if (fab) {
            fab.addEventListener('click', () => this.toggleWindow());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeWindow());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.handleClearPrompt());
        }

        const clearCancelBtn = document.getElementById('dole-chatbot-clear-cancel-btn');
        const clearCancelX = document.getElementById('dole-chatbot-clear-cancel-x');
        const clearConfirmBtn = document.getElementById('dole-chatbot-clear-confirm-btn');

        if (clearCancelBtn) {
            clearCancelBtn.addEventListener('click', () => this.handleClearCancel());
        }
        if (clearCancelX) {
            clearCancelX.addEventListener('click', () => this.handleClearCancel());
        }
        if (clearConfirmBtn) {
            clearConfirmBtn.addEventListener('click', () => this.handleClearConfirm());
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit();
            });
        }

        // Keyboard navigation: Escape key closes chat window or clear modal
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.ui.isClearModalOpen?.()) {
                    this.handleClearCancel();
                } else if (this.isOpen) {
                    this.closeWindow();
                }
            }
        });

        // Re-sync user scope on cross-tab storage changes or authentication resolution
        window.addEventListener('storage', (e) => {
            if (e.key === 'portal_user_backup' || e.key === 'portal_user' || e.key === 'portal_user_session') {
                this.restoreSession(true);
            }
        });

        window.addEventListener('portal:auth-changed', () => {
            this.restoreSession(true);
            this.applyFabPositionMode();
        });

        // Re-evaluate FAB position on resize (e.g. orientation change, browser resize)
        let _resizeFabTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(_resizeFabTimer);
            _resizeFabTimer = setTimeout(() => this.applyFabPositionMode(), 150);
        }, { passive: true });

        // Topic selector pill clicks
        topicPills.forEach((pill) => {
            pill.addEventListener('click', (e) => {
                const topic = e.currentTarget.dataset.chatbotTopic || 'portal';
                this.setTopic(topic);
            });
        });

        // Auto-save draft typing on input change
        if (input) {
            input.addEventListener('input', () => {
                this.storage.setDraftMessage(input.value);
            });
        }

        // Close chatbot window when user clicks/taps outside window and fab
        document.addEventListener('pointerdown', (e) => {
            if (!this.isOpen) return;
            const windowEl = document.getElementById('dole-chatbot-window');
            const fabEl = document.getElementById('dole-chatbot-fab');
            const clearModal = document.getElementById('dole-chatbot-clear-modal');

            // If user clicked inside chatbot window, FAB trigger, or clear modal, don't close
            if (windowEl?.contains(e.target) || fabEl?.contains(e.target) || clearModal?.contains(e.target)) {
                return;
            }

            // Outside click detected -> close chatbot window
            this.closeWindow();
        });

        // Quick prompt chips
        document.addEventListener('click', (e) => {
            const promptBtn = e.target.closest('.chatbot-quick-prompt');
            if (!promptBtn) return;
            const text = promptBtn.textContent?.trim();
            if (text && input) {
                input.value = text;
                this.handleSubmit();
            }
        });
    }
    /* END bindEvents METHOD */

    /* START toggleWindow METHOD */
    toggleWindow() {
        if (this.isOpen) {
            this.closeWindow();
        } else {
            this.openWindow();
        }
    }

    openWindow() {
        this.isOpen = true;
        this.restoreSession(); // Re-checks active user scope in case auth changed
        
        // Hide mobile login drawer if open
        const drawerEl = document.getElementById('login-drawer');
        const backdropEl = document.getElementById('drawer-backdrop');
        const heroEl = document.getElementById('mobile-hero-content');
        const drawerHeroEl = document.getElementById('mobile-drawer-hero-text');
        if (drawerEl) {
            drawerEl.classList.remove('translate-y-0');
            drawerEl.classList.add('translate-y-full');
        }
        if (backdropEl) backdropEl.classList.add('hidden');
        if (heroEl) heroEl.classList.remove('hidden');
        if (drawerHeroEl) drawerHeroEl.classList.add('hidden');

        this.ui.showWindow();
        if (window.DEBUG) window.DEBUG.flow('CHATBOT', 'Chatbot window opened.');
    }

    closeWindow() {
        this.isOpen = false;
        this.ui.hideWindow();
        if (window.DEBUG) window.DEBUG.flow('CHATBOT', 'Chatbot window closed.');
    }
    /* END toggleWindow METHOD */

    /* START setTopic METHOD */
    setTopic(topic) {
        this.currentTopic = topic;
        this.ui.updateTopicPills(topic);
        this.ui.renderDynamicQuickPrompts(topic);
        if (window.DEBUG) window.DEBUG.log('CHATBOT', `Topic switched to: ${topic}`);
    }
    /* END setTopic METHOD */

    /* START restoreSession METHOD - Restores session scoped specifically to active user */
    restoreSession(force = false) {
        const currentScope = this.storage.getCurrentUserIdentifier();
        if (!force && this.lastUserScope === currentScope) return;
        this.lastUserScope = currentScope;
        this.audience = this.getAudience();

        // Check active lockdown for this user scope
        const lockdown = this.storage.getLockdownState();
        const now = Date.now();
        if (lockdown && lockdown.lockedUntil > now) {
            const remainingSec = Math.ceil((lockdown.lockedUntil - now) / 1000);
            this.limiter.engageLockdown(remainingSec, lockdown.strikeCount);
        } else if (this.limiter.isLockedDown()) {
            this.limiter.clearLockdown();
        }

        // Restore stored message history specifically for this user
        const history = this.storage.getMessages();
        if (history.length > 0) {
            this.ui.renderStoredMessages(history);
            if (window.DEBUG) window.DEBUG.log('CHATBOT', `Restored ${history.length} stored messages for user [${currentScope}].`);
        } else {
            this.ui.resetToWelcome();
        }

        // Restore any unfinished user draft from localStorage
        const draft = this.storage.getDraftMessage();
        const inputEl = document.getElementById('dole-chatbot-input');
        if (inputEl && draft) {
            inputEl.value = draft;
        }

        // Re-apply FAB position based on current auth state
        this.applyFabPositionMode();
    }
    /* END restoreSession METHOD */

    /* START applyFabPositionMode METHOD - Repositions FAB on mobile based on auth state */
    applyFabPositionMode() {
        const fab = document.getElementById('dole-chatbot-fab');
        const windowEl = document.getElementById('dole-chatbot-window');
        if (!fab) return;

        // Match exact same priority order as ChatbotStorage.getCurrentUserIdentifier()
        const isAuthenticated = Boolean(
            window.__PORTAL_SESSION ||
            sessionStorage.getItem('portal_user') ||
            localStorage.getItem('portal_user_backup') ||
            localStorage.getItem('portal_user_session')
        );
        const isMobile = window.matchMedia('(max-width: 639px)').matches;

        if (!isAuthenticated && isMobile) {
            // Unauthenticated + mobile: position FAB above the white login card
            // Use ResizeObserver to track card height dynamically
            const landingCard = document.querySelector('.lg\\:hidden.bg-white.rounded-t-\\[1\\.5rem\\]');
            const applyCardOffset = (cardHeight) => {
                const offsetPx = (cardHeight || 160) + 12; // 12px gap above card
                fab.style.setProperty('bottom', `${offsetPx}px`, 'important');
                fab.style.removeProperty('right'); // keep default right-4 from class
                fab.classList.remove('bottom-4', 'sm:bottom-6');
                if (windowEl) {
                    // Chat window opens upward from FAB — position it above FAB
                    windowEl.style.setProperty('bottom', `${offsetPx + 64 + 8}px`, 'important');
                    windowEl.classList.remove('bottom-20', 'sm:bottom-24');
                }
            };

            if (landingCard) {
                applyCardOffset(landingCard.getBoundingClientRect().height);
                // Track future resizes (content changes, font scaling, etc.)
                if (!this._landingCardObserver) {
                    this._landingCardObserver = new ResizeObserver((entries) => {
                        for (const entry of entries) {
                            applyCardOffset(entry.contentRect.height);
                        }
                    });
                    this._landingCardObserver.observe(landingCard);
                }
            } else {
                // Fallback if card not in DOM yet: use 176px (approx card height)
                applyCardOffset(160);
            }
        } else {
            // Authenticated or desktop: standard fixed bottom-right position
            fab.style.removeProperty('bottom');
            fab.classList.add('bottom-4', 'sm:bottom-6');
            if (windowEl) {
                windowEl.style.removeProperty('bottom');
                windowEl.classList.add('bottom-20', 'sm:bottom-24');
            }
            // Disconnect landing card observer if no longer needed
            if (this._landingCardObserver) {
                this._landingCardObserver.disconnect();
                this._landingCardObserver = null;
            }
        }

        if (window.DEBUG) {
            window.DEBUG.log('CHATBOT', `FAB position mode: ${!isAuthenticated && isMobile ? 'unauthenticated-mobile (above login card)' : 'standard (bottom-right)'}`);
        }
    }
    /* END applyFabPositionMode METHOD */

    /* START handleClearPrompt METHOD - Temporarily hides chatbox and opens confirmation modal */
    handleClearPrompt() {
        this.ui.hideWindow();
        this.ui.showClearModal();
        if (window.DEBUG) window.DEBUG.flow('CHATBOT', 'Clear history modal opened; chatbox temporarily hidden.');
    }
    /* END handleClearPrompt METHOD */

    /* START handleClearCancel METHOD - Closes modal and restores chatbox */
    handleClearCancel() {
        this.ui.hideClearModal();
        this.ui.showWindow();
        if (window.DEBUG) window.DEBUG.flow('CHATBOT', 'Clear history cancelled; chatbox restored.');
    }
    /* END handleClearCancel METHOD */

    /* START handleClearConfirm METHOD - Clears storage, resets chat, closes modal, and restores chatbox */
    handleClearConfirm() {
        this.ui.hideClearModal();
        this.storage.clearHistory();
        this.ui.resetToWelcome();
        this.ui.showWindow();
        this.ui.showToast('Conversation history cleared.');
        if (window.DEBUG) window.DEBUG.success('CHATBOT', 'Conversation history cleared via confirmation modal.');
    }
    /* END handleClearConfirm METHOD */

    /* START handleSubmit METHOD */
    async handleSubmit() {
        const input = document.getElementById('dole-chatbot-input');
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        // Security check for lockdown
        if (this.limiter.isLockedDown()) {
            window.DEBUG?.warn('CHATBOT', 'Submission blocked: Security lockdown is currently active.');
            this.ui.showToast('Security lockdown is active. Please wait.', 'warn');
            return;
        }

        // Check 2-second rate limit cooldown
        if (this.limiter.isCooldownActive()) {
            window.DEBUG?.warn('CHATBOT', 'Submission blocked: Rate limit cooldown active (2s). Recording burst attempt.');
            const burstResult = this.limiter.recordRapidAttempt();
            if (burstResult.triggeredLockdown) {
                window.DEBUG?.error('CHATBOT', `10 rapid bursts detected! Engaging security lockdown for ${burstResult.durationSec}s (Strike ${burstResult.strikeCount}).`);
                this.storage.setLockdownState({
                    strikeCount: burstResult.strikeCount,
                    lockedUntil: Date.now() + burstResult.durationSec * 1000
                });
                this.limiter.engageLockdown(burstResult.durationSec, burstResult.strikeCount);
            }
            return;
        }

        if (this.isProcessing) return;

        window.DEBUG?.flow('CHATBOT', 'Prompt submitted by user', {
            message,
            topic: this.currentTopic,
            audience: this.audience
        });

        // Clear input, destroy saved draft, and trigger 2-second cooldown
        input.value = '';
        this.storage.setDraftMessage('');
        this.limiter.startCooldown();

        // Render User Message
        const userMsg = {
            id: `msg-${Date.now()}`,
            sender: 'user',
            text: message,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            topic: this.currentTopic
        };
        this.ui.appendUserMessage(userMsg);
        this.storage.addMessage(userMsg);

        // Prepare Assistant message container
        const assistantMsgId = `msg-${Date.now() + 1}`;
        const assistantBubble = this.ui.createAssistantMessageBubble(assistantMsgId);

        // START CLIENT-SIDE ANTI-TOKEN-DRAIN CHECK
        if (isCodingOrBypassQuery(message)) {
            window.DEBUG?.warn('CHATBOT', 'Out-of-scope coding/bypass query intercepted client-side (0 tokens spent).', { message });
            this.ui.finalizeAssistantMessage(assistantBubble, OUT_OF_SCOPE_REFUSAL);
            this.storage.addMessage({
                id: assistantMsgId,
                sender: 'assistant',
                text: OUT_OF_SCOPE_REFUSAL,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                topic: this.currentTopic
            });
            return;
        }

        // Intercept internal portal inquiries for unauthenticated guests (0 tokens spent)
        const isGuest = this.storage.getCurrentUserIdentifier() === 'guest';
        if (isGuest && isInternalPortalQuery(message)) {
            window.DEBUG?.warn('CHATBOT', 'Unauthenticated guest internal query intercepted client-side (0 tokens spent).', { message });
            this.ui.finalizeAssistantMessage(assistantBubble, LOGIN_REQUIRED_REFUSAL);
            this.storage.addMessage({
                id: assistantMsgId,
                sender: 'assistant',
                text: LOGIN_REQUIRED_REFUSAL,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                topic: this.currentTopic
            });
            return;
        }

        // Intercept simple greetings with immediate client-side introduction (0 tokens spent)
        if (isGreetingOnly(message)) {
            window.DEBUG?.log('CHATBOT', 'Simple greeting intercepted client-side (0 tokens spent).', { message });
            this.ui.finalizeAssistantMessage(assistantBubble, GREETING_RESPONSE);
            this.storage.addMessage({
                id: assistantMsgId,
                sender: 'assistant',
                text: GREETING_RESPONSE,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                topic: this.currentTopic
            });
            return;
        }
        // END CLIENT-SIDE ANTI-TOKEN-DRAIN CHECK

        // Start processing state
        this.isProcessing = true;
        this.ui.setLoading(true);

        let accumulatedText = '';

        try {
            const conversationId = this.storage.getConversationId();
            window.DEBUG?.log('CHATBOT', 'Starting AI generation via backend API...', {
                conversationId: conversationId || '(new session)'
            });

            await this.api.streamMessage({
                message,
                topic: this.currentTopic,
                audience: this.audience,
                conversationId,
                onChunk: (delta) => {
                    accumulatedText += delta;
                    this.ui.updateAssistantMessageText(assistantBubble, accumulatedText);
                },
                onComplete: (data) => {
                    if (data.conversation_id) {
                        this.storage.setConversationId(data.conversation_id);
                    }
                    const cleanReply = accumulatedText || data.reply || 'I am ready to assist you.';
                    this.ui.finalizeAssistantMessage(assistantBubble, cleanReply);

                    this.storage.addMessage({
                        id: assistantMsgId,
                        sender: 'assistant',
                        text: cleanReply,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        topic: this.currentTopic
                    });

                    window.DEBUG?.success('CHATBOT', 'AI Response completed and saved to history.', {
                        conversationId: data.conversation_id || conversationId,
                        replyLength: cleanReply.length
                    });
                },
                onError: (err) => {
                    window.DEBUG?.error('CHATBOT', 'Error received from AI backend endpoint:', err);
                    if (err.status === 429) {
                        const retrySec = err.retryAfter || 30;
                        this.storage.setLockdownState({
                            strikeCount: err.strikeCount || 1,
                            lockedUntil: Date.now() + retrySec * 1000
                        });
                        this.limiter.engageLockdown(retrySec, err.strikeCount || 1);
                    }
                    this.ui.finalizeAssistantMessage(assistantBubble, `⚠️ ${err.message || 'An error occurred. Please try again.'}`);
                }
            });
        } catch (error) {
            window.DEBUG?.error('CHATBOT', 'Fatal error processing prompt:', error);
            this.ui.finalizeAssistantMessage(assistantBubble, '⚠️ Unable to connect to DOLE Support AI. Please verify your network and try again.');
        } finally {
            this.isProcessing = false;
            this.ui.setLoading(false);
        }
    }
    /* END handleSubmit METHOD */
}
/* END DoleChatbotController PARENT CLASS */


/* ========================================================================== */
/* CUTTER: SUBCHILD MODULE - CHATBOT UI & RENDERING                          */
/* ========================================================================== */

const TOPIC_PROMPTS = {
    portal: [
        'How do I submit a support ticket?',
        'How do I check SPES attendance?',
        'Where is the OCR Converter tool?'
    ],
    spes: [
        'What is SPES eligibility & requirements?',
        'How does SPES payroll auto-calculation work?',
        'Who qualifies as Out-of-School Youth (OSY)?'
    ],
    gip: [
        'What is the GIP stipend allowance rate?',
        'What are the internship duration limits?',
        'How to track GIP field assignments?'
    ],
    dole_programs: [
        'What is TUPAD emergency cash-for-work?',
        'What is DILP livelihood assistance?',
        'What are the documentary requirements for TUPAD?'
    ],
    dole_office: [
        'Where is DOLE Lanao del Norte PFO located?',
        'What are the official office hours & hotlines?',
        'What programs are handled by the Iligan office?'
    ],
    other: [
        'Who is the developer of this system?',
        'Who is the Provincial Director at Lanao Del Norte?',
        'What is DOLE Region X / DOLE Iligan City coverage?'
    ]
};

/* START ChatbotUI SUBCHILD CLASS */
export class ChatbotUI {
    constructor(controller) {
        this.controller = controller;
        this.fabEl = null;
        this.windowEl = null;
        this.messagesContainer = null;
        this.inputEl = null;
        this.sendBtn = null;
        this.sendIcon = null;
        this.sendSpinner = null;
        this.typingIndicator = null;
        this.lockdownBanner = null;
        this.lockdownMsg = null;
        this.lockdownCountdown = null;
        this.cooldownBadge = null;
    }

    initElements() {
        this.cacheDOMElements();
    }

    cacheDOMElements() {
        this.fabEl = document.getElementById('dole-chatbot-fab');
        this.windowEl = document.getElementById('dole-chatbot-window');
        this.messagesContainer = document.getElementById('dole-chatbot-messages');
        this.inputEl = document.getElementById('dole-chatbot-input');
        this.sendBtn = document.getElementById('dole-chatbot-send-btn');
        this.sendIcon = document.getElementById('dole-chatbot-send-icon');
        this.sendSpinner = document.getElementById('dole-chatbot-send-spinner');
        this.typingIndicator = document.getElementById('dole-chatbot-typing');
        this.lockdownBanner = document.getElementById('dole-chatbot-lockdown-banner');
        this.lockdownMsg = document.getElementById('dole-chatbot-lockdown-msg');
        this.lockdownCountdown = document.getElementById('dole-chatbot-lockdown-countdown');
        this.cooldownBadge = document.getElementById('dole-chatbot-cooldown-badge');
        this.clearModalEl = document.getElementById('dole-chatbot-clear-modal');
    }

    /* START setupOverlayObserver METHOD - Maintains chatbot FAB visibility across views */
    setupOverlayObserver() {
        const showFab = () => {
            const fab = this.fabEl || document.getElementById('dole-chatbot-fab');
            const staticIcon = document.getElementById('dole-chatbot-fab-static-icon');
            if (fab) fab.classList.remove('!hidden');
            if (staticIcon) staticIcon.classList.remove('!hidden');
        };

        // Keep FAB visible across drawers and modals
        showFab();
    }
    /* END setupOverlayObserver METHOD */

    showClearModal() {
        if (!this.clearModalEl) return;
        this.clearModalEl.classList.remove('hidden');
        requestAnimationFrame(() => {
            this.clearModalEl.classList.remove('opacity-0', 'pointer-events-none');
            this.clearModalEl.classList.add('opacity-100');
            const box = this.clearModalEl.querySelector('div');
            if (box) {
                box.classList.remove('scale-95');
                box.classList.add('scale-100');
            }
        });
    }

    hideClearModal() {
        if (!this.clearModalEl) return;
        this.clearModalEl.classList.remove('opacity-100');
        this.clearModalEl.classList.add('opacity-0', 'pointer-events-none');
        const box = this.clearModalEl.querySelector('div');
        if (box) {
            box.classList.remove('scale-100');
            box.classList.add('scale-95');
        }
        setTimeout(() => {
            this.clearModalEl.classList.add('hidden');
        }, 200);
    }

    isClearModalOpen() {
        return Boolean(this.clearModalEl && !this.clearModalEl.classList.contains('hidden'));
    }

    showWindow() {
        if (!this.windowEl) return;
        this.windowEl.classList.remove('hidden');
        requestAnimationFrame(() => {
            this.windowEl.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
            this.windowEl.classList.add('opacity-100', 'scale-100');
            this.inputEl?.focus();
            this.scrollToBottom();
        });
        if (this.fabEl) {
            this.fabEl.setAttribute('aria-expanded', 'true');
            this.fabEl.setAttribute('data-state', 'open');
        }
    }

    hideWindow() {
        if (!this.windowEl) return;
        this.windowEl.classList.remove('opacity-100', 'scale-100');
        this.windowEl.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        setTimeout(() => {
            this.windowEl.classList.add('hidden');
        }, 200);
        if (this.fabEl) {
            this.fabEl.setAttribute('aria-expanded', 'false');
            this.fabEl.setAttribute('data-state', 'closed');
        }
    }

    updateTopicPills(activeTopic) {
        const pills = document.querySelectorAll('.chatbot-topic-pill');
        pills.forEach((pill) => {
            const topic = pill.dataset.chatbotTopic;
            if (topic === activeTopic) {
                pill.className = 'chatbot-topic-pill px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-300 dark:border-blue-700 transition-colors whitespace-nowrap cursor-pointer';
            } else {
                pill.className = 'chatbot-topic-pill px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap cursor-pointer';
            }
        });
    }

    renderDynamicQuickPrompts(topic = 'portal') {
        const container = document.getElementById('dole-chatbot-quick-prompts');
        if (!container) return;

        const prompts = TOPIC_PROMPTS[topic] || TOPIC_PROMPTS.portal;
        container.innerHTML = prompts.map(p => `
            <button type="button" class="chatbot-quick-prompt text-[11px] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer text-left">
                ${this.escapeHtml(p)}
            </button>
        `).join('');
    }

    /* START updateInputState METHOD - Coordinates disable state across processing, cooldown, and lockdown */
    updateInputState() {
        if (!this.inputEl || !this.sendBtn) return;
        const isProcessing = Boolean(this.controller.isProcessing);
        const isCooldown = Boolean(this.controller.limiter?.isCooldownActive());
        const isLocked = Boolean(this.controller.limiter?.isLockedDown());

        const shouldDisable = isProcessing || isCooldown || isLocked;

        this.inputEl.disabled = shouldDisable;
        this.sendBtn.disabled = shouldDisable;

        if (!shouldDisable) {
            this.inputEl.focus();
        }
    }
    /* END updateInputState METHOD */

    setLoading(isLoading) {
        if (isLoading) {
            this.typingIndicator?.classList.remove('hidden');
            this.sendIcon?.classList.add('hidden');
            this.sendSpinner?.classList.remove('hidden');
        } else {
            this.typingIndicator?.classList.add('hidden');
            this.sendIcon?.classList.remove('hidden');
            this.sendSpinner?.classList.add('hidden');
        }
        this.updateInputState();
        this.scrollToBottom();
    }

    setCooldownState(isActive, remainingSec = 8) {
        if (!this.cooldownBadge) return;
        if (isActive) {
            this.cooldownBadge.textContent = `${remainingSec}s`;
            this.cooldownBadge.classList.remove('hidden');
        } else {
            this.cooldownBadge.classList.add('hidden');
        }
        this.updateInputState();
    }

    setLockdownBanner(isActive, remainingSec = 0) {
        if (!this.lockdownBanner || !this.lockdownCountdown) return;
        if (isActive) {
            this.lockdownBanner.classList.remove('hidden');
            this.lockdownCountdown.textContent = `${remainingSec}s`;
        } else {
            this.lockdownBanner.classList.add('hidden');
        }
        this.updateInputState();
    }

    appendUserMessage(msg) {
        if (!this.messagesContainer) return;
        const bubble = document.createElement('div');
        bubble.className = 'flex gap-3 text-sm flex-1 justify-end';
        bubble.innerHTML = `
            <div class="space-y-1 max-w-[85%] text-right">
                <div class="flex items-center justify-end gap-1.5">
                    <span class="text-[10px] text-gray-400 dark:text-gray-500">${msg.timestamp || ''}</span>
                    <span class="font-bold text-xs text-gray-700 dark:text-gray-300">You</span>
                </div>
                <div class="bg-blue-600 text-white p-3 rounded-2xl rounded-tr-sm text-xs leading-relaxed shadow-xs text-left">
                    ${this.escapeHtml(msg.text)}
                </div>
            </div>
            <span class="relative flex shrink-0 overflow-hidden rounded-full w-8 h-8 self-start">
                <div class="rounded-full bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 p-1 flex items-center justify-center">
                    <svg class="w-4 h-4 text-blue-700 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
            </span>
        `;
        this.messagesContainer.appendChild(bubble);
        this.scrollToBottom();
    }

    createAssistantMessageBubble(msgId) {
        if (!this.messagesContainer) return null;
        const bubble = document.createElement('div');
        bubble.id = msgId;
        bubble.className = 'flex gap-3 text-sm flex-1';
        bubble.innerHTML = `
            <span class="relative flex shrink-0 overflow-hidden rounded-full w-8 h-8 self-start">
                <div class="rounded-full bg-blue-100 dark:bg-blue-900/60 border border-blue-200 dark:border-blue-700 p-1.5 flex items-center justify-center">
                    <svg class="w-4 h-4 text-blue-700 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
                    </svg>
                </div>
            </span>
            <div class="space-y-1 max-w-[85%]">
                <div class="flex items-center gap-1.5">
                    <span class="font-bold text-xs text-blue-700 dark:text-blue-400">DOLE Support AI</span>
                    <span class="text-[10px] text-gray-400 dark:text-gray-500">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="assistant-content-body bg-gray-100 dark:bg-gray-800/90 text-gray-800 dark:text-gray-200 p-3.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed border border-gray-200/60 dark:border-gray-700/60 shadow-xs">
                    <span class="inline-block animate-pulse">● Thinking...</span>
                </div>
            </div>
        `;
        this.messagesContainer.appendChild(bubble);
        this.scrollToBottom();
        return bubble;
    }

    updateAssistantMessageText(bubble, rawText) {
        if (!bubble) return;
        const bodyEl = bubble.querySelector('.assistant-content-body');
        if (bodyEl) {
            bodyEl.innerHTML = this.formatMarkdown(rawText);
            this.scrollToBottom();
        }
    }

    finalizeAssistantMessage(bubble, rawText) {
        if (!bubble) return;
        const bodyEl = bubble.querySelector('.assistant-content-body');
        if (bodyEl) {
            bodyEl.innerHTML = this.formatMarkdown(rawText);
            this.scrollToBottom();
        }
    }

    renderStoredMessages(messages) {
        if (!this.messagesContainer) return;
        messages.forEach((msg) => {
            if (msg.sender === 'user') {
                this.appendUserMessage(msg);
            } else {
                const bubble = this.createAssistantMessageBubble(msg.id || `msg-${Date.now()}`);
                this.finalizeAssistantMessage(bubble, msg.text);
            }
        });
    }

    resetToWelcome() {
        if (!this.messagesContainer) return;
        this.messagesContainer.innerHTML = `
            <div class="flex gap-3 text-sm flex-1">
                <span class="relative flex shrink-0 overflow-hidden rounded-full w-8 h-8 self-start">
                    <div class="rounded-full bg-blue-100 dark:bg-blue-900/60 border border-blue-200 dark:border-blue-700 p-1.5 flex items-center justify-center">
                        <svg class="w-4 h-4 text-blue-700 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
                        </svg>
                    </div>
                </span>
                <div class="space-y-1.5 max-w-[85%]">
                    <span class="block font-bold text-xs text-blue-700 dark:text-blue-400">DOLE Support AI</span>
                    <div class="bg-gray-100 dark:bg-gray-800/90 text-gray-800 dark:text-gray-200 p-3.5 rounded-2xl rounded-tl-sm text-xs leading-relaxed border border-gray-200/60 dark:border-gray-700/60 shadow-xs">
                        History cleared. How can I help you today?
                    </div>
                    <div id="dole-chatbot-quick-prompts" class="pt-2 flex flex-wrap gap-1.5">
                        <button type="button" class="chatbot-quick-prompt text-[11px] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer">
                            How do I submit a support ticket?
                        </button>
                        <button type="button" class="chatbot-quick-prompt text-[11px] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer">
                            How do I check SPES attendance?
                        </button>
                        <button type="button" class="chatbot-quick-prompt text-[11px] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer">
                            Where is the OCR Converter tool?
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    scrollToBottom() {
        if (!this.messagesContainer) return;
        requestAnimationFrame(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        });
    }

    escapeHtml(text = '') {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatMarkdown(text = '') {
        if (!text) return '';

        const isReasoningLine = (trimmed) => {
            if (!trimmed) return false;
            return (
                /^I'll (read|start|examine|check|inspect|look|run|follow|give|provide|proceed)/i.test(trimmed) ||
                /^Let me (read|load|record|examine|check|look|render|validate)/i.test(trimmed) ||
                /^Now let me/i.test(trimmed) ||
                /^I've (read|checked|loaded|examined)/i.test(trimmed) ||
                /^I have (the skill|everything|loaded)/i.test(trimmed) ||
                /^Validat(ing|ed|ion)\b/i.test(trimmed) ||
                /^Check(ing|ed)? (the |inputs)/i.test(trimmed) ||
                /^Inputs? (validated|validation|present|checked)/i.test(trimmed) ||
                /^\*\*Input(s)? validation:\*\*/i.test(trimmed) ||
                /^(question|topic|audience):/i.test(trimmed) ||
                /^[•\-\*]\s*(✅|⚠️|❌|\[\s*\]|\[x\])?\s*(question|topic|audience)\b/i.test(trimmed) ||
                /^Per the SKILL/i.test(trimmed) ||
                /^Since (audience|the|this|user)\b/i.test(trimmed) ||
                /^Because (audience|you're|the|user)\b/i.test(trimmed) ||
                /^This is (an? )?(app-support|DOLE|portal|SPES|GIP|TUPAD|friendly)/i.test(trimmed) ||
                /^Answering now\b/i.test(trimmed) ||
                /^The actual question\b/i.test(trimmed) ||
                /^Done( —|!|\.|$)/i.test(trimmed) ||
                /^Here's the (support )?answer/i.test(trimmed) ||
                /^Here's a (summary|dashboard)/i.test(trimmed) ||
                /^Here's your (step-by-step )?answer/i.test(trimmed) ||
                /per the DOLE Support Assistant procedure/i.test(trimmed) ||
                /find the SKILL\.md file/i.test(trimmed) ||
                /\b(matches the SKILL|SKILL\.md's public role|schema validation)\b/i.test(trimmed)
            );
        };

        // Separate internal procedural narratives from actual answer
        const lines = text.split('\n');
        const reasoningLines = [];
        const contentLines = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (isReasoningLine(trimmed)) {
                reasoningLines.push(trimmed);
            } else if (trimmed) {
                contentLines.push(line);
            }
        }

        let reasoningHtml = '';
        if (reasoningLines.length > 0) {
            reasoningHtml = `
                <details class="group mb-3 text-[11px] rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-800/70 overflow-hidden shadow-xs">
                    <summary class="cursor-pointer px-3 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700/50 flex items-center justify-between select-none transition-colors">
                        <span class="flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <span class="font-semibold text-gray-800 dark:text-gray-200">Agent Reasoning &amp; Procedure Notes</span>
                        </span>
                        <svg class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </summary>
                    <div class="px-3 py-2.5 text-gray-600 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 font-mono text-[10px] leading-relaxed bg-white/60 dark:bg-gray-900/60">
                        ${reasoningLines.map((l) => `<p class="mb-1.5 last:mb-0">${this.escapeHtml(l)}</p>`).join('')}
                    </div>
                </details>
            `;
        }

        const mainText = contentLines.length > 0 ? contentLines.join('\n').trim() : text.trim();
        let escaped = this.escapeHtml(mainText);

        // 1. Extract markdown links: [label](url) to placeholder to avoid collisions
        const extractedLinks = [];
        escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
            const idx = extractedLinks.length;
            extractedLinks.push({ label, href: href.trim() });
            return `__DOLE_MD_LINK_${idx}__`;
        });

        // 2. Convert remaining raw file/page paths like `/src/pages/...` or `src/pages/...` into friendly clickable navigation links
        escaped = escaped.replace(/(?:\/(?:src\/pages\/[a-zA-Z0-9\-_/]+(?:\.html)?)|src\/pages\/[a-zA-Z0-9\-_/]+(?:\.html)?)/g, (rawPath) => {
            const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
            const segments = cleanPath.replace(/\/index\.html$/, '').replace(/\.html$/, '').split('/').filter(Boolean);
            const lastSegment = segments[segments.length - 1] || 'Page';
            const friendlyName = lastSegment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            return `<a href="${cleanPath}" class="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline decoration-blue-400 underline-offset-2 transition-colors cursor-pointer">Navigate to ${friendlyName} <svg class="w-3 h-3 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg></a>`;
        });

        // 3. Restore markdown links with interactive styling and icon
        escaped = escaped.replace(/__DOLE_MD_LINK_(\d+)__/g, (match, idx) => {
            const link = extractedLinks[Number(idx)];
            if (!link) return match;
            return `<a href="${link.href}" class="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline decoration-blue-400 underline-offset-2 transition-colors cursor-pointer">${link.label} <svg class="w-3 h-3 shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></a>`;
        });

        // Bold: **text**
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900 dark:text-white">$1</strong>');
        // Inline code: `code`
        escaped = escaped.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-blue-700 dark:text-blue-300 rounded font-mono text-[11px]">$1</code>');
        // Headings: ### Heading or ## Heading
        escaped = escaped.replace(/^### (.*$)/gim, '<h4 class="font-bold text-xs mt-2 mb-1 text-blue-800 dark:text-blue-300 uppercase tracking-wide">$1</h4>');
        escaped = escaped.replace(/^## (.*$)/gim, '<h3 class="font-bold text-sm mt-2.5 mb-1 text-blue-900 dark:text-blue-200">$1</h3>');
        // Lists: - item or * item or 1. item
        escaped = escaped.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-3 list-disc">$1</li>');
        escaped = escaped.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="ml-3 list-decimal">$2</li>');
        // Tables: simple markdown table support
        escaped = escaped.replace(/\|(.+)\|/gim, (match) => {
            if (/\|---/.test(match)) return '';
            const cols = match.split('|').filter(c => c.trim().length > 0);
            return `<div class="grid grid-cols-${cols.length} gap-2 text-[11px] py-1 border-b border-gray-200 dark:border-gray-700">${cols.map(c => `<span>${c.trim()}</span>`).join('')}</div>`;
        });
        // Newlines to <br> where appropriate
        escaped = escaped.replace(/\n\n/g, '<div class="h-2"></div>');
        escaped = escaped.replace(/\n/g, '<br/>');

        return reasoningHtml + escaped;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const bg = type === 'warn' ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white';
        toast.className = `fixed bottom-24 right-6 z-[60] px-4 py-2 rounded-xl text-xs font-semibold shadow-lg ${bg} transition-all duration-300 opacity-0 transform translate-y-2`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', 'translate-y-2');
        });

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}
/* END ChatbotUI SUBCHILD CLASS */


/* ========================================================================== */
/* CUTTER: SUBCHILD MODULE - STORAGE & CACHE                                 */
/* ========================================================================== */

/* START ChatbotStorage SUBCHILD CLASS */
export class ChatbotStorage {
    constructor(controller) {
        this.controller = controller;
        this.STORAGE_PREFIX = 'dole_portal_chatbot_state_v1';
    }

    /* START getCurrentUserIdentifier METHOD - Resolves unique user/role identity */
    getCurrentUserIdentifier() {
        let user = null;
        try {
            if (window.__PORTAL_SESSION) {
                user = window.__PORTAL_SESSION;
            } else {
                const rawSession = sessionStorage.getItem('portal_user');
                if (rawSession) user = JSON.parse(rawSession);
                if (!user) {
                    const rawBackup = localStorage.getItem('portal_user_backup');
                    if (rawBackup) user = JSON.parse(rawBackup);
                }
                if (!user) {
                    const rawUserSession = localStorage.getItem('portal_user_session');
                    if (rawUserSession) user = JSON.parse(rawUserSession);
                }
            }
        } catch {
            user = null;
        }

        if (user && (user.id || user.username || user.email)) {
            const id = user.id ? `uid_${user.id}` : (user.username || user.email);
            const roleId = Number(user.role_id);
            const roleName = String(user.roles?.name || user.role_name || '').toLowerCase();
            const username = String(user.username || '').toLowerCase();
            const isHr = roleName.includes('hr') || roleName.includes('human resource') || username.includes('hr');
            const isGip = roleId === 3 || roleName.includes('gip') || user.gip_id;

            let rolePrefix = 'staff';
            if (roleId === 1 || roleName.includes('admin')) {
                rolePrefix = 'admin';
            } else if (isHr) {
                rolePrefix = 'hr';
            } else if (isGip) {
                rolePrefix = 'gip';
            }

            return `${rolePrefix}_${id}`;
        }
        return 'guest';
    }
    /* END getCurrentUserIdentifier METHOD */

    /* START getStorageKey METHOD - Generates isolated key scoped to active user */
    getStorageKey() {
        const userScope = this.getCurrentUserIdentifier();
        return `${this.STORAGE_PREFIX}_${userScope}`;
    }
    /* END getStorageKey METHOD */

    loadState() {
        try {
            const key = this.getStorageKey();
            const raw = localStorage.getItem(key);
            if (!raw) return { messages: [], conversationId: null, lockdown: null };
            return JSON.parse(raw);
        } catch {
            return { messages: [], conversationId: null, lockdown: null };
        }
    }

    saveState(state) {
        try {
            const key = this.getStorageKey();
            localStorage.setItem(key, JSON.stringify(state));
        } catch (e) {
            if (window.DEBUG) window.DEBUG.warn('CHATBOT_STORAGE', 'Failed to write localStorage:', e);
        }
    }

    getMessages() {
        return this.loadState().messages || [];
    }

    addMessage(msg) {
        const state = this.loadState();
        state.messages = state.messages || [];
        // Keep up to 50 recent messages per user account
        state.messages.push(msg);
        if (state.messages.length > 50) {
            state.messages = state.messages.slice(-50);
        }
        this.saveState(state);
    }

    getConversationId() {
        return this.loadState().conversationId || null;
    }

    setConversationId(id) {
        const state = this.loadState();
        state.conversationId = id;
        this.saveState(state);
    }

    getLockdownState() {
        return this.loadState().lockdown || null;
    }

    setLockdownState(lockdown) {
        const state = this.loadState();
        state.lockdown = lockdown;
        this.saveState(state);
    }

    /* START getDraftMessage METHOD - Retrieves unsent draft text */
    getDraftMessage() {
        return this.loadState().draft || '';
    }
    /* END getDraftMessage METHOD */

    /* START setDraftMessage METHOD - Persists or destroys unsent draft text */
    setDraftMessage(draftText = '') {
        const state = this.loadState();
        if (draftText && draftText.trim()) {
            state.draft = draftText;
        } else {
            delete state.draft;
        }
        this.saveState(state);
    }
    /* END setDraftMessage METHOD */

    clearHistory() {
        const state = this.loadState();
        state.messages = [];
        state.conversationId = null;
        delete state.draft;
        this.saveState(state);
    }
}
/* END ChatbotStorage SUBCHILD CLASS */


/* ========================================================================== */
/* CUTTER: SUBCHILD MODULE - RATE LIMITER & SECURITY LOCKDOWN                */
/* ========================================================================== */

/* START ChatbotRateLimiter SUBCHILD CLASS */
export class ChatbotRateLimiter {
    constructor(controller) {
        this.controller = controller;
        this.cooldownTimer = null;
        this.lockdownTimer = null;
        this.isCooldown = false;
        this.isLocked = false;
        
        // Hybrid lockdown schedule: 30s -> 3m -> 6m -> 12m -> 24m -> 48m -> 96m -> 180m (3 hours max)
        this.LOCKDOWN_STAGES = [30, 180, 360, 720, 1440, 2880, 5760, 10800];
        this.rapidTimestamps = [];
        this.RAPID_BURST_THRESHOLD = 10;
        this.RAPID_WINDOW_MS = 6000;
    }

    isCooldownActive() {
        return this.isCooldown;
    }

    isLockedDown() {
        return this.isLocked;
    }

    clearLockdown() {
        clearInterval(this.lockdownTimer);
        this.isLocked = false;
        this.controller.ui.setLockdownBanner(false, 0);
    }

    startCooldown() {
        this.isCooldown = true;
        // Randomly 8 to 10 seconds, weighted heavily towards 8 seconds (e.g. ~70% 8s, 20% 9s, 10% 10s)
        const rand = Math.random();
        let remaining = rand < 0.70 ? 8 : (rand < 0.90 ? 9 : 10);
        this.controller.ui.setCooldownState(true, remaining);

        clearInterval(this.cooldownTimer);
        this.cooldownTimer = setInterval(() => {
            remaining -= 1;
            if (remaining > 0) {
                this.controller.ui.setCooldownState(true, remaining);
            } else {
                clearInterval(this.cooldownTimer);
                this.isCooldown = false;
                this.controller.ui.setCooldownState(false, 0);
            }
        }, 1000);
    }

    recordRapidAttempt() {
        const now = Date.now();
        this.rapidTimestamps = this.rapidTimestamps.filter((ts) => now - ts < this.RAPID_WINDOW_MS);
        this.rapidTimestamps.push(now);

        if (this.rapidTimestamps.length >= this.RAPID_BURST_THRESHOLD) {
            const currentLockdown = this.controller.storage.getLockdownState() || { strikeCount: 0 };
            const newStrike = (currentLockdown.strikeCount || 0) + 1;
            const stageIndex = Math.min(newStrike - 1, this.LOCKDOWN_STAGES.length - 1);
            const durationSec = this.LOCKDOWN_STAGES[stageIndex];
            this.rapidTimestamps = [];

            return {
                triggeredLockdown: true,
                durationSec,
                strikeCount: newStrike
            };
        }

        return { triggeredLockdown: false, durationSec: 0, strikeCount: 0 };
    }

    engageLockdown(durationSec, strikeCount = 1) {
        this.isLocked = true;
        let remaining = durationSec;
        this.controller.ui.setLockdownBanner(true, remaining);

        clearInterval(this.lockdownTimer);
        this.lockdownTimer = setInterval(() => {
            remaining -= 1;
            if (remaining > 0) {
                this.controller.ui.setLockdownBanner(true, remaining);
            } else {
                clearInterval(this.lockdownTimer);
                this.isLocked = false;
                this.controller.ui.setLockdownBanner(false, 0);
                this.controller.storage.setLockdownState(null);
                if (window.DEBUG) window.DEBUG.success('CHATBOT_LIMITER', 'Lockdown timer expired. Chatbot re-enabled.');
            }
        }, 1000);
    }
}
/* END ChatbotRateLimiter SUBCHILD CLASS */


/* ========================================================================== */
/* CUTTER: SUBCHILD MODULE - API CLIENT & REALTIME STREAM                    */
/* ========================================================================== */

/* START ChatbotApiClient SUBCHILD CLASS */
export class ChatbotApiClient {
    constructor(controller) {
        this.controller = controller;
        this.ENDPOINT = '/api/chatbot';
    }

    async streamMessage({ message, topic, audience, conversationId, onChunk, onComplete, onError }) {
        try {
            const response = await fetch(this.ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream, application/json'
                },
                body: JSON.stringify({
                    message,
                    topic,
                    audience,
                    conversation_id: conversationId,
                    stream: true
                })
            });

            if (!response.ok) {
                let errorData = {};
                try { errorData = await response.json(); } catch { /* ignore */ }
                const err = new Error(errorData.error || `HTTP ${response.status}`);
                err.status = response.status;
                err.retryAfter = errorData.retryAfter;
                err.strikeCount = errorData.strikeCount;
                onError?.(err);
                return;
            }

            const contentType = response.headers.get('content-type') || '';

            // Handle Server-Sent Events (SSE) stream
            if (contentType.includes('text/event-stream')) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let lastConversationId = conversationId;
                let fullText = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const parsed = JSON.parse(line.slice(6));
                                if (parsed.delta) {
                                    fullText += parsed.delta;
                                    onChunk?.(parsed.delta);
                                }
                                if (parsed.conversation_id) {
                                    lastConversationId = parsed.conversation_id;
                                }
                            } catch {
                                // ignore malformed json in sse
                            }
                        }
                    }
                }

                onComplete?.({
                    reply: fullText,
                    conversation_id: lastConversationId
                });
                return;
            }

            // Handle Standard JSON Response fallback
            const data = await response.json();
            onComplete?.(data);

        } catch (error) {
            onError?.(error);
        }
    }
}
/* END ChatbotApiClient SUBCHILD CLASS */

/* ========================================================================== */
/* START: CHATBOT BOOTSTRAP INITIALIZATION                                    */
/* ========================================================================== */
export const initChatbot = () => {
    const chatbot = new DoleChatbotController();
    chatbot.init();
    window.__DOLE_CHATBOT__ = chatbot;
    return chatbot;
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
} else {
    initChatbot();
}
/* ========================================================================== */
/* END: CHATBOT BOOTSTRAP INITIALIZATION                                      */
/* ========================================================================== */
