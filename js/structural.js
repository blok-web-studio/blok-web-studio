/* ================================================================
   BLOK. — Structural Engine
   Block assembly, scroll tracking, blueprint toggle, interactions
   ================================================================ */

(function () {
  'use strict';

  // =============================================================
  // 1. Discipline Block Generator — random pool, float, parallax, drag
  // =============================================================

  var oldCanvas = document.getElementById('blockCanvas');
  if (oldCanvas) oldCanvas.remove();

  var discContainer = document.getElementById('heroDisciplines');

  if (discContainer) {

    // --- Pool of 12 disciplines ---
    var DISCIPLINES = [
      { label: 'Design',   icon: 'ph-pen-nib' },
      { label: 'Code',     icon: 'ph-code' },
      { label: 'Commerce', icon: 'ph-shopping-cart' },
      { label: 'Content',  icon: 'ph-article' },
      { label: 'Strategy', icon: 'ph-compass' },
      { label: 'Brand',    icon: 'ph-trademark' },
      { label: 'Motion',   icon: 'ph-video' },
      { label: 'UX',       icon: 'ph-fingerprint' },
      { label: 'SEO',      icon: 'ph-magnifying-glass' },
      { label: 'Analytics',icon: 'ph-chart-bar' },
      { label: 'Systems',  icon: 'ph-server' },
      { label: 'Support',  icon: 'ph-headphones' },
    ];

    var SIZES = [80, 95, 110, 125, 140, 160];
    var COLORS = ['accent', 'cyan', 'lime', 'base'];
    var COLOR_CLASSES = {
      accent: 'disc-block--accent',
      cyan: 'disc-block--cyan',
      lime: 'disc-block--lime',
      base: 'disc-block--base',
    };

    // --- Pick random subset (5-7) ---
    var count = 5 + Math.floor(Math.random() * 3);
    var shuffled = DISCIPLINES.slice().sort(function () { return Math.random() - 0.5; });
    var picked = shuffled.slice(0, count);

    // --- Organic cluster position generator (no math curves) ---
    function generatePositions(num) {
      var zones = [
        { cx: 44, cy: 20, rx: 15, ry: 13 },
        { cx: 32, cy: 44, rx: 17, ry: 15 },
        { cx: 17, cy: 66, rx: 14, ry: 14 },
      ];
      var positions = [];
      for (var i = 0; i < num; i++) {
        var z = zones[Math.floor(Math.random() * zones.length)];
        var x = z.cx + (Math.random() - 0.5) * 2 * z.rx;
        var y = z.cy + (Math.random() - 0.5) * 2 * z.ry;
        x = Math.max(2, Math.min(60, x));
        y = Math.max(2, Math.min(85, y));
        positions.push({ x: x, y: y });
      }
      return positions;
    }

    var positions = generatePositions(count);

    // --- Random entrance delays (shuffled, not sequential) ---
    var delays = [];
    for (var d = 0; d < count; d++) {
      delays.push(Math.random() * 0.7);
    }

    // --- Create blocks + float state ---
    var floatStates = [];
    var blocks = [];

    picked.forEach(function (d, i) {
      var size = SIZES[Math.floor(Math.random() * SIZES.length)];
      var colorKey = COLORS[Math.floor(Math.random() * COLORS.length)];
      var colorClass = COLOR_CLASSES[colorKey];
      var pos = positions[i];

      var el = document.createElement('div');
      el.className = 'disc-block ' + colorClass;
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.left = pos.x + '%';
      el.style.top = pos.y + '%';
      el.style.animationDelay = delays[i] + 's';
      el.setAttribute('data-index', i);

      el.innerHTML =
        '<div class="disc-block__icon"><i class="ph ' + d.icon + '"></i></div>' +
        '<span class="disc-block__label">' + d.label + '</span>';

      discContainer.appendChild(el);
      blocks.push(el);

      floatStates.push({
        el: el,
        phaseY: Math.random() * Math.PI * 2,
        phaseX: Math.random() * Math.PI * 2,
        phaseR: Math.random() * Math.PI * 2,
        dur: 5 + Math.random() * 6,          // 5-11s cycle
        ampY: 3 + Math.random() * 6,         // 3-9px drift
        ampX: 1.5 + Math.random() * 4,       // 1.5-5.5px sway
        ampR: 0.3 + Math.random() * 1.2,     // 0.3-1.5° wobble
        parallaxX: 0,
        parallaxY: 0,
        dragOffsetX: 0,
        dragOffsetY: 0,
        isDragging: false,
      });
    });

    // --- RAF float loop ---
    var floatStartTime = performance.now();
    var floatRAF = null;

    function tickFloat(now) {
      if (!discContainer || !discContainer.isConnected) return;
      var t = (now - floatStartTime) / 1000;

      for (var f = 0; f < floatStates.length; f++) {
        var fs = floatStates[f];
        if (fs.isDragging) continue;

        var floatY = Math.sin(t * (Math.PI * 2 / fs.dur) + fs.phaseY) * fs.ampY;
        var floatX = Math.sin(t * (Math.PI * 2 / (fs.dur * 0.7)) + fs.phaseX) * fs.ampX;
        var floatR = Math.sin(t * (Math.PI * 2 / (fs.dur * 1.2)) + fs.phaseR) * fs.ampR;

        fs.el.style.transform =
          'translate3d(' + (floatX + fs.parallaxX + fs.dragOffsetX).toFixed(1) + 'px, '
          + (floatY + fs.parallaxY + fs.dragOffsetY).toFixed(1) + 'px, 0) rotate(' + floatR.toFixed(1) + 'deg)';
      }

      floatRAF = requestAnimationFrame(tickFloat);
    }

    // --- Mouse parallax ---
    var containerRect = discContainer.getBoundingClientRect();

    function onContainerMouseMove(e) {
      var cx = containerRect.left + containerRect.width / 2;
      var cy = containerRect.top + containerRect.height / 2;
      var dx = (e.clientX - cx) / containerRect.width;
      var dy = (e.clientY - cy) / containerRect.height;

      for (var f = 0; f < floatStates.length; f++) {
        var strength = 6 + (f % 3) * 3;
        floatStates[f].parallaxX = dx * strength;
        floatStates[f].parallaxY = dy * strength;
      }
    }

    function onContainerMouseLeave() {
      for (var f = 0; f < floatStates.length; f++) {
        floatStates[f].parallaxX = 0;
        floatStates[f].parallaxY = 0;
      }
    }

    discContainer.addEventListener('mousemove', onContainerMouseMove, { passive: true });
    discContainer.addEventListener('mouseleave', onContainerMouseLeave, { passive: true });

    window.addEventListener('resize', function () {
      containerRect = discContainer.getBoundingClientRect();
    });

    // --- Pointer-event drag ---
    var dragState = null;

    function onPointerDown(e) {
      var block = e.currentTarget;
      var idx = parseInt(block.getAttribute('data-index'), 10);
      var fs = floatStates[idx];
      if (!fs) return;

      fs.isDragging = true;
      fs.el.style.zIndex = 50;
      fs.el.style.cursor = 'grabbing';

      dragState = {
        fs: fs,
        startX: e.clientX,
        startY: e.clientY,
        origOffsetX: fs.dragOffsetX,
        origOffsetY: fs.dragOffsetY,
      };

      block.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!dragState) return;
      var fs = dragState.fs;
      fs.dragOffsetX = dragState.origOffsetX + (e.clientX - dragState.startX);
      fs.dragOffsetY = dragState.origOffsetY + (e.clientY - dragState.startY);
    }

    function onPointerUp() {
      if (!dragState) return;
      var fs = dragState.fs;
      fs.isDragging = false;
      fs.el.style.zIndex = 1;
      fs.el.style.cursor = 'grab';
      dragState = null;
    }

    for (var b = 0; b < blocks.length; b++) {
      blocks[b].addEventListener('pointerdown', onPointerDown);
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);

    // --- Kick off float after entrance animation completes ---
    setTimeout(function () {
      floatRAF = requestAnimationFrame(tickFloat);
    }, 1500);

  } // end if discContainer

  // =============================================================
  // 2. Scroll Reveals — Intersection Observer
  // =============================================================

  const staggerEls = document.querySelectorAll('[data-reveal-stagger]');

  staggerEls.forEach(function (el) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-stagger--visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
    observer.observe(el);
  });

  // =============================================================
  // 3. Assembly floors — highlight active floor on scroll
  // =============================================================

  const assemblyFloors = document.querySelectorAll('.assembly-floor');

  function highlightAssemblyFloor() {
    if (assemblyFloors.length === 0) return;

    const windowMid = window.innerHeight / 2;
    let closestFloor = null;
    let closestDist = Infinity;

    assemblyFloors.forEach(function (floor) {
      const rect = floor.getBoundingClientRect();
      const floorMid = rect.top + rect.height / 2;
      const dist = Math.abs(floorMid - windowMid);

      // Add proximity-based accent to the icon
      const icon = floor.querySelector('.assembly-floor__icon');
      if (icon) {
        const proximity = Math.max(0, 1 - dist / (window.innerHeight * 0.6));
        if (proximity > 0.5) {
          icon.style.color = 'var(--accent)';
        } else {
          icon.style.color = '';
        }
      }
    });
  }

  if (assemblyFloors.length > 0) {
    window.addEventListener('scroll', highlightAssemblyFloor, { passive: true });
  }

  // =============================================================
  // 4. Stats Counter — Animate numbers on scroll
  // =============================================================

  const statNums = document.querySelectorAll('.stat-block__num[data-count]');

  const statObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-count'), 10);
        animateCounter(el, target);
        statObserver.unobserve(el);

        // Activate the meter fill
        const block = el.closest('.stat-block');
        if (block) {
          block.classList.add('stat-block__fill--active');
        }
      }
    });
  }, { threshold: 0.3 });

  statNums.forEach(function (el) {
    statObserver.observe(el);
  });

  function animateCounter(el, target) {
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1500;
    const startTime = performance.now();
    const startVal = 0;

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      el.textContent = current + suffix;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target + suffix;
      }
    }

    requestAnimationFrame(tick);
  }

  // =============================================================
  // 5. Floor Tracking — Navigation and floor indicator
  // =============================================================

  const sections = document.querySelectorAll('[data-screen]');
  const navFloors = document.querySelectorAll('.structural-nav__floor');
  const floorNumEl = document.getElementById('floorNum');
  const floorLabelEl = document.getElementById('floorLabel');

  // Named floor order (canonical)
  const screenOrder = ['Ground', 'Lobby', 'Mezz', 'Core', 'Upper', 'Roof'];

  // Indicator element that smoothly moves between floor links
  const navEl = document.querySelector('.structural-nav');
  const indicator = navEl ? navEl.querySelector('.structural-nav__indicator') : null;

  // Flag to prevent scroll-based floor tracking from overriding
  // a programmatic scroll (smooth scroll click) while animating
  let suppressFloorTracking = false;

  // Set active floor by screen name — used by both scroll tracking and click
  function setActiveFloor(screen) {
    let activeLink = null;

    // Update nav indicators by matching data-screen
    navFloors.forEach(function (link) {
      const linkScreen = link.getAttribute('data-screen');
      const isActive = linkScreen === screen;
      link.classList.toggle('structural-nav__floor--active', isActive);
      if (isActive) activeLink = link;
    });

    // Update floor number based on canonical order
    const floorIdx = screenOrder.indexOf(screen);
    if (floorIdx !== -1) {
      const floorStr = String(floorIdx + 1).padStart(2, '0');
      if (floorNumEl) floorNumEl.textContent = floorStr;
    }

    // Update floor label
    if (floorLabelEl) floorLabelEl.textContent = screen.toUpperCase();

    // Move the indicator smoothly to the active floor link
    if (indicator && activeLink && navEl) {
      var navRect = navEl.getBoundingClientRect();
      var linkRect = activeLink.getBoundingClientRect();
      indicator.style.top = (linkRect.top - navRect.top + 4) + 'px';
      indicator.style.height = (linkRect.height - 8) + 'px';
    }
  }

  function updateFloor() {
    const scrollY = window.scrollY;
    const viewportH = window.innerHeight;

    // Only update floor tracking scroll-based when not mid-animation
    if (!suppressFloorTracking) {
      let activeScreen = 'Ground';

      // Find the last section whose midpoint has scrolled past 60% viewport
      sections.forEach(function (section) {
        const rect = section.getBoundingClientRect();
        const midPoint = rect.top + rect.height / 2;
        if (midPoint < viewportH * 0.6) {
          activeScreen = section.getAttribute('data-screen');
        }
      });

      setActiveFloor(activeScreen);
    }

    // Update tension monitor in footer (scroll reactive)
    updateTensionMonitor(scrollY, viewportH);
  }

  // Tension monitor — decorative footer gauges reacting to scroll + mouse
  function updateTensionMonitor(scrollY, viewportH) {
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );
    const maxScroll = docHeight - viewportH;
    const progress = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0;

    const gaugeTension = document.getElementById('gaugeTension');
    const gaugeLoad = document.getElementById('gaugeLoad');
    const gaugeStress = document.getElementById('gaugeStress');
    const tensionReadout = document.getElementById('tensionReadout');
    const tensionWeight = document.getElementById('tensionWeight');

    // Gauges animate based on scroll with different curves
    if (gaugeTension) gaugeTension.style.width = (Math.sin(progress * Math.PI) * 60 + 20) + '%';
    if (gaugeLoad) gaugeLoad.style.width = (progress * 80 + 10) + '%';
    if (gaugeStress) gaugeStress.style.width = (Math.pow(progress, 1.5) * 70 + 5) + '%';
    if (tensionReadout) tensionReadout.textContent = (Math.sin(progress * Math.PI * 2) * 2 + 3).toFixed(1);
    if (tensionWeight) {
      const weightPos = Math.sin(progress * Math.PI) * 8;
      tensionWeight.style.bottom = (12 + weightPos) + 'px';
    }
  }

  // Mouse-follow for tension monitor (subtle — modulates scroll baseline)
  let mouseTensionOffset = 0;
  document.addEventListener('mousemove', function (e) {
    const docHeight = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight
    );
    const vh = window.innerHeight;
    const maxScroll = docHeight - vh;
    const scrollProgress = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
    const mouseNorm = Math.min(1, Math.max(0, e.clientY / vh));
    // Blend: near footer (mouse far down) influence grows; otherwise scroll rules
    const footerBlend = Math.max(0, (mouseNorm - 0.6) / 0.4); // 0 when above 60%, 1 at bottom
    mouseTensionOffset = footerBlend * (mouseNorm - scrollProgress) * 0.3;

    const combinedProgress = Math.min(1, Math.max(0, scrollProgress + mouseTensionOffset));
    const gaugeTension = document.getElementById('gaugeTension');
    const gaugeLoad = document.getElementById('gaugeLoad');
    const gaugeStress = document.getElementById('gaugeStress');
    const tensionReadout = document.getElementById('tensionReadout');
    if (gaugeTension) gaugeTension.style.width = (Math.sin(combinedProgress * Math.PI) * 60 + 20) + '%';
    if (gaugeLoad) gaugeLoad.style.width = (combinedProgress * 80 + 10) + '%';
    if (gaugeStress) gaugeStress.style.width = (Math.pow(combinedProgress, 1.5) * 70 + 5) + '%';
    if (tensionReadout) tensionReadout.textContent = (Math.sin(combinedProgress * Math.PI * 2) * 2 + 3).toFixed(1);
  });

  // Throttled scroll handler
  let scrollTicking = false;
  window.addEventListener('scroll', function () {
    if (!scrollTicking) {
      requestAnimationFrame(function () {
        updateFloor();
        highlightAssemblyFloor();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  });

  // Initial update
  window.addEventListener('load', function () {
    setTimeout(updateFloor, 100);
    setTimeout(highlightAssemblyFloor, 100);
    // Enable indicator transitions after the initial floor position is locked
    // (prevents a flash-animation from (0,0) to the first item)
    setTimeout(function () {
      if (navEl) navEl.classList.add('structural-nav--animated');
    }, 250);
  });

  // =============================================================
  // 6. Blueprint / Structure View Toggle
  // =============================================================

  const vizBtns = document.querySelectorAll('.viz-toggle__btn');

  vizBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const viz = btn.getAttribute('data-viz');

      // Update button states
      vizBtns.forEach(function (b) {
        b.classList.remove('viz-toggle__btn--active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('viz-toggle__btn--active');
      btn.setAttribute('aria-checked', 'true');

      // Apply to document
      document.documentElement.setAttribute('data-viz', viz);
    });
  });

  // =============================================================
  // 7. Work Filters
  // =============================================================

  const filterBtns = document.querySelectorAll('.work-filter');
  const workItems = document.querySelectorAll('.work-item');

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const filter = btn.getAttribute('data-filter');

      // Update button states
      filterBtns.forEach(function (b) {
        b.classList.remove('work-filter--active');
      });
      btn.classList.add('work-filter--active');

      // Filter items
      workItems.forEach(function (item) {
        const cats = item.getAttribute('data-category');
        if (filter === 'all' || cats === filter) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  // =============================================================
  // 8. Process Timeline — Step activation on scroll
  // =============================================================

  const processSteps = document.querySelectorAll('.process-step');

  const stepObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('process-step--active');
      }
    });
  }, { threshold: 0.3 });

  processSteps.forEach(function (step) {
    stepObserver.observe(step);
  });

  // =============================================================
  // 10. Contact Form — Submission handler
  // =============================================================

  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      // Collect values
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const budget = document.getElementById('budget').value;
      const message = document.getElementById('message').value.trim();
      const submitBtn = contactForm.querySelector('.btn');

      // Highlight empty required fields
      let hasError = false;
      [['name', name], ['email', email], ['message', message]].forEach(function (pair) {
        const field = document.getElementById(pair[0]);
        if (!pair[1]) {
          field.style.borderColor = 'var(--accent)';
          hasError = true;
        } else {
          field.style.borderColor = '';
        }
      });

      if (hasError) {
        submitBtn.textContent = 'Fill required fields first';
        submitBtn.style.borderColor = 'var(--accent)';
        setTimeout(function () {
          submitBtn.innerHTML = 'Send brief <i class="ph ph-arrow-right"></i>';
          submitBtn.style.borderColor = '';
        }, 2000);
        return;
      }

      // Submit to Netlify Function (server-side storage)
      (function submitToAPI() {
        var apiBase = '/api';
        // In local dev, netlify dev runs on 8888
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          apiBase = 'http://localhost:8888/api';
        }
        fetch(apiBase + '/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, email: email, budget: budget, message: message })
        }).catch(function () {
          // API unavailable — silently fall through to localStorage
        });
      })();

      // Save to localStorage for admin panel (backup / local dev fallback)
      try {
        var _leads = JSON.parse(localStorage.getItem('blok_admin_leads')) || [];
        _leads.unshift({
          id: 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: name,
          email: email,
          budget: budget || 'not-sure',
          message: message,
          status: 'new',
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('blok_admin_leads', JSON.stringify(_leads));
      } catch (_e) { /* localStorage unavailable — non-critical */ }

      // Visual "sent" feedback
      submitBtn.textContent = 'Brief sent ✓';
      submitBtn.classList.add('btn--accent');
      setTimeout(function () {
        submitBtn.innerHTML = 'Send brief <i class="ph ph-arrow-right"></i>';
        submitBtn.classList.remove('btn--accent');
        contactForm.reset();
        ['name', 'email', 'message'].forEach(function (id) {
          document.getElementById(id).style.borderColor = '';
        });
      }, 2000);
    });
  }

  // =============================================================
  // 11. Smooth scroll for nav links
  // =============================================================

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // For nav floor links, immediately set active floor
        // and suppress scroll-based tracking during the animation
        // so the indicator doesn't flash back-and-forth
        if (anchor.closest('.structural-nav')) {
          const screen = anchor.getAttribute('data-screen');
          if (screen) {
            setActiveFloor(screen);
            suppressFloorTracking = true;
            // Re-enable scroll tracking after animation should be complete
            clearTimeout(window.__floorTimeout);
            window.__floorTimeout = setTimeout(function () {
              suppressFloorTracking = false;
              // Force a fresh update once tracking resumes
              updateFloor();
            }, 800);
          }
        }
      }
    });
  });

  // =============================================================
  // 11b. Service Cards — scroll-triggered expand animation
  //      Cards expand gradually from left to right as the user
  //      scrolls through the section. Click toggle also available.
  // =============================================================

  const serviceGrid = document.getElementById('serviceGrid');
  const serviceCards = document.querySelectorAll('.service-card');
  if (!serviceGrid || serviceCards.length === 0) return;

  // Prepare each card: collapsed state + click toggle
  serviceCards.forEach(function (card) {
    var header = card.querySelector('.service-card__header');
    var body = card.querySelector('.service-card__body');
    var toggleIcon = card.querySelector('.service-card__toggle i');

    if (!header || !body) return;

    // Start collapsed
    body.style.maxHeight = '0px';
    body.style.overflow = 'hidden';
    body.style.transition = 'max-height 0.6s cubic-bezier(0.16, 1, 0.3, 1)';

    function expandCard() {
      body.style.maxHeight = body.scrollHeight + 'px';
      if (toggleIcon) toggleIcon.className = 'ph ph-minus';
    }

    function collapseCard() {
      body.style.maxHeight = '0px';
      if (toggleIcon) toggleIcon.className = 'ph ph-plus';
    }

    // Click toggle
    header.addEventListener('click', function () {
      var isExpanded = body.style.maxHeight !== '0px';
      if (isExpanded) collapseCard(); else expandCard();
    });

    // Store helper on card for scroll-tracker
    card._expand = expandCard;
    card._expanded = false;
  });

  // --- Scroll-progress tracker: expand cards one-by-one as user
  //     scrolls through the section. Card 0 expands first (left),
  //     then card 1 (middle), then card 2 (right). ---
  var cardCount = serviceCards.length;

  function updateScrollExpand() {
    var gridRect = serviceGrid.getBoundingClientRect();
    var viewH = window.innerHeight;

    // How far the grid has scrolled into / past the viewport (0–1)
    var totalDist = gridRect.height + viewH;
    var scrolled = viewH - gridRect.top; // how much has scrolled past top of view
    var progress = Math.max(0, Math.min(1, scrolled / totalDist));

    // Map progress to how many cards should be expanded (0..cardCount)
    var targetCards = Math.min(cardCount, Math.floor(progress * (cardCount + 0.5)));

    for (var i = 0; i < cardCount; i++) {
      var c = serviceCards[i];
      if (!c._expanded && i < targetCards) {
        if (c._expand) c._expand();
        c._expanded = true;
      }
    }
  }

  // Throttled scroll handler for the expand tracker
  var expandTicking = false;
  window.addEventListener('scroll', function () {
    if (!expandTicking) {
      requestAnimationFrame(function () {
        updateScrollExpand();
        expandTicking = false;
      });
      expandTicking = true;
    }
  }, { passive: true });

  // Initial check
  updateScrollExpand();

  // =============================================================
  // 12. Window resize — re-run floor tracking
  // =============================================================

  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      updateFloor();
    }, 200);
  });

  // =============================================================
  // 13. Wallpaper Parallax — structural grid + concrete noise
  //     The grid drifts with scroll at a slower rate (depth cue)
  //     and both layers follow the mouse subtly.
  // =============================================================

  var parallaxGrid = document.querySelector('.structural-grid');
  var parallaxRunning = true;
  var pScrollY = 0;
  var pMouseX = 0.5; // normalised 0-1
  var pMouseY = 0.5;
  var pSmoothScroll = 0;
  var pSmoothMouseX = 0.5;
  var pSmoothMouseY = 0.5;

  function tickParallax(now) {
    if (!parallaxRunning) return;

    // Smooth toward targets
    pSmoothScroll += (pScrollY - pSmoothScroll) * 0.06;
    pSmoothMouseX += (pMouseX - pSmoothMouseX) * 0.08;
    pSmoothMouseY += (pMouseY - pSmoothMouseY) * 0.08;

    // -- Structural grid: translate based on scroll + mouse --
    if (parallaxGrid) {
      var gridDx = (pSmoothMouseX - 0.5) * 20;   // ±10px
      var gridDy = pSmoothScroll * -0.08 + (pSmoothMouseY - 0.5) * 12; // scroll parallax + mouse
      parallaxGrid.style.transform = 'translate3d(' + gridDx.toFixed(1) + 'px, ' + gridDy.toFixed(1) + 'px, 0)';
    }

    // -- Concrete noise: even subtler via background-position --
    var noiseDx = (pSmoothMouseX - 0.5) * 8;    // ±4px
    var noiseDy = pSmoothScroll * -0.04 + (pSmoothMouseY - 0.5) * 6;
    document.documentElement.style.setProperty('--noise-x', noiseDx.toFixed(1) + 'px');
    document.documentElement.style.setProperty('--noise-y', noiseDy.toFixed(1) + 'px');

    requestAnimationFrame(tickParallax);
  }

  function onParallaxScroll() {
    pScrollY = window.scrollY;
  }

  function onParallaxMouse(e) {
    pMouseX = e.clientX / window.innerWidth;
    pMouseY = e.clientY / window.innerHeight;
  }

  function onParallaxMouseLeave() {
    // Drift back to center when mouse leaves
    pMouseX = 0.5;
    pMouseY = 0.5;
  }

  // Only start if the structural grid exists (this page has wallpaper)
  if (parallaxGrid) {
    window.addEventListener('scroll', onParallaxScroll, { passive: true });
    document.addEventListener('mousemove', onParallaxMouse, { passive: true });
    document.addEventListener('mouseleave', onParallaxMouseLeave, { passive: true });

    // Set initial scroll value
    pScrollY = window.scrollY;
    pSmoothScroll = window.scrollY;

    // Start the animation loop
    requestAnimationFrame(tickParallax);
  }

})();