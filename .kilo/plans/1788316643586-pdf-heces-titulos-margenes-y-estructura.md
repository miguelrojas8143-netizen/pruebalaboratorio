# Plan: Corregir título del PDF de exámenes sin tocar `@page` margin

## Contexto actual (verificado 2026-09-02)

El usuario trabaja con `@page { margin: 10px 12px 65px; }` en `public/css/pdf.css:18` y **no quiere que se modifique**. Con este margen superior de solo 10 px, el header fijo (`position: fixed; top: 0`, ~150 px de alto) cubre la primera parte del contenido en cada página, ocultando el título "Resultados de Exámenes de Laboratorio".

Cambios **ya aplicados previamente** en esta sesión (git diff verificado):

| Archivo | Estado |
|---------|--------|
| `vistas/reporte.html` | DOM reordenado: `#bloqueHeces`/`#bloqueUroanalisis` ahora **antes** de `.reporte-firma-impresion` |
| `public/css/pdf.css` | Eliminado `border-left-color: aqua`, aumentados tamaños de título, `.reporte-tabla` margin corregido, `.reporte-area-grupo` margin unificado a 14px, overrides Bootstrap agregados, `#bloqueUroanalisis` print styling agregado, padding de celdas a 3px 6px |
| `public/js/pdf.js` | Pagebreak simplificado (`mode: ['css','legacy']`, `avoid: 'tr, tbody'`), títulos inline aumentados, tablas heces/urina/perfil con `page-break-inside: auto` |

**Cambio PENDIENTE** (bloqueado por permisos, requiere agente de implementación):

## Problema restante: título oculto por el header fijo

Con `@page { margin: 10px 12px 65px; }`:
- Header fijo: `position: fixed; top: 0`, altura ~150 px → cubre contenido de 10 px a ~150 px
- `.reporte-container` tiene `padding: 0 12px` (sin padding-top)
- El `<h6 class="reporte-seccion-titulo">` aparece a los 10 px del borde → **detrás del header**

El `@page` margin de 10 px no es suficiente para reservar espacio para el header. Como no se puede cambiar el `@page`, la solución es **`padding-top` en `.reporte-container`**:

## Cambios pendientes

### 1. `public/css/pdf.css` — `.reporte-container` (línea 160-166)

Cambiar `padding: 0 12px` → `padding: 155px 12px 0`:

```css
.reporte-container {
    box-shadow: none;
    padding: 155px 12px 0;   /* 155 px top pisa el header fijo (~150 px) + margen @page 10 px */
    max-width: 100%;
    border-radius: 0;
    margin: 0;
}
```

**Razón**: 155 px de padding-top empuja todo el contenido (incluido el título) por debajo del header fijo. El header (`position: fixed; top: 0`) ocupa el margen superior de la página + el padding, y el contenido visible comienza a los ~165 px del borde superior.

**Nota**: Este padding-top solo afecta visualmente a la página 1 (el padding se consume al inicio del contenedor). En páginas 2+, el header fijo seguirá visible (position: fixed) pero el contenido comenzará al top del área de contenido (10 px), solapándose parcialmente con el header. Para reportes de 1 página (caso típico de examen de heces), el título será completamente visible.

**Opcional**: Para mitigar páginas 2+, cambiar `.reporte-encabezado-impresion` de `position: fixed` a `position: static` — el header aparecería solo en página 1 pero sin solapamiento en páginas 2+. **No aplicado por defecto** — se propone como alternativa si el usuario prefiere.

### 2. `public/css/pdf.css` — Corregir comentario del `@page` (línea 18)

El comentario dice "superior 150px" pero el valor es `10px`. Actualizar el comentario para reflejar la realidad:

```css
margin: 10px 12px 65px;/* Márgenes: superior 10px, laterales 12px, inferior 65px. Header fijo compensado con .reporte-container padding-top */
```

## Validación

1. Abrir `vistas/reporte.html?orden=001` (orden con exámen + heces).
2. Pulsar **Imprimir** → `window.print()` → "Guardar como PDF".
3. Verificar en el PDF:
   - [ ] Título "Resultados de Exámenes de Laboratorio" visible en la parte superior (no tapado por header).
   - [ ] Título "Examen de Heces" visible (no tapado por footer).
   - [ ] Tabla de heces con padding de celda legible (≥ 4 px).
   - [ ] Firma visible en el pie de página (margen bottom 65 px es suficiente).
4. `node --check public/js/pdf.js` → sin errores de sintaxis.

## Archivos afectados

| Archivo | Estado |
|---------|--------|
| `public/css/pdf.css` | **Pendiente**: `.reporte-container` padding-top + comentario `@page` |
| `vistas/reporte.html` | ✅ Completado (DOM reordenado) |
| `public/js/pdf.js` | ✅ Completado (pagebreak + estilos inline) |
