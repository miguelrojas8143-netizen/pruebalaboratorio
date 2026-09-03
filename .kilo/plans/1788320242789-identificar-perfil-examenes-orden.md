# Plan: Identificar perfil de origen de cada examen en la orden

## Goal

Cuando el bioanalista tiene **dos perfiles** cargados en `orden.html` y comparten exámenes
(p. ej. `hematologia_completa`, `glicemia_basal`, `vdrl`, `creatinina`, `urea`, `hbsag`,
`colesterol_total`, `tgo`, `tgp`, `examen_orina` aparecen en múltiples perfiles), el bioanalista
debe poder ver **a qué perfil pertenece cada examen** mientras llena los resultados en la tabla
`#tablaExamenes`.

## Scope (confirmado por el usuario)

- **orden.html** (pantalla de llenado de resultados).
- NO modificar reporte.html / pdf.js (el reporte ya muestra "Perfil(es)" en el header del paciente).

## Decision rationale

- **Badge sobre tabla plana (una fila por examen)**: los exámenes compartidos aparecen una sola
  vez; el bioanalista ingresa el resultado una vez. Alternativa rechazada: agrupar por perfil con
  encabezados, porque duplicaría los exámenes compartidos y forzaría entrada de resultados duplicada.
- **Taggear con el perfil de nivel superior** que el bioanalista seleccionó (p. ej.
  `perfil_preoperatorio`), incluyendo los exámenes que provienen de sub-perfiles anidados
  (p. ej. la hematología completa que está dentro del perfil preoperatorio).
- `crearExamenDesdeCatalogo` es el punto único de creación de exámenes → añadir parámetro opcional `perfilOrigen`.
- `perfilesOrigen` (array de IDs) es una propiedad más del examen → persiste automáticamente
  con el `JSON.parse(JSON.stringify(...))` que ya usan `guardarResultados` / `guardarSolicitud`.

## Data model

```js
// Nuevo campo opcional en cada examen de window.examenesOrden:
examen.perfilesOrigen = ['perfil_preoperatorio']        // uno
examen.perfilesOrigen = ['perfil_preoperatorio', 'perfil_prenatal'] // compartido entre 2 perfiles
// Sin perfilesOrigen = examen agregado individualmente (no proviene de perfil)
```

## Cambios

### 1. `public/js/orden.js` — `crearExamenDesdeCatalogo` (línea 111)

Aceptar `perfilOrigen` (string, opcional) y almacenarlo:

```js
function crearExamenDesdeCatalogo(datos, perfilOrigen) {
    var nuevoExamen = { ... };           // existente
    // ... manejo de tipos existente ...
    if (perfilOrigen) {
        nuevoExamen.perfilesOrigen = [perfilOrigen];
    }
    return nuevoExamen;
}
```

### 2. `public/js/orden.js` — `agregarExamen` branch perfil (líneas 285-329)

- Pasar `examenId` (el perfil de nivel superior) en ambas llamadas a `crearExamenDesdeCatalogo`:
  - l. 299 (perfil anidado): `window.crearExamenDesdeCatalogo(merged, examenId)`
  - l. 304 (examen hoja):  `window.crearExamenDesdeCatalogo(merged, examenId)`
- En el `.map` de actualización de exámenes existentes (l. 308-320), **acumular** el origen del
  perfil para exámenes que ya estaban (caso de solapamiento entre dos perfiles):

```js
if (actualizado) {
    e.tipo = actualizado.tipo;
    // ... actualizaciones existentes ...
    e.grupo = actualizado.grupo;
    if (examenId) {
        if (!e.perfilesOrigen) e.perfilesOrigen = [];
        if (!e.perfilesOrigen.includes(examenId)) e.perfilesOrigen.push(examenId);
    }
}
```

- Los `nuevos` (l. 307) ya vienen creados con `perfilesOrigen: [examenId]`.

### 3. `public/js/perfiles-modal.js` — `agregarExaminesPerfilSeleccionados` (línea 83-136)

- Al crear nuevos exámenes: pasar `perfilId` → `window.crearExamenDesdeCatalogo(merged, perfilId)`.
- Para exámenes que **ya existen** en la orden (actualmente el `if (window.examenesOrden.some(...)) return;` en l. 99 saltea), cambiar a acumular el perfil en lugar de saltar:

