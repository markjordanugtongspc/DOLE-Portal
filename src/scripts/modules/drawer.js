/* START AUTH DRAWER FUNCTIONALITY */
const initDrawer = () => {
    if (window.DEBUG) {
        window.DEBUG.log('DRAWER', 'Initializing manual mobile login drawer...');
    }

    const drawerEl = document.getElementById('login-drawer');
    const backdropEl = document.getElementById('drawer-backdrop');
    const heroEl = document.getElementById('mobile-hero-content');
    const drawerHeroEl = document.getElementById('mobile-drawer-hero-text');
    const showBtn = document.getElementById('show-login-drawer');
    const hideBtn = document.getElementById('hide-login-drawer');

    if (window.DEBUG) {
        window.DEBUG.log('DRAWER', 'DOM elements parsed status:', {
            drawerExists: !!drawerEl,
            backdropExists: !!backdropEl,
            heroExists: !!heroEl,
            drawerHeroExists: !!drawerHeroEl,
            showBtnExists: !!showBtn,
            hideBtnExists: !!hideBtn
        });
    }

    const showDrawer = () => {
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Action: Opening drawer...');
        if (drawerEl) {
            drawerEl.classList.remove('translate-y-full');
            drawerEl.classList.add('translate-y-0');
        }
        if (backdropEl) {
            backdropEl.classList.remove('hidden');
        }
        if (heroEl) {
            heroEl.classList.add('hidden');
        }
        if (drawerHeroEl) {
            drawerHeroEl.classList.remove('hidden');
        }
        if (window.DEBUG) window.DEBUG.success('DRAWER', 'Drawer opened.');
    };

    const hideDrawer = () => {
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Action: Closing drawer...');
        if (drawerEl) {
            drawerEl.classList.remove('translate-y-0');
            drawerEl.classList.add('translate-y-full');
        }
        if (backdropEl) {
            backdropEl.classList.add('hidden');
        }
        if (heroEl) {
            heroEl.classList.remove('hidden');
        }
        if (drawerHeroEl) {
            drawerHeroEl.classList.add('hidden');
        }
        if (window.DEBUG) window.DEBUG.success('DRAWER', 'Drawer closed.');
    };

    if (showBtn) {
        showBtn.addEventListener('click', showDrawer);
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Trigger click event bound to Get Started.');
    }
    if (hideBtn) {
        hideBtn.addEventListener('click', hideDrawer);
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Trigger click event bound to Close Button.');
    }
    if (backdropEl) {
        backdropEl.addEventListener('click', hideDrawer);
        if (window.DEBUG) window.DEBUG.log('DRAWER', 'Trigger click event bound to Backdrop.');
    }
};

// Robust readyState check to avoid DOMContentLoaded race conditions in ES modules
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDrawer);
} else {
    initDrawer();
}
/* END AUTH DRAWER FUNCTIONALITY */

