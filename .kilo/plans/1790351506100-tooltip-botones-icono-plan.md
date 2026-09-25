# Plan: Tooltips "hover" para botones de solo icono

## Objetivo
Que los botones de la aplicación que **solo tienen un icono y no tienen texto** muestren un
mensaje informativo al pasar el puntero por encima (antes de clickear).

## Hallazgo clave del codebase
La convención **ya existente** en el proyecto es usar el atributo nativo HTML `title`.
Ejemplos que ya funcionan así:
- `public/includes/header-index.html` (botones `title="Borrar todos los datos"`, `title="Estadísticas"`)
- `index.html` — sidebar (`title="Estadísticas"`, `title="Eliminar Pacientes"`)
- `vistas/orden.html` — catálogo (`title="Catálogo de Exámenes"`), expandir/colapsar (`title="Expandir/Colapsar grupos"`), insertar texto (`title="Insertar texto por defecto"`)
- `public/js/historial.js` (`title="Imprimir orden"`), `public/js/catalogo-admin.js` (`title="Guardar este examen"`)

**Conclusión:** la solución consiste en completar con `title` los pocos botones de icono
que todavía no lo tienen. No se necesita CSS nuevo ni JavaScript de inicialización.

## Alcance de cambios

### 1. `vistas/orden.html` — formulario de orina (footer icon-only)
Botones del formulario de uroanalisis que, a diferencia del formulario de heces (que tiene
texto "Cancelar"/"Guardar Resultados"), son **solo icono** y sin `title`:
- Línea 482 — botón cerrar (×): `onclick="cerrarFormularioUroanalisis()"` → `title="Cerrar formulario"`
- Línea 483 — botón guardar: `onclick="guardarFormularioUroanalisis()"` → `title="Guardar Resultados"`

### 2. `public/js/orden.js` — botón "Eliminar examen" (generado dinámicamente)
El botón de borrado de examen aparece **9 veces** idénticas y sin `title`:
```
<button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)"><i class="bi bi-trash"></i></button>
```
(Verificado: 9 ocurrencias en líneas 264, 285, 298, 303, 311, 313, 318, 330, 332.
La variante de tipo sanguíneo en la línea 307 **ya** tiene `title="Eliminar examen"`.)

Se aplica un único reemplazo global (`replaceAll`) agregando `title="Eliminar examen"`:
```
<button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button>
```

### 3. Botones `btn-close` (×) — opcional / secundario
Son el cierre de modales y formularios. Algunos ya tienen `aria-label="Close"`
(`orden.html` 585/604/625) y otros no. Se propone agregar `title="Cerrar"` a los que no
tienen ni `aria-label`:
- `vistas/orden.html`: 158 (`cerrarFormularioHeces`), 274 (`cerrarFormularioUroanalisis`),
  498 (`cerrarFormularioAntibiograma`), 536 (`cerrarFormularioTipoSanguineo`)
- `index.html`: 184, 221, 246, 264 (modales, `data-bs-dismiss="modal"`)

> Nota: el reemplazo debe ser selectivo para no tocar los que ya tienen `aria-label`
> (aunque duplicar el texto en `title` tampoco es dañino).

## Enfoque elegido (y por qué)
- **Atributo nativo `title`**: consistente con el código existente, cero CSS/JS nuevo,
  accesible, y muestra el mensaje al hover/focus antes del clic. Ideal para una app de
  escritorio (Electron) con interacción por ratón.
- **No** se usa el tooltip de Bootstrap (`data-bs-toggle="tooltip"`): requeriría
  inicializar JS en cada vista y re-inicializarlo sobre los botones creados dinámicamente
  por `renderizarTablaExamenes`. El `title` nativo evita toda esa complejidad y ya es el
  patrón usado en el resto del proyecto.

## Validación
1. Grep para confirmar que no quedan botones de icono sin `title` (repetir los mismos
   patrones de búsqueda usados aquí).
2. `npm run build:includes` (verifica que el build no rompa; los cambios son en HTML/JS
   que no pasan por el inyector de includes, pero se ejecuta de todos modos).
3. Ejecutar la app con `npm start` y pasar el ratón por encima de:
   - el botón de uroanalisis "Guardar"/"Cerrar" en la orden
   - los botones de papelera "Eliminar examen" en la tabla de exámenes
   - los botones `btn-close` (×) de los modales
   Confirmar que aparece el mensaje.

No hay suite de tests automatizada en el proyecto (ni en `package.json` ni tests/).
