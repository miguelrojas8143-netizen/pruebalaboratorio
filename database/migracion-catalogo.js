'use strict';

/**
 * Migración automática del catálogo: lee los archivos .js de configuración
 * legacy (catálogo, parámetros y valores de referencia), los normaliza y los
 * puebla en SQLite resolviendo todas las claves foráneas.
 *
 * Diseño:
 *  - Los .js se evalúan en un contexto `node:vm` aislado y con `timeout`, de
 *    modo que el proceso principal nunca los carga ni ejecuta código del
 *    renderer.
 *  - Todas las escrituras ocurren dentro de una única transacción con
 *    `PRAGMA foreign_keys = ON`, prepared statements y UPSERT: el script es
 *    idempotente y se puede reejecutar en cada arranque.
 *  - Nunca se concatena texto en SQL: los valores viajan siempre como
 *    parámetros vinculados.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { crearEsquemaCatalogo, absorberParametrosLegados } = require('./schema');

/** Archivos de configuración que alimentaban el catálogo en el renderer. */
const ARCHIVOS_FUENTE = [
    { archivo: 'public/js/catalogo-base.js', clave: 'catalogo' },
    { archivo: 'public/js/examenes-detallados.js', clave: 'examenesDetallados' },
    { archivo: 'public/js/referencias.js', clave: 'referencias' },
    { archivo: 'public/js/perfiles.js', clave: 'perfiles' }
];

/**
 * Orden de aparición en pantalla para las pruebas compuestas cuyo orden natural
 * de declaración no coincide con el que se muestra en el formulario.
 */
const ORDENES_RENDER = {
    hematologia_completa: [
        'globulos_blancos',
        'neutrofilos_num', 'linfocitos_num', 'eosinofilos_num', 'monocitos_num', 'basofilos_num',
        'neutrofilos_por', 'linfocitos_por', 'eosinofilos_por', 'monocitos_por', 'basofilos_por',
        'plaquetas', 'globulos_rojos', 'hemoglobina', 'hematocrito', 'vcm', 'hcm', 'chcm',
        'rdw_cv', 'vpm', 'pdw', 'plcr', 'vsg'
    ]
};

/** Categorías sintéticas para pruebas que no viven en un área del catálogo. */
const CATEGORIA_PERFILES = { id: 'perfiles', nombre: 'Perfiles', orden: 900 };

const TIPOS_DATO = {
    numerico: 'numerico',
    texto: 'texto',
    calculado: 'numerico',
    seleccion_unica: 'seleccion_unica',
    multiselect_cantidad: 'multiselect_cantidad',
    perfil: 'numerico',
    uroanalisis: 'numerico',
    heces: 'texto',
    antibiograma: 'texto',
    secrecion_vaginal: 'seleccion_unica',
    tipo_sanguineo: 'texto',
    tipo_sanguineo_completo: 'texto'
};

const FORMULARIOS_POR_TIPO = {
    uroanalisis: 'uroanalisis',
    heces: 'heces',
    antibiograma: 'antibiograma'
};

// --------------------------------------------------------------------------
// 1. Lectura de los archivos .js de configuración
// --------------------------------------------------------------------------

/**
 * Evalúa un archivo de configuración del renderer dentro de un contexto aislado.
 * El timeout corta cualquier bucle infinito; el resultado es un objeto plano
 * con las claves que ese archivo publica en `window.App`.
 */
function evaluarArchivoConfiguracion(rutaAbsoluta) {
    const codigo = fs.readFileSync(rutaAbsoluta, 'utf8');
    const sandbox = { window: { App: {} }, console: console };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox, { name: 'catalogo-config:' + path.basename(rutaAbsoluta) });
    vm.runInContext(codigo, sandbox, { filename: rutaAbsoluta, timeout: 5000 });
    return sandbox.window.App;
}

/**
 * Lee y fusiona todos los archivos de configuración.
 * @param {string} raizProyecto carpeta raíz del proyecto
 */
