'use strict';

/**
 * Arranca Electron en el proyecto.
 *
 * Reporta con claridad las dos causas que suelen romper `npm start` y que si no
 * se ven como "no funciona" sin más:
 *   1. Electron no instalado (falta node_modules/electron o su postinstall).
 *   2. El proceso termina con error nada más arrancar.
 */
const { spawn } = require('child_process');
const electron = require('electron');

const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

const app = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: env
});

app.on('error', function(error) {
    console.error('\n❌ No se pudo iniciar Electron:', error.message);
    console.error('   Revise la instalación con:  npm install');
    process.exitCode = 1;
});

app.on('exit', function(code, signal) {
    if (signal) {
        console.error('\n❌ Electron terminó por la señal:', signal);
        process.exitCode = 1;
        return;
    }
    // Código 0: cierre normal del usuario. Cualquier otro es un fallo.
    if (code !== null && code !== 0) {
        console.error('\n❌ Electron salió con código de error:', code);
        process.exitCode = code;
    }
});
