# Plan: Editar datos de paciente registrado (entrada desde vista Orden)

## Goal
Permitir editar los datos de un paciente ya registrado desde la vista Orden, mediante una página nueva e independiente (`modificar.html` + `modificar.js` + `modificar.css`), accedida mediante una opción "Editar paciente" en `orden.html`.

## Contexto verificado (código)
- Registro paciente (`recepcion.js`, `nuevoPaciente`): `{ id, orden ("001" padded), nombre, sexo ("M"/"F"), cedula, fechaNac (dd/mm/yyyy), telefono, edad, fechaRegistro, examenes, historial, visitas }`.
- Storage: localStorage key `pacientesLab` vía `window.obtenerPacientes()` / `window.guardarPacientes(arr)` (`storage.js`).
- Navegación por `orden`: `orden.html?orden=001`; `window.getOrden()` (`orden.js` línea 592) lee y paddea a 3 dígitos; `initOrden` busca al paciente por `p.orden === orden`.
- Formulario de registro (`index.html` `#formRegistro`) campos: nombre (req), sexo select M/F (req), cédula (opt), fechaNac texto dd/mm/yyyy con `onkeyup="formatearFecha(this); mostrarEdad(this)"`, edad readonly, teléfono (opt). `utils.js` expone `formatearFecha`, `mostrarEdad`, `calcularEdad` (espera dd/mm/yyyy).
- Vistas son HTML separados en `vistas/`; `app.js` enruta por path en DOMContentLoaded (index→initRecepcion, orden→initOrden, reporte→initReporte, catalogo→initCatalogo). `catalogo.html` además se auto-inicializa con script inline.
- Convención de confirmación en vistas orden/recepción = `alert()` (ej. `orden.js` guardarResultados/guardarSolicitud).

## Decisiones
- **D1** Página independiente (no modal): el usuario pidió explícitamente `modificar.html`. → `vistas/modificar.html`.
- **D2** Campos editables: nombre, sexo, cédula, fechaNac, teléfono (espejo de `index.html`). No editables: id, orden, fechaRegistro, visitas, examenes, historial. `edad` es readonly y se recompone desde fechaNac al guardar vía `calcularEdad`.
- **D3** Entrada: botón "Editar paciente" en el encabezado de `.paciente-info` (col-md-4 `.text-end`) de `orden.html`, navegando a `modificar.html?orden=<orden>` usando `window.getOrden()`.
- **D4** Retorno: tras guardar o cancelar, redirigir a `orden.html?orden=<orden>` (se recarga pacientes al entrar → datos visibles actualizados).
- **D5** Página autónoma: `modificar.html` carga dependencias mínimas (bootstrap css+bundle, bootstrap-icons, styles.css, modificar.css, utils.js, storage.js, modificar.js) + script inline `DOMContentLoaded → window.initModificar()`. No carga `app.js`/`orden.js` (aisla la funcionalidad y evita los wrappers de orden.js). Le sigue el precedente de `catalogo.html` (auto-init inline).
- **D6** Confirmación: `alert('Datos del paciente actualizados correctamente.')` al guardar (coincide con la convención actual de orden/recepción). → abierta a usar `bootstrap.Toast` como en `catalogo-admin.js`.
- **D7** Validación: nombre y sexo obligatorios; cédula opcional pero única entre los demás pacientes (espejo del chequeo de duplicado en `recepcion.js`). edad recomputada; si fechaNac es inválida/vacía, edad = null (permitido, igual que recepción).

## Archivos

### Crear
- `vistas/modificar.html` — layout (navbar con `#fechaHoy`, botón "Volver a Órden", card con formulario `#formModificar`: `#modNombre`, `#modSexo` (select M/F), `#modCedula`, `#modFechaNac` (onkeyup formatearFecha+mostrarEdad), `#modEdad` (readonly), `#modTelefono`; botones Guardar/Cancelar; footer). Incluye bootstrap bundle, `modificar.js`, y script inline de inicialización.
- `public/js/modificar.js` — IIFE que expone `window.initModificar()`: lee `?orden=`, carga paciente (por orden), rellena formulario; handler submit → valida → actualiza campos del paciente (preservando id/orden/fechaRegistro/visitas/examenes/historial) → recomputa edad → chequeo unicidad cédula → `guardarPacientes([...])` → alert → redirect a `orden.html?orden=<n>`. Handler Cancel → redirect sin guardar.
- `public/css/modificar.css` — estilos del formulario (espejo de cards de catalogo/recepción; campos requeridos resaltados; estilo readonly edad).

### Modificar
- `vistas/orden.html` — agregar botón "Editar paciente" en el header de `.paciente-info` (col-md-4 `.text-end`):
  `<button class="btn btn-outline-primary btn-sm" onclick="window.location.href='modificar.html?orden='+window.getOrden()"><i class="bi bi-pencil-square me-1"></i> Editar paciente</button>`.

## Flujo de datos
1. Usuario en `orden.html` pulsa "Editar paciente" → navega a `vistas/modificar.html?orden=001`.
2. `initModificar()` lee `orden`, busca paciente en `obtenerPacientes()`, rellena nombre/sexo/cédula/fechaNac/teléfono; muestra edad readonly.
3. Usuario edita → submit valida (nombre/sexo req; cédula única vs otros pacientes) → actualiza los campos del paciente en memoria → recompone edad con `calcularEdad(fechaNac)` → `guardarPacientes(pacientes)` → `alert` de éxito → redirige a `orden.html?orden=<n>`.
4. `orden.html` recarga y lee pacientes → muestra datos actualizados. Cancelar → redirige a `orden.html?orden=<n>` sin guardar.

## Riesgos / alcance
- Editar demographics actualiza el registro compartido del paciente (afecta órdenes pasadas/futuras del mismo paciente) — comportamiento intencional.
- `edad` derivada de fechaNac; si fechaNac queda incompleta/inválida al guardar, edad = null (permitido, como en recepción).
- Archivos nuevos son aditivos; no se alteran estructuras de paciente ni keys de storage.
- Fuera de alcance: no añade edición desde la cola de `index.html`/recepción, ni edición de resultados/exámenes/historial, ni cambio de número de orden/visitas.

## Validación
1. `node --check public/js/modificar.js`.
2. Manual: cargar orden → "Editar paciente" → formulario pre-llenado → editar nombre → guardar → redirige a orden.html → datos actualizados visibles.
3. Manual: cambiar cédula a una usada por otro paciente → bloqueado con `alert`.
4. Manual: Cancelar → vuelve a orden.html sin cambios.
5. Edge: paciente sin cédula (null) → editable, permite vacío.

## Preguntas abiertas (default elegido)
- Q1 Método de confirmación: `alert` (default) vs `bootstrap.Toast`. Recomendado: alert (coincide con convención actual de orden/recepción).
- Q2 Ubicación del entry: top-right del header de `.paciente-info` (default). Alternativa: link pequeño junto al nombre.

## Lista ordenada de tareas
- [ ] Crear `vistas/modificar.html` (layout + formulario + scripts).
- [ ] Crear `public/js/modificar.js` (`initModificar` + lógica guardar/cancelar).
- [ ] Crear `public/css/modificar.css` (estilos formulario).
- [ ] Agregar botón "Editar paciente" a `vistas/orden.html` (header paciente-info).
- [ ] `node --check public/js/modificar.js`.
- [ ] Validación manual (pre-llenado, guardado, unicidad cédula, cancelar).
