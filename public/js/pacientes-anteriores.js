// Módulo para gestionar la vista de pacientes de días anteriores
(function() {
    'use strict';

    var _paginacion = {
        pagina: 1,
        limit: 10,
        cursorActual: 0,
        pacientesBase: [],
        pacientesTodos: [],
        fechaFiltro: ''
    };

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

    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function calcularHoy() {
        return new Date().toLocaleDateString('es-ES');
    }

    function obtenerPacientesBase() {
        if (window.obtenerPacientes && typeof window.obtenerPacientes === 'function') {
            return window.obtenerPacientes();
        }
        return [];
    }

    function cargarPacientes() {
        if (window.api && typeof window.api.obtenerPacientesCompletos === 'function') {
            return window.api.obtenerPacientesCompletos().then(function(r) {
                return (r && r.pacientes) ? r.pacientes : [];
            });
        }
        return Promise.resolve(obtenerPacientesBase());
    }

    function mostrarNotificacion(mensaje, tipo) {
        tipo = tipo || 'info';
        var container = document.getElementById('toastContainerAnteriores');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainerAnteriores';
            container.className = 'position-fixed bottom-0 end-0 p-3';
            container.style.zIndex = '2000';
            document.body.appendChild(container);
        }
        var toastEl = document.createElement('div');
        toastEl.className = 'toast align-items-center text-white bg-' + (tipo === 'danger' ? 'danger' : tipo === 'success' ? 'success' : 'info') + ' border-0';
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.innerHTML =
            '<div class="d-flex"><div class="toast-body">' + mensaje + '</div>' +
            '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>';
        container.appendChild(toastEl);
        var bsToast = new bootstrap.Toast(toastEl, { delay: 5000 });
        bsToast.show();
        toastEl.addEventListener('hidden.bs.toast', function() {
            if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
        });
    }

    function filtrarAnteriores(pacientes) {
        var hoy = calcularHoy();
        return pacientes.filter(function(p) {
            var tieneVisitasPrevias = (parseInt(p.visitas, 10) || 1) > 1;
            var esDeDiaAnterior = p.fechaRegistro && p.fechaRegistro !== hoy;
            return esDeDiaAnterior || tieneVisitasPrevias;
        });
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

    function buscarCoincidencia(p, termino) {
        var busqueda = normalizarTexto(termino);
        if (!busqueda) return true;
        return coincideIncremental(p.nombre, busqueda) ||
            coincideIncremental(p.cedula, busqueda) ||
            coincideIncremental(p.orden, busqueda);
    }

    function ordenarPorOrden(pacientes) {
        return pacientes.slice().sort(function(a, b) {
            return parseInt(a.orden, 10) - parseInt(b.orden, 10);
        });
    }

    function aplicarFiltrosAnteriores() {
        var buscador = document.getElementById('buscadorAnteriores');
        var fechaInput = document.getElementById('fechaFiltroAnteriores');
        var termino = buscador ? String(buscador.value || '').trim().toLowerCase() : '';
        var fechaObjetivo = fechaInput ? String(fechaInput.value || '').trim() : '';
        _paginacion.fechaFiltro = fechaObjetivo;
        var filtrados = _paginacion.pacientesTodos.filter(function(p) {
            if (!buscarCoincidencia(p, termino)) return false;
            if (fechaObjetivo && normalizarFecha(p.fechaRegistro) !== fechaObjetivo) return false;
            return true;
        });
        _paginacion.pacientesBase = ordenarPorOrden(filtrados);
        _paginacion.pagina = 1;
        renderizarPagina();
    }

    function paginar(pacientes) {
        var total = pacientes.length;
        var totalPaginas = _paginacion.limit > 0 ? Math.ceil(total / _paginacion.limit) : 1;
        if (_paginacion.pagina > totalPaginas) _paginacion.pagina = totalPaginas || 1;
        if (_paginacion.pagina < 1) _paginacion.pagina = 1;
        var start = (_paginacion.pagina - 1) * _paginacion.limit;
        var page = pacientes.slice(start, start + _paginacion.limit);
        return { page: page, total: total, totalPaginas: totalPaginas };
    }

    function actualizarControlesPaginacion(totalPaginas) {
        var paginaEl = document.getElementById('paginaActualAnteriores');
        var btnAnterior = document.getElementById('btnAnteriorAnteriores');
        var btnSiguiente = document.getElementById('btnSiguienteAnteriores');
        if (paginaEl) paginaEl.textContent = _paginacion.pagina;
        if (btnAnterior) btnAnterior.disabled = _paginacion.pagina === 1;
        if (btnSiguiente) btnSiguiente.disabled = _paginacion.pagina >= totalPaginas;
    }

    function paginaSiguiente() {
        var result = paginar(_paginacion.pacientesBase);
        if (_paginacion.pagina < result.totalPaginas) {
            _paginacion.pagina++;
            result = paginar(_paginacion.pacientesBase);
        }
        actualizarControlesPaginacion(result.totalPaginas);
        renderizarTabla(result.page);
    }

    function paginaAnterior() {
        if (_paginacion.pagina > 1) {
            _paginacion.pagina--;
        }
        var result = paginar(_paginacion.pacientesBase);
        actualizarControlesPaginacion(result.totalPaginas);
        renderizarTabla(result.page);
    }

    function inicializarPaginacion() {
        var btnAnterior = document.getElementById('btnAnteriorAnteriores');
        var btnSiguiente = document.getElementById('btnSiguienteAnteriores');
        if (btnAnterior) {
            btnAnterior.addEventListener('click', paginaAnterior);
        }
        if (btnSiguiente) {
            btnSiguiente.addEventListener('click', paginaSiguiente);
        }
    }

    function navegarAOrden(orden) {
        var enVistas = window.location.pathname.indexOf('/vistas/') !== -1;
        var prefijo = enVistas ? '' : 'vistas/';
        window.location.href = prefijo + 'orden.html?orden=' + orden;
    }

    var _reimpresion = {
        examenes: null,
        paciente: null,
        modal: null
    };

    function notificarError(mensaje) {
        if (window.Notifications && window.Notifications.error) {
            window.Notifications.error(mensaje);
        } else {
            mostrarNotificacion(mensaje, 'danger');
        }
    }

    function actualizarContadorReimpresion() {
        var lista = document.getElementById('listaExamenesReimpresionAnterior');
        var contador = document.getElementById('contadorExamenesReimpresionAnterior');
        if (!lista || !contador) return;
        var seleccionados = lista.querySelectorAll('input[type="checkbox"]:checked').length;
        var disponibles = lista.querySelectorAll('input[type="checkbox"]:not(:disabled)').length;
        contador.textContent = 'Seleccionados: ' + seleccionados + ' de ' + disponibles;
    }

    function crearModalReimpresion() {
        var elemento = document.createElement('div');
        elemento.className = 'modal fade';
        elemento.id = 'modalReimpresionExamenesAnterior';
        elemento.tabIndex = -1;
        elemento.setAttribute('aria-labelledby', 'tituloModalReimpresionAnterior');
        elemento.setAttribute('aria-hidden', 'true');
        elemento.innerHTML =
            '<div class="modal-dialog modal-dialog-centered">' +
                '<div class="modal-content">' +
                    '<div class="modal-header">' +
                        '<h5 class="modal-title" id="tituloModalReimpresionAnterior">Seleccionar exámenes para reimprimir</h5>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>' +
                    '</div>' +
                    '<div class="modal-body">' +
                        '<p class="text-muted">Marque únicamente los exámenes que necesita volver a imprimir. Los resultados guardados no se modificarán.</p>' +
                        '<div class="d-flex gap-2 mb-2">' +
                            '<button type="button" class="btn btn-sm btn-outline-primary" id="seleccionarTodosReimpresionAnterior" title="Seleccionar todos" aria-label="Seleccionar todos"><i class="bi bi-check2-all" aria-hidden="true"></i></button>' +
                            '<button type="button" class="btn btn-sm btn-outline-secondary" id="deseleccionarTodosReimpresionAnterior" title="Deseleccionar todos" aria-label="Deseleccionar todos"><i class="bi bi-x-square" aria-hidden="true"></i></button>' +
                        '</div>' +
                        '<div id="listaExamenesReimpresionAnterior" class="list-group"></div>' +
                        '<div id="contadorExamenesReimpresionAnterior" class="small text-muted mt-2"></div>' +
                    '</div>' +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" title="Cancelar" aria-label="Cancelar"><i class="bi bi-x-lg" aria-hidden="true"></i></button>' +
                        '<button type="button" class="btn btn-success" id="confirmarReimpresionAnterior" title="Reimprimir seleccionados" aria-label="Reimprimir seleccionados"><i class="bi bi-printer" aria-hidden="true"></i></button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(elemento);
        _reimpresion.modal = window.bootstrap.Modal.getOrCreateInstance(elemento);

        elemento.querySelector('#seleccionarTodosReimpresionAnterior').addEventListener('click', function() {
            elemento.querySelectorAll('#listaExamenesReimpresionAnterior input:not(:disabled)').forEach(function(input) {
                input.checked = true;
            });
            actualizarContadorReimpresion();
        });
        elemento.querySelector('#deseleccionarTodosReimpresionAnterior').addEventListener('click', function() {
            elemento.querySelectorAll('#listaExamenesReimpresionAnterior input').forEach(function(input) {
                input.checked = false;
            });
            actualizarContadorReimpresion();
        });
        elemento.querySelector('#confirmarReimpresionAnterior').addEventListener('click', async function() {
            var lista = elemento.querySelector('#listaExamenesReimpresionAnterior');
            var indices = Array.prototype.map.call(
                lista.querySelectorAll('input[type="checkbox"]:checked'),
                function(input) { return Number(input.value); }
            );
            if (indices.length === 0) {
                notificarError('Seleccione al menos un examen con resultados para reimprimir.');
                return;
            }

            var pacienteSeleccionado = Object.assign({}, _reimpresion.paciente, {
                examenes: indices.map(function(indice) { return _reimpresion.examenes[indice]; })
            });
            var payload = window.PdfReport.buildPayload(pacienteSeleccionado);
            if (!payload.hayResultados) {
                notificarError('Los exámenes seleccionados no tienen resultados registrados para imprimir.');
                return;
            }

            _reimpresion.modal.hide();
            var nombreArchivo = 'orden_' + pacienteSeleccionado.orden + '_' + pacienteSeleccionado.nombre;
            try {
                await window.PdfReport.generarDesdePayload(payload, 'imprimir', nombreArchivo);
            } catch (error) {
                console.error('[reimpresion-anteriores] Error generando PDF:', error);
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

        _reimpresion.examenes = examenes;
        _reimpresion.paciente = paciente;
        var elemento = document.getElementById('modalReimpresionExamenesAnterior') || crearModalReimpresion();
        var lista = elemento.querySelector('#listaExamenesReimpresionAnterior');
        var titulo = elemento.querySelector('#tituloModalReimpresionAnterior');
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
        _reimpresion.modal.show();
    }

    window.irAOrdenAnterior = function(orden) {
        navegarAOrden(orden);
    };

    window.nuevaOrdenAnterior = function(pacienteId) {
        if (!window.crearNuevaVisita) {
            mostrarNotificacion('No se pudo crear la nueva orden.', 'danger');
            return;
        }
        window.crearNuevaVisita(pacienteId, { navegar: true, actualizarPaciente: false }).then(function(nuevaOrden) {
            if (nuevaOrden) {
                mostrarNotificacion('Nueva orden #' + nuevaOrden + ' creada.', 'success');
            }
        });
    };

    window.verHistorialAnterior = function(id) {
        var enVistas = window.location.pathname.indexOf('/vistas/') !== -1;
        var prefijo = enVistas ? '' : 'vistas/';
        window.location.href = prefijo + 'historial.html?id=' + id;
    };

    window.reimprimirPacienteAnterior = function(id) {
        var base = (_paginacion.pacientesTodos && _paginacion.pacientesTodos.length)
            ? _paginacion.pacientesTodos
            : _paginacion.pacientesBase;
        var paciente = (base || []).find(function(p) {
            return String(p.id) === String(id);
        });
        if (!paciente) {
            cargarPacientes().then(function(pacientes) {
                var encontrado = (pacientes || []).find(function(p) {
                    return String(p.id) === String(id);
                });
                if (!encontrado) {
                    notificarError('Paciente no encontrado.');
                    return;
                }
                abrirSelectorReimpresion(encontrado);
            }).catch(function(error) {
                notificarError('No se pudo cargar el paciente: ' + (error && error.message ? error.message : error));
            });
            return;
        }
        abrirSelectorReimpresion(paciente);
    };

    function renderizarTabla(pacientes) {
        var tbody = document.getElementById('tablaAnteriores');
        if (!tbody) return;
        tbody.innerHTML = '';

        var total = _paginacion.pacientesBase ? _paginacion.pacientesBase.length : pacientes.length;
        var totalEl = document.getElementById('totalAnteriores');
        if (totalEl) totalEl.textContent = total + ' pacientes';

        if (pacientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No se encontraron pacientes.</td></tr>';
            return;
        }

        pacientes.forEach(function(p) {
            var estado = window.calcularEstadoPaciente ? window.calcularEstadoPaciente(p) : 'en_espera';
            var badgeEstado = window.textoEstado ? window.textoEstado(estado) : { texto: estado, clase: 'bg-secondary' };
            var fila = document.createElement('tr');
            fila.innerHTML =
                '<td class="text-center"><span class="badge bg-primary badge-orden">#' + escapeHtml(p.orden) + '</span></td>' +
                '<td class="fw-semibold">' + escapeHtml(p.nombre) + '</td>' +
                '<td>' + (p.cedula ? escapeHtml(p.cedula) : '<span class="text-muted">N/A</span>') + '</td>' +
                '<td>' + escapeHtml(p.fechaRegistro || '-') + '</td>' +
                '<td class="text-center">' + (p.visitas || 1) + '</td>' +
                '<td class="text-center"><span class="badge ' + badgeEstado.clase + '">' + badgeEstado.texto + '</span></td>' +
                '<td class="text-center">' +
                '<div class="btn-group btn-group-sm" role="group">' +
                '<button class="btn btn-outline-primary" onclick="window.irAOrdenAnterior(' + "'" + p.orden + "'" + ')" title="Ir a Orden"><i class="bi bi-arrow-right-circle"></i></button>' +
                '<button class="btn btn-outline-success" onclick="window.nuevaOrdenAnterior(' + p.id + ')" title="Nueva Orden"><i class="bi bi-plus-circle"></i></button>' +
                '<button class="btn btn-outline-success" onclick="window.reimprimirPacienteAnterior(' + p.id + ')" title="Seleccionar examen para reimprimir"><i class="bi bi-printer"></i></button>' +
                '<button class="btn btn-outline-info" onclick="window.verHistorialAnterior(' + p.id + ')" title="Historial"><i class="bi bi-clock-history"></i></button>' +
                '</div></td>';
            tbody.appendChild(fila);
        });
    }

    function renderizarPagina() {
        var result = paginar(_paginacion.pacientesBase);
        actualizarControlesPaginacion(result.totalPaginas);
        renderizarTabla(result.page);
    }

    window.initPacientesAnteriores = function() {
        inicializarPaginacion();

        cargarPacientes().then(function(pacientes) {
            var anteriores = filtrarAnteriores(pacientes);
            _paginacion.pacientesTodos = ordenarPorOrden(anteriores);
            _paginacion.pacientesBase = _paginacion.pacientesTodos.slice();
            _paginacion.pagina = 1;
            renderizarPagina();

            var buscador = document.getElementById('buscadorAnteriores');
            var fechaFiltro = document.getElementById('fechaFiltroAnteriores');
            if (buscador && buscador.dataset.anterioresListo !== 'true') {
                buscador.dataset.anterioresListo = 'true';
                buscador.addEventListener('input', aplicarFiltrosAnteriores);
            }
            if (fechaFiltro && fechaFiltro.dataset.anterioresListo !== 'true') {
                fechaFiltro.dataset.anterioresListo = 'true';
                fechaFiltro.addEventListener('input', aplicarFiltrosAnteriores);
                fechaFiltro.addEventListener('change', aplicarFiltrosAnteriores);
            }
        }).catch(function(e) {
            console.error('[pacientes-anteriores] Error:', e);
            mostrarNotificacion('Error al cargar pacientes: ' + e.message, 'danger');
        });
    };

    window.limpiarBusquedaAnteriores = function() {
        var buscador = document.getElementById('buscadorAnteriores');
        var fechaFiltro = document.getElementById('fechaFiltroAnteriores');
        if (fechaFiltro) {
            fechaFiltro.value = '';
        }
        _paginacion.fechaFiltro = '';
        if (buscador) {
            buscador.value = '';
        }
        if (_paginacion.pacientesTodos && _paginacion.pacientesTodos.length) {
            aplicarFiltrosAnteriores();
        } else {
            window.initPacientesAnteriores();
        }
    };

    window.renderizarTablaAnteriores = renderizarTabla;
})();
