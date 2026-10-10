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
    // El catálogo real se hidrata en db-catalogo.js desde SQLite; el mock
    // reproduce esa forma para que el formulario lea los parámetros de
    // window.App.examenesDetallados.examen_orina en lugar de una lista fija.
    App: {
        examenesDetallados: {
            examen_orina: {
                nombre: 'Examen General de Orina',
                items: [
                    { id: 'ur_aspecto', nombre: 'Aspecto', tipo: 'seleccion_unica', grupo: 'Macroscópico', opciones: ['Límpido', 'Turbio', 'Ligeramente turbio'] },
                    { id: 'ur_color', nombre: 'Color', tipo: 'seleccion_unica', grupo: 'Macroscópico', opciones: ['Amarillo claro', 'Amarillo oscuro'] },
                    { id: 'ur_ph', nombre: 'pH', tipo: 'numerico', grupo: 'Químico', refMin: 4.5, refMax: 8.0 },
                    { id: 'ur_densidad', nombre: 'Densidad', tipo: 'numerico', grupo: 'Químico', refMin: 1.005, refMax: 1.030 }
                ]
            }
        }
    },
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
    // Los campos salen del catálogo (parametros_examen vía window.App), no de
    // una lista fija en el frontend. El array se reconstruye en este realm
    // porque deepStrictEqual compara prototipos y el original viene del vm.
    var idsCampos = [];
    window.UROANALISIS_FIELDS.forEach(function(f) { idsCampos.push(f.id); });
    assert.deepStrictEqual(idsCampos, ['ur_aspecto', 'ur_color', 'ur_ph', 'ur_densidad']);
    var campoPh = window.UROANALISIS_FIELDS.find(function(f) { return f.id === 'ur_ph'; });
    assert.strictEqual(campoPh.nombre, 'pH');
    assert.strictEqual(campoPh.tipo, 'numerico');
    assert.strictEqual(campoPh.grupo, 'Químico');
    assert.strictEqual(campoPh.refMin, 4.5);
    assert.strictEqual(campoPh.refMax, 8.0);
    var campoAspecto = window.UROANALISIS_FIELDS.find(function(f) { return f.id === 'ur_aspecto'; });
    assert.strictEqual(campoAspecto.tipo, 'seleccion_unica');

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