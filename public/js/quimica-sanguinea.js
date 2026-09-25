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
    window.App.calculos.proteinas = {
        nombre: 'Proteínas',
        entradas: ['proteinas_totales', 'albumina'],
        salidas: ['globulina', 'relacion_ag'],
        calcular: function(examenesOrden) {
            var total = window.obtenerValor(examenesOrden, 'proteinas_totales');
            var albumina = window.obtenerValor(examenesOrden, 'albumina');
            if (isNaN(total) || isNaN(albumina)) return null;
            var globulina = total - albumina;
            var relacionAG = globulina > 0 ? albumina / globulina : 0;
            return { globulina: globulina, relacion_ag: relacionAG };
        }
    };
    window.App.calculos.perfil_lipidico = {
        nombre: 'Perfil Lipídico',
        entradas: ['colesterol_total', 'colesterol_hdl', 'trigliceridos'],
        salidas: ['colesterol_vldl', 'colesterol_ldl'],
        calcular: function(examenesOrden) {
            var total = window.obtenerValor(examenesOrden, 'colesterol_total');
            var hdl = window.obtenerValor(examenesOrden, 'colesterol_hdl');
            var trig = window.obtenerValor(examenesOrden, 'trigliceridos');
            if (isNaN(total) || isNaN(hdl) || isNaN(trig)) return null;
            var vldl = trig / 5;
            var ldl = total - hdl - vldl;
            return { colesterol_vldl: vldl, colesterol_ldl: ldl };
        }
    };

})();