```js
var existente = window.examenesOrden.find(function(e) { return e.id === examenId; });
if (existente) {
    if (perfilId) {
        if (!existente.perfilesOrigen) existente.perfilesOrigen = [];
        if (!existente.perfilesOrigen.includes(perfilId)) existente.perfilesOrigen.push(perfilId);
    }
    return; // salta la creación; ya está en la tabla
}
```

### 4. `public/js/orden.js` — `renderizarTablaExamenes` (línea 173-273)

Añadir helper de badges y una inyección única tras setear `fila.innerHTML` (cobertura 100 % de
ramas: heces, uroanalisis, texto, tipo_sanguineo, seleccion_unica, perfil, multiselect,
default — todas tienen un primer `<td class="fw-semibold">`):

```js
function renderBadgePerfiles(examen) {
    var origen = examen.perfilesOrigen;
    if ((!origen || origen.length === 0) && window.pacienteActivo) {
        // Fallback para datos antiguos: derivar de pacienteActivo.perfiles
        if (window.pacienteActivo.perfiles && window.App.perfiles) {
            origen = window.pacienteActivo.perfiles.filter(function(pid) {
                var p = window.App.perfiles[pid];
                return p && p.examenes.some(function(ex) { return ex.id === examen.id; });
            });
        }
    }
    if (!origen || origen.length === 0) return '';
    var badges = origen.map(function(pid) {
        var p = window.App.perfiles[pid];
        return '<span class="badge-perfil">' + (p ? p.nombre : pid) + '</span>';
    });
    return '<div class="mt-1">' + badges.join('') + '</div>';
}
```

Y tras el `if/else` que asigna `fila.innerHTML` (antes de `tbody.appendChild(fila)`):

```js
var primerTd = fila.querySelector('td.fw-semibold');
if (primerTd) primerTd.innerHTML += renderBadgePerfiles(examen);
tbody.appendChild(fila);
```

### 5. `public/css/styles.css` — estilo del badge (clase `.badge-perfil`)

Badge discreto, legible en pantalla, sin depender de utilidades de Bootstrap 5.3:

```css
.badge-perfil {
    display: inline-block;
    padding: 2px 8px;
    margin: 2px 3px 0 0;
    font-size: 0.7rem;
    font-weight: 600;
    color: #087999;
    background: #e7f4f9;
    border: 1px solid #a7e0f0;
    border-radius: 3px;
}
```

## Qué NO cambia

- `@page` margin en pdf.css (prohibido).
- `reporte.html` / `reporte.js` / `pdf.js` (fuera de scope).
- `eliminarExamen`, `guardarResultados`, `guardarSolicitud` (persistencia automática via JSON).
- Exámenes agregados individualmente (no desde perfil) → no muestran badge.

## Edge cases

| Escenario | Comportamiento |
|---|---|
| Mismo perfil agregado 2× | `perfilesOrigen` no se duplica (verificación `.includes`). |
| Perfil A con examen X, luego Perfil B con mismo X | X queda con `perfilesOrigen = [A, B]`, un solo row, dos badges. |
| Examen individual + mismo examen en perfil | El examen existente acumula el perfil en el `.map`. |
| Datos antiguos (sin `perfilesOrigen`) | Fallback derivado de `pacienteActivo.perfiles`; si `perfiles` también falta, sin badge. |
| Sub-perfil anidado (hematología dentro de preoperatorio) | Tagueado con el perfil de nivel superior `perfil_preoperatorio`. |

## Validación

1. `node --check public/js/orden.js && node --check public/js/perfiles-modal.js` → sin errores.
2. Abrir `orden.html?orden=001`.
3. Agregar `★ Perfil Preoperatorio` y `★ Perfil Prenatal` (ambos comparten `hematología`,
   `glicemia basal`, `VDRL`, `grupo sanguíneo`, `creatinina`, `urea`, `HBsAg`).
   - `Hematología Completa` → badge "Perfil Preoperatorio" + "Perfil Prenatal".
   - `Glicemia Basal` → dos badges.
   - Examen individual → sin badge.
4. Recargar la página → los badges persisten (cargados desde localStorage).

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `public/js/orden.js` | `crearExamenDesdeCatalogo` +1 parámetro; `agregarExamen` perfilar + acumular; `renderizarTablaExamenes` + helper y badges. |
| `public/js/perfiles-modal.js` | `agregarExaminesPerfilSeleccionados` taggear y acumular. |
| `public/css/styles.css` | Clase `.badge-perfil`. |
