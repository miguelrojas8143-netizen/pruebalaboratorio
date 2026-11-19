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

        document.getElementById('grupoSanguineoSeleccion').value = examenes.abo.resultado || '';
        document.getElementById('factorRhSeleccion').value = examenes.rh.resultado || '';
        form.style.display = 'block';
        window.determinarTipoSangre();
    };

    window.guardarFormularioTipoSanguineo = function() {
        var resultado = window.determinarTipoSangre();
        if (!resultado) {
            window.Notifications.error('Seleccione el grupo sanguíneo y el factor Rh.');
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
