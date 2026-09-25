(function() {
    'use strict';

    var CATALOGO_EXAMENES = window.App.catalogo || [];
    var PERFILES = window.App.perfiles || {};
    var EXAMENES_DETALLADOS = window.App.examenesDetallados || {};
    var REFERENCIAS_ADAPTATIVAS = window.App.referencias || {};

    // ============================================
    // Event listeners para cambios en datos
    // ============================================
    window.addEventListener('catalogoCustomChange', function() {
        if (document.getElementById('selectorExamenes')) {
            window.refrescarSelect2Catalogos();
        }
        if (document.getElementById('catalogoAcordeones')) {
            window.initCatalogo();
        }
    });

    // ============================================
    // Inicialización principal
    // ============================================
    function ejecutarInit() {
        var path = window.location.pathname;
        var params = new URLSearchParams(window.location.search);

        if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
            if (window.initRecepcion) window.initRecepcion();
        } else if (path.includes('orden.html')) {
            if (window.initOrden) window.initOrden(params.get('orden'));
        } else if (path.includes('reporte.html')) {
            if (window.initReporte) window.initReporte(params.get('orden'));
        } else if (path.includes('catalogo.html')) {
            if (window.initCatalogo) window.initCatalogo();
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        window.mostrarFechaHoy();
        if (window.onStorageReady) {
            window.onStorageReady(ejecutarInit);
        } else {
            ejecutarInit();
        }
    });

    // ============================================
    // Validaciones de funciones existentes
    // ============================================
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

    // ============================================
    // Funciones helper para usar en otros archivos
    // ============================================
    window.buscarPacientePorCedula = function(cedula) {
        var pacientes = window.obtenerPacientes ? window.obtenerPacientes() : [];
        return pacientes.filter(function(p) {
            return p.cedula && p.cedula.toString().includes(cedula.toString());
        });
    };

    window.buscarPacientePorNombre = function(nombre) {
        var termino = nombre.toLowerCase();
        var pacientes = window.obtenerPacientes ? window.obtenerPacientes() : [];
        return pacientes.filter(function(p) {
            return p.nombre && p.nombre.toLowerCase().includes(termino);
        });
    };

    console.log('✅ App.js cargado con soporte IndexedDB');
})();