function leerConfiguracionDesdeArchivos(raizProyecto) {
    const configuracion = {
        catalogo: [],
        examenesDetallados: {},
        referencias: {},
        perfiles: {}
    };

    ARCHIVOS_FUENTE.forEach(function(fuente) {
        const ruta = path.join(raizProyecto, fuente.archivo);
        if (!fs.existsSync(ruta)) {
            console.warn('  ! archivo de configuración no encontrado: ' + fuente.archivo);
            return;
        }
        const app = evaluarArchivoConfiguracion(ruta);
        Object.keys(app).forEach(function(clave) {
            const valor = app[clave];
            if (Array.isArray(valor)) {
                configuracion[clave] = (configuracion[clave] || []).concat(valor);
            } else if (valor && typeof valor === 'object') {
                configuracion[clave] = Object.assign(configuracion[clave] || {}, valor);
            }
        });
    });

    return configuracion;
}

// --------------------------------------------------------------------------
// 2. Normalización del dataset
// --------------------------------------------------------------------------

function aSlug(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'general';
}

function aNumero(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
}

function aEntero(valor, porDefecto) {
    const n = Number(valor);
    return Number.isFinite(n) ? Math.trunc(n) : porDefecto;
}

function tipoDatoDe(tipo) {
    return TIPOS_DATO[tipo] || 'numerico';
}

function formularioDe(tipo) {
    return FORMULARIOS_POR_TIPO[tipo] || null;
}

/**
 * Convierte la configuración cruda en filas normalizadas listas para SQLite.
 * Es una función pura: no toca la base de datos.
 */
