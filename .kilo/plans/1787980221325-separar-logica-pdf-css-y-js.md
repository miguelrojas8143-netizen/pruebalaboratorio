# Plan: Separar la lógica PDF en `public/css/pdf.css` y `public/js/pdf.js`

## Objetivo
Desacoplar la lógica de generación/imprenta del PDF de `styles.css` y `orden.js` en dos módulos dedicados — `pdf.css` (estilos de impresión) y `pdf.js` (pipeline de resultados → PDF) — para que exista **un solo punto de control** sobre qué exámenes/resultados se cargan en el PDF antes de imprimir o descargar.

## Contexto verificado (data flow)

- Única ruta de impresión activa: `reporte.html` → botón "Imprimir" (`reporte.html:28`) → `window.vistaPrevia()` (`orden.js:569`) → `window.print()`.
- `window.descargarPDF()` (`orden.js:573`) está definido pero **no enlazado a ningún botón** → invocable solo desde consola.
- `irAImpresion()` (`orden.js:538`) solo navega a `reporte.html`; **`orden.html` nunca se imprime**.
- `app.js:28` llama `window.initReporte(orden)` en `reporte.html`; `reporte.js:initReporte` construye `#contenedorResultados`, `#bloqueHeces`, `#bloqueUroanalisis` + rellena el header.
- `reporte.js:renderTablaArea` y el bloque A inline de `descargarPDF` (`orden.js:625`) **duplican** la clasificación de resultados (ref adaptadas, `↓/↑`, parseo de frotis `multiselect_cantidad`, uro/uroanalisis/heces). Esta duplicación es el núcleo de lo que se unifica.
- `build-includes.js` es un no-op en las vistas (no hay `<!-- @include -->` en `reporte.html`/`orden.html`); los `<link>`/`<script>` inline son autoridad persistente.
- Helpers globales disponibles antes de `orden.js`/`reporte.js` (carga en `reporte.html:128-146`): `obtenerPacientes`, `normalizarExamen`, `aplicarReferenciasAdaptadas`, `agruparUroanalisisPorGrupo`, `agruparSecrecionVaginalPorGrupo`, `separarVSG`, `tieneDatosHeces`, `tieneDatosUroanalisis`, `interpretarSustanciasReductoras`, `UROANALISIS_FIELDS`, `detectarPerfilesPaciente`.
- `html2pdf.bundle.min.js` se carga en `reporte.html:127` (antes de `orden.js`). No se carga en `orden.html`.

## Decisiones (resueltas con recomendación)

| # | Decisión | Recomendado | Alternativa (menor) |
|---|----------|-------------|---------------------|
| 1 | Modelo de payload unificado vs. traslado lineal | **`PdfReport.buildPayload(paciente)`** como única fuente de datos; dos renderers (`renderDom` para pantalla/impresión, `buildInlineHtml` para html2pdf) | Solo mover `vistaPrevia`/`descargarPDF` a `pdf.js` sin unificar datos |
| 2 | Responsabilidad de `initReporte` | Conserva guarda (sin resultados → `#sinResultados`) y lookup; **delega render a `PdfReport.renderDom`** | Mantener render en `reporte.js` |
| 3 | `descargarPDF` | Unificar en **rama A** (inline HTML desde el payload); **eliminar rama B** (DOM `#area-imprimir`) | Mantener rama B con `usePrintMedia`/`windowStyles` |
| 4 | Extracción CSS | Mover el **@media print completo** a `pdf.css`; vincular solo en `reporte.html` | Vincular también en `orden.html` (no imprime; opcional) |
| 5 | `vistaPrevia`/`descargarPDF` en `orden.js` | **Eliminar** de `orden.js`; definir en `pdf.js` (re-exponer en `window`) | Dejar duplicado en `orden.js` |
| 6 | Orden de carga `pdf.js` | Después de `reporte.js`, antes de `app.js` (garantiza helpers y `initReporte` definidos) | — |

## Límites de archivos

