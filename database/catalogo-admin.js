'use strict';

const ID_EXAMEN = /^[a-z][a-z0-9_]{0,63}$/;
const TIPOS_EDITABLES = new Set(['numerico', 'texto']);

function textoRequerido(valor, campo, maximo) {
    if (typeof valor !== 'string') throw new Error(campo + ' es obligatorio.');
    const limpio = valor.trim();
    if (!limpio) throw new Error(campo + ' es obligatorio.');
    if (limpio.length > maximo) throw new Error(campo + ' supera el máximo de ' + maximo + ' caracteres.');
    return limpio;
}

function textoOpcional(valor, campo, maximo) {
    if (valor === undefined || valor === null) return '';
    if (typeof valor !== 'string') throw new Error(campo + ' no es válido.');
    const limpio = valor.trim();
    if (limpio.length > maximo) throw new Error(campo + ' supera el máximo de ' + maximo + ' caracteres.');
    return limpio;
}

function numeroOpcional(valor, campo) {
    if (valor === undefined || valor === null || valor === '') return null;
    const numero = Number(valor);
    if (!Number.isFinite(numero)) throw new Error(campo + ' debe ser un número válido.');
    return numero;
}

function slugCategoria(nombre) {
    return nombre.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'general';
}

function buscarOCrearCategoria(db, nombre) {
    const existente = db.prepare('SELECT id FROM categorias_examenes WHERE nombre = ? COLLATE NOCASE').get(nombre);
    if (existente) return existente.id;

    const baseId = slugCategoria(nombre);
    let id = baseId;
    let sufijo = 2;
    const buscarId = db.prepare('SELECT id, nombre FROM categorias_examenes WHERE id = ?');
    while (true) {
        const colision = buscarId.get(id);
        if (!colision || colision.nombre.toLocaleLowerCase() === nombre.toLocaleLowerCase()) break;
        id = baseId + '_' + sufijo;
        sufijo++;
    }

    db.prepare(`
        INSERT INTO categorias_examenes (id, nombre, orden, activo)
        VALUES (?, ?, COALESCE((SELECT MAX(orden) + 1 FROM categorias_examenes), 0), 1)
        ON CONFLICT(id) DO NOTHING
    `).run(id, nombre);
    const fila = db.prepare('SELECT id FROM categorias_examenes WHERE id = ?').get(id);
    if (!fila) throw new Error('No se pudo crear la categoría.');
    return fila.id;
}

function validarDatosExamen(db, datos) {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
        throw new Error('Los datos del examen no son válidos.');
    }

    const id = textoRequerido(datos.id, 'El código', 64);
    if (!ID_EXAMEN.test(id)) {
        throw new Error('El código debe comenzar con una letra minúscula y solo contener letras, números o guiones bajos.');
    }
    const nombre = textoRequerido(datos.nombre, 'El nombre', 120);
    const categoria = textoRequerido(datos.categoria, 'La categoría', 80);
    const unidad = textoOpcional(datos.unidad, 'La unidad', 40);
    const refTexto = textoOpcional(datos.refTexto, 'La referencia', 240);
    const valorDefecto = textoOpcional(datos.valorDefecto, 'El valor predeterminado', 120);
    const refMin = numeroOpcional(datos.refMin, 'La referencia mínima');
    const refMax = numeroOpcional(datos.refMax, 'La referencia máxima');
    if (refMin !== null && refMax !== null && refMin > refMax) {
        throw new Error('La referencia mínima no puede superar la máxima.');
    }

    const existente = db.prepare(`
        SELECT id, tipo, tipo_formulario, activo
        FROM examenes WHERE id = ?
    `).get(id);
    const tipoSolicitado = datos.tipo;
    let tipo = 'numerico';
    if (existente && !TIPOS_EDITABLES.has(existente.tipo)) {
        tipo = existente.tipo;
    } else if (TIPOS_EDITABLES.has(tipoSolicitado)) {
        tipo = tipoSolicitado;
    } else {
        throw new Error('El tipo de resultado no es válido.');
    }

    return {
        id: id,
        nombre: nombre,
        categoria: categoria,
        unidad: unidad,
        tipo: tipo,
        refMin: refMin,
        refMax: refMax,
        refTexto: refTexto,
        valorDefecto: valorDefecto || null,
        existente: existente
    };
}

function guardarExamenCatalogo(db, datos) {
    const guardar = db.transaction(function() {
        const examen = validarDatosExamen(db, datos);
        const categoriaId = buscarOCrearCategoria(db, examen.categoria);
        if (examen.existente) {
            db.prepare(`
                UPDATE examenes
                SET categoria_id = ?, nombre = ?, unidad = ?, tipo = ?,
                    valor_defecto = ?, ref_min = ?, ref_max = ?, ref_texto = ?,
                    origen = 'usuario'
                WHERE id = ?
            `).run(
                categoriaId, examen.nombre, examen.unidad, examen.tipo,
                examen.valorDefecto, examen.refMin, examen.refMax, examen.refTexto, examen.id
            );
        } else {
            db.prepare(`
                INSERT INTO examenes
                    (id, categoria_id, nombre, unidad, tipo, tipo_formulario, grupo,
                     valor_defecto, ref_min, ref_max, ref_texto, orden, activo, origen)
                VALUES (?, ?, ?, ?, ?, NULL, '', ?, ?, ?, ?, 
                        COALESCE((SELECT MAX(orden) + 1 FROM examenes), 0), 1, 'usuario')
            `).run(
                examen.id, categoriaId, examen.nombre, examen.unidad,
                examen.tipo, examen.valorDefecto, examen.refMin, examen.refMax, examen.refTexto
            );
        }

        return db.prepare(`
            SELECT e.id, e.categoria_id, c.nombre AS categoria, e.nombre, e.unidad,
                   e.tipo, e.tipo_formulario, e.grupo, e.valor_defecto,
                   e.ref_min, e.ref_max, e.ref_texto, e.orden, e.activo
            FROM examenes e
            JOIN categorias_examenes c ON c.id = e.categoria_id
            WHERE e.id = ?
        `).get(examen.id);
    });

    return guardar();
}

function actualizarEstadoExamenCatalogo(db, id, activo) {
    if (typeof id !== 'string' || !ID_EXAMEN.test(id)) throw new Error('El código del examen no es válido.');
    if (typeof activo !== 'boolean') throw new Error('El estado solicitado no es válido.');
    const resultado = db.prepare('UPDATE examenes SET activo = ? WHERE id = ?').run(activo ? 1 : 0, id);
    if (resultado.changes === 0) throw new Error('No existe el examen "' + id + '".');
    return { id: id, activo: activo };
}

function eliminarExamenCatalogo(db, id) {
    if (typeof id !== 'string' || !ID_EXAMEN.test(id)) throw new Error('El código del examen no es válido.');
    const resultado = db.prepare('UPDATE examenes SET activo = 0 WHERE id = ?').run(id);
    if (resultado.changes === 0) throw new Error('No existe el examen "' + id + '".');
    return { id: id, activo: false };
}

module.exports = {
    guardarExamenCatalogo,
    actualizarEstadoExamenCatalogo,
    eliminarExamenCatalogo
};
