# Plan: Mostrar todos los resultados en el PDF (paginación sin cortes)

## Problema
Al generar el PDF desde `reporte.html?orden=001`, **no aparecen todos los resultados**
y los que aparecen salen **cortados/incompletos**. Cuando hay muchos exámenes, el contenido
debe continuar en otra página sin ser truncado.

## Causas raíz (verificado en código)

### Causa 1 — `page-break-inside: avoid` impide dividir contenido (CRÍTICA)
Archivo `public/css/styles.css`, bloque `@media print`:

- `.reporte-tabla table`, `#bloqueHeces table`, `#bloqueUroanalisis table`
  (`styles.css:574-580`) → `page-break-inside: avoid;`. La tabla entera NO puede
  cortarse entre páginas. Si una tabla de resultados es más alta que una página,
  el resto se corta/traspasa y se pierde.
- `.reporte-area-grupo` (`styles.css:622-626`, segunda definición) →
  `page-break-inside: avoid;`. El grupo de área completo no puede dividirse.

Esto es lo que produce "resultados incompletos". Las filas (`tr`, `styles.css:593-596`)
**sí** deben quedarse juntas (no dividir una fila) — esa regla se mantiene.

### Causa 2 — Encabezado/firma fijos se superponen al contenido en páginas 2+ (IMPORTANTE)
- `@page { margin: 0; }` (añadido en la tarea anterior) deja sin márgenes la página.
- `.reporte-encabezado-impresion` es `position: fixed; top: 0` (~148 px) y
  `.reporte-firma-impresion` es `position: fixed; bottom: 0` (~50 px).
- `.reporte-container` tiene `padding: 148px 12px 50px`, pero ese padding solo
  desplaza el contenido de la **primera** página. En páginas 2+ el contenido
  arranca en la parte superior y queda **oculto detrás del encabezado fijo** →
  "no salen todos los resultados".

## Ruta de generación de PDF vigente
- `vistaPrevia()` → `window.print()` → navegador "Guardar como PDF". Es la **única**
  acción de PDF visible en `reporte.html` (botón "Imprimir", `reporte.html:28`).
  Usa las reglas `@media print` de `styles.css`.
- `descargarPDF()` (html2pdf, `orden.js:573`) está definida pero **no está enlazada
  a ningún botón**. Se corrige por completitud (tarea secundaria).

## Cambios

### 1. `public/css/styles.css` — permitir paginación entre filas
Dentro de `@media print`:

a) **`.reporte-tabla table`, `#bloqueHeces table`, `#bloqueUroanalisis table`**
   (`styles.css:574-580`): cambiar `page-break-inside: avoid;` / `break-inside: avoid;`
   por `auto` (o eliminarlos). Esto permite que una tabla larga se divida entre
   páginas, **cortando entre filas** (no dentro de una).

b) **`.reporte-area-grupo`** (`styles.css:622-626`): cambiar
   `page-break-inside: avoid;` / `break-inside: avoid;` por `auto`. Un área larga
   puede paginarse entre áreas.

c) `.reporte-tabla tr` (`styles.css:593-596`): **conservar** `page-break-inside: avoid;`
   → las filas (una fila de examen) nunca se cortan a la mitad.

### 2. `public/css/styles.css` — reservar márgenes de página para encabezado/firma
Reemplazar el `@page` actual (`styles.css:437-440`) para reservar espacio en
**cada** página donde van el encabezado fijo (arriba) y la firma (abajo):

```css
@page {
    size: A4 portrait;
    margin: 148px 12px 50px;   /* top = encabezado fijo, bottom = firma fija */
}
```

Y ajustar el padding del contenedor (que antes compensaba el encabezado solo en
la primera página, `styles.css:566-572`), ya que ahora los márgenes de página
reservaron ese espacio en **todas** las páginas:

```css
.reporte-container {
    box-shadow: none;
    padding: 0 12px;          /* antes: 148px 12px 50px */
    max-width: 100%;
    border-radius: 0;
    margin: 0;
}
```

Resultado: el encabezado (`position: fixed; top: 0; background: white`) y la firma
(`position: fixed; bottom: 0; background: white`) se dibujan en la caja de
márgenes de cada página (detrás/cubierto por su fondo blanco), y el contenido
(fluido) ocupa el área de contenido que queda libre en cada página → **sin
solapamiento en páginas 2+** y el encabezado/firma aparecen en todas partes sin
cortar resultados.

> Nota: el encabezado y firma ya tienen `background: white`
> (`styles.css:459` y `:531`), por lo que enmascaran cualquier encabezado/pie
> automático del navegador que el usuario haya activado en el cuadro de diálogo de
> impresión.

### 3. `public/js/orden.js` — ruta `descargarPDF` (tarea secundaria, no enlazada a UI)
- `styles.css` no afecta a html2pdf (html2canvas no aplica `@media print` por
  defecto). El fallback (rama A, `orden.js:625`) genera tablas con
  `page-break-inside: avoid` inline → cambiar a `auto` para permitir paginación.
- Rama B (`#area-imprimir`, `orden.js:683`): usar `margin: 0` en la config de
  html2pdf y reservar top/bottom vía `@page` (ya no aplicable dentro de html2canvas
  de forma automática). Se sugiere usar la rama B (DOM real) con CSS de pantalla
  duplicado o mantener solo la rama A corregida. **Deferido / secundario** a menos
  que el usuario enlace un botón a `descargarPDF`.

## Riesgos / Validación
- Cambiar `.reporte-area-grupo` y tablas a `page-break-inside: auto` significa que
  una tabla puede comenzar en una página y terminar en otra; las filas individuales
  se mantienen completas (gracias al `avoid` en `tr`). Se verifica que no quede una
  fila medio cortada.
- Verificar en Chrome y Firefox: abrir `reporte.html?orden=001`,
  **Imprimir → Guardar como PDF** y comprobar:
  1. Aparecen **todos** los exámenes/resultados.
  2. Las tablas se dividen entre páginas entre filas (no a la mitad).
  3. El encabezado y la firma aparecen en cada página sin superponer el contenido.
  4. No hay resultados ocultos detrás del encabezado en páginas 2+.
- Usar un paciente con muchos exámenes (p. ej. perfil sanguíneo completo) para
  forzar 2+ páginas.
