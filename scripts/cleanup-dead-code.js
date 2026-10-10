#!/usr/bin/env node
/**
 * cleanup-dead-code.js - Analizador de archivos huérfanos (dead code)
 *
 * Uso:
 *   node scripts/cleanup-dead-code.js            # solo informa
 *   node scripts/cleanup-dead-code.js --delete   # borra los huérfanos detectados
 *
 * A diferencia de un escaneo exclusivo de <script src="...">, este script
 * entiende las tres formas en que un .js puede estar vivo en este proyecto:
 *
 *   1. Renderer:  referenciado por un <script src="..."> de un HTML.
 *   2. Node:      cargado con require() desde main.js, preload.js, database/
 *                 o scripts/ (incluidos los requires dinámicos por ruta).
 *   3. npm:       invocado desde los "scripts" de package.json.
 *
 * Además excluye del análisis lo que nunca debe borrarse:
 *   - Las semillas del catálogo (catalogo-base.js, examenes-detallados.js,
 *     referencias.js, perfiles.js): las lee database/migracion-catalogo.js
 *     para poblar SQLite y no se cargan en el HTML.
 *   - Las librerías de terceras de public/lib/.
 *   - Las pruebas (test-*.js) y las herramientas de desarrollo, que se
 *     reportan aparte porque no forman parte del paquete de la app.
 *
 * Requiere Node >= 12 (usa fs.promises y JSON estable).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

/** Semillas que migran a SQLite: se leen con vm, nunca con <script src>. */
const SEMILLAS = [
    'public/js/catalogo-base.js',
    'public/js/examenes-detallados.js',
    'public/js/referencias.js',
    'public/js/perfiles.js'
];

/** Directorios que se excluyen del barrido. */
const EXCLUIR = ['node_modules', '.git', 'dist', 'build', '.kilo'];

/** Raíces donde vive código del proceso principal de Node. */
const RAICES_NODE = ['.', 'database', 'scripts'];

/** Prefijos que se tratan como herramienta de desarrollo, no como app. */
const PREFIJOS_DEV = ['test-', 'depurador.js'];

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function rel(rutaAbsoluta) {
    return path.relative(RAIZ, rutaAbsoluta).split(path.sep).join('/');
}

/** Agrega un valor a una lista sin repetir. */
function agregarUnico(lista, valor) {
    if (lista.indexOf(valor) === -1) lista.push(valor);
}

function excluido(rutaAbsoluta) {
    const r = rel(rutaAbsoluta);
    return EXCLUIR.some(function(parte) {
        return r === parte || r.indexOf(parte + '/') === 0;
    });
}

function listarJs(directorio) {
    const abs = path.join(RAIZ, directorio);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs, { withFileTypes: true }).reduce(function(acc, entrada) {
        const ruta = path.join(abs, entrada.name);
        if (entrada.isDirectory()) {
            if (!excluido(ruta)) acc = acc.concat(listarJs(rel(ruta)));
        } else if (entrada.name.endsWith('.js') && !excluido(ruta)) {
            acc.push(rel(ruta));
        }
        return acc;
    }, []);
}

function listarHtml() {
    const raices = ['.', 'vistas', 'public/includes'];
    return raices.reduce(function(acc, directorio) {
        const abs = path.join(RAIZ, directorio);
        if (!fs.existsSync(abs)) return acc;
        fs.readdirSync(abs, { withFileTypes: true }).forEach(function(entrada) {
            if (!entrada.isFile() || !entrada.name.endsWith('.html')) return;
            const ruta = path.join(abs, entrada.name);
            if (!excluido(ruta)) acc.push(ruta);
        });
        return acc;
    }, []);
}

// ---------------------------------------------------------------------------
// 1. Referencias del renderer: <script src="...">
// ---------------------------------------------------------------------------

function referenciasEnHtml() {
    const encontradas = new Map(); // ruta js -> [html...]
    const regexScript = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

    listarHtml().forEach(function(htmlAbs) {
        const html = rel(htmlAbs);
        const contenido = fs.readFileSync(htmlAbs, 'utf8');
        let match;
        while ((match = regexScript.exec(contenido)) !== null) {
            const src = match[1].trim();
            if (!src.endsWith('.js')) continue;
            // Resuelve el src relativo al HTML que lo contiene.
            const destino = path.normalize(path.join(path.dirname(htmlAbs), src));
            const clave = rel(destino);
            if (!encontradas.has(clave)) encontradas.set(clave, []);
            encontradas.get(clave).push(html);
        }
    });

    return encontradas;
}

