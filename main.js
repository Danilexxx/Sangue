/**
 * Atlas de Histologia — Main JavaScript
 * Handles: Navigation, Zoom viewer (mouse + touch), Fullscreen, Scroll animations
 */

document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initMobileMenu();
    initScrollAnimations();

    // Only init viewer on tissue pages
    if (document.getElementById('zoom-viewer')) {
        initZoomViewer();
        initThumbnails();
        initSlideSelector();
        initFullscreen();
    }
});

/* ========================================
   Header scroll effect
   ======================================== */
function initHeader() {
    const header = document.getElementById('main-header');
    if (!header) return;

    const onScroll = () => {
        header.classList.toggle('scrolled', window.scrollY > 10);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

/* ========================================
   Mobile menu toggle
   ======================================== */
function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const overlay = document.getElementById('mobile-nav-overlay');
    if (!btn || !overlay) return;

    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.style.overflow = overlay.classList.contains('active') ? 'hidden' : '';
    });

    // Close on link click
    overlay.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.addEventListener('click', () => {
            btn.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}

/* ========================================
   Scroll reveal animations
   ======================================== */
function initScrollAnimations() {
    const elements = document.querySelectorAll('.tissue-card, .info-card');
    if (!elements.length) return;

    elements.forEach(el => el.classList.add('fade-in-up'));

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    elements.forEach(el => observer.observe(el));
}

/* =======================================/* ========================================
   Zoom Viewer & Pan Engine (Desktop + Mobile)
   ======================================== */
function createZoomPanController(container, image, zoomLevelDisplay, zoomHint, maxScaleLimit = 6) {
    let scale = 1;
    let panX = 0;
    let panY = 0;
    const MIN_SCALE = 1;
    const MAX_SCALE = maxScaleLimit;
    const ZOOM_STEP = 0.25;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let lastPanX = 0;
    let lastPanY = 0;
    let hintHidden = false;

    // Touch variables
    let lastTouchDist = 0;
    let startTouchScale = 1;
    let lastTapTime = 0;

    function hideHint() {
        if (!hintHidden && zoomHint) {
            zoomHint.classList.add('hidden');
            hintHidden = true;
        }
    }

    function constrainPan() {
        const rect = container.getBoundingClientRect();
        if (scale <= 1) {
            panX = 0;
            panY = 0;
            return;
        }
        const maxPanX = (rect.width * (scale - 1)) / 2;
        const maxPanY = (rect.height * (scale - 1)) / 2;
        panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
        panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
    }

    function updateTransform() {
        constrainPan();
        image.style.transform = `translate3d(${panX}px, ${panY}px, 0px) scale(${scale})`;
        if (zoomLevelDisplay) {
            zoomLevelDisplay.textContent = Math.round(scale * 100) + '%';
        }
    }

    function reset() {
        scale = 1;
        panX = 0;
        panY = 0;
        updateTransform();
    }

    function setScaleDelta(delta) {
        hideHint();
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta));
        updateTransform();
    }

    function setScale(newScale) {
        hideHint();
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
        updateTransform();
    }

    // Wheel zoom
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        hideHint();
        const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta));
        updateTransform();
    }, { passive: false });

    // Double click / Double tap to zoom
    function handleDoubleTap(clientX, clientY) {
        hideHint();
        if (scale > 1.5) {
            reset();
        } else {
            scale = 3;
            const rect = container.getBoundingClientRect();
            const touchX = clientX - rect.left - rect.width / 2;
            const touchY = clientY - rect.top - rect.height / 2;
            panX = -touchX * 2;
            panY = -touchY * 2;
            updateTransform();
        }
    }

    container.addEventListener('dblclick', (e) => {
        e.preventDefault();
        handleDoubleTap(e.clientX, e.clientY);
    });

    // MOUSE EVENTS
    container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        hideHint();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        lastPanX = panX;
        lastPanY = panY;
        container.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panX = lastPanX + (e.clientX - startX);
        panY = lastPanY + (e.clientY - startY);
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            container.style.cursor = 'grab';
        }
    });

    // TOUCH EVENTS
    container.addEventListener('touchstart', (e) => {
        hideHint();

        // Double tap check
        const now = Date.now();
        if (e.touches.length === 1 && (now - lastTapTime) < 300) {
            e.preventDefault();
            handleDoubleTap(e.touches[0].clientX, e.touches[0].clientY);
            lastTapTime = 0;
            return;
        }
        if (e.touches.length === 1) {
            lastTapTime = now;
        }

        if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            lastPanX = panX;
            lastPanY = panY;
        } else if (e.touches.length === 2) {
            isDragging = false;
            lastTouchDist = getTouchDist(e.touches);
            startTouchScale = scale;
        }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isDragging) {
            if (scale > 1) {
                e.preventDefault(); // Prevent scrolling page when panning image
            }
            panX = lastPanX + (e.touches[0].clientX - startX);
            panY = lastPanY + (e.touches[0].clientY - startY);
            updateTransform();
        } else if (e.touches.length === 2 && lastTouchDist > 0) {
            e.preventDefault();
            const currentDist = getTouchDist(e.touches);
            const ratio = currentDist / lastTouchDist;
            scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, startTouchScale * ratio));
            updateTransform();
        }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            lastTouchDist = 0;
        }
        if (e.touches.length === 0) {
            isDragging = false;
        }
    });

    function getTouchDist(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    return {
        zoomIn: () => setScaleDelta(0.5),
        zoomOut: () => setScaleDelta(-0.5),
        reset: reset,
        setScale: setScale
    };
}

