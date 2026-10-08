#!/usr/bin/env node
/**
 * depurador.js - Analizador de Archivos Huérfanos (Dead Code Elimination)
 *
 * Uso: node depurador.js
 *
 * Este script escanea el proyecto Electron/Vanilla JS y detecta:
 * 1. Archivos .js huérfanos (existen en disco pero nadie los importa/referencia)
 * 2. Archivos .js importados en HTML pero con código muerto (funciones no usadas)
 * 3. Genera un plan de limpieza seguro
 */

const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURACIÓN
// ============================================
const PROJECT_ROOT = __dirname;
const JS_DIRS = [
    'public/js',
    'database',
    'scripts',
    'vistas'  // por si hay JS inline en HTML que referencie archivos
];
const HTML_DIRS = [
    '.',
    'vistas',
    'public/includes'
];
const EXCLUDE_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'test-',      // archivos de prueba
    'expirado.html'
];

// Librerías de terceros que NO se deben considerar huérfanas
const VENDOR_LIBS = new Set([
    'jquery-3.6.0.min.js',
    'bootstrap.bundle.min.js',
    'select2.min.js',
    'jspdf.umd.min.js',
    'jspdf.plugin.autotable.min.js',
    'html2pdf.bundle.min.js',
    'bootstrap.min.css',
    'bootstrap-icons.css',
    'select2.min.css',
    'select2-bootstrap-5-theme.min.css'
]);

// ============================================
// UTILIDADES
// ============================================
function shouldExclude(filePath) {
    const rel = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
    return EXCLUDE_PATTERNS.some(p => rel.includes(p));
}

function getAllFiles(dir, ext) {
    if (!fs.existsSync(dir)) return [];
    let results = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (!shouldExclude(fullPath)) {
                results = results.concat(getAllFiles(fullPath, ext));
            }
        } else if (stat.isFile() && file.endsWith(ext)) {
            if (!shouldExclude(fullPath)) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        console.warn(`⚠️  No se pudo leer: ${filePath}`);
        return '';
    }
}

// ============================================
// 1. ESCANEAR HTML: <script src="...">
// ============================================
function scanHtmlScriptTags() {
    console.log('\n📄 Escaneando archivos HTML en busca de <script src="...">...\n');
    
    const htmlFiles = [];
    for (const dir of HTML_DIRS) {
        htmlFiles.push(...getAllFiles(path.join(PROJECT_ROOT, dir), '.html'));
    }
    
    const referencedScripts = new Map(); // scriptPath -> Set(htmlFiles)
    
    const scriptTagRegex = /<script\s+src=["']([^"']+)["']/gi;
    
    for (const htmlFile of htmlFiles) {
        const content = readFile(htmlFile);
        let match;
        while ((match = scriptTagRegex.exec(content)) !== null) {
            const src = match[1];
            // Resolver ruta relativa al HTML
            const htmlDir = path.dirname(htmlFile);
            const resolvedPath = path.resolve(htmlDir, src);
            const relPath = path.relative(PROJECT_ROOT, resolvedPath).replace(/\\/g, '/');
            
            if (!referencedScripts.has(relPath)) {
                referencedScripts.set(relPath, new Set());
            }
            referencedScripts.get(relPath).add(path.relative(PROJECT_ROOT, htmlFile).replace(/\\/g, '/'));
        }
    }
    
    console.log(`   ✅ Encontrados ${referencedScripts.size} scripts referenciados en HTML:`);
    for (const [script, htmls] of referencedScripts.entries()) {
        console.log(`      📎 ${script}`);
        for (const html of htmls) {
            console.log(`         ← ${html}`);
        }
    }
    
    return referencedScripts;
}

// ============================================
// 2. ESCANEAR JS: import / require()
// ============================================
function scanJsImports() {
    console.log('\n🔍 Escaneando archivos JS en busca de import/require...\n');
    
    const jsFiles = [];
    for (const dir of JS_DIRS) {
        jsFiles.push(...getAllFiles(path.join(PROJECT_ROOT, dir), '.js'));
    }
    // También main.js y preload.js en raíz
    jsFiles.push(...getAllFiles(PROJECT_ROOT, '.js').filter(f => 
        path.basename(f) === 'main.js' || path.basename(f) === 'preload.js'
    ));
    
    const imports = new Map(); // importedPath -> Set(importerFiles)
    
    // Patrones: import ... from '...', require('...'), import('...')
    const importRegex = /(?:import\s+(?:.*\s+from\s+)?|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;
    
    for (const jsFile of jsFiles) {
        const content = readFile(jsFile);
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            // Solo imports relativos (empezando con ./ o ../)
            if (importPath.startsWith('.') || importPath.startsWith('/')) {
                const jsDir = path.dirname(jsFile);
                const resolvedPath = path.resolve(jsDir, importPath);
                const relPath = path.relative(PROJECT_ROOT, resolvedPath).replace(/\\/g, '/');
                
                if (!imports.has(relPath)) {
                    imports.set(relPath, new Set());
                }
                imports.get(relPath).add(path.relative(PROJECT_ROOT, jsFile).replace(/\\/g, '/'));
            }
        }
    }
    
    console.log(`   ✅ Encontrados ${imports.size} imports relativos entre JS:`);
    for (const [imp, importers] of imports.entries()) {
        console.log(`      📦 ${imp}`);
        for (const importer of importers) {
            console.log(`         ← ${importer}`);
        }
    }
    
    return imports;
}

