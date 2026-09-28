const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    guardarPaciente: (pacienteDatos) => ipcRenderer.invoke('guardar-paciente', pacienteDatos),
    obtenerPacientes: () => ipcRenderer.invoke('obtener-pacientes'),
    obtenerPacientesCompletos: () => ipcRenderer.invoke('obtener-pacientes-completos'),
    obtenerPacientePorOrden: (orden) => ipcRenderer.invoke('obtener-paciente-por-orden', { orden }),
    actualizarPaciente: (paciente) => ipcRenderer.invoke('actualizar-paciente', paciente),
    obtenerProximaOrden: () => ipcRenderer.invoke('obtener-proxima-orden'),
    crearNuevaVisita: (data) => ipcRenderer.invoke('crear-nueva-visita', data),
    obtenerOrdenesArchivadas: (data) => ipcRenderer.invoke('obtener-ordenes-archivadas', data),
    guardarExamenesPaciente: (orden, examenes) => ipcRenderer.invoke('guardar-examenes-paciente', { orden, examenes }),
    obtenerExamenesPaciente: (orden) => ipcRenderer.invoke('obtener-examenes-paciente', { orden }),
    guardarPacienteExamenes: (orden, examenes) => ipcRenderer.invoke('guardar-paciente-examenes', { orden, examenes }),
    guardarRefAdaptadas: (orden, refAdaptadas) => ipcRenderer.invoke('guardar-ref-adaptadas', { orden, refAdaptadas }),
    guardarHistorialPaciente: (orden, historial) => ipcRenderer.invoke('guardar-historial-paciente', { orden, historial }),
    eliminarPaciente: (id) => ipcRenderer.invoke('eliminar-paciente', { id }),
    eliminarPacientePorOrden: (orden) => ipcRenderer.invoke('eliminar-paciente', { orden }),
    eliminarTodosPacientes: () => ipcRenderer.invoke('eliminar-todos-pacientes'),
});

