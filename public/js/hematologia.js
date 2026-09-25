
/**
 * Módulo para gestionar los exámenes de hematología
 * 
 */
(function() {
    'use strict';
// Sección de exámenes de hematología
    window.ordenarHematologiaPorSufijo = function(examenes) {
        exames.sort(function(a, b) {
            var aIsNum = a.id.endsWith('_num');
            var bIsNum = b.id.endsWith('_num');
            if (aIsNum && !bIsNum) return -1;
            if (!aIsNum && bIsNum) return 1;
            var baseA = a.id.replace(/_por$|_num$/, '');
            var baseB = b.id.replace(/_por$|_num$/, '');
            if (baseA < baseB) return -1;
            if (baseA > baseB) return 1;
            return 0;
        });
    };

    window.separarVSG = function(examenes) {
        var vsg = examenes.filter(function(e) { return e.id === 'vsg'; });
        var otros = examenes.filter(function(e) { return e.id !== 'vsg'; });
        return { vsg: vsg, otros: otros };
    };

})();