// ============================================
// 3. LISTAR TODOS LOS ARCHIVOS JS FÍSICOS
// ============================================
function listAllJsFiles() {
    console.log('\n📁 Listando todos los archivos .js físicos en el proyecto...\n');
    
    const allJsFiles = [];
    for (const dir of JS_DIRS) {
        allJsFiles.push(...getAllFiles(path.join(PROJECT_ROOT, dir), '.js'));
    }
    // Archivos en raíz
    allJsFiles.push(...getAllFiles(PROJECT_ROOT, '.js').filter(f => {
        const base = path.basename(f);
        return base === 'main.js' || base === 'preload.js';
    }));
    
    const relPaths = allJsFiles.map(f => path.relative(PROJECT_ROOT, f).replace(/\\/g, '/')).sort();
    
    console.log(`   ✅ Total: ${relPaths.length} archivos .js encontrados:`);
    for (const p of relPaths) {
        const isVendor = VENDOR_LIBS.has(path.basename(p));
        console.log(`      ${isVendor ? '📦 (vendor)' : '📄'} ${p}`);
    }
    
    return new Set(relPaths);
}

// ============================================
// 4. DETECTAR ARCHIVOS HUÉRFANOS
// ============================================
function findOrphanFiles(allJsFiles, htmlRefs, jsImports) {
    console.log('\n🔎 Analizando archivos huérfanos...\n');
    
    // Un archivo NO es huérfano si:
    // 1. Es referenciado en algún HTML (<script src>)
    // 2. Es importado por otro JS (import/require)
    // 3. Es un archivo de entrada (main.js, preload.js)
    // 4. Es una librería vendor conocida
    // 5. Es un archivo fuente para migración (catalogo-base, examenes-detallados, referencias, perfiles)
    
    const entryPoints = new Set([
        'main.js', 
        'preload.js', 
        'scripts/start.js', 
        'scripts/migrar-catalogo.js', 
        'scripts/build-includes.js'
    ]);
    
    const migrationSources = new Set([
        'public/js/catalogo-base.js',
        'public/js/examenes-detallados.js',
        'public/js/referencias.js',
        'public/js/perfiles.js'
    ]);
    
    const referenced = new Set();
    
    // Desde HTML
    for (const [script] of htmlRefs) {
        referenced.add(script);
    }
    
    // Desde imports JS
    for (const [imp] of jsImports) {
        referenced.add(imp);
    }
    
    // Puntos de entrada
    for (const ep of entryPoints) {
        referenced.add(ep);
    }
    
    // Fuentes de migración (se leen por fs.readFileSync en database/migracion-catalogo.js)
    for (const ms of migrationSources) {
        referenced.add(ms);
    }
    
    // Vendor libs (siempre mantener)
    for (const f of allJsFiles) {
        if (VENDOR_LIBS.has(path.basename(f))) {
            referenced.add(f);
        }
    }
    
    const orphans = [];
    const used = [];
    
    for (const jsFile of allJsFiles) {
        if (referenced.has(jsFile)) {
            used.push(jsFile);
        } else {
            orphans.push(jsFile);
        }
    }
    
    console.log(`\n✅ ARCHIVOS EN USO (${used.length}):`);
    for (const f of used.sort()) {
        const reasons = [];
        if (htmlRefs.has(f)) reasons.push(`HTML: ${[...htmlRefs.get(f)].join(', ')}`);
        if (jsImports.has(f)) reasons.push(`JS imports: ${[...jsImports.get(f)].join(', ')}`);
        if (entryPoints.has(f)) reasons.push('entry-point');
        if (migrationSources.has(f)) reasons.push('migration-source');
        if (VENDOR_LIBS.has(path.basename(f))) reasons.push('vendor');
        console.log(`   ✅ ${f}  ← ${reasons.join('; ')}`);
    }
    
    console.log(`\n🗑️  ARCHIVOS HUÉRFANOS (${orphans.length}) - CANDIDATOS A ELIMINAR:`);
    for (const f of orphans.sort()) {
        console.log(`   ❌ ${f}`);
    }
    
    return { orphans, used, referenced };
}