function normalizarConfiguracion(configuracion) {
    const categorias = new Map();
    const examenes = new Map();
    const parametros = [];
    const rangos = [];
    const opcionesExamen = [];
    const opcionesParametro = [];
    const perfiles = [];
    const perfilesExamenes = [];

    function registrarCategoria(nombre) {
        const limpio = String(nombre || 'General').trim() || 'General';
        const id = aSlug(limpio);
        if (!categorias.has(id)) {
            categorias.set(id, { id: id, nombre: limpio, orden: 0 });
        }
        return id;
    }

    function registrarExamen(examen) {
        const id = examen.id;
        if (!id) return null;
        if (!examenes.has(id)) {
            examenes.set(id, {
                id: id,
                categoria_id: registrarCategoria(examen.area),
                nombre: examen.nombre || id,
                unidad: examen.unidad || '',
                tipo: examen.tipo || 'numerico',
                tipo_formulario: formularioDe(examen.tipo),
                grupo: examen.grupo || '',
                valor_defecto: examen.valorDefecto === undefined ? null : examen.valorDefecto,
                ref_min: aNumero(examen.refMin),
                ref_max: aNumero(examen.refMax),
                ref_texto: examen.refTexto || '',
                orden: examenes.size
            });
        }
        return examenes.get(id);
    }

    function registrarRangoBase(rango) {
        if (rango.ref_min === null && rango.ref_max === null && !rango.ref_texto) return;
        rangos.push({
            examen_id: rango.examen_id || null,
            parametro_examen_id: rango.parametro_examen_id || null,
            parametro_codigo: rango.parametro_codigo || null,
            sexo: 'ambos',
            categoria_edad: 'adulto',
            edad_min: null,
            edad_max: null,
            ref_min: rango.ref_min,
            ref_max: rango.ref_max,
            ref_texto: rango.ref_texto || '',
            orden: 0
        });
    }

    // --- 2.1 Catálogo base: una fila en `examenes` por prueba ---------------
    (configuracion.catalogo || []).forEach(function(item) {
        const fila = registrarExamen(item);
        if (!fila) return;
        registrarRangoBase({ examen_id: fila.id, ref_min: fila.ref_min, ref_max: fila.ref_max, ref_texto: fila.ref_texto });
        if (Array.isArray(item.opciones)) {
            item.opciones.forEach(function(valor, indice) {
                if (valor === null || valor === undefined || valor === '') return;
                opcionesExamen.push({ examen_id: fila.id, orden: indice, valor: String(valor) });
            });
        }
    });

    // --- 2.2 Pruebas compuestas: una fila en `parametros_examen` por ítem ----
    const examenesDetallados = configuracion.examenesDetallados || {};
    Object.keys(examenesDetallados).forEach(function(examenId) {
        const detalle = examenesDetallados[examenId];
        const items = (detalle && detalle.items) || [];
        if (items.length === 0) return;

        const filaExamen = registrarExamen({
            id: examenId,
            nombre: detalle.nombre || examenId,
            area: (items[0] && items[0].area) || CATEGORIA_PERFILES.nombre,
            tipo: 'perfil'
        });

        const ordenRender = ORDENES_RENDER[examenId];
        items.forEach(function(item, indice) {
            if (!item || !item.id) return;
            const fila = {
                codigo: item.id,
                examen_id: examenId,
                nombre: item.nombre || item.id,
                tipo_dato: tipoDatoDe(item.tipo),
                tipo_interfaz: item.tipo || 'numerico',
                unidad: item.unidad || '',
                grupo: item.grupo || 'General',
                valor_defecto: item.valorDefecto === undefined ? null : item.valorDefecto,
                ref_min: aNumero(item.refMin),
                ref_max: aNumero(item.refMax),
                ref_texto: item.refTexto || '',
                obligatorio: item.obligatorio ? 1 : 0,
                orden: indice,
                orden_render: ordenRender ? Math.max(0, ordenRender.indexOf(item.id)) : indice
            };
            parametros.push(fila);
            registrarRangoBase({
                parametro_examen_id: examenId,
                parametro_codigo: fila.codigo,
                ref_min: fila.ref_min,
                ref_max: fila.ref_max,
                ref_texto: fila.ref_texto
            });
            if (Array.isArray(item.opciones)) {
                item.opciones.forEach(function(valor, i) {
                    if (valor === null || valor === undefined || valor === '') return;
                    opcionesParametro.push({ examen_id: examenId, codigo: fila.codigo, orden: i, valor: String(valor) });
                });
            }
        });

        // Los parámetros NO se registran como pruebas del catálogo: no son
        // seleccionables de forma individual. El historial los resuelve a
        // través de la vista vw_parametros_catalogo.
    });

    // --- 2.3 Valores de referencia por sexo y franja etaria -----------------
    const referencias = configuracion.referencias || {};
    const categoriasEdad = ['adulto', 'pediatrico'];

    Object.keys(referencias.sexSpecific || {}).forEach(function(examenId) {
        const matriz = referencias.sexSpecific[examenId] || {};
        categoriasEdad.forEach(function(categoriaEdad) {
            const porSexo = matriz[categoriaEdad] || {};
            Object.keys(porSexo).forEach(function(sexo) {
                registrarExamen({ id: examenId, nombre: examenId, area: CATEGORIA_PERFILES.nombre });
                rangos.push({
                    examen_id: examenId,
                    parametro_id: null,
                    sexo: sexo,
                    categoria_edad: categoriaEdad,
                    edad_min: categoriaEdad === 'pediatrico' ? 0 : 18,
                    edad_max: categoriaEdad === 'pediatrico' ? 17 : null,
                    ref_min: aNumero(porSexo[sexo].refMin),
                    ref_max: aNumero(porSexo[sexo].refMax),
                    ref_texto: '',
                    orden: 1
                });
            });
        });
    });

    Object.keys(referencias.shared || {}).forEach(function(examenId) {
        const matriz = referencias.shared[examenId] || {};
        categoriasEdad.forEach(function(categoriaEdad) {
            const rango = matriz[categoriaEdad];
            if (!rango) return;
            registrarExamen({ id: examenId, nombre: examenId, area: CATEGORIA_PERFILES.nombre });
            rangos.push({
                examen_id: examenId,
                parametro_id: null,
                sexo: 'ambos',
                categoria_edad: categoriaEdad,
                edad_min: categoriaEdad === 'pediatrico' ? 0 : 18,
                edad_max: categoriaEdad === 'pediatrico' ? 17 : null,
                ref_min: aNumero(rango.refMin),
                ref_max: aNumero(rango.refMax),
                ref_texto: '',
                orden: 1
            });
        });
    });

    // --- 2.4 Perfiles -------------------------------------------------------
    const perfilesDef = configuracion.perfiles || {};
    Object.keys(perfilesDef).forEach(function(perfilId, indicePerfil) {
        const perfil = perfilesDef[perfilId];
        if (!perfil || !perfil.id) return;
        perfiles.push({
            id: perfil.id,
            nombre: perfil.nombre || perfil.id,
            area: perfil.area || CATEGORIA_PERFILES.nombre,
            orden: indicePerfil
        });
        (perfil.examenes || []).forEach(function(miembro, indice) {
            if (!miembro || !miembro.id) return;
            registrarExamen({
                id: miembro.id,
                nombre: miembro.nombre || miembro.id,
                area: miembro.area || CATEGORIA_PERFILES.nombre,
                unidad: miembro.unidad,
                tipo: miembro.tipo,
                refMin: miembro.refMin,
                refMax: miembro.refMax,
                refTexto: miembro.refTexto
            });
            perfilesExamenes.push({
                perfil_id: perfil.id,
                examen_id: miembro.id,
                orden: indice,
                grupo: miembro.grupo || ''
            });
        });
    });

    // --- 2.5 Orden estable de categorías ------------------------------------
    const listaCategorias = Array.from(categorias.values());
    listaCategorias.forEach(function(categoria, indice) {
        categoria.orden = indice;
    });
    if (!categorias.has(CATEGORIA_PERFILES.id)) {
        listaCategorias.push({
            id: CATEGORIA_PERFILES.id,
            nombre: CATEGORIA_PERFILES.nombre,
            orden: CATEGORIA_PERFILES.orden
        });
    } else {
        listaCategorias.forEach(function(categoria) {
            if (categoria.id === CATEGORIA_PERFILES.id) categoria.orden = CATEGORIA_PERFILES.orden;
        });
    }

    return {
        categorias: listaCategorias,
        examenes: Array.from(examenes.values()),
        parametros: parametros,
        rangos: rangos,
        opcionesExamen: opcionesExamen,
        opcionesParametro: opcionesParametro,
        perfiles: perfiles,
        perfilesExamenes: perfilesExamenes
    };
}

