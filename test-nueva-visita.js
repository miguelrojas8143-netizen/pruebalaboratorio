'use strict';

const assert = require('assert');
const Database = require('better-sqlite3');
const { actualizarOrdenPaciente } = require('./database/ordenes');

const db = new Database(':memory:');

try {
    db.exec(`
        CREATE TABLE pacientes (
            id INTEGER PRIMARY KEY,
            orden TEXT UNIQUE,
            visitas INTEGER DEFAULT 1,
            fechaRegistro TEXT
        );
        INSERT INTO pacientes (id, orden) VALUES (1, '014'), (2, '015');
    `);

    const resultado = actualizarOrdenPaciente(db, 1, '016', '03/10/2026');
    assert.strictEqual(resultado.changes, 1);
    assert.deepStrictEqual(db.prepare('SELECT orden, visitas FROM pacientes ORDER BY id').all(), [
        { orden: '016', visitas: 2 },
        { orden: '015', visitas: 1 }
    ]);

    console.log('OK: crear nueva visita modifica solo al paciente seleccionado.');
} finally {
    db.close();
}