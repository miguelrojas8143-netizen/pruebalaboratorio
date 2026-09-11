# Plan: Fix PDF Pagination — Pagebreak Config + Inline Break-Avoid Styles

## Resumen

Combina los cambios CSS ya aplicados (`1788316643586-visible-results-table-layout.md`) con dos modificaciones clave en `pdf.js`:

1. **pagebreak config**: pasar `avoid` como arreglo (no string) y añadir selectores de título
2. **inline styles**: agregar `page-break-after: avoid; page-break-inside: avoid;` a los banners/títulos en los renderers

> **Discrepancia**: el usuario menciona `pdf_2.js`, pero el archivo actual en el repositorio es `public/js/pdf.js`. Todas las rutas en este plan apuntan a `pdf.js`.

> **Conflicto con otro plan**: `.kilo/plans/1788316643586-pdf-heces-titulos-margenes-y-estructura.md` sugirió **eliminar** `avoid-all` por ser "demasiado agresivo". El usuario pide **añadirlo**. Se mantiene `avoid-all` por petición explícita, pero con `avoid` selectivo para minimizar overflow.

## Cambios previamente aplicados (ya hechos)

Estos cambios de la iteración anterior siguen vigentes y NO deben revertirse:

| Archivo | Cambio aplicado |
|---|---|
| `styles.css` `.header-banner` | `+ page-break-after: avoid; break-after: avoid;`, `margin-top: 10px → 6px` |
| `styles.css` `.tabla-laboratorio` | `font-size: 10pt → 9.5pt`, `td padding: 3px 6px → 2px 5px`, `thead th padding: 5px 6px → 4px 5px` |
| `pdf.css` `@media print` | Añadido `.header-banner { margin-top: 6px; page-break-after: avoid; break-after: avoid; }` |
| `pdf.css` `@media print` `.tabla-laboratorio` | Mismas reducciones de `font-size` y `padding` |
| `pdf.js` `renderHecesDom`/`renderUroDom` | Añadido inline `font-size: 0.75rem`, `padding: 3px 5px` en `thead` y `td` |

## Cambios nuevos

### 1. `public/js/pdf.js` — pagebreak config en `descargarPDF()` (línea 528-531)

**Actual:**
```javascript
pagebreak: {
    mode: ['css', 'legacy'],
    avoid: 'tr, tbody'
}
```

**Reemplazar por:**
```javascript
pagebreak: {
    mode: ['avoid-all', 'css', 'legacy'],
    avoid: ['tr', 'td', 'th', 'thead', '.header-banner', '.subarea-titulo', 'h2']
}
```

**Razón técnica:**
- `'tr, tbody'` como string: html2pdf interpreta esto como un único selector `.tr, .tbody` (clases) en algunas versiones, no como tags `tr` y `tbody`. Usar un arreglo `['tr', 'td', ...]` asegura matching correcto.
- `avoid-all` + `css`: fuerza al motor a respetar inline `page-break-*` y a evitar saltos donde sea posible.
- Selectores añadidos: `.header-banner` (bandas azules), `.subarea-titulo` (subtítulos de grupo), `h2` (título principal), `thead`/`th`/`td` (celdas de tabla).

### 2. `public/js/pdf.js` — `renderAreaDom()` (línea 262)

Añadir wrapper `div` con `margin-bottom` y inline `page-break-*` en todos los títulos:

```javascript
function renderAreaDom(seccion, perfilNombre) {
    var html = '<div style="margin-bottom: 12px;">';
    html += '<div class="header-banner" style="page-break-after: avoid; page-break-inside: avoid;">' + seccion.nombre + '</div>';
    if (perfilNombre) {
        html += '<div class="perfil-titulo" style="page-break-after: avoid; page-break-inside: avoid;">' + perfilNombre + '</div>';
    }
    seccion.subareas.forEach(function(sub) {
        if (sub.titulo) {
            html += '<div class="subarea-titulo" style="page-break-after: avoid; page-break-inside: avoid;">' + sub.titulo + '</div>';
        }
        if (sub.rows) {
            html += renderTablaInline(sub.rows);
        }
        if (sub.notas) {
            html += '<div class="subarea-titulo" style="page-break-after: avoid; page-break-inside: avoid;">Notas y Observaciones</div>';
            html += '<div style="background:#f8f9fa;border:1px solid #ccc;border-radius:4px;padding:6px 10px;margin-bottom:6px;white-space:pre-wrap;font-size:9pt; page-break-inside: avoid;">' + escapeHtml(sub.notas) + '</div>';
        }
    });
    html += '</div>';
    return html;
}
```

### 3. `public/js/pdf.js` — `renderHecesDom()` (línea 288)

```javascript
// Cambiar:
var html = '<div class="header-banner">Stool Test</div>';
// Por:
var html = '<div class="header-banner" style="page-break-after: avoid; page-break-inside: avoid;">Stool Test</div>';
```

### 4. `public/js/pdf.js` — `renderUroDom()` (líneas 317-320)

```javascript
// Cambiar:
var html = '<div class="header-banner">Urine Test</div>';
// Por:
var html = '<div class="header-banner" style="page-break-after: avoid; page-break-inside: avoid;">Urine Test</div>';

// Y cambiar:
html += '<div class="subarea-titulo">' + grupo + '</div>';
// Por:
html += '<div class="subarea-titulo" style="page-break-after: avoid; page-break-inside: avoid;">' + grupo + '</div>';
```

## Validación

1. `node --check public/js/pdf.js` — sin errores de sintaxis
2. Abrir `vistas/reporte.html?orden=001` en navegador
3. Click "Imprimir" → `descargarPDF()` (usa html2pdf)
4. Verificar en PDF descargado:
   - El banner "Urine Test" no está solito al final de una página
   - El banner "Stool Test" aparece completo con su tabla
   - Los subtítulos (Macroscópico, Químico, Microscópico) no se separan de sus tablas
   - Las filas de tabla (tr) no se cortan a la mitad
   - El resto de secciones (Hematología, Química, etc.) no se ven afectadas
5. Si html2pdf falla → fallback `window.print()`: CSS `@media print` en `pdf.css` cubre los mismos `page-break` rules
