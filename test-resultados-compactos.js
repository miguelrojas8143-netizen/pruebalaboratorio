const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rows = [];
const tbody = {
    innerHTML: '',
    appendChild: function(row) {
        rows.push(row);
    }
};
const total = { textContent: '' };
const window = {
    App: { examenesDetallados: {} },
    examenesOrden: [
        {
            id: 'examen_orina',
            nombre: 'Examen General de Orina',
            tipoFormulario: 'uroanalisis',
            resultado: JSON.stringify({ ur_aspecto: 'Turbio', ur_ph: '5.8' })
        },
        {
            id: 'examen_heces',
            nombre: 'Examen Directo de Heces',
            tipoFormulario: 'heces',
            resultado: JSON.stringify({ consistencia: 'Blanda', phHeces: '6.5' })
        },
        {
            id: 'examen_orina_vacio',
            nombre: 'Uroanálisis sin resultados',
            tipoFormulario: 'uroanalisis',
            resultado: '{}'
        }
    ]
};
const document = {
    getElementById: function(id) {
        return id === 'tablaExamenes' ? tbody : total;
    },
    createElement: function() {
        return { setAttribute: function() {}, classList: { add: function() {} } };
    }
};

vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'public/js/orden.js'), 'utf8'),
    { window: window, document: document, alert: function() {}, URLSearchParams: URLSearchParams }
);
window.renderizarTablaExamenes();

const examRows = rows.filter(function(row) { return row.className === 'examen-row'; });
assert.strictEqual(examRows.length, 3);
assert(examRows[0].innerHTML.includes('Editar resultados'));
assert(examRows[1].innerHTML.includes('Editar resultados'));
assert(examRows[2].innerHTML.includes('Cargar resultados'));
['Turbio', '5.8', 'Blanda', '6.5', 'ur_aspecto', 'Macroscópico'].forEach(function(texto) {
    assert.strictEqual(examRows.some(function(row) { return row.innerHTML.includes(texto); }), false);
});
assert(examRows.every(function(row) { return row.innerHTML.includes('abrirFormulario'); }));

console.log('OK: las filas de orina y heces ocultan resultados y conservan el botón de edición/carga.');