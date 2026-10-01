'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const {
    EXAMENES_HEMATOLOGIA,
    inicializarCatalogoExamenes,
    guardarHistorialPaciente
} = require('./database/examenes');

const dbPath = path.join(os.tmpdir(), 'mirolab-examenes-' + process.pid + '.db');
const db = new Database(dbPath);

try {
    db.exec(`
        CREATE TABLE pacientes (orden TEXT PRIMARY KEY, historial TEXT DEFAULT '[]');
        CREATE TABLE historial_examenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orden_paciente TEXT,
            fecha TEXT,
            examen TEXT,
            resultado TEXT,
            unidad TEXT
        );
        INSERT INTO pacientes (orden) VALUES ('001');
    `);
    db.prepare(`
        INSERT INTO historial_examenes (orden_paciente, fecha, examen, resultado, unidad)
        VALUES (?, ?, ?, ?, ?)
    `).run('001', '30/09/2026', 'Hematología Completa', JSON.stringify({
        globulos_blancos: '7.2',
        hemoglobina: '13.8',
        neutrofilos_por: '55',
        __referencias: { hemoglobina: 'F: 12.0-16.0' }
    }), '');
    db.prepare(`
        INSERT INTO historial_examenes (orden_paciente, fecha, examen, resultado, unidad)
        VALUES (?, ?, ?, ?, ?)
    `).run('001', '30/09/2026', 'Glucosa', '91', 'mg/dL');

    inicializarCatalogoExamenes(db);
    inicializarCatalogoExamenes(db);

    assert.strictEqual(db.prepare('SELECT COUNT(*) AS total FROM examenes').get().total, 23);
    const migrados = db.prepare(`
        SELECT h.idresultado, h.resultado, h.unidad, h.referencia, e.nombre, e.refMin, e.refMax
        FROM historial_examenes h
        JOIN examenes e ON e.id = h.idresultado
        WHERE h.orden_paciente = ?
        ORDER BY h.idresultado
    `).all('001');
    assert.strictEqual(migrados.length, 3);
    assert.deepStrictEqual(migrados.map(function(row) { return row.idresultado; }).sort(), [
        'globulos_blancos', 'hemoglobina', 'neutrofilos_por'
    ]);
    assert.strictEqual(migrados.find(function(row) { return row.idresultado === 'hemoglobina'; }).referencia, 'F: 12.0-16.0');
    assert.strictEqual(db.prepare("SELECT COUNT(*) AS total FROM historial_examenes WHERE examen = 'Hematología Completa' AND idresultado IS NULL").get().total, 0);
    assert.strictEqual(db.prepare("SELECT COUNT(*) AS total FROM historial_examenes WHERE examen = 'Glucosa' AND idresultado IS NULL").get().total, 1);

    const resultadosNuevos = [
        {
            fecha: '01/10/2026',
            examen: 'Hematología Completa',
            resultado: JSON.stringify({
                globulos_blancos: '8.1',
                hemoglobina: '14.2',
                neutrofilos_por: '58',
                __referencias: { hemoglobina: 'F: 12.0-16.0' }
            })
        },
        { fecha: '01/10/2026', examen: 'Glucosa', resultado: '96', unidad: 'mg/dL' }
    ];
    guardarHistorialPaciente(db, '001', resultadosNuevos);
    const guardados = db.prepare(`
        SELECT idresultado, resultado, unidad, referencia
        FROM historial_examenes
        WHERE orden_paciente = ?
        ORDER BY idresultado
    `).all('001');
    assert.strictEqual(guardados.length, 4);
    assert.strictEqual(guardados.find(function(row) { return row.idresultado === 'hemoglobina'; }).resultado, '14.2');
    assert.strictEqual(guardados.find(function(row) { return row.idresultado === 'hemoglobina'; }).referencia, 'F: 12.0-16.0');
    assert.strictEqual(guardados.find(function(row) { return row.idresultado === null; }).resultado, '96');

    const historialHidratado = db.prepare(`
        SELECT h.fecha, COALESCE(e.nombre, h.examen) AS examen, h.examen AS examen_completo,
               h.resultado, COALESCE(e.unidad, h.unidad, '') AS unidad, h.idresultado,
             h.referencia, e.refMin, e.refMax
        FROM historial_examenes h
        LEFT JOIN examenes e ON e.id = h.idresultado
        WHERE h.orden_paciente = ?
    `).all('001');
    guardarHistorialPaciente(db, '001', historialHidratado);
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS total FROM historial_examenes WHERE orden_paciente = ?').get('001').total, 4);
    assert.strictEqual(JSON.parse(db.prepare('SELECT historial FROM pacientes WHERE orden = ?').get('001').historial).length, 4);
    assert.strictEqual(EXAMENES_HEMATOLOGIA.length, 23);

    console.log('OK: catálogo, migración y guardado/recarga del historial hematológico.');
} finally {
    db.close();
    for (const sufijo of ['', '-shm', '-wal']) {
        try { fs.unlinkSync(dbPath + sufijo); } catch (error) {}
    }
}