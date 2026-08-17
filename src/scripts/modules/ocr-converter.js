/**
 * OCR Converter Module
 * Scribe.js Optical Character Recognition Client-Side Processing,
 * IndexedDB Storage, Flowbite Masonry Grid Gallery, and Export Suite.
 */

import scribe from 'scribe.js-ocr';
import { authStorage, ocrImageStorage } from './storage.js';
import { Modal } from 'flowbite';

/* START CANVAS 2D WILLREADFREQUENTLY & LEPTONICA WARNING SUPPRESSION */
// Optimize Canvas 2D contexts for OCR readback operations and eliminate browser readback warnings
if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.__patchedGetContext) {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, options) {
        if (type === '2d') {
            options = Object.assign({ willReadFrequently: true }, options);
        }
        return originalGetContext.call(this, type, options);
    };
    HTMLCanvasElement.prototype.__patchedGetContext = true;
}

// Suppress non-fatal Leptonica C-level bounding-box console spam
const LEPTONICA_SUPPRESS_PATTERNS = [
    'Error in boxClipToRectangle',
    'Error in pixScanForForeground',
    'Halftone scan detected'
];

if (typeof console !== 'undefined' && !console.__patchedOcrError) {
    const originalConsoleError = console.error;
    console.error = function (...args) {
        if (args.length > 0 && typeof args[0] === 'string' && LEPTONICA_SUPPRESS_PATTERNS.some((pat) => args[0].includes(pat))) {
            return;
        }
        return originalConsoleError.apply(console, args);
    };
    console.__patchedOcrError = true;
}
/* END CANVAS 2D WILLREADFREQUENTLY & LEPTONICA WARNING SUPPRESSION */

/* START SCRIBE OCR DEBUGGER SYSTEM */
const logOcr = (msg, data = '') => {
    window.DEBUG?.log('SCRIBE_OCR', msg, data);
};

const logOcrSuccess = (msg, data = '') => {
    window.DEBUG?.success('SCRIBE_OCR', msg, data);
};

const logOcrError = (msg, err = '') => {
    window.DEBUG?.error('SCRIBE_OCR', msg, err);
};

const logOcrWarn = (msg, data = '') => {
    window.DEBUG?.warn('SCRIBE_OCR', msg, data);
};
/* END SCRIBE OCR DEBUGGER SYSTEM */

/* Module State */
let activeDocumentId = null;
let cachedImages = [];
let imageModalInstance = null;
let isProcessingOcr = false;
let isInitialRender = true;
let isAddMoreMode = false;
let modalZoomLevel = 0; // 0 = 1x Normal, 1 = 1.6x Zoom, 2 = 2.5x Deep Zoom

const MAX_IMAGE_FILES = 16;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

const ACTIVE_CARD_CLASSES = [
    'ring-2', 'ring-blue-600', 'dark:ring-blue-500',
    'border-blue-500', 'dark:border-blue-500',
    'shadow-md', 'bg-blue-50/40', 'dark:bg-blue-950/20'
];

const INACTIVE_CARD_CLASSES = [
    'border-gray-200', 'dark:border-gray-800',
    'bg-white', 'dark:bg-gray-900',
    'hover:border-gray-300', 'dark:hover:border-gray-700',
    'shadow-xs'
];

