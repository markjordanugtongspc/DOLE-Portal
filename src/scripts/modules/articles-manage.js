import { fetchArticles, fetchArticleById, createArticle, updateArticle, uploadArticleImage } from '@/backend/api/articles.api.js';
import { saveArticleDraft, getArticleDraft, clearArticleDraft } from '@/scripts/modules/storage.js';
import { supabase } from '@/backend/api/supabase.js';
import { Modal } from 'flowbite';

const ARTICLE_STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'system-images';

/** Detect the base articles path based on which role sidebar is loaded */
function detectArticlesBasePath() {
    const path = window.location.pathname;
    if (path.includes('/staff/')) return '/src/pages/user/staff/articles/';
    return '/src/pages/user/admin/articles/';
}

class ArticlesBrowseController {
    constructor() {
        this.gridEl = document.getElementById('articles-grid');
        if (!this.gridEl) return;

        if (window.DEBUG) {
            window.DEBUG.log('ARTICLES_BROWSE', 'Initializing ArticlesBrowseController...');
        }

        this.articlesBasePath = detectArticlesBasePath();

        this.articles = [];
        this.selectedCategory = 'All';
        this.coverImageUrl = '';
        this.stagedImages = new Map(); // Map<stagedId, File>
        this.stagedCoverFile = null;

        this.createModalOptions = {
            backdropClasses: 'bg-gray-900/40 dark:bg-gray-950/60 fixed inset-0 z-40 backdrop-blur-sm',
            closable: true
        };
        this.subModalOptions = {
            backdropClasses: 'hidden',
            closable: true
        };

        this.initCreateModal();
        this.initInsertImageModal();
        this.initInsertLinkModal();
        this.initPreviewModal();
        this.initTagPlaceholders();
        this.initEvents();
        this.loadArticles();
    }

    // ---------------------------------------------------------------------------
    // CREATE MODAL — only runs when admin create button/form are in the DOM
    // ---------------------------------------------------------------------------