// ---------------------------------------------------------------------------
// 2. Referencias de Node: require() y rutas en package.json
// ---------------------------------------------------------------------------

function referenciasEnNode() {
    const encontradas = new Map(); // ruta js -> [origen...]
    const regexRequire = /require\(\s*['"](\.[^'"]+)['"]\s*\)/g;

    function resolver(origen, especificador) {
        const base = path.resolve(path.dirname(path.join(RAIZ, origen)), especificador);
        const candidatos = [base, base + '.js', path.join(base, 'index.js')];
        const existente = candidatos.find(function(c) {
            return fs.existsSync(c) && fs.statSync(c).isFile();
        });
        return existente ? rel(existente) : null;
    }

    RAICES_NODE.forEach(function(directorio) {
        listarJs(directorio).forEach(function(js) {
            const contenido = fs.readFileSync(path.join(RAIZ, js), 'utf8');
            let match;
            while ((match = regexRequire.exec(contenido)) !== null) {
                const destino = resolver(js, match[1]);
                if (!destino) continue;
                if (!encontradas.has(destino)) encontradas.set(destino, []);
                agregarUnico(encontradas.get(destino), js);
            }
        });
    });

    return encontradas;
}

// ---------------------------------------------------------------------------
// 3. Referencias de npm: "scripts" de package.json
// ---------------------------------------------------------------------------

