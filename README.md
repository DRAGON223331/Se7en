# Se7en Store — Vercel-ready static site

This version uses the **three product photos supplied by the store owner** and has its CSS and JavaScript embedded directly inside `index.html`. That keeps the visual design from disappearing if separate stylesheet or script files are omitted during deployment.

## Deploy to Vercel

1. Extract this ZIP. The project root must contain `index.html`, `README.md`, `vercel.json`, and the `assets/` folder.
2. Upload/commit **the contents of this folder** to the root of the GitHub repository connected to Vercel (do not upload the ZIP as a nested file).
3. In Vercel → Project Settings → Build & Development Settings, use **Other** as the framework preset. Leave Build Command and Output Directory empty/default for a plain static site. Confirm the Root Directory points to the folder containing `index.html`.
4. Redeploy. Open the deployed site and press `Ctrl + F5` to bypass the browser cache.

## Included products

- Barcelona Contrast — `assets/products/barcelona-contrast.jpg`
- Pharaoh's Legacy — `assets/products/pharaoh-legacy.jpg`
- Nile Developments — `assets/products/nile-developments.jpg`

## Notes

- Product images are the three photographs supplied by the owner; the original hangers and light studio backgrounds are retained intentionally as clean catalog photography.
- The cart, quantity controls, filters, reveal animations, and hover tilt run client-side. No actual payment, shipping, inventory, or order submission is connected.
- Prices are demo placeholders; update them in the `products` object and product-card markup before launch.
- Since CSS and JavaScript are inline, the main visual experience doesn't depend on separate `.css` or `.js` requests.
