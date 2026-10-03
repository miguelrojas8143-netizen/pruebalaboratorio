'use strict';

/**
 * Puente entre SQLite y el historial del paciente.
 *
 * El catálogo (exámenes, parámetros y valores de referencia) ya no vive en
 * este archivo: se resuelve siempre contra las tablas normalizadas
 * `examenes`, `parametros_examen` y `rangos_referencia`, sembradas por
 * `database/migracion-catalogo.js`.
 */

const { asegurarCatalogoPoblado } = require('./migracion-catalogo');
const { columnasDe, existeTabla } = require('./schema');

/** Añade una columna si falta (bases creadas por versiones anteriores). */
function asegurarColumna(db, tabla, columna, definicion) {
    if (!existeTabla(db, tabla)) return;
    if (columnasDe(db, tabla).some(function(c) { return c.name === columna; })) return;
    db.exec('ALTER TABLE ' + tabla + ' ADD COLUMN ' + columna + ' ' + definicion);
}

const NOMBRES_EXAMEN_COMPUESTO = {
    hematologia_completa: 'Hematología Completa',
    examen_orina: 'Uroanálisis',
    uroanalisis: 'Uroanálisis',
    examen_heces: 'Examen Directo de Heces'
};

const ALIAS_EXAMEN_COMPUESTO = {
    hematologia_completa: ['hematología completa', 'hematologia completa', 'hematologia_completa'],
    examen_orina: ['uroanálisis', 'uroanalisis', 'examen de orina', 'examen general de orina', 'examen_orina', 'uroanalisis'],
    examen_heces: [
        'examen directo de heces',
        'examen de heces',
        'examen_directo_de_heces',
        'examen_heces',
        'coproanálisis',
        'coproanalisis'
    ]
};

/** Formularios compuestos que se persisten como un JSON y se explotan a filas. */
const EXAMEN_POR_FORMULARIO = {
    uroanalisis: 'examen_orina',
    heces: 'examen_heces'
};

function referenciaPorDefecto(item) {
    if (!item) return '';
    if (item.refTexto !== undefined && item.refTexto !== '') return item.refTexto;
    if (item.refMin != null && item.refMax != null) return item.refMin + ' - ' + item.refMax;
    return '';
}

/**
 * Carga el índice id -> parámetro desde las tablas normalizadas.
 * Un mismo código puede ser a la vez una prueba del catálogo y un parámetro de
 * una prueba compuesta, así que se guardan todas las pruebas a las que
 * pertenece.
 */
function cargarIndiceCatalogo(db) {
    const porId = new Map();

    function registrar(codigo, datos) {
        let item = porId.get(codigo);
        if (!item) {
            item = {
                id: codigo,
                nombre: datos.nombre,
                unidad: datos.unidad || '',
                refMin: datos.ref_min,
                refMax: datos.ref_max,
                refTexto: datos.ref_texto || '',
                grupo: datos.grupo || '',
                refactor: datos.examen_id,
                pruebas: new Set()
            };
            porId.set(codigo, item);
        }
        item.pruebas.add(datos.examen_id);
        return item;
    }

    db.prepare('SELECT id, nombre, unidad, ref_min, ref_max, ref_texto, grupo FROM examenes ORDER BY orden').all()
        .forEach(function(fila) {
            registrar(fila.id, {
                examen_id: fila.id,
                nombre: fila.nombre,
                unidad: fila.unidad,
                ref_min: fila.ref_min,
                ref_max: fila.ref_max,
                ref_texto: fila.ref_texto,
                grupo: fila.grupo
            });
        });

    db.prepare(`
        SELECT codigo, examen_id, nombre, unidad, ref_min, ref_max, ref_texto, grupo, orden
        FROM parametros_examen
        ORDER BY orden
    `).all().forEach(function(fila) {
        registrar(fila.codigo, {
            examen_id: fila.examen_id,
            nombre: fila.nombre,
            unidad: fila.unidad,
            ref_min: fila.ref_min,
            ref_max: fila.ref_max,
            ref_texto: fila.ref_texto,
            grupo: fila.grupo
        });
    });

    const codigosDe = db.prepare('SELECT codigo FROM parametros_examen WHERE examen_id = ?');
    const idsHematologia = new Set(codigosDe.all('hematologia_completa').map(function(f) { return f.codigo; }));
    const idsUroanalisis = new Set(codigosDe.all('examen_orina').map(function(f) { return f.codigo; }));

    // Solo las pruebas con parámetros se explotan a una fila por parámetro; las
    // demás siguen siendo un único resultado.
    const idsConParametros = new Set(
        db.prepare('SELECT DISTINCT examen_id FROM parametros_examen').all().map(function(f) { return f.examen_id; })
    );

    return {
        porId: porId,
        idsHematologia: idsHematologia,
        idsUroanalisis: idsUroanalisis,
        idsConParametros: idsConParametros
    };
}

