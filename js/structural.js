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
  var heroEl = discContainer ? document.querySelector('.hero') : null;
  // Cached element refs for bounce + overlap checks in RAF loop
  var siEl = document.querySelector('.scroll-indicator');
  var hcEl = document.querySelector('.hero__copy');

  if (discContainer && heroEl) {

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

    // Scale sizes to container — on narrow viewports use smaller blocks
    // so they don't crowd the panel.
    var containerRect = discContainer.getBoundingClientRect();
    var containerW = containerRect.width;
    var containerH = containerRect.height;
    // Size scaling: on narrow viewports we need smaller blocks
    // so the cell‑based layout can find room for all of them.
    var idealMaxCell = Math.sqrt((containerW - 16) * (containerH - 16) / count) * 0.65;
    var sizeScale = Math.min(1, Math.max(0.35, idealMaxCell / 160));

    function pickSize() {
      var raw = SIZES[Math.floor(Math.random() * SIZES.length)];
      return Math.max(50, Math.round(raw * sizeScale));
    }

    // Assign sizes & colours upfront so we can use them in collision detection
    var blockDefs = picked.map(function (d) {
      return {
        label: d.label,
        icon: d.icon,
        size: pickSize(),
        colorKey: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    });

    // --- Pixel‑based position generator with AABB collision avoidance ---

    function shuffle(arr) {
      for (var s = arr.length - 1; s > 0; s--) {
        var j = Math.floor(Math.random() * (s + 1));
        var tmp = arr[s]; arr[s] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function generatePositions(defs, cw, ch) {
      var gap = 10;
      var edgePad = 8;
      var num = defs.length;

      // --- Cell‑based layout (guarantees no overlap) ---
      // Sort by size descending so we place largest first
      var sorted = defs.map(function (d, idx) { return { idx: idx, size: d.size }; });
      sorted.sort(function (a, b) { return b.size - a.size; });

      var positions = new Array(num);

      function tryLayout(rows) {
        var cols = Math.ceil(num / rows);
        var cellW = (cw - edgePad * 2) / cols;
        var cellH = (ch - edgePad * 2) / rows;
        var minDim = Math.min(cellW, cellH);

        // Largest block must fit in a cell
        if (sorted[0].size > minDim - gap) return false;

        // Create shuffled cell list
        var cells = [];
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            if (cells.length < num) cells.push({ row: r, col: c });
          }
        }
        cells = shuffle(cells);

        for (var i = 0; i < sorted.length; i++) {
          var info = sorted[i];
          var cell = cells[i];
          var size = info.size;

          var jitterW = cellW - size - gap;
          var jitterH = cellH - size - gap;
          if (jitterW < 0 || jitterH < 0) return false;

          var px = edgePad + cell.col * cellW + Math.random() * jitterW;
          var py = edgePad + cell.row * cellH + Math.random() * jitterH;

          // Final clamp
          px = Math.max(edgePad, Math.min(cw - size - edgePad, px));
          py = Math.max(edgePad, Math.min(ch - size - edgePad, py));

          positions[info.idx] = {
            x: px / cw * 100,
            y: py / ch * 100,
            px: px, py: py, size: size
          };
        }
        return true;
      }

      // Try every possible row count; more rows = wider columns but shorter rows,
      // so at least one layout should fit when blocks are scaled appropriately.
      var placed = false;
      for (var rows = 1; rows <= num && !placed; rows++) {
        placed = tryLayout(rows);
      }

      // Fallback: scatter with overlap avoidance (for edge cases)
      if (!placed) {
        var zones = shuffle([
          { cx: 22, cy: 12, rx: 12, ry: 7 }, { cx: 52, cy: 10, rx: 14, ry: 7 },
          { cx: 15, cy: 30, rx: 12, ry: 9 }, { cx: 42, cy: 28, rx: 14, ry: 10 },
          { cx: 62, cy: 32, rx: 11, ry: 9 }, { cx: 25, cy: 50, rx: 13, ry: 10 },
          { cx: 50, cy: 52, rx: 14, ry: 11 }, { cx: 18, cy: 70, rx: 11, ry: 9 },
          { cx: 40, cy: 72, rx: 13, ry: 9 }, { cx: 60, cy: 68, rx: 11, ry: 9 },
          { cx: 35, cy: 85, rx: 14, ry: 7 },
        ]);

        for (var i = 0; i < num; i++) {
          positions[i] = positions[i] || null;
          var size = defs[i].size;
          var found = false;
          var attempts = 0;

          while (!found && attempts < 80) {
            var z = zones[Math.floor(Math.random() * zones.length)];
            var px = (z.cx + (Math.random() - 0.5) * 2 * z.rx) / 100 * cw;
            var py = (z.cy + (Math.random() - 0.5) * 2 * z.ry) / 100 * ch;
            px = Math.max(edgePad, Math.min(cw - size - edgePad, px));
            py = Math.max(edgePad, Math.min(ch - size - edgePad, py));

            var ok = true;
            for (var j = 0; j < i && ok; j++) {
              var p = positions[j];
              if (!p) continue;
              if (Math.min(px + size + gap, p.px + p.size + gap) - Math.max(px - gap, p.px - gap) > 0
               && Math.min(py + size + gap, p.py + p.size + gap) - Math.max(py - gap, p.py - gap) > 0) {
                ok = false;
              }
            }
            if (ok) {
              positions[i] = { x: px / cw * 100, y: py / ch * 100, px: px, py: py, size: size };
              found = true;
            }
            attempts++;
          }

          if (!found) {
            // Fine‑grid scan
            var step = 8;
            var scanPlaced = false;
            for (var gy = edgePad; gy < ch - size - edgePad && !scanPlaced; gy += step) {
              for (var gx = edgePad; gx < cw - size - edgePad && !scanPlaced; gx += step) {
                var ok = true;
                for (var k = 0; k < i && ok; k++) {
                  var p = positions[k];
                  if (!p) continue;
                  if (Math.min(gx + size + gap, p.px + p.size + gap) - Math.max(gx - gap, p.px - gap) > 0
                   && Math.min(gy + size + gap, p.py + p.size + gap) - Math.max(gy - gap, p.py - gap) > 0) {
                    ok = false;
                  }
                }
                if (ok) {
                  positions[i] = { x: gx / cw * 100, y: gy / ch * 100, px: gx, py: gy, size: size };
                  scanPlaced = true;
                }
              }
            }
            if (!scanPlaced) {
              // Last resort — just pin it
              positions[i] = {
                x: (edgePad + (i * 47) % (cw - size - edgePad * 2)) / cw * 100,
                y: (edgePad + (i * 31) % (ch - size - edgePad * 2)) / ch * 100,
                px: edgePad + (i * 47) % (cw - size - edgePad * 2),
                py: edgePad + (i * 31) % (ch - size - edgePad * 2),
                size: size
              };
            }
          }
        }
      }

      return positions;
    }

    var positions = generatePositions(blockDefs, containerW, containerH);

    // --- Random entrance delays ---
    var delays = [];
    for (var d = 0; d < count; d++) {
      delays.push(Math.random() * 0.7);
    }

    // --- Create blocks + float state ---
    var floatStates = [];
    var blocks = [];

    blockDefs.forEach(function (d, i) {
      var colorClass = COLOR_CLASSES[d.colorKey];
      var pos = positions[i];

      var el = document.createElement('div');
      el.className = 'disc-block ' + colorClass;
      el.style.width = d.size + 'px';
      el.style.height = d.size + 'px';
      // Convert from .hero__disciplines‑relative to .hero‑relative coords
      // .hero__disciplines = 48% width starting at 52% from hero left
      el.style.left = (52 + pos.x * 0.48) + '%';
      el.style.top = pos.y + '%';
      el.style.zIndex = '100';
      el.style.animationDelay = delays[i] + 's';
      el.setAttribute('data-index', i);

      el.innerHTML =
        '<div class="disc-block__icon"><i class="ph ' + d.icon + '"></i></div>' +
        '<span class="disc-block__label">' + d.label + '</span>';

      heroEl.appendChild(el);
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
        // Heavy drag physics — spring toward target with damping
        smoothX: 0,
        smoothY: 0,
        targetX: 0,
        targetY: 0,
        velX: 0,
        velY: 0,
        isDragging: false,
        dragTilt: 0,                         // rotation tilt during drag
        // Proximity reaction — repel + scale near cursor
        repelX: 0,
        repelY: 0,
        proxScale: 1,
        // Text overlap → semi‑transparent
        overlapOpacity: 1,
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

        // 1. Float oscillation — pause while dragging so block follows cursor cleanly
        var floatY = fs.isDragging ? 0 : Math.sin(t * (Math.PI * 2 / fs.dur) + fs.phaseY) * fs.ampY;
        var floatX = fs.isDragging ? 0 : Math.sin(t * (Math.PI * 2 / (fs.dur * 0.7)) + fs.phaseX) * fs.ampX;
        var floatR = fs.isDragging ? 0 : Math.sin(t * (Math.PI * 2 / (fs.dur * 1.2)) + fs.phaseR) * fs.ampR;

        // 2. Smooth heavy drag — spring toward target with damping
        if (fs.isDragging) {
          var springK = 0.12;
          var damping = 0.70;
          fs.velX += (fs.targetX - fs.smoothX) * springK;
          fs.velY += (fs.targetY - fs.smoothY) * springK;
          fs.velX *= damping;
          fs.velY *= damping;
          fs.smoothX += fs.velX;
          fs.smoothY += fs.velY;

          // Tilt slightly toward movement direction
          var targetTilt = Math.min(6, Math.abs(fs.velX) * 0.3);
          fs.dragTilt += (targetTilt - fs.dragTilt) * 0.15;
        } else {
          // Throw friction — coasts to a stop after release
          fs.velX *= 0.88;
          fs.velY *= 0.88;
          fs.smoothX += fs.velX;
          fs.smoothY += fs.velY;
          fs.dragTilt *= 0.88;

          if (Math.abs(fs.velX) < 0.01 && Math.abs(fs.velY) < 0.01) {
            fs.velX = 0;
            fs.velY = 0;
          }
        }

        // 3. Proximity reaction — repel + scale when mouse is near
        if (!fs.isDragging && mouseX >= 0) {
          var rect = fs.el.getBoundingClientRect();
          var cx = rect.left + rect.width / 2;
          var cy = rect.top + rect.height / 2;
          var dx = mouseX - cx;
          var dy = mouseY - cy;
          var dist = Math.sqrt(dx * dx + dy * dy);
          var radius = Math.max(rect.width, rect.height) * 2.5;

          if (dist < radius) {
            var force = (1 - dist / radius) * 15;
            var angle = Math.atan2(dy, dx);
            fs.repelX += (Math.cos(angle) * force - fs.repelX) * 0.1;
            fs.repelY += (Math.sin(angle) * force - fs.repelY) * 0.1;
            fs.proxScale += (1.1 - fs.proxScale) * 0.06;
          } else {
            fs.repelX *= 0.9;
            fs.repelY *= 0.9;
            fs.proxScale += (1 - fs.proxScale) * 0.06;
          }
        } else {
          fs.repelX *= 0.9;
          fs.repelY *= 0.9;
          fs.proxScale += (1 - fs.proxScale) * 0.06;
        }

        // Compute combined transform values
        var totalX = floatX + fs.parallaxX + fs.smoothX + fs.repelX;
        var totalY = floatY + fs.parallaxY + fs.smoothY + fs.repelY;
        var totalR = floatR + fs.dragTilt;

        // Block position helpers (shared by bounce + overlap checks)
        var hRect = heroEl.getBoundingClientRect();
        var eL = fs.el.offsetLeft;
        var eT = fs.el.offsetTop;
        var eW = fs.el.offsetWidth;
        var eH = fs.el.offsetHeight;
        var vpL = hRect.left + eL + totalX;
        var vpT = hRect.top + eT + totalY;

        // 4. Bounce off viewport edges + scroll indicator (only when actively thrown/dragged)
        var hasMomentum = fs.isDragging || Math.abs(fs.velX) > 0.5 || Math.abs(fs.velY) > 0.5;
        if (hasMomentum) {
          var bm = 15;

          // Hero‑container edges (blocks stay inside .hero at all times)
          if (vpL < hRect.left + bm) {
            var push = (hRect.left + bm) - vpL;
            fs.smoothX += push; totalX += push;
            fs.velX = Math.abs(fs.velX) * 0.45;
          }
          if (vpL + eW > hRect.right - bm) {
            var push = (vpL + eW) - (hRect.right - bm);
            fs.smoothX -= push; totalX -= push;
            fs.velX = -Math.abs(fs.velX) * 0.45;
          }
          if (vpT < hRect.top + bm) {
            var push = (hRect.top + bm) - vpT;
            fs.smoothY += push; totalY += push;
            fs.velY = Math.abs(fs.velY) * 0.45;
          }
          if (vpT + eH > hRect.bottom - bm) {
            var push = (vpT + eH) - (hRect.bottom - bm);
            fs.smoothY -= push; totalY -= push;
            fs.velY = -Math.abs(fs.velY) * 0.45;
          }

          // Scroll‑indicator floor obstacle (bounce up off its top edge)
          if (siEl) {
            var siRect = siEl.getBoundingClientRect();
            var overlapX = vpL + eW > siRect.left + 10 && vpL < siRect.right - 10;
            if (overlapX && vpT + eH > siRect.top) {
              var pushUp = (vpT + eH) - siRect.top;
              fs.smoothY -= pushUp; totalY -= pushUp;
              fs.velY = -Math.abs(fs.velY) * 0.45;
            }
          }
        }

        // 5. Hero‑text overlap → semi‑transparent
        if (hcEl) {
          var hcRect = hcEl.getBoundingClientRect();
          var overlapping = vpL + eW > hcRect.left && vpL < hcRect.right &&
                           vpT + eH > hcRect.top && vpT < hcRect.bottom;
          var targetOp = overlapping ? 0.4 : 1;
          fs.overlapOpacity += (targetOp - fs.overlapOpacity) * 0.08;
          fs.el.style.opacity = fs.overlapOpacity.toFixed(2);
        }

        // 6. Apply combined transform
        fs.el.style.transform =
          'translate3d(' + totalX.toFixed(1) + 'px, ' + totalY.toFixed(1) + 'px, 0) ' +
          'rotate(' + totalR.toFixed(1) + 'deg) ' +
          'scale(' + fs.proxScale.toFixed(3) + ')';
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

    // --- Global mouse position for proximity ---
    var mouseX = -1000;
    var mouseY = -1000;

    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      mouseX = -1000;
      mouseY = -1000;
    }, { passive: true });

    // --- Pointer-event drag with heavy physics ---
    var dragState = null;

    function onPointerDown(e) {
      var block = e.currentTarget;
      var idx = parseInt(block.getAttribute('data-index'), 10);
      var fs = floatStates[idx];
      if (!fs) return;

      fs.isDragging = true;
      fs.el.style.zIndex = 50;
      fs.el.style.cursor = 'grabbing';

      // Carry current smooth position as the drag base so there's no jump
      dragState = {
        fs: fs,
        startX: e.clientX,
        startY: e.clientY,
        origX: fs.smoothX,
        origY: fs.smoothY,
      };

      // Dampen existing velocity so the block starts heavy, not whipping
      fs.velX *= 0.4;
      fs.velY *= 0.4;

      block.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      // Always update global mouse for proximity
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!dragState) return;
      var fs = dragState.fs;
      // Target is where the cursor wants the block to be
      fs.targetX = dragState.origX + (e.clientX - dragState.startX);
      fs.targetY = dragState.origY + (e.clientY - dragState.startY);
    }

    function onPointerUp() {
      if (!dragState) return;
      var fs = dragState.fs;
      fs.isDragging = false;
      fs.el.style.zIndex = '100';
      fs.el.style.cursor = 'grab';
      // velX/velY carry on with friction → throw momentum on release
      dragState = null;
    }

    for (var b = 0; b < blocks.length; b++) {
      blocks[b].addEventListener('pointerdown', onPointerDown);
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);

    // --- Kick off float after entrance animation completes ---
    setTimeout(function () {
      // Remove animation so inline transform stops being overridden
      for (var b = 0; b < blocks.length; b++) {
        blocks[b].style.animation = 'none';
        blocks[b].style.opacity = '1';
      }
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

  }

  // ── Build crane — footer pendulum swing + mouse follow ──
  const FLOORS = ['Ground', 'Lobby', 'Mezz', 'Core', 'Upper', 'Roof'];
  let craneAnimId = null;
  let craneUserActive = false;

  function getCranePx(idx) {
    return (idx / (FLOORS.length - 1)) * 68 + 8;
  }

  function setCrane(idx) {
    var cable = document.getElementById('craneCable');
    var hook = document.getElementById('craneHook');
    var floorEl = document.getElementById('craneFloor');
    var countEl = document.getElementById('craneCount');
    var buildingEl = document.getElementById('craneBuilding');
    var groundEl = document.getElementById('craneGround');
    if (!cable) return;

    var px = getCranePx(idx);
    cable.style.left = px + 'px';
    hook.style.left = px + 'px';

    // Render blocks — active one in the building, rest on the ground
    if (buildingEl && groundEl) {
      var bHTML = '', gHTML = '';
      for (var i = 0; i < FLOORS.length; i++) {
        var cls = 'crane-block' + (i === idx ? ' crane-block--current' : ' crane-block--ground');
        var blk = '<div class="' + cls + '"></div>';
        if (i === idx) bHTML = blk + bHTML; else gHTML += blk;
      }
      buildingEl.innerHTML = bHTML;
      groundEl.innerHTML = gHTML;
    }

    if (floorEl) floorEl.textContent = FLOORS[idx];
    if (countEl) countEl.textContent = (idx + 1) + ' / ' + FLOORS.length;
  }

  // Idle pendulum: hook swings left↔right on a slow sine loop (7s cycle)
  function startCraneSwing() {
    if (craneAnimId) cancelAnimationFrame(craneAnimId);
    var start = Date.now();
    function tick() {
      if (craneUserActive) { craneAnimId = requestAnimationFrame(tick); return; }
      var t = (Date.now() - start) / 7000;
      var swing = (Math.sin(t * Math.PI * 2) + 1) / 2;
      setCrane(Math.round(swing * (FLOORS.length - 1)));
      craneAnimId = requestAnimationFrame(tick);
    }
    tick();
  }

  // Mouse follow: when you hover the footer crane, the hook tracks your cursor
  var craneEl = document.querySelector('.crane-monitor');
  if (craneEl) {
    craneEl.addEventListener('mouseenter', function () { craneUserActive = true; });
    craneEl.addEventListener('mousemove', function (e) {
      var rect = craneEl.getBoundingClientRect();
      var relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setCrane(Math.round(relX * (FLOORS.length - 1)));
    });
    craneEl.addEventListener('mouseleave', function () { craneUserActive = false; });
  }

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
    startCraneSwing();
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
  // 10. Contact Form — Enhanced Brief Sender
  // =============================================================

  var BLOK = window.BLOK || {};

  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    var formStep1 = document.getElementById('formStep1');
    var formStep2 = document.getElementById('formStep2');
    var formSuccess = document.getElementById('formSuccess');
    var formNextBtn = document.getElementById('formNextBtn');
    var formBackBtn = document.getElementById('formBackBtn');
    var formSubmitBtn = document.getElementById('formSubmitBtn');
    var formStepIndicator = document.getElementById('formStep');
    var currentStep = 1;

    // ── Char counter ────────────────────────────────────────────
    var messageField = document.getElementById('message');
    var charCount = document.getElementById('charCount');
    if (messageField && charCount) {
      messageField.addEventListener('input', function () {
        var len = messageField.value.length;
        charCount.textContent = len + ' / 2000';
        charCount.style.color = len > 1800 ? 'var(--accent)' : '';
      });
    }

    // ── Inline validation helper ────────────────────────────────
    function validateField(id, condition, errorMsg) {
      var field = document.getElementById(id);
      var errorEl = document.getElementById(id + 'Error');
      if (!field) return true;
      var valid = condition(field);
      field.style.borderColor = valid ? '' : 'var(--accent)';
      if (errorEl) {
        errorEl.textContent = valid ? '' : errorMsg;
        errorEl.style.display = valid ? 'none' : 'block';
      }
      return valid;
    }

    function clearFieldError(id) {
      var field = document.getElementById(id);
      var errorEl = document.getElementById(id + 'Error');
      if (field) field.style.borderColor = '';
      if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
    }

    // ── Live validation on blur ──────────────────────────────────
    var nameField = document.getElementById('name');
    var emailField = document.getElementById('email');
    if (nameField) {
      nameField.addEventListener('blur', function () {
        if (nameField.value.trim()) clearFieldError('name');
      });
    }
    if (emailField) {
      emailField.addEventListener('blur', function () {
        if (emailField.value.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value.trim())) {
          clearFieldError('email');
        }
      });
    }

    // ── Step navigation ──────────────────────────────────────────
    function goToStep(step) {
      currentStep = step;
      formStep1.style.display = step === 1 ? 'block' : 'none';
      formStep2.style.display = step === 2 ? 'block' : 'none';
      formNextBtn.style.display = step === 1 ? 'inline-flex' : 'none';
      formBackBtn.style.display = step === 2 ? 'inline-flex' : 'none';
      formSubmitBtn.style.display = step === 2 ? 'inline-flex' : 'none';
      if (formStepIndicator) formStepIndicator.textContent = step + ' / 2';
    }

    // ── Next button ──────────────────────────────────────────────
    if (formNextBtn) {
      formNextBtn.addEventListener('click', function () {
        var valid = true;

        // Validate step 1 fields
        valid = validateField('name', function (f) { return f.value.trim().length >= 2; }, 'Please enter your name (at least 2 characters)') && valid;
        valid = validateField('email', function (f) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim());
        }, 'Please enter a valid email address') && valid;

        if (valid) {
          goToStep(2);
          // Focus message field after transition
          setTimeout(function () { if (messageField) messageField.focus(); }, 100);
        }
      });
    }

    // ── Back button ──────────────────────────────────────────────
    if (formBackBtn) {
      formBackBtn.addEventListener('click', function () {
        goToStep(1);
      });
    }

    // ── Form submit ──────────────────────────────────────────────
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = (document.getElementById('name') || {}).value;
      var email = (document.getElementById('email') || {}).value;
      var company = (document.getElementById('company') || {}).value;
      var phone = (document.getElementById('phone') || {}).value;
      var budget = (document.getElementById('budget') || {}).value;
      var timeline = (document.getElementById('timeline') || {}).value;
      var message = (document.getElementById('message') || {}).value;

      name = (name || '').trim();
      email = (email || '').trim();
      company = (company || '').trim();
      phone = (phone || '').trim();
      message = (message || '').trim();

      // Collect selected services
      var serviceCheckboxes = document.querySelectorAll('input[name="services"]:checked');
      var services = Array.from(serviceCheckboxes).map(function (cb) { return cb.value; });

      // Validate final step
      var valid = true;
      valid = validateField('budget', function (f) { return f.value !== ''; }, 'Please select a budget range') && valid;
      valid = validateField('message', function (f) { return f.value.trim().length >= 10; }, 'Please tell us a bit more about your project (at least 10 characters)') && valid;

      if (!valid) return;

      // ── Show loading state ──────────────────────────────────────
      var submitBtn = formSubmitBtn;
      var btnText = submitBtn.querySelector('.btn__text');
      var btnSpinner = submitBtn.querySelector('.btn__spinner');
      var btnIcon = submitBtn.querySelector('.btn__icon');
      submitBtn.disabled = true;
      if (btnText) btnText.textContent = 'Sending…';
      if (btnSpinner) btnSpinner.style.display = 'inline';
      if (btnIcon) btnIcon.style.display = 'none';

      var payload = {
        name: name,
        email: email,
        company: company,
        phone: phone,
        budget: budget || 'not-selected',
        timeline: timeline || '',
        services: services,
        message: message
      };

      // ── Send to Netlify Function ─────────────────────────────
      function submitToAPI() {
        var apiBase = '/api';
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          apiBase = 'http://localhost:8888/api';
        }
        return fetch(apiBase + '/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (r) { return r.json(); });
      }

      // ── Save to localStorage (fallback) ──────────────────────
      function saveLocal() {
        try {
          var _leads = JSON.parse(localStorage.getItem('blok_admin_leads')) || [];
          _leads.unshift({
            id: 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            name: name,
            email: email,
            company: company,
            phone: phone,
            budget: budget || 'not-selected',
            timeline: timeline || '',
            services: services,
            message: message,
            status: 'new',
            createdAt: new Date().toISOString()
          });
          localStorage.setItem('blok_admin_leads', JSON.stringify(_leads));
        } catch (_e) { /* localStorage unavailable — non-critical */ }
      }

      // ── Execute ──────────────────────────────────────────────
      submitToAPI().then(function (res) {
        if (res && res.lead) {
          // API succeeded — data is stored server-side
        }
        // Also save locally as backup
        saveLocal();
        showSuccess(name, email);
      }).catch(function () {
        // API unavailable — fall back to local
        saveLocal();
        showSuccess(name, email);
      });
    });

    // ── Success state ──────────────────────────────────────────
    function showSuccess(name, email) {
      contactForm.style.display = 'none';
      formSuccess.style.display = 'block';
      var successName = document.getElementById('successName');
      var successEmail = document.getElementById('successEmail');
      if (successName) successName.textContent = name;
      if (successEmail) successEmail.textContent = email;
    }

    // ── Reset form (exposed global) ────────────────────────────
    BLOK.resetForm = function () {
      contactForm.reset();
      contactForm.style.display = 'block';
      formSuccess.style.display = 'none';
      goToStep(1);
      // Clear all error states
      ['name', 'email', 'company', 'phone', 'budget', 'message'].forEach(function (id) {
        clearFieldError(id);
        var field = document.getElementById(id);
        if (field) field.style.borderColor = '';
      });
      // Reset char count
      if (charCount) {
        charCount.textContent = '0 / 2000';
        charCount.style.color = '';
      }
      // Reset submit button
      if (formSubmitBtn) {
        formSubmitBtn.disabled = false;
        var btnText = formSubmitBtn.querySelector('.btn__text');
        var btnSpinner = formSubmitBtn.querySelector('.btn__spinner');
        var btnIcon = formSubmitBtn.querySelector('.btn__icon');
        if (btnText) btnText.textContent = 'Send brief';
        if (btnSpinner) btnSpinner.style.display = 'none';
        if (btnIcon) btnIcon.style.display = 'inline';
      }
    };

    window.BLOK = BLOK;
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
    body.style.transition = 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1)';

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
    // Thresholds: card 0 at 20%, card 1 at 35%, card 2 at 50%
    var thresholds = [0.20, 0.35, 0.50];
    var targetCards = 0;
    while (targetCards < cardCount && progress >= thresholds[targetCards]) targetCards++;

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

  var parallaxRunning = true;
  var pScrollY = 0;
  var pMouseX = 0.5; // normalised 0-1
  var pMouseY = 0.5;
  var pSmoothScroll = 0;
  var pSmoothMouseX = 0.5;
  var pSmoothMouseY = 0.5;

  function tickParallax() {
    if (!parallaxRunning) return;

    // Smooth toward targets
    pSmoothScroll += (pScrollY - pSmoothScroll) * 0.06;
    pSmoothMouseX += (pMouseX - pSmoothMouseX) * 0.08;
    pSmoothMouseY += (pMouseY - pSmoothMouseY) * 0.08;

    // -- Structural grid: parallax via background-position CSS custom properties --
    var gridDx = (pSmoothMouseX - 0.5) * 20;   // ±10px mouse drift
    var gridDy = pSmoothScroll * -0.08 + (pSmoothMouseY - 0.5) * 12; // scroll parallax + mouse
    document.body.style.setProperty('--grid-x', gridDx.toFixed(1) + 'px');
    document.body.style.setProperty('--grid-y', gridDy.toFixed(1) + 'px');

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

  window.addEventListener('scroll', onParallaxScroll, { passive: true });
  document.addEventListener('mousemove', onParallaxMouse, { passive: true });
  document.addEventListener('mouseleave', onParallaxMouseLeave, { passive: true });

  // Set initial scroll value
  pScrollY = window.scrollY;
  pSmoothScroll = window.scrollY;

  // Start the animation loop
  requestAnimationFrame(tickParallax);

})();