/**
 * DOLE Portal — Data Privacy Act of 2012 & Terms of Use System
 * Integrates statutory compliance with RA 10173 and DOLE Portal Terms & Conditions.
 * Built with Flowbite Modal, Tailwind CSS responsive layouts, and scroll detection.
 */

import { Modal } from 'flowbite';
import {
    hasAcceptedPrivacyTerms,
    setAcceptedPrivacyTerms,
    hasAcceptedPrivacy,
    hasAcceptedTerms,
    setAcceptedPrivacy,
    setAcceptedTerms,
    clearAcceptedPrivacyTerms
} from './storage.js';

let privacyTermsModalInstance = null;
let activeTab = 'privacy'; // 'privacy' | 'terms'
let activeUserId = 'global';
let activeOnAcceptCallback = null;
let isGateMode = false;
let hasReachedBottom = { privacy: false, terms: false };

/* START ESCAPE HTML - Sanitizes text inputs for safe markup rendering */
const escapeHtml = (text = '') => String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
/* END ESCAPE HTML */

/* START RENDER PRIVACY CONTENT - Generates statutory RA 10173 and Supabase architecture markup */
const renderPrivacyContent = () => `
    <div class="space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <!-- Statutory Notice Banner -->
        <div class="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
            <div class="flex items-start gap-3">
                <span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white dark:bg-blue-600">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.002A11.959 11.959 0 0 1 12 2.714Z"/></svg>
                </span>
                <div>
                    <h4 class="text-sm font-extrabold text-blue-950 dark:text-blue-200">Republic Act No. 10173 — Data Privacy Act of 2012</h4>
                    <p class="mt-1 text-xs text-blue-900/80 dark:text-blue-300/80 leading-normal">
                        This system operates strictly under the legal mandate of RA 10173 and the rules issued by the National Privacy Commission (NPC) of the Philippines.
                    </p>
                    <a href="https://privacy.gov.ph/data-privacy-act/" target="_blank" rel="noopener noreferrer" class="cursor-pointer mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline dark:text-blue-400">
                        Read Official Statutory Document at privacy.gov.ph
                        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
                    </a>
                </div>
            </div>
        </div>

        <!-- Section 1: Legal Classifications -->
        <div>
            <div class="flex items-center gap-2 mb-2">
                <span class="rounded bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase">Section 1</span>
                <h3 class="text-base font-bold text-gray-900 dark:text-white">Legal Classifications of Data (Sec. 3)</h3>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                    <span class="block text-xs font-extrabold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Personal Information (PI) — Sec. 3(g)</span>
                    <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        Any information from which the identity of an individual is apparent or can be reasonably and directly ascertained (e.g. Full name, email address, phone number, address, avatar photo).
                    </p>
                </div>
                <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                    <span class="block text-xs font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">Sensitive Personal Information (SPI) — Sec. 3(l)</span>
                    <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        Heightened legal protection: Marital status, age, birthday, health, education, government-issued IDs (SSS, TIN, PhilHealth), or offenses.
                    </p>
                </div>
            </div>
        </div>

        <!-- Section 2: Core Processing Principles -->
        <div>
            <div class="flex items-center gap-2 mb-2">
                <span class="rounded bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase">Section 2</span>
                <h3 class="text-base font-bold text-gray-900 dark:text-white">Core Principles of Data Processing (Sec. 11)</h3>
            </div>
            <ul class="space-y-2 mt-2 list-disc list-inside text-xs text-gray-600 dark:text-gray-300">
                <li><strong class="text-gray-900 dark:text-white">Transparency (Sec. 11a):</strong> Data subjects are notified regarding the nature, purpose, scope, and destination of their data before collection.</li>
                <li><strong class="text-gray-900 dark:text-white">Legitimate Purpose (Sec. 11a):</strong> Information is processed solely for declared DOLE employment programs and official administrative functions.</li>
                <li><strong class="text-gray-900 dark:text-white">Proportionality / Data Minimization (Sec. 11d):</strong> Only data necessary for program validation, user authentication, and reporting is collected. Extraneous fields are prohibited.</li>
                <li><strong class="text-gray-900 dark:text-white">Data Quality & Accuracy (Sec. 11c):</strong> Information is maintained accurate, up-to-date, and corrigible via profile settings.</li>
                <li><strong class="text-gray-900 dark:text-white">Retention Limitation (Sec. 11e):</strong> Records are retained only as required by statutory public service standards and safely archived or purged thereafter.</li>
            </ul>
        </div>

        <!-- Section 3: Criteria for Lawful Processing -->
        <div>
            <div class="flex items-center gap-2 mb-2">
                <span class="rounded bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase">Section 3</span>
                <h3 class="text-base font-bold text-gray-900 dark:text-white">Criteria for Lawful Processing (Sec. 12 & 13)</h3>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-300">
                Processing is authorized under official legal mandate: consent is provided by the data subject, processing is required for public authority compliance, or necessary for the execution of official employment assistance programs (e.g. GIP, SPES, DOLE implementor roles).
            </p>
        </div>

        <!-- Section 4: Rights of the Data Subject -->
        <div>
            <div class="flex items-center gap-2 mb-2">
                <span class="rounded bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase">Section 4</span>
                <h3 class="text-base font-bold text-gray-900 dark:text-white">Statutory Rights of the Data Subject (Sec. 16, 17, 18)</h3>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                <div class="rounded-lg bg-gray-50 dark:bg-gray-800/40 p-2.5 border border-gray-200 dark:border-gray-700">
                    <span class="font-bold text-xs text-gray-900 dark:text-white block">Right to Be Informed</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400">Clear notice before data enters the system.</span>
                </div>
                <div class="rounded-lg bg-gray-50 dark:bg-gray-800/40 p-2.5 border border-gray-200 dark:border-gray-700">
                    <span class="font-bold text-xs text-gray-900 dark:text-white block">Right to Access</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400">Review your profile, tickets, and submitted records.</span>
                </div>
                <div class="rounded-lg bg-gray-50 dark:bg-gray-800/40 p-2.5 border border-gray-200 dark:border-gray-700">
                    <span class="font-bold text-xs text-gray-900 dark:text-white block">Right to Rectification</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400">Dispute errors and update inaccurate information.</span>
                </div>
                <div class="rounded-lg bg-gray-50 dark:bg-gray-800/40 p-2.5 border border-gray-200 dark:border-gray-700">
                    <span class="font-bold text-xs text-gray-900 dark:text-white block">Right to Erasure / Blocking</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400">Request suspension or archiving of invalid data.</span>
                </div>
                <div class="rounded-lg bg-gray-50 dark:bg-gray-800/40 p-2.5 border border-gray-200 dark:border-gray-700">
                    <span class="font-bold text-xs text-gray-900 dark:text-white block">Right to Data Portability</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400">Export information in structured digital formats.</span>
                </div>
                <div class="rounded-lg bg-gray-50 dark:bg-gray-800/40 p-2.5 border border-gray-200 dark:border-gray-700">
                    <span class="font-bold text-xs text-gray-900 dark:text-white block">Transmissibility & Damages</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400">Heirs may exercise rights; indemnification for breaches.</span>
                </div>
            </div>
        </div>

        <!-- Section 5: Technical Safeguards & Supabase Security Architecture -->
        <div class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div class="flex items-center gap-2 mb-2">
                <span class="rounded bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Section 5</span>
                <h3 class="text-base font-bold text-emerald-950 dark:text-emerald-200">How We Protect Your Data in the DOLE Portal & Supabase</h3>
            </div>
            <p class="text-xs text-emerald-900/90 dark:text-emerald-300/90 mb-3">
                To guarantee strict adherence to Section 20, 22, and 23 of RA 10173, the DOLE Portal incorporates defense-in-depth technical safeguards:
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div class="bg-white/80 dark:bg-gray-900/60 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                    <strong class="text-emerald-900 dark:text-emerald-200 block mb-1">🔐 Salted SHA-256 Hashing</strong>
                    <span>Passwords and PINs are cryptographically hashed using SHA-256 with isolated namespace salting (<code class="text-[11px] font-mono">sha256:v1:</code>) via SubtleCrypto Web API. Passwords are never stored in plaintext.</span>
                </div>
                <div class="bg-white/80 dark:bg-gray-900/60 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                    <strong class="text-emerald-900 dark:text-emerald-200 block mb-1">🛡️ Row Level Security (RLS)</strong>
                    <span>PostgreSQL database tables in Supabase enforce strict Row Level Security policies. Public anonymous client queries cannot read unauthorized records.</span>
                </div>
                <div class="bg-white/80 dark:bg-gray-900/60 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                    <strong class="text-emerald-900 dark:text-emerald-200 block mb-1">🧼 Memory & Payload Sanitization</strong>
                    <span>Before transmitting user data or storing sessions, sensitive credentials (<code class="text-[11px] font-mono">password</code>, <code class="text-[11px] font-mono">pin</code>) are systematically stripped by the <code class="text-[11px] font-mono">sanitizeUser</code> layer.</span>
                </div>
                <div class="bg-white/80 dark:bg-gray-900/60 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                    <strong class="text-emerald-900 dark:text-emerald-200 block mb-1">⚡ Serverless Administrative Client</strong>
                    <span>Privileged mutations and system logs run through backend Vercel Serverless functions utilizing Supabase Service Role keys with HTTP-only cookie authentication.</span>
                </div>
            </div>
        </div>

        <!-- Section 6: Statutory Penalties -->
        <div class="rounded-lg border border-red-200 bg-red-50/50 p-3.5 dark:border-red-900/40 dark:bg-red-950/20">
            <h4 class="text-xs font-extrabold text-red-900 dark:text-red-300 uppercase tracking-wide">Statutory Penalties (Sections 25–36)</h4>
            <p class="mt-1 text-xs text-red-800/90 dark:text-red-300/80 leading-relaxed">
                Unauthorized processing, gross negligence, intentional system breach, improper disposal, or malicious disclosure carry direct criminal imprisonment of 1 to 7 years and statutory fines ranging from ₱100,000 to ₱4,000,000. Under Section 36, public officers committing offenses suffer perpetual disqualification from holding public office.
            </p>
        </div>
    </div>
`;
/* END RENDER PRIVACY CONTENT */