/* Helper: Format bytes to human-readable string */
const formatFileSize = (bytes = 0) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/* Helper: Generate unique ID */
const generateUniqueId = () => `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/* START VIEW MODE SWITCHER SYSTEM */
const switchViewMode = (mode = 'dropzone') => {
    const dropzoneSection = document.getElementById('ocr-dropzone-section');
    const workspaceSection = document.getElementById('ocr-workspace-section');
    const cancelBtn = document.getElementById('ocr-cancel-upload-btn');

    if (!dropzoneSection || !workspaceSection) return;

    if (mode === 'dropzone') {
        dropzoneSection.classList.remove('hidden');
        dropzoneSection.style.display = 'block';
        workspaceSection.classList.add('hidden');
        workspaceSection.style.display = 'none';

        // Only show Cancel button if user came from "Add More" and has documents stored
        if (cancelBtn) {
            if (isAddMoreMode === true && cachedImages.length > 0) {
                cancelBtn.classList.remove('hidden');
                cancelBtn.style.display = 'inline-flex';
            } else {
                cancelBtn.classList.add('hidden');
                cancelBtn.style.display = 'none';
            }
        }
    } else {
        dropzoneSection.classList.add('hidden');
        dropzoneSection.style.display = 'none';
        workspaceSection.classList.remove('hidden');
        workspaceSection.style.display = 'block';
        if (cancelBtn) {
            cancelBtn.classList.add('hidden');
            cancelBtn.style.display = 'none';
        }
        isAddMoreMode = false;
    }
};
/* END VIEW MODE SWITCHER SYSTEM */

/* START FLOWBITE TOAST NOTIFICATION SYSTEM */
const showOcrToast = (type = 'success', title = '', message = '') => {
    const container = document.getElementById('ocr-toast-container');
    if (!container) return;

    const toastId = `toast_${Date.now()}`;
    const isSuccess = type === 'success';
    const isWarning = type === 'warning';

    const iconSvg = isSuccess
        ? `<div class="inline-flex items-center justify-center shrink-0 w-8 h-8 text-emerald-500 bg-emerald-100 rounded-lg dark:bg-emerald-800/40 dark:text-emerald-200">
            <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z"/>
            </svg>
            <span class="sr-only">Success icon</span>
           </div>`
        : isWarning
        ? `<div class="inline-flex items-center justify-center shrink-0 w-8 h-8 text-amber-500 bg-amber-100 rounded-lg dark:bg-amber-800/40 dark:text-amber-200">
            <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5Z"/>
            </svg>
            <span class="sr-only">Warning icon</span>
           </div>`
        : `<div class="inline-flex items-center justify-center shrink-0 w-8 h-8 text-red-500 bg-red-100 rounded-lg dark:bg-red-800/40 dark:text-red-200">
            <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 11.793a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 0 1 1.414 1.414L11.414 10l2.293 2.293Z"/>
            </svg>
            <span class="sr-only">Error icon</span>
           </div>`;

    const toastEl = document.createElement('div');
    toastEl.id = toastId;
    toastEl.className = 'pointer-events-auto flex items-center w-full max-w-sm p-4 text-gray-700 bg-white dark:bg-gray-800 dark:text-gray-200 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 transform translate-y-2 opacity-0';
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `
        ${iconSvg}
        <div class="ms-3 text-sm font-medium">
            <p class="font-bold text-gray-900 dark:text-white">${title}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${message}</p>
        </div>
        <button type="button" class="ms-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer" aria-label="Close">
            <span class="sr-only">Close</span>
            <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
            </svg>
        </button>
    `;

    container.appendChild(toastEl);

    // Animate in
    window.requestAnimationFrame(() => {
        toastEl.classList.remove('translate-y-2', 'opacity-0');
    });

    const closeBtn = toastEl.querySelector('button');
    const dismiss = () => {
        toastEl.classList.add('opacity-0', 'scale-95');
        setTimeout(() => toastEl.remove(), 300);
    };

    closeBtn?.addEventListener('click', dismiss);
    setTimeout(dismiss, 4000);
};
/* END FLOWBITE TOAST NOTIFICATION SYSTEM */

/* START FILE UPLOAD AND VALIDATION SYSTEM */
const validateFile = (file) => {
    if (!file) return { valid: false, error: 'No file selected.' };
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    const isValidMime = ALLOWED_MIME_TYPES.includes(file.type);
    const isValidExt = ALLOWED_EXTENSIONS.includes(extension);

    if (!isValidMime && !isValidExt) {
        return {
            valid: false,
            error: `Invalid file format "${file.name}". Only PNG, JPG, and JPEG files are supported.`
        };
    }
    return { valid: true };
};

const readFileAsDataUrl = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
};

const handleFilesUpload = async (fileList) => {
    const alertEl = document.getElementById('ocr-upload-alert');
    const alertMsgEl = document.getElementById('ocr-upload-alert-msg');
    const hideAlert = () => alertEl?.classList.add('hidden');
    const showAlert = (msg) => {
        if (alertEl && alertMsgEl) {
            alertMsgEl.textContent = msg;
            alertEl.classList.remove('hidden');
        }
    };

    hideAlert();
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    // Check remaining quota
    const currentCount = cachedImages.length;
    if (currentCount + files.length > MAX_IMAGE_FILES) {
        const excess = currentCount + files.length - MAX_IMAGE_FILES;
        const msg = `Upload limit reached. You can only attach up to 16 files maximum (${currentCount} already stored). Please remove ${excess} item(s) to proceed.`;
        showAlert(msg);
        showOcrToast('warning', 'Upload Limit Exceeded', msg);
        logOcrWarn('Upload rejected due to max 16 files quota limit.', { currentCount, newFiles: files.length });
        return;
    }

    // Validate each file
    const invalidFiles = [];
    const validFiles = [];
    for (const file of files) {
        const validation = validateFile(file);
        if (!validation.valid) {
            invalidFiles.push(validation.error);
        } else {
            validFiles.push(file);
        }
    }

    if (invalidFiles.length > 0) {
        const errorMsg = invalidFiles.join(' ');
        showAlert(errorMsg);
        showOcrToast('error', 'Unsupported File Type', errorMsg);
        logOcrError('File validation failed', invalidFiles);
        if (validFiles.length === 0) return;
    }

    logOcr(`Reading and preparing ${validFiles.length} uploaded image file(s)...`);

    try {
        const newRecords = [];
        for (const file of validFiles) {
            const dataUrl = await readFileAsDataUrl(file);
            newRecords.push({
                id: generateUniqueId(),
                name: file.name,
                size: file.size,
                type: file.type || 'image/png',
                dataUrl,
                rawText: '',
                status: 'idle', // 'idle' | 'processing' | 'done' | 'error'
                error: null,
                processingTimeMs: null,
                timestamp: Date.now()
            });
        }

        // Persist to IndexedDB
        await ocrImageStorage.saveImages(newRecords);
        cachedImages = await ocrImageStorage.getAllImages();

        logOcrSuccess(`Successfully saved ${newRecords.length} document(s) to exclusive IndexedDB.`);
        showOcrToast(
            'success',
            'Documents Uploaded',
            `Successfully attached ${newRecords.length} file(s). Switching to workspace...`
        );

        // Switch to workspace view and trigger 2-second smooth loading animation
        isAddMoreMode = false;
        switchViewMode('workspace');
        await renderGalleryWithAnimation();

        // Auto-select ONLY the first newly uploaded image
        if (newRecords.length > 0) {
            const firstNewId = newRecords[0].id;
            await selectDocument(firstNewId);
        }
    } catch (err) {
        logOcrError('Failed to process uploaded files', err);
        showAlert('An error occurred while storing uploaded files in IndexedDB.');
        showOcrToast('error', 'Upload Error', 'Failed to store files in local browser database.');
    }
};

const setupDropzoneEvents = () => {
    const fileInput = document.getElementById('dropzone-file');
    const dropzoneLabel = document.getElementById('ocr-dropzone-label');
    const addMoreBtn = document.getElementById('ocr-add-more-btn');
    const cancelBtn = document.getElementById('ocr-cancel-upload-btn');

    if (!fileInput || !dropzoneLabel || dropzoneLabel.dataset.eventsBound) return;

    dropzoneLabel.dataset.eventsBound = 'true';

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFilesUpload(e.target.files);
        fileInput.value = ''; // Reset input
    });

    // Drag and drop feedback
    ['dragenter', 'dragover'].forEach((eventName) => {
        dropzoneLabel.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneLabel.classList.add('border-blue-500', 'bg-blue-50/50', 'dark:bg-blue-950/30', 'scale-[1.01]');
        });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        dropzoneLabel.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneLabel.classList.remove('border-blue-500', 'bg-blue-50/50', 'dark:bg-blue-950/30', 'scale-[1.01]');
        });
    });

    dropzoneLabel.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files) {
            handleFilesUpload(dt.files);
        }
    });

    // Add More button in workspace: switches view back to dropzone in Add More mode
    addMoreBtn?.addEventListener('click', () => {
        isAddMoreMode = true;
        switchViewMode('dropzone');
    });

    // Cancel button in dropzone: switches view back to workspace
    cancelBtn?.addEventListener('click', () => {
        isAddMoreMode = false;
        switchViewMode('workspace');
    });
};
/* END FILE UPLOAD AND VALIDATION SYSTEM */

/* START OCR PROCESSING SERVICE */
const cookDocumentOcr = async (docId) => {
    if (!docId) return;
    const doc = cachedImages.find((img) => img.id === docId);
    if (!doc) return;

    if (isProcessingOcr) {
        logOcrWarn('Another OCR extraction task is currently active, queueing...');
    }

    isProcessingOcr = true;
    updateWorkspaceUiState(docId, 'processing');

    const startTime = performance.now();
    logOcr(`[COOKING START] Cooking raw OCR text for: ${doc.name} (Size: ${formatFileSize(doc.size)})`);

    try {
        // Mark as processing in IndexedDB
        await ocrImageStorage.updateImageOcr(docId, { status: 'processing', error: null });
        updateCardStatusBadge(docId, 'processing');

        // Convert base64 dataUrl to an actual File object with proper name and extension so Scribe handles it
        const res = await fetch(doc.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], doc.name, { type: doc.type || blob.type || 'image/png' });

        logOcr(`Prepared File object for Scribe: "${file.name}" (MIME: ${file.type}, Size: ${file.size} bytes)`);

        // Extract text using Scribe.js OCR
        const extracted = await scribe.extractText([file], ['eng'], 'txt');
        const durationMs = Math.round(performance.now() - startTime);
        const rawText = typeof extracted === 'string' ? extracted : String(extracted || '');

        logOcrSuccess(`[COOKING COMPLETE] Scribe.js finished recognizing "${doc.name}" in ${durationMs}ms`, {
            characters: rawText.length,
            preview: rawText.slice(0, 120)
        });

        // Save result to IndexedDB
        const updated = await ocrImageStorage.updateImageOcr(docId, {
            rawText,
            status: 'done',
            processingTimeMs: durationMs,
            error: null
        });

        // Update local cache
        const index = cachedImages.findIndex((img) => img.id === docId);
        if (index !== -1 && updated) {
            cachedImages[index] = updated;
        }

        // Refresh UI if this document is currently active
        if (activeDocumentId === docId) {
            updateWorkspaceUiState(docId, 'done');
        }

        updateCardStatusBadge(docId, 'done');

        // Gracefully release Scribe memory workers
        try {
            await scribe.terminate();
            logOcr('Scribe OCR worker pool terminated cleanly.');
        } catch {
            // Worker pool will re-initialize on next demand
        }
    } catch (err) {
        const durationMs = Math.round(performance.now() - startTime);
        logOcrError(`[COOKING FAILED] Failed to OCR "${doc.name}" after ${durationMs}ms`, err);

        await ocrImageStorage.updateImageOcr(docId, {
            status: 'error',
            error: err.message || 'OCR processing failed'
        });

        const index = cachedImages.findIndex((img) => img.id === docId);
        if (index !== -1) {
            cachedImages[index].status = 'error';
            cachedImages[index].error = err.message;
        }

        if (activeDocumentId === docId) {
            updateWorkspaceUiState(docId, 'error');
        }

        updateCardStatusBadge(docId, 'error');
        showOcrToast('error', 'OCR Failed', `Could not extract text from ${doc.name}: ${err.message || 'Unknown error'}`);
    } finally {
        isProcessingOcr = false;
    }
};
/* END OCR PROCESSING SERVICE */

/* START CARD SELECTION HELPER */
const applyCardSelectionState = (selectedDocId) => {
    document.querySelectorAll('[data-doc-card]').forEach((card) => {
        const isCurrent = card.getAttribute('data-doc-card') === selectedDocId;
        if (isCurrent) {
            card.classList.remove(...INACTIVE_CARD_CLASSES);
            card.classList.add(...ACTIVE_CARD_CLASSES);
        } else {
            card.classList.remove(...ACTIVE_CARD_CLASSES);
            card.classList.add(...INACTIVE_CARD_CLASSES);
        }
    });
};
/* END CARD SELECTION HELPER */

/* START GALLERY MASONRY AND PREVIEW SYSTEM */
const renderGalleryWithAnimation = async () => {
    const loaderEl = document.getElementById('ocr-gallery-loader');
    const galleryEl = document.getElementById('ocr-masonry-gallery');
    const emptyEl = document.getElementById('ocr-gallery-empty');

    if (!galleryEl) return;

    // Show 2-second round animation loading transition for smooth UX
    if (loaderEl && isInitialRender && cachedImages.length > 0) {
        galleryEl.classList.add('hidden');
        emptyEl?.classList.add('hidden');
        loaderEl.classList.remove('hidden');

        await new Promise((resolve) => setTimeout(resolve, 1800));

        loaderEl.classList.add('hidden');
        galleryEl.classList.remove('hidden');
        isInitialRender = false;
    } else if (loaderEl) {
        loaderEl.classList.add('hidden');
        galleryEl.classList.remove('hidden');
    }

    renderMasonryGallery();
};

const renderMasonryGallery = () => {
    const galleryEl = document.getElementById('ocr-masonry-gallery');
    const emptyEl = document.getElementById('ocr-gallery-empty');
    const badgeEl = document.getElementById('ocr-gallery-badge');
    const countPillEl = document.getElementById('ocr-stored-count');
    const clearAllBtn = document.getElementById('ocr-clear-all-btn');

    if (!galleryEl) return;

    const count = cachedImages.length;
    if (badgeEl) badgeEl.textContent = count;
    if (countPillEl) countPillEl.textContent = count;
    if (clearAllBtn) clearAllBtn.disabled = count === 0;

    if (count === 0) {
        galleryEl.innerHTML = '';
        emptyEl?.classList.remove('hidden');
        activeDocumentId = null;
        updateWorkspaceUiState(null, 'empty');
        isAddMoreMode = false;
        switchViewMode('dropzone');
        return;
    }

    emptyEl?.classList.add('hidden');

    // Split items into 2 columns for Masonry layout
    const col1Items = [];
    const col2Items = [];

    cachedImages.forEach((img, idx) => {
        if (idx % 2 === 0) col1Items.push(img);
        else col2Items.push(img);
    });

    const renderCard = (img) => {
        const isActive = img.id === activeDocumentId;
        const status = img.status || 'idle';

        const statusBadge =
            status === 'done'
                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Extracted
                   </span>`
                : status === 'processing'
                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                    <svg class="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>Cooking...
                   </span>`
                : status === 'error'
                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900/60">
                    <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>Error
                   </span>`
                : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>Pending
                   </span>`;

        const activeClasses = isActive
            ? ACTIVE_CARD_CLASSES.join(' ')
            : INACTIVE_CARD_CLASSES.join(' ');

        return `
            <div data-doc-card="${img.id}" class="group relative rounded-2xl border ${activeClasses} p-2.5 transition-all duration-200 cursor-pointer flex flex-col space-y-2">
                <!-- Thumbnail with Hover Action Overlay -->
                <div class="relative w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-950 aspect-[4/3] flex items-center justify-center">
                    <img src="${img.dataUrl}" alt="${img.name}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                    <div class="absolute inset-0 bg-gray-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1.5">
                        <button type="button" data-modal-preview="${img.id}" title="Enlarge image" class="cursor-pointer p-1.5 rounded-lg bg-white/90 dark:bg-gray-900/90 text-gray-800 dark:text-white hover:bg-white dark:hover:bg-gray-800 shadow-md transition-transform hover:scale-110">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Info & Metadata -->
                <div class="space-y-1">
                    <div class="flex items-center justify-between gap-1">
                        <p class="text-xs font-bold text-gray-900 dark:text-white truncate" title="${img.name}">${img.name}</p>
                        <button type="button" data-delete-doc="${img.id}" title="Delete document" class="cursor-pointer text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded-md transition-colors">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                    <div class="flex items-center justify-between gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <span>${formatFileSize(img.size)}</span>
                        <div id="ocr-card-badge-${img.id}">${statusBadge}</div>
                    </div>
                </div>
            </div>
        `;
    };

    galleryEl.innerHTML = `
        <div class="grid gap-3 sm:gap-4">${col1Items.map(renderCard).join('')}</div>
        <div class="grid gap-3 sm:gap-4">${col2Items.map(renderCard).join('')}</div>
    `;

    // Bind Gallery Card Events: Single selection only
    galleryEl.querySelectorAll('[data-doc-card]').forEach((card) => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('[data-modal-preview]') || e.target.closest('[data-delete-doc]')) {
                return;
            }
            const docId = card.getAttribute('data-doc-card');
            selectDocument(docId);
        });
    });

    // Modal enlarge triggers
    galleryEl.querySelectorAll('[data-modal-preview]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const docId = btn.getAttribute('data-modal-preview');
            openLargeImageModal(docId);
        });
    });

    // Delete triggers
    galleryEl.querySelectorAll('[data-delete-doc]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const docId = btn.getAttribute('data-delete-doc');
            await deleteDocument(docId);
        });
    });
};

const updateCardStatusBadge = (docId, status) => {
    const badgeContainer = document.getElementById(`ocr-card-badge-${docId}`);
    if (!badgeContainer) return;

    if (status === 'done') {
        badgeContainer.innerHTML = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Extracted</span>`;
    } else if (status === 'processing') {
        badgeContainer.innerHTML = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60"><svg class="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>Cooking...</span>`;
    } else if (status === 'error') {
        badgeContainer.innerHTML = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900/60"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>Error</span>`;
    }
};

