/**
 * Módulo para realizar cálculos automáticos de exámenes de laboratorio
 * 
 * Este módulo contiene funciones para calcular automáticamente los resultados de ciertos exámenes
 * de laboratorio basándose en los valores de entrada proporcionados por otros exámenes.
 */
(function() {
    'use strict';

    var GRUPOS_CALCULO = {};

    if (window.App && window.App.calculos) {
        Object.keys(window.App.calculos).forEach(function(key) {
            if (key !== 'examenes') {
                GRUPOS_CALCULO[key] = window.App.calculos[key];
            }
        });
    }

    if (!GRUPOS_CALCULO.hematologia_absolutos) {
        GRUPOS_CALCULO.hematologia_absolutos = {
            nombre: 'Hematología - Valores Absolutos',
            entradas: ['globulos_blancos', 'neutrofilos_por', 'linfocitos_por', 'eosinofilos_por', 'monocitos_por', 'basofilos_por'],
            salidas: ['neutrofilos_num', 'linfocitos_num', 'eosinofilos_num', 'monocitos_num', 'basofilos_num'],
            calcular: function(examenesOrden) {
                var gb = obtenerValor(examenesOrden, 'globulos_blancos');
                if (isNaN(gb) || gb === 0) return null;
                return {
                    neutrofilos_num: (gb * obtenerValor(examenesOrden, 'neutrofilos_por')) / 100,
                    linfocitos_num: (gb * obtenerValor(examenesOrden, 'linfocitos_por')) / 100,
                    eosinofilos_num: (gb * obtenerValor(examenesOrden, 'eosinofilos_por')) / 100,
                    monocitos_num: (gb * obtenerValor(examenesOrden, 'monocitos_por')) / 100,
                    basofilos_num: (gb * obtenerValor(examenesOrden, 'basofilos_por')) / 100
                };
            }
        };
    }

    if (!GRUPOS_CALCULO.bilirrubinas) {
        GRUPOS_CALCULO.bilirrubinas = {
            nombre: 'Bilirrubinas',
            entradas: ['bilirrubina_total', 'bilirrubina_directa'],
            salidas: ['bilirrubina_indirecta'],
            calcular: function(examenesOrden) {
                var total = obtenerValor(examenesOrden, 'bilirrubina_total');
                var directa = obtenerValor(examenesOrden, 'bilirrubina_directa');
                if (isNaN(total) || isNaN(directa)) return null;
                return { bilirrubina_indirecta: total - directa };
            }
        };
    }

    if (!GRUPOS_CALCULO.proteinas) {
        GRUPOS_CALCULO.proteinas = {
            nombre: 'Proteínas',
            entradas: ['proteinas_totales', 'albumina'],
            salidas: ['globulina', 'relacion_ag'],
            calcular: function(examenesOrden) {
                var total = obtenerValor(examenesOrden, 'proteinas_totales');
                var albumina = obtenerValor(examenesOrden, 'albumina');
                if (isNaN(total) || isNaN(albumina)) return null;
                var globulina = total - albumina;
                var relacionAG = globulina > 0 ? albumina / globulina : 0;
                return { globulina: globulina, relacion_ag: relacionAG };
            }
        };
    }

    if (!GRUPOS_CALCULO.perfil_lipidico) {
        GRUPOS_CALCULO.perfil_lipidico = {
            nombre: 'Perfil Lipídico',
            entradas: ['colesterol_total', 'colesterol_hdl', 'trigliceridos'],
            salidas: ['colesterol_vldl', 'colesterol_ldl'],
            calcular: function(examenesOrden) {
                var total = obtenerValor(examenesOrden, 'colesterol_total');
                var hdl = obtenerValor(examenesOrden, 'colesterol_hdl');
                var trig = obtenerValor(examenesOrden, 'trigliceridos');
                if (isNaN(total) || isNaN(hdl) || isNaN(trig)) return null;
                var vldl = trig / 5;
                var ldl = total - hdl - vldl;
                return { colesterol_vldl: vldl, colesterol_ldl: ldl };
            }
        };
    }

    if (!GRUPOS_CALCULO.psa) {
        GRUPOS_CALCULO.psa = {
            nombre: 'PSA',
            entradas: ['psa_total', 'psa_libre'],
            salidas: ['psa_relacion'],
            calcular: function(examenesOrden) {
                var total = obtenerValor(examenesOrden, 'psa_total');
                var libre = obtenerValor(examenesOrden, 'psa_libre');
                if (isNaN(total) || isNaN(libre)) return null;
                var relacion = libre > 0 ? total / libre : 0;
                return { psa_relacion: relacion };
            }
        };
    }

    function obtenerValor(examenesOrden, examenId) {
        var examen = examenesOrden.find(function(e) { return e.id === examenId; });
        if (!examen || !examen.resultado) return NaN;
        var valor = parseFloat(examen.resultado.replace(',', '.'));
        return isNaN(valor) ? NaN : valor;
    }

    window.ejecutarCalculosAutomaticos = function() {
        var examenesOrden = window.examenesOrden || [];
        if (examenesOrden.length === 0) return;
        var hayCambios = false;
        Object.keys(GRUPOS_CALCULO).forEach(function(grupoKey) {
            var grupo = GRUPOS_CALCULO[grupoKey];
            var resultados = grupo.calcular(examenesOrden);
            if (resultados) {
                Object.keys(resultados).forEach(function(salidaId) {
                    var examen = examenesOrden.find(function(e) { return e.id === salidaId; });
                    if (examen) {
                        var nuevoValor = resultados[salidaId];
                        var valorFormateado = typeof nuevoValor === 'number' ? nuevoValor.toFixed(2) : nuevoValor;
                        if (examen.resultado !== valorFormateado) {
                            examen.resultado = valorFormateado;
                            examen.esCalculado = true;
                            hayCambios = true;
                        }
                    }
                });
            }
        });
        if (hayCambios) {
            window.renderizarTablaExamenes();
        }
    };

})();
