# Plan: Fix PDF title to show patient name + order number instead of UUID

## Problem

The PDF title (shown in print dialog / file properties) currently reads:
`Reporte de resultados - a57b1bb9-790c-4d86-855e-d50250d474c5`

The UUID is `paciente.nombre` (from localStorage). The desired format is:
`Reporte de resultados - marques-003` (patient name + order number).

## Root Cause

- `public/js/pdf.js:533` — `doc.setProperties({ title: 'Reporte de resultados - ' + textoPlano(h.nombre), ... })` uses only `h.nombre`, which is `paciente.nombre` (stored in `localStorage['pacientesLab']`).
- For the patient with `orden=003`, the `nombre` field in localStorage contains a UUID instead of a readable name.

## Changes

### 1. `public/js/pdf.js:533` — Include order in PDF title

```javascript
// Current
doc.setProperties({ title: 'Reporte de resultados - ' + textoPlano(h.nombre), subject: 'Resultados de laboratorio' });

// New
doc.setProperties({ title: 'Reporte de resultados - ' + textoPlano(h.nombre) + '-' + textoPlano(h.orden), subject: 'Resultados de laboratorio' });
```

This produces: `Reporte de resultados - [nombre]-[orden]` (e.g. `Reporte de resultados - marques-003`).

### 2. Data fix — Patient name in localStorage

If the patient's `nombre` in localStorage is a UUID, the title will still show the UUID + order. The user should verify the patient's `nombre` field:

- Open Dev Tools → Application → Local Storage → `pacientesLab`
- Find the patient with `orden: "003"`
- Check the `nombre` field — if it's a UUID, update it to a readable name (e.g. `Marqués`)

## Validation

1. `node --check public/js/pdf.js` — syntax check
2. Load `vistas/reporte.html?orden=003` and click "Imprimir"
3. In the print dialog, verify the PDF title shows `Reporte de resultados - [nombre]-[orden]`