// ============================================
// 5. DETECTAR CÓDIGO MUERTO EN ARCHIVOS REFERENCIADOS
// ============================================
function detectDeadCodeInReferencedFiles(htmlRefs) {
    console.log('\n🧠 Analizando código muerto en archivos referenciados por HTML...\n');
    
    // Funciones globales expuestas en window por cada archivo (patrón: window.fnName = ...)
    const exportedFunctions = new Map(); // file -> Set(functionNames)
    const usedFunctions = new Set(); // functionNames que se usan en otros archivos
    
    // Obtener todos los archivos JS que se cargan en HTML
    const htmlLoadedFiles = new Set();
    for (const [jsFile] of htmlRefs) {
        htmlLoadedFiles.add(jsFile);
    }
    
    // Leer todos los JS para encontrar exports (window.xxx = function)
    const allJsFiles = [];
    for (const dir of JS_DIRS) {
        allJsFiles.push(...getAllFiles(path.join(PROJECT_ROOT, dir), '.js'));
    }
    allJsFiles.push(...getAllFiles(PROJECT_ROOT, '.js').filter(f => 
        path.basename(f) === 'main.js' || path.basename(f) === 'preload.js'
    ));
    
    // Patrón para detectar: window.nombreFuncion = function... o window.nombreFuncion = () => ...
    const exportRegex = /window\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:function|\(.*\)\s*=>|async\s+function|async\s*\(.*\)\s*=>)/g;
    // Patrón para detectar uso: window.nombreFuncion( o nombreFuncion(
    const usageRegex = /(?:window\.)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    
    // 1. Recolectar exports
    for (const jsFile of allJsFiles) {
        const relPath = path.relative(PROJECT_ROOT, jsFile).replace(/\\/g, '/');
        const content = readFile(jsFile);
        const exports = new Set();
        let match;
        while ((match = exportRegex.exec(content)) !== null) {
            exports.add(match[1]);
        }
        if (exports.size > 0) {
            exportedFunctions.set(relPath, exports);
        }
    }
    
    // 2. Recolectar usos en TODOS los archivos (HTML inline scripts + JS files)
    const allContentFiles = [...allJsFiles];
    for (const dir of HTML_DIRS) {
        allContentFiles.push(...getAllFiles(path.join(PROJECT_ROOT, dir), '.html'));
    }
    
    for (const file of allContentFiles) {
        const content = readFile(file);
        let match;
        while ((match = usageRegex.exec(content)) !== null) {
            usedFunctions.add(match[1]);
        }
    }
    
    // 3. Analizar cada archivo cargado por HTML
    console.log('   📊 Funciones exportadas por archivo:');
    for (const [file, exports] of exportedFunctions.entries()) {
        const isHtmlLoaded = htmlLoadedFiles.has(file);
        if (!isHtmlLoaded && !file.includes('test-')) continue; // Solo analizar los que carga el HTML
        
        console.log(`\n   📄 ${file} (cargado en HTML: ${isHtmlLoaded ? 'SÍ' : 'NO'})`);
        console.log(`      Exporta: ${[...exports].join(', ') || '(ninguna)'}`);
        
        const deadExports = [...exports].filter(fn => !usedFunctions.has(fn));
        const liveExports = [...exports].filter(fn => usedFunctions.has(fn));
        
        if (deadExports.length > 0) {
            console.log(`      ⚠️  FUNCIONES NO USADAS (código muerto): ${deadExports.join(', ')}`);
        }
        if (liveExports.length > 0) {
            console.log(`      ✅ Funciones usadas: ${liveExports.join(', ')}`);
        }
    }
    
    return { exportedFunctions, usedFunctions };
}

