'use strict';

const assert = require('assert');
const Database = require('better-sqlite3');
const { eliminarExamenesPaciente } = require('./database/examenes');

const db = new Database(':memory:');

try {
    db.exec(`
        CREATE TABLE pacientes (
            orden TEXT PRIMARY KEY,
            nombre TEXT,
            historial TEXT DEFAULT '[]'
        );
        CREATE TABLE examenes (id TEXT PRIMARY KEY, nombre TEXT);
        CREATE TABLE parametros_examen (examen_id TEXT, codigo TEXT);
        CREATE TABLE historial_examenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orden_paciente TEXT,
            fecha TEXT,
            examen TEXT,
            resultado TEXT,
            unidad TEXT,
            idresultado TEXT,
            referencia TEXT
        );
        CREATE TABLE paciente_examenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orden_paciente TEXT,
            nombre_examen TEXT,
            resultado TEXT,
            examen_id TEXT,
            idresultado TEXT,
            referencia TEXT
        );

        INSERT INTO pacientes (orden, nombre, historial) VALUES
            ('001', 'Paciente de prueba', '[{"examen":"Glucosa"},{"examen_completo":"Hemograma"},{"examen":"Otro examen"}]'),
            ('002', 'Otro paciente', '[]');
        INSERT INTO examenes (id, nombre) VALUES
            ('glucosa', 'Glucosa'),
            ('hemograma', 'Hemograma'),
            ('otro', 'Otro examen');
        INSERT INTO parametros_examen (examen_id, codigo) VALUES
            ('hemograma', 'hemoglobina'),
            ('hemograma', 'globulos_blancos');
        INSERT INTO historial_examenes
            (orden_paciente, fecha, examen, resultado, idresultado) VALUES
            ('001', '01/10/2026', 'Glucosa', '95', NULL),
            ('001', '01/10/2026', 'Hemograma', '14', 'hemoglobina'),
            ('001', '01/10/2026', 'Hemograma', '7', 'globulos_blancos'),
            ('001', '01/10/2026', 'Otro examen', 'OK', NULL),
            ('002', '01/10/2026', 'Glucosa', '88', NULL);
        INSERT INTO paciente_examenes
            (orden_paciente, nombre_examen, resultado, examen_id, idresultado) VALUES
            ('001', 'Glucosa', '95', 'glucosa', NULL),
            ('001', 'Hemograma', '14', 'hemograma', 'hemoglobina'),
            ('001', 'Hemograma', '7', 'hemograma', 'globulos_blancos'),
            ('001', 'Otro examen', 'OK', 'otro', NULL),
            ('002', 'Glucosa', '88', 'glucosa', NULL);
    `);

    eliminarExamenesPaciente(db, '001', [{ id: 'glucosa', nombre: 'Glucosa' }]);
    eliminarExamenesPaciente(db, '001', [{ id: 'hemograma', nombre: 'Hemograma' }]);

    assert.deepStrictEqual(
        db.prepare('SELECT examen, idresultado FROM historial_examenes WHERE orden_paciente = ?').all('001'),
        [{ examen: 'Otro examen', idresultado: null }]
    );
    assert.deepStrictEqual(
        db.prepare('SELECT nombre_examen FROM paciente_examenes WHERE orden_paciente = ?').all('001'),
        [{ nombre_examen: 'Otro examen' }]
    );
    assert.strictEqual(
        db.prepare('SELECT COUNT(*) AS total FROM historial_examenes WHERE orden_paciente = ?').get('002').total,
        1
    );
    assert.strictEqual(
        db.prepare('SELECT COUNT(*) AS total FROM paciente_examenes WHERE orden_paciente = ?').get('002').total,
        1
    );
    const paciente = db.prepare('SELECT nombre, historial FROM pacientes WHERE orden = ?').get('001');
    assert.strictEqual(paciente.nombre, 'Paciente de prueba');
    assert.deepStrictEqual(JSON.parse(paciente.historial), [{ examen: 'Otro examen' }]);

    console.log('OK: se eliminaron solo los resultados de los exámenes solicitados y de su paciente.');
} finally {
    db.close();
    if (process.versions.electron) require('electron').app.quit();
}
