/**
 * Módulo para editar los datos de un paciente ya registrado.
 * Acceso: desde la vista Orden -> vistas/modificar.html?orden=NNN
 *
 * Migrado desde IndexedDB a SQLite:
 *   - initModificador(): línea 70 — usa window.api.obtenerPacientePorOrden()
 *   - guardarModificacion(): línea 92 — usa window.api.actualizarPaciente()
 *
 * No depende de app.js/orden.js; página autónoma.
 */
(function() {
    'use strict';

    function leerOrden() {
        return String(new URLSearchParams(window.location.search).get('orden') || '').padStart(3, '0');
    }

    function formatearEdad(valor) {
        var edad = window.calcularEdad(valor);
        return edad !== null && edad !== undefined ? edad + ' años' : '';
    }

    function cargarFormulario(paciente) {
        document.getElementById('modNombre').value = paciente.nombre || '';
        document.getElementById('modSexo').value = paciente.sexo || '';
        document.getElementById('modCedula').value = paciente.cedula || '';
        document.getElementById('modFechaNac').value = paciente.fechaNac || '';
        document.getElementById('modEdad').value = paciente.edad
            ? (paciente.edad + ' años')
            : formatearEdad(paciente.fechaNac || '');
        document.getElementById('modTelefono').value = paciente.telefono || '';
    }

    // LÍNEA ~92: Guarda modificaciones del paciente en SQLite vía IPC
    async function guardarModificacion(paciente, orden) {
        var nombre = document.getElementById('modNombre').value.trim();
        var sexo = document.getElementById('modSexo').value;
        var cedula = document.getElementById('modCedula').value.trim();
        var fechaNac = document.getElementById('modFechaNac').value.trim();
        var telefono = document.getElementById('modTelefono').value.trim();

        if (!nombre || !sexo) {
            alert('Nombre y sexo son obligatorios.');
            return;
        }

        var edad = window.calcularEdad(fechaNac);

        // Verificar cédula duplicada usando SQLite
        try {
            var resp = await window.api.obtenerPacientesCompletos();
            if (resp.success) {
                var existente = resp.pacientes.find(function(p) {
                    return p.orden !== paciente.orden && (p.cedula || '') === cedula;
                });
                if (existente) {
                    alert('La cédula ' + cedula + ' ya está registrada para otro paciente (' + existente.nombre + ').');
                    return;
                }
            }
        } catch (e) {
            console.error('[guardarModificacion] Error verificando cédula:', e);
        }

        paciente.nombre = nombre;
        paciente.sexo = sexo;
        paciente.cedula = cedula || null;
        paciente.fechaNac = fechaNac || null;
        paciente.telefono = telefono || null;
        paciente.edad = edad;

        // Guardar en SQLite vía IPC
        try {
            var res = await window.api.actualizarPaciente(paciente);
            if (!res.success) {
                alert('Error al guardar: ' + res.error);
                return;
            }
            alert('Datos del paciente actualizados correctamente.');
            window.location.href = 'orden.html?orden=' + orden;
        } catch (err) {
            console.error('[guardarModificacion] Error:', err);
            alert('Error al guardar los cambios: ' + err.message);
        }
    }

    // LÍNEA ~74: Carga los datos del paciente desde SQLite
    async function initModificador() {
        var orden = leerOrden();
        if (!orden) {
            window.location.href = '../index.html';
            return;
        }

        // Migrado: obtener paciente desde SQLite en lugar de IndexedDB
        try {
            var result = await window.api.obtenerPacientePorOrden(orden);
            if (!result.success || !result.paciente) {
                alert('Paciente no encontrado para la orden: ' + orden);
                window.location.href = '../index.html';
                return;
            }

            var paciente = result.paciente;
            paciente.examenes = (result.examenes || []).map(function(e) {
                return { id: e.nombre_examen, nombre: e.nombre_examen, resultado: e.resultado || '' };
            });
            paciente.id = paciente.id || null;
            paciente.visitas = paciente.visitas || 1;
            paciente.refAdaptadas = paciente.refAdaptadas || false;
            paciente.historial = paciente.historial || [];
            paciente.perfiles = paciente.perfiles || [];
            paciente.telefono = paciente.telefono || '';

            window.pacienteModificacion = paciente;
            cargarFormulario(paciente);

            var fechaNacInput = document.getElementById('modFechaNac');
            if (fechaNacInput) {
                fechaNacInput.addEventListener('input', function() {
                    var edadInput = document.getElementById('modEdad');
                    if (edadInput) {
                        edadInput.value = formatearEdad(this.value.trim());
                    }
                });
            }

            var form = document.getElementById('formModificar');
            if (form) {
                form.addEventListener('submit', function(e) {
                    e.preventDefault();
                    window.guardarModificacion(paciente, orden);
                });
            }

            var volver = document.getElementById('btnVolverOrden');
            if (volver) {
                volver.onclick = function() { window.location.href = 'orden.html?orden=' + orden; };
            }
            var cancelar = document.getElementById('modCancelar');
            if (cancelar) {
                cancelar.onclick = function() { window.location.href = 'orden.html?orden=' + orden; };
            }
        } catch (err) {
            console.error('[initModificador] Error:', err);
            alert('Error cargando el paciente: ' + err.message);
            window.location.href = '../index.html';
        }
    }

    // Exponer funciones globalmente
    window.guardarModificacion = guardarModificacion;
    window.initModificador = initModificador;
})();