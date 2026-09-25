/**
 * Módulo para gestionar los exámenes de uroanalisis
 * 
 */
(function() {
    'use strict';

    window.agruparUroanalisisPorGrupo = function(examenes) {
        var grupos = {};
        examenes.forEach(function(examen) {
            var g = examen.grupo || 'General';
            if (!grupos[g]) grupos[g] = [];
            grupos[g].push(examen);
        });
        return grupos;
    };

})();
