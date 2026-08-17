/**
 * Browser mock for Node-only @scribe.js/canvas module
 * Scribe.js uses native browser OffscreenCanvas/ImageData in the browser environment.
 */
export default {};
export const ImageData = typeof globalThis !== 'undefined' ? globalThis.ImageData : undefined;
export const DOMMatrix = typeof globalThis !== 'undefined' ? globalThis.DOMMatrix : undefined;
export const createCanvas = () => null;