    initCreateModal() {
        // Guard: create modal only available on admin page
        const createBtn = document.getElementById('btn-create-article');
        const modalEl = document.getElementById('createArticleModal');
        if (!createBtn && !modalEl) return;

        if (modalEl) {
            this.createModalInstance = new Modal(modalEl, this.createModalOptions);

            // Bind manual close/cancel buttons to destroy draft
            modalEl.querySelectorAll('[data-modal-hide="createArticleModal"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (btn.id === 'btn-cancel-create-article' || btn.getAttribute('data-action') === 'cancel') {
                        this.destroyDraftAndResetForm();
                    }
                    this.createModalInstance.hide();
                });
            });
        }

        // Bind manual open trigger with cursor-pointer & Draft Restore
        if (createBtn) {
            createBtn.classList.add('cursor-pointer');
            createBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.restoreDraftIfAvailable();
                if (this.createModalInstance) {
                    this.createModalInstance.show();
                }
            });
        }

        // Auto-open create modal if navigated from tickets with create parameter
        const urlParams = new URLSearchParams(window.location.search);
        const autoCreate = urlParams.get('create') === 'true' || sessionStorage.getItem('auto_open_create_article') === 'true';
        if (autoCreate) {
            sessionStorage.removeItem('auto_open_create_article');
            setTimeout(() => {
                this.restoreDraftIfAvailable();
                if (this.createModalInstance) {
                    this.createModalInstance.show();
                }
            }, 350);
        }

        // Searchable Category Dropdown Elements
        const catBtn = document.getElementById('modal-category-dropdown-btn');
        const catList = document.getElementById('modal-category-dropdown-list');
        const catSearch = document.getElementById('modal-category-search-input');
        const catInput = document.getElementById('article-category-input');
        const catSelectedText = document.getElementById('modal-category-selected-text');
        const catOptions = document.querySelectorAll('.modal-category-option');

        if (catBtn && catList) {
            catBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                catList.classList.toggle('hidden');
                if (!catList.classList.contains('hidden') && catSearch) {
                    catSearch.value = '';
                    catOptions.forEach(opt => opt.classList.remove('hidden'));
                    catSearch.focus();
                }
            });

            if (catSearch) {
                catSearch.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase().trim();
                    catOptions.forEach(opt => {
                        const val = opt.getAttribute('data-value').toLowerCase();
                        if (val.includes(query)) {
                            opt.classList.remove('hidden');
                        } else {
                            opt.classList.add('hidden');
                        }
                    });
                });
            }

            catOptions.forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const value = opt.getAttribute('data-value');
                    if (catInput) catInput.value = value;
                    if (catSelectedText) catSelectedText.textContent = value;

                    catOptions.forEach(o => {
                        o.classList.remove('font-semibold', 'bg-blue-50', 'dark:bg-blue-900/30');
                        o.classList.add('font-medium');
                    });
                    opt.classList.add('font-semibold', 'bg-blue-50', 'dark:bg-blue-900/30');
                    opt.classList.remove('font-medium');

                    catList.classList.add('hidden');
                    this.saveCurrentDraft();
                });
            });

            document.addEventListener('click', (e) => {
                if (catList && !catList.contains(e.target) && !catBtn.contains(e.target)) {
                    catList.classList.add('hidden');
                }
            });
        }

        // Cover Photo Inputs & Live Preview
        const coverFileInput = document.getElementById('article-cover-file-input');
        const coverUrlInput = document.getElementById('article-cover-url-input');
        const coverContainer = document.getElementById('cover-preview-container');
        const coverImg = document.getElementById('cover-preview-img');
        const removeCoverBtn = document.getElementById('btn-remove-cover');

        const updateCoverPreview = (src) => {
            if (src && coverContainer && coverImg) {
                coverImg.src = src;
                coverContainer.classList.remove('hidden');
            }
        };

        if (coverUrlInput) {
            coverUrlInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (val) {
                    this.stagedCoverFile = null;
                    this.coverImageUrl = val;
                    updateCoverPreview(val);
                    this.saveCurrentDraft();
                }
            });
        }

        if (coverFileInput) {
            coverFileInput.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (file) {
                    this.stagedCoverFile = file;
                    const blobUrl = URL.createObjectURL(file);
                    updateCoverPreview(blobUrl);
                    this.saveCurrentDraft();
                }
            });
        }

        if (removeCoverBtn) {
            removeCoverBtn.addEventListener('click', () => {
                this.coverImageUrl = '';
                this.stagedCoverFile = null;
                if (coverContainer) coverContainer.classList.add('hidden');
                if (coverImg) coverImg.src = '';
                if (coverFileInput) coverFileInput.value = '';
                if (coverUrlInput) coverUrlInput.value = '';
                this.saveCurrentDraft();
            });
        }

        // Rich Text Toolbar Formatting Actions (Bold, Italic, Underline, H3, List)
        const summaryTextarea = document.getElementById('article-summary-input');
        const toolbarButtons = document.querySelectorAll('[data-cmd]');
        toolbarButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const cmd = btn.getAttribute('data-cmd');
                this.applyToolbarCommand(summaryTextarea, cmd);
                this.saveCurrentDraft();
            });
        });

        // Auto-save draft on input typing
        const formEl = document.getElementById('create-article-form');
        if (formEl) {
            formEl.addEventListener('input', () => this.saveCurrentDraft());
            formEl.addEventListener('change', () => this.saveCurrentDraft());
            formEl.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCreateArticle(formEl);
            });
        }
    }

    destroyDraftAndResetForm() {
        clearArticleDraft();
        const formEl = document.getElementById('create-article-form');
        if (formEl) formEl.reset();
        this.coverImageUrl = '';
        this.stagedCoverFile = null;
        this.stagedImages.clear();
        const coverContainer = document.getElementById('cover-preview-container');
        if (coverContainer) coverContainer.classList.add('hidden');

        const catInput = document.getElementById('article-category-input');
        const catSelectedText = document.getElementById('modal-category-selected-text');
        if (catInput) catInput.value = 'Tutorial';
        if (catSelectedText) catSelectedText.textContent = 'Tutorial';
    }

    saveCurrentDraft() {
        const title = document.getElementById('article-title-input')?.value.trim();
        const category = document.getElementById('article-category-input')?.value.trim();
        const read_time = document.getElementById('article-read-time-input')?.value.trim();
        const summary = document.getElementById('article-summary-input')?.value.trim();
        const suggest_text = document.getElementById('article-suggest-text-input')?.value.trim();
        const is_published = document.getElementById('article-published-input')?.checked;
        const cover_url = this.coverImageUrl;

        if (title || summary || suggest_text || cover_url) {
            saveArticleDraft({ title, category, read_time, summary, suggest_text, is_published, cover_url });
        }
    }

    restoreDraftIfAvailable() {
        const draft = getArticleDraft();
        if (!draft) return;

        const titleEl = document.getElementById('article-title-input');
        const categoryEl = document.getElementById('article-category-input');
        const catSelectedText = document.getElementById('modal-category-selected-text');
        const readTimeEl = document.getElementById('article-read-time-input');
        const summaryEl = document.getElementById('article-summary-input');
        const suggestEl = document.getElementById('article-suggest-text-input');
        const publishedEl = document.getElementById('article-published-input');
        const coverUrlEl = document.getElementById('article-cover-url-input');

        if (titleEl && draft.title) titleEl.value = draft.title;
        if (categoryEl && draft.category) {
            categoryEl.value = draft.category;
            if (catSelectedText) catSelectedText.textContent = draft.category;
        }
        if (readTimeEl && draft.read_time) readTimeEl.value = draft.read_time;
        if (summaryEl && draft.summary) summaryEl.value = draft.summary;
        if (suggestEl && draft.suggest_text) suggestEl.value = draft.suggest_text;
        if (publishedEl && draft.is_published !== undefined) publishedEl.checked = draft.is_published;
        if (draft.cover_url) {
            this.coverImageUrl = draft.cover_url;
            if (coverUrlEl) coverUrlEl.value = draft.cover_url;
            const coverContainer = document.getElementById('cover-preview-container');
            const coverImg = document.getElementById('cover-preview-img');
            if (coverContainer && coverImg) {
                coverImg.src = draft.cover_url;
                coverContainer.classList.remove('hidden');
            }
        }
    }

    initTagPlaceholders() {
        const tagButtons = document.querySelectorAll('.btn-tag-placeholder');
        const suggestTextarea = document.getElementById('article-suggest-text-input');

        tagButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tag = btn.getAttribute('data-tag');
                if (!suggestTextarea || !tag) return;

                const start = suggestTextarea.selectionStart;
                const end = suggestTextarea.selectionEnd;
                const text = suggestTextarea.value;

                // Guarantee spacing around tag so tags never stick side-by-side
                const prevChar = start > 0 ? text[start - 1] : '';
                const nextChar = end < text.length ? text[end] : '';

                const leadSpace = (start > 0 && !/\s/.test(prevChar)) ? ' ' : '';
                const trailSpace = (!/\s/.test(nextChar)) ? ' ' : '';
                const tagToInsert = `${leadSpace}${tag}${trailSpace}`;

                suggestTextarea.value = text.substring(0, start) + tagToInsert + text.substring(end);
                suggestTextarea.focus();
                const newPos = start + tagToInsert.length;
                suggestTextarea.selectionStart = newPos;
                suggestTextarea.selectionEnd = newPos;
                this.saveCurrentDraft();
            });
        });
    }

    initPreviewModal() {
        const previewModalEl = document.getElementById('previewArticleModal');
        if (previewModalEl) {
            this.previewModalInstance = new Modal(previewModalEl, this.subModalOptions);
            previewModalEl.querySelectorAll('[data-modal-hide="previewArticleModal"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.previewModalInstance.hide();
                });
            });
            previewModalEl.addEventListener('click', (e) => {
                if (e.target === previewModalEl) {
                    this.previewModalInstance.hide();
                }
            });
        }

        const openPreviewBtn = document.getElementById('btn-open-preview-modal');
        if (openPreviewBtn) {
            openPreviewBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.renderLivePreview();
                if (this.previewModalInstance) {
                    this.previewModalInstance.show();
                }
            });
        }
    }

    renderLivePreview() {
        const title = document.getElementById('article-title-input')?.value.trim() || 'Untitled Article';
        const category = document.getElementById('article-category-input')?.value.trim() || 'Tutorial';
        const readTime = document.getElementById('article-read-time-input')?.value.trim() || '5 Minutes read';
        const summary = document.getElementById('article-summary-input')?.value.trim() || '<p class="italic text-gray-400">No article content typed yet.</p>';
        const suggestText = document.getElementById('article-suggest-text-input')?.value.trim() || '';

        const titleEl = document.getElementById('preview-title');
        const badgeEl = document.getElementById('preview-badge-container');
        const readTimeEl = document.getElementById('preview-read-time');
        const bodyEl = document.getElementById('preview-body');
        const coverContainer = document.getElementById('preview-cover-container');
        const coverImg = document.getElementById('preview-cover-img');
        const suggestContainer = document.getElementById('preview-suggest-container');
        const suggestEl = document.getElementById('preview-suggest-text');

        if (titleEl) titleEl.textContent = title;
        if (badgeEl) badgeEl.innerHTML = this.getCategoryBadgeHtml(category);
        if (readTimeEl) readTimeEl.textContent = readTime;
        if (bodyEl) bodyEl.innerHTML = summary;

        // Cover preview
        const activeCoverSrc = document.getElementById('cover-preview-img')?.src || this.coverImageUrl;
        if (activeCoverSrc && coverContainer && coverImg) {
            coverImg.src = activeCoverSrc;
            coverContainer.classList.remove('hidden');
        } else if (coverContainer) {
            coverContainer.classList.add('hidden');
        }

        // Response template preview with replaced placeholders
        if (suggestText && suggestContainer && suggestEl) {
            const sampleUrl = `https://dole.portal/kb/article?id=SAMPLE_101`;
            const formattedSuggest = suggestText
                .replaceAll('{title}', title)
                .replaceAll('{link}', sampleUrl)
                .replaceAll('{read_time}', readTime)
                .replaceAll('{category}', category);

            suggestEl.textContent = formattedSuggest;
            suggestContainer.classList.remove('hidden');
        } else if (suggestContainer) {
            suggestContainer.classList.add('hidden');
        }
    }

    applyToolbarCommand(textarea, cmd) {
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selected = text.substring(start, end);

        let replacement = '';
        if (cmd === 'bold') replacement = `<b>${selected || 'Bold Text'}</b>`;
        else if (cmd === 'italic') replacement = `<i>${selected || 'Italic Text'}</i>`;
        else if (cmd === 'underline') replacement = `<u>${selected || 'Underlined Text'}</u>`;
        else if (cmd === 'strike') replacement = `<s>${selected || 'Strikethrough Text'}</s>`;
        else if (cmd === 'h3') replacement = `\n<h3>${selected || 'Heading Title'}</h3>\n`;
        else if (cmd === 'ul') replacement = `\n<ul>\n  <li>${selected || 'List item'}</li>\n</ul>\n`;

        if (replacement) {
            textarea.value = text.substring(0, start) + replacement + text.substring(end);
            textarea.focus();
            textarea.selectionStart = start + replacement.length;
            textarea.selectionEnd = start + replacement.length;
        }
    }

    initInsertLinkModal() {
        const linkModalEl = document.getElementById('insertLinkModal');
        if (linkModalEl) {
            this.insertLinkModalInstance = new Modal(linkModalEl, this.subModalOptions);

            linkModalEl.querySelectorAll('[data-modal-hide="insertLinkModal"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.insertLinkModalInstance.hide();
                });
            });
            linkModalEl.addEventListener('click', (e) => {
                if (e.target === linkModalEl) {
                    this.insertLinkModalInstance.hide();
                }
            });
        }

        const openLinkBtn = document.getElementById('btn-open-insert-link-modal');
        const summaryTextarea = document.getElementById('article-summary-input');
        const linkTextInput = document.getElementById('modal-link-text-input');
        const linkUrlInput = document.getElementById('modal-link-url-input');

        if (openLinkBtn) {
            openLinkBtn.classList.add('cursor-pointer');
            openLinkBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (summaryTextarea && linkTextInput) {
                    const start = summaryTextarea.selectionStart;
                    const end = summaryTextarea.selectionEnd;
                    const selected = summaryTextarea.value.substring(start, end).trim();
                    linkTextInput.value = selected;
                }
                if (linkUrlInput && !linkUrlInput.value) {
                    linkUrlInput.value = 'https://';
                }
                if (this.insertLinkModalInstance) {
                    this.insertLinkModalInstance.show();
                }
            });
        }

        const confirmLinkBtn = document.getElementById('btn-confirm-insert-link');
        if (confirmLinkBtn) {
            confirmLinkBtn.classList.add('cursor-pointer');
            confirmLinkBtn.addEventListener('click', () => {
                const text = linkTextInput?.value.trim() || 'link text';
                const url = linkUrlInput?.value.trim();
                if (!url || url === 'https://') {
                    if (window.Swal) {
                        window.Swal.fire({ icon: 'warning', title: 'Missing URL', text: 'Please enter a valid destination link URL.' });
                    } else {
                        alert('Please enter a valid destination link URL.');
                    }
                    return;
                }

                const linkHtml = `<a href="${url}" class="text-blue-600 underline font-semibold" target="_blank">${this.escapeHtml(text)}</a>`;

                if (summaryTextarea) {
                    const start = summaryTextarea.selectionStart;
                    const end = summaryTextarea.selectionEnd;
                    const val = summaryTextarea.value;
                    summaryTextarea.value = val.substring(0, start) + linkHtml + val.substring(end);
                    summaryTextarea.focus();
                }

                if (this.insertLinkModalInstance) {
                    this.insertLinkModalInstance.hide();
                }
            });
        }
    }

    initInsertImageModal() {
        const imageModalEl = document.getElementById('insertImageModal');
        if (imageModalEl) {
            this.insertImageModalInstance = new Modal(imageModalEl, this.subModalOptions);

            // Bind manual close buttons
            imageModalEl.querySelectorAll('[data-modal-hide="insertImageModal"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.insertImageModalInstance.hide();
                });
            });
            imageModalEl.addEventListener('click', (e) => {
                if (e.target === imageModalEl) {
                    this.insertImageModalInstance.hide();
                }
            });
        }

        // Bind manual open trigger
        const openInsertBtn = document.getElementById('btn-open-insert-image-modal');
        if (openInsertBtn) {
            openInsertBtn.classList.add('cursor-pointer');
            openInsertBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.insertImageModalInstance) {
                    this.insertImageModalInstance.show();
                }
            });
        }

        const confirmBtn = document.getElementById('btn-confirm-insert-image');
        if (confirmBtn) {
            confirmBtn.classList.add('cursor-pointer');
            confirmBtn.addEventListener('click', () => {
                this.handleInsertImage();
            });
        }
    }

    handleInsertImage() {
        const fileInput = document.getElementById('modal-image-file-input');
        const urlInput = document.getElementById('modal-image-url-input');
        const altInput = document.getElementById('modal-image-alt-input');
        const summaryTextarea = document.getElementById('article-summary-input');

        const file = fileInput?.files?.[0];
        const directUrl = urlInput?.value.trim();
        const altText = altInput?.value.trim() || 'Article image';

        let imgHtml = '';

        if (file) {
            // Stage image file for local preview; upload will defer to Save Article
            const blobUrl = URL.createObjectURL(file);
            const stagedId = `staged_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            this.stagedImages.set(stagedId, file);

            imgHtml = `\n<img src="${blobUrl}" data-staged-id="${stagedId}" alt="${this.escapeHtml(altText)}" class="w-full rounded-lg shadow-md my-4 max-h-80 object-cover" />\n`;
        } else if (directUrl) {
            imgHtml = `\n<img src="${directUrl}" alt="${this.escapeHtml(altText)}" class="w-full rounded-lg shadow-md my-4 max-h-80 object-cover" />\n`;
        } else {
            if (window.Swal) {
                window.Swal.fire({ icon: 'warning', title: 'No Image Chosen', text: 'Please select an image file to upload or enter a direct image URL.' });
            } else {
                alert('Please select an image file to upload or enter a direct image URL.');
            }
            return;
        }

        if (summaryTextarea) {
            const start = summaryTextarea.selectionStart;
            const end = summaryTextarea.selectionEnd;
            const val = summaryTextarea.value;
            summaryTextarea.value = val.substring(0, start) + imgHtml + val.substring(end);
            summaryTextarea.focus();
        }

        // Reset fields and close Flowbite modal
        if (fileInput) fileInput.value = '';
        if (urlInput) urlInput.value = '';
        if (altInput) altInput.value = '';

        if (this.insertImageModalInstance) {
            this.insertImageModalInstance.hide();
        }
    }

    async handleCreateArticle(formEl) {
        const submitBtn = document.getElementById('btn-submit-article');
        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Save Article';

        const title = document.getElementById('article-title-input')?.value.trim();
        const category = document.getElementById('article-category-input')?.value.trim() || 'Tutorial';
        const readTime = document.getElementById('article-read-time-input')?.value.trim() || '5 Minutes read';
        let summary = document.getElementById('article-summary-input')?.value.trim();
        const suggestText = document.getElementById('article-suggest-text-input')?.value.trim() || null;
        const isPublished = document.getElementById('article-published-input')?.checked ?? true;

        if (!title || !summary) {
            if (window.Swal) {
                window.Swal.fire({
                    icon: 'warning',
                    title: 'Missing Fields',
                    text: 'Please fill in both the article title and content.'
                });
            }
            return;
        }

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading & Saving...
                `;
            }

            // Upload Cover File if selected & staged
            if (this.stagedCoverFile) {
                const { url: uploadedCoverUrl, error: coverErr } = await uploadArticleImage(this.stagedCoverFile);
                if (!coverErr && uploadedCoverUrl) {
                    this.coverImageUrl = uploadedCoverUrl;
                }
            }

            // Upload all staged embedded body images to Supabase Storage
            if (this.stagedImages.size > 0) {
                for (const [stagedId, file] of this.stagedImages.entries()) {
                    const { url: uploadedUrl, error: uploadErr } = await uploadArticleImage(file);
                    if (!uploadErr && uploadedUrl) {
                        const regex = new RegExp(`<img [^>]*data-staged-id="${stagedId}"[^>]*>`, 'gi');
                        summary = summary.replace(regex, (match) => {
                            return match
                                .replace(/src="blob:[^"]+"/, `src="${uploadedUrl}"`)
                                .replace(`data-staged-id="${stagedId}"`, '');
                        });
                    }
                }
            }

            // Prepend Cover Image Tag if cover image is provided
            if (this.coverImageUrl) {
                summary = `<img src="${this.coverImageUrl}" alt="${this.escapeHtml(title)} Cover" class="w-full h-48 object-cover rounded-t-lg mb-4" />\n` + summary;
            }

            const payload = {
                title,
                category,
                read_time: readTime,
                summary,
                suggest_text: suggestText,
                is_published: isPublished
            };

            const { data, error } = await createArticle(payload);

            if (error) {
                if (window.Swal) {
                    window.Swal.fire({
                        icon: 'error',
                        title: 'Error Creating Article',
                        text: error
                    });
                }
                return;
            }

            // Reset Form and Dropdown state
            formEl.reset();
            clearArticleDraft();
            this.coverImageUrl = '';
            this.stagedCoverFile = null;
            this.stagedImages.clear();
            const coverContainer = document.getElementById('cover-preview-container');
            if (coverContainer) coverContainer.classList.add('hidden');
            
            const catInput = document.getElementById('article-category-input');
            const catSelectedText = document.getElementById('modal-category-selected-text');
            if (catInput) catInput.value = 'Tutorial';
            if (catSelectedText) catSelectedText.textContent = 'Tutorial';

            // Close Modal
            if (this.createModalInstance) {
                this.createModalInstance.hide();
            }

            // Success Alert
            if (window.Swal) {
                window.Swal.fire({
                    icon: 'success',
                    title: 'Article Created!',
                    text: `"${title}" has been published to the knowledge base.`,
                    timer: 2000,
                    showConfirmButton: false
                });
            }

            // Reload articles list
            await this.loadArticles();

        } catch (err) {
            if (window.Swal) {
                window.Swal.fire({
                    icon: 'error',
                    title: 'Unexpected Error',
                    text: err.message || 'Failed to create article.'
                });
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        }
    }

    async loadArticles() {
        this.renderSkeleton();
        const { data, error } = await fetchArticles();

        if (error) {
            this.renderError('Unable to load articles from the database.');
            return;
        }

        this.articles = data || [];
        this.render();
    }

    initEvents() {
        // Find dropdown filter links
        const dropdownLinks = document.querySelectorAll('#dropdownCategory ul li a');
        dropdownLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active styling from all links
                dropdownLinks.forEach(l => {
                    l.classList.remove('font-bold', 'text-blue-600', 'dark:text-blue-500', 'bg-gray-50', 'dark:bg-gray-800/55');
                });

                // Add active styling to clicked link
                link.classList.add('font-bold', 'text-blue-600', 'dark:text-blue-500', 'bg-gray-50', 'dark:bg-gray-800/55');

                const category = link.getAttribute('data-category') || 'All';
                this.selectedCategory = category;

                // Update Category Button Text
                const labelText = link.textContent.trim();
                const selectedTextEl = document.getElementById('selected-category-text');
                if (selectedTextEl) {
                    selectedTextEl.textContent = labelText;
                }

                // Close Flowbite Dropdown manually by triggering click on the backdrop or hiding it
                const dropdownMenu = document.getElementById('dropdownCategory');
                if (dropdownMenu) {
                    dropdownMenu.classList.add('hidden');
                }

                if (window.DEBUG) {
                    window.DEBUG.log('ADMIN_ARTICLES', `Category filter changed to: ${category}`);
                }

                this.render();
            });
        });
    }

    escapeHtml(value = '') {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    renderSkeleton() {
        this.gridEl.innerHTML = Array.from({ length: 6 }).map(() => `
            <div role="status" class="p-6 bg-white rounded-lg border border-gray-200 shadow-md dark:bg-gray-800 dark:border-gray-700 animate-pulse">
                <div class="flex justify-between items-center mb-5">
                    <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-24"></div>
                    <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-16"></div>
                </div>
                <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-3/4 mb-4"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-full mb-2.5"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-5/6 mb-5"></div>
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-3">
                        <div class="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-24"></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderError(message) {
        this.gridEl.innerHTML = `
            <div class="col-span-full py-12 px-6 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-center rounded-lg">
                <svg class="mx-auto mb-4 text-red-500 w-12 h-12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <p class="text-sm font-bold text-red-700 dark:text-red-300">${message}</p>
            </div>
        `;
    }

    renderEmpty(message = 'No articles found matching the selected criteria.') {
        this.gridEl.innerHTML = `
            <div class="col-span-full py-12 px-4 flex flex-col items-center justify-center text-center">
                <svg class="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"></path>
                </svg>
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-1">No Articles Found</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 max-w-sm">${message}</p>
            </div>
        `;
    }

    getCategoryBadgeHtml(category) {
        const cat = String(category || '').trim();
        if (cat.toLowerCase() === 'tutorial') {
            return `
                <span class="bg-blue-100 text-blue-800 text-xs font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                    <svg class="mr-1 w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"></path></svg>
                    Tutorial
                </span>
            `;
        } else if (cat.toLowerCase() === 'user guide') {
            return `
                <span class="bg-amber-100 text-amber-800 text-xs font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-amber-900/60 dark:text-amber-400">
                    <svg class="mr-1 w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"></path><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"></path></svg>
                    User Guide
                </span>
            `;
        } else if (cat.toLowerCase() === 'troubleshooting') {
            return `
                <span class="bg-red-100 text-red-800 text-xs font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-red-900/60 dark:text-red-400">
                    <svg class="mr-1 w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    Troubleshooting
                </span>
            `;
        } else {
            return `
                <span class="bg-purple-100 text-purple-800 text-xs font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-purple-900/60 dark:text-purple-400">
                    <svg class="mr-1 w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"></path></svg>
                    ${this.escapeHtml(category)}
                </span>
            `;
        }
    }

    getAuthorInfo(category) {
        const cat = String(category || '').trim().toLowerCase();
        if (cat === 'user guide') {
            return { name: 'Dev Ops Team', avatar: 'https://ui-avatars.com/api/?name=Dev+Ops&background=random' };
        } else if (cat === 'troubleshooting') {
            return { name: 'IT Support', avatar: 'https://ui-avatars.com/api/?name=IT+Support&background=random' };
        } else if (cat === 'tutorial') {
            return { name: 'System Admin', avatar: 'https://ui-avatars.com/api/?name=Admin+Sys&background=random' };
        } else {
            return { name: 'System Admin', avatar: 'https://ui-avatars.com/api/?name=Admin+Sys&background=random' };
        }
    }

    render() {
        this.gridEl.innerHTML = '';

        // Filter articles list
        const filteredArticles = this.selectedCategory === 'All'
            ? this.articles
            : this.articles.filter(art => {
                const artCat = String(art.category || '').toLowerCase().trim();
                const selCat = String(this.selectedCategory || '').toLowerCase().trim();
                return artCat === selCat || `${artCat}s` === selCat || artCat === `${selCat}s`;
            });

        if (filteredArticles.length === 0) {
            this.renderEmpty();
            return;
        }

        filteredArticles.forEach(art => {
            const author = this.getAuthorInfo(art.category);
            const badgeHtml = this.getCategoryBadgeHtml(art.category);
            const articleEl = document.createElement('article');
            const viewUrl = `${this.articlesBasePath}view.html?id=${art.id}`;
            
            // Extract cover image tag if summary starts with an <img> tag
            let summaryContent = art.summary || '';
            let coverBannerHtml = '';
            const imgMatch = summaryContent.match(/^<img [^>]*src=["']([^"']+)["'][^>]*>/i);

            if (imgMatch) {
                const imgUrl = imgMatch[1];
                coverBannerHtml = `
                    <div class="mb-4 rounded-lg overflow-hidden -mx-6 -mt-6">
                        <img src="${imgUrl}" alt="${this.escapeHtml(art.title)}" class="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                `;
                summaryContent = summaryContent.replace(imgMatch[0], '').trim();
            }
            
            articleEl.className = 'p-6 bg-white rounded-lg border border-gray-200 shadow-md dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between';
            articleEl.setAttribute('role', 'button');
            articleEl.setAttribute('tabindex', '0');
            articleEl.setAttribute('aria-label', `Read article: ${art.title}`);
            articleEl.dataset.articleId = art.id;

            // Navigate on click
            articleEl.addEventListener('click', () => {
                window.location.href = viewUrl;
            });
            articleEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    window.location.href = viewUrl;
                }
            });
            
            articleEl.innerHTML = `
                <div>
                    ${coverBannerHtml}
                    <div class="flex justify-between items-center mb-5 text-gray-500 relative z-10">
                        ${badgeHtml}
                        <span class="text-sm">${this.escapeHtml(art.read_time || '5 Minutes read')}</span>
                    </div>
                    <h2 class="mb-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors relative z-10">
                        ${this.escapeHtml(art.title)}
                    </h2>
                    <div class="mb-5 font-light text-sm text-gray-500 dark:text-gray-400 relative z-10 line-clamp-3 overflow-hidden">
                        ${summaryContent}
                    </div>
                </div>
                <div class="flex justify-between items-center relative z-10 pt-4 border-t border-gray-100 dark:border-gray-700/60 mt-auto">
                    <div class="flex items-center space-x-4">
                        <img class="w-7 h-7 rounded-full" src="${author.avatar}" alt="${this.escapeHtml(author.name)} avatar" />
                        <span class="font-medium dark:text-white text-sm">${this.escapeHtml(author.name)}</span>
                    </div>
                    <span class="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Read
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7"/></svg>
                    </span>
                </div>
            `;
            this.gridEl.appendChild(articleEl);
        });
    }
}

