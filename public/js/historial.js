/**
 * Módulo para gestionar la vista de historial de órdenes de pacientes.
 * - Muestra pacientes con orden actual y órdenes anteriores en una lista compacta
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
        return examenes.some(window.examenTieneResultados);
    }

    var examenReimpresionActual = null;
    var pacienteReimpresionActual = null;
    var modalReimpresion = null;
    var registrosHistorial = [];
    var paginaHistorial = 1;
    var limiteHistorial = 10;
    var fechaFiltroHistorial = '';

    function normalizarFecha(fecha) {
        if (!fecha) return '';
        var valor = String(fecha).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
        var partes = valor.split(/[\/\-]/);
        if (partes.length === 3) {
            var dia = partes[0].padStart(2, '0');
            var mes = partes[1].padStart(2, '0');
            var anio = partes[2];
            if (anio.length === 2) anio = '20' + anio;
            if (/^\d{4}$/.test(anio)) return anio + '-' + mes + '-' + dia;
        }
        return valor;
    }

    function actualizarPaginacionHistorial(totalPaginas) {
        var paginaEl = document.getElementById('paginaActualHistorial');
        var anterior = document.getElementById('btnAnteriorHistorial');
        var siguiente = document.getElementById('btnSiguienteHistorial');
        if (paginaEl) paginaEl.textContent = paginaHistorial;
        if (anterior) anterior.disabled = paginaHistorial <= 1;
        if (siguiente) siguiente.disabled = paginaHistorial >= totalPaginas;
    }

    function renderizarPaginaHistorial() {
        var cuerpo = document.getElementById('tablaHistorial');
        var total = document.getElementById('totalOrdenesHistorial');
        if (!cuerpo) return;

        var totalPaginas = Math.max(1, Math.ceil(registrosHistorial.length / limiteHistorial));
        paginaHistorial = Math.min(Math.max(1, paginaHistorial), totalPaginas);
        actualizarPaginacionHistorial(totalPaginas);
        if (total) total.textContent = registrosHistorial.length + ' órdenes';

        if (registrosHistorial.length === 0) {
            cuerpo.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No se encontraron órdenes.</td></tr>';
            return;
        }

        var inicio = (paginaHistorial - 1) * limiteHistorial;
        cuerpo.innerHTML = registrosHistorial.slice(inicio, inicio + limiteHistorial).map(function(registro) {
            return '<tr>' +
                '<td class="text-center"><span class="badge bg-primary badge-orden">#' + escapeHtml(registro.orden) + '</span></td>' +
                '<td class="fw-semibold">' + escapeHtml(registro.paciente.nombre || 'Sin nombre') +
                    (registro.esActual ? '<span class="badge bg-success ms-2">Actual</span>' : '') + '</td>' +
                '<td>' + (registro.paciente.cedula ? escapeHtml(registro.paciente.cedula) : '<span class="text-muted">N/A</span>') + '</td>' +
                '<td>' + escapeHtml(registro.fecha || '-') + '</td>' +
                '<td class="text-center">' + (registro.paciente.visitas || 1) + '</td>' +
                '<td class="text-center"><span class="badge ' + registro.estado.clase + '">' + registro.estado.texto + '</span></td>' +
                '<td class="text-center"><button type="button" class="btn btn-sm btn-outline-success historial-imprimir-btn" ' +
                    'onclick="window.imprimirOrdenPaciente(' + registro.paciente.id + ', ' + registro.ordenIndex + ')" ' +
                    'title="Seleccionar exámenes para imprimir" aria-label="Seleccionar exámenes para imprimir">' +
                    '<i class="bi bi-printer"></i></button></td>' +
                '</tr>';
        }).join('');
    }

    function configurarPaginacionHistorial() {
        var anterior = document.getElementById('btnAnteriorHistorial');
        var siguiente = document.getElementById('btnSiguienteHistorial');
        if (anterior && anterior.dataset.historialListo !== 'true') {
            anterior.dataset.historialListo = 'true';
            anterior.addEventListener('click', function() {
                paginaHistorial -= 1;
                renderizarPaginaHistorial();
            });
        }
        if (siguiente && siguiente.dataset.historialListo !== 'true') {
            siguiente.dataset.historialListo = 'true';
            siguiente.addEventListener('click', function() {
                paginaHistorial += 1;
                renderizarPaginaHistorial();
            });
        }
    }

    function notificarError(mensaje) {
        if (window.Notifications && window.Notifications.error) {
            window.Notifications.error(mensaje);
        } else {
            alert(mensaje);
        }
    }

    function actualizarContadorReimpresion() {
        var lista = document.getElementById('listaExamenesReimpresion');
        var contador = document.getElementById('contadorExamenesReimpresion');
        if (!lista || !contador) return;
        var seleccionados = lista.querySelectorAll('input[type="checkbox"]:checked').length;
        var disponibles = lista.querySelectorAll('input[type="checkbox"]:not(:disabled)').length;
        contador.textContent = 'Seleccionados: ' + seleccionados + ' de ' + disponibles;
    }

    function crearModalReimpresion() {
        var elemento = document.createElement('div');
        elemento.className = 'modal fade';
        elemento.id = 'modalReimpresionExamenes';
        elemento.tabIndex = -1;
        elemento.setAttribute('aria-labelledby', 'tituloModalReimpresion');
        elemento.setAttribute('aria-hidden', 'true');
        elemento.innerHTML =
            '<div class="modal-dialog modal-dialog-centered">' +
                '<div class="modal-content">' +
                    '<div class="modal-header">' +
                        '<h5 class="modal-title" id="tituloModalReimpresion">Seleccionar exámenes para reimprimir</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>' +
                    '</div>' +
                    '<div class="modal-body">' +
                        '<p class="text-muted">Marque únicamente los exámenes que necesita volver a imprimir. Los resultados guardados no se modificarán.</p>' +
                        '<div class="d-flex gap-2 mb-2">' +
                            '<button type="button" class="btn btn-sm btn-outline-primary" id="seleccionarTodosReimpresion" title="Seleccionar todos" aria-label="Seleccionar todos"><i class="bi bi-check2-all" aria-hidden="true"></i></button>' +
                            '<button type="button" class="btn btn-sm btn-outline-secondary" id="deseleccionarTodosReimpresion" title="Deseleccionar todos" aria-label="Deseleccionar todos"><i class="bi bi-x-square" aria-hidden="true"></i></button>' +
                        '</div>' +
                        '<div id="listaExamenesReimpresion" class="list-group"></div>' +
                        '<div id="contadorExamenesReimpresion" class="small text-muted mt-2"></div>' +
                    '</div>' +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" title="Cancelar" aria-label="Cancelar"><i class="bi bi-x-lg" aria-hidden="true"></i></button>' +
                        '<button type="button" class="btn btn-success" id="confirmarReimpresion" title="Reimprimir seleccionados" aria-label="Reimprimir seleccionados"><i class="bi bi-printer" aria-hidden="true"></i></button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(elemento);
        modalReimpresion = window.bootstrap.Modal.getOrCreateInstance(elemento);

        elemento.querySelector('#seleccionarTodosReimpresion').addEventListener('click', function() {
            elemento.querySelectorAll('#listaExamenesReimpresion input:not(:disabled)').forEach(function(input) {
                input.checked = true;
            });
            actualizarContadorReimpresion();
        });
        elemento.querySelector('#deseleccionarTodosReimpresion').addEventListener('click', function() {
            elemento.querySelectorAll('#listaExamenesReimpresion input').forEach(function(input) {
                input.checked = false;
            });
            actualizarContadorReimpresion();
        });
        elemento.querySelector('#confirmarReimpresion').addEventListener('click', async function() {
            var lista = elemento.querySelector('#listaExamenesReimpresion');
            var indices = Array.prototype.map.call(
                lista.querySelectorAll('input[type="checkbox"]:checked'),
                function(input) { return Number(input.value); }
            );
            if (indices.length === 0) {
                notificarError('Seleccione al menos un examen con resultados para reimprimir.');
                return;
            }

            var pacienteSeleccionado = Object.assign({}, pacienteReimpresionActual, {
                examenes: indices.map(function(indice) { return examenReimpresionActual[indice]; })
            });
            var payload = window.PdfReport.buildPayload(pacienteSeleccionado);
            if (!payload.hayResultados) {
                notificarError('Los exámenes seleccionados no tienen resultados registrados para imprimir.');
                return;
            }

            modalReimpresion.hide();
            var nombreArchivo = 'orden_' + pacienteSeleccionado.orden + '_' + pacienteSeleccionado.nombre;
            try {
                await window.PdfReport.generarDesdePayload(payload, 'imprimir', nombreArchivo);
            } catch (error) {
                console.error('[reimpresion] Error generando PDF:', error);
                notificarError('No se pudo generar la reimpresión: ' + error.message);
            }
        });
        return elemento;
    }

    function abrirSelectorReimpresion(paciente) {
        if (!window.PdfReport || !window.PdfReport.buildPayload ||
            !window.bootstrap || !window.bootstrap.Modal) {
            notificarError('No se pudo cargar el selector de reimpresión.');
            return;
        }

        var examenes = paciente.examenes || [];
        if (!examenes.length) {
            notificarError('Esta orden no tiene exámenes registrados.');
            return;
        }
        if (!examenes.some(window.examenTieneResultados)) {
            notificarError('Esta orden no tiene resultados registrados para imprimir.');
            return;
        }

        examenReimpresionActual = examenes;
        pacienteReimpresionActual = paciente;
        var elemento = document.getElementById('modalReimpresionExamenes') || crearModalReimpresion();
        var lista = elemento.querySelector('#listaExamenesReimpresion');
        var titulo = elemento.querySelector('#tituloModalReimpresion');
        lista.replaceChildren();
        titulo.textContent = 'Seleccionar exámenes para reimprimir · Orden #' + paciente.orden;

        examenes.forEach(function(examen, indice) {
            var tieneResultado = window.examenTieneResultados(examen);
            var etiqueta = document.createElement('label');
            etiqueta.className = 'list-group-item d-flex align-items-center gap-2';
            var casilla = document.createElement('input');
            casilla.type = 'checkbox';
            casilla.className = 'form-check-input mt-0';
            casilla.value = String(indice);
            casilla.checked = false;
            casilla.disabled = !tieneResultado;
            casilla.addEventListener('change', actualizarContadorReimpresion);

            var detalle = document.createElement('span');
            detalle.className = 'flex-grow-1';
            var nombre = document.createElement('span');
            nombre.className = 'fw-semibold d-block';
            nombre.textContent = examen.nombre || examen.id || 'Examen sin nombre';
            detalle.appendChild(nombre);
            if (examen.area || !tieneResultado) {
                var nota = document.createElement('small');
                nota.className = 'text-muted';
                nota.textContent = !tieneResultado
                    ? 'Sin resultados: no disponible para reimpresión'
                    : examen.area;
                detalle.appendChild(nota);
            }
            etiqueta.appendChild(casilla);
            etiqueta.appendChild(detalle);
            lista.appendChild(etiqueta);
        });
        actualizarContadorReimpresion();
        modalReimpresion.show();
    }

    function normalizarTexto(texto) {
        return String(texto == null ? '' : texto).trim().toLowerCase();
    }

    function coincideIncremental(valor, termino) {
        if (!termino) return true;
        var texto = normalizarTexto(valor);
        if (!texto) return false;
        if (texto.indexOf(termino) === 0) return true;
        return texto.split(/\s+/).some(function(parte) {
            return parte.indexOf(termino) === 0;
        });
    }

    function renderizarPacientes(pacientes, forzarTodos, termino, fechaFiltro) {
        var busqueda = normalizarTexto(termino);
        var fechaObjetivo = String(fechaFiltro || '').trim();
        registrosHistorial = [];
        (pacientes || []).forEach(function(paciente) {
            var ordenesPrevias = (paciente.ordenesPrevias || []);
            var ordenesAnterioresDisplay = ordenesPrevias.slice().reverse();
            var activeOrden = String(paciente.orden || '').padStart(3, '0');
            var activeFecha = paciente.fechaRegistro || new Date().toLocaleDateString('es-ES');
            var activeExamenes = paciente.examenes || [];
            var coincidePaciente = !busqueda ||
                coincideIncremental(paciente.nombre, busqueda) ||
                coincideIncremental(paciente.cedula, busqueda);

            function agregarRegistro(orden, fecha, examenes, ordenIndex, esActual) {
                if (!forzarTodos && !ordenesPrevias.length) return;
                if (!coincidePaciente && !coincideIncremental(orden, busqueda)) return;
                if (fechaObjetivo && normalizarFecha(fecha) !== fechaObjetivo) return;
                var tieneResultado = tieneResultadosOrden(examenes);
                registrosHistorial.push({
                    paciente: paciente,
                    orden: orden,
                    fecha: fecha,
                    examenes: examenes,
                    ordenIndex: ordenIndex,
                    esActual: esActual,
                    estado: {
                        clase: tieneResultado ? 'bg-success' : (examenes.length ? 'bg-info text-dark' : 'bg-warning text-dark'),
                        texto: tieneResultado ? 'Con resultados' : (examenes.length ? 'En proceso' : 'Sin resultados')
                    }
                });
            }

            agregarRegistro(activeOrden, activeFecha, activeExamenes, -1, true);
            ordenesAnterioresDisplay.forEach(function(orden, indice) {
                var originalIndex = ordenesPrevias.length - 1 - indice;
                agregarRegistro(orden.orden, orden.fecha || 'N/A', orden.examenes || [], originalIndex, false);
            });
        });
        registrosHistorial.sort(function(a, b) {
            return parseInt(a.orden, 10) - parseInt(b.orden, 10);
        });
        paginaHistorial = 1;
        renderizarPaginaHistorial();
    }

    // MIGRADO A SQLITE: línea ~207 — usa window.api.obtenerPacientesCompletos()
    // en lugar de window.obtenerPacientes() (IndexedDB)
    window.imprimirOrdenPaciente = async function(pacienteId, ordenIndex) {
        var resp = await window.api.obtenerPacientesCompletos();
        var pacientes = resp.success ? resp.pacientes : [];
        var paciente = pacientes.find(function(p) {
            return String(p.id) === String(pacienteId);
        });
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
            // LÍNEA ~229: Migrado — ordenes previas desde SQLite tabla ordenes_archivadas
            var respArch = await window.api.obtenerOrdenesArchivadas({ pacienteId: pacienteId });
            var ordenesPrevias = respArch.success ? respArch.ordenes : [];
            if (!ordenesPrevias[ordenIndex]) {
                alert('Orden no encontrada.');
                return;
            }
            var ordenAnterior = ordenesPrevias[ordenIndex];
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

        abrirSelectorReimpresion(pacienteModificado);
    };

    window.imprimirOrdenAnterior = window.imprimirOrdenPaciente;

    // MIGRADO A SQLITE: línea ~264 — usa window.api.obtenerPacientesCompletos()
    // Carga órdenes archivadas desde SQLite tabla ordenes_archivadas
    window.initHistorial = async function() {
        configurarPaginacionHistorial();
        var params = new URLSearchParams(window.location.search);

        var idParam = params.get('id');
        var forzarTodos = !!idParam;

        var resp = await window.api.obtenerPacientesCompletos();
        var pacientes = resp.success ? resp.pacientes : [];

        // Enriquecer cada paciente con sus órdenes archivadas
        pacientes = await Promise.all(pacientes.map(async function(p) {
            if (idParam && String(p.id) !== idParam) return p;
            var respArch = await window.api.obtenerOrdenesArchivadas({ pacienteId: p.id });
            if (respArch.success && respArch.ordenes.length > 0) {
                p.ordenesPrevias = respArch.ordenes;
            } else {
                p.ordenesPrevias = [];
            }
            return p;
        }));

        if (idParam) {
            pacientes = pacientes.filter(function(p) {
                return String(p.id) === idParam;
            });
        }

        renderizarPacientes(pacientes, forzarTodos);
        if (params.get('reimprimir') === '1' && idParam) {
            var pacienteParaReimpresion = pacientes.find(function(p) {
                return String(p.id) === idParam;
            });
            if (pacienteParaReimpresion) {
                await window.imprimirOrdenPaciente(pacienteParaReimpresion.id, -1);
            }
        }

        var buscador = document.getElementById('buscadorHistorial');
        var fechaFiltro = document.getElementById('fechaFiltroHistorial');
        function aplicarFiltrosHistorial() {
            fechaFiltroHistorial = fechaFiltro ? fechaFiltro.value : '';
            renderizarPacientes(pacientes, forzarTodos, buscador ? buscador.value : '', fechaFiltroHistorial);
        }
        if (buscador && buscador.dataset.historialListo !== 'true') {
            buscador.dataset.historialListo = 'true';
            buscador.addEventListener('input', aplicarFiltrosHistorial);
        }
        if (fechaFiltro && fechaFiltro.dataset.historialListo !== 'true') {
            fechaFiltro.dataset.historialListo = 'true';
            fechaFiltro.addEventListener('input', aplicarFiltrosHistorial);
            fechaFiltro.addEventListener('change', aplicarFiltrosHistorial);
        }
    };

    window.limpiarBusquedaHistorial = function() {
        var buscador = document.getElementById('buscadorHistorial');
        var fechaFiltro = document.getElementById('fechaFiltroHistorial');
        if (fechaFiltro) {
            fechaFiltro.value = '';
        }
        fechaFiltroHistorial = '';
        if (buscador) {
            buscador.value = '';
            buscador.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (typeof window.initHistorial === 'function') {
            window.initHistorial();
        }
    };

    window.renderizarPacientes = renderizarPacientes;

})();