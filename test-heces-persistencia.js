const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Database = require('better-sqlite3');
const {
    guardarExamenesPaciente,
    mapearExamenesGuardados,
    migrarExamenesPacienteLegados
} = require('./database/examenes');

const db = new Database(':memory:');
db.exec(`
    CREATE TABLE paciente_examenes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_paciente TEXT,
        nombre_examen TEXT,
        resultado TEXT DEFAULT '',
        examen_id TEXT,
        idresultado TEXT,
        referencia TEXT
    )
`);
db.exec(`
    CREATE TABLE examenes (
        id TEXT PRIMARY KEY, nombre TEXT, unidad TEXT DEFAULT '',
        ref_min REAL, ref_max REAL, ref_texto TEXT DEFAULT '', grupo TEXT DEFAULT '',
        orden INTEGER DEFAULT 0
    );
    CREATE TABLE parametros_examen (
        codigo TEXT, nombre TEXT, unidad TEXT DEFAULT '',
        ref_min REAL, ref_max REAL, ref_texto TEXT DEFAULT '', grupo TEXT DEFAULT '',
        examen_id TEXT,
        orden INTEGER,
        orden_render INTEGER
    )
`);
db.prepare('INSERT INTO examenes (id, nombre) VALUES (?, ?)').run(
    'examen_heces',
    'Examen Directo de Heces'
);
const insertarParametro = db.prepare(
    'INSERT INTO parametros_examen (codigo, nombre, examen_id, orden, orden_render) VALUES (?, ?, ?, ?, ?)'
);
[
    'consistencia', 'colorHeces', 'mocoFecal', 'phHeces', 'glucosaHeces',
    'sustanciasReductoras', 'leucocitosPMN', 'leucocitosMononucleados',
    'directoConcentracion', 'entamoebaColi', 'restosAlimentos', 'floraBacteriana'
].forEach(function(codigo, orden) {
    insertarParametro.run(codigo, codigo, 'examen_heces', orden, orden);
});

const replaceExamenes = function(orden, examenes) {
    guardarExamenesPaciente(db, orden, examenes);
};

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
// El catálogo real se hidrata en db-catalogo.js desde SQLite; el mock reproduce
// esa forma para que heces.js lea los parámetros de window.App sin respaldos.
const CAMPOS_HECES_CATALOGO = Object.keys(campos).map(function(id) {
    return { id: id, nombre: id, tipo: 'texto', grupo: 'General' };
});
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
    App: { examenesDetallados: { examen_heces: { nombre: 'Examen Directo de Heces', items: CAMPOS_HECES_CATALOGO } } },
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
        'SELECT orden_paciente, nombre_examen, resultado, examen_id, idresultado, referencia FROM paciente_examenes WHERE orden_paciente = ? ORDER BY id'
    ).all('001');
    assert.strictEqual(rows.length, Object.keys(campos).length + 1);
    assert.strictEqual(rows.filter(function(row) { return row.idresultado; }).length, Object.keys(campos).length);
    assert.deepStrictEqual(
        rows.filter(function(row) { return row.idresultado; }).reduce(function(result, row) {
            result[row.idresultado] = row.resultado;
            return result;
        }, {}),
        campos
    );
    assert.strictEqual(rows.find(function(row) { return !row.idresultado; }).resultado, '96');
    assert.strictEqual(elements.formularioHeces.style.display, 'none');
    assert.strictEqual(renderCount, 1);
    assert.deepStrictEqual(
        JSON.parse(window.pacienteActivo.examenes[0].resultado),
        campos
    );

    const examenesRecargados = mapearExamenesGuardados(db, rows);
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

    db.prepare(`
        INSERT INTO paciente_examenes
            (orden_paciente, nombre_examen, resultado, examen_id)
        VALUES (?, ?, ?, ?)
    `).run('002', 'Examen Directo de Heces', JSON.stringify(campos), 'examen_heces');
    assert.strictEqual(migrarExamenesPacienteLegados(db), 1);
    const filasLegadasConvertidas = db.prepare(`
        SELECT orden_paciente, nombre_examen, resultado, examen_id, idresultado, referencia
        FROM paciente_examenes WHERE orden_paciente = ? ORDER BY id
    `).all('002');
    assert.strictEqual(filasLegadasConvertidas.length, Object.keys(campos).length);
    assert.deepStrictEqual(
        JSON.parse(mapearExamenesGuardados(db, filasLegadasConvertidas)[0].resultado),
        campos
    );

    elements.phHeces.value = '7.2';
    await window.guardarFormularioHeces();
    const filasCorregidas = db.prepare(
        'SELECT idresultado, resultado FROM paciente_examenes WHERE orden_paciente = ? AND idresultado IS NOT NULL'
    ).all('001');
    const resultadosCorregidos = filasCorregidas.reduce(function(result, row) {
        result[row.idresultado] = row.resultado;
        return result;
    }, {});
    assert.strictEqual(resultadosCorregidos.phHeces, '7.2');
    Object.keys(campos).filter(function(id) { return id !== 'phHeces'; }).forEach(function(id) {
        assert.strictEqual(resultadosCorregidos[id], campos[id]);
    });
    assert.strictEqual(renderCount, 2);

    shouldFail = true;
    window.abrirFormularioHeces(window.examenesOrden[0].id);
    elements.phHeces.value = '8.1';
    await window.guardarFormularioHeces();
    assert.strictEqual(elements.formularioHeces.style.display, 'block');
    assert.strictEqual(elements.phHeces.value, '8.1');
    assert.strictEqual(renderCount, 2);
    assert.strictEqual(JSON.parse(window.examenesOrden[0].resultado).phHeces, '7.2');
    assert.strictEqual(db.prepare(
        'SELECT resultado FROM paciente_examenes WHERE orden_paciente = ? AND idresultado = ?'
    ).get('001', 'phHeces').resultado, '7.2');
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
