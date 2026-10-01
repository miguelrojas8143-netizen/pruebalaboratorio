const sqlite3 = require('better-sqlite3');
const db = new sqlite3.Database('/tmp/test-pacientes.db');

// Create tables to match the app schema
db.exec(`
  CREATE TABLE IF NOT EXISTS pacientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden TEXT,
    nombre TEXT,
    cedula TEXT,
    edad INTEGER,
    sexo TEXT,
    fechaNac TEXT,
    telefono TEXT,
    fechaRegistro TEXT,
    refAdaptadas INTEGER DEFAULT 0,
    perfiles TEXT DEFAULT '[]',
    historial TEXT DEFAULT '[]',
    visitas INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS paciente_examenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_paciente TEXT,
    examen TEXT,
    resultado TEXT,
    unidad TEXT
  );
  CREATE TABLE IF NOT EXISTS historial_examenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_paciente TEXT,
    examen TEXT,
    resultado TEXT,
    unidad TEXT,
    fecha TEXT
  );
  CREATE TABLE IF NOT EXISTS ordenes_archivadas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER,
    orden TEXT,
    fecha TEXT,
    examenes TEXT,
    refAdaptadas INTEGER
  );
`);

// Test SELECT statements from main.js
const selectPacientePorOrdenStmt = db.prepare(
  'SELECT id, orden, nombre, cedula, edad, sexo, fechaNac, telefono, fechaRegistro, refAdaptadas, perfiles, historial, visitas FROM pacientes WHERE orden = ?'
);

const selectPacientesCompletosStmt = db.prepare(
  'SELECT id, orden, nombre, cedula, edad, sexo, fechaNac, telefono, fechaRegistro, refAdaptadas, perfiles, historial, visitas FROM pacientes ORDER BY CAST(orden AS INTEGER)'
);

// Insert a test patient
const insertStmt = db.prepare(
  'INSERT OR REPLACE INTO pacientes (orden, nombre, cedula, edad, sexo, fechaNac, telefono, fechaRegistro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
insertStmt.run('001', 'Test Patient', '12345678', 30, 'M', '1990-01-01', '555-1234', '2025-01-15');

console.log('=== Test obtener-paciente-por-orden ===');
let result = selectPacientePorOrdenStmt.get('001');
console.log('Patient found:', JSON.stringify(result));

console.log('\n=== Test obtener-pacientes-completos ===');
let pacientes = selectPacientesCompletosStmt.all();
console.log('Patients:', JSON.stringify(pacientes, null, 2));

console.log('\n=== Test with missing orden ===');
let result2 = selectPacientePorOrdenStmt.get('999');
console.log('Missing patient:', result2);

console.log('\n=== Test with non-zero-padded orden ===');
let result3 = selectPacientePorOrdenStmt.get('1');
console.log('Non-padded orden:', result3);

db.close();