/* START HARDWARE-ACCELERATED 2D PAN AND ZOOM ENGINE */
let currentPan = { x: 0, y: 0 };
let startPan = { x: 0, y: 0 };
let isPointerDown = false;
let startPointerPos = { x: 0, y: 0 };
let hasDragged = false;

const getZoomScale = () => {
    if (modalZoomLevel === 1) return 1.6;
    if (modalZoomLevel === 2) return 2.5;
    return 1.0;
};

const applyImageTransform = (animate = false) => {
    const modalImageEl = document.getElementById('ocr-modal-image');
    if (!modalImageEl) return;

    const scale = getZoomScale();
    modalImageEl.style.transition = animate ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
    modalImageEl.style.transform = `translate3d(${currentPan.x}px, ${currentPan.y}px, 0px) scale(${scale})`;
};

const updateModalZoomView = () => {
    const modalEl = document.getElementById('ocr-image-modal');
    const modalImageEl = document.getElementById('ocr-modal-image');
    const modalHeaderEl = document.getElementById('ocr-modal-header');
    const modalFooterEl = document.getElementById('ocr-modal-footer');
    const floatingBarEl = document.getElementById('ocr-modal-floating-bar');
    const floatingZoomEl = document.getElementById('ocr-modal-floating-zoom');
    const zoomPillEl = document.getElementById('ocr-modal-zoom-pill');
    const dialogEl = document.getElementById('ocr-modal-dialog');
    const bodyEl = document.getElementById('ocr-modal-body');

    if (!modalEl || !modalImageEl || !dialogEl || !bodyEl) return;

    // Reset pan position on zoom change so image starts cleanly centered
    currentPan = { x: 0, y: 0 };

    if (modalZoomLevel === 0) {
        // Level 0: Standard 1x modal view
        modalEl.classList.remove('p-0', 'bg-gray-950/95');
        modalEl.classList.add('p-2', 'sm:p-4', 'bg-gray-950/80');

        dialogEl.className = 'relative w-full max-w-5xl max-h-[95vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col transition-all duration-300';
        bodyEl.className = 'relative flex-1 p-4 bg-gray-100 dark:bg-gray-950 flex items-center justify-center overflow-hidden max-h-[75vh] select-none';

        modalHeaderEl?.classList.remove('hidden');
        modalFooterEl?.classList.remove('hidden');
        floatingBarEl?.classList.add('hidden');
        if (zoomPillEl) zoomPillEl.textContent = '1x (Click image to zoom)';

        modalImageEl.className = 'max-w-full max-h-[68vh] object-contain rounded-lg shadow-md cursor-grab select-none will-change-transform';
        applyImageTransform(true);
    } else if (modalZoomLevel === 1) {
        // Level 1: 1.6x Fullscreen Mode (True F11 edge-to-edge, zero borders, draggable anywhere)
        modalEl.classList.remove('p-2', 'sm:p-4', 'bg-gray-950/80');
        modalEl.classList.add('p-0', 'bg-gray-950/95');

        dialogEl.className = 'relative w-screen h-screen max-w-none max-h-none rounded-none border-0 shadow-none bg-transparent overflow-hidden flex flex-col transition-all duration-300';
        bodyEl.className = 'w-screen h-screen max-h-none p-0 overflow-hidden bg-transparent flex items-center justify-center select-none';

        modalHeaderEl?.classList.add('hidden');
        modalFooterEl?.classList.add('hidden');
        floatingBarEl?.classList.remove('hidden');
        if (floatingZoomEl) floatingZoomEl.textContent = 'Zoom 1.6x (Click for 2.5x • Drag in any direction)';

        modalImageEl.className = 'max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl cursor-grab select-none will-change-transform';
        applyImageTransform(true);
    } else if (modalZoomLevel === 2) {
        // Level 2: 2.5x Deep Zoom Mode (Maximum document clarity, draggable in any direction)
        modalEl.classList.remove('p-2', 'sm:p-4', 'bg-gray-950/80');
        modalEl.classList.add('p-0', 'bg-gray-950/95');

        dialogEl.className = 'relative w-screen h-screen max-w-none max-h-none rounded-none border-0 shadow-none bg-transparent overflow-hidden flex flex-col transition-all duration-300';
        bodyEl.className = 'w-screen h-screen max-h-none p-0 overflow-hidden bg-transparent flex items-center justify-center select-none';

        modalHeaderEl?.classList.add('hidden');
        modalFooterEl?.classList.add('hidden');
        floatingBarEl?.classList.remove('hidden');
        if (floatingZoomEl) floatingZoomEl.textContent = 'Zoom 2.5x (Click to reset 1x • Drag in any direction)';

        modalImageEl.className = 'max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl cursor-grab select-none will-change-transform';
        applyImageTransform(true);
    }
};

