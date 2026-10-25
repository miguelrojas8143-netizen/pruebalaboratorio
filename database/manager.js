const path = require('path');
const Database = require('better-sqlite3');
const {
    inicializarCatalogoExamenes,
    guardarExamenesPaciente,
    mapearExamenesGuardados,
    guardarHistorialPaciente,
    eliminarExamenesPaciente
} = require('./examenes');
const {
    guardarExamenCatalogo,
    actualizarEstadoExamenCatalogo,
    eliminarExamenCatalogo
} = require('./catalogo-admin');
const { actualizarOrdenPaciente } = require('./ordenes');
const { prepararConsultasCatalogo } = require('./schema');

let db = null;

function initializeDatabase(userDataPath, appDirectory, ipcMain) {
    const dbPath = path.join(userDataPath, 'datos.db');
    console.log('📁 Ruta de la base de datos:', dbPath);

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    db.exec(`
        CREATE TABLE IF NOT EXISTS pacientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orden        TEXT UNIQUE,
            nombre       TEXT,
            cedula       TEXT,
            edad         INTEGER,
            sexo         TEXT,
            fechaNac     TEXT,
            telefono     TEXT,
            fechaRegistro TEXT,
            refAdaptadas INTEGER DEFAULT 0,
            perfiles     TEXT DEFAULT '[]',
            historial    TEXT DEFAULT '[]',
            visitas      INTEGER DEFAULT 1
        )
    `);

    const columnas = db.prepare('PRAGMA table_info(pacientes)').all();
    if (!columnas.some(c => c.name === 'fechaRegistro')) db.exec('ALTER TABLE pacientes ADD COLUMN fechaRegistro TEXT');
    if (!columnas.some(c => c.name === 'fechaNac')) db.exec('ALTER TABLE pacientes ADD COLUMN fechaNac TEXT');
    if (!columnas.some(c => c.name === 'telefono')) db.exec('ALTER TABLE pacientes ADD COLUMN telefono TEXT');
    if (!columnas.some(c => c.name === 'id')) db.exec('ALTER TABLE pacientes ADD COLUMN id INTEGER');
    if (!columnas.some(c => c.name === 'refAdaptadas')) db.exec('ALTER TABLE pacientes ADD COLUMN refAdaptadas INTEGER DEFAULT 0');
    if (!columnas.some(c => c.name === 'perfiles')) db.exec('ALTER TABLE pacientes ADD COLUMN perfiles TEXT DEFAULT \'[]\'');
    if (!columnas.some(c => c.name === 'historial')) db.exec('ALTER TABLE pacientes ADD COLUMN historial TEXT DEFAULT \'[]\'');
    if (!columnas.some(c => c.name === 'visitas')) db.exec('ALTER TABLE pacientes ADD COLUMN visitas INTEGER DEFAULT 1');

    db.exec(`
        CREATE TABLE IF NOT EXISTS paciente_examenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orden_paciente TEXT,
            nombre_examen TEXT,
            resultado TEXT DEFAULT '',
            examen_id TEXT,
            idresultado TEXT,
            referencia TEXT,
            FOREIGN KEY(orden_paciente) REFERENCES pacientes(orden)
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS historial_examenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orden_paciente TEXT,
            fecha TEXT,
            examen TEXT,
            resultado TEXT,
            unidad TEXT,
            idresultado TEXT,
            referencia TEXT,
            FOREIGN KEY(orden_paciente) REFERENCES pacientes(orden)
        )
    `);

    inicializarCatalogoExamenes(db, appDirectory);
    const consultasCatalogo = prepararConsultasCatalogo(db);

    db.exec(`
        CREATE TABLE IF NOT EXISTS ordenes_archivadas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER,
            orden TEXT,
            fecha TEXT,
            examenes TEXT,
            refAdaptadas INTEGER,
            perfiles TEXT,
            historial TEXT,
            estado TEXT DEFAULT 'archivada',
            FOREIGN KEY(paciente_id) REFERENCES pacientes(id)
        )
    `);

    const insertOrdenArchivadaStmt = db.prepare(
        'INSERT INTO ordenes_archivadas (paciente_id, orden, fecha, examenes, refAdaptadas, perfiles, historial, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const selectOrdenesArchivadasStmt = db.prepare(
        'SELECT * FROM ordenes_archivadas WHERE paciente_id = ? ORDER BY id DESC'
    );
    const selectMaxOrdenStmt = db.prepare(
        'SELECT MAX(CAST(orden AS INTEGER)) as maxOrden FROM (SELECT orden FROM pacientes UNION ALL SELECT orden FROM ordenes_archivadas)'
    );

    const insertPacienteStmt = db.prepare(
        'INSERT OR REPLACE INTO pacientes (orden, nombre, cedula, edad, sexo, fechaNac, telefono, fechaRegistro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const selectPacientesStmt = db.prepare('SELECT id, orden, nombre, cedula, edad, sexo, fechaNac, telefono, fechaRegistro FROM pacientes ORDER BY CAST(orden AS INTEGER)');

    ipcMain.handle('guardar-paciente', (event, paciente) => {
        try {
            insertPacienteStmt.run(
                paciente.orden,
                paciente.nombre,
                paciente.cedula,
                paciente.edad,
                paciente.sexo,
                paciente.fechaNac || '',
                paciente.telefono || '',
                paciente.fechaRegistro || new Date().toLocaleDateString('es-ES')
            );
            return { success: true, id: insertPacienteStmt.lastInsertRowid || null };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    const updatePacienteStmt = db.prepare(
        'UPDATE pacientes SET nombre = ?, cedula = ?, edad = ?, sexo = ?, fechaNac = ?, telefono = ? WHERE orden = ?'
    );
    ipcMain.handle('actualizar-paciente', (event, paciente) => {
        try {
            const info = updatePacienteStmt.run(
                paciente.nombre,
                paciente.cedula || null,
                paciente.edad || null,
                paciente.sexo || null,
                paciente.fechaNac || null,
                paciente.telefono || null,
                paciente.orden
            );
            if (info.changes === 0) {
                return { success: false, error: 'Paciente no encontrado con orden: ' + paciente.orden };
            }
            return { success: true, changes: info.changes };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('obtener-pacientes', () => {
        try {
            const pacientes = selectPacientesStmt.all();
            return { success: true, pacientes: pacientes };
        } catch (err) {
            return { success: false, error: err.message, pacientes: [] };
        }
    });

    const selectPacientePorOrdenStmt = db.prepare(
        'SELECT id, orden, nombre, cedula, edad, sexo, fechaNac, telefono, fechaRegistro, refAdaptadas, perfiles, historial, visitas FROM pacientes WHERE orden = ?'
    );
    const selectExamenesStmt = db.prepare(
        'SELECT id, orden_paciente, nombre_examen, resultado, examen_id, idresultado, referencia FROM paciente_examenes WHERE orden_paciente = ?'
    );

    ipcMain.handle('guardar-examenes-paciente', (event, data) => {
        try {
            guardarExamenesPaciente(db, data.orden, data.examenes || []);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('obtener-examenes-paciente', (event, { orden }) => {
        try {
            const examenes = selectExamenesStmt.all(orden);
            return { success: true, examenes: mapearExamenesGuardados(db, examenes) };
        } catch (err) {
            return { success: false, error: err.message, examenes: [] };
        }
    });

    const selectPacientesCompletosStmt = db.prepare(
        'SELECT id, orden, nombre, cedula, edad, sexo, fechaNac, telefono, fechaRegistro, refAdaptadas, perfiles, historial, visitas FROM pacientes ORDER BY CAST(orden AS INTEGER)'
    );
    const selectHistorialStmt = db.prepare(
        `SELECT h.fecha,
                COALESCE(e.nombre, h.examen) AS examen,
                h.examen AS examen_completo,
                h.resultado,
                COALESCE(e.unidad, h.unidad, '') AS unidad,
                h.idresultado,
                COALESCE(h.referencia, e.ref_texto, '') AS referencia,
                e.ref_min AS refMin,
                e.ref_max AS refMax,
                e.grupo
         FROM historial_examenes h
         LEFT JOIN vw_parametros_catalogo e ON e.codigo = h.idresultado
         WHERE h.orden_paciente = ?
         ORDER BY h.fecha DESC, h.id DESC`
    );

    ipcMain.handle('obtener-pacientes-completos', () => {
        try {
            const pacientes = selectPacientesCompletosStmt.all();
            const result = pacientes.map(p => {
                var examenes = selectExamenesStmt.all(p.orden);
                return Object.assign({}, p, {
                    examenes: mapearExamenesGuardados(db, examenes),
                    refAdaptadas: !!p.refAdaptadas,
                    perfiles: p.perfiles ? JSON.parse(p.perfiles) : [],
                    historial: p.historial ? JSON.parse(p.historial) : []
                });
            });
            return { success: true, pacientes: result };
        } catch (err) {
            return { success: false, error: err.message, pacientes: [] };
        }
    });

    ipcMain.handle('obtener-paciente-por-orden', (event, { orden }) => {
        try {
            var ordenStr = String(orden || '').padStart(3, '0');
            var paciente = selectPacientePorOrdenStmt.get(ordenStr);
            if (!paciente) {
                paciente = db.prepare('SELECT * FROM pacientes WHERE orden = ?').get(String(orden));
            }
            if (!paciente) {
                return { success: false, error: 'Paciente no encontrado', paciente: null };
            }
            var examenes = selectExamenesStmt.all(ordenStr);
            var historial = selectHistorialStmt.all(ordenStr);
            var pacienteCompleto = Object.assign({}, paciente, {
                examenes: mapearExamenesGuardados(db, examenes),
                refAdaptadas: !!paciente.refAdaptadas,
                perfiles: paciente.perfiles ? JSON.parse(paciente.perfiles) : [],
                historial: historial,
                visitas: paciente.visitas || 1
            });
            return { success: true, paciente: pacienteCompleto, examenes: pacienteCompleto.examenes };
        } catch (err) {
            return { success: false, error: err.message, paciente: null, examenes: [] };
        }
    });

    ipcMain.handle('eliminar-paciente', (event, { id, orden }) => {
        try {
            if (id !== undefined && id !== null) {
                db.prepare('DELETE FROM paciente_examenes WHERE orden_paciente = (SELECT orden FROM pacientes WHERE id = ?)').run(id);
                db.prepare('DELETE FROM historial_examenes WHERE orden_paciente = (SELECT orden FROM pacientes WHERE id = ?)').run(id);
                db.prepare('DELETE FROM ordenes_archivadas WHERE paciente_id = ?').run(id);
                db.prepare('DELETE FROM pacientes WHERE id = ?').run(id);
            } else if (orden) {
                var ordenStr = String(orden).padStart(3, '0');
                db.prepare('DELETE FROM paciente_examenes WHERE orden_paciente = ?').run(ordenStr);
                db.prepare('DELETE FROM historial_examenes WHERE orden_paciente = ?').run(ordenStr);
                db.prepare('DELETE FROM ordenes_archivadas WHERE paciente_id = (SELECT id FROM pacientes WHERE orden = ?)').run(ordenStr);
                db.prepare('DELETE FROM pacientes WHERE orden = ?').run(ordenStr);
            }
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('eliminar-todos-pacientes', () => {
        try {
            db.exec('DELETE FROM paciente_examenes');
            db.exec('DELETE FROM historial_examenes');
            db.exec('DELETE FROM ordenes_archivadas');
            db.exec('DELETE FROM pacientes');
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('guardar-paciente-examenes', (event, data) => {
        try {
            guardarExamenesPaciente(db, data.orden, data.examenes || []);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('eliminar-examenes-paciente', (event, data) => {
        try {
            const eliminados = eliminarExamenesPaciente(db, data.orden, data.examenes);
            return { success: true, eliminados: eliminados };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('guardar-ref-adaptadas', (event, { orden, refAdaptadas }) => {
        try {
            db.prepare('UPDATE pacientes SET refAdaptadas = ? WHERE orden = ?').run(refAdaptadas ? 1 : 0, orden);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('guardar-historial-paciente', (event, data) => {
        try {
            guardarHistorialPaciente(db, data.orden, data.historial || []);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('obtener-proxima-orden', () => {
        try {
            var row = selectMaxOrdenStmt.get();
            var maxOrden = row ? parseInt(row.maxOrden || 0, 10) : 0;
            return { success: true, orden: String(maxOrden + 1).padStart(3, '0') };
        } catch (err) {
            return { success: false, error: err.message, orden: '001' };
        }
    });

    ipcMain.handle('crear-nueva-visita', (event, data) => {
        try {
            var paciente;
            if (data.pacienteId !== undefined) {
                paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(data.pacienteId);
            } else if (data.cedula) {
                paciente = db.prepare('SELECT * FROM pacientes WHERE cedula = ? ORDER BY id DESC LIMIT 1').get(data.cedula);
            }
            if (!paciente) {
                return { success: false, error: 'Paciente no encontrado', nuevaOrden: null };
            }
            var ordenAnterior = String(paciente.orden || '').padStart(3, '0');
            var examenes = selectExamenesStmt.all(ordenAnterior);
            var historial = selectHistorialStmt.all(ordenAnterior);
            const insertT = db.transaction(() => {
                insertOrdenArchivadaStmt.run(
                    paciente.id,
                    ordenAnterior,
                    paciente.fechaRegistro || '',
                    JSON.stringify(mapearExamenesGuardados(db, examenes)),
                    paciente.refAdaptadas || 0,
                    paciente.perfiles || '[]',
                    paciente.historial || '[]',
                    'archivada'
                );
                var row = selectMaxOrdenStmt.get();
                var maxOrden = row ? parseInt(row.maxOrden || 0, 10) : 0;
                var nuevaOrden = String(maxOrden + 1).padStart(3, '0');
                actualizarOrdenPaciente(
                    db,
                    paciente.id,
                    nuevaOrden,
                    new Date().toLocaleDateString('es-ES')
                );
                db.prepare('DELETE FROM paciente_examenes WHERE orden_paciente = ?').run(nuevaOrden);
                db.prepare('DELETE FROM historial_examenes WHERE orden_paciente = ?').run(nuevaOrden);
                return nuevaOrden;
            });
            var nuevaOrden = ejecutarConLlavesSuspendidas(db, insertT);
            db.prepare('UPDATE pacientes SET refAdaptadas = 0, perfiles = ?, historial = ? WHERE orden = ?')
                .run('[]', '[]', nuevaOrden);
            return {
                success: true,
                nuevaOrden: nuevaOrden,
                paciente: {
                    id: paciente.id,
                    orden: nuevaOrden,
                    nombre: paciente.nombre,
                    cedula: paciente.cedula,
                    edad: paciente.edad,
                    sexo: paciente.sexo,
                    fechaNac: paciente.fechaNac,
                    telefono: paciente.telefono,
                    visitas: (paciente.visitas || 1) + 1
                }
            };
        } catch (err) {
            return { success: false, error: err.message, nuevaOrden: null };
        }
    });

    ipcMain.handle('obtener-ordenes-archivadas', (event, { pacienteId, cedula, id }) => {
        try {
            var pid = pacienteId || id;
            var ordenes = [];
            if (pid !== undefined) {
                ordenes = selectOrdenesArchivadasStmt.all(pid);
            } else if (cedula) {
                var rows = db.prepare('SELECT * FROM ordenes_archivadas WHERE paciente_id IN (SELECT id FROM pacientes WHERE cedula = ?) ORDER BY id DESC').all(cedula);
                ordenes = rows;
            }
            ordenes = ordenes.map(o => Object.assign({}, o, {
                examenes: o.examenes ? JSON.parse(o.examenes) : [],
                refAdaptadas: !!o.refAdaptadas,
                perfiles: o.perfiles ? JSON.parse(o.perfiles) : [],
                historial: o.historial ? JSON.parse(o.historial) : []
            }));
            return { success: true, ordenes: ordenes };
        } catch (err) {
            return { success: false, error: err.message, ordenes: [] };
        }
    });

    registrarHandlersCatalogo(ipcMain, db, consultasCatalogo);
    console.log('✅ Base de datos SQLite inicializada:', dbPath);
}

function ejecutarConLlavesSuspendidas(db, transaccion) {
    const activas = !!db.pragma('foreign_keys', { simple: true });
    if (activas) db.pragma('foreign_keys = OFF');
    try {
        return transaccion();
    } finally {
        if (activas) db.pragma('foreign_keys = ON');
    }
}

function registrarHandlersCatalogo(ipcMain, db, consultasCatalogo) {
    function agruparPorClave(filas, clave) {
        const mapa = new Map();
        filas.forEach(fila => {
            const valor = fila[clave];
            if (!mapa.has(valor)) mapa.set(valor, []);
            mapa.get(valor).push(fila);
        });
        return mapa;
    }

    function envolver(fn) {
        return function(event, ...args) {
            try {
                return fn(...args);
            } catch (error) {
                console.error('[catalogo] Error:', error);
                return { success: false, error: error.message };
            }
        };
    }

    ipcMain.handle('obtener-parametros-examen', envolver(function(examenId) {
        const id = String(examenId || '').trim();
        if (!id) return { success: true, parametros: [], opciones: [] };
        const parametros = consultasCatalogo.parametros.all(id);
        const ids = new Set(parametros.map(p => p.id));
        const opciones = consultasCatalogo.opcionesParametro.all().filter(fila => ids.has(fila.parametro_id));
        return { success: true, parametros: parametros, opciones: opciones };
    }));

    ipcMain.handle('obtener-catalogo', envolver(function() {
        const categorias = consultasCatalogo.categorias.all();
        const examenes = consultasCatalogo.examenes.all();
        const opciones = agruparPorClave(consultasCatalogo.opcionesExamen.all(), 'examen_id');
        const parametrosPorExamen = agruparPorClave(consultasCatalogo.todosParametros.all(), 'examen_id');
        const opcionesParametro = agruparPorClave(consultasCatalogo.opcionesParametro.all(), 'parametro_id');
        const perfiles = consultasCatalogo.perfiles.all();
        const perfilesExamenes = agruparPorClave(consultasCatalogo.perfilesExamenes.all(), 'perfil_id');
        const examenesPorId = new Map(examenes.map(e => [e.id, e]));

        examenes.forEach(examen => {
            examen.opciones = valoresDe(opciones.get(examen.id));
            examen.parametros = parametrosPorExamen.get(examen.id) || [];
            examen.parametros.forEach(parametro => {
                parametro.opciones = valoresDe(opcionesParametro.get(parametro.id));
            });
        });

        resolverPerfiles(perfiles, perfilesExamenes, examenesPorId);
        return { success: true, categorias: categorias, examenes: examenes, perfiles: perfiles };
    }));

    ipcMain.handle('obtener-catalogo-admin', envolver(function() {
        return {
            success: true,
            categorias: consultasCatalogo.categoriasAdmin.all(),
            examenes: consultasCatalogo.examenesAdmin.all()
        };
    }));

    ipcMain.handle('guardar-examen-catalogo', envolver(function(examen) {
        return { success: true, examen: guardarExamenCatalogo(db, examen) };
    }));

    ipcMain.handle('actualizar-estado-examen-catalogo', envolver(function(data) {
        const resultado = actualizarEstadoExamenCatalogo(db, data && data.id, data && data.activo);
        return { success: true, examen: resultado };
    }));

    ipcMain.handle('eliminar-examen-catalogo', envolver(function(data) {
        const resultado = eliminarExamenCatalogo(db, data && data.id);
        return { success: true, examen: resultado };
    }));

    ipcMain.handle('obtener-referencias', envolver(function() {
        const rangos = consultasCatalogo.rangos.all();
        const porSexo = {};
        const compartidas = {};
        rangos.forEach(rango => {
            if (!rango.examen_id || rango.orden !== 1) return;
            if (rango.sexo !== 'ambos') {
                if (!porSexo[rango.examen_id]) porSexo[rango.examen_id] = {};
                const porEdad = porSexo[rango.examen_id];
                if (!porEdad[rango.categoria_edad]) porEdad[rango.categoria_edad] = {};
                porEdad[rango.categoria_edad][rango.sexo] = {
                    refMin: rango.ref_min,
                    refMax: rango.ref_max
                };
                return;
            }
            if (!compartidas[rango.examen_id]) compartidas[rango.examen_id] = {};
            compartidas[rango.examen_id][rango.categoria_edad] = {
                refMin: rango.ref_min,
                refMax: rango.ref_max
            };
        });
        return { success: true, sexSpecific: porSexo, shared: compartidas };
    }));

    ipcMain.handle('obtener-perfiles', envolver(function() {
        const perfiles = consultasCatalogo.perfiles.all();
        const examenesPorId = new Map(consultasCatalogo.examenes.all().map(e => [e.id, e]));
        const perfilesExamenes = agruparPorClave(consultasCatalogo.perfilesExamenes.all(), 'perfil_id');
        resolverPerfiles(perfiles, perfilesExamenes, examenesPorId);
        return { success: true, perfiles: perfiles };
    }));

    function resolverPerfiles(perfiles, perfilesExamenes, examenesPorId) {
        perfiles.forEach(perfil => {
            perfil.examenes = (perfilesExamenes.get(perfil.id) || []).map(fila => {
                const examen = examenesPorId.get(fila.examen_id);
                if (!examen) return { id: fila.examen_id, nombre: fila.examen_id };
                return {
                    id: examen.id,
                    nombre: examen.nombre,
                    area: examen.categoria,
                    unidad: examen.unidad,
                    tipo: examen.tipo,
                    refMin: examen.ref_min,
                    refMax: examen.ref_max,
                    refTexto: examen.ref_texto,
                    grupo: fila.grupo || examen.grupo,
                    orden: fila.orden
                };
            });
        });
        return perfiles;
    }

    function valoresDe(filas) {
        return (filas || []).map(fila => fila.valor);
    }
}

function closeDatabase() {
    if (!db) return;
    db.close();
    db = null;
}

module.exports = { initializeDatabase, closeDatabase };
