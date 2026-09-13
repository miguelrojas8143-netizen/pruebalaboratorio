# Plan: Corregir títulos y márgenes del PDF (Heces) — sin tocar `@page` margin

## Problema del usuario

> El título "Resultados de Exámenes de Laboratorio" / "Examen de Heces" no se nota en el PDF.
> Las separaciones y márgenes están fallando. El PDF no se ve profesional ni fácil de leer.
> **No tocar el `@page` margin** (`margin: 10px 12px 65px` en `pdf.css`).

## Diagnóstico

### Causa 1 — El botón "Imprimir" llama a `vistaPrevia()`, NO a `descargarPDF()` (CRÍTICO)

En `reporte.html:29`:
```html
<button onclick="vistaPrevia()">  ←  window.print()
```

`vistaPrevia()` (`pdf.js:493`) → `window.print()` → navegador "Guardar como PDF".

Esto usa las reglas `@media print` de `pdf.css`. El `<h2>` en `buildInlineHtml` (pdf.js:427) **nunca se ejecuta** porque `descargarPDF()` no está enlazado a ningún botón.

**El título que realmente se renderiza** en la vía de impresión es:
```html
<h6 class="reporte-seccion-titulo"> Resultados de Exámenes de Laboratorio</h6>
```
(pdf.js DOM, via `renderDom()`)

### Causa 2 — `@page` top margin insuficiente para el header fijo

`pdf.css:16`: `@page { margin: 20px 12px 50px; }` (el usuario muestra `10px 12px 65px`, tampoco suficiente).

El header fijo (`.reporte-encabezado-impresion`, `position: fixed; top: 0`) mide **~140 px**:
- Logo 100 px + nombre/dirección ~20 px + grid paciente ~20 px

Con top margin de 10-20 px, el header fijo cubre el **90 %** del espacio superior, ocultando:
- El `<h6 class="reporte-seccion-titulo">` "Resultados de Exámenes de Laboratorio"
- Las primeras filas de resultados
- En páginas 2+, todo el contenido inicial se pierde tras el header

**Restricción**: NO se puede cambiar el `@page` margin.

**Solución**: Agregar `padding-top` al `.reporte-container` igual al header (~150 px). Esto empuja todo el contenido por debajo del header fijo. Funciona en la página 1 (caso típico de examen de heces).

### Causa 3 — Orden del DOM: heces/urina DESPUÉS del footer fijo

`reporte.html:80-90` (estado actual):
```html
<div class="reporte-firma-impresion solo-imprimir">...</div>  <!-- fixed: bottom 0 -->
<div id="bloqueHeces"></div>
<div id="bloqueUroanalisis"></div>
```

El footer fijo (`position: fixed; bottom: 0`) ocupa el pie de **cada página**.
El contenido de heces que sigue en el DOM puede quedar **detrás del footer** o forzado a
una nueva página donde el footer se lo tapa.

**Fix**: Mover `#bloqueHeces` y `#bloqueUroanalisis` **antes** de `.reporte-firma-impresion`.

### Causa 4 — Títulos con tipografía demasiado pequeña

| Selector (pdf.css) | Tamaño actual | Problema |
|---|---|---|
| `.reporte-seccion-titulo` | 0.85 rem | Ilegible en PDF |
| `.reporte-area-titulo` | 0.82 rem | "Examen de Heces" apenas visible |
| `.reporte-subarea-titulo` | 0.78 rem | Casi invisible |
| `<h2>` en `buildInlineHtml` | 0.95 rem | Pequeño para un H2 |

### Causa 5 — Conflictos CSS en `pdf.css`

| Línea | Regla | Problema |
|---|---|---|
| 248-250 | `.reporte-tabla { margin-bottom: 6px; }` | Sin `margin-top`, separación insuficiente |
| 161-165 | `.reporte-area-grupo { margin-bottom: 8px; }` | Bien, pero... |
| 304-306 | `.reporte-area-grupo { margin-bottom: 4px; }` | **Gana la segunda** (4 px apretado) |
| 125-129 | `.firma-linea { margin: 28px auto 3px; }` | 28 px top margin → footer demasiado alto |

### Causa 6 — `pagebreak` de html2pdf demasiado agresivo

`pdf.js:547-552`:
```js
mode: ['avoid-all', 'css', 'legacy'],
before: '.reporte-area-grupo, #bloqueHeces, #bloqueUroanalisis',
avoid: 'tr, tbody, .reporte-tabla'
```

