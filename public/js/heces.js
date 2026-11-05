
/**
 * Módulo para gestionar los exámenes de heces
 *
 */
(function() {
    'use strict';

    function leerDatos(examen) {
        if (!examen || !examen.resultado) return {};
        return typeof examen.resultado === 'string'
            ? JSON.parse(examen.resultado || '{}')
            : examen.resultado;
    }

// Sección de exámenes de heces
    window.abrirFormularioHeces = function(examenId) {
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;

        var form = document.getElementById('formularioHeces');
        if (!form) return;
        var datos;
        try {
            datos = leerDatos(examen);
        } catch (error) {
            window.Notifications.error('No se pudieron leer los resultados guardados del examen de heces: ' + error.message);
            return;
        }

        if (!window.HecesForm || !window.HecesForm.construir()) {
            window.Notifications.error('No se encontraron los parámetros del examen de heces en el catálogo.');
            return;
        }
        window.HecesForm.cargar(datos);

        window._examenHecesEditando = examenId;
        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };


    
    window.guardarFormularioHeces = async function() {
        var examenId = window._examenHecesEditando;
        if (!examenId) {
            window.Notifications.error('No se encontró el examen de heces que se va a guardar.');
            return;
        }
        var examenes = window.examenesOrden || [];
        var examen = examenes.find(function(e) { return e.id === examenId; });
        if (!examen) {
            window.Notifications.error('No se encontró el examen de heces en la orden.');
            return;
        }

        var datos;
        try {
            datos = Object.assign({}, leerDatos(examen));
        } catch (error) {
            window.Notifications.error('No se pudieron leer los resultados guardados del examen de heces: ' + error.message);
            return;
        }
        if (!window.HecesForm) {
            window.Notifications.error('No está disponible el formulario de heces.');
            return;
        }
        datos = window.HecesForm.obtenerResultados(datos);
        if (!datos) return;

        var orden = window.pacienteActivo ? window.pacienteActivo.orden : (window.getOrden ? window.getOrden() : '');
        if (!orden) {
            window.Notifications.error('Error: No se pudo determinar la orden.');
            return;
        }
        if (!window.api || typeof window.api.guardarPacienteExamenes !== 'function') {
            window.Notifications.error('Error: No está disponible el guardado en la base de datos.');
            return;
        }

        var resultado = JSON.stringify(datos);
        var examenesActualizados = examenes.map(function(item) {
            if (item.id !== examenId) return item;
            return Object.assign({}, item, {
                resultado: resultado,
                examen_id: 'examen_heces',
                tipoFormulario: 'heces'
            });
        });

        var guardado;
        try {
            var examenesParaGuardar = examenesActualizados.map(function(item) {
                if (item.id !== examenId) return item;
                return Object.assign({}, item, { resultado: datos });
            });
            guardado = await window.api.guardarPacienteExamenes(orden, examenesParaGuardar);
            if (!guardado || !guardado.success) {
                throw new Error(guardado && guardado.error ? guardado.error : 'No se pudieron guardar los resultados.');
            }
        } catch (error) {
            console.error('[guardarFormularioHeces] Error:', error);
            window.Notifications.error('Error al guardar los resultados: ' + error.message);
            return;
        }

        examen.resultado = resultado;
        examen.examen_id = 'examen_heces';
        examen.tipoFormulario = 'heces';
        if (window.pacienteActivo) {
            window.pacienteActivo.examenes = JSON.parse(JSON.stringify(examenes));
        }
        window.renderizarTablaExamenes();
        window.cerrarFormularioHeces();
    };

    window.cerrarFormularioHeces = function() {
        var form = document.getElementById('formularioHeces');
        if (form) form.style.display = 'none';
        window._examenHecesEditando = null;
    };

})();