function referenciasEnPackageJson() {
    const encontradas = new Map();
    const pkgPath = path.join(RAIZ, 'package.json');
    if (!fs.existsSync(pkgPath)) return encontradas;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const comandos = Object.values(pkg.scripts || {});
    // Acepta "node ruta.js", "node --flag ruta.js" y encadenados con && o ;.
    const regexNode = /(?:^|&&|;|\|\|)\s*node\s+(?:--[^\s]+\s+)*([^\s&;]+\.js)/g;

    comandos.forEach(function(comando) {
        let match;
        while ((match = regexNode.exec(comando)) !== null) {
            const candidato = match[1].replace(/["']/g, '');
            const abs = path.join(RAIZ, candidato);
            if (fs.existsSync(abs)) {
                const clave = rel(abs);
                if (!encontradas.has(clave)) encontradas.set(clave, []);
                agregarUnico(encontradas.get(clave), 'package.json');
            }
        }
    });

    return encontradas;
}

/**
 * 4. Referencias por cadena de texto dentro del código Node.
 *
 * Cubre los casos que no usan require(): el `main` de package.json y las rutas
 * que se pasan como literal, como `path.join(__dirname, 'preload.js')` en
 * main.js. Es una heurística deliberadamente amplia: en un limpiador, dejar un
 * archivo vivo por error es mucho menos grave que borrar el entry point.
 */
function referenciasPorCadena() {
    const encontradas = new Map();
    const pkgPath = path.join(RAIZ, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.main) {
            const abs = path.join(RAIZ, pkg.main);
            if (fs.existsSync(abs)) {
                encontradas.set(rel(abs), ['package.json:main']);
            }
        }
    }

    const regexCadena = /['"]([^'"]*\.js)['"]/g;
    RAICES_NODE.forEach(function(directorio) {
        listarJs(directorio).forEach(function(js) {
            // El analizador no opina sobre archivos a partir de su propio
            // código: sus constantes (semillas, prefijos) no son referencias.
            if (js === 'scripts/cleanup-dead-code.js') return;
            const contenido = fs.readFileSync(path.join(RAIZ, js), 'utf8');
            let match;
            while ((match = regexCadena.exec(contenido)) !== null) {
                const literal = match[1];
                if (literal.indexOf('node:') === 0 || literal.indexOf('http') === 0) continue;
                const candidatos = [
                    path.resolve(path.dirname(path.join(RAIZ, js)), literal),
                    path.join(RAIZ, literal)
                ];
                const existente = candidatos.find(function(c) {
                    return fs.existsSync(c) && fs.statSync(c).isFile() && rel(c).endsWith('.js');
                });
                if (!existente) continue;
                const clave = rel(existente);
                if (!encontradas.has(clave)) encontradas.set(clave, []);
                agregarUnico(encontradas.get(clave), js);
            }
        });
    });

    return encontradas;
}

// ---------------------------------------------------------------------------
// Clasificación
// ---------------------------------------------------------------------------

function esSemilla(ruta) {
    return SEMILLAS.indexOf(ruta) !== -1;
}

function esVendor(ruta) {
    return ruta.indexOf('public/lib/') === 0;
}

function esDev(ruta) {
    const base = path.basename(ruta);
    return PREFIJOS_DEV.some(function(p) { return base.indexOf(p) === 0; });
}

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------

function analizar() {
    const porHtml = referenciasEnHtml();
    const porNode = referenciasEnNode();
    const porNpm = referenciasEnPackageJson();
    const porCadena = referenciasPorCadena();

    const todos = listarJs('.').filter(function(ruta) {
        return ruta !== 'scripts/cleanup-dead-code.js';
    });

    const vivo = new Map(); // ruta -> [motivos]
    [porHtml, porNode, porNpm, porCadena].forEach(function(fuente) {
        fuente.forEach(function(origenes, ruta) {
            if (!vivo.has(ruta)) vivo.set(ruta, []);
            origenes.forEach(function(o) { agregarUnico(vivo.get(ruta), o); });
        });
    });

    const huérfanos = [];
    const semillas = [];
    const dev = [];
    const vendor = [];

    todos.forEach(function(ruta) {
        if (esVendor(ruta)) { vendor.push(ruta); return; }
        if (esSemilla(ruta)) { semillas.push(ruta); return; }
        if (vivo.has(ruta)) return;
        if (esDev(ruta)) { dev.push(ruta); return; }
        huérfanos.push(ruta);
    });

    return { total: todos.length, vivo: vivo, huérfanos: huérfanos, semillas: semillas, dev: dev, vendor: vendor, porHtml: porHtml };
}

function imprimir(resultado) {
    console.log('\n============================================================');
    console.log('  LIMPIEZA DE CÓDIGO MUERTO - Mirolab Systems');
    console.log('============================================================\n');
    console.log('  Archivos .js analizados : ' + resultado.total);
    console.log('  Referenciados por HTML  : ' + resultado.porHtml.size);
    console.log('  Semillas protegidas     : ' + resultado.semillas.length);
    console.log('  Librerías de terceros   : ' + resultado.vendor.length);
    console.log('  Herramientas de desarrollo : ' + resultado.dev.length);

    console.log('\n------------------------------------------------------------');
    console.log('  HUÉRFANOS (' + resultado.huérfanos.length + ') - nadie los carga');
    console.log('------------------------------------------------------------');
    if (resultado.huérfanos.length === 0) {
        console.log('  (ninguno: todo el código de la app está referenciado)');
    } else {
        resultado.huérfanos.forEach(function(ruta) {
            console.log('  ❌ ' + ruta);
        });
    }

    console.log('\n------------------------------------------------------------');
    console.log('  HERRAMIENTAS DE DESARROLLO (' + resultado.dev.length + ') - fuera del paquete de la app');
    console.log('------------------------------------------------------------');
    resultado.dev.forEach(function(ruta) { console.log('  🔧 ' + ruta); });

    console.log('\n------------------------------------------------------------');
    console.log('  SEMILLAS PROTEGIDAS (' + resultado.semillas.length + ') - las lee la migración a SQLite');
    console.log('------------------------------------------------------------');
    resultado.semillas.forEach(function(ruta) { console.log('  🛡️  ' + ruta); });

    console.log('\n  Total de archivos vivos: ' + (resultado.vivo.size + resultado.semillas.length + resultado.vendor.length + resultado.dev.length));
    console.log('');
}

function eliminar(rutas) {
    let borrados = 0;
    rutas.forEach(function(ruta) {
        const abs = path.join(RAIZ, ruta);
        if (fs.existsSync(abs)) {
            fs.unlinkSync(abs);
            console.log('  🗑️  eliminado: ' + ruta);
            borrados++;
        }
    });
    console.log('\n  ' + borrados + ' archivo(s) eliminado(s).');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (require.main === module) {
    const borrar = process.argv.indexOf('--delete') !== -1;
    const resultado = analizar();
    imprimir(resultado);

    if (borrar) {
        console.log('------------------------------------------------------------');
        console.log('  ELIMINANDO HUÉRFANOS');
        console.log('------------------------------------------------------------');
        eliminar(resultado.huérfanos);
    } else {
        console.log('  Ejecute con --delete para borrar los huérfanos listados.');
        console.log('  Las semillas, las librerías y las herramientas de desarrollo nunca se borran.\n');
    }
}

module.exports = { analizar: analizar, SEMILLAS: SEMILLAS };