// --------------------------------------------------------------------------
// 3. Escritura en SQLite
// --------------------------------------------------------------------------

function prepararEscrituras(db) {
    return {
        categoria: db.prepare(`
            INSERT INTO categorias_examenes (id, nombre, orden)
            VALUES (@id, @nombre, @orden)
            ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, orden = excluded.orden
        `),
        examen: db.prepare(`
            INSERT INTO examenes (id, categoria_id, nombre, unidad, tipo, tipo_formulario, grupo,
                                  valor_defecto, ref_min, ref_max, ref_texto, orden)
            VALUES (@id, @categoria_id, @nombre, @unidad, @tipo, @tipo_formulario, @grupo,
                    @valor_defecto, @ref_min, @ref_max, @ref_texto, @orden)
            ON CONFLICT(id) DO UPDATE SET
                categoria_id    = excluded.categoria_id,
                nombre          = excluded.nombre,
                unidad          = excluded.unidad,
                tipo            = excluded.tipo,
                tipo_formulario = excluded.tipo_formulario,
                grupo           = excluded.grupo,
                valor_defecto   = excluded.valor_defecto,
                ref_min         = excluded.ref_min,
                ref_max         = excluded.ref_max,
                ref_texto       = excluded.ref_texto,
                orden           = excluded.orden
            WHERE examenes.origen <> 'usuario'
        `),
        parametro: db.prepare(`
            INSERT INTO parametros_examen (examen_id, codigo, nombre, tipo_dato, tipo_interfaz, unidad, grupo,
                                           valor_defecto, ref_min, ref_max, ref_texto,
                                           obligatorio, orden, orden_render)
            VALUES (@examen_id, @codigo, @nombre, @tipo_dato, @tipo_interfaz, @unidad, @grupo,
                    @valor_defecto, @ref_min, @ref_max, @ref_texto,
                    @obligatorio, @orden, @orden_render)
            ON CONFLICT(examen_id, codigo) DO UPDATE SET
                nombre        = excluded.nombre,
                tipo_dato     = excluded.tipo_dato,
                tipo_interfaz = excluded.tipo_interfaz,
                unidad        = excluded.unidad,
                grupo         = excluded.grupo,
                valor_defecto = excluded.valor_defecto,
                ref_min       = excluded.ref_min,
                ref_max       = excluded.ref_max,
                ref_texto     = excluded.ref_texto,
                obligatorio   = excluded.obligatorio,
                orden         = excluded.orden,
                orden_render  = excluded.orden_render
        `),
        buscarParametro: db.prepare('SELECT id FROM parametros_examen WHERE examen_id = ? AND codigo = ?'),
        borrarParametrosDe: db.prepare('DELETE FROM parametros_examen WHERE examen_id = ?'),
        borrarOpcionesDe: db.prepare('DELETE FROM opciones_examen'),
        borrarRangos: db.prepare('DELETE FROM rangos_referencia'),
        rango: db.prepare(`
            INSERT INTO rangos_referencia (examen_id, parametro_id, sexo, categoria_edad,
                                           edad_min, edad_max, ref_min, ref_max, ref_texto, orden)
            VALUES (@examen_id, @parametro_id, @sexo, @categoria_edad,
                    @edad_min, @edad_max, @ref_min, @ref_max, @ref_texto, @orden)
        `),
        opcionExamen: db.prepare(`
            INSERT INTO opciones_examen (examen_id, orden, valor)
            VALUES (@examen_id, @orden, @valor)
            ON CONFLICT(examen_id, orden) DO UPDATE SET valor = excluded.valor
        `),
        opcionParametro: db.prepare(`
            INSERT INTO opciones_parametro (parametro_id, orden, valor)
            VALUES (@parametro_id, @orden, @valor)
            ON CONFLICT(parametro_id, orden) DO UPDATE SET valor = excluded.valor
        `),
        perfil: db.prepare(`
            INSERT INTO perfiles (id, nombre, area, orden)
            VALUES (@id, @nombre, @area, @orden)
            ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, area = excluded.area, orden = excluded.orden
        `),
        perfilExamen: db.prepare(`
            INSERT INTO perfiles_examenes (perfil_id, examen_id, orden, grupo)
            VALUES (@perfil_id, @examen_id, @orden, @grupo)
            ON CONFLICT(perfil_id, examen_id) DO UPDATE SET
                orden = excluded.orden,
                grupo = excluded.grupo
        `),
        borrarPerfiles: db.prepare('DELETE FROM perfiles_examenes'),
        borrarPerfil: db.prepare('DELETE FROM perfiles')
    };
}

