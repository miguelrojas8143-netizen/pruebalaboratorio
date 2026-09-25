
/**
 * Módulo para gestionar el formulario de Antibiograma
 */
(function() {
    'use strict';

    window.ANTIBIOTICOS_LISTA = [
        { antibiotico: 'Ampicilina', resultado: 'Resistente', cmi: '> 16 µg/mL' },
        { antibiotico: 'Amoxicilina/Ácido Clavulánico', resultado: 'Sensible', cmi: '4/2 µg/mL' },
        { antibiotico: 'Cefazolina', resultado: 'Sensible', cmi: '≤ 2 µg/mL' },
        { antibiotico: 'Ceftriaxona', resultado: 'Sensible', cmi: '≤ 1 µg/mL' },
        { antibiotico: 'Ciprofloxacina', resultado: 'Resistente', cmi: '> 2 µg/mL' },
        { antibiotico: 'Nitrofurantoína', resultado: 'Sensible', cmi: '≤ 16 µg/mL' },
        { antibiotico: 'Fosfomicina', resultado: 'Sensible', cmi: '≤ 16 µg/mL' },
        { antibiotico: 'Trimetoprima/Sulfametoxazol', resultado: 'Resistente', cmi: '> 4/76 µg/mL' }
    ];

    var OBSERVACIONES_DEFAULT = 'La cepa aislada no es productora de Beta-lactamasas de Espectro Extendido (BLEE negativo). Favor de correlacionar el resultado con el cuadro clínico del paciente.';

    window.abrirFormularioAntibiograma = function(examenId) {
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;
        window._antibiogramaEditando = examenId;

        var form = document.getElementById('formularioAntibiograma');
        if (!form) return;
        form.style.display = 'block';

        var datos = {};
        try { datos = JSON.parse(examen.resultado || '{}'); } catch(e) {}

        var antibioticos = datos.antibioticos || [];
        var observaciones = datos.observaciones || '';

        var tbody = document.getElementById('antibiogramaTablaBody');
        if (!tbody) return;

        var html = '';
        window.ANTIBIOTICOS_LISTA.forEach(function(abx, idx) {
            var existente = antibioticos.find(function(a) { return a.antibiotico === abx.antibiotico; });
            var resultadoSel = existente ? existente.resultado : abx.resultado;
            var cmiVal = existente ? existente.cmi : abx.cmi;

            html += '<tr>';
            html += '<td class="fw-semibold">' + abx.antibiotico + '</td>';
            html += '<td><select class="form-select form-select-sm abx-resultado" data-idx="' + idx + '"><option value="Sensible">Sensible</option><option value="Resistente">Resistente</option><option value="Intermedio">Intermedio</option></select></td>';
            html += '<td><input type="text" class="form-control form-control-sm abx-cmi" data-idx="' + idx + '" value="' + (cmiVal || '') + '"></td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;

        window.ANTIBIOTICOS_LISTA.forEach(function(abx, idx) {
            var existente = antibioticos.find(function(a) { return a.antibiotico === abx.antibiotico; });
            var resultadoSel = existente ? existente.resultado : abx.resultado;
            var select = tbody.querySelector('.abx-resultado[data-idx="' + idx + '"]');
            if (select) {
                var optionToSelect = select.querySelector('option[value="' + resultadoSel + '"]') || select.querySelector('option[value="Sensible"]');
                if (optionToSelect) optionToSelect.selected = true;
            }
        });

        var obsInput = document.getElementById('antibiogramaObservaciones');
        if (obsInput) {
            obsInput.value = observaciones || '';
        }

        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.guardarFormularioAntibiograma = function() {
        var examenId = window._antibiogramaEditando;
        if (!examenId) return;

        var tbody = document.getElementById('antibiogramaTablaBody');
        if (!tbody) return;

        var antibioticos = [];
        window.ANTIBIOTICOS_LISTA.forEach(function(abx, idx) {
            var select = tbody.querySelector('.abx-resultado[data-idx="' + idx + '"]');
            var cmiInput = tbody.querySelector('.abx-cmi[data-idx="' + idx + '"]');
            var resultado = select ? select.value : '';
            var cmi = cmiInput ? cmiInput.value.trim() : '';
            antibioticos.push({
                antibiotico: abx.antibiotico,
                resultado: resultado,
                cmi: cmi
            });
        });

        var obsInput = document.getElementById('antibiogramaObservaciones');
        var observaciones = obsInput ? obsInput.value.trim() : '';

        var datos = {
            antibioticos: antibioticos,
            observaciones: observaciones
        };

        var examenes = window.examenesOrden || [];
        var examen = examenes.find(function(e) { return e.id === examenId; });
        if (examen) {
            examen.resultado = JSON.stringify(datos);
        }

        window._antibiogramaEditando = null;
        window.renderizarTablaExamenes();
        window.cerrarFormularioAntibiograma();
    };

    window.INSERTAR_OBSERVACION_DEFAULT = function() {
        var obsInput = document.getElementById('antibiogramaObservaciones');
        if (!obsInput) return;
        if (obsInput.value.trim() !== '') {
            if (!confirm('Esto reemplazará el texto actual. ¿Continuar?')) return;
        }
        obsInput.value = OBSERVACIONES_DEFAULT;
        obsInput.focus();
    };

    window.cerrarFormularioAntibiograma = function() {
        var form = document.getElementById('formularioAntibiograma');
        if (form) form.style.display = 'none';
        window._antibiogramaEditando = null;
    };

})();