/* START RENDER TERMS CONTENT - Generates DOLE Portal Terms of Use, support channels, and response hours */
const renderTermsContent = () => `
    <div class="space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <!-- Notice Highlight -->
        <div class="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
            <div class="flex items-start gap-3">
                <span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-700 text-white dark:bg-indigo-600">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
                </span>
                <div>
                    <h4 class="text-sm font-extrabold text-indigo-950 dark:text-indigo-200">DOLE Portal Terms & Conditions of Use</h4>
                    <p class="mt-1 text-xs text-indigo-900/80 dark:text-indigo-300/80 leading-normal">
                        Please read these terms carefully. Accessing and utilizing the DOLE Portal establishes your agreement with the conditions outlined below.
                    </p>
                </div>
            </div>
        </div>

        <!-- Term 1: Free System Usage & Higher-Ups Directive -->
        <div>
            <div class="flex items-center gap-2 mb-1.5">
                <span class="rounded bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-[11px] font-bold text-indigo-800 dark:text-indigo-300 uppercase">Clause 1</span>
                <h3 class="text-base font-bold text-gray-900 dark:text-white">Free System Usage & Operational Limitations</h3>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-300">
                The DOLE Portal is provided for authorized users free of charge to facilitate program management, attendance, and reporting. Users acknowledge and accept that certain modules, features, or administrative privileges may be limited, phased, or restricted based on assigned roles. Users must wait for further instruction, clearance, or operational rollout orders issued by higher-ups and agency leadership before utilizing advanced or restricted functions.
            </p>
        </div>

        <!-- Term 2: Developer Contract & User Feedback -->
        <div>
            <div class="flex items-center gap-2 mb-1.5">
                <span class="rounded bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-[11px] font-bold text-indigo-800 dark:text-indigo-300 uppercase">Clause 2</span>
                <h3 class="text-base font-bold text-gray-900 dark:text-white">Developer Contract & Freewill User Suggestions</h3>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-300">
                During the active developer contract period, iterative modifications, optimizations, feature additions, and schema updates will occur continuously to enhance portal efficiency. All authorized users are given freewill and encouraged to submit constructive feedback, feature recommendations, or suggestions for improvements or removals of unneeded features through official channels.
            </p>
        </div>

        <!-- Term 3: Official Support Channel -->
        <div class="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div class="flex items-center gap-2 mb-1.5">
                <span class="rounded bg-blue-700 px-2 py-0.5 text-[11px] font-bold text-white uppercase">Clause 3</span>
                <h3 class="text-base font-bold text-blue-950 dark:text-blue-200">Mandatory Support Channel — DOLE Portal Ticket Support System</h3>
            </div>
            <p class="text-xs text-blue-900/90 dark:text-blue-300/90 leading-relaxed">
                Technical support, system bug reporting, and feature inquiries are provided <strong>EXCLUSIVELY through the DOLE PORTAL TICKET SUPPORT SYSTEM</strong>. Users must create and submit an official support ticket directly inside the portal. Support requests made through unofficial, direct, or untracked channels will not be prioritized or serviced.
            </p>
        </div>

        <!-- Term 4: Response Times & Working Hours Schedule -->
        <div>
            <div class="flex items-center gap-2 mb-2">
                <span class="rounded bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-[11px] font-bold text-indigo-800 dark:text-indigo-300 uppercase">Clause 4</span>
                <h3 class="text-base font-bold text-gray-900 dark:text-white">Support Response Times & Service Schedule</h3>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-300 mb-3">
                Support tickets are actively processed and answered according to the following official schedule:
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-3 shadow-xs">
                    <span class="block text-xs font-extrabold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Monday</span>
                    <ul class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                        <li>• <strong>10:00 AM – 11:59 AM</strong></li>
                        <li>• <strong>1:00 PM – 5:00 PM</strong></li>
                    </ul>
                </div>
                <div class="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-3 shadow-xs">
                    <span class="block text-xs font-extrabold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Tuesday – Thursday</span>
                    <ul class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                        <li>• <strong>8:50 AM – 11:59 AM</strong></li>
                        <li>• <strong>1:00 PM – 5:30 PM</strong></li>
                    </ul>
                </div>
                <div class="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 p-3 shadow-xs">
                    <span class="block text-xs font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Friday – Sunday</span>
                    <p class="mt-2 text-xs text-amber-900/90 dark:text-amber-300/80 leading-relaxed">
                        Response times may vary or depend. These days are designated rest days, during which the developer only occasionally monitors and checks the system for critical alerts.
                    </p>
                </div>
            </div>
        </div>
    </div>
`;
/* END RENDER TERMS CONTENT */

