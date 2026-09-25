/**
 * Módulo para gestionar la vista de historial de órdenes de pacientes.
 * - Muestra pacientes con órden actual y órdenes anteriores archivadas en acordeón colapsable
 * - Filtra por nombre, cédula u orden
 * - Permite imprimir/descargar cada orden histórica como PDF
 */
(function() {
    'use strict';

    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function tieneResultadosOrden(examenes) {
        if (!examenes || examenes.length === 0) return false;
        return examenes.some(function(e) {
            if (e.tipoFormulario === 'heces' || e.tipoFormulario === 'uroanalisis' || e.tipoFormulario === 'antibiograma' || e.tipo === 'multiselect_cantidad') {
                try {
                    var datos = JSON.parse(e.resultado || '{}');
                    return Object.keys(datos).length > 0 && Object.values(datos).some(function(v) { return v !== ''; });
                } catch(err) { return false; }
            }
            return String(e.resultado || '').trim() !== '';
        });
    }

    function formatearResultado(examen) {
        if (!examen.resultado) return '-';
        var resultado = '-';
        try {
            if (examen.tipoFormulario === 'antibiograma') {
                var datosAb = JSON.parse(examen.resultado || '{}');
                var abx = datosAb.antibioticos || [];
                var abxConDatos = abx.filter(function(a) { return a.resultado || a.cmi; });
                if (abxConDatos.length > 0) {
                    var resistentes = abxConDatos.filter(function(a) { return a.resultado === 'Resistente'; });
                    if (resistentes.length > 0) {
                        resultado = 'Resistentes: ' + resistentes.map(function(a) { return a.antibiotico; }).join(', ');
                    } else {
                        resultado = abxConDatos.length + ' antibióticos configurados';
                    }
                }
            } else if (examen.tipoFormulario === 'heces' || examen.tipoFormulario === 'uroanalisis' || examen.tipo === 'multiselect_cantidad') {
                var datos = JSON.parse(examen.resultado || '{}');
                var keys = Object.keys(datos).filter(function(k) { return datos[k] !== ''; });
                if (keys.length > 0) {
                    resultado = keys.map(function(k) { return datos[k]; }).join(', ');
                }
            } else {
                resultado = examen.resultado;
            }
        } catch(err) {
            resultado = examen.resultado || '-';
        }
        return resultado;
    }

    function renderizarPacientes(pacientes, forzarTodos) {
        var contenedor = document.getElementById('contenedorHistorial');
        if (!contenedor) return;

        pacientes = pacientes || [];
        var pacientesAMostrar = pacientes.filter(function(p) {
            return forzarTodos || (p.ordenesPrevias && p.ordenesPrevias.length > 0);
        });

        if (pacientesAMostrar.length === 0) {
            contenedor.innerHTML = '<div class="text-center py-5"><i class="bi bi-inbox display-4 text-muted mb-3 d-block"></i><h5 class="text-muted">No hay órdenes anteriores archivadas.</h5><p class="text-muted">Los pacientes con órdenes previas aparecerán aquí.</p></div>';
            return;
        }

        var html = '';
        pacientesAMostrar.forEach(function(paciente, pIndex) {
            var ordenesPrevias = (paciente.ordenesPrevias || []);
            var ordenesAnterioresDisplay = ordenesPrevias.slice().reverse();
            var totalOrdenes = ordenesAnterioresDisplay.length + 1;
            var totalVisitas = paciente.visitas || 1;

            html += '<div class="card shadow-sm mb-3">';
            html += '<div class="card-header" style="background-color: #0d6efd;">';
            html += '<div class="d-flex justify-content-between align-items-center">';
            html += '<div><strong>' + escapeHtml(paciente.nombre) + '</strong></div>';
            html += '<span class="badge bg-light text-primary">' + totalOrdenes + ' órden(es) | ' + totalVisitas + ' visitas</span>';
            html += '</div>';
            html += '<div class="d-flex flex-wrap gap-2 mt-1 small text-white-50">';
            html += '<span><i class="bi bi-card-text me-1"></i> Cédula: ' + escapeHtml(paciente.cedula || 'N/A') + '</span>';
            html += '<span><i class="bi bi-person me-1"></i> Sexo: ' + (paciente.sexo === 'M' ? 'Masculino' : (paciente.sexo === 'F' ? 'Femenino' : 'N/A')) + '</span>';
            html += '<span><i class="bi bi-cake2 me-1"></i> Edad: ' + (paciente.edad ? paciente.edad + ' años' : 'N/A') + '</span>';
            html += '<span><i class="bi bi-telephone me-1"></i> Tel: ' + escapeHtml(paciente.telefono || 'N/A') + '</span>';
            html += '</div>';
            html += '</div>';

            html += '<div class="card-body">';

            var activeOrden = String(paciente.orden || '').padStart(3, '0');
            var activeFecha = paciente.fechaRegistro || new Date().toLocaleDateString('es-ES');
            var activeExamenes = paciente.examenes || [];
            var activeTieneRes = tieneResultadosOrden(activeExamenes);
            var activeTotalExamenes = activeExamenes.length;

            var estadoActivoClass = 'bg-warning text-dark';
            var estadoActivoTexto = 'Sin resultados';
            if (activeTieneRes) {
                estadoActivoClass = 'bg-success';
                estadoActivoTexto = 'Con resultados';
            } else if (activeTotalExamenes > 0) {
                estadoActivoClass = 'bg-info text-dark';
                estadoActivoTexto = 'En proceso';
            }

            html += '<div class="card mb-2 shadow-sm orden-actual-card border-success">';
            html += '<div class="card-header d-flex justify-content-between align-items-center" style="background-color: #f8f9fa; cursor: pointer;">';
            html += '<div class="d-flex align-items-center">';
            html += '<i class="bi bi-chevron-right me-2 collapse-icon"></i>';
            html += '<div><strong>Orden #' + escapeHtml(activeOrden) + '</strong> <span class="text-muted small">- ' + escapeHtml(activeFecha) + '</span></div>';
            html += '</div>';
            html += '<div class="d-flex align-items-center gap-2">';
            html += '<span class="badge bg-success">Orden actual</span>';
            html += '<span class="badge ' + estadoActivoClass + '">' + estadoActivoTexto + '</span>';
            html += '<span class="badge bg-light text-muted small">' + activeTotalExamenes + ' exámenes</span>';
            html += '<button type="button" class="btn btn-sm btn-outline-success" onclick="window.imprimirOrdenPaciente(' + paciente.id + ', -1)" title="Imprimir orden actual"><i class="bi bi-printer"></i></button>';
            html += '</div>';
            html += '</div>';
            html += '<div class="card-body">';
            if (activeTotalExamenes > 0) {
                html += '<div class="table-responsive"><table class="table table-sm table-bordered mb-0">';
                html += '<thead class="table-light"><tr><th>Examen</th><th>Resultado</th><th>Unidad</th><th>Valor Ref.</th></tr></thead>';
                html += '<tbody>';
                activeExamenes.forEach(function(e) {
                    var refTexto = e.refTexto || ((e.refMin !== undefined && e.refMax !== undefined && (e.refMin || e.refMax)) ? e.refMin + ' - ' + e.refMax : '-');
                    html += '<tr>';
                    html += '<td>' + escapeHtml(e.nombre || e.id || '-') + '</td>';
                    html += '<td>' + escapeHtml(formatearResultado(e)) + '</td>';
                    html += '<td>' + escapeHtml(e.unidad || '-') + '</td>';
                    html += '<td>' + escapeHtml(refTexto || '-') + '</td>';
                    html += '</tr>';
                });
                html += '</tbody></table></div>';
            } else {
                html += '<p class="text-muted mb-0">Sin exámenes registrados.</p>';
            }
            html += '</div>';
            html += '</div>';

            ordenesAnterioresDisplay.forEach(function(ord, reversedIndex) {
                var originalIndex = ordenesPrevias.length - 1 - reversedIndex;
                var idUnico = 'ord_' + pIndex + '_' + reversedIndex;
                var tieneRes = tieneResultadosOrden(ord.examenes);
                var estadoClass = 'bg-warning text-dark';
                var estadoTexto = 'Sin resultados';
                if (tieneRes) {
                    estadoClass = 'bg-success';
                    estadoTexto = 'Con resultados';
                } else if (ord.examenes && ord.examenes.length > 0) {
                    estadoClass = 'bg-info text-dark';
                    estadoTexto = 'En proceso';
                }

                var totalExamenes = (ord.examenes || []).length;

                html += '<div class="card mb-2 border-0 orden-anterior-card">';
                html += '<div class="card-header d-flex justify-content-between align-items-center" style="background-color: #f8f9fa; cursor: pointer;" data-bs-toggle="collapse" data-bs-target="#' + idUnico + '" role="button">';
                html += '<div class="d-flex align-items-center">';
                html += '<i class="bi bi-chevron-right me-2 collapse-icon"></i>';
                html += '<div><strong>Orden #' + escapeHtml(ord.orden) + '</strong> <span class="text-muted small">- ' + escapeHtml(ord.fecha || 'N/A') + '</span></div>';
                html += '</div>';
                html += '<div class="d-flex align-items-center gap-2">';
                html += '<span class="badge ' + estadoClass + '">' + estadoTexto + '</span>';
                html += '<span class="badge bg-light text-muted small">' + totalExamenes + ' exámenes</span>';
                html += '<button type="button" class="btn btn-sm btn-outline-success" onclick="window.imprimirOrdenPaciente(' + paciente.id + ', ' + originalIndex + ')" title="Imprimir orden"><i class="bi bi-printer"></i></button>';
                html += '</div>';
                html += '</div>';
                html += '<div class="collapse" id="' + idUnico + '">';
                html += '<div class="card-body">';
                if (totalExamenes > 0) {
                    html += '<div class="table-responsive"><table class="table table-sm table-bordered mb-0">';
                    html += '<thead class="table-light"><tr><th>Examen</th><th>Resultado</th><th>Unidad</th><th>Valor Ref.</th></tr></thead>';
                    html += '<tbody>';
                    ord.examenes.forEach(function(e) {
                        var refTexto = e.refTexto || ((e.refMin !== undefined && e.refMax !== undefined && (e.refMin || e.refMax)) ? e.refMin + ' - ' + e.refMax : '-');
                        html += '<tr>';
                        html += '<td>' + escapeHtml(e.nombre || e.id || '-') + '</td>';
                        html += '<td>' + escapeHtml(formatearResultado(e)) + '</td>';
                        html += '<td>' + escapeHtml(e.unidad || '-') + '</td>';
                        html += '<td>' + escapeHtml(refTexto || '-') + '</td>';
                        html += '</tr>';
                    });
                    html += '</tbody></table></div>';
                } else {
                    html += '<p class="text-muted mb-0">Sin exámenes registrados.</p>';
                }
                html += '</div>';
                html += '</div>';
                html += '</div>';
            });

            html += '</div>';
            html += '</div>';
        });

        contenedor.innerHTML = html;
    }

    window.imprimirOrdenPaciente = async function(pacienteId, ordenIndex) {
        var pacientes = window.obtenerPacientes();
        var paciente = pacientes.find(function(p) { return p.id === pacienteId; });
        if (!paciente) {
            alert('Paciente no encontrado.');
            return;
        }

        var pacienteModificado;
        if (ordenIndex === -1) {
            pacienteModificado = {
                nombre: paciente.nombre,
                cedula: paciente.cedula,
                edad: paciente.edad,
                sexo: paciente.sexo,
                telefono: paciente.telefono,
                orden: String(paciente.orden || '').padStart(3, '0'),
                examenes: paciente.examenes || [],
                refAdaptadas: !!paciente.refAdaptadas,
                perfiles: paciente.perfiles || []
            };
        } else {
            if (!paciente.ordenesPrevias || !paciente.ordenesPrevias[ordenIndex]) {
                alert('Orden no encontrada.');
                return;
            }
            var ordenAnterior = paciente.ordenesPrevias[ordenIndex];
            pacienteModificado = {
                nombre: paciente.nombre,
                cedula: paciente.cedula,
                edad: paciente.edad,
                sexo: paciente.sexo,
                telefono: paciente.telefono,
                orden: ordenAnterior.orden,
                examenes: ordenAnterior.examenes || [],
                refAdaptadas: ordenAnterior.refAdaptadas || false,
                perfiles: ordenAnterior.perfiles || []
            };
        }

        if (window.PdfReport && window.PdfReport.buildPayload) {
            var payload = window.PdfReport.buildPayload(pacienteModificado);
            if (payload.hayResultados) {
                var nombreArchivo = ordenIndex === -1
                    ? 'orden_actual_' + paciente.nombre
                    : 'orden_' + pacienteModificado.orden + '_' + paciente.nombre;
                await window.PdfReport.generarDesdePayload(payload, 'imprimir', nombreArchivo);
            } else {
                alert('Esta orden no tiene resultados registrados para imprimir.');
            }
        } else {
            alert('No se pudo cargar el generador PDF.');
        }
    };

    window.imprimirOrdenAnterior = window.imprimirOrdenPaciente;

    window.initHistorial = function() {
        var pacientes = window.obtenerPacientes();
        var params = new URLSearchParams(window.location.search);

        var idParam = params.get('id');
        var forzarTodos = !!idParam;
        if (idParam) {
            pacientes = pacientes.filter(function(p) {
                return String(p.id) === idParam;
            });
        }

        renderizarPacientes(pacientes, forzarTodos);

        var buscador = document.getElementById('buscadorHistorial');
        if (buscador) {
            buscador.addEventListener('input', function() {
                var termino = this.value.toLowerCase();
                if (!termino || termino.length < 1) {
                    renderizarPacientes(pacientes, forzarTodos);
                    return;
                }
                var filtrados = pacientes.filter(function(p) {
                    return (p.nombre && p.nombre.toLowerCase().includes(termino)) ||
                           (p.cedula && p.cedula.includes(termino)) ||
                           (p.ordenesPrevias && p.ordenesPrevias.some(function(o) { return o.orden && String(o.orden).includes(termino); })) ||
                           (p.orden && String(p.orden).includes(termino));
                });
                renderizarPacientes(filtrados, forzarTodos);
            });
        }
    };

    window.limpiarBusquedaHistorial = function() {
        var buscador = document.getElementById('buscadorHistorial');
        if (buscador) {
            buscador.value = '';
            window.initHistorial();
        }
    };

    window.renderizarPacientes = renderizarPacientes;

})();