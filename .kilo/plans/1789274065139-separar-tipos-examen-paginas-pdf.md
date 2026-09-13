# Plan: Separate exam types onto individual PDF pages with patient name in every header

## Problem

1. **All exam types share the same page flow** — Hematología, Coagulación, Uroanálisis, Heces, etc. are rendered sequentially in `construirPDF()` with only auto page-breaks when content overflows. They should each start on their own page.
2. **Patient name only on page 1** — The patient data block (`Paciente: ... | Cédula: ... | Edad: ... | Sexo: ... | Teléfono: ...`) is drawn manually once at line 537–547 of `pdf.js`. The `encabezadoPagina` function (the `didDrawPage` callback) does NOT include it, so subsequent pages lack the patient header.
3. **HTML print CSS** lacks `page-break-before` rules for `.reporte-area-grupo` and `#bloqueHeces`.

## Goal

1. Each field of study (each `area` in `payload.secciones`, plus `heces` and `uro`) starts on its own PDF page.
2. The first content block remains on page 1 (with the full header).
3. The patient name/data appears in the header of **every** page (via `encabezadoPagina`).
4. If a section's tables overflow, autoTable's auto-page-break continues drawing them on extra pages (header repeats naturally).

## Affected Files

| File | Scope |
|---|---|
| `public/js/pdf.js` | jsPDF PDF generation (`construirPDF`, `agregarTablaPDF`, `encabezadoPagina`) |
| `public/css/pdf.css` | `@media print` page-break rules for HTML print fallback |

---

## Changes to `public/js/pdf.js`

### A. Move patient data into `encabezadoPagina` (lines 490–530)

Currently `encabezadoPagina` draws only the company banner, page number, and footer signature. Add the patient data block (currently at lines 534–547) so it renders on every page.

**Inside `encabezadoPagina`, after the separator line at Y=36, add:**

```javascript
doc.setFont('helvetica', 'normal');
doc.setFontSize(7.5);
doc.setTextColor(25, 25, 25);
doc.text(lineasPaciente, 14, 43);
var lineaSeparadoraY = 43 + (lineasPaciente.length * 3.5) + 1;
doc.setDrawColor(190, 200, 210);
doc.setLineWidth(0.25);
doc.line(14, lineaSeparadoraY, pageWidth - 14, lineaSeparadoraY);
```

**Reference:** `encabezadoPagina` already closes over `h` (line 488), `pageWidth`/`pageHeight` (lines 486–487), and `doc`.

### B. Precompute `lineasPaciente` and `yDespuesEncabezado` before first header call (after line 488)

Insert before `encabezadoPagina({ pageNumber: 1 })` (line 533):

```javascript
var datosPaciente = 'Paciente: ' + textoPlano(h.nombre) +
    '  |  Cédula: ' + textoPlano(h.cédula) +
    '  |  Edad: ' + textoPlano(h.edad) +
    '  |  Sexo: ' + textoPlano(h.sexo) +
    '  |  Teléfono: ' + textoPlano(h.telefono);
var lineasPaciente = doc.splitTextToSize(datosPaciente, pageWidth - 28);
var yDespuesEncabezado = 43 + (lineasPaciente.length * 3.5) + 1 + 3;
```

Then replace lines 534–547 (the standalone patient data drawing) and line 549 (`var y = lineaSeparadoraY + 3;`) with:

```javascript
encabezadoPagina({ pageNumber: 1 });
var y = yDespuesEncabezado;
```

`lineasPaciente` is declared at `construirPDF` scope so `encabezadoPagina` can reference it (same closure).

### C. Update `agregarTablaPDF` (lines 443–481) to accept dynamic start-Y

| Line | Current | Replace with |
|---|---|---|
| 454 | `yInicial = 56;` | `yInicial = opciones.startY || 56;` |
| 471 | `margin: { top: 43, ... }` | `margin: { top: opciones.marginTop \|\| 43, ... }` |

This ensures auto-generated pages (when a table overflows) use the correct header height instead of the hardcoded `56` or `43`.

### D. Force page breaks between sections (lines 556–571)

Wrap the `payload.secciones.forEach` loop with a `requiereNuevaPagina` flag:

```javascript
var requiereNuevaPagina = false;

payload.secciones.forEach(function(seccion) {
    if (requiereNuevaPagina) {
        doc.addPage();
        encabezadoPagina({ pageNumber: doc.getNumberOfPages() });
        y = yDespuesEncabezado;
    }
    requiereNuevaPagina = true;

    seccion.subareas.forEach(function(sub) {
        // ... unchanged rendering logic ...
        // Add startY + marginTop to options:
        //   startY: yDespuesEncabezado, marginTop: yDespuesEncabezado
    });
    y += 2;
});
```

### E. Force page breaks before Heces (lines 571–581)

```javascript
if (payload.heces) {
    if (requiereNuevaPagina) {
        doc.addPage();
        encabezadoPagina({ pageNumber: doc.getNumberOfPages() });
        y = yDespuesEncabezado;
    }
    requiereNuevaPagina = true;
    // ... render heces (unchanged) ...
}
```

### F. Force page breaks before Uroanálisis (lines 583–590)

```javascript
if (payload.uro) {
    if (requiereNuevaPagina) {
        doc.addPage();
        encabezadoPagina({ pageNumber: doc.getNumberOfPages() });
        y = yDespuesEncabezado;
    }
    requiereNuevaPagina = true;
    // ... render uro (unchanged) ...
}
```

### G. Pass `startY` and `marginTop` to all `agregarTablaPDF` calls

Every call inside `construirPDF` must include:
```javascript
{ y: y, alturaMinima: <existing>, didDrawPage: encabezadoPagina,
  startY: yDespuesEncabezado, marginTop: yDespereEncabezado }
```

**Affected call sites:**
- Section tables (line 560–562)
- Section notas (line 565)
- Heces table (line 580)
- Uroanálisis group tables (line 586–588)

---

## Changes to `public/css/pdf.css`

### H. Add `@media print` page-break rules (after line 319, inside `@media print`)

```css
.reporte-area-grupo:not(:first-of-type) {
    page-break-before: always;
    break-before: page;
}

#bloqueHeces {
    page-break-before: always;
    break-before: page;
}
```

`#bloqueUroanalisis` already has `page-break-before: always` (lines 535–538). Add `#bloqueHeces` rule since it's missing.

---

## Edge Cases & Risks

| Scenario | Behavior |
|---|---|
| Single exam type only | Stays on page 1 with header. No force-break needed. |
| No sections, only Heces + Uro | Heces on page 1, Uro on page 2. No wasted blank page. |
| Section with many rows (overflow) | autoTable auto-breaks to next page; header repeats via `didDrawPage`. |
| Very long patient name | `yDespereEncabezado` computed dynamically per patient. All callers use the same value. |
| `agregarTablaPDF` fallback (auto page) | Uses `opciones.startY` / `opciones.marginTop` = `yDespereEncabezado`. |

## Validation

1. `node --check public/js/pdf.js` — syntax check passes
2. Visual test via jsPDF "Imprimir" button:
   - [ ] Each area (Hematología, etc.) starts on a new page
   - [ ] Heces on its own page
   - [ ] Uroanálisis on its own page
   - [ ] Patient name appears in header of every page
   - [ ] Multiple subareas of same area (e.g. V.S.G. + Hematología items) stay on same page
3. Browser print (Ctrl+P) fallback:
   - [ ] Page breaks between sections, heces, uro
   - [ ] Patient name in repeating `thead` header on every page
4. CSS brace balance unchanged in `pdf.css`
