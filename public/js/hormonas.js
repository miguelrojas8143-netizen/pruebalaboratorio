/**
 * Módulo para gestionar los exámenes de hormonas 
 * 
 */
(function() {
    'use strict';

    window.App = window.App || {};
    window.App.calculos = window.App.calculos || {};
    window.App.calculos.psa = {
        nombre: 'PSA',
        entradas: ['psa_total', 'psa_libre'],
        salidas: ['psa_relacion'],
        calcular: function(examenesOrden) {
            var total = window.obtenerValor(examenesOrden, 'psa_total');
            var libre = window.obtenerValor(examenesOrden, 'psa_libre');
            if (isNaN(total) || isNaN(libre)) return null;
            var relacion = libre > 0 ? total / libre : 0;
            return { psa_relacion: relacion };
        }
    };

})();
