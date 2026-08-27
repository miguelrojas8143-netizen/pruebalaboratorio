(function() {
    'use strict';

    function obtenerOrdenDiaria() {
        try {
            var pacientes = window.obtenerPacientes ? window.obtenerPacientes() : [];
            var maxOrden = 0;
            pacientes.forEach(function(p) {
                var num = parseInt(p.orden, 10);
                if (!isNaN(num) && num > maxOrden) {
                    maxOrden = num;
                }
            });
            var nuevoOrden = maxOrden + 1;
            localStorage.setItem('ultimoOrdenLab', nuevoOrden);
            return String(nuevoOrden).padStart(3, '0');
        } catch (e) {
            return String(Date.now() % 1000).padStart(3, '0');
        }
    }

    function obtenerCatalogo() {
        try {
            var base = JSON.parse(JSON.stringify(window.App.catalogo || []));
            var custom = JSON.parse(localStorage.getItem('catalogoCustom')) || [];
            var customMap = {};
            custom.forEach(function(e) { customMap[e.id] = e; });
            return base.map(function(e) {
                var override = customMap[e.id];
                if (!override) return e;
                return Object.assign({}, e, override, { id: e.id });
            });
        } catch (e) {
            return JSON.parse(JSON.stringify(window.App.catalogo || []));
        }
    }

    function obtenerPacientes() {
        try {
            return JSON.parse(localStorage.getItem('pacientesLab')) || [];
        } catch (e) {
            return [];
        }
    }

    function guardarPacientes(pacientes) {
        localStorage.setItem('pacientesLab', JSON.stringify(pacientes));
    }

    function obtenerUltimaOrden() {
        return parseInt(localStorage.getItem('ultimoOrdenLab')) || 0;
    }

    function guardarUltimaOrden(numero) {
        localStorage.setItem('ultimoOrdenLab', numero);
    }

    window.obtenerOrdenDiaria = obtenerOrdenDiaria;
    window.obtenerCatalogo = obtenerCatalogo;
    window.obtenerPacientes = obtenerPacientes;
    window.guardarPacientes = guardarPacientes;
    window.obtenerUltimaOrden = obtenerUltimaOrden;
    window.guardarUltimaOrden = guardarUltimaOrden;

})();
