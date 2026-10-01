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
    const guardarCatalogo = db.transaction(function() {
        EXAMENES_HEMATOLOGIA.forEach(function(item) {
            upsert.run(Object.assign({}, item, { refTexto: item.refTexto || '' }));
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
          AND lower(trim(examen)) IN ('hematología completa', 'hematologia completa', 'hematologia_completa')
    `);
    const borrarLegado = db.prepare('DELETE FROM historial_examenes WHERE id = ?');
    const itemsPorId = new Map(EXAMENES_HEMATOLOGIA.map(function(item) { return [item.id, item]; }));
    const migrarLegado = db.transaction(function() {
        obtenerLegado.all().forEach(function(registro) {
            let valores;
            try {
                valores = JSON.parse(registro.resultado || '{}');
            } catch (error) {
                return;
            }
            if (!valores || typeof valores !== 'object' || Array.isArray(valores)) return;

            let cantidadMigrada = 0;
            for (const [idresultado, valor] of Object.entries(valores)) {
                const item = itemsPorId.get(idresultado);
                if (!item || valor === null || valor === undefined || String(valor).trim() === '') continue;
                const referenciaPersonalizada = valores.__referencias && valores.__referencias[idresultado];
                insertarResultadoMigrado.run(
                    registro.orden_paciente,
                    registro.fecha,
                    'Hematología Completa',
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
    const catalogoHematologia = new Map(EXAMENES_HEMATOLOGIA.map(function(item) {
        return [item.id, item];
    }));
    const insertar = db.prepare(`
        INSERT INTO historial_examenes
            (orden_paciente, fecha, examen, resultado, unidad, idresultado, referencia)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const esHematologia = function(entry) {
        const nombre = String(entry.examen_completo || entry.examen || entry.nombre || entry.id || '').trim().toLowerCase();
        return nombre === 'hematología completa' || nombre === 'hematologia completa' || nombre === 'hematologia_completa';
    };

    const guardar = db.transaction(function() {
        db.prepare('DELETE FROM historial_examenes WHERE orden_paciente = ?').run(orden);
        for (const entry of historial || []) {
            if (entry.idresultado && catalogoHematologia.has(entry.idresultado)) {
                const item = catalogoHematologia.get(entry.idresultado);
                insertar.run(
                    orden,
                    entry.fecha || '',
                    entry.examen_completo || 'Hematología Completa',
                    entry.resultado == null ? '' : String(entry.resultado),
                    entry.unidad || item.unidad,
                    entry.idresultado,
                    entry.referencia == null ? referenciaPorDefecto(item) : String(entry.referencia)
                );
                continue;
            }

            if (esHematologia(entry)) {
                let valores;
                try {
                    valores = typeof entry.resultado === 'string'
                        ? JSON.parse(entry.resultado || '{}')
                        : (entry.resultado || {});
                } catch (error) {
                    valores = {};
                }
                if (valores && typeof valores === 'object' && !Array.isArray(valores)) {
                    for (const [idresultado, resultado] of Object.entries(valores)) {
                        const item = catalogoHematologia.get(idresultado);
                        if (!item || resultado == null || String(resultado).trim() === '') continue;
                        const referencias = valores.__referencias || {};
                        const referencia = referencias[idresultado];
                        insertar.run(
                            orden,
                            entry.fecha || '',
                            'Hematología Completa',
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
    referenciaPorDefecto,
    inicializarCatalogoExamenes,
    guardarHistorialPaciente
};