const closeImageModal = () => {
    modalZoomLevel = 0;
    currentPan = { x: 0, y: 0 };
    updateModalZoomView();
    if (imageModalInstance) {
        imageModalInstance.hide();
    }
};

const openLargeImageModal = (docId) => {
    const doc = cachedImages.find((img) => img.id === docId);
    if (!doc) return;

    const modalEl = document.getElementById('ocr-image-modal');
    const modalImageEl = document.getElementById('ocr-modal-image');
    const modalBodyEl = document.getElementById('ocr-modal-body');
    const modalFilenameEl = document.getElementById('ocr-modal-filename');
    const modalFilesizeEl = document.getElementById('ocr-modal-filesize');
    const closeBtn = document.getElementById('ocr-modal-close-btn');
    const footerCloseBtn = document.getElementById('ocr-modal-footer-close-btn');
    const floatingCloseBtn = document.getElementById('ocr-modal-floating-close');

    if (!modalEl || !modalImageEl || !modalBodyEl) return;

    modalZoomLevel = 0;
    currentPan = { x: 0, y: 0 };
    updateModalZoomView();

    modalImageEl.src = doc.dataUrl;
    modalImageEl.setAttribute('draggable', 'false');
    if (modalFilenameEl) modalFilenameEl.textContent = doc.name;
    if (modalFilesizeEl) modalFilesizeEl.textContent = `${formatFileSize(doc.size)} • Uploaded locally`;

    if (!imageModalInstance) {
        imageModalInstance = new Modal(modalEl, {
            placement: 'center',
            backdrop: 'dynamic',
            closable: true
        });

        closeBtn?.addEventListener('click', closeImageModal);
        footerCloseBtn?.addEventListener('click', closeImageModal);
        floatingCloseBtn?.addEventListener('click', closeImageModal);

        // Hardware-Accelerated Grab & Drag-to-Pan System
        const onPanStart = (clientX, clientY) => {
            isPointerDown = true;
            hasDragged = false;
            startPointerPos = { x: clientX, y: clientY };
            startPan = { ...currentPan };
            modalImageEl.classList.add('cursor-grabbing');
            modalImageEl.classList.remove('cursor-grab');
            modalBodyEl.classList.add('cursor-grabbing');
        };

        const onPanMove = (clientX, clientY) => {
            if (!isPointerDown) return;
            const deltaX = clientX - startPointerPos.x;
            const deltaY = clientY - startPointerPos.y;

            if (Math.hypot(deltaX, deltaY) > 5) {
                hasDragged = true;
                currentPan = {
                    x: startPan.x + deltaX,
                    y: startPan.y + deltaY
                };
                applyImageTransform(false);
            }
        };

        const onPanEnd = () => {
            if (isPointerDown) {
                isPointerDown = false;
                modalImageEl.classList.remove('cursor-grabbing');
                modalImageEl.classList.add('cursor-grab');
                modalBodyEl.classList.remove('cursor-grabbing');
            }
        };

        // Mouse events
        modalBodyEl.addEventListener('mousedown', (e) => {
            if (e.target === closeBtn || e.target === floatingCloseBtn) return;
            onPanStart(e.clientX, e.clientY);
        });

        window.addEventListener('mousemove', (e) => {
            if (isPointerDown) {
                onPanMove(e.clientX, e.clientY);
            }
        });

        window.addEventListener('mouseup', () => {
            if (isPointerDown) {
                onPanEnd();
            }
        });

        // Touch events for mobile/tablet panning
        modalBodyEl.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                onPanStart(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });

        modalBodyEl.addEventListener('touchmove', (e) => {
            if (isPointerDown && e.touches.length === 1) {
                onPanMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });

        modalBodyEl.addEventListener('touchend', onPanEnd);

        // Click-to-zoom on image (only triggers when user did not drag)
        modalImageEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (hasDragged) {
                hasDragged = false;
                return;
            }
            modalZoomLevel = (modalZoomLevel + 1) % 3;
            updateModalZoomView();
        });

        // Close on ESC key press
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) {
                closeImageModal();
            }
        });
    }

    imageModalInstance.show();
};
/* END HARDWARE-ACCELERATED 2D PAN AND ZOOM ENGINE */

