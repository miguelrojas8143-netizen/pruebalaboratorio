# Plan: Add units and reference values for text-type bacteriology/coproanálisis exams

## Problem

The user observed that several individual text-type medical exams show `-` for both the
**Unidad** (unit) and **Valores de referencia** (reference) columns in the report PDF and
the order form. Examples:

| Examen | Resultado | Unidad | Referencia |
|---|---|---|---|
| Baciloscopía (BK) | ty | `-` | `-` |
| Coloración GRAM | 34 | `-` | `-` |
| Sudán III | 34 | `-` | `-` |

These exams are defined in `catalogo-base.js` as `tipo: 'texto'` with `unidad: ''` and no
`refMin`/`refMax`. The rendering code (`clasificarFila` in `pdf.js:65`, form rendering in
`orden.js:237`) falls back to `'-'` when these fields are absent.

## Root Cause

1. `catalogo-base.js` defines these exams without `refMin`/`refMax` (they're qualitative, not
   numerical ranges — a numerical range doesn't apply).
2. The rendering logic in `pdf.js:67-68` and `orden.js:237` only supports `refMin`/`refMax`
   pairs; there's no mechanism for a free-text reference description.
3. `crearExamenDesdeCatalogo` in `orden.js:111-120` copies `unidad`, `refMin`, `refMax`
   explicitly but does not pass through an arbitrary `refTexto` field.

## Affected Exams (text-type, Bacteriología + Coproanálisis + Micología)

All have `tipo: 'texto'` and no reference values in `catalogo-base.js`:

**Bacteriología:**
- `baciloscopia` — Baciloscopía (BK) — ref: "Negativo"
- `coloracion_gram` — Coloración GRAM — ref: "Según criterio del bioquímico"
- `urocultivo` — Urocultivo — ref: "Según criterio del bioquímico"
- `coprocultivo` — Coprocultivo — ref: "Según criterio del bioquímico"
- `exudado_faringeo` — Exudado Faríngeo — ref: "Según criterio del bioquímico"
- `frotis_vaginal` — Frotis Vaginal — ref: "Según criterio del bioquímico"

**Coproanálisis:**
- `sudan_iii` — Sudán III — ref: "Negativo"
- `helicobacter_heces` — Helicobacter Pylori (Antígeno) — ref: "Negativo"
- `azucares_reductores` — Azúcares Reductores — ref: "Negativo"
- `sangre_oculta` — Sangre Oculta — ref: "Negativo"
- `leucograma_fecal` — Leucograma Fecal — ref: "Negativo"

**Micología:**
- `koh` — KOH — ref: "Según criterio del bioquímico"

**Notes on units:** These are qualitative/text exams — no numerical unit applies. The unit
column will remain `N/A` (changed from `-` to be more explicit). If a better unit label is
desired, that should be specified per exam.

## Design Decisions

### Option A: Add `refTexto` field + render fallback (recommended)

Add a `refTexto` (string) field to the catalog entries in `catalogo-base.js`. Modify the
rendering code to check for `refTexto` before falling back to `refMin`/`refMax`:

```
// pdf.js:67-68 (clasificarFila)
var refTexto = examen.refTexto ||
    ((examen.refMin !== undefined && examen.refMax !== undefined && (examen.refMin || examen.refMax))
        ? examen.refMin + ' - ' + examen.refMax : '-');
```

Same change in `orden.js:237`.

### Option B: Set `refMin`/`refMax` as strings

Set e.g. `refMin: 'Negativo'`, `refMax: 'Negativo'` — but this renders as
`Negativo - Negativo` (redundant) and could confuse the numeric validation path (though
`validarResultado` already skips text-type exams).

### Option C: Per-exam unit override

For the unit column, set `unidad: 'N/A'` on these catalog entries. This shows "N/A"
instead of "-" for unitless text exams.

**Selected: Option A + Option C.** Adds a `refTexto` text-reference field with fallback
logic, and sets `unidad: 'N/A'` for these exams to be explicit that there's no unit.

## Changes

### 1. `public/js/catalogo-base.js` — Add `refTexto` and `unidad` to text-type bacteriology/copro exams

Add `refTexto` to each affected catalog entry and set `unidad` to `'N/A'`:

```javascript
// Bacteriología
{ id: 'baciloscopia', nombre: 'Baciloscopía (BK)', area: 'Bacteriología', unidad: 'N/A', tipo: 'texto', refTexto: 'Negativo' },
{ id: 'coloracion_gram', nombre: 'Coloración GRAM', area: 'Bacteriología', unidad: 'N/A', tipo: 'texto', refTexto: 'Según criterio del bioquímico' },
{ id: 'urocultivo', nombre: 'Urocultivo', area: 'Bacteriología', unidad: 'N/A', tipo: 'texto', refTexto: 'Según criterio del bioquímico' },
{ id: 'coprocultivo', nombre: 'Coprocultivo', area: 'Bacteriología', unidad: 'N/A', tipo: 'texto', refTexto: 'Según criterio del bioquímico' },
{ id: 'exudado_faringeo', nombre: 'Exudado Faríngeo', area: 'Bacteriología', unidad: 'N/A', tipo: 'texto', refTexto: 'Según criterio del bioquímico' },
{ id: 'frotis_vaginal', nombre: 'Frotis Vaginal', area: 'Bacteriología', unidad: 'N/A', tipo: 'texto', refTexto: 'Según criterio del bioquímico' },

// Coproanálisis
{ id: 'sudan_iii', nombre: 'Sudán III', area: 'Coproanálisis', unidad: 'N/A', tipo: 'texto', refTexto: 'Negativo' },
{ id: 'helicobacter_heces', nombre: 'Helicobacter Pylori (Antígeno)', area: 'Coproanálisis', unidad: 'N/A', tipo: 'texto', refTexto: 'Negativo' },
{ id: 'azucares_reductores', nombre: 'Azúcares Reductores', area: 'Coproanálisis', unidad: 'N/A', tipo: 'texto', refTexto: 'Negativo' },
{ id: 'sangre_oculta', nombre: 'Sangre Oculta', area: 'Coproanálisis', unidad: 'N/A', tipo: 'texto', refTexto: 'Negativo' },
{ id: 'leucograma_fecal', nombre: 'Leucograma Fecal', area: 'Coproanálisis', unidad: 'N/A', tipo: 'texto', refTexto: 'Negativo' },

// Micología
{ id: 'koh', nombre: 'KOH', area: 'Micología', unidad: 'N/A', tipo: 'texto', refTexto: 'Según criterio del bioquímico' },
```

### 2. `public/js/orden.js` — Copy `refTexto` in `crearExamenDesdeCatalogo`

At `orden.js:112-116`, add `refTexto: datos.refTexto` to the `nuevoExamen` object so it's
carried from the catalog into the exam result stored in localStorage.

### 3. `public/js/pdf.js` — Use `refTexto` in `clasificarFila`

At `pdf.js:67-68`, check `examen.refTexto` before falling back to `refMin`/`refMax`:
```javascript
var refTexto = examen.refTexto ||
    ((examen.refMin !== undefined && examen.refMax !== undefined && (examen.refMin || examen.refMax))
        ? examen.refMin + ' - ' + examen.refMax : '-');
```

### 4. `public/js/orden.js` — Use `refTexto` in form rendering

At `orden.js:237`, apply the same fallback logic so the order form shows the reference text
instead of `-`:
```javascript
var refTexto = examen.refTexto ||
    ((examen.refMin !== undefined && examen.refMax !== undefined && (examen.refMin || examen.refMax))
        ? examen.refMin + ' - ' + examen.refMax : '-');
```

## Validation

1. `node --check public/js/catalogo-base.js` — syntax check
2. `node --check public/js/orden.js` — syntax check
3. `node --check public/js/pdf.js` — syntax check
4. Load `vistas/orden.html`, add "Baciloscopía (BK)" from the catalog selector, verify the
   order form row shows "N/A" in the Unidad column and "Negativo" in the Referencia column.
5. Enter a result, save, load `vistas/reporte.html?orden=XXX`, generate PDF, verify the PDF
   table shows "N/A" and "Negativo" in the respective columns.
