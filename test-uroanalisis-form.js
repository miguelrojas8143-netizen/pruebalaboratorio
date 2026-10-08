const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const originalResults = {
    ur_aspecto: 'Turbio',
    ur_color: 'Amarillo oscuro',
    ur_ph: '5.8'
};
const elements = {};
const exam = {
    id: 'examen_orina',
    examen_id: 'examen_orina',
    nombre: 'Examen General de Orina',
    tipoFormulario: 'uroanalisis',
    tipo: 'uroanalisis',
    resultado: JSON.stringify(originalResults)
};
const errors = [];
const alerts = [];
let shouldFail = false;
let renderCount = 0;
let savedExams = null;

elements.formularioUroanalisis = {
    style: { display: 'none' },
    scrollIntoView: function() {}
};

const window = {
    examenesOrden: [exam],
    pacienteActivo: { orden: '001', examenes: [] },
    api: {
        guardarPacienteExamenes: async function(orden, examenes) {
            assert.strictEqual(orden, '001');
            if (shouldFail) return { success: false, error: 'fallo simulado' };
            savedExams = JSON.parse(JSON.stringify(examenes));
            return { success: true };
        }
    },
    renderizarTablaExamenes: function() {
        renderCount++;
    }
};
window.pacienteActivo.examenes = JSON.parse(JSON.stringify(window.examenesOrden));

const context = {
    window: window,
    document: {
        getElementById: function(id) {
            return elements[id] || null;
        }
    },
    alert: function(message) {
        alerts.push(message);
    },
    console: {
        error: function() {
            errors.push(Array.prototype.slice.call(arguments));
        }
    }
};

vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'public/js/uroanalisis-form.js'), 'utf8'),
    context
);

async function main() {
    window.UROANALISIS_FIELDS.forEach(function(field) {
        elements['uro_' + field.id] = { value: '' };
    });

    window.abrirFormularioUroanalisis(exam.id);
    assert.strictEqual(elements.uro_ur_aspecto.value, 'Turbio');
    assert.strictEqual(elements.uro_ur_color.value, 'Amarillo oscuro');
    assert.strictEqual(elements.uro_ur_ph.value, '5.8');

    elements.uro_ur_ph.value = '6.4';
    await window.guardarFormularioUroanalisis();
    assert.strictEqual(elements.formularioUroanalisis.style.display, 'none');
    assert.strictEqual(renderCount, 1);
    assert.strictEqual(savedExams[0].examen_id, 'examen_orina');
    assert.strictEqual(savedExams[0].tipoFormulario, 'uroanalisis');
    assert.strictEqual(savedExams[0].resultado.ur_ph, '6.4');
    assert.strictEqual(savedExams[0].resultado.ur_aspecto, 'Turbio');
    assert.strictEqual(JSON.parse(exam.resultado).ur_ph, '6.4');
    assert.strictEqual(JSON.parse(window.pacienteActivo.examenes[0].resultado).ur_ph, '6.4');

    window.abrirFormularioUroanalisis(exam.id);
    elements.uro_ur_ph.value = '7.1';
    shouldFail = true;
    await window.guardarFormularioUroanalisis();
    assert.strictEqual(elements.formularioUroanalisis.style.display, 'block');
    assert.strictEqual(elements.uro_ur_ph.value, '7.1');
    assert.strictEqual(window._uroEditando, exam.id);
    assert.strictEqual(JSON.parse(exam.resultado).ur_ph, '6.4');
    assert.strictEqual(renderCount, 1);
    assert(alerts.some(function(message) { return message.indexOf('fallo simulado') !== -1; }));
    assert.strictEqual(errors.length, 1);

    console.log('OK: uroanálisis precarga, corrige y persiste resultados; ante error conserva la edición abierta.');
}

main().catch(function(error) {
    console.error(error);
    process.exitCode = 1;
});