// ===========================================================================
// ARTICLE VIEW CONTROLLER — Renders a single article by ?id URL parameter
// ===========================================================================
class ArticlesViewController {
    constructor() {
        this.skeletonEl = document.getElementById('article-view-skeleton');
        this.errorEl = document.getElementById('article-view-error');
        this.bodyEl = document.getElementById('article-view-body');
        if (!this.skeletonEl || !this.errorEl || !this.bodyEl) return;

        this.currentArticle = null;
        this.editModalInstance = null;
        this.editModalBound = false;
        this.editCoverImageUrl = '';
        this.editStagedCoverFile = null;

        if (window.DEBUG) window.DEBUG.log('ARTICLES_VIEW', 'Initializing ArticlesViewController...');
        this.load();
    }

    async load() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');

        if (!id) {
            this.showError('No article ID specified in the URL.');
            return;
        }

        try {
            const { data, error } = await fetchArticleById(id);

            if (error || !data) {
                this.showError(error?.message || 'Article not found.');
                return;
            }

            this.render(data);
        } catch (err) {
            this.showError(err.message || 'Failed to load article.');
        }
    }

    escapeHtml(value = '') {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    getCategoryBadgeHtml(category) {
        const cat = String(category || '').trim();
        if (cat.toLowerCase() === 'tutorial') {
            return `
                <span class="bg-blue-100 text-blue-800 text-xs font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                    <svg class="mr-1 w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"></path></svg>
                    Tutorial
                </span>
            `;
        } else if (cat.toLowerCase() === 'user guide') {
            return `
                <span class="bg-amber-100 text-amber-800 text-xs font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-amber-900/60 dark:text-amber-400">
                    <svg class="mr-1 w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"></path><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z"></path></svg>
                    User Guide
                </span>
            `;
        } else if (cat.toLowerCase() === 'troubleshooting') {
            return `
                <span class="bg-red-100 text-red-800 text-xs font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-red-900/60 dark:text-red-400">
                    <svg class="mr-1 w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    Troubleshooting
                </span>
            `;
        } else {
            return `
                <span class="bg-purple-100 text-purple-800 text-xs font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-purple-900/60 dark:text-purple-400">
                    <svg class="mr-1 w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"></path></svg>
                    ${this.escapeHtml(category)}
                </span>
            `;
        }
    }

    getAuthorInfo(category) {
        const cat = String(category || '').trim().toLowerCase();
        if (cat === 'user guide') {
            return { name: 'Dev Ops Team', avatar: 'https://ui-avatars.com/api/?name=Dev+Ops&background=random' };
        } else if (cat === 'troubleshooting') {
            return { name: 'IT Support', avatar: 'https://ui-avatars.com/api/?name=IT+Support&background=random' };
        } else if (cat === 'tutorial') {
            return { name: 'System Admin', avatar: 'https://ui-avatars.com/api/?name=Admin+Sys&background=random' };
        } else {
            return { name: 'System Admin', avatar: 'https://ui-avatars.com/api/?name=Admin+Sys&background=random' };
        }
    }

    render(art) {
        // Update page title
        document.title = `${art.title} — DOLE Portal`;

        // Update breadcrumb
        const breadcrumb = document.getElementById('breadcrumb-article-title');
        if (breadcrumb) breadcrumb.textContent = art.title;

        const author = this.getAuthorInfo(art.category);

        // Badge
        const badgeEl = document.getElementById('view-badge-container');
        if (badgeEl) badgeEl.innerHTML = this.getCategoryBadgeHtml(art.category);

        // Read time
        const readTimeEl = document.getElementById('view-read-time');
        if (readTimeEl) readTimeEl.textContent = art.read_time || '5 Minutes read';

        // Cover image - strip first valid <img> from summary if it exists
        const { coverUrl, body: summaryContent } = this.extractArticleCover(art.summary || '');
        const coverContainer = document.getElementById('view-cover-container');
        const coverImg = document.getElementById('view-cover-img');
        if (coverUrl && coverContainer && coverImg) {
            coverImg.src = coverUrl;
            coverImg.alt = art.title;
            coverContainer.classList.remove('hidden');
        } else if (coverContainer) {
            coverContainer.classList.add('hidden');
            if (coverImg) coverImg.src = '';
        }

        // Title
        const titleEl = document.getElementById('view-title');
        if (titleEl) titleEl.textContent = art.title;

        // Author avatar + name
        const avatarEl = document.getElementById('view-author-avatar');
        if (avatarEl) { avatarEl.src = author.avatar; avatarEl.alt = author.name; }
        const nameEl = document.getElementById('view-author-name');
        if (nameEl) nameEl.textContent = author.name;

        // Date
        const dateEl = document.getElementById('view-date');
        if (dateEl && art.created_at) {
            const d = new Date(art.created_at);
            dateEl.textContent = d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
            dateEl.setAttribute('datetime', d.toISOString());
        }

        // Body content
        const contentEl = document.getElementById('view-content');
        if (contentEl) contentEl.innerHTML = summaryContent;

        // Suggest / Response template
        const suggestContainer = document.getElementById('view-suggest-container');
        const suggestEl = document.getElementById('view-suggest-text');
        if (art.suggest_text && suggestContainer && suggestEl) {
            suggestEl.textContent = art.suggest_text;
            suggestContainer.classList.remove('hidden');
        } else if (suggestContainer) {
            suggestContainer.classList.add('hidden');
        }

        // Show article, hide skeleton
        if (this.skeletonEl) this.skeletonEl.classList.add('hidden');
        this.bodyEl.classList.remove('hidden');

        // Store current article data for edit modal
        this.currentArticle = art;

        // Initialize edit modal if present (admin only)
        this.initEditModal(art);

        if (window.DEBUG) window.DEBUG.success('ARTICLES_VIEW', `Article loaded: "${art.title}"`);
    }

    // -----------------------------------------------------------------------
    // EDIT ARTICLE MODAL — only available on admin view.html
    // -----------------------------------------------------------------------
    getStoragePublicUrl(path) {
        const { data } = supabase.storage
            .from(ARTICLE_STORAGE_BUCKET)
            .getPublicUrl(path);
        return data?.publicUrl || '';
    }

    resolveArticleImageSrc(src) {
        const value = String(src || '').trim();
        if (!value) return '';
        if (/^(https?:|data:|blob:|\/)/i.test(value)) return value;
        if (value.startsWith('articles/')) return this.getStoragePublicUrl(value);
        if (/^[\w.-]+\.(png|jpe?g|gif|webp|svg)$/i.test(value)) return this.getStoragePublicUrl(`articles/${value}`);
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
            if (window.DEBUG) window.DEBUG.log('ARTICLES_VIEW', `Removed unresolved article image id: ${value}`);
            return '';
        }
        return '';
    }

    normalizeArticleImageSources(html = '') {
        return String(html || '').replace(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, (tag, src) => {
            const resolvedSrc = this.resolveArticleImageSrc(src);
            if (!resolvedSrc) return '';
            return tag.replace(src, resolvedSrc);
        });
    }

    extractArticleCover(summary = '') {
        const normalizedSummary = this.normalizeArticleImageSources(summary);
        const imgMatch = normalizedSummary.match(/^<img [^>]*src=["']([^"']+)["'][^>]*>/i);
        if (!imgMatch) return { coverUrl: '', body: normalizedSummary };
        return {
            coverUrl: imgMatch[1],
            body: normalizedSummary.replace(imgMatch[0], '').trim()
        };
    }

    setEditCoverPreview(src = '') {
        const coverContainer = document.getElementById('edit-cover-preview-container');
        const coverImg = document.getElementById('edit-cover-preview-img');
        if (src && coverContainer && coverImg) {
            coverImg.src = src;
            coverContainer.classList.remove('hidden');
        } else {
            if (coverContainer) coverContainer.classList.add('hidden');
            if (coverImg) coverImg.src = '';
        }
    }

    setEditCategory(value = 'Tutorial') {
        const category = value || 'Tutorial';
        const categoryInput = document.getElementById('edit-article-category-input');
        const selectedText = document.getElementById('edit-modal-category-selected-text');
        const options = document.querySelectorAll('.edit-modal-category-option');

        if (categoryInput) categoryInput.value = category;
        if (selectedText) selectedText.textContent = category;
        options.forEach((option) => {
            const isActive = option.getAttribute('data-value') === category;
            option.classList.toggle('font-semibold', isActive);
            option.classList.toggle('bg-blue-50', isActive);
            option.classList.toggle('dark:bg-blue-900/30', isActive);
            option.classList.toggle('font-medium', !isActive);
        });
    }

    initEditCategoryDropdown() {
        const catBtn = document.getElementById('edit-modal-category-dropdown-btn');
        const catList = document.getElementById('edit-modal-category-dropdown-list');
        const catSearch = document.getElementById('edit-modal-category-search-input');
        const catOptions = document.querySelectorAll('.edit-modal-category-option');
        if (!catBtn || !catList || catBtn.dataset.bound === 'true') return;

        catBtn.dataset.bound = 'true';
        catBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            catList.classList.toggle('hidden');
            if (!catList.classList.contains('hidden') && catSearch) {
                catSearch.value = '';
                catOptions.forEach(opt => opt.classList.remove('hidden'));
                catSearch.focus();
            }
        });

        if (catSearch) {
            catSearch.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                catOptions.forEach((opt) => {
                    const val = opt.getAttribute('data-value').toLowerCase();
                    opt.classList.toggle('hidden', !val.includes(query));
                });
            });
        }

        catOptions.forEach((opt) => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setEditCategory(opt.getAttribute('data-value'));
                catList.classList.add('hidden');
            });
        });

        document.addEventListener('click', (e) => {
            if (!catList.contains(e.target) && !catBtn.contains(e.target)) {
                catList.classList.add('hidden');
            }
        });
    }

    initEditCoverControls() {
        const coverFileInput = document.getElementById('edit-article-cover-file-input');
        const coverUrlInput = document.getElementById('edit-article-cover-url-input');
        const removeCoverBtn = document.getElementById('btn-remove-edit-cover');

        if (coverUrlInput && coverUrlInput.dataset.bound !== 'true') {
            coverUrlInput.dataset.bound = 'true';
            coverUrlInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                this.editStagedCoverFile = null;
                this.editCoverImageUrl = val;
                this.setEditCoverPreview(val);
            });
        }

        if (coverFileInput && coverFileInput.dataset.bound !== 'true') {
            coverFileInput.dataset.bound = 'true';
            coverFileInput.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                this.editStagedCoverFile = file;
                this.editCoverImageUrl = '';
                if (coverUrlInput) coverUrlInput.value = '';
                this.setEditCoverPreview(URL.createObjectURL(file));
            });
        }

        if (removeCoverBtn && removeCoverBtn.dataset.bound !== 'true') {
            removeCoverBtn.dataset.bound = 'true';
            removeCoverBtn.addEventListener('click', () => {
                this.editCoverImageUrl = '';
                this.editStagedCoverFile = null;
                if (coverFileInput) coverFileInput.value = '';
                if (coverUrlInput) coverUrlInput.value = '';
                this.setEditCoverPreview('');
            });
        }
    }

    applyToolbarCommand(textarea, cmd) {
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selected = text.substring(start, end);

        let replacement = '';
        if (cmd === 'bold') replacement = `<b>${selected || 'Bold Text'}</b>`;
        else if (cmd === 'italic') replacement = `<i>${selected || 'Italic Text'}</i>`;
        else if (cmd === 'underline') replacement = `<u>${selected || 'Underlined Text'}</u>`;
        else if (cmd === 'strike') replacement = `<s>${selected || 'Strikethrough Text'}</s>`;
        else if (cmd === 'h3') replacement = `\n<h3>${selected || 'Heading Title'}</h3>\n`;
        else if (cmd === 'ul') replacement = `\n<ul>\n  <li>${selected || 'List item'}</li>\n</ul>\n`;

        if (replacement) {
            textarea.value = text.substring(0, start) + replacement + text.substring(end);
            textarea.focus();
            textarea.selectionStart = start + replacement.length;
            textarea.selectionEnd = start + replacement.length;
        }
    }

    initEditToolbar() {
        const summaryTextarea = document.getElementById('edit-article-summary-input');
        const toolbarButtons = document.querySelectorAll('[data-edit-cmd]');
        toolbarButtons.forEach((btn) => {
            if (btn.dataset.bound === 'true') return;
            btn.dataset.bound = 'true';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.applyToolbarCommand(summaryTextarea, btn.getAttribute('data-edit-cmd'));
            });
        });
    }

    initEditTagPlaceholders() {
        const tagButtons = document.querySelectorAll('.edit-btn-tag-placeholder');
        const suggestTextarea = document.getElementById('edit-article-suggest-text-input');
        tagButtons.forEach((btn) => {
            if (btn.dataset.bound === 'true') return;
            btn.dataset.bound = 'true';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tag = btn.getAttribute('data-tag');
                if (!suggestTextarea || !tag) return;

                const start = suggestTextarea.selectionStart;
                const end = suggestTextarea.selectionEnd;
                const text = suggestTextarea.value;
                const prevChar = start > 0 ? text[start - 1] : '';
                const nextChar = end < text.length ? text[end] : '';
                const leadSpace = (start > 0 && !/\s/.test(prevChar)) ? ' ' : '';
                const trailSpace = (!/\s/.test(nextChar)) ? ' ' : '';
                const tagToInsert = `${leadSpace}${tag}${trailSpace}`;

                suggestTextarea.value = text.substring(0, start) + tagToInsert + text.substring(end);
                suggestTextarea.focus();
                const newPos = start + tagToInsert.length;
                suggestTextarea.selectionStart = newPos;
                suggestTextarea.selectionEnd = newPos;
            });
        });
    }

    populateEditForm(art) {
        const titleInput = document.getElementById('edit-article-title-input');
        const readTimeInput = document.getElementById('edit-article-read-time-input');
        const summaryInput = document.getElementById('edit-article-summary-input');
        const suggestInput = document.getElementById('edit-article-suggest-text-input');
        const publishedInput = document.getElementById('edit-article-published-input');
        const coverUrlInput = document.getElementById('edit-article-cover-url-input');
        const coverFileInput = document.getElementById('edit-article-cover-file-input');
        const { coverUrl, body } = this.extractArticleCover(art.summary || '');

        this.editStagedCoverFile = null;
        this.editCoverImageUrl = coverUrl;
        if (titleInput) titleInput.value = art.title || '';
        this.setEditCategory(art.category || 'Tutorial');
        if (readTimeInput) readTimeInput.value = art.read_time || '5 Minutes read';
        if (summaryInput) summaryInput.value = body || '';
        if (suggestInput) suggestInput.value = art.suggest_text || '';
        if (publishedInput) publishedInput.checked = art.is_published !== false;
        if (coverUrlInput) coverUrlInput.value = coverUrl || '';
        if (coverFileInput) coverFileInput.value = '';
        this.setEditCoverPreview(coverUrl);
    }

    initEditModal(art) {
        const editModalEl = document.getElementById('editArticleModal');
        const editBtn = document.getElementById('btn-edit-article');
        if (!editModalEl || !editBtn) return;

        if (!this.editModalInstance) {
            this.editModalInstance = new Modal(editModalEl, {
                backdropClasses: 'bg-gray-900/40 dark:bg-gray-950/60 fixed inset-0 z-40 backdrop-blur-sm',
                closable: true
            });
        }

        this.initEditCategoryDropdown();
        this.initEditCoverControls();
        this.initEditToolbar();
        this.initEditTagPlaceholders();
        this.populateEditForm(art);

        if (editBtn.dataset.bound !== 'true') {
            editBtn.dataset.bound = 'true';
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.currentArticle) this.populateEditForm(this.currentArticle);
                this.editModalInstance.show();
            });
        }

        if (editModalEl.dataset.editCloseDelegated !== 'true') {
            editModalEl.dataset.editCloseDelegated = 'true';
            editModalEl.addEventListener('click', (e) => {
                const closeTrigger = e.target.closest('[data-modal-hide="editArticleModal"]');
                if (!closeTrigger) return;
                e.preventDefault();
                e.stopPropagation();
                if (window.DEBUG) window.DEBUG.event('ARTICLES_VIEW', 'Closing edit article modal', { trigger: closeTrigger.textContent?.trim() || closeTrigger.getAttribute('aria-label') || 'close' });
                this.editModalInstance?.hide();
            });
        }

        const editForm = document.getElementById('edit-article-form');
        if (editForm && editForm.dataset.bound !== 'true') {
            editForm.dataset.bound = 'true';
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleEditSubmit(this.currentArticle?.id || art.id);
            });
        }
    }

    async handleEditSubmit(articleId) {
        const submitBtn = document.getElementById('btn-submit-edit-article');
        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Update Article';

        const title = document.getElementById('edit-article-title-input')?.value.trim();
        const category = document.getElementById('edit-article-category-input')?.value.trim() || 'Tutorial';
        const readTime = document.getElementById('edit-article-read-time-input')?.value.trim() || '5 Minutes read';
        let summary = document.getElementById('edit-article-summary-input')?.value.trim();
        const suggestText = document.getElementById('edit-article-suggest-text-input')?.value.trim() || null;
        const isPublished = document.getElementById('edit-article-published-input')?.checked ?? true;

        if (!title || !summary) {
            if (window.Swal) {
                window.Swal.fire({ icon: 'warning', title: 'Missing Fields', text: 'Please fill in both the article title and content.' });
            } else if (window.DEBUG) {
                window.DEBUG.error('ARTICLES_VIEW', 'Title and article content are required');
            }
            return;
        }

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-70', 'pointer-events-none');
                submitBtn.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading & Saving...
                `;
            }

            if (this.editStagedCoverFile) {
                const { url: uploadedCoverUrl, error: coverErr } = await uploadArticleImage(this.editStagedCoverFile);
                if (!coverErr && uploadedCoverUrl) {
                    this.editCoverImageUrl = uploadedCoverUrl;
                }
            }

            summary = this.normalizeArticleImageSources(summary);
            if (this.editCoverImageUrl) {
                summary = `<img src="${this.editCoverImageUrl}" alt="${this.escapeHtml(title)} Cover" class="w-full h-48 object-cover rounded-t-lg mb-4" />\n` + summary;
            }

            const payload = {
                title,
                category,
                read_time: readTime,
                summary,
                suggest_text: suggestText,
                is_published: isPublished
            };

            const { data, error } = await updateArticle(articleId, payload);

            if (error) {
                if (window.Swal) {
                    window.Swal.fire({ icon: 'error', title: 'Error Updating Article', text: error });
                }
                if (window.DEBUG) window.DEBUG.error('ARTICLES_VIEW', `Update failed: ${error}`);
                return;
            }

            const { data: refreshedArticle, error: refreshError } = await fetchArticleById(articleId);
            if (refreshError || !refreshedArticle) {
                const message = refreshError || 'Article updated but the refreshed database row was not returned.';
                if (window.DEBUG) window.DEBUG.error('ARTICLES_VIEW', `Refresh after update failed: ${message}`);
                window.location.reload();
                return;
            }

            const updatedArticle = refreshedArticle;
            if (window.DEBUG) window.DEBUG.success('ARTICLES_VIEW', `Article #${articleId} updated and refreshed from Supabase`, updatedArticle);

            this.editStagedCoverFile = null;
            if (this.editModalInstance) this.editModalInstance.hide();
            this.render(updatedArticle);

        } catch (err) {
            if (window.DEBUG) window.DEBUG.error('ARTICLES_VIEW', `Update error: ${err.message}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-70', 'pointer-events-none');
                submitBtn.innerHTML = originalBtnHtml;
            }
        }
    }
    showError(message) {
        if (this.skeletonEl) this.skeletonEl.classList.add('hidden');
        if (this.errorEl) {
            const msgEl = document.getElementById('article-view-error-msg');
            if (msgEl) msgEl.textContent = message;
            this.errorEl.classList.remove('hidden');
        }
        if (window.DEBUG) window.DEBUG.error('ARTICLES_VIEW', message);
    }
}

// Bootstrap initialization on DOM ready
const boot = () => {
    // View page — has article-view-skeleton in DOM
    if (document.getElementById('article-view-skeleton')) {
        new ArticlesViewController();
        return;
    }
    // Browse/list page — has articles-grid in DOM
    if (document.getElementById('articles-grid')) {
        new ArticlesBrowseController();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}

export { ArticlesBrowseController, ArticlesViewController };
export default ArticlesBrowseController;

