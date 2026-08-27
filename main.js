const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
// Configuración de la Demo
const DIAS_DEMO = 15;
const NOMBRE_APP = 'LabMig_Demo';

function verificarDemo() {
    const appDataPath = path.join(app.getPath('userData'), 'demo_config.json');
    let config = { fechaInicio: null };

    if (fs.existsSync(appDataPath)) {
        config = JSON.parse(fs.readFileSync(appDataPath, 'utf8'));
    } else {
        config.fechaInicio = Date.now();
        fs.writeFileSync(appDataPath, JSON.stringify(config));
    }

    const ahora = Date.now();
    const diasPasados = (ahora - config.fechaInicio) / (1000 * 60 * 60 * 24);

    return diasPasados <= DIAS_DEMO;
}

function crearVentana(rutaArchivo) {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
        title: 'LabMig Pro - Demo'
    });

    win.loadFile(rutaArchivo);
}

app.whenReady().then(() => {
    const esDemoValida = verificarDemo();

    if (esDemoValida) {
        crearVentana('index.html');
    } else {
        crearVentana('expirado.html');
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            crearVentana('index.html');
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
