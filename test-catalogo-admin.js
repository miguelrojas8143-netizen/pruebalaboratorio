'use strict';

const assert = require('assert');
const Database = require('better-sqlite3');
const { migrarCatalogoDesdeArchivos } = require('./database/migracion-catalogo');
const {
    guardarExamenCatalogo,
    actualizarEstadoExamenCatalogo,
    eliminarExamenCatalogo
} = require('./database/catalogo-admin');
const { crearEsquemaCatalogo, prepararConsultasCatalogo } = require('./database/schema');

const raiz = __dirname;
const db = new Database(':memory:');

function consultarExamen(id) {
    return db.prepare('SELECT * FROM examenes WHERE id = ?').get(id);
}

const dbExistente = new Database(':memory:');
try {
    dbExistente.exec(`
        CREATE TABLE categorias_examenes (
            id TEXT PRIMARY KEY, nombre TEXT NOT NULL UNIQUE,
            orden INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE examenes (
            id TEXT PRIMARY KEY, categoria_id TEXT NOT NULL, nombre TEXT NOT NULL,
            unidad TEXT NOT NULL DEFAULT '', tipo TEXT NOT NULL DEFAULT 'numerico',
            tipo_formulario TEXT, grupo TEXT NOT NULL DEFAULT '',
            valor_defecto TEXT, ref_min REAL, ref_max REAL, ref_texto TEXT NOT NULL DEFAULT '',
            orden INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1
        );
    `);
    crearEsquemaCatalogo(dbExistente);
    assert(dbExistente.prepare('PRAGMA table_info(examenes)').all().some(function(columna) {
        return columna.name === 'origen';
    }), 'Las bases existentes deben migrar la columna de origen');
} finally {
    dbExistente.close();
}

try {
    migrarCatalogoDesdeArchivos(db, raiz, { silencioso: true });

    const orina = consultarExamen('examen_orina');
    const heces = consultarExamen('examen_heces');
    assert(orina, 'Debe existir el examen de orina');
    assert(heces, 'Debe existir el examen de heces');
    assert.strictEqual(orina.tipo_formulario, 'uroanalisis');
    assert.strictEqual(heces.tipo_formulario, 'heces');
    const idsActivos = prepararConsultasCatalogo(db).examenes.all().map(function(examen) {
        return examen.id;
    });
    assert(idsActivos.includes('examen_orina'), 'El examen de orina debe estar disponible en el catálogo activo');
    assert(idsActivos.includes('examen_heces'), 'El examen de heces debe estar disponible en el catálogo activo');

    const preexistente = db.prepare(`
        SELECT id FROM examenes WHERE tipo IN ('numerico', 'texto') ORDER BY id LIMIT 1
    `).get();
    assert(preexistente, 'La configuración base debe contener exámenes simples');
    const editado = guardarExamenCatalogo(db, {
        id: preexistente.id,
        nombre: 'Prueba de catálogo editada',
        categoria: 'Categoría de Prueba',
        unidad: 'mg/dL',
        tipo: 'numerico',
        refMin: 1.5,
        refMax: 9.5,
        refTexto: '',
        valorDefecto: '5'
    });
    assert.strictEqual(editado.nombre, 'Prueba de catálogo editada');
    assert.strictEqual(editado.categoria, 'Categoría de Prueba');
    assert.strictEqual(editado.activo, 1);

    const nuevo = guardarExamenCatalogo(db, {
        id: 'prueba_catalogo_nueva',
        nombre: 'Prueba nueva',
        categoria: 'Categoría Nueva',
        unidad: '',
        tipo: 'texto',
        refMin: null,
        refMax: null,
        refTexto: 'Negativo',
        valorDefecto: 'Negativo'
    });
    assert.strictEqual(nuevo.id, 'prueba_catalogo_nueva');

    const hecesActualizado = guardarExamenCatalogo(db, {
        id: 'examen_heces',
        nombre: 'Examen Directo de Heces',
        categoria: 'Coproanálisis',
        unidad: '',
        tipo: 'numerico',
        refMin: null,
        refMax: null,
        refTexto: '',
        valorDefecto: ''
    });
    assert.strictEqual(hecesActualizado.tipo, 'heces');
    assert.strictEqual(hecesActualizado.tipo_formulario, 'heces');

    migrarCatalogoDesdeArchivos(db, raiz, { silencioso: true });
    assert.strictEqual(consultarExamen(preexistente.id).nombre, 'Prueba de catálogo editada');
    assert(consultarExamen('prueba_catalogo_nueva'), 'La migración conserva los exámenes nuevos');
    assert.strictEqual(consultarExamen('examen_heces').tipo_formulario, 'heces');

    actualizarEstadoExamenCatalogo(db, 'prueba_catalogo_nueva', false);
    assert.strictEqual(consultarExamen('prueba_catalogo_nueva').activo, 0);
    migrarCatalogoDesdeArchivos(db, raiz, { silencioso: true });
    assert.strictEqual(consultarExamen('prueba_catalogo_nueva').activo, 0);
    assert.strictEqual(
        prepararConsultasCatalogo(db).examenes.all().some(function(examen) {
            return examen.id === 'prueba_catalogo_nueva';
        }),
        false
    );
    actualizarEstadoExamenCatalogo(db, 'prueba_catalogo_nueva', true);
    assert.strictEqual(consultarExamen('prueba_catalogo_nueva').activo, 1);

    eliminarExamenCatalogo(db, 'examen_heces');
    assert.strictEqual(consultarExamen('examen_heces').activo, 0);
    assert.strictEqual(consultarExamen('examen_heces').tipo_formulario, 'heces');
    assert.throws(function() {
        guardarExamenCatalogo(db, {
            id: 'MAL-ID',
            nombre: 'Inválido',
            categoria: 'General',
            tipo: 'texto'
        });
    }, /código/i);

    console.log('OK: administración del catálogo, persistencia, baja lógica y formularios especializados.');
} finally {
    db.close();
}
