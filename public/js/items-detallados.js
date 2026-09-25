
/**
 * Módulo para gestionar los ítems detallados de los exámenes
 * 
 */

(function() {
    'use strict';

    function escaparHtml(valor) {
        return String(valor == null ? '' : valor)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function obtenerReferenciaTexto(item, referenciasGuardadas) {
        if (referenciasGuardadas && referenciasGuardadas[item.id] !== undefined) {
            return referenciasGuardadas[item.id];
        }
        if (item.refTexto !== undefined) return item.refTexto;
        if (item.refMin !== undefined && item.refMax !== undefined) {
            return item.refMin + ' - ' + item.refMax;
        }
        return '';
    }

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
        inicializarCalculosEnVivoModal(body);

        var modalEl = document.getElementById('modalItemsExamen');
        modalEl.setAttribute('data-examen-id', examenId);
        modalEl.setAttribute('data-editor-mode', 'detallado');

        var modal = new bootstrap.Modal(document.getElementById('modalItemsExamen'));
        modal.show();
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
            window.abrirModalItemsExamen(examenId);
            return;
        }

        var modalEl = document.getElementById('modalItemsExamen');
        var body = document.getElementById('modalItemsExamenBody');
        var valor = examen.resultado || '';
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
        body.innerHTML = '<div class="mb-2"><label class="form-label fw-semibold">' + examen.nombre + '</label>' +
            inputHtml + (examen.unidad ? '<small class="text-muted">Unidad: ' + examen.unidad + '</small>' : '') +
            ((examen.refMin !== undefined && examen.refMax !== undefined) ? '<div><small class="text-muted">Referencia: ' + examen.refMin + ' - ' + examen.refMax + '</small></div>' : '') +
            '</div>';
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

    function renderizarItemsDetalladosTabla(items, examenId, valoresGuardados, prefix) {
        prefix = prefix || 'tablaItem_';
        var esHematologia = examenId === 'hematologia_completa';
        var ordenHematologia = [
            'globulos_blancos',
            'neutrofilos_num', 'linfocitos_num', 'eosinofilos_num', 'monocitos_num', 'basofilos_num',
            'neutrofilos_por', 'linfocitos_por', 'eosinofilos_por', 'monocitos_por', 'basofilos_por',
            'plaquetas', 'globulos_rojos', 'hemoglobina', 'hematocrito', 'vcm', 'hcm', 'chcm',
            'rdw_cv', 'vpm', 'pdw', 'plcr', 'vsg'
        ];
        if (esHematologia) {
            items = items.slice().sort(function(a, b) {
                return ordenHematologia.indexOf(a.id) - ordenHematologia.indexOf(b.id);
            });
        }
        var referenciasGuardadas = valoresGuardados.__referencias || {};
        var porGrupo = {};
        items.forEach(function(item) {
            var grupo = esHematologia ? 'Hematología' : (item.grupo || 'General');
            if (!porGrupo[grupo]) porGrupo[grupo] = [];
            porGrupo[grupo].push(item);
        });

        var html = '';
        var esTablaResultados = items.length > 0 && items.every(function(item) {
            return item.tipo !== 'seleccion_unica' && item.tipo !== 'multiselect_cantidad';
        });
        if (esTablaResultados) {
            html += '<div class="items-detallados-cabecera"><span>Parámetro</span><span>Resultado</span><span>Unidad</span><span>Valores de Referencia</span></div>';
        }
        Object.keys(porGrupo).sort().forEach(function(grupo) {
            if (!esHematologia) {
                html += '<h6 class="small fw-bold text-secondary mb-2 mt-3">' + grupo + '</h6>';
            }
            var claseLayout = esHematologia ? ' items-detallados-verticales' : '';
            if (esTablaResultados) claseLayout += ' items-detallados-tabla';
            html += '<div class="row g-3' + claseLayout + '">';
            porGrupo[grupo].forEach(function(item) {
                var inputId = prefix + examenId + '_' + item.id;
                var obligatorio = item.obligatorio ? '<span class="text-danger">*</span>' : '';
                var tipoInput = item.tipo === 'texto' ? 'text' : 'number';
                var step = item.tipo === 'texto' ? '' : 'step="0.01"';
                var valorGuardado = valoresGuardados[item.id] !== undefined ? valoresGuardados[item.id] : '';
                var referenciaTexto = obtenerReferenciaTexto(item, referenciasGuardadas);
                var referenciaInput = '<input type="text" class="form-control form-control-sm referencia-item-input" data-item-id="' + item.id + '" value="' + escaparHtml(referenciaTexto) + '" placeholder="Referencia">';
                var atributoCalculado = item.tipo === 'calculado' ? ' readonly title="Valor calculado automáticamente"' : '';

                var claseNumerica = tipoInput === 'number' ? ' item-input-numerico' : '';
                var unidad = item.unidad || '-';
                var contenidoResultado = '<input type="' + tipoInput + '" class="form-control form-control-sm tabla-item-input' + claseNumerica + '" ' + step + atributoCalculado + ' id="' + inputId + '" data-item-id="' + item.id + '" data-examen-id="' + examenId + '" value="' + valorGuardado + '" placeholder="-">';
                if (esTablaResultados) {
                    html += '<div class="col-md-4 col-sm-6"><label class="form-label small fw-semibold mb-1">' + item.nombre + ' ' + obligatorio + '</label>' + contenidoResultado + '<span class="item-unidad">' + unidad + '</span><span class="item-referencia">' + referenciaInput + '</span></div>';
                } else {
                    html += '<div class="col-md-4 col-sm-6"><label class="form-label small fw-semibold mb-1">' + item.nombre + ' ' + obligatorio + '</label>' + contenidoResultado + '<div class="mt-1">' + referenciaInput + '</div></div>';
                }
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