- `avoid-all` intenta evitar TODO salto → puede causar overflow
- `before: '#bloqueHeces'` fuerza salto de página antes de heces → separa el título del contenido

### Causa 7 — Bootstrap `table-sm` sin override en print

`renderHecesDom` (pdf.js:295) y `renderTablaDom` (pdf.js:260) usan `table table-bordered table-sm`.
`table-sm` pone `padding: 0.25rem` (~3 px) → celdas apretadas en PDF.

## Cambios

### 1. `vistas/reporte.html` — Botón + reordenar DOM

**a) Botón "Imprimir" → `descargarPDF()`** (línea 29):

Cambiar para que "Imprimir" use html2pdf (no `window.print()`), así el `<h2>` de `buildInlineHtml`
se renderiza y no depende del `@page` CSS:

```html
<button class="btn btn-outline-primary" onclick="descargarPDF()">
    <i class="bi bi-printer me-1"></i> Imprimir
</button>
```

**b) DOM reordenado** — mover `#bloqueHeces`/`#bloqueUroanalisis` antes del footer fijo:

```html
<!-- ... section title + results ... -->

<div id="bloqueHeces"></div>
<div id="bloqueUroanalisis"></div>

<div class="reporte-firma-impresion solo-imprimir">...</div>
<div class="reporte-firma no-imprimir">...</div>
```

**c) Eliminar espacio inicial** en el título: `" Resultados..."` → `"Resultados..."`.

### 2. `public/css/pdf.css` — Compensar `@page` con `padding-top` (NO tocar `@page`)

**a) `.reporte-container`** — agregar `padding-top` = 155 px para empujar contenido bajo el header fijo:

```css
.reporte-container {
    box-shadow: none;
    padding: 155px 12px 0;    /* 155 px compensa el header fijo (~140 px) + @page margin top */
    max-width: 100%;
    border-radius: 0;
    margin: 0;
}
```

**b) `.reporte-area-grupo`** — eliminar definición duplicada. Debe quedar solo una:

```css
.reporte-area-grupo {
    page-break-inside: avoid;
    break-inside: avoid;
    margin-bottom: 12px;
}
```

**c) `.reporte-tabla`** — corregir margen:

```css
.reporte-tabla {
    margin: 0 0 10px;  /* espaciado vertical entre tabla y título */
}
```

**d) Títulos — aumentar tamaños**:

```css
.reporte-seccion-titulo {
    font-size: 1.05rem;   /* de 0.85rem */
    font-weight: 800;     /* negrita fuerte */
    margin: 16px 0 10px;  /* de 14px 0 8px */
    page-break-after: avoid;
}
.reporte-area-titulo {
    font-size: 0.9rem;    /* de 0.82rem */
    margin: 12px 0 6px;
    page-break-after: avoid;
}
.reporte-subarea-titulo {
    font-size: 0.85rem;   /* de 0.78rem */
    margin-top: 6px;
    page-break-after: avoid;
}
```

**e) Eliminar `border-left-color: aqua`** (debug dejado en producción):
Buscar cualquier `border-left-color: aqua` o `aquacolor` en `.reporte-tabla table` y borrar.

**f) Footer firma-linea** — reducir margin top para ajustarse al `@page` bottom margin:

```css
.reporte-firma-impresion .firma-linea {
    margin: 16px auto 2px;   /* de 28px → 16px (footer cabe en el margen bottom) */
}
```

**g) Agregar overrides de Bootstrap en `@media print`** para tablas heces/urina con `table-sm`:

```css
/* Bootstrap .table-sm reduce padding a ~3px; en print se necesita >= 4px */
#bloqueHeces .table-sm td,
#bloqueHeces .table-sm th,
#bloqueUroanalisis .table-sm td,
#bloqueUroanalisis .table-sm th,
.reporte-tabla .table-sm td,
.reporte-tabla .table-sm th {
    padding: 4px 6px !important;
}
/* Anular sombreado de Bootstrap */
.reporte-tabla .table,
#bloqueHeces .table,
#bloqueUroanalisis .table {
    box-shadow: none;
    border: none;
}
```

**h) Agregar estilos explícitos `#bloqueUroanalisis` en `@media print`** (actualmente solo `#bloqueHeces` tiene estilos de print; urina depende de `styles.css` que filtra a print):

