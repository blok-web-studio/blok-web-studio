/* ================================================================
   BLOK. — Structural Engine
   Block assembly, scroll tracking, blueprint toggle, interactions
   ================================================================ */

(function () {
  'use strict';

  // =============================================================
  // 1. Block Assembly — the hero construction animation
  // =============================================================

  const blockCanvas = document.getElementById('blockCanvas');
  let blockCount = 0;
  let blocksLaid = 0;

  if (blockCanvas) {
    // Generate scattered blocks that fly into structural positions
    const blocks = [];
    const numBlocks = 64;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Target region: a structural frame around the hero
    const targetCenterX = vw / 2;
    const targetCenterY = vh / 2 - 40;

    for (let i = 0; i < numBlocks; i++) {
      const block = document.createElement('div');
      block.className = 'assembly-block';

      // Random starting position (scattered across viewport)
      const startX = Math.random() * vw * 1.4 - vw * 0.2;
      const startY = Math.random() * vh * 1.4 - vh * 0.2;
      // Random rotation
      const startR = (Math.random() - 0.5) * 720;

      // Target: arranged in a structural grid around center
      const gridCol = (i % 12) - 6;
      const gridRow = Math.floor(i / 12) - 2;
      const spacing = 52;
      const scatter = 10;
      const targetX = targetCenterX + gridCol * spacing + (Math.random() - 0.5) * scatter;
      const targetY = targetCenterY + gridRow * spacing + (Math.random() - 0.5) * scatter;

      // Random size variation
      const size = 24 + Math.floor(Math.random() * 28);

      block.style.width = size + 'px';
      block.style.height = size + 'px';

      // Some blocks are accent colored
      if (Math.random() < 0.08) {
        block.classList.add('assembly-block--accent');
      }

      // Position at random start
      block.style.left = startX + 'px';
      block.style.top = startY + 'px';
      block.style.transform = 'rotate(' + startR + 'deg)';

      blockCanvas.appendChild(block);
      blocks.push({
        el: block,
        startX: startX,
        startY: startY,
        targetX: targetX,
        targetY: targetY,
        startR: startR,
        placed: false
      });
      blockCount++;
    }

    // Animate blocks in waves
    let blocksPlaced = 0;

    function placeBlock(index) {
      const b = blocks[index];
      if (!b || b.placed) return;
      b.placed = true;

      b.el.classList.add('assembly-block--active');
      b.el.style.left = b.targetX + 'px';
      b.el.style.top = b.targetY + 'px';
      b.el.style.transform = 'rotate(0deg)';
      b.el.style.opacity = '0.5';

      blocksLaid = ++blocksPlaced;
      updateBlockCounter(blocksLaid, blockCount);

      if (blocksPlaced === blockCount) {
        // All blocks placed — finalize
        setTimeout(finalizeAssembly, 400);
      }
    }

    // Staggered placement
    let waveIndex = 0;
    const waveSize = 4;
    const waveInterval = 60; // ms between waves

    function startAssembly() {
      const waveTimer = setInterval(function () {
        for (let i = 0; i < waveSize; i++) {
          if (waveIndex < blocks.length) {
            placeBlock(waveIndex);
            waveIndex++;
          }
        }
        if (waveIndex >= blocks.length) {
          clearInterval(waveTimer);
        }
      }, waveInterval);
    }

    function finalizeAssembly() {
      // Mark some blocks as placed (structural framing)
      blocks.forEach(function (b, i) {
        if (i % 3 === 0) {
          b.el.classList.add('assembly-block--placed');
        }
      });
    }

    // Update the block counter
    function updateBlockCounter(current, total) {
      const el = document.getElementById('blocksLaid');
      const totalEl = document.getElementById('blocksTotal');
      if (el) el.textContent = current;
      if (totalEl) totalEl.textContent = total;
    }

    // Start after a brief delay
    setTimeout(startAssembly, 600);
  }

  // =============================================================
  // 2. Scroll Reveals — Intersection Observer
  // =============================================================

  const revealEls = document.querySelectorAll('[data-reveal]');
  const staggerEls = document.querySelectorAll('[data-reveal-stagger]');

  const revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-block--visible');

        // Animate the left accent bar on philosophy blocks
        if (entry.target.classList.contains('philosophy-block')) {
          entry.target.classList.add('philosophy-block--visible');
        }

        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(function (el) {
    revealObserver.observe(el);
  });

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
  const screenOrder = ['Ground', 'Sub', 'Lobby', 'Mezz', 'Core', 'Upper', 'Roof'];

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

    // Fade block canvas as user scrolls past hero
    const bcEl = document.getElementById('blockCanvas');
    if (bcEl) {
      const hero = document.querySelector('.hero');
      if (hero) {
        const heroBottom = hero.getBoundingClientRect().bottom;
        const fadeProgress = Math.max(0, Math.min(1, (heroBottom - viewportH * 0.3) / (viewportH * 0.5)));
        bcEl.style.opacity = Math.max(0, Math.min(1, fadeProgress));
      }
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

  // Mouse-follow for tension monitor (subtle)
  let mouseY = 0;
  document.addEventListener('mousemove', function (e) {
    mouseY = e.clientY;
    const gaugeTension = document.getElementById('gaugeTension');
    const gaugeLoad = document.getElementById('gaugeLoad');
    const gaugeStress = document.getElementById('gaugeStress');
    const tensionReadout = document.getElementById('tensionReadout');
    if (gaugeTension && gaugeLoad && gaugeStress) {
      const vh = window.innerHeight;
      const mouseProgress = Math.min(1, Math.max(0, mouseY / vh));
      gaugeTension.style.width = (Math.sin(mouseProgress * Math.PI) * 60 + 20) + '%';
      gaugeLoad.style.width = (mouseProgress * 80 + 10) + '%';
      gaugeStress.style.width = (Math.pow(mouseProgress, 1.5) * 70 + 5) + '%';
      if (tensionReadout) tensionReadout.textContent = (Math.sin(mouseProgress * Math.PI * 2) * 2 + 3).toFixed(1);
    }
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
  // 8. Pricing Tower Skyline Animation
  // =============================================================

  const towers = document.querySelectorAll('.pricing-tower');

  const towerObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('pricing-tower--visible');

        // Animate skyline bars with their target heights
        const bars = entry.target.querySelectorAll('.pricing-tower__skyline-bar');
        const heightsAttr = entry.target.querySelector('.pricing-tower__skyline');
        if (heightsAttr) {
          const heights = heightsAttr.getAttribute('data-bars');
          if (heights) {
            const hValues = heights.split(',').map(Number);
            bars.forEach(function (bar, i) {
              if (i < hValues.length) {
                // Delay each bar slightly
                setTimeout(function () {
                  bar.style.setProperty('--h', hValues[i] + 'px');
                  // Force reflow then set height via CSS
                  bar.style.height = hValues[i] + 'px';
                }, i * 80);
              }
            });
          }
        }

        towerObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  towers.forEach(function (tower) {
    towerObserver.observe(tower);
  });

  // =============================================================
  // 9. Process Timeline — Step activation on scroll
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

      if (!name || !email) {
        // Simple validation feedback
        const submitBtn = contactForm.querySelector('.btn');
        submitBtn.textContent = 'Fill required fields first';
        submitBtn.style.borderColor = 'var(--accent)';
        setTimeout(function () {
          submitBtn.innerHTML = 'Send brief <i class="ph ph-arrow-right"></i>';
          submitBtn.style.borderColor = '';
        }, 2000);
        return;
      }

      // Visual "sent" feedback
      const submitBtn = contactForm.querySelector('.btn');
      submitBtn.textContent = 'Brief sent ✓';
      submitBtn.classList.add('btn--accent');
      setTimeout(function () {
        submitBtn.innerHTML = 'Send brief <i class="ph ph-arrow-right"></i>';
        submitBtn.classList.remove('btn--accent');
        contactForm.reset();
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
  // 12. Window resize — reposition blocks
  // =============================================================

  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (blockCanvas && blocks.length > 0) {
        // On resize, recollect positions for blocks that haven't been placed yet
        const newVw = window.innerWidth;
        const newVh = window.innerHeight;
        blocks.forEach(function (b) {
          // Blocks already placed keep their target
          if (!b.placed) {
            // Keep them roughly visible
            b.el.style.left = Math.random() * newVw + 'px';
            b.el.style.top = Math.random() * newVh + 'px';
          }
        });
      }
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