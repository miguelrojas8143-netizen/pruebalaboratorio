'use strict';

const EXAMENES_HEMATOLOGIA = [
    { id: 'globulos_blancos', nombre: 'Glóbulos Blancos', unidad: 'x10³/µL', refMin: 4.0, refMax: 10.0, grupo: 'Hemograma' },
    { id: 'neutrofilos_num', nombre: 'Neutrófilos #', unidad: 'x10³/µL', refMin: 2.0, refMax: 7.0, tipo: 'calculado', grupo: 'Absolutos' },
    { id: 'linfocitos_num', nombre: 'Linfocitos #', unidad: 'x10³/µL', refMin: 1.0, refMax: 7.0, refTexto: 'A: 1.0-4.0; N: <7.0', tipo: 'calculado', grupo: 'Absolutos' },
    { id: 'eosinofilos_num', nombre: 'Eosinófilos #', unidad: 'x10³/µL', refMin: 0.0, refMax: 0.85, refTexto: 'A <0.45 ; N: <0.85', tipo: 'calculado', grupo: 'Absolutos' },
    { id: 'monocitos_num', nombre: 'Monocitos #', unidad: 'x10³/µL', refMin: 0.0, refMax: 0.8, refTexto: '<0.8', tipo: 'calculado', grupo: 'Absolutos' },
    { id: 'basofilos_num', nombre: 'Basófilos #', unidad: 'x10³/µL', refMin: 0.0, refMax: 0.15, refTexto: '<0.15', tipo: 'calculado', grupo: 'Absolutos' },
    { id: 'neutrofilos_por', nombre: 'Neutrófilos %', unidad: '%', refTexto: '-', tipo: 'texto', grupo: 'Porcentuales' },
    { id: 'linfocitos_por', nombre: 'Linfocitos %', unidad: '%', refTexto: '-', tipo: 'texto', grupo: 'Porcentuales' },
    { id: 'eosinofilos_por', nombre: 'Eosinófilos %', unidad: '%', refTexto: '-', tipo: 'texto', grupo: 'Porcentuales' },
    { id: 'monocitos_por', nombre: 'Monocitos %', unidad: '%', refTexto: '-', tipo: 'texto', grupo: 'Porcentuales' },
    { id: 'basofilos_por', nombre: 'Basófilos %', unidad: '%', refTexto: '-', tipo: 'texto', grupo: 'Porcentuales' },
    { id: 'globulos_rojos', nombre: 'Glóbulos Rojos', unidad: 'x10⁶/µL', refMin: 4.5, refMax: 5.5, grupo: 'Hemograma' },
    { id: 'hemoglobina', nombre: 'Hemoglobina', unidad: 'g/dL', refMin: 12.0, refMax: 18.0, refTexto: 'F: 12.0-16.0; M: 13.0-18.0', grupo: 'Hemograma' },
    { id: 'hematocrito', nombre: 'Hematocrito', unidad: '%', refMin: 38.0, refMax: 54.0, grupo: 'Hemograma' },
    { id: 'vcm', nombre: 'V.C.M.', unidad: 'fL', refMin: 80, refMax: 100, grupo: 'Hemograma' },
    { id: 'hcm', nombre: 'H.C.M.', unidad: 'pg', refMin: 26, refMax: 34, grupo: 'Hemograma' },
    { id: 'chcm', nombre: 'C.H.C.M.', unidad: 'g/dL', refMin: 32, refMax: 36, grupo: 'Hemograma' },
    { id: 'rdw_cv', nombre: 'RDW-CV', unidad: '%', refMin: 0, refMax: 15.1, refTexto: '<15.1', grupo: 'Hemograma' },
    { id: 'plaquetas', nombre: 'Plaquetas', unidad: 'x10³/µL', refMin: 150, refMax: 450, grupo: 'Hemograma' },
    { id: 'vpm', nombre: 'V.P.M.', unidad: 'fL', refMin: 6.5, refMax: 13.5, grupo: 'Hemograma' },
    { id: 'pdw', nombre: 'P.D.W.', unidad: '%', refMin: 0, refMax: 16.8, refTexto: '<16.8', grupo: 'Hemograma' },
    { id: 'plcr', nombre: 'P.LCR', unidad: '%', refMin: 0, refMax: 42.3, refTexto: '<42.3', grupo: 'Hemograma' },
    { id: 'vsg', nombre: 'V.S.G. 1 Hora', unidad: 'mm/h', refMin: 3, refMax: 20, refTexto: 'Niño: 3 - 13 mm/h | Mujer: < 20', grupo: 'Hemograma' }
].map(function(item) {
    return Object.assign({
        area: 'Hematología',
        examen: 'hematologia_completa',
        tipo: 'numerico',
        refMin: null,
        refMax: null
    }, item);
});