- **NUEVO** `public/css/pdf.css` → contiene el bloque `@media print { … }` trasladado (con los fix ya aplicados: `@page margin: 148px 12px 50px`, `.reporte-container padding: 0 12px`, `page-break-inside: auto` en tablas y `.reporte-area-grupo`, `avoid` preservado en `tr`).
- **EDITAR** `public/css/styles.css` → **eliminar** el bloque `@media print` completo. Mantener en `styles.css` las reglas generales que sólo afectan a la vista (`body`, `.reporte-container` base, `.solo-imprimir {display:none}`, `.firma-print {display:none}`, `.orden-print-header {display:none}`, etc.).
- **NUEVO** `public/js/pdf.js` → namespace `window.PdfReport` con: `buildPayload(paciente)`, `renderDom(payload, root)`, `buildInlineHtml(paciente)`, `vistaPrevia()`, `descargarPDF()`.
- **EDITAR** `public/js/orden.js` → **borrar** `window.vistaPrevia` y `window.descargarPDF`. Conserva `irAImpresion`, `getOrden` y el resto.
- **EDITAR** `public/js/reporte.js` → `initReporte` pasa a: lookup + guardas + `PdfReport.renderDom(payload, '#area-imprimir')`. **Borrar** `renderTablaArea` y el código DOM de heces/uro (se traslada a `pdf.js`). `initReporte` ya no exporta nada extra.
- **EDITAR** `vistas/reporte.html` → agregar `<link href="../public/css/pdf.css" rel="stylesheet">` tras `styles.css` (≈línea 16) y `<script src="../public/js/pdf.js"></script>` tras `reporte.js` (≈línea 149).

> Regla de compatibilidad: `renderDom` debe generar markup idéntico al actual `reporte.js` (clases Bootstrap `table table-bordered table-sm`, `resultado-bajo-texto`, etc.) para que la vista on-screen de `reporte.html` no cambie visualmente.

## Flujo de datos de `PdfReport` (consolidado)

`buildPayload(paciente)` reproduce y une la lógica migrada:
1. `examenes = paciente.examenes`; separar `heces` / `uroanalisis` / normales.
2. Migrar uróis individulares `ur_*` a formulario uro (bloque `orden.js`-`initReporte` 20-41).
3. Aplicar referencias adaptadas (`aplicarReferenciasAdaptadas`) si `paciente.refAdaptadas`.
4. `header`: nombre, cédula, edad, sexo, teléfono, orden, fechaEmisión, perfiles (`detectarPerfilesPaciente`), badge ref-adaptadas (categoría pedagógica/adultas).
5. `firma`: `{nombre:'Lcda. Andréina Rondón', cargo:'Bioanalista Responsable', colegiados:'C.B. 17.774 | MPPS 20.913'}` (texto estático del HTML actual).
6. `areas[]`: agrupar normales por `normalizarExamen().area`, ordenar; cada fila clasificada (multiselect_cantidad → parseo frotis; texto/seleccion_unica → sin ref; numérico → `↓/↑/→` con `clase`).
7. Áreas especiales: **Uroanálisis** (`agruparUroanalisisPorGrupo`), **Secreción Vaginal** (`agruparSecrecionVaginalPorGrupo` + notas_frotis), **Hematología** (`separarVSG` → V.S.G. + otros).
8. `heces`: parse JSON → filas (incl. `interpretarSustanciasReductoras(texto)`).
9. `uro`: `UROANALISIS_FIELDS` agrupados por `grupo`, orden `['Macroscópico','Químico','Microscópico']`.

`renderDom(payload, root)` rellena: header fields (`#reporteNombre`, `#reporteCedula`, `#reporteEdad`, `#reporteSexo`, `#reporteTelefono`, `#ordenNumero`, `#fechaEmision`, `#reportePerfil`, `#reporteRefAdaptadas`) y construye `#contenedorResultados` (áreas → `.reporte-area-grupo`), `#bloqueHeces`, `#bloqueUroanalisis` — idéntico markup a hoy.

`buildInlineHtml(paciente)` reproduce el bloque A de `descargarPDF` (estilos inline) pero leyendo del payload y con `page-break-inside: auto` en la tabla (ya corregido).

## Orden de trabajo (tasks)

