/**
 * Módulo para gestionar el modal de perfiles de exámenes
 */

(function(){
    'use strict';
    // Función para agregar los exámenes seleccionados del perfil a la orden
    window.agregarExamenesPerfilSeleccionados = function() {
        var checkboxes = document.querySelectorAll('.perfil-examen-check:checked');
        if (checkboxes.length === 0) {
            alert('Debe seleccionar al menos un examen del perfil.');
            return;
        }

        var catalogo = window.obtenerCatalogo();
        var catalogoMap = {};
        catalogo.forEach(function(e) { catalogoMap[e.id] = e; });

        var agregados = 0;
        checkboxes.forEach(function(chk) {
            var examenId = chk.value;
            if (window.examenesOrden.some(function(e) { return e.id === examenId; })) return;

            var datos = null;
            Object.keys(window.App.perfiles).forEach(function(perfilKey) {
                var perfil = window.App.perfiles[perfilKey];
                var encontrado = perfil.examenes.find(function(e) { return e.id === examenId; });
                if (encontrado) datos = encontrado;
            });

            if (!datos) return;
            var override = catalogoMap[datos.id];
            var merged = override ? Object.assign({}, datos, override) : datos;
            var nuevoExamen = window.crearExamenDesdeCatalogo(merged);
            var perfilSeleccionado = document.getElementById('modalPerfil').getAttribute('data-perfil-id');
            nuevoExamen.grupoPerfil = window.App.perfiles[perfilSeleccionado] ? window.App.perfiles[perfilSeleccionado].nombre : 'Exámenes del perfil';
            window.examenesOrden.push(nuevoExamen);
            agregados++;
        });

        if (agregados === 0) {
            alert('Los exámenes seleccionados ya están en la orden o no se pudieron agregar.');
            return;
        }

        if (window.pacienteActivo) {
            var perfilId = document.getElementById('modalPerfil').getAttribute('data-perfil-id');
            if (perfilId && window.App.perfiles[perfilId]) {
                if (!window.pacienteActivo.perfiles) {
                    window.pacienteActivo.perfiles = [];
                }
                if (!window.pacienteActivo.perfiles.includes(perfilId)) {
                    window.pacienteActivo.perfiles.push(perfilId);
                }
            }
        }

        var modalEl = document.getElementById('modalPerfil');
        var modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        window.renderizarTablaExamenes();
    };
})();
