(function() {
    'use strict';

    window.App = window.App || {};
    window.App.calculos = window.App.calculos || {};
    window.App.calculos.bilirrubinas = {
        nombre: 'Bilirrubinas',
        entradas: ['bilirrubina_total', 'bilirrubina_directa'],
        salidas: ['bilirrubina_indirecta'],
        calcular: function(examenesOrden) {
            var total = window.obtenerValor(examenesOrden, 'bilirrubina_total');
            var directa = window.obtenerValor(examenesOrden, 'bilirrubina_directa');
            if (isNaN(total) || isNaN(directa)) return null;
            return { bilirrubina_indirecta: total - directa };
        }
    };
})();