/**
 * Vuelca el dataset normalizado. Los parámetros, sus opciones y sus rangos se
 * reemplazan por examen completo (borrado + inserción) para que quitar un ítem
 * de un .js también se propague a la base de datos.
 */
function volcarDataset(db, dataset) {
    const stmts = prepararEscrituras(db);

    const volcar = db.transaction(function() {
        dataset.categorias.forEach(function(fila) { stmts.categoria.run(fila); });
        dataset.examenes.forEach(function(fila) { stmts.examen.run(fila); });

        // Rangos y opciones se reconstruyen desde cero: el dataset los describe
        // por completo y así la migración es idempotente.
        stmts.borrarRangos.run();
        stmts.borrarOpcionesDe.run();

        const examenesConParametros = new Set();
        const idsParametros = new Map();
        dataset.parametros.forEach(function(fila) {
            if (!examenesConParametros.has(fila.examen_id)) {
                examenesConParametros.add(fila.examen_id);
                stmts.borrarParametrosDe.run(fila.examen_id);
                idsParametros.delete(fila.examen_id);
            }
            stmts.parametro.run(fila);
            const guardado = stmts.buscarParametro.get(fila.examen_id, fila.codigo);
            if (!idsParametros.has(fila.examen_id)) idsParametros.set(fila.examen_id, new Map());
            idsParametros.get(fila.examen_id).set(fila.codigo, guardado.id);
        });

        dataset.opcionesParametro.forEach(function(fila) {
            const mapa = idsParametros.get(fila.examen_id);
            const parametroId = mapa ? mapa.get(fila.codigo) : null;
            if (parametroId) {
                stmts.opcionParametro.run({ parametro_id: parametroId, orden: fila.orden, valor: fila.valor });
            }
        });

        dataset.rangos.forEach(function(fila) {
            let parametroId = null;
            if (fila.parametro_codigo) {
                const mapa = idsParametros.get(fila.parametro_examen_id);
                parametroId = mapa ? mapa.get(fila.parametro_codigo) : null;
                if (!parametroId) return;
            }
            stmts.rango.run({
                examen_id: fila.examen_id,
                parametro_id: parametroId,
                sexo: fila.sexo,
                categoria_edad: fila.categoria_edad,
                edad_min: fila.edad_min,
                edad_max: fila.edad_max,
                ref_min: fila.ref_min,
                ref_max: fila.ref_max,
                ref_texto: fila.ref_texto,
                orden: fila.orden
            });
        });

        dataset.opcionesExamen.forEach(function(fila) { stmts.opcionExamen.run(fila); });

        stmts.borrarPerfiles.run();
        dataset.perfiles.forEach(function(fila) { stmts.perfil.run(fila); });
        dataset.perfilesExamenes.forEach(function(fila) { stmts.perfilExamen.run(fila); });
    });

    volcar();
}

