
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
        return window.abrirModalItemsExamen(examenId);
    };

    function valoresGuardadosDe(examen) {
        var guardados = {};
        try {
            var resultado = typeof examen.resultado === 'string' ? examen.resultado : JSON.stringify(examen.resultado || {});
            if (resultado && resultado.trim().charAt(0) === '{') {
                guardados = JSON.parse(resultado);
            }
        } catch(e) {}
        return guardados;
    }

    /**
     * Abre el modal de ítems detallados dibujando el formulario con los datos
     * que devuelve SQLite (SELECT * FROM parametros_examen WHERE examen_id = ?).
     */
    window.abrirModalItemsExamen = function(examenId) {
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return Promise.resolve();
        var detalle = window.App.examenesDetallados[examenId];
        if (!detalle || !detalle.items || detalle.items.length === 0) return Promise.resolve();

        var modalEl = document.getElementById('modalItemsExamen');
        var body = document.getElementById('modalItemsExamenBody');
        if (!modalEl || !body) return Promise.resolve();

        modalEl.classList.remove('modal-editor-individual');
        document.getElementById('modalItemsExamenTitulo').textContent = detalle.nombre + ' - Ítems Detallados';
        modalEl.setAttribute('data-examen-id', examenId);
        modalEl.setAttribute('data-editor-mode', 'detallado');

        var esHematologia = examenId === 'hematologia_completa';
        var soloResultados = esHematologia || detalle.items.every(function(item) {
            return item.tipo !== 'seleccion_unica' && item.tipo !== 'multiselect_cantidad';
        });

        return window.renderizarParametrosDesdeSQLite(body, examenId, valoresGuardadosDe(examen), {
            prefijo: 'modalItem_',
            agrupar: !esHematologia,
            grupoUnico: esHematologia ? 'Hematología' : null,
            clasesFila: [
                esHematologia && 'items-detallados-verticales',
                soloResultados && 'items-detallados-tabla'
            ].filter(Boolean).join(' '),
            cabecera: soloResultados,
            unidades: soloResultados
        }).then(function() {
            inicializarCalculosEnVivoModal(body);
            new bootstrap.Modal(modalEl).show();
        }).catch(function(error) {
            console.error('[abrirModalItemsExamen] Error:', error);
        });
    };

    function leerDatosModal(examenId) {
        var datos = {};
        var selector = '#modalItemsExamenBody .tabla-item-input[data-examen-id="' + examenId + '"]';
        document.querySelectorAll(selector).forEach(function(input) {
            datos[input.getAttribute('data-item-id')] = input.value.trim();
        });
        var referencias = {};
        document.querySelectorAll('#modalItemsExamenBody .referencia-item-input').forEach(function(input) {
            referencias[input.getAttribute('data-item-id')] = input.value.trim();
        });
        if (Object.keys(referencias).length > 0) datos.__referencias = referencias;
        return datos;
    }

    function actualizarInputsCalculados(examenId) {
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;

        var datos = {};
        try {
            datos = JSON.parse(examen.resultado || '{}');
        } catch (e) {
            return;
        }

        ['neutrofilos_num', 'linfocitos_num', 'eosinofilos_num', 'monocitos_num', 'basofilos_num'].forEach(function(itemId) {
            var input = document.querySelector('#modalItemsExamenBody .tabla-item-input[data-examen-id="' + examenId + '"][data-item-id="' + itemId + '"]');
            if (input) input.value = datos[itemId] || '';
        });
    }

    function inicializarCalculosEnVivoModal(body) {
        if (!body || body.dataset.calculosInicializados === 'true') return;
        body.dataset.calculosInicializados = 'true';
        body.addEventListener('input', function(event) {
            if (!event.target.matches('.tabla-item-input')) return;

            var modalEl = document.getElementById('modalItemsExamen');
            if (!modalEl || modalEl.getAttribute('data-editor-mode') !== 'detallado') return;
            var examenId = modalEl.getAttribute('data-examen-id');
            var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
            if (!examen) return;

            examen.resultado = JSON.stringify(leerDatosModal(examenId));
            examen.tipo = 'perfil';
            if (window.ejecutarCalculosAutomaticos) window.ejecutarCalculosAutomaticos();
            actualizarInputsCalculados(examenId);
        });
    }

    window.abrirEditorResultadoExamen = function(examenId) {
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;

        var detalle = window.App.examenesDetallados[examenId];
        if (detalle && detalle.items && detalle.items.length > 0) {
            return window.abrirModalItemsExamen(examenId);
        }

        var modalEl = document.getElementById('modalItemsExamen');
        var body = document.getElementById('modalItemsExamenBody');
        var valor = examen.resultado || '';
        var examenConReferencias = window.aplicarReferenciasAdaptadas
            ? window.aplicarReferenciasAdaptadas(window.pacienteActivo, [examen])[0]
            : examen;
        var inputHtml;
        if (examen.tipo === 'seleccion_unica' && examen.opciones && examen.opciones.length > 0) {
            inputHtml = '<select class="form-select editor-resultado-input"><option value="">Seleccionar...</option>' +
                examen.opciones.map(function(opcion) {
                    return '<option value="' + opcion + '"' + (valor === opcion ? ' selected' : '') + '>' + opcion + '</option>';
                }).join('') + '</select>';
        } else {
            var tipo = examen.tipo === 'texto' ? 'text' : 'number';
            inputHtml = '<input type="' + tipo + '" step="0.01" class="form-control editor-resultado-input" value="' + valor + '" placeholder="Ingresar resultado">';
        }

        document.getElementById('modalItemsExamenTitulo').textContent = examen.nombre + ' - Resultado';
        var tieneReferencia = examen.refTexto && examen.refTexto !== '-';
        var tieneRango = (examenConReferencias.refMin !== undefined && examenConReferencias.refMin !== null)
            || (examenConReferencias.refMax !== undefined && examenConReferencias.refMax !== null);
        var referencia = tieneReferencia
            ? examen.refTexto
            : tieneRango
                ? (examenConReferencias.refMin !== undefined && examenConReferencias.refMin !== null ? examenConReferencias.refMin : '—')
                    + ' - '
                    + (examenConReferencias.refMax !== undefined && examenConReferencias.refMax !== null ? examenConReferencias.refMax : '—')
                : '';
        body.innerHTML = '<div class="editor-resultado-individual">' +
            '<label class="form-label fw-semibold mb-2">' + examen.nombre + '</label>' +
            inputHtml +
            '<div class="editor-resultado-meta">' +
                (examen.unidad ? '<span class="editor-resultado-unidad">Unidad: <strong>' + examen.unidad + '</strong></span>' : '') +
                (referencia ? '<span class="editor-resultado-referencia"><span class="fw-semibold">Referencia:</span> ' + referencia + '</span>' : '') +
            '</div>' +
            '</div>';
        modalEl.classList.add('modal-editor-individual');
        modalEl.setAttribute('data-examen-id', examenId);
        modalEl.setAttribute('data-editor-mode', 'simple');
        new bootstrap.Modal(modalEl).show();
    };

    window.guardarItemsExamenModal = function() {
        var modalEl = document.getElementById('modalItemsExamen');
        var examenId = modalEl.getAttribute('data-examen-id');
        if (!examenId) return;

        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;

        if (modalEl.getAttribute('data-editor-mode') === 'simple') {
            var inputSimple = document.querySelector('#modalItemsExamenBody .editor-resultado-input');
            examen.resultado = inputSimple ? inputSimple.value.trim() : '';
            window.renderizarTablaExamenes();
            var modalSimple = bootstrap.Modal.getInstance(modalEl);
            if (modalSimple) modalSimple.hide();
            return;
        }

        var inputs = document.querySelectorAll('#modalItemsExamenBody .tabla-item-input');
        var datos = {};
        var referencias = {};

        inputs.forEach(function(input) {
            var itemId = input.getAttribute('data-item-id');
            datos[itemId] = input.value.trim();
        });

        document.querySelectorAll('#modalItemsExamenBody .referencia-item-input').forEach(function(input) {
            referencias[input.getAttribute('data-item-id')] = input.value.trim();
        });
        if (Object.keys(referencias).length > 0) datos.__referencias = referencias;

        examen.resultado = JSON.stringify(datos);
        examen.tipo = 'perfil';
        if (window.ejecutarCalculosAutomaticos) window.ejecutarCalculosAutomaticos();
        window.renderizarTablaExamenes();

        var modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    };

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
        if (window.ejecutarCalculosAutomaticos) window.ejecutarCalculosAutomaticos();
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
