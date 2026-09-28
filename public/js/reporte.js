(function() {
    'use strict';

    /* El lookup de pacientes, las guardas (sin resultados → #sinResultados) y
       la delegación al renderer viven aquí. Toda la construcción del markup
       de resultados y la clasificación quedan centralizadas en PdfReport
       (pdf.js), que es la única fuente sobre qué exámenes/resultados se cargan
       en el PDF antes de imprimir o descargar. */
    async function initReporte(orden) {
        var ordenNormalizado = String(orden || '').padStart(3, '0');
        var result = await window.api.obtenerPacientePorOrden(ordenNormalizado);
        if (!result.success || !result.paciente) {
            var ordenesDisponibles = 'Ninguna';
            try {
                var res = await window.api.obtenerPacientesCompletos();
                if (res.success) {
                    ordenesDisponibles = res.pacientes.map(function(p) { return '# ' + p.orden + ' - ' + p.nombre; }).join('\n');
                }
            } catch(e) {}
            alert('Paciente no encontrado para la orden: ' + ordenNormalizado + '\n\nÓrdenes disponibles:\n' + (ordenesDisponibles || 'Ninguna'));
            window.location.href = '../index.html';
            return;
        }

        var paciente = result.paciente;
        paciente.examenes = (result.examenes || []).map(function(e) {
            return { id: e.nombre_examen, nombre: e.nombre_examen, resultado: e.resultado || '' };
        });
        // Enriquecer exámenes con datos del catálogo (area, tipo, unidad, referencias)
        paciente.examenes = window.enriquecerExamenesDesdeCatalogo
            ? window.enriquecerExamenesDesdeCatalogo(paciente.examenes)
            : paciente.examenes;
        paciente.id = paciente.id || null;
        paciente.visitas = paciente.visitas || 1;
        paciente.refAdaptadas = paciente.refAdaptadas || false;
        paciente.historial = paciente.historial || [];
        paciente.perfiles = paciente.perfiles || [];
        paciente.telefono = paciente.telefono || '';

        var payload = window.PdfReport.buildPayload(paciente);

        var params = new URLSearchParams(window.location.search);
        var vacio = params.get('vacio') === '1';
        if (vacio || !payload.hayResultados) {
            document.getElementById('area-imprimir').style.display = 'none';
            document.getElementById('sinResultados').style.display = 'block';
        } else {
            document.getElementById('area-imprimir').style.display = 'block';
            document.getElementById('sinResultados').style.display = 'none';
            window.PdfReport.renderDom(payload, document.getElementById('area-imprimir'));
        }
    }

    window.initReporte = initReporte;

})();
