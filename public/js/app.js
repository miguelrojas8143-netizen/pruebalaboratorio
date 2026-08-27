(function() {
    'use strict';

    var CATALOGO_EXAMENES = window.App.catalogo || [];
    var PERFILES = window.App.perfiles || {};
    var EXAMENES_DETALLADOS = window.App.examenesDetallados || {};
    var REFERENCIAS_ADAPTATIVAS = window.App.referencias || {};

    window.addEventListener('storage', function(e) {
        if (e.key !== 'catalogoCustom') return;
        if (document.getElementById('selectorExamenes')) {
            window.refrescarSelect2Catalogos();
        }
        if (document.getElementById('catalogoAcordeones')) {
            window.initCatalogo();
        }
    });

    document.addEventListener('DOMContentLoaded', function() {
        window.mostrarFechaHoy();
        var path = window.location.pathname;
        var params = new URLSearchParams(window.location.search);
        if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
            window.initRecepcion();
        } else if (path.includes('orden.html')) {
            window.initOrden(params.get('orden'));
        } else if (path.includes('reporte.html')) {
            window.initReporte(params.get('orden'));
        } else if (path.includes('catalogo.html')) {
            window.initCatalogo();
        }
    });

    var guardarResultadosOriginal = window.guardarResultados;
    window.guardarResultados = function() {
        if (!window.examenesOrden || window.examenesOrden.length === 0) {
            alert('No hay exámenes en la orden para guardar.');
            return;
        }
        guardarResultadosOriginal();
    };

    var guardarSolicitudOriginal = window.guardarSolicitud;
    window.guardarSolicitud = function() {
        if (!window.examenesOrden || window.examenesOrden.length === 0) {
            alert('Debe agregar al menos un examen a la orden antes de guardar la solicitud.');
            return;
        }
        guardarSolicitudOriginal();
    };

    var irAImpresionOriginal = window.irAImpresion;
    window.irAImpresion = function() {
        irAImpresionOriginal();
    };

})();
