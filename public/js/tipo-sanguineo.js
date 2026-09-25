(function() {
    'use strict';

    function obtenerExamenes() {
        var examenes = window.examenesOrden || [];
        return {
            abo: examenes.find(function(e) { return e.id === 'grupo_sanguineo_abo'; }),
            rh: examenes.find(function(e) { return e.id === 'factor_rh'; })
        };
    }

    window.abrirFormularioTipoSanguineo = function() {
        var examenes = obtenerExamenes();
        var form = document.getElementById('formularioTipoSanguineo');
        if (!form || !examenes.abo || !examenes.rh) return;

        var grupo = examenes.abo.resultado || '';
        var rh = examenes.rh.resultado || '';
        document.getElementById('antiA').value = grupo === 'A' || grupo === 'AB' ? 'si' : grupo ? 'no' : '';
        document.getElementById('antiB').value = grupo === 'B' || grupo === 'AB' ? 'si' : grupo ? 'no' : '';
        document.getElementById('antiD').value = rh ? (rh === 'Positivo (+)' ? 'si' : 'no') : '';
        form.style.display = 'block';
        window.determinarTipoSangre();
    };

    window.guardarFormularioTipoSanguineo = function() {
        var resultado = window.determinarTipoSangre();
        if (!resultado) {
            alert('Complete las reacciones Anti-A, Anti-B y Anti-D.');
            return;
        }
        window.cerrarFormularioTipoSanguineo();
        if (window.renderizarTablaExamenes) window.renderizarTablaExamenes();
    };

    window.cerrarFormularioTipoSanguineo = function() {
        var form = document.getElementById('formularioTipoSanguineo');
        if (form) form.style.display = 'none';
    };
})();
