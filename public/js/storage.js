(function() {
    'use strict';

    function obtenerOrdenDiaria() {
        try {
            var pacientes = window.obtenerPacientes ? window.obtenerPacientes() : [];
            var maxOrden = 0;
            pacientes.forEach(function(p) {
                var num = parseInt(p.orden, 10);
                if (!isNaN(num) && num > maxOrden) {
                    maxOrden = num;
                }
            });
            var nuevoOrden = maxOrden + 1;
            localStorage.setItem('ultimoOrdenLab', nuevoOrden);
            return String(nuevoOrden).padStart(3, '0');
        } catch (e) {
            return String(Date.now() % 1000).padStart(3, '0');
        }
    }

    function obtenerCatalogo() {
        try {
            var base = JSON.parse(JSON.stringify(window.App.catalogo || []));
            var custom = JSON.parse(localStorage.getItem('catalogoCustom')) || [];
            var customMap = {};
            custom.forEach(function(e) { customMap[e.id] = e; });
            return base.map(function(e) {
                var override = customMap[e.id];
                if (!override) return e;
                return Object.assign({}, e, override, { id: e.id });
            });
        } catch (e) {
            return JSON.parse(JSON.stringify(window.App.catalogo || []));
        }
    }

    function obtenerPacientes() {
        try {
            return JSON.parse(localStorage.getItem('pacientesLab')) || [];
        } catch (e) {
            return [];
        }
    }

    function guardarPacientes(pacientes) {
        localStorage.setItem('pacientesLab', JSON.stringify(pacientes));
    }

    function obtenerUltimaOrden() {
        return parseInt(localStorage.getItem('ultimoOrdenLab')) || 0;
    }

    function guardarUltimaOrden(numero) {
        localStorage.setItem('ultimoOrdenLab', numero);
    }

    function archivarOrdenAnterior(paciente) {
        if (!paciente) return;
        var tieneExamenes = paciente.examenes && paciente.examenes.length > 0;
        var tieneHistorialResultados = false;
        if (paciente.examenes && paciente.examenes.length > 0) {
            tieneHistorialResultados = paciente.examenes.some(function(e) {
                if (e.tipoFormulario === 'heces' || e.tipoFormulario === 'uroanalisis' || e.tipo === 'multiselect_cantidad') {
                    try {
                        var datos = JSON.parse(e.resultado || '{}');
                        return Object.keys(datos).length > 0 && Object.values(datos).some(function(v) { return v !== ''; });
                    } catch(err) { return false; }
                }
                return String(e.resultado || '').trim() !== '';
            });
        }
        if (!tieneExamenes && !tieneHistorialResultados) return;
        if (!paciente.ordenesPrevias) {
            paciente.ordenesPrevias = [];
        }
        paciente.ordenesPrevias.push({
            orden: String(paciente.orden || '').padStart(3, '0'),
            fecha: paciente.fechaRegistro || new Date().toLocaleDateString('es-ES'),
            examenes: JSON.parse(JSON.stringify(paciente.examenes || [])),
            refAdaptadas: !!paciente.refAdaptadas,
            perfiles: paciente.perfiles ? paciente.perfiles.slice() : [],
            historial: paciente.historial ? JSON.parse(JSON.stringify(paciente.historial || [])) : []
        });
    }

    window.obtenerOrdenDiaria = obtenerOrdenDiaria;
    window.obtenerCatalogo = obtenerCatalogo;
    window.obtenerPacientes = obtenerPacientes;
    window.guardarPacientes = guardarPacientes;
    window.obtenerUltimaOrden = obtenerUltimaOrden;
    window.guardarUltimaOrden = guardarUltimaOrden;
    window.archivarOrdenAnterior = archivarOrdenAnterior;

})();;