/* START OCR OUTPUT AND EXPORT SYSTEM */
const selectDocument = async (docId) => {
    if (!docId) return;

    // Strict single selection
    activeDocumentId = docId;
    applyCardSelectionState(docId);

    const doc = cachedImages.find((img) => img.id === docId);
    if (!doc) return;

    // If never cooked before or idle, cook it automatically
    if (!doc.rawText && doc.status !== 'processing' && doc.status !== 'error') {
        await cookDocumentOcr(docId);
    } else {
        updateWorkspaceUiState(docId, doc.status || 'done');
    }
};

const updateWorkspaceUiState = (docId, state) => {
    const subtitleEl = document.getElementById('ocr-active-doc-subtitle');
    const textareaEl = document.getElementById('ocr-raw-output-textarea');
    const overlayEl = document.getElementById('ocr-processing-overlay');
    const statusTextEl = document.getElementById('ocr-status-text');
    const statusIndicatorEl = document.getElementById('ocr-status-indicator');
    const charCountEl = document.getElementById('ocr-char-count');
    const timeCostEl = document.getElementById('ocr-time-cost');
    const statsSummaryEl = document.getElementById('ocr-stats-summary');
    const rerunBtnEl = document.getElementById('ocr-rerun-btn');
    const copyBtnEl = document.getElementById('ocr-copy-btn');
    const btnJson = document.getElementById('ocr-btn-json');
    const btnCsv = document.getElementById('ocr-btn-csv');

    if (!docId || state === 'empty') {
        if (subtitleEl) subtitleEl.textContent = 'Select a document card from the left to inspect raw extracted text.';
        if (textareaEl) textareaEl.value = '';
        overlayEl?.classList.add('hidden');
        if (statusTextEl) statusTextEl.textContent = 'No Document Selected';
        if (statusIndicatorEl) {
            statusIndicatorEl.firstElementChild.className = 'w-2 h-2 rounded-full bg-gray-400';
        }
        charCountEl?.classList.add('hidden');
        timeCostEl?.classList.add('hidden');
        statsSummaryEl?.classList.add('hidden');
        rerunBtnEl?.classList.add('hidden');
        if (copyBtnEl) copyBtnEl.disabled = true;
        if (btnJson) btnJson.disabled = true;
        if (btnCsv) btnCsv.disabled = true;
        return;
    }

    const doc = cachedImages.find((img) => img.id === docId);
    if (!doc) return;

    if (subtitleEl) subtitleEl.textContent = `Inspecting raw optical text for "${doc.name}"`;

    if (state === 'processing') {
        overlayEl?.classList.remove('hidden');
        if (statusTextEl) statusTextEl.textContent = 'Cooking OCR in background...';
        if (statusIndicatorEl) {
            statusIndicatorEl.firstElementChild.className = 'w-2 h-2 rounded-full bg-blue-500 animate-ping';
        }
        rerunBtnEl?.classList.add('hidden');
        if (copyBtnEl) copyBtnEl.disabled = true;
        if (btnJson) btnJson.disabled = true;
        if (btnCsv) btnCsv.disabled = true;
    } else {
        overlayEl?.classList.add('hidden');
        if (textareaEl) textareaEl.value = doc.rawText || (doc.status === 'error' ? `[Error]: ${doc.error || 'Failed to extract text.'}` : '');

        const textLen = (doc.rawText || '').length;
        if (charCountEl) {
            charCountEl.textContent = `${textLen.toLocaleString()} chars`;
            charCountEl.classList.remove('hidden');
        }

        if (timeCostEl && doc.processingTimeMs) {
            timeCostEl.textContent = `(${doc.processingTimeMs}ms)`;
            timeCostEl.classList.remove('hidden');
        }

        statsSummaryEl?.classList.remove('hidden');
        rerunBtnEl?.classList.remove('hidden');

        if (statusTextEl) {
            statusTextEl.textContent = doc.status === 'done' ? 'Extracted successfully' : doc.status === 'error' ? 'Extraction failed' : 'Ready';
        }

        if (statusIndicatorEl) {
            statusIndicatorEl.firstElementChild.className =
                doc.status === 'done'
                    ? 'w-2 h-2 rounded-full bg-emerald-500'
                    : doc.status === 'error'
                    ? 'w-2 h-2 rounded-full bg-red-500'
                    : 'w-2 h-2 rounded-full bg-gray-400';
        }

        if (copyBtnEl) copyBtnEl.disabled = !doc.rawText;
        if (btnJson) btnJson.disabled = !doc.rawText;
        if (btnCsv) btnCsv.disabled = !doc.rawText;
    }
};

