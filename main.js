const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
// Configuración de la Demo
const DIAS_DEMO = 10;
const NOMBRE_APP = 'MiroLab Sistems';

// Para una demo más clara, se muestra en el título de la ventana los días
// restantes. No es requerido para que la demo funcione, pero ayuda al usuario.

function verificarDemo() {
    const userData = app.getPath('userData');
    const appDataPath = path.join(userData, 'demo_config.json');
    const backupPath = path.join(userData, 'demo_config.bak');
    const markerPath = path.join(userData, 'demo_initialized');
    // La firma detecta cambios manuales en la fecha. No es posible impedir que
    // un usuario con permisos de administrador borre todos los datos de la app.
    const clave = 'MiroLab-Sistems-demo-v1';// Cambiar esta clave invalidará todas las demos existentes.
    const firmar = fecha => crypto.createHmac('sha256', clave)
        .update(String(fecha)).digest('hex');
    const leer = archivo => {
        try {
            const dato = JSON.parse(fs.readFileSync(archivo, 'utf8'));
            return dato && Number.isFinite(dato.fechaInicio) &&
                dato.firma === firmar(dato.fechaInicio) ? dato : null;
        } catch (_) {
            return null;
        }
    };

    let config = leer(appDataPath) || leer(backupPath);
    if (!config) {
        // Si ya se inicializó y falta o fue alterado el registro, la demo expira.
        if (fs.existsSync(markerPath)) return { esValida: false, diasRestantes: 0 };
        config = { fechaInicio: Date.now() };
        config.firma = firmar(config.fechaInicio);
        const contenido = JSON.stringify(config);
        fs.writeFileSync(appDataPath, contenido, { mode: 0o444 });
        fs.writeFileSync(backupPath, contenido, { mode: 0o444 });
        fs.writeFileSync(markerPath, '1', { mode: 0o444 });
    }

    const ahora = Date.now();
    const diasPasados = (ahora - config.fechaInicio) / (1000 * 60 * 60 * 24);
    const esValida = diasPasados >= 0 && diasPasados <= DIAS_DEMO;
    const diasRestantes = Math.max(0, DIAS_DEMO - Math.floor(diasPasados));

    return { esValida, diasRestantes };
}

function crearVentana(rutaArchivo, opciones = {}) {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
        title: 'MiroLab Sistems - Demo'
    });

    if (opciones.diasRestantes !== undefined) {
        const textoDias = opciones.diasRestantes === 1 ? 'día' : 'días';
        win.setTitle(`MiroLab Sistems - Demo (${opciones.diasRestantes} ${textoDias} restantes)`);
    }

    win.loadFile(rutaArchivo);
}

app.whenReady().then(() => {
    const resultadoDemo = verificarDemo();
    const rutaArchivo = resultadoDemo.esValida ? 'index.html' : 'expirado.html';
    const opciones = resultadoDemo.esValida ? { diasRestantes: resultadoDemo.diasRestantes } : {};

    crearVentana(rutaArchivo, opciones);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            const estadoDemo = verificarDemo();
            const ruta = estadoDemo.esValida ? 'index.html' : 'expirado.html';
            const configVentana = estadoDemo.esValida ? { diasRestantes: estadoDemo.diasRestantes } : {};
            crearVentana(ruta, configVentana);
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
