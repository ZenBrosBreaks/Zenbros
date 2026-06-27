/* ============================================================
   Zen Bros Breaks — UI Controller
   ------------------------------------------------------------
   Manages overlays (mobile drawer, cart) through a single state
   so two overlays can never be open at once and transitions
   stay smooth. Cached DOM refs, single source of truth via
   body[data-overlay].
   ============================================================ */
(function () {
  'use strict';

  // --- DOM refs (cached once) ---
  var $body   = document.body;
  var $html   = document.documentElement;
  var $drawer = document.getElementById('drawer');
  var $scrim  = document.getElementById('scrim');
  var $ham    = document.getElementById('ham');
  var $drawerClose = document.getElementById('drawerClose');
  var $year   = document.getElementById('year');

  // --- Year stamp ---
  if ($year) $year.textContent = new Date().getFullYear();

  // --- Overlay state machine ---
  // States: 'none' | 'drawer' | 'cart'
  var current = 'none';
  var listeners = [];

  function setOverlay(next) {
    if (current === next) return;
    current = next;
    $body.setAttribute('data-overlay', next);
    var locked = next !== 'none';
    $body.style.overflow = locked ? 'hidden' : '';

    // Drawer
    if ($drawer) {
      var drawerOpen = next === 'drawer';
      $drawer.classList.toggle('open', drawerOpen);
      $drawer.setAttribute('aria-hidden', drawerOpen ? 'false' : 'true');
    }
    if ($ham) $ham.setAttribute('aria-expanded', next === 'drawer' ? 'true' : 'false');
    // Scrim visibility is driven by body[data-overlay] — no class toggle needed

    // Notify subscribers (shopify.js listens for cart open/close)
    listeners.forEach(function (fn) { try { fn(next); } catch (e) {} });
  }

  // --- Public API ---
  window.ZenUI = {
    openDrawer:  function () { setOverlay('drawer'); },
    openCart:    function () { setOverlay('cart'); },
    closeAll:    function () { setOverlay('none'); },
    state:       function () { return current; },
    onChange:    function (fn) { listeners.push(fn); }
  };

  // --- Wire interactions ---
  if ($ham) {
    $ham.addEventListener('click', function () {
      setOverlay(current === 'drawer' ? 'none' : 'drawer');
    });
  }
  if ($drawerClose) $drawerClose.addEventListener('click', function () { setOverlay('none'); });
  if ($scrim)       $scrim.addEventListener('click',       function () { setOverlay('none'); });

  // Any link inside the drawer closes it (navigation will follow)
  if ($drawer) {
    $drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setOverlay('none'); });
    });
  }

  // ESC closes any open overlay
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current !== 'none') setOverlay('none');
  });

  // --- Datetime auto-conversion to viewer's timezone ---
  // Any element with data-datetime="<ISO 8601>" is reformatted to local time.
  (function () {
    var els = document.querySelectorAll('[data-datetime]');
    if (!els.length || typeof Intl === 'undefined' || !Intl.DateTimeFormat) return;
    var fmt = new Intl.DateTimeFormat(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZoneName: 'short'
    });
    els.forEach(function (el) {
      var iso = el.getAttribute('data-datetime');
      if (!iso) return;
      var d = new Date(iso);
      if (isNaN(d.getTime())) return;
      // "Fri, May 29, 5:00 PM PDT"  →  "FRI · MAY 29 · 5:00 PM PDT"
      var parts = fmt.formatToParts(d);
      var pick = function (type) {
        var p = parts.find(function (x) { return x.type === type; });
        return p ? p.value : '';
      };
      var weekday = pick('weekday').toUpperCase();
      var month   = pick('month').toUpperCase();
      var day     = pick('day');
      var hour    = pick('hour');
      var minute  = pick('minute');
      var dayPer  = pick('dayPeriod');
      var tz      = pick('timeZoneName');
      el.textContent = weekday + ' · ' + month + ' ' + day + ' · ' + hour + ':' + minute + ' ' + dayPer + (tz ? ' ' + tz : '');
    });
  })();

  // --- Filter + search ----------------------------------------
  (function () {
    var $chips    = document.querySelectorAll('.chip');
    var $search   = document.getElementById('searchInput');
    var $cards    = document.querySelectorAll('.card[data-cat]');
    var $empty    = document.getElementById('filterEmpty');
    if (!$cards.length) return;

    var activeFilter = 'all';
    var query = '';

    function apply() {
      var q = query.trim().toLowerCase();
      var anyShown = false;
      $cards.forEach(function (card) {
        var cat = card.getAttribute('data-cat') || '';
        var hay = card.textContent.toLowerCase();
        var matchCat = activeFilter === 'all' || cat === activeFilter;
        var matchTxt = !q || hay.indexOf(q) !== -1;
        var show = matchCat && matchTxt;
        card.classList.toggle('is-hidden', !show);
        if (show) anyShown = true;
      });
      if ($empty) $empty.hidden = anyShown;
    }

    $chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        $chips.forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        activeFilter = chip.getAttribute('data-filter') || 'all';
        apply();
      });
    });

    if ($search) {
      var debounce;
      $search.addEventListener('input', function (e) {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          query = e.target.value || '';
          apply();
        }, 120);
      });
    }
  })();

  // --- Sticky nav scroll state (passive for smoothness) ---
  var $nav = document.querySelector('.nav');
  if ($nav) {
    var ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(function () {
          $nav.classList.toggle('scrolled', window.scrollY > 8);
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // --- Promo banner signup (Netlify Forms) → email-only code delivery ---
  // Welcome email is sent by netlify/functions/submission-created.js via
  // Resend. The page does NOT show the code anywhere — gates on real email.
  (function () {
    // Returning visitors already have <html class="zen-joined"> set by the
    // inline script in <head>; CSS hides the banner, no JS needed.
    if (document.documentElement.classList.contains('zen-joined')) return;

    var form = document.getElementById('joinForm');
    if (!form) return;
    var promo   = document.querySelector('.promo');
    var done    = document.getElementById('joinDone');
    var emailEl = document.getElementById('joinEmail');
    var btn     = document.getElementById('joinBtn');
    var closeBtn= document.getElementById('joinClose');
    var isLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
    var STORE   = 'zenbros:joined';

    function flashError() {
      emailEl.style.borderColor = '#ff8f86';
      emailEl.style.boxShadow   = '0 0 0 3px rgba(255,143,134,.18)';
      setTimeout(function () {
        emailEl.style.borderColor = '';
        emailEl.style.boxShadow   = '';
      }, 1800);
    }

    function dismissBanner() {
      if (!promo) return;
      // Lock in the current height as the transition start, otherwise the
      // max-height collapse jumps (no animatable starting value).
      var h = promo.getBoundingClientRect().height;
      promo.style.maxHeight = h + 'px';
      // Force a reflow so the explicit start value is committed before the
      // class toggle triggers the transition to 0.
      // eslint-disable-next-line no-unused-expressions
      promo.offsetHeight;
      promo.classList.add('is-dismissing');
      setTimeout(function () { promo.style.display = 'none'; }, 520);
    }

    // X close — manually dismiss without signing up
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        try { localStorage.setItem(STORE, '1'); } catch (e) {}
        dismissBanner();
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (emailEl.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailEl.focus();
        flashError();
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      function ok() {
        try { localStorage.setItem(STORE, '1'); } catch (e) {}
        form.hidden = true;
        if (done) done.hidden = false;
        // Show "Sent" long enough to be read, then fade the whole banner away.
        setTimeout(dismissBanner, 3200);
      }
      function fail() {
        if (btn) { btn.disabled = false; btn.textContent = 'Get my code'; }
        flashError();
      }

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      })
        .then(function (r) { ((r && r.ok) || isLocal) ? ok() : fail(); })
        .catch(function () { isLocal ? ok() : fail(); });
    });
  })();

  // --- Service-page inquiry forms (Netlify Forms) ---
  // Shared handler: lending & shipping inquiries follow the same pattern.
  // Each lands in Netlify Forms under its own form name; add a notification
  // on each form in Netlify to get pinged per lead.
  function wireServiceForm(formId, doneId, msgId, btnId, btnLabel) {
    var form = document.getElementById(formId);
    if (!form) return;
    var done    = document.getElementById(doneId);
    var msg     = document.getElementById(msgId);
    var btn     = document.getElementById(btnId);
    var isLocal = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);

    function setMsg(text, isError) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.classList.toggle('is-error', !!isError);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setMsg('');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      function ok() {
        form.hidden = true;
        if (done) {
          done.hidden = false;
          try { done.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        }
      }
      function fail() {
        if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
        setMsg('Something went wrong. Try again, or DM us on Whatnot.', true);
      }

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      })
        .then(function (r) { ((r && r.ok) || isLocal) ? ok() : fail(); })
        .catch(function () { isLocal ? ok() : fail(); });
    });
  }

  wireServiceForm('lendForm', 'lendDone', 'lendMsg', 'lendSubmit', 'Send Inquiry →');
  wireServiceForm('shipForm', 'shipDone', 'shipMsg', 'shipSubmit', 'Send Inquiry →');
  wireServiceForm('contactForm', 'contactDone', 'contactMsg', 'contactSubmit', 'Send Message →');

  // --- Use the promo poster as the hero background once it exists ---
  // Drops in automatically when images/hero-bg.png is present; until then
  // the hero shows the green mesh fallback (no broken image).
  (function () {
    var hero = document.querySelector('.go-hero');
    if (!hero) return;
    var img = new Image();
    img.onload = function () { hero.classList.add('has-poster'); };
    img.src = 'images/hero-bg.png';
  })();

  // --- Grand-opening countdown (degrades gracefully once the day passes) ---
  (function () {
    var el = document.querySelector('[data-countdown]');
    if (!el) return;
    var target = new Date(el.getAttribute('data-countdown') + 'T00:00:00');
    if (isNaN(target.getTime())) return;
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var days = Math.round((target - now) / 86400000);
    var txt;
    if (days > 1)       txt = days + ' days to go';
    else if (days === 1) txt = 'Tomorrow!';
    else if (days === 0) txt = 'Opening today!';
    else                 txt = 'Now open — come visit!';
    el.textContent = txt;
  })();
})();
