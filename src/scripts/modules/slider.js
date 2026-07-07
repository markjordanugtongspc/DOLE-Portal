import { Carousel } from 'flowbite';

// Auto-detect images in src/assets/images/slider/
const imagesObj = import.meta.glob('@/assets/images/slider/*.{jpg,jpeg,png,svg}', { eager: true, import: 'default' });

const container = document.getElementById('slider-container');

if (container && Object.keys(imagesObj).length > 0) {
    const imageUrls = Object.values(imagesObj);

    // Create Carousel Wrapper Element
    const wrapper = document.createElement('div');
    wrapper.id = 'animation-carousel';
    wrapper.className = 'relative w-full h-full';
    wrapper.setAttribute('data-carousel', 'static');

    const innerWrapper = document.createElement('div');
    innerWrapper.className = 'relative w-full h-full overflow-hidden';

    const carouselItems = [];

    // Insert items
    imageUrls.forEach((url, index) => {
        const item = document.createElement('div');
        // Hidden by default, duration and ease classes for tailwind
        item.className = 'hidden duration-700 ease-linear';
        item.id = `carousel-item-${index}`;
        
        const img = document.createElement('img');
        img.src = url;
        img.className = 'absolute block w-full h-full object-cover -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2';
        img.alt = `Slider image ${index + 1}`;
        
        item.appendChild(img);
        innerWrapper.appendChild(item);

        carouselItems.push({
            position: index,
            el: item
        });
    });

    wrapper.appendChild(innerWrapper);
    container.appendChild(wrapper);

    // Initialize Flowbite Carousel (Plain images cycling, text overlays removed)
    const options = {
        defaultPosition: 0,
        interval: 3000,
        indicators: {
            activeClasses: 'bg-white dark:bg-gray-800',
            inactiveClasses: 'bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800',
            items: [] // we aren't using indicators based on the prompt
        },
        onNext: () => {},
        onPrev: () => {},
        onChange: () => {}
    };

    const instanceOptions = {
        id: 'animation-carousel',
        override: true
    };

    const carousel = new Carousel(wrapper, carouselItems, options, instanceOptions);
    
    // Cycle automatically
    carousel.cycle();

    // Pause on hover
    wrapper.addEventListener('mouseenter', () => {
        carousel.pause();
    });

    wrapper.addEventListener('mouseleave', () => {
        carousel.cycle();
    });
}
