const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Database = require('better-sqlite3');

const db = new Database(':memory:');
db.exec(`
    CREATE TABLE paciente_examenes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_paciente TEXT,
        nombre_examen TEXT,
        resultado TEXT DEFAULT ''
    )
`);

const replaceExamenes = db.transaction(function(orden, examenes) {
    db.prepare('DELETE FROM paciente_examenes WHERE orden_paciente = ?').run(orden);
    const insert = db.prepare(
        'INSERT INTO paciente_examenes (orden_paciente, nombre_examen, resultado) VALUES (?, ?, ?)'
    );
    examenes.forEach(function(examen) {
        insert.run(orden, examen.nombre || examen.id, examen.resultado || '');
    });
});

const campos = {
    mocoFecal: 'Escaso',
    phHeces: '6.5',
    glucosaHeces: 'Negativa',
    leucocitosPMN: 'Ausentes',
    leucocitosMononucleados: 'Presentes',
    sustanciasReductoras: '0.30',
    consistencia: 'Blanda',
    colorHeces: 'Marrón',
    directoConcentracion: 'Negativo',
    entamoebaColi: 'Ausente',
    restosAlimentos: 'Escasos',
    floraBacteriana: 'Normal'
};
const elements = {};
Object.keys(campos).forEach(function(id) {
    elements[id] = { value: campos[id] };
});
elements.formularioHeces = {
    style: { display: 'none' },
    scrollIntoView: function() {}
};

const errors = [];
const alerts = [];
let shouldFail = false;
let renderCount = 0;
const window = {
    App: {},
    obtenerCatalogo: function() {
        return [{
            id: 'examen_heces',
            nombre: 'Examen Directo de Heces',
            area: 'Coproanálisis',
            tipo: 'heces'
        }];
    },
    examenesOrden: [
        { id: 'examen_heces', nombre: 'Examen Directo de Heces', tipoFormulario: 'heces', resultado: '{}' },
        { id: 'glucosa', nombre: 'Glucosa', resultado: '96' }
    ],
    pacienteActivo: { orden: '001', examenes: [] },
    api: {
        guardarPacienteExamenes: async function(orden, examenes) {
            if (shouldFail) return { success: false, error: 'fallo simulado' };
            replaceExamenes(orden, examenes);
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

vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'public/js/utils.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'public/js/heces.js'), 'utf8'), context);

async function main() {
    window._examenHecesEditando = 'examen_heces';
    elements.formularioHeces.style.display = 'block';
    await window.guardarFormularioHeces();

    const rows = db.prepare(
        'SELECT nombre_examen, resultado FROM paciente_examenes WHERE orden_paciente = ? ORDER BY id'
    ).all('001');
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].nombre_examen, 'Examen Directo de Heces');
    assert.deepStrictEqual(JSON.parse(rows[0].resultado), campos);
    assert.strictEqual(rows[1].resultado, '96');
    assert.strictEqual(elements.formularioHeces.style.display, 'none');
    assert.strictEqual(renderCount, 1);
    assert.strictEqual(window.pacienteActivo.examenes[0].resultado, rows[0].resultado);

    const examenesRecargados = db.prepare(
        'SELECT nombre_examen, resultado FROM paciente_examenes WHERE orden_paciente = ?'
    ).all('001').map(function(row) {
        return { id: row.nombre_examen, nombre: row.nombre_examen, resultado: row.resultado };
    });
    window.examenesOrden = window.enriquecerExamenesDesdeCatalogo(examenesRecargados);
    assert.strictEqual(window.examenesOrden[0].tipoFormulario, 'heces');
    Object.keys(campos).forEach(function(id) {
        elements[id].value = '';
    });
    window.abrirFormularioHeces(window.examenesOrden[0].id);
    assert.deepStrictEqual(
        Object.keys(campos).reduce(function(result, id) {
            result[id] = elements[id].value;
            return result;
        }, {}),
        campos
    );

    shouldFail = true;
    elements.phHeces.value = '7.4';
    await window.guardarFormularioHeces();
    assert.strictEqual(elements.formularioHeces.style.display, 'block');
    assert.strictEqual(renderCount, 1);
    assert.strictEqual(window.examenesOrden[0].resultado, rows[0].resultado);
    assert.strictEqual(db.prepare(
        'SELECT resultado FROM paciente_examenes WHERE orden_paciente = ? AND nombre_examen = ?'
    ).get('001', 'Examen Directo de Heces').resultado, rows[0].resultado);
    assert(alerts.some(function(message) { return message.indexOf('fallo simulado') !== -1; }));
    assert.strictEqual(errors.length, 1);

    db.close();
    console.log('OK: persistencia, recarga y manejo de errores del examen de heces.');
}

main().catch(function(error) {
    db.close();
    console.error(error);
    process.exitCode = 1;
});