/* START CREATE PRIVACY TERMS MODAL - Builds the Flowbite modal DOM element */
const createPrivacyTermsModal = () => {
    let modalEl = document.getElementById('flowbite-privacy-terms-modal');
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.id = 'flowbite-privacy-terms-modal';
    modalEl.tabIndex = -1;
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.className = 'fixed inset-0 z-[80] hidden h-full w-full overflow-y-auto overflow-x-hidden p-2 sm:p-4 md:inset-0 bg-gray-950/80 backdrop-blur-xs transition-all justify-center items-center';
    modalEl.innerHTML = `
        <div class="relative w-full max-w-4xl max-h-[92vh] flex flex-col">
            <div class="relative flex flex-col max-h-[92vh] border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 overflow-hidden rounded-none">
                <!-- Header with Brand Gradient -->
                <div class="shrink-0 flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 px-4 py-3.5 sm:px-6 sm:py-4 dark:border-gray-700 rounded-none">
                    <div class="flex items-center gap-3 min-w-0">
                        <img src="/src/assets/logos/dole_logo.png" alt="DOLE Logo" class="h-8 w-8 sm:h-9 sm:w-9 shrink-0 object-contain drop-shadow-sm">
                        <div class="min-w-0">
                            <h2 class="text-base sm:text-lg font-black text-white truncate">DOLE Portal Legal & Data Privacy</h2>
                            <p class="text-[11px] sm:text-xs text-blue-200 truncate">Republic Act No. 10173 Compliance & Terms of Service</p>
                        </div>
                    </div>
                    <button id="privacy-terms-close-btn" type="button" class="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors" aria-label="Close modal">
                        <svg class="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 14 14"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1l6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/></svg>
                    </button>
                </div>

                <!-- Floating Tab Switcher Navigation (Full-width floating buttons with smooth transition) -->
                <div class="shrink-0 px-4 pt-4 pb-2 sm:px-6">
                    <div class="grid grid-cols-2 gap-2 sm:gap-4 w-full max-w-3xl mx-auto">
                        <button id="privacy-tab-btn" type="button" class="hidden cursor-pointer w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all duration-200 ease-in-out shadow-xs bg-blue-700 text-white dark:bg-blue-600">
                            <svg class="h-4 w-4 shrink-0 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.002A11.959 11.959 0 0 1 12 2.714Z"/></svg>
                            <span class="truncate">Data Privacy Act (RA 10173)</span>
                        </button>
                        <button id="terms-tab-btn" type="button" class="cursor-pointer w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all duration-200 ease-in-out border border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-blue-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400">
                            <svg class="h-4 w-4 shrink-0 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
                            <span class="truncate">Terms & Conditions</span>
                        </button>
                    </div>
                </div>

                <!-- Scrollable Body Container -->
                <div class="relative flex-1 min-h-[300px] overflow-hidden">
                    <div id="privacy-terms-scroll-body" class="h-full max-h-[58vh] sm:max-h-[60vh] overflow-y-auto p-4 sm:p-6 overscroll-contain transition-opacity duration-200">
                        <div id="privacy-tab-content" class="transition-all duration-200"></div>
                        <div id="terms-tab-content" class="hidden transition-all duration-200"></div>
                    </div>

                    <!-- Floating Scroll-To-Top Button -->
                    <button id="privacy-terms-scroll-top-btn" type="button" class="cursor-pointer absolute bottom-4 right-4 z-20 hidden items-center justify-center h-10 w-10 rounded-full bg-blue-700/90 hover:bg-blue-700 text-white shadow-xl backdrop-blur-xs transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-blue-600/90 dark:hover:bg-blue-600" title="Scroll to top" aria-label="Scroll to top">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg>
                    </button>
                </div>

                <!-- Footer with 2-Grid Separated Left & Right Action Buttons (Widened and reduced height) -->
                <div class="shrink-0 flex flex-col items-center justify-center gap-2 border-t border-gray-200 bg-gray-50/95 p-3 sm:px-6 sm:py-3.5 dark:border-gray-700 dark:bg-gray-800/90 text-center">
                    <!-- Instruction text reminding users what to do -->
                    <div id="scroll-prompt-wrapper" class="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                        <span id="scroll-prompt-indicator" class="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                            <svg class="h-4 w-4 animate-bounce shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"/></svg>
                            <span>Please scroll down and read through the document to proceed</span>
                        </span>
                    </div>

                    <!-- 2 Grid Action Buttons (Hidden by default until user scrolls to bottom of active tab) -->
                    <div id="privacy-terms-actions-container" class="hidden w-full">
                        <div class="grid grid-cols-2 gap-3 sm:gap-5 w-full max-w-2xl mx-auto">
                            <!-- Left: Cancel / Decline with Rose Color & Hover -->
                            <button id="privacy-terms-cancel-btn" type="button" class="cursor-pointer w-full inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50/60 px-5 sm:px-8 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 dark:border-rose-800/80 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white transition-all duration-200 shadow-xs active:scale-[0.98]">
                                <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                                <span>Cancel</span>
                            </button>
                            <!-- Right: Accept & Continue / Primary Blue -->
                            <button id="privacy-terms-accept-btn" type="button" class="cursor-pointer w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 sm:px-8 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 transition-all duration-200 active:scale-[0.98]">
                                <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
                                <span>I Accept & Continue</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalEl);
    return modalEl;
};
/* END CREATE PRIVACY TERMS MODAL */

/* START SYNC TAB SWITCHER UI - Updates active tab button styling and displayed content */
const syncTabSwitcherUi = (tab) => {
    activeTab = tab;
    const privacyBtn = document.getElementById('privacy-tab-btn');
    const termsBtn = document.getElementById('terms-tab-btn');
    const privacyContent = document.getElementById('privacy-tab-content');
    const termsContent = document.getElementById('terms-tab-content');
    const scrollBody = document.getElementById('privacy-terms-scroll-body');

    if (!privacyBtn || !termsBtn || !privacyContent || !termsContent) return;

    const baseClass = 'cursor-pointer w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold transition-all duration-200 ease-in-out shadow-xs';
    const activeClass = `${baseClass} bg-blue-700 text-white dark:bg-blue-600 shadow-md ring-2 ring-blue-500/30`;
    const inactiveClass = `${baseClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-blue-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400 shadow-none`;

    if (tab === 'privacy') {
        privacyBtn.className = `${activeClass} hidden`;
        termsBtn.className = inactiveClass;
        privacyContent.classList.remove('hidden');
        termsContent.classList.add('hidden');
    } else {
        termsBtn.className = activeClass;
        privacyBtn.className = `${inactiveClass} hidden`;
        termsContent.classList.remove('hidden');
        privacyContent.classList.add('hidden');
    }

    if (scrollBody) {
        scrollBody.scrollTo({ top: 0, behavior: 'smooth' });
    }
};
/* END SYNC TAB SWITCHER UI */

/* START EVALUATE SCROLL GATE - Shows bottom action buttons when user scrolls near the bottom of the active tab */
const evaluateScrollGate = () => {
    const scrollBody = document.getElementById('privacy-terms-scroll-body');
    const actionsContainer = document.getElementById('privacy-terms-actions-container');
    const scrollPromptWrapper = document.getElementById('scroll-prompt-wrapper');
    const scrollTopBtn = document.getElementById('privacy-terms-scroll-top-btn');

    if (!scrollBody) return;

    // Toggle floating scroll-to-top button
    if (scrollTopBtn) {
        if (scrollBody.scrollTop > 140) {
            scrollTopBtn.classList.remove('hidden');
            scrollTopBtn.classList.add('flex');
        } else {
            scrollTopBtn.classList.add('hidden');
            scrollTopBtn.classList.remove('flex');
        }
    }

    // Measure proximity to bottom of scroll container (must have actively scrolled and reached near the bottom)
    const hasScrolledDown = scrollBody.scrollTop > 50;
    const isAtBottom = hasScrolledDown && (scrollBody.scrollHeight - scrollBody.scrollTop <= scrollBody.clientHeight + 30);

    if (isAtBottom) {
        hasReachedBottom[activeTab] = true;
    }

    const isUnlocked = Boolean(hasReachedBottom[activeTab]);

    if (actionsContainer && scrollPromptWrapper) {
        if (isUnlocked) {
            actionsContainer.classList.remove('hidden');
            scrollPromptWrapper.classList.add('hidden');
        } else {
            actionsContainer.classList.add('hidden');
            scrollPromptWrapper.classList.remove('hidden');
        }
    }
};
/* END EVALUATE SCROLL GATE */

/* START WIRE PRIVACY TERMS EVENTS - Binds tabs, scrolling, scroll-top, and action buttons */
const wirePrivacyTermsEvents = (modalEl) => {
    if (modalEl.dataset.eventsBound === 'true') return;
    modalEl.dataset.eventsBound = 'true';

    // Tabs
    document.getElementById('privacy-tab-btn')?.addEventListener('click', () => {
        syncTabSwitcherUi('privacy');
        evaluateScrollGate();
    });

    document.getElementById('terms-tab-btn')?.addEventListener('click', () => {
        syncTabSwitcherUi('terms');
        evaluateScrollGate();
    });

    // Scroll listener
    const scrollBody = document.getElementById('privacy-terms-scroll-body');
    scrollBody?.addEventListener('scroll', evaluateScrollGate, { passive: true });

    // Floating Scroll to Top
    document.getElementById('privacy-terms-scroll-top-btn')?.addEventListener('click', () => {
        scrollBody?.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Close and Cancel button - Destroys localStorage acceptance and resets state
    const handleCancelOrClose = () => {
        clearAcceptedPrivacyTerms(activeUserId);
        hasReachedBottom = { privacy: false, terms: false };
        evaluateScrollGate();
        privacyTermsModalInstance?.hide();
    };

    document.getElementById('privacy-terms-close-btn')?.addEventListener('click', handleCancelOrClose);
    document.getElementById('privacy-terms-cancel-btn')?.addEventListener('click', handleCancelOrClose);

    // Accept & Continue - Records acceptance based on active tab or gate
    document.getElementById('privacy-terms-accept-btn')?.addEventListener('click', () => {
        if (isGateMode) {
            setAcceptedPrivacyTerms(activeUserId);
        } else if (activeTab === 'privacy') {
            setAcceptedPrivacy(activeUserId);
        } else if (activeTab === 'terms') {
            setAcceptedTerms(activeUserId);
        } else {
            setAcceptedPrivacyTerms(activeUserId);
        }

        privacyTermsModalInstance?.hide();
        if (typeof activeOnAcceptCallback === 'function') {
            activeOnAcceptCallback();
        }
    });
};
/* END WIRE PRIVACY TERMS EVENTS */

/* START SHOW PRIVACY TERMS MODAL - Displays the dialog in either gate mode or review mode */
export const showPrivacyTermsModal = ({
    userId = 'global',
    isGate = false,
    initialTab = 'privacy',
    onAccept = null
} = {}) => {
    activeUserId = userId || 'global';
    isGateMode = Boolean(isGate);
    activeOnAcceptCallback = onAccept;
    
    // Always start with buttons hidden until user actively scrolls down the active tab
    hasReachedBottom = {
        privacy: false,
        terms: false
    };

    const modalEl = createPrivacyTermsModal();

    // Populate contents if not already rendered
    const privacyContent = document.getElementById('privacy-tab-content');
    const termsContent = document.getElementById('terms-tab-content');
    if (privacyContent && !privacyContent.innerHTML) {
        privacyContent.innerHTML = renderPrivacyContent();
    }
    if (termsContent && !termsContent.innerHTML) {
        termsContent.innerHTML = renderTermsContent();
    }

    wirePrivacyTermsEvents(modalEl);

    // Recreate modal instance with the appropriate backdrop and closable options for the active mode
    privacyTermsModalInstance = new Modal(modalEl, {
        placement: 'center',
        backdrop: isGateMode ? 'static' : 'dynamic',
        closable: !isGateMode,
        onShow: () => window.dispatchEvent(new CustomEvent('portal:modal-open')),
        onHide: () => window.dispatchEvent(new CustomEvent('portal:modal-close'))
    });

    // Configure footer buttons based on mode
    const closeBtn = document.getElementById('privacy-terms-close-btn');
    const cancelBtn = document.getElementById('privacy-terms-cancel-btn');
    const acceptBtn = document.getElementById('privacy-terms-accept-btn');

    if (isGateMode) {
        if (closeBtn) closeBtn.classList.add('hidden');
        if (cancelBtn) {
            cancelBtn.innerHTML = `
                <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                <span>Cancel</span>
            `;
        }
        if (acceptBtn) {
            acceptBtn.innerHTML = `
                <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
                <span>I Accept & Continue</span>
            `;
        }
    } else {
        if (closeBtn) closeBtn.classList.remove('hidden');
        if (cancelBtn) {
            cancelBtn.innerHTML = `
                <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                <span>Close</span>
            `;
        }
        if (acceptBtn) {
            acceptBtn.innerHTML = `
                <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>
                <span>Acknowledge</span>
            `;
        }
    }

    syncTabSwitcherUi(initialTab);
    evaluateScrollGate();

    window.dispatchEvent(new CustomEvent('portal:modal-open'));
    privacyTermsModalInstance.show();
};
/* END SHOW PRIVACY TERMS MODAL */

/* START INIT PRIVACY TERMS MODAL - Global delegated click handler for public trigger links */
export const initPrivacyTermsModal = () => {
    if (document.documentElement.dataset.privacyTermsWired === 'true') return;
    document.documentElement.dataset.privacyTermsWired = 'true';

    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-open-privacy-terms]');
        if (!trigger) return;

        event.preventDefault();
        trigger.blur();

        const requestedTab = trigger.dataset.privacyTab || 'privacy';
        showPrivacyTermsModal({
            isGate: false,
            initialTab: requestedTab
        });
    });
};
/* END INIT PRIVACY TERMS MODAL */

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPrivacyTermsModal);
    } else {
        initPrivacyTermsModal();
    }
}
