(function() {
    'use strict';

    window.agruparSecrecionVaginalPorGrupo = function(examenes) {
        var grupos = {};
        examenes.forEach(function(examen) {
            var g = examen.grupo || 'General';
            if (!grupos[g]) grupos[g] = [];
            grupos[g].push(examen);
        });
        return grupos;
    };

    window.esSecrecionVaginal = function(examen) {
        return examen && examen.area === 'Secreción Vaginal';
    };

})();