// ============================================
// 6. GENERAR PLAN DE LIMPIEZA
// ============================================
function generateCleanupPlan(orphans, deadCodeAnalysis) {
    console.log('\n\n============================================================');
    console.log('📋 PLAN DE LIMPIEZA SEGURO');
    console.log('============================================================\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗑️  PASO 1: ELIMINAR ARCHIVOS HUÉRFANOS (Click derecho → Eliminar)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (orphans.length === 0) {
        console.log('   ✅ No hay archivos huérfanos para eliminar.\n');
    } else {
        for (const f of orphans.sort()) {
            console.log(`   🗑️  ELIMINAR: ${f}`);
        }
        console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✂️  PASO 2: ELIMINAR <script src="..."> DE HTML (archivos ya eliminados arriba)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('   (Se ejecutará automáticamente al eliminar los archivos del Paso 1)');
    console.log('   Verifica manualmente que no queden tags rotos en los HTML.\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧹 PASO 3: LIMPIAR CÓDIGO MUERTO DENTRO DE ARCHIVOS VIVOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('   ⚠️  Revisar manualmente las funciones marcadas como "NO USADAS" arriba.');
    console.log('   Estas funciones están exportadas en window pero nadie las llama.');
    console.log('   Puedes eliminarlas del archivo .js correspondiente.\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 ARCHIVOS QUE DEBEN MANTENERSE (NO TOCAR)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const keepFiles = [
        'main.js',
        'preload.js',
        'public/js/db-catalogo.js',      // Puente SQLite → renderer (CRÍTICO)
        'public/js/utils.js',            // Utilidades usadas en todas partes
        'public/js/storage.js',          // Caché y API pacientes (CRÍTICO)
        'public/js/app.js',              // Router principal
        'public/js/orden.js',            // Lógica orden.html (CRÍTICO)
        'public/js/catalogo-admin.js',   // Admin catálogo (catalogo.html)
        'public/js/recepcion.js',        // Lógica index.html (CRÍTICO)
        'public/js/reporte.js',          // Inicialización reporte.html
        'public/js/pdf.js',              // Generación PDF (CRÍTICO)
        'public/js/historial.js',        // Lógica historial.html
        'public/js/perfiles-modal.js',   // Modal perfiles
        'public/js/items-detallados.js', // Modales items detallados
        'public/js/calculos.js',         // Cálculos automáticos hematología
        'public/js/tipo-sanguineo.js',   // Formulario tipo sanguíneo
        'public/js/heces.js',            // Formulario heces
        'public/js/frotis.js',           // Formulario frotis
        'public/js/antibiograma.js',     // Formulario antibiograma
        'public/js/uroanalisis.js',      // Uroanálisis (vistas)
        'public/js/uroanalisis-form.js', // Formulario uroanálisis
        'public/js/secrecion-vaginal.js',// Secreción vaginal
        'public/js/quimica-sanguinea.js',// Química sanguínea
        'public/js/hormonas.js',         // Hormonas
        'public/js/inmunologia.js',      // Inmunología
        'public/js/coagulacion.js',      // Coagulación
        'public/js/bacteriologia.js',    // Bacteriología
        'public/js/micologia.js',        // Micología
        'public/js/coproanalisis.js',    // Coproanálisis
        'public/js/examenes-detallados.js', // Ítems detallados (fuente migración)
        'public/js/referencias.js',      // Referencias (fuente migración)
        'public/js/perfiles.js',         // Perfiles (fuente migración)
        'public/js/hematologia.js',      // Hematología helpers
        'public/js/modificar.js',        // Vista modificar.html
        'public/js/pacientes-anteriores.js', // Vista pacientes-anteriores.html
        'public/js/catalogo-base.js',    // Base catálogo (fuente migración)
        'database/catalogo-admin.js',    // BD admin catálogo (main.js)
        'database/examenes.js',          // BD exámenes (main.js)
        'database/migracion-catalogo.js',// Migración catálogo (main.js)
        'database/ordenes.js',           // BD órdenes (main.js)
        'database/schema.js',            // BD esquema (main.js)
        'scripts/start.js',              // Entry point
        'scripts/migrar-catalogo.js',    // CLI migración
        'scripts/build-includes.js',     // Build includes
    ];
    
    for (const f of keepFiles) {
        console.log(`   🛡️  MANTENER: ${f}`);
    }
    
    console.log('\n\n============================================================');
    console.log('✅ ANÁLISIS COMPLETADO');
    console.log('============================================================\n');
}

// ============================================
// MAIN
// ============================================
function main() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  DEPURADOR - Analizador de Archivos Huérfanos             ║');
    console.log('║  Proyecto: Electron + Vanilla JS + SQLite                 ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    
    const htmlRefs = scanHtmlScriptTags();
    const jsImports = scanJsImports();
    const allJsFiles = listAllJsFiles();
    const { orphans, used, referenced } = findOrphanFiles(allJsFiles, htmlRefs, jsImports);
    const deadCodeAnalysis = detectDeadCodeInReferencedFiles(htmlRefs);
    generateCleanupPlan(orphans, deadCodeAnalysis);
}

main();