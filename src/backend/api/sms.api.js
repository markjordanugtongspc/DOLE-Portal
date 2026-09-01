/**
 * DOLE Iligan Portal — Production Client SMS API Connector
 * Provides browser-safe integration with the serverless /api/sms endpoint.
 */

/**
 * Checks the status and configuration readiness of the DOLE SMSAPI gateway.
 * @returns {Promise<{ status: string, configured: boolean, endpoint?: string, error?: string }>}
 */
export async function checkSmsGatewayStatus() {
    try {
        const response = await fetch('/api/sms', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                status: 'offline',
                configured: false,
                error: data.error || 'SMS Gateway unreachable'
            };
        }
        return data;
    } catch (err) {
        return {
            status: 'offline',
            configured: false,
            error: err.message || 'Network error connecting to SMS service'
        };
    }
}

/**
 * Dispatches an SMS notification through the serverless DOLE SMS Gateway.
 * @param {string} phone - Recipient Philippine mobile number
 * @param {string} message - Notification text content
 * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
 */
export async function sendPortalSms(phone, message) {
    if (!phone || !message) {
        return { success: false, error: 'Phone number and message are required.' };
    }

    try {
        const response = await fetch('/api/sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ phone, message })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                success: false,
                error: data.error || 'Failed to dispatch SMS through gateway.'
            };
        }

        return {
            success: true,
            data
        };
    } catch (err) {
        return {
            success: false,
            error: err.message || 'API Offline Cannot Send, Contact Developer'
        };
    }
}
