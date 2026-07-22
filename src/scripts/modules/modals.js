/**
 * DOLE Portal — Centralized Modals System (Flowbite Integration)
 * Standardized image preview modal using Flowbite Modal and Tailwind CSS.
 */

import { Modal } from 'flowbite';

let imageModalInstance = null;
let currentPreviewUrl = '';

/**
 * Triggers a direct file download for an image URL.
 * @param {string} url
 * @param {string} filename
 */
export function downloadImageFile(url, filename = 'attachment-image.png') {
    if (!url) return;
    fetch(url)
        .then(res => res.blob())
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        })
        .catch(() => {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
}

/**
 * Show a clean, borderless large image preview pop-up modal using Flowbite Modal.
 * @param {string} imageUrl — URL of the image to display
 */
export function showImagePreviewModal(imageUrl) {
    if (!imageUrl) return;
    currentPreviewUrl = imageUrl;

    let modalEl = document.getElementById('flowbite-image-preview-modal');

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'flowbite-image-preview-modal';
        modalEl.tabIndex = -1;
        modalEl.className = 'hidden overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-[calc(100%-1rem)] max-h-full bg-black/80 backdrop-blur-md transition-all duration-300';
        modalEl.innerHTML = `
            <div class="relative p-2 w-full max-w-5xl max-h-full">
                <div class="relative bg-transparent rounded-2xl shadow-2xl overflow-hidden flex flex-col items-center">
                    <!-- Floating Top Right Action Controls Bar -->
                    <div class="absolute top-3 right-3 z-50 flex items-center gap-2">
                        <!-- Download Button -->
                        <button type="button" id="download-image-preview-modal-btn" class="cursor-pointer p-2 rounded-full bg-gray-900/80 hover:bg-gray-900 text-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-xs transition-colors shadow-lg" title="Download Image">
                            <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 13V4M7 14H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-2m-1-5-4 5-4-5m9 8h.01"/></svg>
                        </button>
                        <!-- Close Button -->
                        <button type="button" id="close-image-preview-modal-btn" class="cursor-pointer p-2 rounded-full bg-gray-900/80 hover:bg-gray-900 text-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-xs transition-colors shadow-lg" title="Close Preview">
                            <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                            </svg>
                            <span class="sr-only">Close modal</span>
                        </button>
                    </div>

                    <!-- Clean Borderless Image View -->
                    <div class="p-0 flex items-center justify-center w-full max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl">
                        <img id="image-preview-modal-img" src="${imageUrl}" class="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl" alt="Preview Image" />
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        document.getElementById('close-image-preview-modal-btn')?.addEventListener('click', () => {
            if (imageModalInstance) imageModalInstance.hide();
        });

        document.getElementById('download-image-preview-modal-btn')?.addEventListener('click', () => {
            if (currentPreviewUrl) downloadImageFile(currentPreviewUrl);
        });
    } else {
        const imgEl = document.getElementById('image-preview-modal-img');
        if (imgEl) imgEl.src = imageUrl;
    }

    if (!imageModalInstance) {
        imageModalInstance = new Modal(modalEl, {
            placement: 'center',
            backdrop: 'dynamic',
            closable: true,
        });
    }

    imageModalInstance.show();
}