const deleteDocument = async (docId) => {
    if (!docId) return;
    try {
        await ocrImageStorage.deleteImage(docId);
        cachedImages = cachedImages.filter((img) => img.id !== docId);
        logOcr(`Deleted document ${docId} from IndexedDB.`);

        if (activeDocumentId === docId) {
            activeDocumentId = cachedImages.length > 0 ? cachedImages[0].id : null;
        }

        renderMasonryGallery();
        if (activeDocumentId) {
            selectDocument(activeDocumentId);
        } else {
            updateWorkspaceUiState(null, 'empty');
        }

        showOcrToast('success', 'Document Removed', 'The file was removed from local browser memory.');
    } catch (err) {
        logOcrError('Failed to delete document', err);
    }
};

const clearAllDocuments = async () => {
    if (cachedImages.length === 0) return;
    const confirmClear = window.confirm('Are you sure you want to clear all uploaded documents from your local workspace?');
    if (!confirmClear) return;

    try {
        await ocrImageStorage.clearAllImages();
        cachedImages = [];
        activeDocumentId = null;
        renderMasonryGallery();
        updateWorkspaceUiState(null, 'empty');
        isAddMoreMode = false;
        switchViewMode('dropzone');
        logOcrSuccess('Cleared all OCR document images from IndexedDB.');
        showOcrToast('success', 'Workspace Cleared', 'All local documents have been deleted.');
    } catch (err) {
        logOcrError('Failed to clear IndexedDB documents', err);
    }
};

