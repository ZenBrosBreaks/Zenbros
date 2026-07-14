/* ============================================================
   Zen Bros Breaks — UI controller (v2)
   ------------------------------------------------------------
   · ZenUI overlay state machine (drawer / cart) — shopify.js
     drives the cart through this API, so keep it stable.
   · Zen background keep-alive
   · Datetime localisation, countdown, filters, forms
   ============================================================ */
(function () {
  'use strict';

  var $body = document.body;

  /* ---- Overlay state machine ------------------------------ */
  var $drawer      = document.getElementById('drawer');
  var $scrim       = document.getElementById('scrim');
  var $ham         = document.getElementById('ham');
  var $drawerClose = document.getElementById('drawerClose');

  var current = 'none';
  var listeners = [];

  function setOverlay(next) {
    if (current === next) return;
    current = next;
    $body.setAttribute('data-overlay', next);
    $body.style.overflow = next !== 'none' ? 'hidden' : '';

    if ($drawer) {
      var open = next === 'drawer';
      $drawer.classList.toggle('open', open);
      $drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    if ($ham) $ham.setAttribute('aria-expanded', next === 'drawer' ? 'true' : 'false');

    listeners.forEach(function (fn) { try { fn(next); } catch (e) {} });
  }

  window.ZenUI = {
    openDrawer: function () { setOverlay('drawer'); },
    openCart:   function () { setOverlay('cart'); },
    closeAll:   function () { setOverlay('none'); },
    state:      function () { return current; },
    onChange:   function (fn) { listeners.push(fn); }
  };

  if ($ham)         $ham.addEventListener('click', function () { setOverlay(current === 'drawer' ? 'none' : 'drawer'); });
  if ($drawerClose) $drawerClose.addEventListener('click', function () { setOverlay('none'); });
  if ($scrim)       $scrim.addEventListener('click', function () { setOverlay('none'); });
  if ($drawer) {
    $drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setOverlay('none'); });
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current !== 'none') setOverlay('none');
  });

  /* ---- Sticky nav scroll state ----------------------------- */
  var $nav = document.querySelector('.nav');
  if ($nav) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        $nav.classList.toggle('scrolled', window.scrollY > 8);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- Footer year ----------------------------------------- */
  var $year = document.getElementById('year');
  if ($year) $year.textContent = new Date().getFullYear();

  /* ---- Zen background keep-alive ----------------------------
     Low-power mode / tab suspension can pause muted autoplay
     video; retry on load, tab return, and first interaction. */
  (function () {
    var vids = document.querySelectorAll('.zen-bg video');
    if (!vids.length) return;
    function nudge() {
      vids.forEach(function (v) {
        if (!v.paused) return;
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      });
    }
    nudge();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) nudge(); });
    window.addEventListener('touchstart', nudge, { once: true, passive: true });
    window.addEventListener('click', nudge, { once: true });
  })();

  /* ---- data-datetime → viewer's local timezone -------------- */
  (function () {
    var els = document.querySelectorAll('[data-datetime]');
    if (!els.length || typeof Intl === 'undefined' || !Intl.DateTimeFormat) return;
    var fmt = new Intl.DateTimeFormat(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
    els.forEach(function (el) {
      var d = new Date(el.getAttribute('data-datetime'));
      if (isNaN(d.getTime())) return;
      var parts = fmt.formatToParts(d);
      var pick = function (t) {
        var p = parts.find(function (x) { return x.type === t; });
        return p ? p.value : '';
      };
      el.textContent =
        pick('weekday').toUpperCase() + ' · ' +
        pick('month').toUpperCase() + ' ' + pick('day') + ' · ' +
        pick('hour') + ':' + pick('minute') + ' ' + pick('dayPeriod') +
        (pick('timeZoneName') ? ' ' + pick('timeZoneName') : '');
    });
  })();

  /* ---- Grand-opening countdown ------------------------------ */
  (function () {
    var el = document.querySelector('[data-countdown]');
    if (!el) return;
    var target = new Date(el.getAttribute('data-countdown') + 'T00:00:00');
    if (isNaN(target.getTime())) return;
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var days = Math.round((target - now) / 86400000);
    el.textContent =
      days > 1  ? days + ' days to go' :
      days === 1 ? 'Tomorrow!' :
      days === 0 ? 'Opening today!' :
                   'Now open — come visit!';
  })();

  /* ---- Breaks filter + search ------------------------------- */
  (function () {
    var $chips  = document.querySelectorAll('.chip');
    var $search = document.getElementById('searchInput');
    var $cards  = document.querySelectorAll('.card[data-cat]');
    var $empty  = document.getElementById('filterEmpty');
    if (!$cards.length) return;

    var filter = 'all';
    var query  = '';

    function apply() {
      var q = query.trim().toLowerCase();
      var anyShown = false;
      $cards.forEach(function (card) {
        var show =
          (filter === 'all' || card.getAttribute('data-cat') === filter) &&
          (!q || card.textContent.toLowerCase().indexOf(q) !== -1);
        card.classList.toggle('is-hidden', !show);
        if (show) anyShown = true;
      });
      if ($empty) $empty.hidden = anyShown;
    }

    $chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        $chips.forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        filter = chip.getAttribute('data-filter') || 'all';
        apply();
      });
    });

    if ($search) {
      var t;
      $search.addEventListener('input', function (e) {
        clearTimeout(t);
        t = setTimeout(function () { query = e.target.value || ''; apply(); }, 120);
      });
    }
  })();

  /* ---- Promo signup (Netlify form "newsletter") -------------
     Email-only delivery: the welcome email (with the code) is
     sent by netlify/functions/submission-created.js via Resend. */
  (function () {
    if (document.documentElement.classList.contains('zen-joined')) return;

    var form = document.getElementById('joinForm');
    if (!form) return;
    var promo    = document.querySelector('.promo');
    var done     = document.getElementById('joinDone');
    var emailEl  = document.getElementById('joinEmail');
    var btn      = document.getElementById('joinBtn');
    var closeBtn = document.getElementById('joinClose');
    var isLocal  = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
    var STORE    = 'zenbros:joined';

    function remember() { try { localStorage.setItem(STORE, '1'); } catch (e) {} }

    function flashError() {
      emailEl.style.borderColor = '#ff9c94';
      emailEl.style.boxShadow = '0 0 0 3px rgba(255,156,148,.18)';
      setTimeout(function () {
        emailEl.style.borderColor = '';
        emailEl.style.boxShadow = '';
      }, 1800);
    }

    function dismissBanner() {
      if (!promo) return;
      promo.style.maxHeight = promo.getBoundingClientRect().height + 'px';
      promo.offsetHeight; /* commit start value before transition */
      promo.classList.add('is-dismissing');
      setTimeout(function () { promo.style.display = 'none'; }, 520);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        remember();
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
        remember();
        form.hidden = true;
        if (done) done.hidden = false;
        setTimeout(dismissBanner, 3200);
      }
      function fail() {
        if (btn) { btn.disabled = false; btn.textContent = 'Join'; }
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

  /* ---- Service inquiry forms (Netlify) ----------------------
     lending → capital-inquiry, shipping → shipping-inquiry,
     contact → general-inquiry. Each lands in the Netlify Forms
     dashboard under its own name. */
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

  wireServiceForm('lendForm',    'lendDone',    'lendMsg',    'lendSubmit',    'Send Inquiry →');
  wireServiceForm('shipForm',    'shipDone',    'shipMsg',    'shipSubmit',    'Send Inquiry →');
  wireServiceForm('contactForm', 'contactDone', 'contactMsg', 'contactSubmit', 'Send Message →');
})();
