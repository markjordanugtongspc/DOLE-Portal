import { createExternalAccountLinks, requestSystemSsoLaunch } from '@/backend/api/external-links.api.js';

/* START EXTERNAL SYSTEMS OOP CONTROLLER */
export class ExternalsController {
    constructor() {
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;
        window.addEventListener('portal:assign-user-confirmed', (event) => this.assignSelectedSystems(event.detail));
        window.addEventListener('portal:system-launch', (event) => this.launchSystem(event.detail));
    }

    /* Child function: persist only the selected Portal-to-system mappings. */
    async assignSystems(user, matches = []) {
        if (!user || !matches.length) return;
        const result = await createExternalAccountLinks(user, matches);
        if (result.error) {
            window.DEBUG?.error('EXTERNALS', 'External account assignment failed.', result.error);
            this.showNotice(result.error, 'danger');
            return;
        }
        window.DEBUG?.success('EXTERNALS', 'External account links saved.', { count: matches.length });
        this.showNotice(`${matches.length} system account${matches.length === 1 ? '' : 's'} assigned successfully.`, 'success');
    }

    /* Parent event handler delegates assignment to the child function above. */
    async assignSelectedSystems({ user, matches = [] } = {}) {
        return this.assignSystems(user, matches);
    }

    /* Child function: ask the trusted backend to generate the one-time SSO code.
       The browser never creates, stores, or signs this authorization token. */
    async generateAuthToken(systemKey) {
        return requestSystemSsoLaunch(systemKey);
    }

    async launchSystem({ systemKey, url } = {}) {
        if (!systemKey) return;

        // Open a blank tab synchronously to prevent popup blockers
        const newTab = window.open('about:blank', '_blank', 'noopener,noreferrer');

        const result = await this.generateAuthToken(systemKey);
        if (!result.error && result.data?.redirect_url) {
            if (newTab) {
                newTab.location.href = result.data.redirect_url;
            } else {
                window.open(result.data.redirect_url, '_blank', 'noopener,noreferrer');
            }
            return;
        }

        window.DEBUG?.warn('EXTERNALS', 'SSO launch is not available; opening the normal system link.', result.error || 'Missing redirect URL.');
        if (newTab) {
            if (url) {
                newTab.location.href = url;
            } else {
                newTab.close();
            }
        } else if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }

    showNotice(message, type = 'info') {
        const notice = document.createElement('div');
        notice.className = `fixed bottom-5 right-5 z-[100] max-w-sm border px-4 py-3 text-sm font-semibold shadow-lg ${type === 'danger' ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'}`;
        notice.textContent = message;
        document.body.appendChild(notice);
        window.setTimeout(() => notice.remove(), 4500);
    }
}

export const externalsController = new ExternalsController();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => externalsController.init(), { once: true });
} else {
    externalsController.init();
}
/* END EXTERNAL SYSTEMS OOP CONTROLLER */