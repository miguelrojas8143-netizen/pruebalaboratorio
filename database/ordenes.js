'use strict';

function actualizarOrdenPaciente(db, pacienteId, nuevaOrden, fechaRegistro) {
    return db.prepare(
        'UPDATE pacientes SET orden = ?, visitas = visitas + 1, fechaRegistro = ? WHERE id = ?'
    ).run(nuevaOrden, fechaRegistro, pacienteId);
}

module.exports = { actualizarOrdenPaciente: actualizarOrdenPaciente };