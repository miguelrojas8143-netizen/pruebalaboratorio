
/**
 * Módulo para gestionar los exámenes de frotis
 * 
 */
(function() {
    'use strict';

    var CANTIDADES = ['', 'Escasos', 'Moderados', 'Abundantes'];

    window.abrirFormularioFrotis = function(examenId) {
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;
        window._frotisEditando = examenId;

        var titulo = document.getElementById('modalFrotisTitulo');
        if (titulo) titulo.textContent = examen.nombre;

        var body = document.getElementById('modalFrotisBody');
        if (!body) return;

        var opciones = examen.opciones || [];
        var resultadoPrevio = {};
        try {
            var parsed = JSON.parse(examen.resultado || '{}');
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                resultadoPrevio = parsed;
            } else if (typeof parsed === 'string') {
                resultadoPrevio[parsed] = '';
            }
        } catch(e) {}

        var html = '';
        opciones.forEach(function(opt, idx) {
            var esNoObservados = opt.toLowerCase().indexOf('no se observaron') !== -1;
            var valorPrevio = resultadoPrevio[opt] || '';
            html += '<div class="mb-2">';
            html += '<div class="form-check">';
            html += '<input type="checkbox" class="form-check-input chk-frotis" id="chkFrotis_' + idx + '" value="' + opt + '" ' + (resultadoPrevio[opt] !== undefined || (esNoObservados && valorPrevio !== '') ? 'checked' : '') + '>';
            html += '<label class="form-check-label text-break" for="chkFrotis_' + idx + '">' + opt + '</label>';
            html += '</div>';
            if (!esNoObservados) {
                var selectOpts = CANTIDADES.map(function(c) {
                    return '<option value="' + c + '" ' + (c === valorPrevio ? 'selected' : '') + '>' + (c === '' ? 'Seleccionar...' : c) + '</option>';
                }).join('');
                html += '<select class="form-select form-select-sm select-frotis ms-4 mt-1" data-opcion="' + opt + '" style="max-width: 200px;">' + selectOpts + '</select>';
            }
            html += '</div>';
        });

        body.innerHTML = html;

        var modalEl = document.getElementById('modalFrotisMultiselect');
        if (modalEl && typeof bootstrap !== 'undefined') {
            var bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
            bsModal.show();
        }
    };

    window.guardarFormularioFrotis = function() {
        var examenId = window._frotisEditando;
        if (!examenId) return;

        var examenes = window.examenesOrden || [];
        var examen = examenes.find(function(e) { return e.id === examenId; });
        if (!examen) return;

        var body = document.getElementById('modalFrotisBody');
        if (!body) return;

        var checkboxes = body.querySelectorAll('.chk-frotis');
        var resultado = {};

        checkboxes.forEach(function(chk) {
            if (chk.checked) {
                var opt = chk.value;
                var select = body.querySelector('.select-frotis[data-opcion="' + opt + '"]');
                if (select) {
                    resultado[opt] = select.value;
                } else {
                    resultado[opt] = '';
                }
            }
        });

        examen.resultado = JSON.stringify(resultado);

        var modalEl = document.getElementById('modalFrotisMultiselect');
        if (modalEl && typeof bootstrap !== 'undefined') {
            var bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }

        window._frotisEditando = null;
        window.renderizarTablaExamenes();
    };

    window.cerrarFormularioFrotis = function() {
        var modalEl = document.getElementById('modalFrotisMultiselect');
        if (modalEl && typeof bootstrap !== 'undefined') {
            var bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
        }
        window._frotisEditando = null;
    };

})();
