/* ================================================================
   BLOK. — Main Script
   Navigation, scroll reveals, dark mode, counters, filters,
   pricing toggle, hero interactions, and cursor effects.
   ================================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ---- Navigation ---- */
  const nav = document.querySelector('.nav');
  const mobileToggle = document.querySelector('.nav__mobile-toggle');
  const navLinks = document.querySelector('.nav__links');
  const navLinkEls = document.querySelectorAll('.nav__link');

  // Mobile menu toggle
  if (mobileToggle) {
    mobileToggle.addEventListener('click', function () {
      navLinks.classList.toggle('nav__links--open');
    });
  }

  // Close mobile menu on link click
  navLinkEls.forEach(function (link) {
    link.addEventListener('click', function () {
      if (navLinks) navLinks.classList.remove('nav__links--open');
    });
  });

  // Nav background opacity on scroll
  function updateNav() {
    if (!nav) return;
    if (window.scrollY > 50) {
      nav.style.borderBottom = '2px solid rgba(242, 237, 231, 0.15)';
    } else {
      nav.style.borderBottom = '2px solid rgba(242, 237, 231, 0.1)';
    }

    // Active nav link based on scroll position
    var sections = document.querySelectorAll('section[id]');
    var scrollPos = window.scrollY + 150;

    sections.forEach(function (section) {
      var top = section.offsetTop;
      var height = section.offsetHeight;
      var id = section.getAttribute('id');

      navLinkEls.forEach(function (link) {
        link.classList.remove('nav__link--active');
        if (link.getAttribute('href') === '#' + id) {
          if (scrollPos >= top && scrollPos < top + height) {
            link.classList.add('nav__link--active');
          }
        }
      });
    });
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  /* ---- Scroll Reveal (Intersection Observer) ---- */
  var revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger-children');

  if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    // Fallback: show all immediately
    revealElements.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  /* ---- Dark/Light Mode Toggle ---- */
  var themeToggle = document.querySelector('.theme-toggle');

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('blok-theme', theme);

    if (themeToggle) {
      var icon = themeToggle.querySelector('i');
      if (icon) {
        icon.className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
      }
    }
  }

  // Restore saved theme
  var savedTheme = localStorage.getItem('blok-theme');
  if (savedTheme) {
    setTheme(savedTheme);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  /* ---- Portfolio Filters ---- */
  var filterBtns = document.querySelectorAll('.portfolio-filter');
  var portfolioItems = document.querySelectorAll('.portfolio-item');

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var filter = this.getAttribute('data-filter');

      filterBtns.forEach(function (b) {
        b.classList.remove('portfolio-filter--active');
      });
      this.classList.add('portfolio-filter--active');

      portfolioItems.forEach(function (item) {
        if (filter === 'all' || item.getAttribute('data-category') === filter) {
          item.style.display = 'block';
          item.style.opacity = '0';
          requestAnimationFrame(function () {
            item.style.transition = 'opacity 0.3s ease-out';
            item.style.opacity = '1';
          });
        } else {
          item.style.opacity = '0';
          setTimeout(function () {
            item.style.display = 'none';
          }, 300);
        }
      });
    });
  });

  /* ---- Pricing Toggle ---- */
  var pricingBtns = document.querySelectorAll('.pricing-toggle__btn');
  var pricingPrices = document.querySelectorAll('.pricing-card__price');

  pricingBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var period = this.getAttribute('data-period');

      pricingBtns.forEach(function (b) {
        b.classList.remove('pricing-toggle__btn--active');
      });
      this.classList.add('pricing-toggle__btn--active');

      // Update period text
      document.querySelectorAll('.pricing-card__period').forEach(function (el) {
        el.textContent = period === 'monthly' ? 'per month' : 'per year';
      });

      // Animate prices
      pricingPrices.forEach(function (el) {
        var monthly = parseInt(el.getAttribute('data-monthly'), 10);
        var yearly = parseInt(el.getAttribute('data-yearly'), 10);
        var target = period === 'monthly' ? monthly : yearly;

        el.style.opacity = '0';
        setTimeout(function () {
          el.textContent = '$' + (target).toLocaleString();
          el.style.opacity = '1';
          el.style.transition = 'opacity 0.2s ease-out';
        }, 150);
      });
    });
  });

  /* ---- Hero Canvas Blocks (Parallax) ---- */
  var heroBlocks = document.querySelectorAll('.hero__block');

  if (heroBlocks.length > 0) {
    document.querySelector('.hero').addEventListener('mousemove', function (e) {
      var rect = this.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;

      heroBlocks.forEach(function (block) {
        var speed = parseFloat(block.getAttribute('data-speed') || '20');
        var moveX = x * speed;
        var moveY = y * speed;
        block.style.transform = 'translate3d(' + moveX + 'px, ' + moveY + 'px, 0)';
      });
    });
  }

  /* ---- "Start a project" / Contact Reveal ---- */
  var contactSection = document.getElementById('contact');

  function revealContactAndScroll(e) {
    if (!contactSection) return;

    // Only handle links pointing to #contact
    var href = this.getAttribute('href');
    if (href !== '#contact') return;

    e.preventDefault();

    // Reveal the contact section if hidden
    if (contactSection.classList.contains('contact--hidden')) {
      contactSection.classList.remove('contact--hidden');
      contactSection.classList.add('contact--visible');
      // Re-trigger scroll reveals for contact
      var revealChildren = contactSection.querySelectorAll('.reveal, .reveal-left, .reveal-right');
      setTimeout(function () {
        revealChildren.forEach(function (el) {
          el.classList.add('is-visible');
        });
      }, 100);
    }

    // Scroll down to contact
    var offset = 80;
    var top = contactSection.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  // Attach to all "Start a project" buttons and nav links pointing to #contact
  document.querySelectorAll('a[href="#contact"]').forEach(function (link) {
    link.addEventListener('click', revealContactAndScroll);
  });

  /* ---- Smooth Scroll for Navigation Links (non-contact) ---- */
  navLinkEls.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = this.getAttribute('href');
      if (!target || !target.startsWith('#') || target === '#contact') return;
      e.preventDefault();
      var el = document.querySelector(target);
      if (el) {
        var offset = 80;
        var top = el.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  /* ---- Contact Form ---- */
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      alert("Thanks — we'll be in touch within 24 hours.");
      contactForm.reset();
    });
  }
});