1. **`pdf.css`** — Cortar el bloque `@media print { … }` de `styles.css` (ver estilo de la línea 436-646 actual) y pegarlo en `public/css/pdf.css` como único contenido (con encabezado de sección). Verificar que incluye los fix del plan anterior (`@page`, `.reporte-container`, page-break).
2. **`styles.css`** — Eliminar el bloque `@media print` (ya trasladado). Confirmar que persisten las reglas base no-print.
3. **`pdf.js`** — Crear IIFE `'use strict'` exponiendo `window.PdfReport`. Incluir:
   - `buildPayload(paciente)` (consolidar migración + clasificación + áreas especiales + heces/uro).
   - `renderDom(payload, root)` (rellenar header + `#contenedorResultados`/`#bloqueHeces`/`#bloqueUroanalisis`; markup idéntico).
   - `buildInlineHtml(paciente)` (rama A con `page-break-inside: auto`).
   - `vistaPrevia()` → `window.print()` (mantener).
   - `descargarPDF()` → html2pdf rama A desde payload; **guard** `typeof html2pdf !== 'undefined'` (p.ej. `if (typeof html2pdf === 'undefined') { vistaPrevia(); return; }`).
4. **`orden.js`** — Borrar `window.vistaPrevia` (569) y `window.descargarPDF` (573-698). No tocar `irAImpresion`/`getOrden`.
5. **`reporte.js`** — Simplificar `initReporte`: conservar lookup + guardas (no paciente / `vacio` / sin resultados), reemplazar el cuerpo DOM (43-181) por `var payload = PdfReport.buildPayload(paciente); PdfReport.renderDom(payload, document.getElementById('area-imprimir'));`. Borrar `renderTablaArea`. Mantener `window.initReporte = initReporte`.
6. **`reporte.html`** — `<link pdf.css>` después de `styles.css`; `<script pdf.js>` después de `reporte.js`, antes de `catalogo-admin.js`.
7. **`orden.html`** (opcional/safety) — NO vincular `pdf.js`/`pdf.css` (no imprime ni descarga allí). Si se añade ruta de impresión de orden, vincularlas igual.

## Riesgos y validación

- **Regresión on-screen**: `renderDom` debe producir markup idéntico. Validar visualmente en `reporte.html?orden=001` (lista, colores `↓/↑`, badge ref-adaptadas, header, firma).
- **Orden de scripts**: `pdf.js` carga después de `reporte.js` y de todos los helpers, pero antes de `app.js` → `PdfReport` definido antes de `DOMContentLoaded` → `initReporte`. Confirmar con `console.log(typeof window.PdfReport)` tras cargar.
- **`build-includes.js`**: no-op en estas vistas (sin `<!-- @include -->`); los edits inline persisten. No afecta.
- **html2pdf offline**: `typeof html2pdf` guard evita crash si la lib no está. Probar `window.descargarPDF()` desde consola en `reporte.html`.
- **Validación de impresión** (repetir plan anterior): abrir `reporte.html?orden=001`, Imprimir → Guardar como PDF:
  1. Aparecen **todos** los exámenes/resultados.
  2. Tablas se dividen entre páginas entre filas (no a la mitad).
  3. Header y firma aparecen en cada página sin superponer contenido.
  4. No hay resultados ocultos tras el header en páginas 2+.
  Usar paciente con perfil sanguíneo completo para forzar 2+ páginas. Verificar con "Background graphics" ON.
- **Sintaxis**: `node --check public/js/pdf.js` y `node --check public/js/orden.js`; chequear balance de llaves en `pdf.css`.

## Fuera de alcance (para esta iteración)
- Añadir botón UI "Descargar PDF" en `reporte.html` (actualmente `descargarPDF` no tiene botón). Se propone como **follow-up opcional**: `<button onclick="PdfReport.descargarPDF()">Descargar PDF</button>`.
- Unificar `html2pdf` rama B (DOM). Se descarta por complejidad de `usePrintMedia`; rama A es canónica.
- Toques visuales nuevos del PDF (diseño de tablas/firma). Sólo refactorización estructural.
