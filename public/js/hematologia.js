
/**
 * Módulo para gestionar los exámenes de hematología
 * 
 */
(function() {
    'use strict';
// Sección de exámenes de hematología
    window.separarVSG = function(examenes) {
        var vsg = examenes.filter(function(e) { return e.id === 'vsg'; });
        var otros = examenes.filter(function(e) { return e.id !== 'vsg'; });
        return { vsg: vsg, otros: otros };
    };

})();
