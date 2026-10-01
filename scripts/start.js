'use strict';

const { spawn } = require('child_process');
const electron = require('electron');

const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

const app = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: env
});

app.on('error', function(error) {
    console.error('No se pudo iniciar Electron:', error.message);
    process.exitCode = 1;
});

app.on('exit', function(code, signal) {
    if (signal) {
        process.exitCode = 1;
        return;
    }
    process.exitCode = code == null ? 1 : code;
});