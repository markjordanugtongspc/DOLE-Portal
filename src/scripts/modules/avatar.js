/**
 * DOLE Portal — Local Inline SVG Avatar Generator
 * Generates instant, zero-network inline SVG avatars with user initials and
 * deterministic thematic colors. Eliminates third-party HTTP roundtrips to ui-avatars.com.
 */

const PALETTE = [
    { bg: '#1d4ed8', color: '#ffffff' }, // Blue 700
    { bg: '#047857', color: '#ffffff' }, // Emerald 700
    { bg: '#6d28d9', color: '#ffffff' }, // Violet 700
    { bg: '#b45309', color: '#ffffff' }, // Amber 700
    { bg: '#0e7490', color: '#ffffff' }, // Cyan 700
    { bg: '#be123c', color: '#ffffff' }, // Rose 700
    { bg: '#4338ca', color: '#ffffff' }, // Indigo 700
    { bg: '#0f766e', color: '#ffffff' }  // Teal 700
];

/* START HASH STRING - Derives a deterministic integer hash from a text string */
function hashString(str = '') {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}
/* END HASH STRING */

/* START EXTRACT INITIALS - Extracts 1-2 uppercase initials from a name */
export function extractInitials(name = '') {
    const clean = String(name || '').trim();
    if (!clean) return 'U';

    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
/* END EXTRACT INITIALS */

/* START BUILD SVG DATA URI - Generates an inline data:image/svg+xml string with initials */
export function buildAvatarSvg(initials, bg = '#1d4ed8', color = '#ffffff') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="100%" height="100%"><rect width="100%" height="100%" fill="${bg}" rx="64"/><text x="50%" y="54%" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="50" font-weight="700" fill="${color}" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
/* END BUILD SVG DATA URI */

/* START GET AVATAR URL - Resolves a user's image URL or generates an instant local inline SVG */
export function getAvatarUrl(person, defaultName = 'User', customBg = null) {
    if (typeof person === 'string') {
        const trimmed = person.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('/')) {
            return trimmed;
        }
        const name = trimmed || defaultName;
        const colorScheme = customBg ? { bg: customBg, color: '#ffffff' } : PALETTE[hashString(name) % PALETTE.length];
        return buildAvatarSvg(extractInitials(name), colorScheme.bg, colorScheme.color);
    }

    if (typeof person === 'object' && person) {
        const directUrl = person.avatar_url || person.avatar || person.profile_image_url || person.photo_url || person.image_url;
        if (directUrl && typeof directUrl === 'string' && directUrl.trim()) {
            return directUrl.trim();
        }
        const name = person.full_name || person.name || person.username || person.email || defaultName;
        const colorScheme = customBg ? { bg: customBg, color: '#ffffff' } : PALETTE[hashString(name) % PALETTE.length];
        return buildAvatarSvg(extractInitials(name), colorScheme.bg, colorScheme.color);
    }

    return buildAvatarSvg(extractInitials(defaultName), PALETTE[0].bg, PALETTE[0].color);
}
/* END GET AVATAR URL */