/* START MANAGE SYSTEMS DRAWER FUNCTIONALITY */
const initSystemsManager = () => {
    const gridEl = document.getElementById('systems-grid');
    if (!gridEl) return;

    if (window.DEBUG) {
        window.DEBUG.log('SYSTEMS', 'Initializing systems manager...');
    }

    const formEl = document.getElementById('system-form');
    const nameInput = document.getElementById('system-name');
    const descInput = document.getElementById('system-desc');
    const urlInput = document.getElementById('system-url');
    const idInput = document.getElementById('system-id');
    const drawerTitle = document.getElementById('drawer-title-mode');
    const submitBtnText = document.getElementById('btn-submit-text');
    const addBtn = document.getElementById('btn-add-system');
    const closeBtn = document.getElementById('close-drawer-btn');
    const colorInput = document.getElementById('system-color');
    const imageInput = document.getElementById('system-image');
    const dropzoneContent = document.getElementById('dropzone-content');
    const imagePreview = document.getElementById('system-image-preview');
    const imageChangeOverlay = document.getElementById('image-change-overlay');
    const imageErrorMsg = document.getElementById('image-error-msg');
    // Default systems data
    const defaultSystems = [
        {
            id: 'sys-1',
            name: 'GIP Monitoring System',
            desc: 'Government Internship Program monitoring portal for tracking student interns across all regional offices.',
            url: 'https://gip.dole.gov.ph',
            color: '#10b981', // Emerald
            image: '/src/assets/images/slider/sl1.jpg'
        },
        {
            id: 'sys-2',
            name: 'SPES Monitoring System',
            desc: 'Special Program for Employment of Students system for managing beneficiary records and work assignments.',
            url: 'https://spes.dole.gov.ph',
            color: '#3b82f6', // Blue
            image: '/src/assets/images/slider/sl3.jpg'
        },
        {
            id: 'sys-3',
            name: 'TUPAD System',
            desc: 'Tulong Panghanapbuhay sa Ating Displaced/Disadvantaged Workers — assistance distribution tracking system.',
            url: '#',
            color: '#ef4444', // Red
            image: '/src/assets/images/slider/sl5.jpg'
        }
    ];

    // Load from localStorage or use defaults; reset if stale old defaults detected
    let systems = JSON.parse(localStorage.getItem('dole_systems'));
    const staleNames = ['DOLE System Alpha', 'Online Ticket Desk', 'Livelihood Assistance System', 'Employment Hub'];
    const isStale = !systems || systems.length === 0 || systems.some(s => staleNames.includes(s.name));
    if (isStale) {
        systems = defaultSystems;
        localStorage.setItem('dole_systems', JSON.stringify(systems));
    }

    // Handle Image Upload Preview
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            if (imageErrorMsg) imageErrorMsg.classList.add('hidden');
            const file = e.target.files[0];
            if (file) {
                // Validate type and size (Max 3MB)
                const isImage = file.type.startsWith('image/png') || file.type.startsWith('image/jpeg') || file.name.toLowerCase().match(/\.(png|jpg|jpeg)$/);
                if (!isImage || file.size > 3 * 1024 * 1024) {
                    if (imageErrorMsg) imageErrorMsg.classList.remove('hidden');
                    imageInput.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                    imagePreview.classList.remove('hidden');
                    if (dropzoneContent) dropzoneContent.classList.add('hidden');
                    if (imageChangeOverlay) imageChangeOverlay.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Function to render the systems grid
    const renderSystems = () => {
        if (systems.length === 0) {
            gridEl.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-sm font-semibold text-gray-500 dark:text-gray-400">No systems registered yet. Click "Add System" to create one.</p>
                </div>
            `;
            return;
        }

        gridEl.innerHTML = '';
        systems.forEach(sys => {
            const card = document.createElement('div');
            const sysColor = sys.color || '#3b82f6';
            card.className = 'system-card cursor-pointer border border-transparent flex flex-col justify-between hover:scale-[1.01] hover:shadow-[0_0_15px_var(--glow-color)] transition-all duration-300 relative group min-h-[320px] rounded-base overflow-hidden text-white';
            card.style.setProperty('--sys-color', sysColor);
            card.setAttribute('data-url', sys.url);
            
            // Reimagined card with centered real preview image
            card.innerHTML = `
                <div class="relative z-10 flex flex-col h-full justify-between">
                    <!-- System Preview Image Full Width at Top -->
                    <div class="w-full overflow-hidden">
                        <img class="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100" src="${sys.image || '/src/assets/logos/dole_logo.png'}" alt="${sys.name}" />
                    </div>
                    
                    <div class="p-6 flex-1 flex flex-col justify-between">
                        <div>
                            <h3 class="text-lg font-bold text-white mb-2 transition-colors">${sys.name}</h3>
                            <p class="text-xs font-semibold text-white/70">${sys.desc}</p>
                        </div>
                        
                        <!-- Bottom Edit & Archive Actions -->
                        <div class="relative z-20 flex items-center justify-between mt-6 pt-4 border-t border-white/20">
                            <!-- Edit (left) -->
                        <button class="btn-edit-system cursor-pointer text-white/70 hover:text-white transition-colors p-1 group/edit" data-id="${sys.id}">
                            <!-- Normal Outline SVG (hidden on mobile, hidden on hover of the button) -->
                            <svg class="w-5 h-5 hidden md:block group-hover/edit:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m14.304 4.844 2.852 2.852M7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4.5m2.409-9.91a2.017 2.017 0 0 1 0 2.853l-6.844 6.844L8 14l.713-3.565 6.844-6.844a2.015 2.015 0 0 1 2.852 0Z"/>
                            </svg>
                            <!-- Active Hover Filled SVG (visible on mobile, visible on hover of the button) -->
                            <svg class="w-5 h-5 block md:hidden md:group-hover/edit:block text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                <path fill-rule="evenodd" d="M11.32 6.176H5c-1.105 0-2 .949-2 2.118v10.588C3 20.052 3.895 21 5 21h11c1.105 0 2-.948 2-2.118v-7.75l-3.914 4.144A2.46 2.46 0 0 1 12.81 16l-2.681.568c-1.75.37-3.292-1.263-2.942-3.115l.536-2.839c.097-.512.335-.983.684-1.352l2.914-3.086Z" clip-rule="evenodd"/>
                                <path fill-rule="evenodd" d="M19.846 4.318a2.148 2.148 0 0 0-.437-.692 2.014 2.014 0 0 0-.654-.463 1.92 1.92 0 0 0-1.544 0 2.014 2.014 0 0 0-.654.463l-.546.578 2.852 3.02.546-.579a2.14 2.14 0 0 0 .437-.692 2.244 2.244 0 0 0 0-1.635ZM17.45 8.721 14.597 5.7 9.82 10.76a.54.54 0 0 0-.137.27l-.536 2.84c-.07.37.239.696.588.622l2.682-.567a.492.492 0 0 0 .255-.145l4.778-5.06Z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                        <!-- Archive (right) -->
                        <button class="btn-archive-system cursor-pointer text-white/70 hover:text-red-300 transition-colors p-1 group/archive" data-id="${sys.id}">
                            <!-- Default Outline SVG (hidden on hover) -->
                            <svg class="w-5 h-5 hidden md:block group-hover/archive:hidden" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11v5m0 0 2-2m-2 2-2-2M3 6v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Zm2 2v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8H5Z"/>
                            </svg>
                            <!-- Active Hover Filled SVG (visible on hover) -->
                            <svg class="w-5 h-5 block md:hidden group-hover/archive:block text-red-300" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                <path fill-rule="evenodd" d="M4 4a2 2 0 1 0 0 4h16a2 2 0 1 0 0-4H4Zm0 6h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8Zm10.707 5.707a1 1 0 0 0-1.414-1.414l-.293.293V12a1 1 0 1 0-2 0v2.586l-.293-.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l2-2Z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            `;
            gridEl.appendChild(card);
        });

        // Attach action events
        document.querySelectorAll('.btn-edit-system').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const sys = systems.find(s => s.id === id);
                if (sys) {
                    idInput.value = sys.id;
                    nameInput.value = sys.name;
                    descInput.value = sys.desc;
                    urlInput.value = sys.url;
                    if (colorInput) colorInput.value = sys.color || '#3b82f6';
                    drawerTitle.textContent = 'Edit System';
                    submitBtnText.textContent = 'Update System';
                    
                    if (sys.image) {
                        imagePreview.src = sys.image;
                        imagePreview.classList.remove('hidden');
                        if (dropzoneContent) dropzoneContent.classList.add('hidden');
                        if (imageChangeOverlay) imageChangeOverlay.classList.remove('hidden');
                    } else {
                        imagePreview.src = '';
                        imagePreview.classList.add('hidden');
                        if (dropzoneContent) dropzoneContent.classList.remove('hidden');
                        if (imageChangeOverlay) imageChangeOverlay.classList.add('hidden');
                    }
                    if (imageInput) imageInput.value = '';
                    if (imageErrorMsg) imageErrorMsg.classList.add('hidden');

                    // Show the drawer programmatically
                    if (addBtn) addBtn.click();
                }
            });
        });

        document.querySelectorAll('.btn-archive-system').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                systems = systems.filter(s => s.id !== id);
                localStorage.setItem('dole_systems', JSON.stringify(systems));
                renderSystems();
            });
        });

        // Make each card clickable (open sys URL in new tab), excluding edit/archive buttons
        document.querySelectorAll('.system-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-edit-system') || e.target.closest('.btn-archive-system')) return;
                const url = card.getAttribute('data-url');
                if (url && url !== '#' && url.trim() !== '') window.open(url, '_blank', 'noopener,noreferrer');
            });
        });
    };

    // Reset form when opening "Add System" drawer
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            // Only reset if NOT triggered by Edit button click simulation
            // Since Edit button click simulation also triggers addBtn.click(), we ensure we don't clear the form values
            // We check if the clicked trigger is manual by examining the active edit mode.
            // If the user manually clicks "Add System" button, clear fields:
            const rect = addBtn.getBoundingClientRect();
            if (rect.width > 0 || rect.height > 0) {
                // If it is a real user interaction, or we need to reset:
                // Let's do a simple check: if the inputs have values but idInput is empty, or if we reset on manual click:
                // To be safe, when clicking "Add System" button, we reset form unless we just populated it.
                // We can set a small flag or check the event source.
                // If the user clicks, the event object exists. If simulated, we can check.
            }
        });
        
        // Let's add a reset trigger explicitly when clicking "Add System" button directly:
        addBtn.addEventListener('mousedown', () => {
            idInput.value = '';
            formEl.reset();
            if (colorInput) colorInput.value = '#10b981';
            drawerTitle.textContent = 'Add New System';
            submitBtnText.textContent = 'Add System';
            if (imagePreview) {
                imagePreview.src = '';
                imagePreview.classList.add('hidden');
            }
            if (dropzoneContent) dropzoneContent.classList.remove('hidden');
            if (imageChangeOverlay) imageChangeOverlay.classList.add('hidden');
            if (imageInput) imageInput.value = '';
            if (imageErrorMsg) imageErrorMsg.classList.add('hidden');
        });
    }

    // Handle form submit
    if (formEl) {
        formEl.addEventListener('submit', (e) => {
            e.preventDefault();

            const id = idInput.value;
            const name = nameInput.value;
            const desc = descInput.value;
            const url = urlInput.value;
            const color = colorInput ? colorInput.value : '#3b82f6';
            let image = null;
            if (imagePreview && !imagePreview.classList.contains('hidden')) {
                image = imagePreview.src;
            }

            if (id) {
                // Edit mode
                const index = systems.findIndex(s => s.id === id);
                if (index !== -1) {
                    systems[index] = { id, name, desc, url, color, image: image || systems[index].image };
                }
            } else {
                // Add mode
                const newId = 'sys-' + Math.random().toString(36).substr(2, 9);
                systems.push({ id: newId, name, desc, url, color, image });
            }

            localStorage.setItem('dole_systems', JSON.stringify(systems));
            renderSystems();
            formEl.reset();
            idInput.value = '';

            // Close drawer
            if (closeBtn) {
                closeBtn.click();
            }
        });
    }

    // Blur background when drawer is active (including sidebar)
    const mainContent = document.getElementById('main-content');
    const drawerEl = document.getElementById('drawer-right-example');
    if (drawerEl && mainContent) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isClosed = drawerEl.classList.contains('translate-x-full');
                    const sidebar = document.getElementById('default-sidebar');
                    if (isClosed) {
                        mainContent.classList.remove('blur-[2px]');
                        if (sidebar) {
                            sidebar.classList.remove('blur-[2px]', 'pointer-events-none');
                            sidebar.style.zIndex = '';
                        }
                    } else {
                        mainContent.classList.add('blur-[2px]');
                        if (sidebar) {
                            sidebar.classList.add('blur-[2px]', 'pointer-events-none');
                            sidebar.style.zIndex = '30';
                        }
                    }
                }
            });
        });
        observer.observe(drawerEl, { attributes: true });
    }

    // Initial render
    renderSystems();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSystemsManager);
} else {
    initSystemsManager();
}
/* END MANAGE SYSTEMS DRAWER FUNCTIONALITY */

