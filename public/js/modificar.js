/**
 * Módulo para editar los datos de un paciente ya registrado.
 * Acceso: desde la vista Orden -> vistas/modificar.html?orden=NNN
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

    window.guardarModificacion = function(paciente, orden) {
        var nombre = document.getElementById('modNombre').value.trim();
        var sexo = document.getElementById('modSexo').value;
        var cedula = document.getElementById('modCedula').value.trim();
        var fechaNac = document.getElementById('modFechaNac').value.trim();
        var telefono = document.getElementById('modTelefono').value.trim();

        if (!nombre || !sexo) {
            alert('Nombre y sexo son obligatorios.');
            return;
        }

        var pacientes = window.obtenerPacientes();
        if (cedula) {
            var existente = pacientes.find(function(p) {
                return p.id !== paciente.id && (p.cedula || '') === cedula;
            });
            if (existente) {
                alert('La cédula ' + cedula + ' ya está registrada para otro paciente (' + existente.nombre + ').');
                return;
            }
        }

        var edad = window.calcularEdad(fechaNac);

        paciente.nombre = nombre;
        paciente.sexo = sexo;
        paciente.cedula = cedula || null;
        paciente.fechaNac = fechaNac || null;
        paciente.telefono = telefono || null;
        paciente.edad = edad;

        var index = pacientes.findIndex(function(p) { return p.id === paciente.id; });
        if (index !== -1) {
            pacientes[index] = paciente;
        }
        window.guardarPacientes(pacientes).catch(function(e) {
            console.error('[guardarPacientes] Error:', e);
        });

        alert('Datos del paciente actualizados correctamente.');
        window.location.href = 'orden.html?orden=' + orden;
    };

    window.initModificar = function() {
        var orden = leerOrden();
        if (!orden) {
            window.location.href = '../index.html';
            return;
        }

        var pacientes = window.obtenerPacientes();
        var paciente = pacientes.find(function(p) {
            return String(p.orden || '').padStart(3, '0') === orden;
        });
        if (!paciente) {
            alert('Paciente no encontrado para la orden: ' + orden);
            window.location.href = '../index.html';
            return;
        }

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
    };
})();
