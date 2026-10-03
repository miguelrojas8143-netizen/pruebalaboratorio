#!/usr/bin/env node
'use strict';

/**
 * Script de migración automática del catálogo de exámenes.
 *
 * Lee los arrays/objetos de los archivos .js de configuración
 * (public/js/catalogo-base.js, examenes-detallados.js, referencias.js,
 * perfiles.js), los normaliza y ejecuta los INSERT INTO masivos sobre SQLite
 * respetando las claves foráneas.
 *
 * Uso:
 *   npm run migrar:catalogo
 *   npm run migrar:catalogo -- --db=/ruta/al/datos.db
 *   node scripts/migrar-catalogo.js --verificar
 *
 * better-sqlite3 se compila contra el ABI de Electron, así que si el script se
 * lanza con Node puro el proceso se relanzará con el binario de Electron en
 * modo Node (ELECTRON_RUN_AS_NODE=1).
 *
 * Opciones:
 *   --db=<ruta>      Base de datos destino. Sin valor, usa la carpeta de
 *                    datos de Electron; ":memory:" para una base efímera.
 *   --verificar      Imprime el resumen de lo almacenado y sale.
 *   --sql-only       No escribe nada: solo muestra el conteo normalizado.
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

function cargarDriverSqlite() {
    try {
        return require('better-sqlite3');
    } catch (error) {
        return null;
    }
}

/**
 * better-sqlite3 es un módulo nativo compilado contra el ABI de Electron: abrir
 * una conexión con Node puro aborta el proceso. Por eso el script siempre se
 * relanza con el binario de Electron en modo Node (ELECTRON_RUN_AS_NODE=1),
 * que es exactamente el runtime en el que corre la aplicación.
 */
function relanzarConElectron() {
    if (process.env.CATALOGO_MIGRADO_CON_ELECTRON === '1') {
        console.error('❌ No se pudo ejecutar el script ni con Node ni con Electron.');
        console.error('   Ejecuta "npm run postinstall" para recompilar better-sqlite3.');
        process.exit(1);
    }

    let binarioElectron;
    try {
        binarioElectron = require('electron');
    } catch (error) {
        binarioElectron = null;
    }
    if (typeof binarioElectron !== 'string') {
        console.error('❌ No se encontró el binario de Electron requerido por better-sqlite3.');
        console.error('   Ejecuta "npm run postinstall" para recompilar el módulo nativo.');
        process.exit(1);
    }

    const resultado = spawnSync(binarioElectron, [__filename].concat(process.argv.slice(2)), {
        stdio: 'inherit',
        env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1', CATALOGO_MIGRADO_CON_ELECTRON: '1' })
    });
    process.exit(resultado.status === null ? 1 : resultado.status);
}

if (!process.versions.electron) relanzarConElectron();

const Database = cargarDriverSqlite();
if (!Database) {
    console.error('❌ No se pudo cargar better-sqlite3.');
    process.exit(1);
}

const {
    leerConfiguracionDesdeArchivos,
    normalizarConfiguracion,
    migrarCatalogoDesdeArchivos
} = require('../database/migracion-catalogo');
const { prepararConsultasCatalogo } = require('../database/schema');

const RAIZ_PROYECTO = path.resolve(__dirname, '..');

function leerArgumentos(argv) {
    const opciones = { db: null, verificar: false, sqlOnly: false };
    argv.forEach(function(argumento) {
        if (argumento.indexOf('--db=') === 0) {
            opciones.db = argumento.slice('--db='.length);
        } else if (argumento === '--verificar') {
            opciones.verificar = true;
        } else if (argumento === '--sql-only') {
            opciones.sqlOnly = true;
        } else if (argumento === '--help' || argumento === '-h') {
            console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#![^\n]*\n/, ''));
            process.exit(0);
        }
    });
    return opciones;
}

/** Ruta por defecto: la misma que usa la aplicación en producción. */
function resolverRutaPorDefecto() {
    const appName = 'mirolab-systems';
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || '', appName, 'datos.db');
    }
    if (process.platform === 'darwin') {
        return path.join(process.env.HOME || '', 'Library', 'Application Support', appName, 'datos.db');
    }
    return path.join(process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || '', '.config'), appName, 'datos.db');
}

function imprimirResumen(db) {
    const consultas = prepararConsultasCatalogo(db);
    const tablas = [
        ['categorias_examenes', 'categorias'],
        ['examenes', 'examenes'],
        ['parametros_examen', 'parametros'],
        ['rangos_referencia', 'rangos'],
        ['opciones_examen', 'opciones de prueba'],
        ['opciones_parametro', 'opciones de parámetro'],
        ['perfiles', 'perfiles'],
        ['perfiles_examenes', 'perfiles_x_examenes']
    ];
    console.log('\n📊 Contenido de la base de datos:');
    tablas.forEach(function(fila) {
        const total = db.prepare('SELECT COUNT(*) AS total FROM ' + fila[0]).get().total;
        console.log('   ' + fila[1].padEnd(22) + String(total).padStart(5));
    });

    console.log('\n🔎 Muestra de rangos por sexo/edad (parametros_examen_rangos):');
    const muestra = consultas.parametros.all('hematologia_completa')
        .filter(function(fila) { return fila.codigo === 'hemoglobina'; })
        .map(function(fila) {
            return [
                fila.nombre,
                'M adulto: ' + fila.ref_min_m_adulto + '-' + fila.ref_max_m_adulto,
                'F adulto: ' + fila.ref_min_f_adulto + '-' + fila.ref_max_f_adulto,
                'Ped: ' + fila.ref_min_pediatrico + '-' + fila.ref_max_pediatrico
            ].join('  |  ');
        });
    muestra.forEach(function(linea) { console.log('   ' + linea); });

    const categoriasHuerfanas = db.prepare(`
        SELECT c.id, c.nombre FROM categorias_examenes c
        LEFT JOIN examenes e ON e.categoria_id = c.id
        WHERE e.id IS NULL
    `).all();
    if (categoriasHuerfanas.length > 0) {
        console.log('\n⚠️  Categorías sin exámenes:', categoriasHuerfanas);
    }
}

function main() {
    const opciones = leerArgumentos(process.argv.slice(2));

    if (opciones.sqlOnly) {
        const dataset = normalizarConfiguracion(leerConfiguracionDesdeArchivos(RAIZ_PROYECTO));
        console.log('Conteo normalizado (sin escribir):', {
            categorias: dataset.categorias.length,
            examenes: dataset.examenes.length,
            parametros: dataset.parametros.length,
            rangos: dataset.rangos.length,
            perfiles: dataset.perfiles.length
        });
        return;
    }

    const rutaDb = opciones.db === null ? resolverRutaPorDefecto() : opciones.db;
    const esMemoria = rutaDb === ':memory:';

    if (!esMemoria) {
        const carpeta = path.dirname(rutaDb);
        if (!fs.existsSync(carpeta)) {
            console.error('❌ La carpeta destino no existe: ' + carpeta);
            process.exit(1);
        }
    }

    console.log('🗄️  Base de datos destino:', rutaDb);
    const db = new Database(rutaDb);
    db.pragma('journal_mode = WAL');

    try {
        if (opciones.verificar) {
            imprimirResumen(db);
            return;
        }
        migrarCatalogoDesdeArchivos(db, RAIZ_PROYECTO);
        imprimirResumen(db);
        console.log('\n🎉 Migración completada. La aplicación puede arrancar.');
    } finally {
        db.close();
    }
}

main();
