
/**
 * Módulo para gestionar los exámenes de heces
 *
 */
(function() {
    'use strict';

    /**
     * Parámetros del examen de heces tomados del catálogo, no hardcodeados.
     * `window.App.examenesDetallados.examen_heces` es la única fuente de verdad:
     * la misma definición que siembra SQLite y que usa el renderer del reporte,
     * así que agregar un campo no obliga a tocar el HTML ni el PDF.
     *
     * El catálogo se hidrata en `db-catalogo.js` antes de que este formulario
     * se pueda abrir, por lo que aquí no se mantiene ningún respaldo estático:
     * si llegara a faltar, el formulario queda vacío en lugar de inventar campos.
     */
    function camposHeces() {
        var detalle = window.App && window.App.examenesDetallados
            ? window.App.examenesDetallados.examen_heces
            : null;
        if (detalle && detalle.items && detalle.items.length) return detalle.items;
        return [];
    }

    function valorDeCampo(id) {
        var el = document.getElementById(id);
        return el ? String(el.value || '').trim() : '';
    }

// Sección de exámenes de heces
    window.abrirFormularioHeces = function(examenId) {
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;
        // Guardar el examenId en una variable global para usarlo al guardar
        window._examenHecesEditando = examenId;

        var form = document.getElementById('formularioHeces');
        if (!form) return;
        form.style.display = 'block';
        try {
            var datos = JSON.parse(examen.resultado || '{}');
            camposHeces().forEach(function(campo) {
                var el = document.getElementById(campo.id);
                if (el) el.value = datos[campo.id] != null ? datos[campo.id] : '';
            });
        } catch(e) {}

        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };


    
    window.guardarFormularioHeces = async function() {
        var examenId = window._examenHecesEditando;
        if (!examenId) {
            alert('No se encontró el examen de heces que se va a guardar.');
            return;
        }
        // Un objeto { clave: valor } recorrido en el orden del catálogo, con
        // las claves vacías descartadas: así la base de datos recibe una fila
        // por parámetro con contenido real y no una fila con el JSON entero.
        var datos = {};
        camposHeces().forEach(function(campo) {
            var valor = valorDeCampo(campo.id);
            if (valor !== '') datos[campo.id] = valor;
        });

        var examenes = window.examenesOrden || [];
        var examen = examenes.find(function(e) { return e.id === examenId; });
        if (!examen) {
            alert('No se encontró el examen de heces en la orden.');
            return;
        }

        var orden = window.pacienteActivo ? window.pacienteActivo.orden : (window.getOrden ? window.getOrden() : '');
        if (!orden) {
            alert('Error: No se pudo determinar la orden.');
            return;
        }
        if (!window.api || typeof window.api.guardarPacienteExamenes !== 'function') {
            alert('Error: No está disponible el guardado en la base de datos.');
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
            alert('Error al guardar los resultados: ' + error.message);
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

    window.validarSustanciasReductoras = function(valor) {
        var div = document.getElementById('interpretacionReductoras');
        if (!div) return;
        var num = parseFloat(valor);
        if (isNaN(num) || valor === '') {
            div.innerHTML = '';
            return;
        }
        var resultado = window.interpretarSustanciasReductoras(valor);
        if (resultado.texto) {
            div.innerHTML = '<span class="badge ' + resultado.clase + '">' + resultado.texto + '</span>';
        } else {
            div.innerHTML = '';
        }
    };

})();