let mainViewerController = null;

function initZoomViewer() {
    const container = document.getElementById('zoom-container');
    const image = document.getElementById('zoom-image');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const resetBtn = document.getElementById('zoom-reset-btn');
    const zoomLevelDisplay = document.getElementById('zoom-level');
    const zoomHint = document.getElementById('zoom-hint');

    if (!container || !image) return;

    mainViewerController = createZoomPanController(container, image, zoomLevelDisplay, zoomHint, 6);

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => mainViewerController.zoomIn());
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => mainViewerController.zoomOut());
    if (resetBtn) resetBtn.addEventListener('click', () => mainViewerController.reset());
}

/* ========================================
   Thumbnail selection
   ======================================== */
function initThumbnails() {
    const thumbnails = document.querySelectorAll('.thumbnail');
    const zoomImage = document.getElementById('zoom-image');

    if (!thumbnails.length || !zoomImage) return;

    thumbnails.forEach(thumb => {
        thumb.addEventListener('click', () => {
            thumbnails.forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');

            const img = thumb.querySelector('img');
            if (img) {
                zoomImage.src = img.src;
                zoomImage.alt = img.alt;
                if (mainViewerController) mainViewerController.reset();
            }
        });
    });
}

/* ========================================
   Slide selector (Lâminas de sangue)
   ======================================== */
function initSlideSelector() {
    const btns = document.querySelectorAll('.slide-tab-btn');
    const zoomImage = document.getElementById('zoom-image');
    if (!btns.length || !zoomImage) return;

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const newSrc = btn.getAttribute('data-img');
            if (newSrc) {
                zoomImage.src = newSrc;
                if (mainViewerController) mainViewerController.reset();
            }
        });
    });
}

/* ========================================
   Fullscreen viewer
   ======================================== */
function initFullscreen() {
    const modal = document.getElementById('fullscreen-modal');
    const openBtn = document.getElementById('zoom-fullscreen-btn');
    const closeBtn = document.getElementById('fullscreen-close-btn');
    const fsImage = document.getElementById('fullscreen-image');
    const fsContainer = document.getElementById('fullscreen-container');
    const fsZoomIn = document.getElementById('fs-zoom-in');
    const fsZoomOut = document.getElementById('fs-zoom-out');
    const fsZoomReset = document.getElementById('fs-zoom-reset');
    const fsZoomLevel = document.getElementById('fs-zoom-level');

    if (!modal || !openBtn || !fsImage || !fsContainer) return;

    const fsController = createZoomPanController(fsContainer, fsImage, fsZoomLevel, null, 8);

    if (fsZoomIn) fsZoomIn.addEventListener('click', () => fsController.zoomIn());
    if (fsZoomOut) fsZoomOut.addEventListener('click', () => fsController.zoomOut());
    if (fsZoomReset) fsZoomReset.addEventListener('click', () => fsController.reset());

    // Open
    openBtn.addEventListener('click', () => {
        const currentSrc = document.getElementById('zoom-image')?.src;
        if (currentSrc) fsImage.src = currentSrc;
        fsController.reset();

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    // Close
    function closeFullscreen() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeFullscreen);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeFullscreen();
        }
    });
}
