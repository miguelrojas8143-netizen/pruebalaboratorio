(function() {
    'use strict';

    /* El lookup de pacientes, las guardas (sin resultados → #sinResultados) y
       la delegación al renderer viven aquí. Toda la construcción del markup
       de resultados y la clasificación quedan centralizadas en PdfReport
       (pdf.js), que es la única fuente sobre qué exámenes/resultados se cargan
       en el PDF antes de imprimir o descargar. */
    function initReporte(orden) {
        var ordenNormalizado = String(orden || '').padStart(3, '0');
        var pacientes = window.obtenerPacientes();
        var paciente = pacientes.find(function(p) { return p.orden === ordenNormalizado; });
        if (!paciente) {
            var ordenesDisponibles = pacientes.map(function(p) { return '# ' + p.orden + ' - ' + p.nombre; }).join('\n');
            alert('Paciente no encontrado para la orden: ' + ordenNormalizado + '\n\nÓrdenes disponibles:\n' + (ordenesDisponibles || 'Ninguna'));
            window.location.href = '../index.html';
            return;
        }

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
