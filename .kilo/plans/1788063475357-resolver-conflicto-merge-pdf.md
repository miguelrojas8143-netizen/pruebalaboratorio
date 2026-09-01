# Plan: Resolver conflicto de merge en pdf.js / pdf.css y aclarar impresión sin headers

## Diagnóstico (estado actual)

- Rama `main` divergida de `origin/main`: **1 commit local adelantado**, **3 commits remotos adelantados**.
- `git status` → rutas **no fusionadas (add/add)**:
  - `public/js/pdf.js`
  - `public/css/pdf.css`
- La base común **no contiene** estos archivos → conflicto "agregado por ambos".
- `git diff :2:pdf.js :3:pdf.js` (stage 2 = HEAD/local = *ours*; stage 3 = origin/main = *theirs*):
  - **ours (HEAD)** = versión **con el feature** del plan `1788059793524`: encabezado flex con logo (`../public/imagen/logo1.png`), grid de 6 columnas, etiquetas "Cédula de Identidad" / "Teléfono de Contacto", `vistaPrevia()` → `window.print()`, fallbacks y `catch` con `window.print()`.
  - **theirs (origin/main)** = versión **sin logo** (encabezado centrado, "Cédula:" / "Teléfono:"), con `page-break-inside: auto`, margen `3`, y `window.vistaPrevia()` en el fallback de html2pdf-indefinido.
- **Working tree tiene la versión de `theirs` (sin logo)** (una operación la sobrescribió). Los cambios del plan están **guardados en HEAD (ours)**.
- `vistas/reporte.html` está **limpio** con los 2 botones. Solo `pdf.js` y `pdf.css` están en conflicto.
- Archivos escalonados (incluirán en el próximo commit, no bloquean): 3 `.md` de planes + `.vscode/settings.json`.

## Decisión

- **Aceptar `ours` (HEAD) para ambos archivos** → restaura logo, grid y vista previa nativa (objetivo del plan actual). Se descarta la versión de `origin/main`.
- Las mejoras de salto de página de `origin/main` pueden portarse manualmente después (ver "Opc. 2").
- **Headers del navegador (fecha/título/URL):** `pdf.css` de `origin/main` documenta que `@page { margin: 0 }` **no los suprime** (causaba solapamiento con el header/firma fijos desde página 2). → **Rechazar** el plan escalonado `1787977743274` (propuesta `@page{margin:0}` es incorrecta).

## Pasos (ejecutar — requiere agente con permisos git)

1. Restaurar la versión local (con logo) al working tree:
   `git checkout --ours -- public/js/pdf.js public/css/pdf.css`
2. Marcar como resueltas:
   `git add public/js/pdf.js public/css/pdf.css`
3. Verificar: `git status` → desaparecen "Rutas no fusionadas".
4. Confirmar el merge:
   `git commit -m "Merge origin/main: keep logo header + 6-col patient grid (plan 1788059793524)"`
5. Publicar: `git push origin main`.

### Opcional — mezclar page-break de origin/main (post-merge, Opc. 2)
- `pdf.js buildInlineHtml`: `page-break-inside: avoid` → `auto` en tablas de Heces/Uro/resultados (mantener `avoid` en `tr`/`tbody`).
- `pdf.css`: adoptar reglas `auto` de origin/main (`.reporte-area-grupo { page-break-inside: auto }`).
(Requiere revisión; no incluido en la resolución inmediata.)

## Encabezados de impresión (headers) — solución real

- **`Imprimir` (html2pdf) → PDF descargado SIN headers** (rasteriza solo el reporte). Ya está limpio. ✔
- **`Vista Previa` (native `window.print`) → muestra headers del navegador.** No hay CSS/JS que los quite (el `@page{margin:0}` no funciona, documentado en `pdf.css`).
  - Única opción nativa: en el diálogo de Chrome → *Más ajustes* → desmarcar **Encabezados y pies de página**.
- **Opción código (recomendada para "nunca aparezcan headers"):** reemplazar `vistaPrevia()` de `window.print()` por una preview vía html2pdf que abra el PDF en una pestaña nueva (`html2pdf().from(div).output('bloburl').then(...)`). Así Vista Previa e Imprimir ambos son limpios. (Ver plan de seguimiento; requiere editar `pdf.js`.)

## Validación
- `git status` → working tree limpio (solo los new files staged).
- `git log --oneline -3` → commit de merge presente.
- `node --check public/js/pdf.js` → OK.
- Abrir `vistas/reporte.html?orden=001`:
  - Dos botones: **Vista Previa** e **Imprimir**.
  - **Imprimir** → PDF con logo (izq), nombre/dirección (centro), fecha (der), grid 6 cols, sin headers. ✔
  - **Vista Previa** → diálogo nativo (headers visibles salvo casilla desmarcada).

## Riesgos / Notas
- Aceptar `ours` descarta la versión de `origin/main` de pdf.js/pdf.css. Revisar otros archivos de las 3 commites remotos con `git log --oneline origin/main` si interesa algo más.
- `reporte.html` y el resto del código ya están en HEAD limpios; no participan del conflicto.
