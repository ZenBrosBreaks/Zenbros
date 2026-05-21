# Shopify Setup — Step by Step

You don't need to write any code. You'll create products in Shopify, copy
the link, and paste it into your website. That's it.

---

## Part 1 — Make a Shopify account (10 min)

1. Go to **shopify.com**.
2. Click **Start free trial**.
3. Enter your email, password, and store name (e.g., "Zen Bros Breaks").
4. Pick "I'm just starting" and skip every survey question — they don't matter.
5. You're in. The Shopify dashboard is your back end.

---

## Part 2 — Create your first break (F1) (5 min)

1. In Shopify, click **Products** in the left sidebar.
2. Click **Add product**.
3. Fill it in like this:

   - **Title:** `2025 Topps Chrome F1 — 3 Box Hobby Break`
   - **Description:** `1 driver per spot. Random Driver format. 3 boxes ripped live on YouTube. 1-day shipping. 5.0★ Premier Whatnot seller.`
   - **Media:** upload a picture of the boxes (or your logo for now).
   - **Pricing → Price:** type the price you want, e.g. `45`.
   - **Inventory → Track quantity:** check the box.
   - **Available:** type the number of spots, e.g. `20`.
   - **Status (top right):** **Active**.

4. Click **Save**.

---

## Part 3 — Get the product link (1 min)

1. Still on the product page, look at the top right.
2. Click **Preview** (or the eye icon).
3. A new tab opens showing your product page on your store.
4. **Copy the URL** from that browser tab. It will look like:
   `https://your-store.myshopify.com/products/2025-topps-chrome-f1`

---

## Part 4 — Add the link to your website (2 min)

1. Open the file **`index.html`** in a text editor (Notepad works fine).
2. Use **Ctrl+F** (Windows) or **Cmd+F** (Mac) to find:
   `https://YOUR-SHOPIFY-LINK-HERE.com`
3. There are two of those — one for the F1 break, one for the Hockey break.
4. For F1: replace the **first** one with the link you copied in Part 3.
5. While you're there, find `class="bk-date">TBA` and `class="bk-price">$—`
   and update them too:

   ```
   <dd class="bk-date">May 1</dd>
   ...
   <span class="bk-price">$45</span>
   ```

6. Save the file.

That's the F1 break done.

---

## Part 5 — Repeat for the Hockey Mixer (5 min)

1. In Shopify, click **Products** → **Add product**.
2. Title: `Hockey Mixer — Random Team`
3. Add description, photo, price, quantity. Set **Active**. Save.
4. **Preview** → copy the URL.
5. In `index.html`, find the **second** `https://YOUR-SHOPIFY-LINK-HERE.com`
   and paste your hockey URL there.
6. Update the date and price for the hockey break.
7. Save.

---

## What happens when someone clicks Buy Spot

1. They land on your Shopify product page.
2. They click "Buy now" (or "Add to cart" → "Checkout").
3. Shopify handles the entire checkout — payment, shipping, taxes, the whole
   thing.
4. You get an email saying "New order!" and the spot count goes down by one
   on Shopify automatically.
5. When you log into Shopify you see all your orders and customer info.

You **never touch payments yourself**. Shopify is the back end.

---

## How to add MORE breaks later

Right now there are 2 break slots in the website. To add a third:

1. **Easy version:** message me and I'll add a third card. You'll only need
   to fill in the date, price, and Shopify link.
2. **Or:** I can convert the breaks to a JSON list (one file you edit) so
   you can add as many as you want without touching HTML.

For now, two breaks is plenty to launch. Don't worry about it.

---

## Security — what you need to know

- The website **never sees credit cards**. Shopify does.
- The Shopify product URL is meant to be public — it's just a web page link.
- Your customer's order info lives in your Shopify dashboard, behind your
  Shopify password.
- Turn on two-factor authentication in Shopify settings. Done.

---

## Quick reference

| What | Where |
|------|-------|
| Make products, see orders, set prices | **Shopify dashboard** |
| Show breaks on the website | **`index.html`** |
| Brand colors and layout | **`style.css`** |
| The "Watch Live" button | already wired to your Whatnot link |

---

## Stuck?

The only thing you have to do in code is paste a URL. If you get stuck on
that step, send me the Shopify product link and I'll wire it up.