const setupWorkspaceActions = () => {
    const copyBtn = document.getElementById('ocr-copy-btn');
    const copyLabel = document.getElementById('ocr-copy-label');
    const rerunBtn = document.getElementById('ocr-rerun-btn');
    const clearAllBtn = document.getElementById('ocr-clear-all-btn');
    const btnJson = document.getElementById('ocr-btn-json');
    const btnCsv = document.getElementById('ocr-btn-csv');

    // Copy to clipboard
    copyBtn?.addEventListener('click', async () => {
        const doc = cachedImages.find((img) => img.id === activeDocumentId);
        if (!doc || !doc.rawText) return;

        try {
            await navigator.clipboard.writeText(doc.rawText);
            if (copyLabel) copyLabel.textContent = 'Copied!';
            showOcrToast('success', 'Copied to Clipboard', 'Raw OCR text copied successfully.');
            setTimeout(() => {
                if (copyLabel) copyLabel.textContent = 'Copy Text';
            }, 2000);
        } catch {
            showOcrToast('error', 'Copy Failed', 'Unable to access system clipboard.');
        }
    });

    // Re-run OCR
    rerunBtn?.addEventListener('click', () => {
        if (activeDocumentId) {
            cookDocumentOcr(activeDocumentId);
        }
    });

    // Clear all
    clearAllBtn?.addEventListener('click', clearAllDocuments);

    // Convert to JSON
    btnJson?.addEventListener('click', () => {
        const doc = cachedImages.find((img) => img.id === activeDocumentId);
        if (!doc || !doc.rawText) return;

        const lines = doc.rawText.split('\n').filter((l) => l.trim().length > 0);
        const jsonPayload = {
            fileName: doc.name,
            fileSize: doc.size,
            fileType: doc.type,
            processedAt: new Date().toISOString(),
            processingTimeMs: doc.processingTimeMs || null,
            totalCharacters: doc.rawText.length,
            totalLines: lines.length,
            extractedLines: lines
        };

        const jsonString = JSON.stringify(jsonPayload, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc.name.replace(/\.[^/.]+$/, '')}_ocr_extracted.json`;
        a.click();
        URL.revokeObjectURL(url);

        logOcrSuccess(`Exported JSON for ${doc.name}`);
        showOcrToast('success', 'JSON Exported', `Downloaded ${a.download}`);
    });

    // Convert to CSV
    btnCsv?.addEventListener('click', () => {
        const doc = cachedImages.find((img) => img.id === activeDocumentId);
        if (!doc || !doc.rawText) return;

        const lines = doc.rawText.split('\n').filter((l) => l.trim().length > 0);
        const csvRows = ['Line Number,Extracted Text'];
        lines.forEach((line, index) => {
            const escaped = `"${line.replace(/"/g, '""')}"`;
            csvRows.push(`${index + 1},${escaped}`);
        });

        const csvString = csvRows.join('\r\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc.name.replace(/\.[^/.]+$/, '')}_ocr_extracted.csv`;
        a.click();
        URL.revokeObjectURL(url);

        logOcrSuccess(`Exported CSV for ${doc.name}`);
        showOcrToast('success', 'CSV Exported', `Downloaded ${a.download}`);
    });
};
/* END OCR OUTPUT AND EXPORT SYSTEM */

