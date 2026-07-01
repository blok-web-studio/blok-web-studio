/* ================================================================
   BLOK. — Mobile Engine
   Bottom tabs, sheet, carousel dots, floor pill
   ================================================================ */

(function () {
  'use strict';

  if (window.innerWidth > 768) return;

  // ── 1. BOTTOM TABS ───────────────────────────────────────

  const tabs = document.querySelectorAll('.bottom-tab');
  const sections = document.querySelectorAll('[data-screen]');
  const tabContainer = document.getElementById('bottomTabs');
  const sheetItems = document.querySelectorAll('.bottom-sheet__item');
  const floorPill = document.getElementById('floorPill');
  const floorPillNum = document.getElementById('floorPillNum');
  const floorPillLabel = document.getElementById('floorPillLabel');
  const sheetOverlay = document.getElementById('sheetOverlay');
  const bottomSheet = document.getElementById('bottomSheet');
  const sheetClose = document.getElementById('sheetClose');
  const screenOrder = ['Ground', 'Lobby', 'Mezz', 'Core', 'Upper', 'Roof'];

  let lastScrollY = window.scrollY;
  let tabHideTimer = null;

  // Hide tabs on scroll down, show on scroll up
  function handleTabVisibility() {
    const currentScroll = window.scrollY;
    const dir = currentScroll - lastScrollY;
    if (dir > 20 && currentScroll > 200) {
      tabContainer.classList.add('bottom-tabs--hidden');
    } else if (dir < -10) {
      tabContainer.classList.remove('bottom-tabs--hidden');
    }
    lastScrollY = currentScroll;
  }

  function updateActiveTab() {
    const viewH = window.innerHeight;
    let activeScreen = 'Ground';

    sections.forEach(function (section) {
      const rect = section.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (mid < viewH * 0.6) {
        activeScreen = section.getAttribute('data-screen');
      }
    });

    // Update bottom tabs
    tabs.forEach(function (tab) {
      const tabScreen = tab.getAttribute('data-screen');
      const isActive = tabScreen === activeScreen;
      tab.classList.toggle('bottom-tab--active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update sheet items
    sheetItems.forEach(function (item) {
      const itemScreen = item.getAttribute('data-screen');
      item.classList.toggle('bottom-sheet__item--active', itemScreen === activeScreen);
    });

    // Update floor pill
    const idx = screenOrder.indexOf(activeScreen);
    if (idx !== -1) {
      if (floorPillNum) floorPillNum.textContent = String(idx + 1).padStart(2, '0');
      if (floorPillLabel) floorPillLabel.textContent = activeScreen.toUpperCase();
    }

    // Show floor pill when scrolled past hero
    if (floorPill) {
      const hero = document.getElementById('hero');
      if (hero) {
        const heroBottom = hero.getBoundingClientRect().bottom;
        floorPill.classList.toggle('floor-pill--visible', heroBottom < 0);
      }
    }
  }

  // ── 2. SCROLL HANDLER ─────────────────────────────────────

  let ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(function () {
        handleTabVisibility();
        updateActiveTab();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // ── 3. BOTTOM SHEET ───────────────────────────────────────

  let sheetOpen = false;

  function openSheet() {
    sheetOpen = true;
    bottomSheet.classList.add('bottom-sheet--open');
    sheetOverlay.classList.add('sheet-overlay--open');
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    sheetOpen = false;
    bottomSheet.classList.remove('bottom-sheet--open');
    sheetOverlay.classList.remove('sheet-overlay--open');
    document.body.style.overflow = '';
  }

  // Floor pill opens sheet
  if (floorPill) {
    floorPill.addEventListener('click', openSheet);
  }

  // Overlay closes sheet
  if (sheetOverlay) {
    sheetOverlay.addEventListener('click', closeSheet);
  }

  // Close button
  if (sheetClose) {
    sheetClose.addEventListener('click', closeSheet);
  }

  // Sheet items: close after navigation
  sheetItems.forEach(function (item) {
    item.addEventListener('click', function () {
      closeSheet();
    });
  });

  // Swipe down to close sheet (simple)
  let sheetTouchStart = null;
  if (bottomSheet) {
    bottomSheet.addEventListener('touchstart', function (e) {
      sheetTouchStart = e.touches[0].clientY;
    }, { passive: true });

    bottomSheet.addEventListener('touchmove', function (e) {
      if (!sheetTouchStart) return;
      const dy = e.touches[0].clientY - sheetTouchStart;
      if (dy > 60) {
        closeSheet();
        sheetTouchStart = null;
      }
    }, { passive: true });

    bottomSheet.addEventListener('touchend', function () {
      sheetTouchStart = null;
    }, { passive: true });
  }

  // ── 4. CAROUSEL DOTS ──────────────────────────────────────

  function initCarouselDots(containerId, dotsId) {
    const container = document.getElementById(containerId);
    const dots = document.querySelectorAll('#' + dotsId + ' .carousel-dot');
    if (!container || !dots.length) return;

    function updateDots() {
      if (!container.isConnected) return;
      const scrollLeft = container.scrollLeft;
      const cards = container.querySelectorAll('.service-card, .testimonial-block');
      if (!cards.length) return;

      let activeIdx = 0;
      let minDist = Infinity;
      cards.forEach(function (card, i) {
        const dist = Math.abs(card.offsetLeft - scrollLeft);
        if (dist < minDist) {
          minDist = dist;
          activeIdx = i;
        }
      });

      dots.forEach(function (dot, i) {
        dot.classList.toggle('carousel-dot--active', i === activeIdx);
      });
    }

    container.addEventListener('scroll', updateDots, { passive: true });

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        const idx = parseInt(dot.getAttribute('data-index'), 10);
        const cards = container.querySelectorAll('.service-card, .testimonial-block');
        if (cards[idx]) {
          cards[idx].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
        }
      });
    });

    updateDots();
  }

  initCarouselDots('serviceGrid', 'serviceDots');
  initCarouselDots('testimonialWall', 'testimonialDots');

  // ── 5. SMOOTH SCROLL FOR TABS ─────────────────────────────

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      const target = tab.getAttribute('data-tab');
      const section = document.getElementById(target);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── 6. INIT ───────────────────────────────────────────────

  // Initial update
  setTimeout(function () {
    updateActiveTab();
  }, 200);

  window.addEventListener('load', function () {
    setTimeout(updateActiveTab, 400);
  });

  // ── 7. VIZ TOGGLE IN SHEET ────────────────────────────────

  const sheetVizBtns = bottomSheet ? bottomSheet.querySelectorAll('.viz-toggle__btn') : [];
  sheetVizBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const viz = btn.getAttribute('data-viz');
      sheetVizBtns.forEach(function (b) {
        b.classList.remove('viz-toggle__btn--active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('viz-toggle__btn--active');
      btn.setAttribute('aria-checked', 'true');
      document.documentElement.setAttribute('data-viz', viz);
    });
  });

})();
