# Plan: Eliminar título, fecha y URL del PDF generado

## Problema

Al usar el botón "Imprimir" en `reporte.html` (que ejecuta `window.print()`), el navegador añade automáticamente al PDF:
1. **"Reporte de Resultados"** — proviene del `<title>` del HTML (línea 6)
2. **"29/8/26, 11:09 p.m."** — fecha/hora que el navegador inserta como encabezado
3. **"127.0.0.1:5500/vistas/reporte.html?orden=001"** — URL que el navegador inserta como pie de página

Estos elementos **no pueden eliminarse vía CSS** cuando se usa `window.print()` — son controlados por el diálogo de impresión del navegador.

## Solución

Reemplazar `window.print()` por la descarga directa con **html2pdf.js** (ya incluido en el proyecto), que genera el PDF desde el contenido HTML sin añadir encabezados/pies del navegador.

## Cambios

### 1. `public/js/pdf.js` — Modificar `vistaPrevia()` (línea 493-495)

Reemplazar:
```js
function vistaPrevia() {
    window.print();
}
```

Por:
```js
function vistaPrevia() {
    descargarPDF();
}
```

Esto hace que el botón "Imprimir" descargue el PDF directamente vía html2pdf en lugar de abrir el diálogo del navegador.

## Validación

1. Abrir `reporte.html?orden=001` en el navegador
2. Hacer clic en el botón "Imprimir"
3. Verificar que se descarga un archivo PDF sin:
   - "Reporte de Resultados" como encabezado
   - Fecha/hora como encabezado
   - URL como pie de página

## Archivos afectados

- `public/js/pdf.js` — 1 función modificada (`vistaPrevia`)
