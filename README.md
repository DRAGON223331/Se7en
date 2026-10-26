# Se7en — Arabic Sportswear Gallery

A responsive Arabic-first (RTL) showcase website for Se7en Store. It is a gallery only: no prices, checkout, or shopping cart.

## Included
- Polished dark-theme design with lime accents and responsive layout.
- Three provided product photos in `assets/products/`.
- Click-to-enlarge product detail modal.
- Interactive Google Map embedded directly inside the page, centered on the location shared by the owner.
- Instagram link: https://www.instagram.com/se7e_n770/
- No build step or external CSS/JS files. Main styles and interactions are in `index.html`.

## Local preview
Open `index.html` in a browser, or run:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Deploy to Vercel
1. Extract this ZIP.
2. Put the **contents** of the extracted folder in the root of the GitHub repository (so `index.html`, `vercel.json`, and `assets/` are directly in the repository root).
3. Import or redeploy that repository on Vercel.
4. Use **Other** as the framework preset; no build command is needed, and the output directory can be `.`.

The map is visible on the page. A small optional link below it can open Google Maps for turn-by-turn directions, but the website itself does not redirect to Google Maps when you select “الموقع”.
