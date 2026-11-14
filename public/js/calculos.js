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
                var porcentajes = ['neutrofilos', 'linfocitos', 'eosinofilos', 'monocitos', 'basofilos'];
                var resultados = {};
                porcentajes.forEach(function(nombre) {
                    var porcentaje = obtenerValor(examenesOrden, nombre + '_por');
                    if (!isNaN(porcentaje)) {
                        resultados[nombre + '_num'] = (gb * porcentaje) / 100;
                    }
                });
                return Object.keys(resultados).length > 0 ? resultados : null;
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
// Función para obtener el valor de un examen
 // Si el examen no tiene un resultado directo, busca en el perfil correspondiente
    function obtenerValor(examenesOrden, examenId) {
        var examen = examenesOrden.find(function(e) { return e.id === examenId; });
        var resultado = examen && examen.resultado;
        if (!resultado) {
            var perfil = examenesOrden.find(function(e) {
                return e.tipo === 'perfil' && e.resultado;
            });
            if (perfil) {
                try {
                    var datosPerfil = JSON.parse(perfil.resultado);
                    resultado = datosPerfil[examenId];
                } catch (e) {
                    resultado = '';
                }
            }
        }
        if (resultado === undefined || resultado === null || resultado === '') return NaN;
        var valor = parseFloat(String(resultado).replace(',', '.'));
        return isNaN(valor) ? NaN : valor;
    }
//  Función para guardar el valor calculado de un examen
    function guardarValor(examenesOrden, examenId, valorFormateado) {
        var examen = examenesOrden.find(function(e) { return e.id === examenId; });
        if (examen) {
            examen.resultado = valorFormateado;
            examen.esCalculado = true;
            return true;
        }

        var perfil = examenesOrden.find(function(e) {
            return e.tipo === 'perfil' && e.resultado;
        });
        if (!perfil) return false;
        try {
            var datosPerfil = JSON.parse(perfil.resultado);
            datosPerfil[examenId] = valorFormateado;
            perfil.resultado = JSON.stringify(datosPerfil);
            perfil.esCalculado = true;
            return true;
        } catch (e) {
            return false;
        }
    }
 // Función para ejecutar los cálculos automáticos de todos los grupos definidos
   // Compara los resultados calculados con los valores actuales y actualiza si hay cambios
    window.ejecutarCalculosAutomaticos = function() {
        var examenesOrden = window.examenesOrden || [];
        if (examenesOrden.length === 0) return;
        var cambios = {};
        Object.keys(GRUPOS_CALCULO).forEach(function(grupoKey) {
            var grupo = GRUPOS_CALCULO[grupoKey];
            var resultados = grupo.calcular(examenesOrden);
            if (resultados) {
                Object.keys(resultados).forEach(function(salidaId) {
                    var examen = examenesOrden.find(function(e) { return e.id === salidaId; });
                    var resultadoActual = examen ? examen.resultado : obtenerValorGuardado(examenesOrden, salidaId);
                    var nuevoValor = resultados[salidaId];
                    var valorFormateado = typeof nuevoValor === 'number' ? nuevoValor.toFixed(2) : nuevoValor;
                    if (String(resultadoActual || '') !== String(valorFormateado)) {
                        if (guardarValor(examenesOrden, salidaId, valorFormateado)) {
                            cambios[salidaId] = valorFormateado;
                        }
                    }
                });
            }
        });
        var clavesCambio = Object.keys(cambios);
        if (clavesCambio.length > 0) {
            if (window.actualizarCeldasCalculadas) {
                window.actualizarCeldasCalculadas(cambios);
            } else if (window.renderizarTablaExamenes) {
                window.renderizarTablaExamenes();
            }
        }
    };
   // Función para obtener el valor guardado de un examen, ya sea directamente o desde un perfil
    function obtenerValorGuardado(examenesOrden, examenId) {
        var examen = examenesOrden.find(function(e) { return e.id === examenId; });
        if (examen) return examen.resultado;
        var perfil = examenesOrden.find(function(e) { return e.tipo === 'perfil' && e.resultado; });
        if (!perfil) return '';
        try {
            return JSON.parse(perfil.resultado)[examenId] || '';
        } catch (e) {
            return '';
        }
    }

})();