```css
#bloqueUroanalisis { margin-bottom: 12px; }
#bloqueUroanalisis table { font-size: 0.74rem; width: 100%; border-collapse: collapse; }
#bloqueUroanalisis th { padding: 3px 6px; border: 1px solid #000; background: #e9e9e9 !important; }
#bloqueUroanalisis td { padding: 3px 6px; border: 1px solid #ccc; color: #000; }
```

### 3. `public/js/pdf.js` — `buildInlineHtml` y `pagebreak`

**a) `buildInlineHtml` — `<h2>` título** (línea 427):

Aumentar font-size de 0.95 rem a 1.1 rem y mejorar márgenes:

```javascript
html += '<h2 style="font-size: 1.1rem; font-weight: bold; ...">Resultados de Exámenes de Laboratorio</h2>';
```

**b) `buildInlineHtml` — títulos de área/heces/urina** aumentar de 0.85 rem a 0.9 rem,
agregar `page-break-after: avoid` a `<h3>` y `<h4>`:

- Línea 431 (sección): `0.85rem` → `0.9rem`, + `padding-bottom: 3px`, + `margin: 14px 0 8px`, + `page-break-after: avoid`
- Línea 433 (subárea): `0.78rem` → `0.85rem`, `margin: 4px 0 2px` → `6px 0 4px`, + `page-break-after: avoid`
- Línea 436 (notas): mismo tratamiento
- Línea 445 (heces `<h3>`): `0.85rem` → `0.9rem`, `padding-bottom: 2px` → `3px`, `margin: 12px 0 8px` → `14px 0 8px`
- Línea 446 (heces `<table>`): `page-break-inside: avoid` → `auto; break-inside: auto`
- Línea 467 (urina `<h3>`): mismo que heces
- Línea 470-471 (urina `<h4>`/`<table>`): mismo tratamiento

**c) `renderTablaInline` — tabla** (línea 380):

`page-break-inside: avoid` → `auto; break-inside: auto` (permite salto entre filas).
Añadir `thead style="page-break-after: avoid"` para mantener encabezado con primera fila.

**d) `descargarPDF` — pagebreak config** (líneas 547-552):

```javascript
pagebreak: {
    mode: ['css', 'legacy'],
    before: '.reporte-area-grupo',
    after: '.reporte-area-titulo, .reporte-subarea-titulo',
    avoid: 'tr, tbody'
}
```

- Remover `avoid-all` (demasiado agresivo)
- Remover `#bloqueHeces, #bloqueUroanalisis` de `before` (no forzar salto antes de heces)
- Remover `.reporte-tabla` de `avoid` (las tablas deben poder dividirse entre filas)

### 4. `reporte.html` — título con espacio inicial

Eliminar el espacio en:
```html
<h6 class="reporte-seccion-titulo">Resultados de Exámenes de Laboratorio</h6>
```
(de `" Resultados..."` a `"Resultados..."`)

## Validación

1. Abrir `vistas/reporte.html?orden=001` en el navegador.
2. Hacer clic en **Imprimir** (ahora llama `descargarPDF()`):
   - [ ] Se descarga un PDF con el título "Resultados de Exámenes de Laboratorio" visible.
   - [ ] Si hay heces cargados, el título "Examen de Heces" visible.
   - [ ] Tablas con celdas legibles (padding ≥ 4 px).
3. Si html2pdf falla (error en consola), el fallback `window.print()`:
   - [ ] Título visible debajo del header fijo (gracias al `padding-top` del container).
   - [ ] Heces/urina no tapados por el footer fijo (heces antes del footer en DOM).
4. `node --check public/js/pdf.js` → sin errores.
5. `grep -r "aquacolor\|border-left-color: aqua" public/css/pdf.css` → sin resultados.

## Archivos afectados

| Archivo | Cambios |
|---------|---------|
| `vistas/reporte.html` | Botón → `descargarPDF()`, DOM reorder, título sin espacio |
| `public/css/pdf.css` | `.reporte-container` padding-top, eliminar CSS duplicado, títulos grandes, overrides Bootstrap, footer padding, `#bloqueUroanalisis` print estilos |
| `public/js/pdf.js` | Título `<h2>` grande, títulos inline grandes, `page-break-inside: auto` en tablas, `pagebreak` config simplificado |
