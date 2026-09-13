# Plan: Corregir paginación del uroanálisis en PDF

## Problema
En `reporte.html?orden=001`, el uroanálisis tiene 22 campos (3 grupos × múltiples parámetros). En el PDF, el banner "Urine Test" se queda al final de una página y las tablas continúan en la siguiente sin el título visible.

## Causa raíz
- `.header-banner` solo tiene `page-break-inside: avoid` pero **falta `page-break-after: avoid`**. Eso permite un salto de página inmediatamente después del banner, dejándolo "huérfano".
- `font-size: 10pt` + `padding: 3px 6px` + `margin-top: 10px` consumen demasiado espacio vertical. Con 22 filas + 3 sub-títulos + banner, el contenido excede el alto útil de una página A4.

## Cambios propuestos

### 1. `public/css/styles.css`
- En `.header-banner`: agregar `page-break-after: avoid; break-after: avoid;`
- Reducir `margin-top` de `.header-banner` de `10px` a `6px`
- En `.tabla-laboratorio`: cambiar `font-size: 10pt` → `9.5pt`
- En `.tabla-laboratorio td`: cambiar `padding: 3px 6px` → `2px 5px`
- En `.tabla-laboratorio thead th`: cambiar `padding: 5px 6px` → `4px 5px`

### 2. `public/css/pdf.css` (dentro de `@media print`)
- Mismos cambios que en `styles.css` para `.header-banner` y `.tabla-laboratorio`

### 3. `public/js/pdf.js`
- En `renderUroDom` y `renderHecesDom`: reducir estilos inline de las tablas:
  - `font-size: 0.78rem` → `0.75rem`
  - `padding: 4px 6px` → `3px 5px`
  - En el `<thead>`: `padding: 4px 6px` → `3px 5px`

## Validación
1. Abrir `reporte.html?orden=001` con un paciente que tenga uroanálisis completo.
2. Hacer clic en "Descargar PDF".
3. Verificar que:
   - El banner "Urine Test" aparece completo en una página (no cortado a la mitad).
   - Si el contenido pasa a la página siguiente, el banner no queda solo al final de la página anterior.
   - Las filas siguen siendo legibles (no se pierde calidad).
   - El resto de secciones (hematología, heces, etc.) no se ven afectadas.
