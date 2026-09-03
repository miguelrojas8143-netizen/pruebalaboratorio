/**
 * Módulo para gestionar el modal de perfiles de exámenes
 */

(function(){
    'use strict';
// Función para abrir el modal de perfil y mostrar los exámenes asociados
    window.abrirModalPerfil = function(perfilId) {
        var perfil = window.App.perfiles[perfilId];
        if (!perfil) return;

        var modalEl = document.getElementById('modalPerfil');
        modalEl.setAttribute('data-perfil-id', perfilId);

        document.getElementById('modalPerfilTitulo').textContent = perfil.nombre;
        var body = document.getElementById('modalPerfilBody');
        if (!body) return;

        var html = '<div class="perfil-examenes-lista"><div class="d-flex justify-content-end mb-3"><div class="form-check"><input class="form-check-input" type="checkbox" id="seleccionarTodosPerfil"><label class="form-check-label fw-semibold" for="seleccionarTodosPerfil">Seleccionar todos</label></div></div>';
        perfil.examenes.forEach(function(examen, index) {
            var detalle = window.App.examenesDetallados[examen.id];
            var tieneItems = detalle && detalle.items && detalle.items.length > 0;

            html += '<div class="card mb-3 perfil-examen-card" data-examen-index="' + index + '"><div class="card-body py-3"><div class="d-flex align-items-center flex-wrap gap-2"><div class="form-check me-2"><input class="form-check-input perfil-examen-check" type="checkbox" value="' + examen.id + '" id="perfilCheck_' + index + '"><label class="form-check-label fw-semibold" for="perfilCheck_' + index + '">' + examen.nombre + '</label></div><span class="badge bg-light text-muted">' + examen.area + '</span>' + (examen.unidad ? '<span class="text-muted small">' + examen.unidad + '</span>' : '') + (tieneItems ? '<button type="button" class="btn btn-sm btn-outline-primary ms-auto" onclick="window.toggleItemsPerfil(' + index + ')"><i class="bi bi-chevron-down" id="iconoToggle_' + index + '"></i> Ver Ítems</button>' : '<span class="badge bg-light text-muted ms-auto">Sin ítems detallados</span>') + '</div>';

            if (tieneItems) {
                html += '<div class="perfil-items-contenedor mt-3" id="perfilItems_' + index + '" style="display: none;"><div class="card bg-light border"><div class="card-body p-3">' + window.renderizarItemsDetalladosModal(detalle.items, 'perfilItem_' + index) + '</div></div></div>';
            }

            html += '</div></div>';
        });
        html += '</div>';

        body.innerHTML = html;
        var masterCheckbox = document.getElementById('seleccionarTodosPerfil');
        if (masterCheckbox) {
            masterCheckbox.addEventListener('change', function() {
                var checks = document.querySelectorAll('.perfil-examen-check');
                checks.forEach(function(cb) { cb.checked = masterCheckbox.checked; });
            });
        }
        var individualChecks = document.querySelectorAll('.perfil-examen-check');
        individualChecks.forEach(function(cb) {
            cb.addEventListener('change', function() {
                window.actualizarEstadoSeleccionarTodos();
            });
        });
        window.actualizarEstadoSeleccionarTodos();
        var modal = new bootstrap.Modal(document.getElementById('modalPerfil'));
        modal.show();
    };


    //Función para alternar la visibilidad de los ítems detallados de un examen 
     //dentro del modal de perfil
     // Índice del examen dentro del perfil
    
    window.toggleItemsPerfil = function(index) {
        var contenedor = document.getElementById('perfilItems_' + index);
        var icono = document.getElementById('iconoToggle_' + index);
        if (!contenedor) return;
        if (contenedor.style.display === 'none') {
            contenedor.style.display = 'block';
            icono.classList.remove('bi-chevron-down');
            icono.classList.add('bi-chevron-up');
        } else {
            contenedor.style.display = 'none';
            icono.classList.remove('bi-chevron-up');
            icono.classList.add('bi-chevron-down');
        }
    };


// Función para actualizar el estado del checkbox "Seleccionar todos" según los checkboxes individuales
    window.actualizarEstadoSeleccionarTodos = function() {
        var checks = document.querySelectorAll('.perfil-examen-check');
        var master = document.getElementById('seleccionarTodosPerfil');
        if (master) {
            master.checked = checks.length > 0 && Array.from(checks).every(function(cb) { return cb.checked; });
        }
    };
       // Función para agregar los exámenes seleccionados del perfil a la orden
      window.agregarExamenesPerfilSeleccionados = function() {
        var checkboxes = document.querySelectorAll('.perfil-examen-check:checked');
        if (checkboxes.length === 0) {
            alert('Debe seleccionar al menos un examen del perfil.');
            return;
        }

        var modalPerfilEl = document.getElementById('modalPerfil');
        var perfilId = modalPerfilEl ? modalPerfilEl.getAttribute('data-perfil-id') : null;

        var catalogo = window.obtenerCatalogo();
        var catalogoMap = {};
        catalogo.forEach(function(e) { catalogoMap[e.id] = e; });

        var agregados = 0;
        var acumulados = 0;
        checkboxes.forEach(function(chk) {
            var examenId = chk.value;
            var existente = window.examenesOrden.find(function(e) { return e.id === examenId; });
            if (existente) {
                if (perfilId) {
                    if (!existente.perfilesOrigen) existente.perfilesOrigen = [];
                    if (!existente.perfilesOrigen.includes(perfilId)) existente.perfilesOrigen.push(perfilId);
                }
                acumulados++;
                return;
            }

            var datos = null;
            Object.keys(window.App.perfiles).forEach(function(perfilKey) {
                var perfil = window.App.perfiles[perfilKey];
                var encontrado = perfil.examenes.find(function(e) { return e.id === examenId; });
                if (encontrado) datos = encontrado;
            });

            if (!datos) return;
            var override = catalogoMap[datos.id];
            var merged = override ? Object.assign({}, datos, override) : datos;
            window.examenesOrden.push(window.crearExamenDesdeCatalogo(merged, perfilId));
            agregados++;
        });

        if (agregados === 0 && acumulados === 0) {
            alert('Los exámenes seleccionados ya están en la orden o no se pudieron agregar.');
            return;
        }

        if (window.pacienteActivo) {
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
