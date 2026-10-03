const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const {
    inicializarCatalogoExamenes,
    guardarExamenesPaciente,
    mapearExamenesGuardados,
    guardarHistorialPaciente
} = require('./database/examenes');
const { prepararConsultasCatalogo } = require('./database/schema');

let db = null;
let insertPacienteStmt = null;
let consultasCatalogo = null;

function initDatabase() {
    // Usar la carpeta de datos del usuario (funciona en desarrollo y producción)
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'datos.db');
    
    console.log('📁 Ruta de la base de datos:', dbPath);
    
    db = new Database(dbPath);
    
    // Habilitar WAL mode para mejor rendimiento
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
    
    // Migración: agregar columnas si la tabla ya existía sin ellas
    const columnas = db.prepare('PRAGMA table_info(pacientes)').all();
    const tieneFecha = columnas.some(function(c) { return c.name === 'fechaRegistro'; });
    if (!tieneFecha) {
        db.exec('ALTER TABLE pacientes ADD COLUMN fechaRegistro TEXT');
    }
    const tieneFechaNac = columnas.some(function(c) { return c.name === 'fechaNac'; });
    if (!tieneFechaNac) {
        db.exec('ALTER TABLE pacientes ADD COLUMN fechaNac TEXT');
    }
    const tieneTelefono = columnas.some(function(c) { return c.name === 'telefono'; });
    if (!tieneTelefono) {
        db.exec('ALTER TABLE pacientes ADD COLUMN telefono TEXT');
    }
    const tieneId = columnas.some(function(c) { return c.name === 'id'; });
    if (!tieneId) {
        db.exec('ALTER TABLE pacientes ADD COLUMN id INTEGER');
    }
    const tieneRefAdaptadas = columnas.some(function(c) { return c.name === 'refAdaptadas'; });
    if (!tieneRefAdaptadas) {
        db.exec('ALTER TABLE pacientes ADD COLUMN refAdaptadas INTEGER DEFAULT 0');
    }
    const tienePerfiles = columnas.some(function(c) { return c.name === 'perfiles'; });
    if (!tienePerfiles) {
        db.exec('ALTER TABLE pacientes ADD COLUMN perfiles TEXT DEFAULT \'[]\'');
    }
    const tieneHistorial = columnas.some(function(c) { return c.name === 'historial'; });
    if (!tieneHistorial) {
        db.exec('ALTER TABLE pacientes ADD COLUMN historial TEXT DEFAULT \'[]\'');
    }
    const tieneVisitas = columnas.some(function(c) { return c.name === 'visitas'; });
    if (!tieneVisitas) {
        db.exec('ALTER TABLE pacientes ADD COLUMN visitas INTEGER DEFAULT 1');
    }
    
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

    inicializarCatalogoExamenes(db, __dirname);
    consultasCatalogo = prepararConsultasCatalogo(db);
    
    // Tabla para órdenes archivadas (cuando un paciente crea una nueva visita)
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
    
    // Prepared statements para órdenes archivadas
    const insertOrdenArchivadaStmt = db.prepare(
        'INSERT INTO ordenes_archivadas (paciente_id, orden, fecha, examenes, refAdaptadas, perfiles, historial, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const selectOrdenesArchivadasStmt = db.prepare(
        'SELECT * FROM ordenes_archivadas WHERE paciente_id = ? ORDER BY id DESC'
    );
    const selectMaxOrdenStmt = db.prepare(
        'SELECT MAX(CAST(orden AS INTEGER)) as maxOrden FROM (SELECT orden FROM pacientes UNION ALL SELECT orden FROM ordenes_archivadas)'
    );
    
    insertPacienteStmt = db.prepare(
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
    
    // IPC: Actualizar datos de un paciente existente (preserva refAdaptadas, perfiles, historial, visitas)
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

    /**
     * Resuelve cómo se identifica un examen al persistirlo. El id del catálogo
     * es lo que permite reconstruir después el tipo de formulario (heces,
     * uroanálisis, antibiograma) sin depender del nombre; el nombre se usa
     * como etiqueta legible en el reporte.
     */
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
    
    // Actualizar selectPacientesStmt para incluir las nuevas columnas
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
    
    // IPC: Obtener pacientes con exámenes (para renderizado de cola)
    ipcMain.handle('obtener-pacientes-completos', () => {
        try {
            const pacientes = selectPacientesCompletosStmt.all();
            const result = pacientes.map(function(p) {
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
    
    // IPC: Obtener paciente por orden con exámenes y historial
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
    
    // IPC: Eliminar paciente por id o orden
    ipcMain.handle('eliminar-paciente', (event, { id, orden }) => {
        try {
            if (id !== undefined && id !== null) {
                db.prepare('DELETE FROM paciente_examenes WHERE orden_paciente = (SELECT orden FROM pacientes WHERE id = ?)').run(id);
                db.prepare('DELETE FROM historial_examenes WHERE orden_paciente = (SELECT orden FROM pacientes WHERE id = ?)').run(id);
                db.prepare('DELETE FROM pacientes WHERE id = ?').run(id);
            } else if (orden) {
                var ordenStr = String(orden).padStart(3, '0');
                db.prepare('DELETE FROM paciente_examenes WHERE orden_paciente = ?').run(ordenStr);
                db.prepare('DELETE FROM historial_examenes WHERE orden_paciente = ?').run(ordenStr);
                db.prepare('DELETE FROM pacientes WHERE orden = ?').run(ordenStr);
            }
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
    
    // IPC: Eliminar todos los pacientes
    ipcMain.handle('eliminar-todos-pacientes', () => {
        try {
            db.exec('DELETE FROM paciente_examenes');
            db.exec('DELETE FROM historial_examenes');
            db.exec('DELETE FROM pacientes');
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
    
    // IPC: Guardar exámenes de un paciente (formato orden.js)
    ipcMain.handle('guardar-paciente-examenes', (event, data) => {
        try {
            guardarExamenesPaciente(db, data.orden, data.examenes || []);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
    
    // IPC: Guardar refAdaptadas de un paciente
    ipcMain.handle('guardar-ref-adaptadas', (event, { orden, refAdaptadas }) => {
        try {
            db.prepare('UPDATE pacientes SET refAdaptadas = ? WHERE orden = ?').run(refAdaptadas ? 1 : 0, orden);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
    
    // IPC: Guardar historial de exámenes
    ipcMain.handle('guardar-historial-paciente', (event, data) => {
        try {
            guardarHistorialPaciente(db, data.orden, data.historial || []);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
    
    // IPC: Obtener el próximo número de orden disponible
    ipcMain.handle('obtener-proxima-orden', () => {
        try {
            var row = selectMaxOrdenStmt.get();
            var maxOrden = row ? parseInt(row.maxOrden || 0, 10) : 0;
            return { success: true, orden: String(maxOrden + 1).padStart(3, '0') };
        } catch (err) {
            return { success: false, error: err.message, orden: '001' };
        }
    });
    
    // IPC: Crear nueva visita para paciente existente (archiva orden anterior)
    // Parámetros: { pacienteId } o { cedula }
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
            // Archivar órden anterior con sus exámenes
            var ordenAnterior = String(paciente.orden || '').padStart(3, '0');
            var examenes = selectExamenesStmt.all(ordenAnterior);
            var historial = selectHistorialStmt.all(ordenAnterior);
            const insertT = db.transaction(() => {
                // Insertar orden archivada
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
                // Calcular nuevo número de orden
                var row = selectMaxOrdenStmt.get();
                var maxOrden = row ? parseInt(row.maxOrden || 0, 10) : 0;
                var nuevaOrden = String(maxOrden + 1).padStart(3, '0');
                // Actualizar paciente: nuevo orden, incrementar visitas, nueva fecha
                db.prepare(
                    'UPDATE pacientes SET orden = ?, visitas = visitas + 1, fechaRegistro = ?'
                ).run(nuevaOrden, new Date().toLocaleDateString('es-ES'));
                // Limpiar exámenes de la nueva orden (no deben existir aún)
                db.prepare('DELETE FROM paciente_examenes WHERE orden_paciente = ?').run(nuevaOrden);
                // Limpiar historial de exámenes para la nueva orden
                db.prepare('DELETE FROM historial_examenes WHERE orden_paciente = ?').run(nuevaOrden);
                return nuevaOrden;
            });
            var nuevaOrden = insertT();
            // Limpiar refAdaptadas y perfiles para la nueva orden
            db.prepare('UPDATE pacientes SET refAdaptadas = 0, perfiles = ? WHERE orden = ?')
                .run('[]', nuevaOrden);
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
    
    // IPC: Obtener órdenes archivadas de un paciente
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
            // Parsear JSON fields
            ordenes = ordenes.map(function(o) {
                return Object.assign({}, o, {
                    examenes: o.examenes ? JSON.parse(o.examenes) : [],
                    refAdaptadas: !!o.refAdaptadas,
                    perfiles: o.perfiles ? JSON.parse(o.perfiles) : [],
                    historial: o.historial ? JSON.parse(o.historial) : []
                });
            });
            return { success: true, ordenes: ordenes };
        } catch (err) {
            return { success: false, error: err.message, ordenes: [] };
        }
    });
    
    registrarHandlersCatalogo();

    console.log('✅ Base de datos SQLite inicializada:', dbPath);
}

/**
 * Catálogo de exámenes servido desde SQLite.
 *
 * Todas las consultas usan prepared statements con parámetros vinculados, por
 * lo que ningún valor del renderer se concatena en el SQL. Los resultados se
 * arman en objetos planos listos para el renderer.
 */
function registrarHandlersCatalogo() {
    function agruparPorClave(filas, clave) {
        const mapa = new Map();
        filas.forEach(function(fila) {
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

    /** SELECT * FROM parametros_examen WHERE examen_id = ? */
    ipcMain.handle('obtener-parametros-examen', envolver(function(examenId) {
        const id = String(examenId || '').trim();
        if (!id) return { success: true, parametros: [], opciones: [] };
        const parametros = consultasCatalogo.parametros.all(id);
        const ids = new Set(parametros.map(function(p) { return p.id; }));
        const opciones = consultasCatalogo.opcionesParametro.all().filter(function(fila) {
            return ids.has(fila.parametro_id);
        });
        return { success: true, parametros: parametros, opciones: opciones };
    }));

    /** Un solo volcado con todo el catálogo; evita N consultas de red. */
    ipcMain.handle('obtener-catalogo', envolver(function() {
        const categorias = consultasCatalogo.categorias.all();
        const examenes = consultasCatalogo.examenes.all();
        const opciones = agruparPorClave(consultasCatalogo.opcionesExamen.all(), 'examen_id');
        const parametrosPorExamen = agruparPorClave(consultasCatalogo.todosParametros.all(), 'examen_id');
        const opcionesParametro = agruparPorClave(consultasCatalogo.opcionesParametro.all(), 'parametro_id');
        const perfiles = consultasCatalogo.perfiles.all();
        const perfilesExamenes = agruparPorClave(consultasCatalogo.perfilesExamenes.all(), 'perfil_id');

        const examenesPorId = new Map(examenes.map(function(e) { return [e.id, e]; }));

        examenes.forEach(function(examen) {
            examen.opciones = valoresDe(opciones.get(examen.id));
            examen.parametros = parametrosPorExamen.get(examen.id) || [];
            examen.parametros.forEach(function(parametro) {
                parametro.opciones = valoresDe(opcionesParametro.get(parametro.id));
            });
        });

        resolverPerfiles(perfiles, perfilesExamenes, examenesPorId);

        return { success: true, categorias: categorias, examenes: examenes, perfiles: perfiles };
    }));

    /** Rangos de referencia por sexo y franja etaria. */
    ipcMain.handle('obtener-referencias', envolver(function() {
        const rangos = consultasCatalogo.rangos.all();
        const porSexo = {};
        const compartidas = {};
        rangos.forEach(function(rango) {
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

    /** Perfiles con la composición de sus exámenes. */
    ipcMain.handle('obtener-perfiles', envolver(function() {
        const perfiles = consultasCatalogo.perfiles.all();
        const examenesPorId = new Map(consultasCatalogo.examenes.all().map(function(e) { return [e.id, e]; }));
        const perfilesExamenes = agruparPorClave(consultasCatalogo.perfilesExamenes.all(), 'perfil_id');
        resolverPerfiles(perfiles, perfilesExamenes, examenesPorId);
        return { success: true, perfiles: perfiles };
    }));

    function resolverPerfiles(perfiles, perfilesExamenes, examenesPorId) {
        perfiles.forEach(function(perfil) {
            perfil.examenes = (perfilesExamenes.get(perfil.id) || []).map(function(fila) {
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
        return (filas || []).map(function(fila) { return fila.valor; });
    }
}

app.on('before-quit', () => {
    if (db) db.close();
});

const ICONO_APP = path.join(__dirname, 'logo-mirolab.png');

// Algunos equipos presentan bloqueos visuales del renderer al usar la GPU.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// --- CONFIGURACIÓN DE LA DEMO ---
const DIAS_DEMO = 10;
const NOMBRE_APP = 'MiroLab Systems';
const CLAVE_SECRETA = 'MiroLab-Systems-demo-v1-secure-key';

function verificarDemo() {
    const userDataPath = app.getPath('userData');
    const appDataPath = path.join(userDataPath, 'demo_config.json');
    const backupPath = path.join(userDataPath, 'demo_config.bak');
    const markerPath = path.join(userDataPath, 'demo_initialized');
    
    const firmar = (fecha) => {
        return crypto.createHmac('sha256', CLAVE_SECRETA)
            .update(String(fecha))
            .digest('hex');
    };
    
    const leerConfig = (archivo) => {
        try {
            if (!fs.existsSync(archivo)) return null;
            const contenido = fs.readFileSync(archivo, 'utf8');
            const dato = JSON.parse(contenido);
            if (dato && Number.isFinite(dato.fechaInicio) && dato.firma === firmar(dato.fechaInicio)) {
                return dato;
            }
            return null;
        } catch (error) {
            console.error('Error leyendo config:', error.message);
            return null;
        }
    };
    
    let config = leerConfig(appDataPath) || leerConfig(backupPath);
    
    if (!config) {
        if (fs.existsSync(markerPath)) {
            return { esValida: false, diasRestantes: 0, motivo: 'manipulacion' };
        }
        config = { fechaInicio: Date.now() };
        config.firma = firmar(config.fechaInicio);
        const contenido = JSON.stringify(config);
        try {
            fs.writeFileSync(appDataPath, contenido, { mode: 0o444 });
            fs.writeFileSync(backupPath, contenido, { mode: 0o444 });
            fs.writeFileSync(markerPath, '1', { mode: 0o444 });
        } catch (e) {
            console.error('No se pudo inicializar la demo:', e.message);
            return { esValida: false, diasRestantes: 0, motivo: 'error_escritura' };
        }
    }
    
    const ahora = Date.now();
    const milisegundosPorDia = 1000 * 60 * 60 * 24;
    const diasPasados = (ahora - config.fechaInicio) / milisegundosPorDia;
    const esValida = diasPasados >= -0.01 && diasPasados <= DIAS_DEMO; 
    const diasRestantes = Math.max(0, Math.ceil(DIAS_DEMO - diasPasados));
    
    return { esValida, diasRestantes };
}

function crearSplashScreen() {
    const splash = new BrowserWindow({
        width: 450,
        height: 500,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        center: true,
        resizable: false,
        icon: ICONO_APP,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    splash.loadFile(path.join(__dirname, 'splash.html'));
    return splash;
}

function crearVentana(rutaArchivo, opciones = {}) {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        icon: ICONO_APP,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        title: `${NOMBRE_APP} - Demo`
    });
    
    if (opciones.diasRestantes !== undefined) {
        const textoDias = opciones.diasRestantes === 1 ? 'día' : 'días';
        win.setTitle(`${NOMBRE_APP} - Demo (${opciones.diasRestantes} ${textoDias} restantes)`);
    } else if (!opciones.esValida) {
        win.setTitle(`${NOMBRE_APP} - Demo Expirada`);
    }
    
    win.webContents.on('unresponsive', () => {
        console.error(`[renderer] Ventana no responsiva: ${rutaArchivo}`);
    });
    
    win.webContents.on('responsive', () => {
        console.info(`[renderer] Ventana responsiva nuevamente: ${rutaArchivo}`);
    });
    
    win.webContents.on('render-process-gone', (_event, detalles) => {
        console.error('[renderer] Proceso terminado:', detalles.reason, detalles.exitCode);
    });
    
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        console.error('[renderer] Fallo de carga:', errorCode, errorDescription, validatedURL);
    });
    
    win.webContents.on('console-message', (_event, nivel, mensaje, linea, origen) => {
        if (nivel >= 2) {
            console.error(`[renderer] ${origen}:${linea} ${mensaje}`);
        }
    });
    
    win.loadFile(path.join(__dirname, rutaArchivo));
    return win;
}

let mainWindow;

app.whenReady().then(() => {
    // 0. Inicializar base de datos SQLite
    initDatabase();
    
    // 1. Mostrar Splash Screen
    const splash = crearSplashScreen();
    
    // 2. Verificar estado de la demo
    const resultadoDemo = verificarDemo();
    
    // 3. Determinar qué cargar
    const rutaArchivo = resultadoDemo.esValida ? 'index.html' : 'expirado.html';
    const opcionesVentana = {
        esValida: resultadoDemo.esValida,
        diasRestantes: resultadoDemo.diasRestantes
    };
    
    // 4. Crear ventana principal (oculta inicialmente)
    mainWindow = crearVentana(rutaArchivo, opcionesVentana);
    mainWindow.hide();
    
    // 5. Mostrar cuando la página esté lista
    mainWindow.once('ready-to-show', () => {
        if (!splash.isDestroyed()) splash.close();
        mainWindow.show();
        mainWindow.focus();
        // Abrir DevTools DESPUÉS de crear la ventana
        mainWindow.webContents.openDevTools();
    });
    
    splash.on('closed', () => {
        // Limpieza si fuera necesaria
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        const estadoDemo = verificarDemo();
        const ruta = estadoDemo.esValida ? 'index.html' : 'expirado.html';
        const config = { esValida: estadoDemo.esValida, diasRestantes: estadoDemo.diasRestantes };
        mainWindow = crearVentana(ruta, config);
    }
});