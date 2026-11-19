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
            window.Notifications.error('Paciente no encontrado para la orden: ' + ordenNormalizado + '\n\nÓrdenes disponibles:\n' + (ordenesDisponibles || 'Ninguna'));
            window.location.href = '../index.html';
            return;
        }

        var paciente = result.paciente;
        // `examen_id` es el que permite resolver en el catálogo area, tipo y
        // tipoFormulario; sin él un formulario como heces se imprimiría como una
        // fila única con el JSON crudo.
        paciente.examenes = (result.examenes || []).map(function(e) {
            return {
                id: e.examen_id || e.nombre_examen || '',
                nombre: e.nombre_examen || '',
                examen_id: e.examen_id || '',
                resultado: e.resultado || '',
                referencia: e.referencia
            };
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

        if (new URLSearchParams(window.location.search).get('carnet') === 'tipo-sanguineo') {
            var examenABO = paciente.examenes.find(function(examen) {
                return examen.id === 'grupo_sanguineo_abo';
            });
            var examenRh = paciente.examenes.find(function(examen) {
                return examen.id === 'factor_rh';
            });
            if (!examenABO || !examenRh || !examenABO.resultado || !examenRh.resultado) {
                window.Notifications.error('No se puede imprimir el carnet: faltan el grupo sanguíneo o el factor Rh.');
                return;
            }

            document.getElementById('carnetNombrePaciente').textContent = paciente.nombre || '-';
            document.getElementById('carnetCedulaPaciente').textContent = paciente.cedula || '-';
            document.getElementById('carnetEdadPaciente').textContent = paciente.edad || '-';
            document.getElementById('carnetSexoPaciente').textContent = paciente.sexo || '-';
            document.getElementById('carnetResultadoABO').textContent = examenABO.resultado;
            document.getElementById('carnetResultadoRh').textContent = examenRh.resultado;
            document.getElementById('carnetFecha').textContent = new Date().toLocaleDateString('es-VE');
            document.getElementById('area-imprimir').style.display = 'none';
            var botonVistaPrevia = document.getElementById('btnVistaPreviaReporte');
            botonVistaPrevia.innerHTML = '<i class="bi bi-file-earmark-pdf me-1"></i> Vista previa / Guardar carnet PDF';
            botonVistaPrevia.title = 'Vista previa y guardar carnet PDF';
            botonVistaPrevia.setAttribute('aria-label', 'Vista previa y guardar carnet PDF');
            document.getElementById('carnetTipoSanguineo').style.display = 'block';
            document.body.classList.add('modo-carnet-tipo-sanguineo');
            return;
        }

        try {
            var seleccion = window.PdfReport.leerSeleccionExamenes();
            if (seleccion !== null) {
                paciente = window.PdfReport.filtrarExamenesSeleccionados(paciente, seleccion);
            }
        } catch (error) {
            window.Notifications.error(error.message);
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