/**
 * Migra el catálogo completo desde los archivos .js de configuración.
 * @returns {{categorias:number, examenes:number, parametros:number, rangos:number, perfiles:number, legacyAbsorbidos:number}}
 */
function migrarCatalogoDesdeArchivos(db, raizProyecto, opciones) {
    const config = opciones && opciones.silencioso;
    if (!config) {
        console.log('📖 Leyendo configuración desde los archivos .js…');
    }

    crearEsquemaCatalogo(db);

    const configuracion = leerConfiguracionDesdeArchivos(raizProyecto);
    const dataset = normalizarConfiguracion(configuracion);
    volcarDataset(db, dataset);
    const legacyAbsorbidos = absorberParametrosLegados(db);

    const resumen = {
        categorias: dataset.categorias.length,
        examenes: dataset.examenes.length,
        parametros: dataset.parametros.length,
        rangos: dataset.rangos.length,
        perfiles: dataset.perfiles.length,
        legacyAbsorbidos: legacyAbsorbidos
    };

    if (!config) {
        console.log('✅ Catálogo migrado a SQLite:', resumen);
    }
    return resumen;
}

/**
 * Siembra el catálogo solo cuando la tabla está vacía. Se invoca en cada
 * arranque para que una base nueva quede poblada sin pasos manuales.
 */
function asegurarCatalogoPoblado(db, raizProyecto) {
    crearEsquemaCatalogo(db);
    const fila = db.prepare('SELECT COUNT(*) AS total FROM examenes').get();
    if (fila && fila.total > 0) return null;
    return migrarCatalogoDesdeArchivos(db, raizProyecto, { silencioso: true });
}

module.exports = {
    ARCHIVOS_FUENTE,
    ORDENES_RENDER,
    evaluarArchivoConfiguracion,
    leerConfiguracionDesdeArchivos,
    normalizarConfiguracion,
    migrarCatalogoDesdeArchivos,
    asegurarCatalogoPoblado,
    aSlug,
    aEntero
};
