/* ============================================================
   Zen Bros Breaks — Shopify Integration
   ------------------------------------------------------------
   - Lazy-loads the Buy SDK once
   - Caches the cart instance after createComponent
   - Drives cart visibility from ZenUI overlay controller
   - Single-shot iframe style injection (no re-inject loop)
   - Sequential cart clear via promise chain
   - Live inventory via Headless Storefront API
   ============================================================ */
(function () {
  'use strict';

  // --- Config ---
  var CONFIG = {
    domain:           'f9umft-5t.myshopify.com',
    storefrontToken:  'b419ffd9f324d0bca16ce2612e668cb9',
    inventoryToken:   '44e09ab1f921f1a485d5566cb94c1b44',
    inventoryDomain:  'zenbrosbreaks.myshopify.com',
    sdkURL:           'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js',
    apiVersion:       '2024-07'
  };

  // --- Cached refs ---
  var $navCart  = document.getElementById('navCart');
  var $count    = document.getElementById('cartCount');
  var $dCount   = document.getElementById('drawerCartCount');
  var $products = document.querySelectorAll('[data-shopify-product]');
  var $spots    = document.querySelectorAll('[data-product-spots]');

  // Bail if nothing on this page needs Shopify
  if (!$navCart && !$products.length && !$spots.length) return;

  // --- Cart state (cached after init) ---
  var cart     = null;
  var $wrapper = null;   // <div class="shopify-buy-frame--cart">
  var $iframe  = null;   // its iframe

  // Note: CSS body[data-overlay="cart"] drives wrapper visibility. We don't
  // need to call cart.open()/close() — Shopify's internal state can stay
  // independent. The MutationObserver syncs state if Shopify opens itself
  // (e.g. Buy Spot click).

  // --- Nav cart click → open overlay ---
  if ($navCart) {
    $navCart.addEventListener('click', function () {
      ZenUI && ZenUI.openCart();
    });
  }
  var $drawerCart = document.getElementById('drawerCart');
  if ($drawerCart) {
    $drawerCart.addEventListener('click', function () {
      ZenUI && ZenUI.openCart();
    });
  }

  // --- Load SDK once, then init ---
  function loadSDK() {
    return new Promise(function (resolve, reject) {
      if (window.ShopifyBuy && window.ShopifyBuy.UI) return resolve();
      var s = document.createElement('script');
      s.async = true;
      s.src = CONFIG.sdkURL;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  loadSDK().then(init).catch(function (e) {
    console.warn('[ZenBros] Shopify SDK failed to load:', e);
  });

  function init() {
    var client = ShopifyBuy.buildClient({
      domain: CONFIG.domain,
      storefrontAccessToken: CONFIG.storefrontToken
    });

    ShopifyBuy.UI.onReady(client).then(function (ui) {
      // --- Cart drawer (one persistent component) ---
      ui.createComponent('cart', {
        options: cartOptions()
      });

      // --- Buy Spot button per product on the page ---
      $products.forEach(function (node) {
        var id = node.getAttribute('data-shopify-product');
        if (!id) return;
        ui.createComponent('product', {
          id: id,
          node: node,
          moneyFormat: '%24%7B%7Bamount%7D%7D',
          options: productOptions()
        });
      });

      // --- Live "X spots remaining" per product ---
      $spots.forEach(function (el) {
        var id = el.getAttribute('data-product-spots');
        if (!id) return;
        fetchInventory(id).then(function (info) {
          renderSpots(el, info);
        });
      });
    });
  }

  // --- Cart lifecycle helpers -------------------------------

  function clearCart() {
    if (!cart || !cart.model || !cart.model.lineItems.length) return;
    var items = cart.model.lineItems.slice();
    // Sequential — Shopify API races if called in parallel
    var p = Promise.resolve();
    items.forEach(function (it) {
      p = p.then(function () {
        return new Promise(function (resolve) {
          if (cart && typeof cart.updateItem === 'function') cart.updateItem(it.id, 0);
          setTimeout(resolve, 350);
        });
      });
    });
  }

  // --- Update count badges on nav + drawer ------------------

  function refreshCount() {
    var n = 0;
    if (cart && cart.model && cart.model.lineItems) {
      n = cart.model.lineItems.reduce(function (a, i) { return a + (i.quantity || 0); }, 0);
    }
    if ($count) {
      $count.textContent = String(n);
      $count.hidden = n === 0;
    }
    if ($dCount) {
      if (n > 0) {
        $dCount.textContent = String(n);
        $dCount.classList.add('has-items');
      } else {
        $dCount.textContent = '→';
        $dCount.classList.remove('has-items');
      }
    }
    // Toggle in-cart clear button
    try {
      var $clr = $iframe && $iframe.contentDocument && $iframe.contentDocument.getElementById('zen-clear-cart');
      if ($clr) $clr.style.display = n > 0 ? '' : 'none';
    } catch (_) {}
  }

  // --- Iframe enhancements ----------------------------------
  // Called on every cart render. Idempotent — only adds missing pieces.
  // (Shopify re-creates the header on cart updates, so we re-inject the
  //  shipping banner and Clear button when they go missing.)

  function enhanceIframe() {
    if (!$iframe) return;
    try {
      var doc = $iframe.contentDocument;
      if (!doc || !doc.head) return;

      // 1) Click interceptor — attach once per iframe document
      if (!$iframe.__zenClickBound) {
        $iframe.__zenClickBound = true;
        doc.addEventListener('click', function (e) {
          var btn = e.target.closest && e.target.closest('[data-element="cart.close"], .shopify-buy__btn--close');
          if (btn) setTimeout(function () { window.ZenUI && ZenUI.closeAll(); }, 0);
        }, true);
      }

      // 2) Stylesheet — attach once
      if (!doc.getElementById('zen-cart-styles')) {
        var s = doc.createElement('style');
        s.id = 'zen-cart-styles';
        s.textContent = IFRAME_STYLES;
        doc.head.appendChild(s);
      }

      // 3) Header decorations — re-attach if missing (Shopify wipes on re-render)
      var header = doc.querySelector('.shopify-buy__cart__header') || doc.querySelector('.shopify-buy__cart-title');
      if (!header) return;

      if (!doc.getElementById('zen-ship-banner')) {
        var banner = doc.createElement('div');
        banner.id = 'zen-ship-banner';
        banner.textContent = 'Free US shipping on orders $99+';
        (header.parentNode || header).insertBefore(banner, header.nextSibling);
      }

      if (!doc.getElementById('zen-clear-cart')) {
        var clr = doc.createElement('button');
        clr.id = 'zen-clear-cart';
        clr.type = 'button';
        clr.textContent = 'Clear';
        clr.setAttribute('aria-label', 'Clear cart');
        clr.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          clearCart();
        });
        header.appendChild(clr);
      }
    } catch (_) { /* cross-origin – nothing we can do */ }
  }

  // --- Cart drawer styling (passed to SDK) ------------------

  function cartOptions() {
    var FONT = '"Inter", system-ui, -apple-system, sans-serif';
    return {
      cart: {
        startOpen: false,
        popup: false,
        contents: { title: true, lineItems: true, footer: true, note: false, discounts: true },
        text: {
          title: 'Your Cart',
          total: 'Subtotal',
          empty: 'Your cart is empty.',
          button: 'Checkout',
          notice: 'Free US shipping on orders $99+ · Taxes calculated at checkout.'
        },
        styles: cartDrawerStyles(FONT),
        events: cartLifecycle()
      },
      lineItem: { styles: lineItemStyles(FONT) },
      toggle:   { styles: { toggle: { 'display': 'none' } } }
    };
  }

  // One-way sync: open ZenUI when Shopify auto-opens its cart (e.g. Buy Spot
  // adds an item and Shopify pops the cart). Closing is *only* triggered by
  // direct user action (X / scrim / ESC) — never inferred from class changes,
  // which Shopify flickers during renders.
  function ensureSyncObserver() {
    if (!$wrapper || $wrapper.__zenSync) return;
    $wrapper.__zenSync = true;
    new MutationObserver(function () {
      if (!window.ZenUI) return;
      var isOpen = $wrapper.classList.contains('is-active');
      if (isOpen && ZenUI.state() !== 'cart') ZenUI.openCart();
    }).observe($wrapper, { attributes: true, attributeFilter: ['class'] });
  }

  function cartLifecycle() {
    function syncRefs(c) {
      cart = c;
      if (!$wrapper) {
        $wrapper = document.querySelector('.shopify-buy-frame--cart');
        if ($wrapper) $wrapper.setAttribute('data-zen-cart', '');
      }
      if (!$iframe && $wrapper) $iframe = $wrapper.querySelector('iframe');
      ensureSyncObserver();
    }
    function onRender(c) {
      syncRefs(c);
      refreshCount();
      if ($iframe && !$iframe.classList.contains('is-block')) $iframe.classList.add('is-block');
      enhanceIframe();
    }
    function onOpen(c) {
      onRender(c);
      // Sync ZenUI when Shopify opens the cart (Buy Spot, addItem, etc.)
      if (window.ZenUI && ZenUI.state() !== 'cart') ZenUI.openCart();
    }
    function onAdd(c) {
      onRender(c);
      // Adding an item opens the cart in Shopify — sync ZenUI to match
      if (window.ZenUI && ZenUI.state() !== 'cart') ZenUI.openCart();
    }
    function onClose(c) {
      syncRefs(c);
      if (window.ZenUI && ZenUI.state() === 'cart') ZenUI.closeAll();
    }
    return {
      afterInit:   onRender,
      afterRender: onRender,
      addItem:     onAdd,
      updateItem:  onRender,
      removeItem:  onRender,
      openCart:    onOpen,
      closeCart:   onClose
    };
  }

  function cartDrawerStyles(F) {
    var T='#f6f7f9', T2='#b4bac4', T3='#828a96',
        BG='#101216', BG2='#15181e', BORDER='#2c313b';
    return {
      cart:      { 'background-color': BG, 'font-family': F, 'color': T, 'box-shadow': '-20px 0 60px rgba(0,0,0,0.6)' },
      header:    { 'background-color': BG2, 'border-bottom': '1px solid ' + BORDER, 'padding-top': '20px', 'padding-bottom': '20px' },
      title:     { 'color': T, 'font-family': F, 'font-size': '16px', 'font-weight': '700', 'letter-spacing': '-0.005em' },
      close:     { 'color': T2, ':hover': { 'color': T } },
      lineItems: { 'background-color': BG, 'padding-top': '8px', 'padding-bottom': '8px' },
      empty:     { 'color': T2, 'font-family': F, 'font-size': '14px', 'text-align': 'center', 'padding': '40px 20px' },
      footer:    { 'background-color': BG2, 'border-top': '1px solid ' + BORDER },
      subtotalText: { 'color': T2, 'font-family': F, 'font-size': '12px', 'font-weight': '600', 'letter-spacing': '.08em', 'text-transform': 'uppercase' },
      subtotal:  { 'color': T, 'font-family': F, 'font-size': '18px', 'font-weight': '700' },
      currency:  { 'color': T, 'font-family': F },
      notice:    { 'color': T3, 'font-family': F, 'font-size': '11px', 'font-weight': '400' },
      button:    {
        'background-color': '#25e07f', 'color': '#06160e', 'font-family': F, 'font-weight': '800',
        'font-size': '13px', 'letter-spacing': '.04em', 'border-radius': '8px', 'padding': '14px 20px',
        ':hover': { 'background-color': '#5bf5a6' }, ':focus': { 'background-color': '#5bf5a6' }
      },
      discountText:   { 'color': T2, 'font-family': F },
      discountIcon:   { 'fill': T2 },
      discountAmount: { 'color': T, 'font-family': F }
    };
  }

  function lineItemStyles(F) {
    var T='#f6f7f9', T2='#b4bac4', T3='#828a96',
        SURFACE='#1a1d24', SURFACE2='#22262f', BORDER='#2c313b';
    return {
      lineItem:      { 'background-color': 'transparent', 'border-bottom': '1px solid ' + BORDER, 'padding-top': '14px', 'padding-bottom': '14px', 'font-family': F },
      itemTitle:     { 'color': T, 'font-family': F, 'font-size': '14px', 'font-weight': '600', 'letter-spacing': '-0.005em', 'line-height': '1.35' },
      variantTitle:  { 'color': T3, 'font-family': F, 'font-size': '12px' },
      price:         { 'color': T, 'font-family': F, 'font-size': '14px', 'font-weight': '600' },
      fullPrice:     { 'color': T3, 'font-family': F, 'font-size': '12px', 'text-decoration': 'line-through' },
      discount:      { 'color': T2, 'font-family': F, 'font-size': '12px' },
      discountIcon:  { 'fill': T2 },
      quantity:      { 'background-color': SURFACE2, 'border': '1px solid ' + BORDER, 'border-radius': '6px', 'color': T, 'font-family': F },
      quantityInput: { 'background-color': 'transparent', 'color': T, 'font-family': F, 'font-size': '13px', 'font-weight': '600' },
      quantityIncrement: { 'background-color': 'transparent', 'border': 'none', 'color': T2, ':hover': { 'color': T, 'background-color': SURFACE } },
      quantityDecrement: { 'background-color': 'transparent', 'border': 'none', 'color': T2, ':hover': { 'color': T, 'background-color': SURFACE } }
    };
  }

  function productOptions() {
    var F = '"Inter", system-ui, -apple-system, sans-serif';
    return {
      product: {
        iframe: false,
        contents: { img:false, title:false, price:false, options:false, quantity:false, quantityIncrement:false, quantityDecrement:false, quantityInput:false, description:false, button:true },
        text: { button: 'Buy Spot →' },
        styles: {
          product: { 'display':'block', 'text-align':'right', 'max-width':'100%', 'margin':'0', 'padding':'0' },
          button: {
            'background-color':'#25e07f', 'color':'#06160e', 'border-radius':'10px',
            'font-family': F, 'font-weight':'800', 'font-size':'14px', 'letter-spacing':'.01em',
            'padding':'14px 24px',
            'box-shadow':'0 6px 18px rgba(37,224,127,0.45), 0 0 0 1px rgba(37,224,127,0.55)',
            'transition':'transform .18s ease, box-shadow .18s ease, background-color .15s ease',
            ':hover': { 'background-color':'#5bf5a6', 'box-shadow':'0 9px 26px rgba(37,224,127,0.55), 0 0 0 1px rgba(91,245,166,0.7)', 'transform':'translateY(-1px)' },
            ':focus': { 'background-color':'#5bf5a6', 'outline':'none' },
            ':active': { 'transform':'translateY(0)' }
          }
        }
      }
    };
  }

  // --- Live inventory ---------------------------------------

  function fetchInventory(id) {
    var query = '{ product(id: "gid://shopify/Product/' + id + '") { availableForSale variants(first:1){edges{node{quantityAvailable availableForSale}}} } }';
    return fetch('https://' + CONFIG.inventoryDomain + '/api/' + CONFIG.apiVersion + '/graphql.json', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': CONFIG.inventoryToken },
      body:    JSON.stringify({ query: query })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var p = d && d.data && d.data.product;
        if (!p) return null;
        var v = p.variants && p.variants.edges[0] && p.variants.edges[0].node;
        return { qty: v ? v.quantityAvailable : null, available: p.availableForSale && (v ? v.availableForSale : true) };
      })
      .catch(function () { return null; });
  }

  function renderSpots(el, info) {
    el.classList.remove('sold-out', 'low');
    if (!info || info.available === false || info.qty === 0) {
      if (info && (info.available === false || info.qty === 0)) {
        el.textContent = 'Sold out';
        el.classList.add('sold-out');
      }
      return;
    }
    if (info.qty == null) return; // keep manual fallback text

    // Clamp to data-spots-max so stale Storefront API cache can never display
    // more than the real cap (admin updates can lag in the public API).
    var qty = info.qty;
    var max = parseInt(el.getAttribute('data-spots-max'), 10);
    if (!isNaN(max) && qty > max) qty = max;

    el.textContent = (qty === 1 ? '1 spot remaining' : qty + ' spots remaining');
    if (qty <= 5) el.classList.add('low');
  }

  // --- Iframe stylesheet (injected once) --------------------

  var IFRAME_STYLES = [
    '#zen-ship-banner{',
      'background:rgba(48,209,88,0.09) !important;',
      'border-bottom:1px solid rgba(48,209,88,0.2) !important;',
      'color:#85e2a2 !important;',
      'font-family:"Inter",system-ui,sans-serif !important;',
      'font-size:12px !important;font-weight:600 !important;',
      'letter-spacing:.04em !important;',
      'text-align:center !important;',
      'padding:10px 14px !important;',
    '}',
    '.shopify-buy__cart__header{position:relative !important;}',
    '#zen-clear-cart{',
      'position:absolute !important;right:54px !important;top:50% !important;',
      'transform:translateY(-50%) !important;',
      'background:rgba(255,255,255,0.06) !important;color:#ffffff !important;',
      'border:1px solid rgba(255,255,255,0.18) !important;border-radius:6px !important;',
      'padding:6px 12px !important;',
      'font-family:"Inter",system-ui,sans-serif !important;',
      'font-size:11px !important;font-weight:600 !important;',
      'letter-spacing:.06em !important;text-transform:uppercase !important;',
      'cursor:pointer !important;transition:background .15s, border-color .15s !important;',
    '}',
    '#zen-clear-cart:hover{background:rgba(255,69,58,0.16) !important;border-color:rgba(255,69,58,0.45) !important;color:#ff9a92 !important;}',
    '.shopify-buy__quantity-container{',
      'display:inline-flex !important;align-items:center !important;',
      'background:#22262f !important;border:1px solid #2c313b !important;',
      'border-radius:999px !important;overflow:hidden !important;padding:0 !important;gap:0 !important;',
    '}',
    '.shopify-buy__quantity-decrement,.shopify-buy__quantity-increment{',
      'width:30px !important;height:30px !important;',
      'display:inline-flex !important;align-items:center !important;justify-content:center !important;',
      'background:transparent !important;border:none !important;cursor:pointer !important;',
      'color:#b4bac4 !important;padding:0 !important;margin:0 !important;',
      'transition:color .15s, background .15s !important;',
    '}',
    '.shopify-buy__quantity-decrement:hover,.shopify-buy__quantity-increment:hover{',
      'color:#f6f7f9 !important;background:rgba(255,255,255,0.06) !important;',
    '}',
    '.shopify-buy__quantity-decrement svg,.shopify-buy__quantity-increment svg{',
      'width:11px !important;height:11px !important;fill:currentColor !important;',
    '}',
    '.shopify-buy__quantity,.shopify-buy__cart-item__quantity-input{',
      'width:34px !important;text-align:center !important;',
      'background:transparent !important;border:none !important;outline:none !important;',
      'color:#f6f7f9 !important;',
      'font-family:"Inter",system-ui,sans-serif !important;',
      'font-size:13px !important;font-weight:600 !important;',
      'padding:0 !important;margin:0 !important;',
      '-webkit-appearance:none !important;-moz-appearance:textfield !important;appearance:textfield !important;',
    '}',
    '.shopify-buy__quantity::-webkit-outer-spin-button,.shopify-buy__quantity::-webkit-inner-spin-button,',
    '.shopify-buy__cart-item__quantity-input::-webkit-outer-spin-button,.shopify-buy__cart-item__quantity-input::-webkit-inner-spin-button{',
      '-webkit-appearance:none !important;margin:0 !important;',
    '}',
    '.shopify-buy__cart-item{padding:14px 0 !important;}',
    '.shopify-buy__cart-item__price-and-discounts{display:flex !important;align-items:center !important;}'
  ].join('');
})();
