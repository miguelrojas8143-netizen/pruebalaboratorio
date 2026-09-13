# Plan: Save confirmation (toast) + visual refresh for per-exam "Guardar" buttons in catalogo.html

## Goal
When the bioanalyst clicks a per-exam **Guardar** button in the catalog table, show a non-blocking, harmonious confirmation that the changes were saved, and refresh the button/row visual feedback. The global **Guardar Cambios** already alerts; it will be harmonized to the same toast.

## Current state (verified)
- `guardarExamenCatalogo` (`public/js/catalogo-admin.js:46-82`): writes `catalogoCustom` to localStorage, then only flashes the row green via inline `fila.style.backgroundColor = '#d4edda'` for 1.5s — **no message**.
- `guardarCatalogo` (`public/js/catalogo-admin.js:109-144`): global save already calls `alert('Catálogo guardado exitosamente.')` (line 143).
- No existing toast infrastructure (grep for `toast`/`mostrarToast`/`bootstrap.Toast` found nothing).
- `catalogo.html` already loads `bootstrap.bundle.min.js` (line 115, includes `Toast`) and `bootstrap-icons`. Palette: primary blue `#0d6efd`, success green `#198754` / `#d1e7dd`.
- Decision (user-selected): **Toast no bloqueante**.

## Changes

### 1. `vistas/catalogo.html` — add a toast container
Add a single reusable, fixed toast container at the end of `<body>` (below the footer) so toasts overlay the catalog and survive re-renders:
```html
<div id="toastContainer" class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 1080;"></div>
```

### 2. `public/js/catalogo-admin.js` — toast helper + wiring
- Add a module-level helper `mostrarToast(mensaje, tipo)`:
  - Builds Bootstrap 5 toast markup into `#toastContainer`.
  - `tipo === 'success'` → green success palette (harmonious with `#198754` / `#d1e7dd`); `tipo === 'danger'` → red.
  - Instantiates `new bootstrap.Toast(el, {delay: 4500})` and `.show()`; auto-dismisses.
- `guardarExamenCatalogo` (after `localStorage.setItem` succeeds at line 79):
  - Call `mostrarToast("Examen '" + nombre + "' guardado.", "success")`.
  - Replace the inline green flash (lines 80-81) with a CSS class animation `.fila-guardada` (see step 3) — cleaner than inline style hijacking.
- `guardarCatalogo` (line 143): replace `alert('Catálogo guardado exitosamente.')` with `mostrarToast("Catálogo guardado exitosamente.", "success")` for consistency.

### 3. `public/css/catalogo.css` — visual refresh (harmonious, no theme break)
- `.btn-guardar-examen`: make it solid success (`btn-success`) with a save icon `<i class="bi bi-save"></i>`; smooth transition.
- Saved state: on success, swap icon to `bi-check-lg` and add `.guardado` class; when the user edits any input in that row again, remove `.guardado` (revert icon). This gives lightweight per-row confirmation beyond the toast.
- Row save feedback: add `.fila-guardada` class + `@keyframes filaGuardarFade` (background `#d1e7dd` → transparent over ~1.2s) to replace the inline `backgroundColor` hack.
- Toast: rely on Bootstrap's `.toast-success` styling; ensure text color is dark-on-light-green to stay within the existing palette. No new colors introduced.

## Data flow
1. Bioanalyst edits row inputs (`cat-nombre`/`cat-area`/`cat-unidad`/`cat-refmin`/`cat-refmax`).
2. Clicks per-exam **Guardar** → `guardarExamenCatalogo(id)` validates (unidad required, refMin/refMax numeric) → writes `catalogoCustom` to localStorage → `mostrarToast(success)` + `.fila-guardada` animation + button `guardado` icon (check).
3. Re-editing any field in the row removes `.guardado` (icon reverts), ready for next save.
4. Global **Guardar Cambios** → `guardarCatalogo()` → `mostrarToast(success)` (replaces native alert).

## Validation
1. `node --check public/js/catalogo-admin.js` — syntax check.
2. Manual in `catalogo.html`:
   - Edit an exam row, click its **Guardar** → toast "Examen '<nombre>' guardado" appears, row fades green, button shows ✓ icon.
   - Edit a field again → ✓ icon reverts to save icon.
   - Click **Guardar Cambios** → toast "Catálogo guardado exitosamente" (no native alert).
3. Console: no JS errors; `bootstrap.Toast` instantiated correctly.
4. Mobile: toast stays at bottom-end, does not overlap the "Volver"/footer buttons.

## Risks / scope
- Bootstrap `Toast` is part of `bootstrap.bundle.min.js` (already loaded) — no new dependencies.
- Toast fires only on successful save (after `localStorage.setItem`) — matches the existing success-only flow. Validation failures keep their existing `alert()` calls (out of scope to convert).
- Existing `catalogoCustom` data in localStorage is unaffected; only UI behavior changes.
- Toasts are non-blocking, which is the requested "más agradable" behavior; the only behavioral change is global save moves from `alert()` → toast (still a clear confirmation).

## Out of scope (not touched)
- `referencias.js` sex-specific/adapted references.
- `restablecerCatalogo` — could toast on reset as a follow-up; left as-is.
- `items-detallados.js`, `perfiles.js` — no catalog-admin UI changes here.

## Ordered task list (for implementation agent)
- [ ] Add `#toastContainer` markup to `vistas/catalogo.html` body.
- [ ] Add `mostrarToast(mensaje, tipo)` helper in `catalogo-admin.js`.
- [ ] Wire success toast + `.fila-guardada` class in `guardarExamenCatalogo`; remove inline green flash.
- [ ] Replace global `alert(...)` with toast in `guardarCatalogo`.
- [ ] Add `.btn-guardar-examen` solid + `.guardado` icon-toggle + `.fila-guardada` animation in `catalogo.css`.
- [ ] Add icon markup (`<i class="bi bi-save">`) + toggle to `bi-check-lg`/`.guardado` in the row template (`actualizarTablaCatalogo`).
- [ ] `node --check public/js/catalogo-admin.js` and manual browser validation.