function nombreDePrueba(indice, examenId) {
    if (NOMBRES_EXAMEN_COMPUESTO[examenId]) return NOMBRES_EXAMEN_COMPUESTO[examenId];
    const item = indice.porId.get(examenId);
    return (item && item.nombre) || examenId;
}

function identificarExamen(entrada, valores, indice) {
    // 1) El id del catálogo es la señal más fiable: lo escribe el formulario que
    //    captura el resultado (heces, uroanálisis, perfiles…).
    const examenIdDirecto = String(entrada.examen_id || '').trim();
    if (examenIdDirecto && indice.idsConParametros.has(examenIdDirecto)) return examenIdDirecto;
    // 2) El tipo de formulario identifica igual que la prueba, sin depender del
    //    nombre legible que el usuario pudo haber editado.
    const porFormulario = EXAMEN_POR_FORMULARIO[String(entrada.tipoFormulario || '').trim()];
    if (porFormulario) return porFormulario;
    // 3) Alias sobre el nombre, para los historiales ya guardados.
    const nombre = String(entrada.examen_completo || entrada.examen || entrada.nombre || entrada.id || '')
        .trim()
        .toLowerCase();
    for (const examenId of Object.keys(ALIAS_EXAMEN_COMPUESTO)) {
        if (ALIAS_EXAMEN_COMPUESTO[examenId].indexOf(nombre) !== -1) return examenId;
    }

    if (valores) {
        const ids = Object.keys(valores);
        const hematologia = ids.filter(function(id) { return indice.idsHematologia.has(id); }).length;
        const uroanalisis = ids.filter(function(id) { return indice.idsUroanalisis.has(id); }).length;
        if (hematologia >= 2 && hematologia > uroanalisis) return 'hematologia_completa';
        if (uroanalisis >= 2 && uroanalisis > hematologia) return 'examen_orina';
    }
    return null;
}

function analizarResultado(resultado) {
    if (resultado && typeof resultado === 'object' && !Array.isArray(resultado)) return resultado;
    try {
        const valores = JSON.parse(resultado || '{}');
        return (valores && typeof valores === 'object' && !Array.isArray(valores)) ? valores : null;
    } catch (error) {
        return null;
    }
}

/**
 * Inserta una fila del historial por parámetro de la prueba compuesta.
 * Devuelve cuántas filas se escribieron.
 */
function insertarParametros(insertar, orden, fecha, examenId, valores, indice) {
    const referencias = valores.__referencias || {};
    let cantidad = 0;
    for (const codigo of Object.keys(valores)) {
        if (codigo === '__referencias') continue;
        const item = indice.porId.get(codigo);
        const resultado = valores[codigo];
        if (!item || !item.pruebas.has(examenId)) continue;
        if (resultado == null || String(resultado).trim() === '') continue;
        const referencia = referencias[codigo];
        insertar.run(
            orden,
            fecha,
            nombreDePrueba(indice, examenId),
            String(resultado),
            item.unidad,
            codigo,
            referencia === undefined ? referenciaPorDefecto(item) : String(referencia)
        );
        cantidad += 1;
    }
    return cantidad;
}

/**
 * Persiste el historial de una orden. Los resultados de pruebas compuestas se
 * explotan a una fila por parámetro para que cada valor conserve su referencia.
 */