/* START OCR MODULE LIFECYCLE INIT */
export const initOcrConverterModule = async () => {
    const mainContent = document.getElementById('ocr-main-content');
    if (!mainContent) return;

    logOcr('Initializing OCR Converter module...');

    // Dynamically align breadcrumb dashboard target to role
    const dashboardLink = document.getElementById('ocr-breadcrumb-dashboard-link');
    const sessionUser = authStorage.getUserSession();
    if (dashboardLink && sessionUser) {
        dashboardLink.href = Number(sessionUser.role_id) === 1
            ? '/src/pages/user/admin/dashboard/'
            : '/src/pages/user/staff/dashboard/';
    }

    setupDropzoneEvents();
    setupWorkspaceActions();

    try {
        // Load persistent documents from IndexedDB (survives hard reloads)
        cachedImages = await ocrImageStorage.getAllImages();
        logOcrSuccess(`Retrieved ${cachedImages.length} existing document(s) from IndexedDB.`);

        if (cachedImages.length > 0) {
            isAddMoreMode = false;
            switchViewMode('workspace');
            await renderGalleryWithAnimation();
            await selectDocument(cachedImages[0].id);
        } else {
            isAddMoreMode = false;
            switchViewMode('dropzone');
            updateWorkspaceUiState(null, 'empty');
        }
    } catch (err) {
        logOcrError('Failed to initialize IndexedDB for OCR converter', err);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOcrConverterModule);
} else {
    initOcrConverterModule();
}
/* END OCR MODULE LIFECYCLE INIT */
