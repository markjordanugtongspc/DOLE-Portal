import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SCRYPT_PREFIX = 'scrypt:v1';
const LEGACY_PREFIX = 'sha256:v1:';
const LEGACY_NAMESPACE = 'dole-portal-auth';

/* START CRYPTOGRAPHIC SECURITY HELPERS */
export const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const secureEquals = (left, right) => {
    const a = Buffer.from(String(left));
    const b = Buffer.from(String(right));
    return a.length === b.length && timingSafeEqual(a, b);
};

export const legacyCredentialHash = (value) => `${LEGACY_PREFIX}${sha256(`${LEGACY_NAMESPACE}:${String(value || '')}`)}`;

export const hashCredential = async (value) => {
    const salt = randomBytes(16);
    const digest = await scrypt(String(value || ''), salt, 64);
    return `${SCRYPT_PREFIX}:${salt.toString('base64url')}:${Buffer.from(digest).toString('base64url')}`;
};

export const verifyCredential = async (storedValue, submittedValue) => {
    const stored = String(storedValue || '');
    const submitted = String(submittedValue || '');
    if (!stored || !submitted) return { valid: false, upgrade: false };

    if (stored.startsWith(`${SCRYPT_PREFIX}:`)) {
        const [, , saltEncoded, digestEncoded] = stored.split(':');
        if (!saltEncoded || !digestEncoded) return { valid: false, upgrade: false };
        const digest = await scrypt(submitted, Buffer.from(saltEncoded, 'base64url'), 64);
        return { valid: secureEquals(Buffer.from(digest).toString('base64url'), digestEncoded), upgrade: false };
    }

    const valid = secureEquals(stored, legacyCredentialHash(submitted)) || secureEquals(stored, submitted);
    return { valid, upgrade: valid };
};
/* END CRYPTOGRAPHIC SECURITY HELPERS */