const EXAMENES_UROANALISIS = [
    { id: 'ur_aspecto', nombre: 'Aspecto', grupo: 'Macroscópico', tipo: 'seleccion_unica', opciones: ['Límpido', 'Turbio', 'Ligeramente turbio'] },
    { id: 'ur_color', nombre: 'Color', grupo: 'Macroscópico', tipo: 'seleccion_unica', opciones: ['Amarillo claro', 'Amarillo oscuro', 'Incoloro o amarillo muy pálido', 'Ámbar / Rojizo'] },
    { id: 'ur_olor', nombre: 'Olor', grupo: 'Macroscópico', tipo: 'seleccion_unica', opciones: ['Sui géneris (característica normal)', 'Fétido (amoniacal)', 'Afrutado (cetónico)', 'Fuerte'] },
    { id: 'ur_reaccion', nombre: 'Reacción', grupo: 'Químico', tipo: 'seleccion_unica', opciones: ['Ácida', 'Alcalina'] },
    { id: 'ur_ph', nombre: 'pH', grupo: 'Químico', tipo: 'numerico', refMin: 4.5, refMax: 8.0, refTexto: '4.5 - 8.0' },
    { id: 'ur_densidad', nombre: 'Densidad', grupo: 'Químico', tipo: 'numerico', refMin: 1.005, refMax: 1.030, refTexto: '1.005 - 1.030' },
    { id: 'ur_urobilinogeno', nombre: 'Urobilinógeno', grupo: 'Químico', tipo: 'seleccion_unica', opciones: ['Normal', 'Aumentado', 'Disminuido'] },
    { id: 'ur_albumina', nombre: 'Albúmina', grupo: 'Químico', tipo: 'seleccion_unica', opciones: ['Negativo', 'Trazas', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
    { id: 'ur_glucosa', nombre: 'Glucosa', grupo: 'Químico', tipo: 'seleccion_unica', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
    { id: 'ur_cetonas', nombre: 'Cetonas', grupo: 'Químico', tipo: 'seleccion_unica', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
    { id: 'ur_proteinas', nombre: 'Proteínas', grupo: 'Químico', tipo: 'seleccion_unica', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
    { id: 'ur_hemoglobina', nombre: 'Hemoglobina', grupo: 'Químico', tipo: 'seleccion_unica', opciones: ['Negativo', 'Trazas', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
    { id: 'ur_bilirrubina', nombre: 'Bilirrubina', grupo: 'Químico', tipo: 'seleccion_unica', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
    { id: 'ur_nitritos', nombre: 'Nitritos', grupo: 'Químico', tipo: 'seleccion_unica', opciones: ['Negativo', 'Positivo'] },
    { id: 'ur_leucocitos_tira', nombre: 'Leucocitos', grupo: 'Químico', tipo: 'seleccion_unica', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
    { id: 'ur_leucocitos_micro', nombre: 'Leucocitos (Micro)', unidad: 'cpo/campo', grupo: 'Microscópico', tipo: 'seleccion_unica', opciones: ['0-2 por campo', '3-10 por campo', '11-20 por campo', '21-50 por campo', '> 50 por campo'] },
    { id: 'ur_celulas_epiteliales', nombre: 'Células Epiteliales', unidad: 'cpo/campo', grupo: 'Microscópico', tipo: 'seleccion_unica', opciones: ['Ausentes', 'Escasas', 'Moderadas', 'Abundantes'] },
    { id: 'ur_eritrocitos', nombre: 'Eritrocitos', unidad: 'cpo/campo', grupo: 'Microscópico', tipo: 'seleccion_unica', opciones: ['0-1 por campo', '2-5 por campo', '6-10 por campo', '> 10 por campo'] },
    { id: 'ur_bacterias', nombre: 'Bacterias', grupo: 'Microscópico', tipo: 'seleccion_unica', opciones: ['Ausentes', 'Escasas', 'Moderadas', 'Abundantes'] },
    { id: 'ur_cilindros', nombre: 'Cilindros', grupo: 'Microscópico', tipo: 'seleccion_unica', opciones: ['Ausentes', 'Hialinas', 'Granulosos', 'Eritrocitarios', 'Leucocíticos'] },
    { id: 'ur_cristales', nombre: 'Cristales', grupo: 'Microscópico', tipo: 'seleccion_unica', opciones: ['Ausentes', 'Oxalato de calcio', 'Fosfatos', 'Uratas', 'Carbonatos'] }
].map(function(item) {
    return Object.assign({
        area: 'Uroanálisis',
        examen: 'examen_orina',
        unidad: '',
        refMin: null,
        refMax: null
    }, item);
});

const EXAMENES_CATALOGO = EXAMENES_HEMATOLOGIA.concat(EXAMENES_UROANALISIS);

function referenciaPorDefecto(item) {
    if (item.refTexto !== undefined) return item.refTexto;
    if (item.refMin !== undefined && item.refMax !== undefined) return item.refMin + ' - ' + item.refMax;
    return '';
}

function asegurarColumna(db, tabla, columna, definicion) {
    const columnas = db.prepare('PRAGMA table_info(' + tabla + ')').all();
    if (!columnas.some(function(item) { return item.name === columna; })) {
        db.exec('ALTER TABLE ' + tabla + ' ADD COLUMN ' + columna + ' ' + definicion);
    }
}

function inicializarCatalogoExamenes(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS examenes (
            id TEXT PRIMARY KEY,
            examen TEXT NOT NULL,
            nombre TEXT NOT NULL,
            area TEXT NOT NULL,
            unidad TEXT NOT NULL DEFAULT '',
            refMin REAL,
            refMax REAL,
            refTexto TEXT NOT NULL DEFAULT '',
            tipo TEXT NOT NULL DEFAULT 'numerico',
            grupo TEXT NOT NULL DEFAULT 'General'
        );
        CREATE TABLE IF NOT EXISTS historial_examenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orden_paciente TEXT,
            fecha TEXT,
            examen TEXT,
            resultado TEXT,
            unidad TEXT,
            FOREIGN KEY(orden_paciente) REFERENCES pacientes(orden)
        );
        CREATE TABLE IF NOT EXISTS examenes_opciones (
            idresultado TEXT NOT NULL,
            orden INTEGER NOT NULL,
            valor TEXT NOT NULL,
            PRIMARY KEY(idresultado, orden),
            UNIQUE(idresultado, valor),
            FOREIGN KEY(idresultado) REFERENCES examenes(id) ON DELETE CASCADE
        );
    `);

    asegurarColumna(db, 'historial_examenes', 'idresultado', 'TEXT REFERENCES examenes(id)');
    asegurarColumna(db, 'historial_examenes', 'referencia', 'TEXT');

    const upsert = db.prepare(`
        INSERT INTO examenes (id, examen, nombre, area, unidad, refMin, refMax, refTexto, tipo, grupo)
        VALUES (@id, @examen, @nombre, @area, @unidad, @refMin, @refMax, @refTexto, @tipo, @grupo)
        ON CONFLICT(id) DO UPDATE SET
            examen = excluded.examen,
            nombre = excluded.nombre,
            area = excluded.area,
            unidad = excluded.unidad,
            refMin = excluded.refMin,
            refMax = excluded.refMax,
            refTexto = excluded.refTexto,
            tipo = excluded.tipo,
            grupo = excluded.grupo
    `);
    const actualizarOpciones = db.prepare(`
        INSERT INTO examenes_opciones (idresultado, orden, valor)
        VALUES (?, ?, ?)
    `);
    const borrarOpciones = db.prepare('DELETE FROM examenes_opciones WHERE idresultado = ?');
    const guardarCatalogo = db.transaction(function() {
        EXAMENES_CATALOGO.forEach(function(item) {
            upsert.run(Object.assign({}, item, { refTexto: item.refTexto || '' }));
            if (item.opciones) {
                borrarOpciones.run(item.id);
                item.opciones.forEach(function(valor, indice) {
                    actualizarOpciones.run(item.id, indice, valor);
                });
            }
        });
    });
    guardarCatalogo();

    const insertarResultadoMigrado = db.prepare(`
        INSERT INTO historial_examenes
            (orden_paciente, fecha, examen, resultado, unidad, idresultado, referencia)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const obtenerLegado = db.prepare(`
        SELECT id, orden_paciente, fecha, examen, resultado
        FROM historial_examenes
        WHERE idresultado IS NULL
    `);
    const borrarLegado = db.prepare('DELETE FROM historial_examenes WHERE id = ?');
    const itemsPorId = new Map(EXAMENES_CATALOGO.map(function(item) { return [item.id, item]; }));
    const normalizarNombre = function(nombre) {
        return String(nombre || '').trim().toLowerCase();
    };
    const identificarCatalogo = function(registro, valores) {
        const nombre = normalizarNombre(registro.examen);
        if (['hematología completa', 'hematologia completa', 'hematologia_completa'].includes(nombre)) return 'hematologia_completa';
        if (['uroanálisis', 'uroanalisis', 'examen de orina', 'examen general de orina', 'examen_orina'].includes(nombre)) return 'examen_orina';
        const ids = Object.keys(valores);
        const hematologia = ids.filter(function(id) { return EXAMENES_HEMATOLOGIA.some(function(item) { return item.id === id; }); }).length;
        const uroanalisis = ids.filter(function(id) { return EXAMENES_UROANALISIS.some(function(item) { return item.id === id; }); }).length;
        if (hematologia >= 2 && hematologia > uroanalisis) return 'hematologia_completa';
        if (uroanalisis >= 2 && uroanalisis > hematologia) return 'examen_orina';
        return null;
    };
    const migrarLegado = db.transaction(function() {
        obtenerLegado.all().forEach(function(registro) {
            let valores;
            try {
                valores = JSON.parse(registro.resultado || '{}');
            } catch (error) {
                return;
            }
            if (!valores || typeof valores !== 'object' || Array.isArray(valores)) return;
            const examenId = identificarCatalogo(registro, valores);
            if (!examenId) return;

            let cantidadMigrada = 0;
            for (const [idresultado, valor] of Object.entries(valores)) {
                const item = itemsPorId.get(idresultado);
                if (!item || item.examen !== examenId || valor === null || valor === undefined || String(valor).trim() === '') continue;
                const referenciaPersonalizada = valores.__referencias && valores.__referencias[idresultado];
                insertarResultadoMigrado.run(
                    registro.orden_paciente,
                    registro.fecha,
                    examenId === 'hematologia_completa' ? 'Hematología Completa' : 'Uroanálisis',
                    String(valor),
                    item.unidad,
                    idresultado,
                    referenciaPersonalizada === undefined ? referenciaPorDefecto(item) : String(referenciaPersonalizada)
                );
                cantidadMigrada += 1;
            }
            if (cantidadMigrada > 0) borrarLegado.run(registro.id);
        });
    });
    migrarLegado();
}

function guardarHistorialPaciente(db, orden, historial) {
    const catalogoPorId = new Map(EXAMENES_CATALOGO.map(function(item) {
        return [item.id, item];
    }));
    const idsHematologia = new Set(EXAMENES_HEMATOLOGIA.map(function(item) { return item.id; }));
    const idsUroanalisis = new Set(EXAMENES_UROANALISIS.map(function(item) { return item.id; }));
    const insertar = db.prepare(`
        INSERT INTO historial_examenes
            (orden_paciente, fecha, examen, resultado, unidad, idresultado, referencia)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const identificarExamen = function(entry, valores) {
        const nombre = String(entry.examen_completo || entry.examen || entry.nombre || entry.id || '').trim().toLowerCase();
        if (['hematología completa', 'hematologia completa', 'hematologia_completa'].includes(nombre)) return 'hematologia_completa';
        if (['uroanálisis', 'uroanalisis', 'examen de orina', 'examen general de orina', 'examen_orina'].includes(nombre) || entry.tipoFormulario === 'uroanalisis') return 'examen_orina';
        if (valores && typeof valores === 'object') {
            const ids = Object.keys(valores);
            const hematologia = ids.filter(function(id) { return idsHematologia.has(id); }).length;
            const uroanalisis = ids.filter(function(id) { return idsUroanalisis.has(id); }).length;
            if (hematologia >= 2 && hematologia > uroanalisis) return 'hematologia_completa';
            if (uroanalisis >= 2 && uroanalisis > hematologia) return 'examen_orina';
        }
        return null;
    };

    const guardar = db.transaction(function() {
        db.prepare('DELETE FROM historial_examenes WHERE orden_paciente = ?').run(orden);
        for (const entry of historial || []) {
            if (entry.idresultado && catalogoPorId.has(entry.idresultado)) {
                const item = catalogoPorId.get(entry.idresultado);
                insertar.run(
                    orden,
                    entry.fecha || '',
                    entry.examen_completo || (item.examen === 'hematologia_completa' ? 'Hematología Completa' : 'Uroanálisis'),
                    entry.resultado == null ? '' : String(entry.resultado),
                    entry.unidad || item.unidad,
                    entry.idresultado,
                    entry.referencia == null ? referenciaPorDefecto(item) : String(entry.referencia)
                );
                continue;
            }

            let valores;
            try {
                valores = typeof entry.resultado === 'string'
                    ? JSON.parse(entry.resultado || '{}')
                    : (entry.resultado || {});
            } catch (error) {
                valores = {};
            }
            const examenId = identificarExamen(entry, valores);
            if (examenId) {
                if (valores && typeof valores === 'object' && !Array.isArray(valores)) {
                    for (const [idresultado, resultado] of Object.entries(valores)) {
                        const item = catalogoPorId.get(idresultado);
                        if (!item || item.examen !== examenId || resultado == null || String(resultado).trim() === '') continue;
                        const referencias = valores.__referencias || {};
                        const referencia = referencias[idresultado];
                        insertar.run(
                            orden,
                            entry.fecha || '',
                            examenId === 'hematologia_completa' ? 'Hematología Completa' : 'Uroanálisis',
                            String(resultado),
                            item.unidad,
                            idresultado,
                            referencia === undefined ? referenciaPorDefecto(item) : String(referencia)
                        );
                    }
                }
                continue;
            }

            insertar.run(
                orden,
                entry.fecha || '',
                entry.examen || entry.nombre || '',
                entry.resultado == null ? '' : String(entry.resultado),
                entry.unidad || '',
                null,
                entry.referencia || null
            );
        }
        db.prepare('UPDATE pacientes SET historial = ? WHERE orden = ?').run(JSON.stringify(historial || []), orden);
    });
    guardar();
}

module.exports = {
    EXAMENES_HEMATOLOGIA,
    EXAMENES_UROANALISIS,
    referenciaPorDefecto,
    inicializarCatalogoExamenes,
    guardarHistorialPaciente
};