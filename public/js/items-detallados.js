
/**
 * Módulo para gestionar los ítems detallados de los exámenes
 * 
 */

(function() {
    'use strict';

    window.renderizarItemsDetalladosModal = function(items, prefix) {
        var porGrupo = {};
        items.forEach(function(item) {
            var grupo = item.grupo || 'General';
            if (!porGrupo[grupo]) porGrupo[grupo] = [];
            porGrupo[grupo].push(item);
        });

        var html = '';
        Object.keys(porGrupo).sort().forEach(function(grupo) {
            html += '<h6 class="small fw-bold text-primary mb-2 mt-2">' + grupo + '</h6>';
            html += '<div class="row g-2">';
            porGrupo[grupo].forEach(function(item) {
                var inputId = prefix + '_' + item.id;
                var obligatorio = item.obligatorio ? '<span class="text-danger">*</span>' : '';
                var tipoInput = item.tipo === 'texto' ? 'text' : 'number';
                var step = item.tipo === 'texto' ? '' : 'step="0.01"';
                var refTexto = (item.refMin !== undefined && item.refMax !== undefined && (item.refMin || item.refMax)) ? '<small class="text-muted">Ref: ' + item.refMin + ' - ' + item.refMax + '</small>' : '';

                html += '<div class="col-md-4 col-sm-6"><label class="form-label small fw-semibold mb-1">' + item.nombre + ' ' + obligatorio + '</label><input type="' + tipoInput + '" class="form-control form-control-sm perfil-item-input" ' + step + ' id="' + inputId + '" data-item-id="' + item.id + '" placeholder="Ingresar valor"><div class="mt-1">' + refTexto + '</div></div>';
            });
            html += '</div>';
        });
        return html;
    };

    window.toggleItemsExamenTabla = function(examenId) {
        window.abrirModalItemsExamen(examenId);
    };

    window.abrirModalItemsExamen = function(examenId) {
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;
        var detalle = window.App.examenesDetallados[examenId];
        if (!detalle || !detalle.items || detalle.items.length === 0) return;

        document.getElementById('modalItemsExamenTitulo').textContent = detalle.nombre + ' - Ítems Detallados';

        var valoresGuardados = {};
        try {
            var resultado = typeof examen.resultado === 'string' ? examen.resultado : JSON.stringify(examen.resultado || {});
            if (resultado && resultado.trim().startsWith('{')) {
                valoresGuardados = JSON.parse(resultado);
            }
        } catch(e) {}

        var body = document.getElementById('modalItemsExamenBody');
        body.innerHTML = renderizarItemsDetalladosTabla(detalle.items, examenId, valoresGuardados, 'modalItem_');

        var modalEl = document.getElementById('modalItemsExamen');
        modalEl.setAttribute('data-examen-id', examenId);

        var modal = new bootstrap.Modal(document.getElementById('modalItemsExamen'));
        modal.show();
    };

    window.guardarItemsExamenModal = function() {
        var examenId = document.getElementById('modalItemsExamen').getAttribute('data-examen-id');
        if (!examenId) return;

        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;

        var inputs = document.querySelectorAll('#modalItemsExamenBody .tabla-item-input');
        var datos = {};

        inputs.forEach(function(input) {
            var itemId = input.getAttribute('data-item-id');
            datos[itemId] = input.value.trim();
        });

        examen.resultado = JSON.stringify(datos);
        examen.tipo = 'perfil';
        window.renderizarTablaExamenes();

        var modalEl = document.getElementById('modalItemsExamen');
        var modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    };

    function renderizarItemsDetalladosTabla(items, examenId, valoresGuardados, prefix) {
        prefix = prefix || 'tablaItem_';
        var porGrupo = {};
        items.forEach(function(item) {
            var grupo = item.grupo || 'General';
            if (!porGrupo[grupo]) porGrupo[grupo] = [];
            porGrupo[grupo].push(item);
        });

        var html = '';
        Object.keys(porGrupo).sort().forEach(function(grupo) {
            html += '<h6 class="small fw-bold text-secondary mb-2 mt-3">' + grupo + '</h6>';
            html += '<div class="row g-3">';
            porGrupo[grupo].forEach(function(item) {
                var inputId = prefix + examenId + '_' + item.id;
                var obligatorio = item.obligatorio ? '<span class="text-danger">*</span>' : '';
                var tipoInput = item.tipo === 'texto' ? 'text' : 'number';
                var step = item.tipo === 'texto' ? '' : 'step="0.01"';
                var valorGuardado = valoresGuardados[item.id] !== undefined ? valoresGuardados[item.id] : '';
                var refTexto = (item.refMin !== undefined && item.refMax !== undefined && (item.refMin || item.refMax)) ? '<small class="text-muted">Ref: ' + item.refMin + ' - ' + item.refMax + '</small>' : '';

                html += '<div class="col-md-4 col-sm-6"><label class="form-label small fw-semibold mb-1">' + item.nombre + ' ' + obligatorio + '</label><input type="' + tipoInput + '" class="form-control form-control-sm tabla-item-input" ' + step + ' id="' + inputId + '" data-item-id="' + item.id + '" data-examen-id="' + examenId + '" value="' + valorGuardado + '" placeholder="Ingresar valor"><div class="mt-1">' + refTexto + '</div></div>';
            });
            html += '</div>';
        });
        return html;
    }
    window.guardarItemsExamen = function(examenId) {
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;

        var inputs = document.querySelectorAll('.tabla-item-input[data-examen-id="' + examenId + '"]');
        var datos = {};

        inputs.forEach(function(input) {
            var itemId = input.getAttribute('data-item-id');
            datos[itemId] = input.value.trim();
        });

        examen.resultado = JSON.stringify(datos);
        examen.tipo = 'perfil';
        window.renderizarTablaExamenes();
    };

    window.validarItemsObligatoriosPerfil = function() {
        var examenes = window.examenesOrden || [];
        var camposFaltantes = [];

        examenes.forEach(function(examen) {
            if (examen.tipo !== 'perfil') return;
            var detalle = window.App.examenesDetallados[examen.id];
            if (!detalle || !detalle.items) return;

            var datos = {};
            try {
                datos = JSON.parse(examen.resultado || '{}');
            } catch(e) {}

            detalle.items.forEach(function(item) {
                if (item.obligatorio && !datos[item.id]) {
                    camposFaltantes.push(item.nombre + ' (' + examen.nombre + ')');
                }
            });
        });

        return camposFaltantes;
    };

})();
