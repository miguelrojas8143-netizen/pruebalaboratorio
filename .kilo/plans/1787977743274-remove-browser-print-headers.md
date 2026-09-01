# Plan: Eliminar encabezado/pie de página del navegador en el PDF del reporte

## Problema
Al generar el PDF del reporte (mediante la vista previa de impresión o guardar como PDF del navegador), aparecen dos líneas generadas por el navegador:

- **Parte superior:** `29/8/26, 12:22 a.m. Reporte de Resultados`
- **Parte inferior:** `127.0.0.1:5501/vistas/reporte.html?orden=001`

Estas no provienen del HTML ni de `html2pdf`; son encabezados/pies de página por defecto del navegador (Chrome/Edge/Firefox) al imprimir.

## Decisión
No se modifica `orden.js` ni el HTML. La solución se limita a CSS de impresión.

## Cambios

### 1. `public/css/styles.css`
Dentro del bloque existente `@media print` (línea ~436), agregar al inicio:

```css
    @page {
        margin: 0;
        size: A4 portrait;
    }
    html, body {
        margin: 0;
        padding: 0;
    }
```

Esto le indica al navegador que el contenido usa toda el área de la página, suprimiendo los encabezados/pies de página automáticos.

## Riesgo / Validación
- El `.reporte-container` ya tiene `padding: 148px 12px 50px` en impresión, por lo que el contenido no se superpone con el encabezado y la firma fijos.
- Verificar en Chrome/Edge/Firefox: abrir `reporte.html`, pulsar **Imprimir** y comprobar que ya no aparecen la fecha+hora ni la URL.
- Como el usuario menciona el PDF generado, puede estar usando tanto `vistaPrevia()` (window.print) como `descargarPDF()` (html2pdf). Esta medida cubre el caso de impresión del navegador; html2pdf no agrega esos textos por defecto.
