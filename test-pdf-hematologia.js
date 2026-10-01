'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const window = {
    App: {},
    detectarPerfilesPaciente: function() { return []; },
    normalizarExamen: function(examen) { return examen; },
    separarVSG: function(examenes) {
        return {
            vsg: examenes.filter(function(examen) { return examen.id === 'vsg'; }),
            otros: examenes.filter(function(examen) { return examen.id !== 'vsg'; })
        };
    },
    aplicarReferenciasAdaptadas: function(paciente, examenes) { return examenes; }
};
const contexto = vm.createContext({ window, console, Date, JSON, Map, Set });
const raiz = __dirname;

vm.runInContext(fs.readFileSync(path.join(raiz, 'public/js/examenes-detallados.js'), 'utf8'), contexto);
vm.runInContext(fs.readFileSync(path.join(raiz, 'public/js/pdf.js'), 'utf8'), contexto);

const resultadoBiometria = JSON.stringify({
    globulos_blancos: '7.2',
    hemoglobina: '14.1',
    plaquetas: '230',
    __referencias: { hemoglobina: 'F: 12.0-16.0' }
});
const payload = window.PdfReport.buildPayload({
    nombre: 'Paciente de prueba',
    orden: '001',
    examenes: [{
        id: 'Examen',
        nombre: 'Examen',
        area: 'General',
        tipo: 'numerico',
        resultado: resultadoBiometria
    }]
});

assert.strictEqual(payload.secciones.length, 1);
assert.strictEqual(payload.secciones[0].nombre, 'Hematología');
const filas = payload.secciones[0].subareas.flatMap(function(subarea) { return subarea.rows || []; });
assert.strictEqual(filas.length, 23);
assert.strictEqual(filas.find(function(fila) { return fila.nombre === 'Glóbulos Blancos'; }).texto, '7.2');
assert.strictEqual(filas.find(function(fila) { return fila.nombre === 'Hemoglobina'; }).texto, '14.1');
assert.strictEqual(filas.find(function(fila) { return fila.nombre === 'Hemoglobina'; }).refTexto, 'F: 12.0-16.0');
assert.ok(filas.every(function(fila) { return fila.texto !== resultadoBiometria; }));

console.log('OK: el PDF expande una biometría JSON guardada con ID genérico en 23 filas.');