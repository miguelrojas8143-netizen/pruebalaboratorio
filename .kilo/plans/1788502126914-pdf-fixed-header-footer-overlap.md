# Plan: Fix PDF Header/Footer Overlap with Content in `pdf.css`

## Problem

In `vistas/reporte.html`, the native print path (`window.print()`) uses two `position: fixed` elements:
- `.reporte-encabezado-impresion` — fixed header at `top: 0`, measured **~55mm** tall
- `.reporte-firma-impresion` — fixed footer at `bottom: 0`, measured **~25mm** tall

The current `@page` margins and container padding do not reserve enough space for these elements on all pages:

| Element | Current value | Required | Gap |
|---|---|---|---|
| `@page` top margin | 8mm | ≥60mm (55mm header + 5mm buffer) | −52mm |
| `@page` bottom margin | 20mm | ≥30mm (25mm footer + 5mm buffer) | −10mm |
| `.reporte-container` `padding-top` | 155px (~41mm) | 0 (protected by `@page`) | 41mm excess on page 1 only |

**Result:**
- **Page 1:** Footer overlaps the last content (Heces/Uro tables) because `@page` bottom margin (20mm) < footer height (25mm).
- **Page 2+:** Header cuts the first content lines ("METRO R", "ecto", "tamoeba") because `@page` top margin (8mm) << header height (55mm). The container's `padding-top: 155px` is a one-time offset at the start of the container, so it only protects page 1; page 2+ content starts at the `@page` top margin, which is inside the fixed header zone.

## Goal

Eliminate the overlap by adjusting `@page` margins and the container's print padding, **without modifying** the fixed header/footer rules themselves.

## Affected File

`public/css/pdf.css` — only this file. No changes to `pdf.js`, `styles.css`, or HTML.

## Changes

### 1. `@page` rule (line 10-13)

**Current:**
```css
@page {
    size: A4 portrait;
    margin: 8mm 12mm 20mm;
}
```

**Replace with:**
```css
@page {
    size: A4 portrait;
    margin: 60mm 12mm 30mm;
}
```

- **Top: 60mm** — clears the ~55mm fixed header on every page (not just page 1).
- **Bottom: 30mm** — clears the ~25mm fixed footer on every page.
- **Sides: 12mm** — unchanged.

### 2. `.reporte-container` inside `@media print` (line 579-585)

**Current:**
```css
.reporte-container {
    box-shadow: none;
    padding: 155px 12px 0;
    max-width: 100%;
    border-radius: 0;
    margin: 0;
}
```

**Replace with:**
```css
.reporte-container {
    box-shadow: none;
    padding: 0 12px;
    max-width: 100%;
    border-radius: 0;
    margin: 0;
}
```

- Remove `155px` top padding. The new `@page` top margin (60mm) now protects the header area on all pages. Keeping the old `padding-top` would create ~101mm of empty space at the top of page 1.
- Keep `12px` horizontal padding for visual breathing room.
- No bottom padding — the `@page` bottom margin protects the footer.

### 3. No changes to fixed elements

Per the user's requirement, `.reporte-encabezado-impresion` and `.reporte-firma-impresion` rules remain untouched.

## Why This Works

In CSS print, `position: fixed` elements render on top of the content area. The `@page` margins define the printable area. When `@page` margins are large enough to contain the fixed elements, content automatically flows below the header and above the footer on every page.

- **Page 1:** Content starts at 60mm from top (below the 55mm header) and ends at 30mm from bottom (above the 25mm footer).
- **Page 2+:** Same — `@page` margins apply to every page, so content always has the correct clearance.
- **Printable height:** A4 (297mm) − 60mm top − 30mm bottom = **207mm** of usable space per page. Sufficient for lab reports.

## What This Does NOT Affect

- **`html2pdf` download path (`descargarPDF()` in `pdf.js`):** Uses `buildInlineHtml()` which generates a self-contained HTML string without `position: fixed` elements. The inline HTML has its own `padding: 30px 40px` and is rendered as a single canvas. The `@page` margins in `pdf.css` do not apply to this path. No regression.
- **Screen rendering:** Changes are inside `@media print` (except `@page` which only applies at print time).
- **styles.css `@page` rule:** Remains unchanged. The pdf.css `@page` takes precedence in the cascade (loaded after styles.css in `reporte.html`).

## Validation

1. **CSS syntax:** Verify brace balance in `pdf.css` after edits (should remain 67/67).
2. **Visual test — native print:**
   - Open `vistas/reporte.html?orden=001` in Chrome.
   - Press `Ctrl+P` (print preview).
   - Confirm: Header (~55mm) at top, footer (~25mm) at bottom, content in between with no overlap.
   - Navigate to page 2 in the preview — confirm header still clears the first content line.
3. **Visual test — html2pdf download:**
   - Click "Imprimir" → "Descargar PDF" (uses html2pdf).
   - Confirm the PDF still renders correctly (unchanged path).

## Risks

- **Fixed element height changes:** If the header/footer content grows (e.g., longer patient names, more address lines), the 60mm/30mm margins might become insufficient. Mitigation: the 5mm buffer per side. If future content pushes heights beyond 55mm/25mm, increase the `@page` margins accordingly.
- **Tight buffer on page 1:** The 5mm gap between header bottom (55mm) and content start (60mm) is small. If the header renders slightly larger than estimated, consider increasing to 62mm or 65mm.
- **styles.css `@page` conflict:** styles.css has `margin: 15mm 12mm;` which is overridden by pdf.css (loaded later). If a future change reorders the stylesheet links, the styles.css rule could take over. Not addressed here per scope.

## Task List

1. [ ] Edit `public/css/pdf.css` line 12: `margin: 8mm 12mm 20mm;` → `margin: 60mm 12mm 30mm;`
2. [ ] Edit `public/css/pdf.css` line 581: `padding: 155px 12px 0;` → `padding: 0 12px;`
3. [ ] Validate: CSS brace balance check
4. [ ] Visual test: native print preview in Chrome (page 1 and page 2)
5. [ ] Visual test: html2pdf PDF download (regression check)
