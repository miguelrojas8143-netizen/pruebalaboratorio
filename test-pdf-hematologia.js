'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const elementosDom = {
    bloqueHeces: { innerHTML: '' },
    bloqueUroanalisis: { innerHTML: '' },
    bloqueAntibiograma: { innerHTML: '' }
};
const document = {
    getElementById: function(id) { return elementosDom[id] || null; },
    createElement: function() { return { className: '', innerHTML: '' }; }
};
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
window.tieneDatosUroanalisis = function(examen) {
    try {
        const valores = JSON.parse(examen.resultado || '{}');
        return Object.values(valores).some(function(valor) { return String(valor).trim() !== ''; });
    } catch (error) {
        return false;
    }
};
window.agruparUroanalisisPorGrupo = function(examenes) {
    return examenes.reduce(function(grupos, examen) {
        const grupo = examen.grupo || 'General';
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push(examen);
        return grupos;
    }, {});
};
const contexto = vm.createContext({ window, document, console, Date, JSON, Map, Set });
const raiz = __dirname;

vm.runInContext(fs.readFileSync(path.join(raiz, 'public/js/examenes-detallados.js'), 'utf8'), contexto);
vm.runInContext(fs.readFileSync(path.join(raiz, 'public/js/uroanalisis-form.js'), 'utf8'), contexto);
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

const payloadUro = window.PdfReport.buildPayload({
    nombre: 'Paciente de prueba',
    orden: '002',
    examenes: [{
        id: 'Examen',
        nombre: 'Examen',
        area: 'General',
        tipo: 'numerico',
        resultado: JSON.stringify({
            ur_aspecto: 'Turbio',
            ur_ph: '7.0',
            ur_densidad: '1.020',
            ur_bacterias: 'Moderadas'
        })
    }]
});

assert.ok(payloadUro.uro);
assert.strictEqual(payloadUro.secciones.length, 0);
assert.strictEqual(payloadUro.uro.grupos['Macroscópico'][0].nombre, 'Aspecto');
const filaPh = payloadUro.uro.grupos['Químico'].find(function(item) { return item.id === 'ur_ph'; });
assert.strictEqual(filaPh.refTexto, '4.5 - 8.0');
assert.strictEqual(payloadUro.uro.grupos['Químico'].find(function(item) { return item.id === 'ur_densidad'; }).refTexto, '1.005 - 1.030');
assert.strictEqual(Object.keys(payloadUro.uro.grupos).reduce(function(total, grupo) {
    return total + payloadUro.uro.grupos[grupo].length;
}, 0), 21);
assert.strictEqual(payloadUro.uro.grupos['Microscópico'].find(function(item) { return item.id === 'ur_bacterias'; }).nombre, 'Bacterias');
assert.strictEqual(payloadUro.hayResultados, true);
window.PdfReport.renderDom(payloadUro, {});
assert.ok(elementosDom.bloqueUroanalisis.innerHTML.includes('Valor de Referencia'));
assert.ok(elementosDom.bloqueUroanalisis.innerHTML.includes('7.0'));
assert.ok(elementosDom.bloqueUroanalisis.innerHTML.includes('4.5 - 8.0'));
assert.ok(elementosDom.bloqueUroanalisis.innerHTML.includes('cpo/campo'));
assert.ok(!elementosDom.bloqueUroanalisis.innerHTML.includes('"ur_aspecto"'));

console.log('OK: el PDF expande JSON de Hematología y Uroanálisis genérico en tablas estructuradas.');