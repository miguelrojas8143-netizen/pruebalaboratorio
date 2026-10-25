const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { initializeDatabase, closeDatabase } = require('./database/manager');

// --- AJUSTES PARA EQUIPOS DE BAJOS RECURSOS ---
// Se mantienen los que ya tenía el proyecto: evitan bloqueos visuales del
// renderer en equipos sin GPU dedicada. NO se limita el heap de V8
// (--max-old-space-size): un techo bajo provoca "JavaScript heap out of memory"
// y cierra el proceso sin dejar ventana.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-renderer-backgrounding');

app.on('before-quit', closeDatabase);

const ICONO_APP = path.join(__dirname, 'logo-mirolab.png');

// --- CONFIGURACIÓN DE LA DEMO ---
const DIAS_DEMO = 30;
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
        show: false,
        icon: ICONO_APP,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        title: `${NOMBRE_APP} Demo`
    });
    
    let tituloVentana;
    if (!opciones.esValida) {
        tituloVentana = `${NOMBRE_APP} Demo Expirada`;
    } else if (opciones.diasRestantes !== undefined) {
        const textoDias = opciones.diasRestantes === 1 ? 'día' : 'días';
        tituloVentana = `${NOMBRE_APP} Demo (${opciones.diasRestantes} ${textoDias} restantes)`;
    } else {
        tituloVentana = `${NOMBRE_APP} Demo`;
    }
    win.setTitle(tituloVentana);

    if (process.platform === 'win32' && app.isPackaged) {
        win.webContents.on('page-title-updated', (event) => {
            event.preventDefault();
            win.setTitle(tituloVentana);
        });
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
    
    // Reenvía los errores y advertencias de la consola del renderer al terminal.
    // Sin esto, una página que falla al cargar se ve como "la app no arranca"
    // sin dar ninguna pista de por qué.
    win.webContents.on('console-message', (_event, nivel, mensaje, linea, origen) => {
        if (nivel >= 2) {
            console.error(`[renderer] ${origen}:${linea} ${mensaje}`);
        }
    });
    
    win.loadFile(path.join(__dirname, rutaArchivo)).catch((error) => {
        console.error(`[renderer] No se pudo cargar ${rutaArchivo}:`, error && error.message);
    });
    return win;
}

let mainWindow;

app.whenReady().then(() => {
    // 0. Inicializar base de datos SQLite
    initializeDatabase(app.getPath('userData'), __dirname, ipcMain);
    
    const demoInfo = verificarDemo();
    
    // 1. Splash mientras carga la ventana principal
    const splash = crearSplashScreen();
    
    // 2. La demo expirada debe abrir su pantalla, no la app completa
    const rutaArchivo = demoInfo.esValida ? 'index.html' : 'expirado.html';
    const opcionesVentana = {
        esValida: demoInfo.esValida,
        diasRestantes: demoInfo.diasRestantes
    };
    
    // 3. Si algo falla aquí, mostrar el error: una ventana que nunca se crea
    //    se confunde con "npm start no funciona" y no deja ningún rastro.
    try {
        mainWindow = crearVentana(rutaArchivo, opcionesVentana);
      
         // mainWindow.webContents.openDevTools();
       // if (demoInfo.esValida) {
           
           
      //  }

        
    } catch (error) {
        console.error('[arranque] No se pudo crear la ventana principal:', error);
        dialog.showErrorBox(
            'MiroLab Systems - Error al iniciar',
            `No se pudo abrir la ventana principal.\n\n${error && error.message ? error.message : error}`
        );
        if (!splash.isDestroyed()) splash.destroy();
        return;
    }
    
    // Splash con duración mínima: la ventana aparece a los 2s, o antes si
    // `ready-to-show` llega después de ese plazo. Idempotente para que los dos
    // caminos no se pisen.
    const TIEMPO_SPLASH_MS = 2000;
    let ventanaLista = false;
    let splashCompletado = false;
    let yaTransicionado = false;
    
    const transicionar = () => {
        if (yaTransicionado || !ventanaLista || !splashCompletado) return;
        yaTransicionado = true;
        if (!splash.isDestroyed()) splash.destroy();
        if (!mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
        }
    };
    
    setTimeout(() => {
        splashCompletado = true;
        transicionar();
    }, TIEMPO_SPLASH_MS);
    
    mainWindow.once('ready-to-show', () => {
        ventanaLista = true;
        transicionar();
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
        mainWindow = crearVentana(ruta, {
            esValida: estadoDemo.esValida,
            diasRestantes: estadoDemo.diasRestantes
        });
    }
});