const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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
            backgroundThrottling: false
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
    // mainWindow.webContents.openDevTools();

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