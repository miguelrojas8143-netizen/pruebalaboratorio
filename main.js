const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

let db = null;
let insertPacienteStmt = null;

function initDatabase() {
    const dbPath = path.join(__dirname, 'datos.db');
    db = new Database(dbPath);

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
            FOREIGN KEY(orden_paciente) REFERENCES pacientes(orden)
        )
    `);

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

    const selectExamenesPorOrdenStmt = db.prepare(
        'SELECT id, nombre_examen, resultado FROM paciente_examenes WHERE orden_paciente = ?'
    );

    const insertExamenStmt = db.prepare(
        'INSERT INTO paciente_examenes (orden_paciente, nombre_examen, resultado) VALUES (?, ?, ?)'
    );
    const selectExamenesStmt = db.prepare(
        'SELECT id, orden_paciente, nombre_examen, resultado FROM paciente_examenes WHERE orden_paciente = ?'
    );
    const deleteExamenesStmt = db.prepare(
        'DELETE FROM paciente_examenes WHERE orden_paciente = ?'
    );

    ipcMain.handle('guardar-examenes-paciente', (event, data) => {
        try {
            const t = db.transaction((examenes) => {
                deleteExamenesStmt.run(data.orden);
                for (const examen of examenes) {
                    insertExamenStmt.run(data.orden, examen.nombre_examen, examen.resultado || '');
                }
            });
            t(data.examenes || []);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('obtener-examenes-paciente', (event, { orden }) => {
        try {
            const examenes = selectExamenesStmt.all(orden);
            return { success: true, examenes: examenes };
        } catch (err) {
            return { success: false, error: err.message, examenes: [] };
        }
    });

    // Actualizar selectPacientesStmt para incluir las nuevas columnas
    const selectPacientesCompletosStmt = db.prepare(
        'SELECT id, orden, nombre, cedula, edad, sexo, fechaNac, telefono, fechaRegistro, refAdaptadas, perfiles, historial, visitas FROM pacientes ORDER BY CAST(orden AS INTEGER)'
    );

    const insertHistorialStmt = db.prepare(
        'INSERT INTO historial_examenes (orden_paciente, fecha, examen, resultado, unidad) VALUES (?, ?, ?, ?, ?)'
    );
    const selectHistorialStmt = db.prepare(
        'SELECT fecha, examen, resultado, unidad FROM historial_examenes WHERE orden_paciente = ? ORDER BY fecha DESC'
    );

    // IPC: Obtener pacientes con exámenes (para renderizado de cola)
    ipcMain.handle('obtener-pacientes-completos', () => {
        try {
            const pacientes = selectPacientesCompletosStmt.all();
            const result = pacientes.map(function(p) {
                var examenes = selectExamenesStmt.all(p.orden);
                return Object.assign({}, p, {
                    examenes: examenes.map(function(e) {
                        return { id: e.nombre_examen, nombre: e.nombre_examen, resultado: e.resultado || '' };
                    }),
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
                examenes: examenes.map(function(e) {
                    return { id: e.nombre_examen, nombre: e.nombre_examen, resultado: e.resultado || '' };
                }),
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
            const orden = data.orden;
            const examenes = data.examenes || [];
            const t = db.transaction(() => {
                deleteExamenesStmt.run(orden);
                for (const examen of examenes) {
                    var nombreExamen = examen.nombre_examen || examen.nombre || examen.id || '';
                    var resultado = examen.resultado || '';
                    insertExamenStmt.run(orden, nombreExamen, resultado);
                }
            });
            t();
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
            const orden = data.orden;
            const historial = data.historial || [];
            // Limpiar historial existente y reinsertar
            db.prepare('DELETE FROM historial_examenes WHERE orden_paciente = ?').run(orden);
            const t = db.transaction(() => {
                for (const entry of historial) {
                    insertHistorialStmt.run(orden, entry.fecha, entry.examen, entry.resultado || '', entry.unidad || '');
                }
            });
            t();
            // Also store in pacientes table as JSON for backward compatibility
            db.prepare('UPDATE pacientes SET historial = ? WHERE orden = ?').run(JSON.stringify(historial), orden);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    console.log('✅ Base de datos SQLite inicializada:', dbPath);
}

app.on('before-quit', () => {
    if (db) db.close();
});

const ICONO_APP = path.join(__dirname, 'logo-mirolab.png');

// Algunos equipos presentan bloqueos visuales del renderer al usar la GPU.
//app.disableHardwareAcceleration();
//app.commandLine.appendSwitch('disable-renderer-backgrounding');

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

     //Abrir DevTools DESPUÉS de crear la ventana
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