function guardarHistorialPaciente(db, orden, historial) {
    const indice = cargarIndiceCatalogo(db);
    const insertar = db.prepare(`
        INSERT INTO historial_examenes
            (orden_paciente, fecha, examen, resultado, unidad, idresultado, referencia)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const guardar = db.transaction(function() {
        db.prepare('DELETE FROM historial_examenes WHERE orden_paciente = ?').run(orden);

        for (const entrada of historial || []) {
            // 1) Entrada ya aplanada por parámetro.
            if (entrada.idresultado && indice.porId.has(entrada.idresultado)) {
                const item = indice.porId.get(entrada.idresultado);
                insertar.run(
                    orden,
                    entrada.fecha || '',
                    entrada.examen_completo || nombreDePrueba(indice, item.refactor),
                    entrada.resultado == null ? '' : String(entrada.resultado),
                    entrada.unidad || item.unidad,
                    entrada.idresultado,
                    entrada.referencia == null ? referenciaPorDefecto(item) : String(entrada.referencia)
                );
                continue;
            }

            // 2) Resultado guardado como un único JSON con todos los parámetros.
            const valores = analizarResultado(entrada.resultado);
            const examenId = identificarExamen(entrada, valores, indice);
            if (examenId) {
                if (valores) {
                    insertarParametros(insertar, orden, entrada.fecha || '', examenId, valores, indice);
                }
                continue;
            }

            // 3) Resultado simple sin catálogo asociado.
            insertar.run(
                orden,
                entrada.fecha || '',
                entrada.examen || entrada.nombre || '',
                entrada.resultado == null ? '' : String(entrada.resultado),
                entrada.unidad || '',
                null,
                entrada.referencia || null
            );
        }

        db.prepare('UPDATE pacientes SET historial = ? WHERE orden = ?')
            .run(JSON.stringify(historial || []), orden);
    });

    guardar();
}

/**
 * Convierte filas del historial heredado (un JSON por orden) a una fila por
 * parámetro. Se ejecuta una sola vez, al abrir una base ya existente.
 */
function migrarHistorialLegado(db) {
    const indice = cargarIndiceCatalogo(db);
    const consultar = db.prepare(
        'SELECT id, orden_paciente, fecha, examen, resultado FROM historial_examenes WHERE idresultado IS NULL'
    );
    const registrar = db.prepare(`
        INSERT INTO historial_examenes
            (orden_paciente, fecha, examen, resultado, unidad, idresultado, referencia)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const borrar = db.prepare('DELETE FROM historial_examenes WHERE id = ?');

    const migrar = db.transaction(function() {
        let migradas = 0;
        for (const registro of consultar.all()) {
            const valores = analizarResultado(registro.resultado);
            if (!valores) continue;
            const examenId = identificarExamen({ examen: registro.examen }, valores, indice);
            if (!examenId) continue;

            const cantidad = insertarParametros(
                registrar, registro.orden_paciente, registro.fecha, examenId, valores, indice
            );
            if (cantidad > 0) {
                borrar.run(registro.id);
                migradas += cantidad;
            }
        }
        return migradas;
    });

    return migrar();
}

/**
 * Guarda pruebas compuestas como una fila por parámetro. La lectura vuelve a
 * agrupar esas filas para que el resto de la aplicación siga usando el formato
 * lógico { id: examenId, resultado: JSON }.
 */
function guardarExamenesPaciente(db, orden, examenes) {
    const parametrosDeExamen = db.prepare(
        'SELECT codigo FROM parametros_examen WHERE examen_id = ? ORDER BY orden_render, orden'
    );
    const nombreDeExamenId = db.prepare('SELECT nombre FROM examenes WHERE id = ?');
    const examenPorNombre = db.prepare(
        'SELECT id, nombre FROM examenes WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))'
    );
    const eliminar = db.prepare('DELETE FROM paciente_examenes WHERE orden_paciente = ?');
    const insertar = db.prepare(`
        INSERT INTO paciente_examenes
            (orden_paciente, nombre_examen, resultado, examen_id, idresultado, referencia)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const guardar = db.transaction(function() {
        eliminar.run(orden);
        for (const examen of examenes || []) {
            let examenId = String(examen.examen_id || examen.id || '').trim();
            let nombre = String(examen.nombre_examen || examen.nombre || '').trim();
            let parametros = parametrosDeExamen.all(examenId);

            if (!parametros.length && nombre) {
                const coincidencias = examenPorNombre.all(nombre);
                if (coincidencias.length === 1) {
                    examenId = coincidencias[0].id;
                    nombre = coincidencias[0].nombre;
                    parametros = parametrosDeExamen.all(examenId);
                }
            }
            if (!nombre && examenId) {
                const catalogo = nombreDeExamenId.get(examenId);
                nombre = (catalogo && catalogo.nombre) || examenId;
            }
            if (!nombre) nombre = examenId;

            let valores = null;
            if (examen.resultado && typeof examen.resultado === 'object' &&
                !Array.isArray(examen.resultado)) {
                valores = examen.resultado;
            } else {
                valores = analizarResultado(examen.resultado);
            }

            if (!parametros.length || !valores) {
                insertar.run(
                    orden,
                    nombre,
                    examen.resultado == null ? '' : String(examen.resultado),
                    examenId || null,
                    null,
                    null
                );
                continue;
            }

            const codigos = new Set(parametros.map(function(parametro) { return parametro.codigo; }));
            const clavesDesconocidas = Object.keys(valores).filter(function(codigo) {
                return codigo !== '__referencias' && !codigos.has(codigo);
            });
            if (clavesDesconocidas.length) {
                throw new Error(
                    'Parámetros sin declarar en el catálogo de ' + nombre + ': ' +
                    clavesDesconocidas.join(', ')
                );
            }

            const referencias = valores.__referencias || {};
            parametros.forEach(function(parametro) {
                const resultado = valores[parametro.codigo];
                const referencia = referencias[parametro.codigo];
                insertar.run(
                    orden,
                    nombre,
                    resultado == null ? '' : String(resultado),
                    examenId,
                    parametro.codigo,
                    referencia == null ? null : String(referencia)
                );
            });
        }
    });

    guardar();
}

/**
 * Normaliza las pruebas compuestas que las versiones anteriores guardaron
 * como un JSON en una sola fila de `paciente_examenes`.
 */
function migrarExamenesPacienteLegados(db) {
    if (!existeTabla(db, 'paciente_examenes')) return 0;

    const indice = cargarIndiceCatalogo(db);
    const codigosPorExamen = new Map();
    db.prepare('SELECT examen_id, codigo FROM parametros_examen').all().forEach(function(fila) {
        if (!codigosPorExamen.has(fila.examen_id)) codigosPorExamen.set(fila.examen_id, new Set());
        codigosPorExamen.get(fila.examen_id).add(fila.codigo);
    });
    const filas = db.prepare(`
        SELECT id, orden_paciente, nombre_examen, resultado, examen_id
        FROM paciente_examenes
        WHERE idresultado IS NULL
    `).all();
    const insertar = db.prepare(`
        INSERT INTO paciente_examenes
            (orden_paciente, nombre_examen, resultado, examen_id, idresultado, referencia)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const eliminar = db.prepare('DELETE FROM paciente_examenes WHERE id = ?');

    const migrar = db.transaction(function() {
        let migradas = 0;
        filas.forEach(function(fila) {
            const valores = analizarResultado(fila.resultado);
            if (!valores) return;

            let examenId = String(fila.examen_id || '').trim();
            if (!indice.idsConParametros.has(examenId)) {
                examenId = identificarExamen({ examen: fila.nombre_examen }, valores, indice) || '';
            }
            if (!examenId || !indice.idsConParametros.has(examenId)) {
                examenId = examenPorClaves(Object.keys(valores), codigosPorExamen) || '';
            }
            const codigos = codigosPorExamen.get(examenId);
            if (!codigos || !codigos.size) return;

            const desconocidos = Object.keys(valores).filter(function(codigo) {
                return codigo !== '__referencias' && !codigos.has(codigo);
            });
            if (desconocidos.length) return;

            const nombre = nombreDePrueba(indice, examenId);
            const referencias = valores.__referencias || {};
            codigos.forEach(function(codigo) {
                const resultado = valores[codigo];
                const referencia = referencias[codigo];
                insertar.run(
                    fila.orden_paciente,
                    nombre,
                    resultado == null ? '' : String(resultado),
                    examenId,
                    codigo,
                    referencia == null ? null : String(referencia)
                );
            });
            eliminar.run(fila.id);
            migradas += 1;
        });
        return migradas;
    });

    return migrar();
}

/**
 * Convierte las filas normalizadas de `paciente_examenes` a exámenes lógicos.
 * También reconoce los registros JSON guardados por versiones anteriores.
 */
function mapearExamenesGuardados(db, filas) {
    const idsCompuestos = new Set(
        db.prepare('SELECT DISTINCT examen_id FROM parametros_examen').all()
            .map(function(fila) { return fila.examen_id; })
    );
    const entradas = [];
    const grupos = new Map();

    function obtenerGrupo(fila, examenId, nombre) {
        const clave = String(fila.orden_paciente || '') + '\u0000' + examenId;
        let grupo = grupos.get(clave);
        if (!grupo) {
            grupo = {
                id: examenId,
                examen_id: examenId,
                nombre: nombre,
                nombre_examen: nombre,
                valores: {},
                referencias: {}
            };
            grupos.set(clave, grupo);
            entradas.push(grupo);
        }
        return grupo;
    }

    filas.forEach(function(fila) {
        const examenId = String(fila.examen_id || fila.nombre_examen || '').trim();
        const nombre = String(fila.nombre_examen || examenId).trim();
        const esParametroNormalizado = !!fila.idresultado;
        const valoresLegados = !esParametroNormalizado && idsCompuestos.has(examenId)
            ? analizarResultado(fila.resultado)
            : null;

        if (esParametroNormalizado || valoresLegados) {
            const grupo = obtenerGrupo(fila, examenId, nombre);
            if (esParametroNormalizado) {
                grupo.valores[fila.idresultado] = fila.resultado == null ? '' : String(fila.resultado);
                if (fila.referencia != null && String(fila.referencia).trim() !== '') {
                    grupo.referencias[fila.idresultado] = String(fila.referencia);
                }
            } else {
                Object.keys(valoresLegados).forEach(function(codigo) {
                    if (codigo === '__referencias') return;
                    grupo.valores[codigo] = valoresLegados[codigo];
                });
                Object.assign(grupo.referencias, valoresLegados.__referencias || {});
            }
            return;
        }

        entradas.push({
            id: examenId,
            examen_id: fila.examen_id || null,
            nombre: nombre,
            nombre_examen: nombre,
            resultado: fila.resultado || ''
        });
    });

    return entradas.map(function(entrada) {
        if (!entrada.valores) return entrada;
        if (Object.keys(entrada.referencias).length) {
            entrada.valores.__referencias = entrada.referencias;
        }
        return {
            id: entrada.id,
            examen_id: entrada.examen_id,
            nombre: entrada.nombre,
            nombre_examen: entrada.nombre_examen,
            resultado: JSON.stringify(entrada.valores)
        };
    });
}

/**
 * Identifica la prueba a la que pertenece un JSON de resultados.
 * Devuelve el examen_id cuyos parámetros cubren más claves, o null.
 */
function examenPorClaves(claves, codigosPorExamen) {
    let mejor = null;
    let mejorCoincidencias = 0;
    codigosPorExamen.forEach(function(codigos, examenId) {
        let coincidencias = 0;
        claves.forEach(function(clave) { if (codigos.has(clave)) coincidencias += 1; });
        if (coincidencias > mejorCoincidencias) {
            mejorCoincidencias = coincidencias;
            mejor = examenId;
        }
    });
    // Dos claves es el mismo umbral que usa el renderer para no colapsar
    // un examen normal en un perfil compuesto.
    return mejorCoincidencias >= 2 ? mejor : null;
}

/**
 * Repara filas heredadas de `paciente_examenes` que carecen de nombre o id.
 * Las pruebas compuestas JSON se convierten por separado en
 * `migrarExamenesPacienteLegados`.
 */
function repararExamenesDePaciente(db) {
    if (!existeTabla(db, 'paciente_examenes')) return { reparados: 0, sinIdentificar: 0 };
    asegurarColumna(db, 'paciente_examenes', 'examen_id', 'TEXT');

    const indice = cargarIndiceCatalogo(db);
    const codigosPorExamen = new Map();
    db.prepare('SELECT examen_id, codigo FROM parametros_examen').all().forEach(function(fila) {
        if (!codigosPorExamen.has(fila.examen_id)) codigosPorExamen.set(fila.examen_id, new Set());
        codigosPorExamen.get(fila.examen_id).add(fila.codigo);
    });

    const porReparar = db.prepare(`
        SELECT id, orden_paciente, nombre_examen, resultado, examen_id FROM paciente_examenes
        WHERE (nombre_examen IS NULL OR TRIM(nombre_examen) = '')
           OR (examen_id IS NULL OR TRIM(examen_id) = '')
    `).all();
    if (porReparar.length === 0) return { reparados: 0, sinIdentificar: 0 };

    const delHistorial = db.prepare(`
        SELECT DISTINCT examen FROM historial_examenes
        WHERE orden_paciente = ? AND idresultado IS NULL AND resultado = ?
    `);
    const examenesPorNombre = db.prepare(
        'SELECT id, nombre FROM examenes WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))'
    );
    const nombreDeExamenId = db.prepare('SELECT nombre FROM examenes WHERE id = ?');
    const actualizar = db.prepare('UPDATE paciente_examenes SET nombre_examen = ?, examen_id = ? WHERE id = ?');

    const reparar = db.transaction(function() {
        let reparados = 0;
        let sinIdentificar = 0;
        for (const fila of porReparar) {
            let examenId = String(fila.examen_id || '').trim();
            let nombre = String(fila.nombre_examen || '').trim();

            // 1) Las claves del JSON dicen qué prueba compuesta es.
            if (!examenId) {
                const valores = analizarResultado(fila.resultado);
                if (valores) examenId = examenPorClaves(Object.keys(valores), codigosPorExamen) || '';
            }
            // 2) El historial de la misma orden conserva el nombre de la prueba.
            if (!nombre || !examenId) {
                const candidatos = delHistorial.all(fila.orden_paciente, fila.resultado);
                if (candidatos.length > 0) {
                    nombre = nombre || String(candidatos[0].examen || '').trim();
                }
            }
            // 3) Los formularios no tienen parámetros en el catálogo: se localizan
            //    por su nombre, que es lo que los identifica en el reporte.
            if (!examenId && nombre) {
                const porNombre = examenesPorNombre.all(nombre);
                if (porNombre.length === 1) examenId = porNombre[0].id;
            }
            if (!nombre && examenId) {
                const filaCatalogo = nombreDeExamenId.get(examenId);
                nombre = (filaCatalogo && filaCatalogo.nombre) || nombreDePrueba(indice, examenId);
            }
            if (!nombre) {
                sinIdentificar += 1;
                continue;
            }
            if (nombre === String(fila.nombre_examen || '').trim()
                && examenId === String(fila.examen_id || '').trim()) {
                continue;
            }
            actualizar.run(nombre, examenId || null, fila.id);
            reparados += 1;
        }
        return { reparados: reparados, sinIdentificar: sinIdentificar };
    });

    return reparar();
}

/**
 * Punto de entrada que usa el proceso principal: crea el esquema normalizado
 * y siembra el catálogo la primera vez.
 */
function inicializarCatalogoExamenes(db, raizProyecto) {
    asegurarColumna(db, 'paciente_examenes', 'examen_id', 'TEXT');
    asegurarColumna(db, 'paciente_examenes', 'idresultado', 'TEXT');
    asegurarColumna(db, 'paciente_examenes', 'referencia', 'TEXT');
    asegurarColumna(db, 'historial_examenes', 'idresultado', 'TEXT');
    asegurarColumna(db, 'historial_examenes', 'referencia', 'TEXT');

    const sembrado = asegurarCatalogoPoblado(db, raizProyecto);
    if (sembrado) {
        console.log('🌱 Catálogo de exámenes sembrado desde los archivos de configuración:', sembrado);
    }
    const resultadosLegados = migrarExamenesPacienteLegados(db);
    if (resultadosLegados > 0) {
        console.log('🧬 Resultados compuestos normalizados en', resultadosLegados, 'examen(es)');
    }
    const migradas = migrarHistorialLegado(db);
    if (migradas > 0) {
        console.log('🧬 Historial heredado aplanado a', migradas, 'parámetros');
    }
    const reparados = repararExamenesDePaciente(db);
    if (reparados.reparados > 0) {
        console.log('🩺 Exámenes de paciente reparados:', reparados.reparados);
    }
    if (reparados.sinIdentificar > 0) {
        console.warn(
            '⚠️  ' + reparados.sinIdentificar + ' examen(es) sin nombre no se pudieron identificar; '
            + 'su reporte se imprimirá con el JSON sin desglosar'
        );
    }
}

module.exports = {
    referenciaPorDefecto,
    inicializarCatalogoExamenes,
    guardarExamenesPaciente,
    mapearExamenesGuardados,
    migrarExamenesPacienteLegados,
    guardarHistorialPaciente,
    migrarHistorialLegado,
    repararExamenesDePaciente,
    examenPorClaves
};
