# Plan: Restaurar logo, grid del paciente y vista previa

## Problema

Después del cambio anterior (vistaPrevia → descargarPDF), el PDF descargado carece de:
1. **Logo** — el `buildInlineHtml()` actual no incluye la imagen del laboratorio
2. **Grid de datos del paciente** — los datos apilan en vertical en vez de la cuadrícula de 6 columnas del header original
3. **Opción de vista previa** — el usuario quiere poder usar `window.print()` nativo como alternativa

## Solución

Restructurar `buildInlineHtml()` para replicar el header original (logo + info + fecha en flex, datos en grid de 6 columnas), y separar los dos botones: "Imprimir" descarga PDF limpio, "Vista Previa" abre diálogo nativo.

## Cambios

### 1. `public/js/pdf.js` — Revertir `vistaPrevia()` (línea 493-495)

Restaurar impresión nativa:

```js
function vistaPrevia() {
    window.print();
}
```

### 2. `public/js/pdf.js` — Modificar `buildInlineHtml()` (línea 404+)

Reemplazar el bloque de encabezado + datos del paciente (líneas 408-424) para replicar la estructura del header original (`reporte.html:46-71`):

**Header con logo (flex):**
```js
/* Encabezado del laboratorio con logo */
html += '<div style="display: flex; align-items: flex-start; gap: 20px; padding-bottom: 10px; border-bottom: 2px solid #000; margin-bottom: 14px;">';
html += '<div style="flex-shrink: 0;">';
html += '<img src="../public/imagen/logo1.png" alt="logo" style="max-height: 100px; max-width: 100px; object-fit: contain;">';
html += '</div>';
html += '<div style="flex: 1; text-align: center;">';
html += '<div style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">UNIDAD MÉDICO QUIRÚRGICA LUZ CORONADO C. A.</div>';
html += '<div style="font-size: 0.62rem; line-height: 1.35;">Calle Principal Casa N° S/N Barrio Paéz. El Nula, Estado Apure, Venezuela<br>RIF: J-412745735 &nbsp;|&nbsp; Teléfono: 0416 4740671</div>';
html += '</div>';
html += '<div style="font-size: 0.62rem; text-align: right; white-space: nowrap; flex-shrink: 0;">';
html += '<strong>Fecha de Emisión:</strong> ' + escapeHtml(h.fechaEmision);
html += '</div>';
html += '</div>';
```

**Datos del paciente (grid de 6 columnas):**
```js
/* Datos del paciente en grid */
html += '<div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 1px 15px; margin-bottom: 14px; padding-top: 4px; border-top: 1px solid #ccc; font-size: 0.78rem;">';
html += '<div><strong>Nombre y Apellido:</strong> ' + escapeHtml(h.nombre) + '</div>';
html += '<div><strong>Cédula de Identidad:</strong> ' + escapeHtml(h.cedula) + '</div>';
html += '<div><strong>Edad:</strong> ' + escapeHtml(h.edad) + '</div>';
html += '<div><strong>Sexo:</strong> ' + escapeHtml(h.sexo) + '</div>';
html += '<div><strong>Teléfono de Contacto:</strong> ' + escapeHtml(h.telefono) + '</div>';
html += '<div><strong>Orden N°:</strong> ' + escapeHtml(h.orden) + '</div>';
if (h.perfiles.length > 0) html += '<div style="grid-column: 1 / -1;"><strong>Perfil(es):</strong> ' + escapeHtml(h.perfiles.join(', ')) + '</div>';
if (payload.refAdaptadas) html += '<div style="grid-column: 1 / -1;"><strong>Referencias adaptadas:</strong> (' + payload.categoriaRef + ')</div>';
html += '</div>';
```

**Nota sobre las etiquetas:** el HTML original usa "Cédula de Identidad:" y "Teléfono de Contacto:" — el `buildInlineHtml()` actual usa "Cédula:" y "Teléfono:". Se restauran las etiquetas originales.

### 3. `vistas/reporte.html` — Separar botones (línea 27-34)

Cambiar el botón "Imprimir" para que llame directamente a `descargarPDF()` y agregar un botón "Vista Previa" antes:

```html
<button class="btn btn-outline-secondary" onclick="vistaPrevia()">
    <i class="bi bi-eye me-1"></i> Vista Previa
</button>
<button class="btn btn-outline-primary" onclick="descargarPDF()">
    <i class="bi bi-printer me-1"></i> Imprimir
</button>
```

## Validación

1. Abrir `reporte.html?orden=001` en el navegador
2. Verificar que hay dos botones: "Vista Previa" e "Imprimir"
3. Hacer clic en "Imprimir" → descarga PDF con:
   - Logo del laboratorio (izquierda)
   - Nombre + dirección del laboratorio (centro)
   - Fecha de emisión (derecha)
   - Datos del paciente en grid de 6 columnas
   - Sin título/fecha/URL del navegador
4. Hacer clic en "Vista Previa" → abre diálogo de impresión nativo (con headers del navegador)

## Archivos afectados

- `public/js/pdf.js` — `vistaPrevia()` revertido + `buildInlineHtml()` con logo y grid
- `vistas/reporte.html` — Botón "Imprimir" → `descargarPDF()` + nuevo botón "Vista Previa"

## Riesgos / Notas

- **Ruta del logo:** Se usa `../public/imagen/logo1.png` (relativa al documento). html2canvas resuelve la URL relativa al documento base, por lo que debería funcionar. Si no carga, usar ruta absoluta o data URI base64.
- **CSS grid en html2canvas:** Soportado en navegadores modernos. Si hay problemas de renderizado, fallback a `<table>` para el grid del paciente.
- **Sin dependencias circulares:** `vistaPrevia()` → `window.print()` (terminal). Los fallbacks en `descargarPDF()` ya llaman `window.print()` directamente (cambiados anteriormente).
