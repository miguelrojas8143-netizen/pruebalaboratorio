// Módulo para gestionar la recepción de pacientes y la cola de espera
(function() {
    'use strict';

    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function debounce(fn, delay) {
        var timer = null;
        return function() {
            var ctx = this, args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
        };
    }

    var _paginacion = {
        pagina: 1,
        limit: 10,
        cursorActual: 0,
        cursorStack: [],
        hayMas: false,
        pacientes: []
    };

    function inicializarPaginacion() {
        var btnAnterior = document.getElementById('btnAnterior');
        var btnSiguiente = document.getElementById('btnSiguiente');
        if (btnAnterior) {
            btnAnterior.addEventListener('click', function() {
                if (_paginacion.pagina > 1) {
                    paginaAnterior();
                }
            });
        }
        if (btnSiguiente) {
            btnSiguiente.addEventListener('click', function() {
                if (_paginacion.hayMas) {
                    paginaSiguiente();
                }
            });
        }
        _paginacion.cursorStack = [{ cursorActual: 0, pagina: 1 }];
        cargarPaginaActual();
    }

    function cargarPacientes() {
        return window.api.obtenerPacientesCompletos().then(function(r) {
            return (r && r.pacientes) ? r.pacientes : [];
        }).catch(function(e) {
            console.error('[cargarPacientes] Error:', e);
            return [];
        });
    }

    function paginaSiguiente() {
        cargarPacientes().then(function(todos) {
            _paginacion.cursorStack.push({ cursorActual: _paginacion.cursorActual, pagina: _paginacion.pagina });
            _paginacion.cursorActual = _paginacion.cursorActual + _paginacion.limit;
            _paginacion.hayMas = todos.length > _paginacion.cursorActual;
            _paginacion.pagina = _paginacion.cursorStack.length;
            var page = todos.slice(_paginacion.cursorActual, _paginacion.cursorActual + _paginacion.limit);
            actualizarEstadoPaginacion(page);
        }).catch(function(e) {
            console.error('[paginaSiguiente] Error:', e);
            actualizarEstadoPaginacion([]);
        });
    }

    function paginaAnterior() {
        if (_paginacion.cursorStack.length <= 1) {
            _paginacion.cursorActual = 0;
            _paginacion.pagina = 1;
            cargarPaginaActual();
        } else {
            _paginacion.cursorStack.pop();
            var estado = _paginacion.cursorStack[_paginacion.cursorStack.length - 1];
            _paginacion.cursorActual = estado.cursorActual;
            _paginacion.pagina = estado.pagina;
            cargarPacientes().then(function(todos) {
                _paginacion.hayMas = todos.length > _paginacion.cursorActual;
                var page = todos.slice(_paginacion.cursorActual, _paginacion.cursorActual + _paginacion.limit);
                actualizarEstadoPaginacion(page);
            }).catch(function(e) {
                console.error('[paginaAnterior] Error:', e);
                actualizarEstadoPaginacion([]);
            });
        }
    }

    function cargarPaginaActual() {
        cargarPacientes().then(function(todos) {
            _paginacion.hayMas = todos.length > _paginacion.cursorActual + _paginacion.limit;
            var page = todos.slice(_paginacion.cursorActual, _paginacion.cursorActual + _paginacion.limit);
            actualizarEstadoPaginacion(page);
        }).catch(function(e) {
            console.error('[cargarPaginaActual] Error:', e);
            actualizarEstadoPaginacion([]);
        });
    }

    function actualizarEstadoPaginacion(pacientes) {
        _paginacion.pacientes = pacientes;
        var paginaEl = document.getElementById('paginaActual');
        var btnAnterior = document.getElementById('btnAnterior');
        var btnSiguiente = document.getElementById('btnSiguiente');
        if (paginaEl) paginaEl.textContent = _paginacion.pagina;
        if (btnAnterior) btnAnterior.disabled = _paginacion.pagina === 1;
        if (btnSiguiente) btnSiguiente.disabled = !_paginacion.hayMas;
        renderizarCola();
    }

    function refrescarPaginaActual() {
        _paginacion.cursorActual = 0;
        _paginacion.cursorStack = [{ cursorActual: 0, pagina: 1 }];
        _paginacion.pagina = 1;
        cargarPaginaActual();
    }

    function mostrarNotificacion(mensaje, tipo) {
        tipo = tipo || 'info';
        var container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
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

    window.initRecepcion = initRecepcion;
    window.obtenerOrdenNavegar = function() { return _ordenNavegar; };
    var _ordenNavegar = null;

    function kiloColaMostrarCompletados() {
        var val = localStorage.getItem('kilo.cola.mostrarCompletados');
        return val !== 'false';
    }

    function inicializarToggleCompletados() {
        var toggle = document.getElementById('mostrarCompletados');
        if (toggle) {
            toggle.checked = kiloColaMostrarCompletados();
            toggle.addEventListener('change', function() {
                localStorage.setItem('kilo.cola.mostrarCompletados', this.checked ? 'true' : 'false');
                renderizarCola();
            });
        }
    }

    function initRecepcion() {
        inicializarPaginacion();
        inicializarToggleCompletados();
        renderizarMetricas();
        inicializarSelect2();
        document.getElementById('formRegistro').addEventListener('submit', async function(e) {
            e.preventDefault();
            var self = this;

            var nombre = document.getElementById('nombre').value.trim();
            var sexo = document.getElementById('sexo').value;
            var cedula = document.getElementById('cedula').value.trim();
            var fechaNac = document.getElementById('fechaNac').value.trim();
            var edadVal = document.getElementById('edad').value.trim();
            var telefono = document.getElementById('telefono').value.trim();

            if (!nombre || !sexo) {
                mostrarNotificacion('Nombre y sexo son obligatorios.', 'danger');
                return;
            }

            var edad = parseInt(edadVal, 10);
            if (!edad || isNaN(edad)) {
                edad = window.calcularEdad(fechaNac);
            }

            var nuevoOrden = window.obtenerOrdenDiaria();
            var nuevoPaciente = {
                orden: String(nuevoOrden).padStart(3, '0'),
                nombre: nombre,
                cedula: cedula || '',
                edad: edad,
                sexo: sexo,
                fechaNac: fechaNac || '',
                telefono: telefono || '',
                fechaRegistro: new Date().toLocaleDateString('es-ES')
            };

            try {
                const result = await window.api.guardarPaciente(nuevoPaciente);
                if (result.success) {
                    nuevoPaciente.orden = result.orden || nuevoPaciente.orden;
                    var numeroOrdenEl = document.getElementById('numeroOrden');
                    if (numeroOrdenEl) numeroOrdenEl.textContent = nuevoPaciente.orden;
                    _ordenNavegar = nuevoPaciente.orden;

                    window.guardarUltimaOrdenCreada(nuevoPaciente.orden);
                    refrescarPaginaActual();
                    renderizarMetricas();
                    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-orden')).show();
                    self.reset();
                } else {
                    mostrarNotificacion('Error al guardar el paciente: ' + result.error, 'danger');
                }
            } catch (err) {
                mostrarNotificacion('Error inesperado: ' + err.message, 'danger');
            }
        });
        document.getElementById('buscadorGlobal').addEventListener('input', debounce(function() {
            var termino = this.value;
            renderizarCola(termino);
            window.buscarPaciente(termino);
        }, 300));
        document.getElementById('btnNuevaOrden').addEventListener('click', function() {
            var modal = bootstrap.Modal.getInstance(document.getElementById('modalDuplicado'));
            modal.hide();
            var refer = window.obtenerPacienteExistenteRefer();
            var datos = refer ? JSON.parse(refer) : null;
            if (!datos || !datos.orden) return;
            _ordenNavegar = datos.orden;
            window.crearNuevaVisita(null, { actualizarPaciente: true, navegar: true, limpiarBuscador: true });
        });
        window.buscarPaciente = function(termino) {
            var resultadosDiv = document.getElementById('resultadosBusqueda');
            var listaDiv = document.getElementById('listaResultadosBusqueda');
            if (!resultadosDiv || !listaDiv) return;
            if (!termino || termino.length < 3) {
                resultadosDiv.style.display = 'none';
                listaDiv.innerHTML = '';
                return;
            }
            cargarPacientes().then(function(pacientes) {
                var t = termino.toLowerCase();
                var encontrados = pacientes.filter(function(p) {
                    return (p.nombre && p.nombre.toLowerCase().includes(t)) ||
                        (p.cedula && p.cedula.includes(t)) ||
                        (p.orden && String(p.orden).includes(t));
                });
                if (encontrados.length === 0) {
                    resultadosDiv.style.display = 'none';
                    return;
                }
                encontrados.sort(function(a, b) { return parseInt(b.orden) - parseInt(a.orden); });
                var html = '';
                encontrados.slice(0, 5).forEach(function(p) {
                    var estado = window.calcularEstadoPaciente(p);
                    var badge = window.textoEstado(estado);
                    html += '<div class="list-group-item d-flex justify-content-between align-items-center"><div><strong>' + p.nombre + '</strong><small class="text-muted d-block">Cédula: ' + (p.cedula || 'N/A') + ' | Orden: #' + p.orden + ' | Visitas: ' + (p.visitas || 1) + '</small></div><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-primary" onclick="window.location.href=\'vistas/orden.html?orden=' + p.orden + '\'"><i class="bi bi-arrow-right-circle"></i> Ir a Orden</button><a href="vistas/historial.html?id=' + p.id + '" class="btn btn-sm btn-outline-info"><i class="bi bi-clock-history"></i> Historial</a><button class="btn btn-sm btn-success" onclick="window.crearNuevaOrden(' + p.id + ')"><i class="bi bi-plus-circle"></i> Nueva Orden</button></div></div>';
                });
                listaDiv.innerHTML = html;
                resultadosDiv.style.display = 'block';
            });
        };
        window.crearNuevaOrden = function(pacienteId) {
            window.crearNuevaVisita(pacienteId, { actualizarPaciente: false, navegar: true, limpiarBuscador: true });
        };
    }

    function renderizarCola(filtro) {
        var pacientes = _paginacion.pacientes;
        var hoy = new Date().toLocaleDateString('es-ES');
        var mostrarCompletados = kiloColaMostrarCompletados();
        var pacientesHoy = pacientes.filter(function(p) {
            if (p.fechaRegistro !== hoy) return false;
            if (!mostrarCompletados && window.calcularEstadoPaciente(p) === 'completo') return false;
            return true;
        });
        var tbody = document.getElementById('tablaCola');
        if (!tbody) return;
        tbody.innerHTML = '';
        var termino = (filtro || '').toLowerCase();
        var pacientesFiltrados = pacientesHoy.filter(function(p) {
            return p.nombre.toLowerCase().includes(termino) ||
                (p.cedula && p.cedula.includes(termino)) ||
                p.orden.includes(termino);
        });
        pacientesFiltrados.sort(function(a, b) { return parseInt(a.orden) - parseInt(b.orden); });
        var totalEl = document.getElementById('totalPacientes');
        if (totalEl) totalEl.textContent = pacientesFiltrados.length + ' pacientes (hoy)';
        if (pacientesFiltrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No se encontraron pacientes.</td></tr>';
            return;
        }
        pacientesFiltrados.forEach(function(p) {
            var estado = window.calcularEstadoPaciente(p);
            var badgeEstado = window.textoEstado(estado);
            var fila = document.createElement('tr');
            fila.innerHTML = '<td><span class="badge bg-primary badge-orden">#' + p.orden + '</span></td><td class="fw-semibold">' + p.nombre + '</td><td>' + (p.cedula ? p.cedula : '<span class="text-muted">N/A</span>') + '</td><td class="text-center"><span class="badge ' + badgeEstado.clase + '">' + badgeEstado.texto + '</span></td><td class="text-center"><button class="btn btn-sm btn-outline-primary" onclick="window.location.href=\'vistas/orden.html?orden=' + p.orden + '\'"><i class="bi bi-arrow-right-circle me-1"></i> Cargar Exámenes</button></td>';
            var botonEliminar = document.createElement('button');
            botonEliminar.type = 'button';
            botonEliminar.className = 'btn btn-sm btn-outline-danger ms-2';
            botonEliminar.title = 'Eliminar orden';
            botonEliminar.setAttribute('aria-label', 'Eliminar orden #' + p.orden);
            botonEliminar.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
            botonEliminar.addEventListener('click', function() {
                window.eliminarOrdenPaciente(p.id, p.orden);
            });
            fila.querySelector('td:last-child').appendChild(botonEliminar);
            tbody.appendChild(fila);
        });
    }

    function renderizarMetricas() {
        cargarPacientes().then(function(pacientes) {
            var hoy = new Date().toLocaleDateString('es-ES');
            var hoyPacientes = pacientes.filter(function(p) {
            return p.fechaRegistro === hoy && window.calcularEstadoPaciente(p) !== 'completo';
            });
            var pendientes = hoyPacientes.filter(function(p) {
                var e = window.calcularEstadoPaciente(p);
                return e === 'en_espera' || e === 'parcial';
            });
            var completadas = hoyPacientes.filter(function(p) {
                return window.calcularEstadoPaciente(p) === 'completo';
            });
            var ordenesEl = document.getElementById('metricaOrdenesHoy');
            var pendEl = document.getElementById('metricaPendientes');
            var complEl = document.getElementById('metricaCompletadas');
            if (ordenesEl) ordenesEl.textContent = hoyPacientes.length;
            if (pendEl) pendEl.textContent = pendientes.length;
            if (complEl) complEl.textContent = completadas.length;
            var seccion = document.getElementById('seccionMetricas');
            if (seccion) seccion.style.display = hoyPacientes.length > 0 ? 'flex' : 'none';
        });
    }

    function inicializarSelect2() {
        window.refrescarSelect2Catalogos();
    }

    window.abrirGestionPacientes = function() {
        renderizarListaPacientesModal(true);
        var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalGestionPacientes'));
        modal.show();
    };

    var _gestionPacientes = { todos: [], filtrados: [], fechaFiltro: '' };

    function normalizarFechaGestion(fecha) {
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

    function normalizarTextoGestion(texto) {
        return String(texto == null ? '' : texto).trim().toLowerCase();
    }

    function coincideIncrementalGestion(valor, termino) {
        if (!termino) return true;
        var texto = normalizarTextoGestion(valor);
        if (!texto) return false;
        if (texto.indexOf(termino) === 0) return true;
        return texto.split(/\s+/).some(function(parte) {
            return parte.indexOf(termino) === 0;
        });
    }

    function aplicarFiltrosGestionPacientes() {
        var buscador = document.getElementById('buscadorGestionPacientes');
        var fechaInput = document.getElementById('fechaFiltroGestionPacientes');
        var termino = buscador ? normalizarTextoGestion(buscador.value) : '';
        var fechaObjetivo = fechaInput ? String(fechaInput.value || '').trim() : '';
        _gestionPacientes.fechaFiltro = fechaObjetivo;
        _gestionPacientes.filtrados = _gestionPacientes.todos.filter(function(p) {
            var coincideTexto = !termino ||
                coincideIncrementalGestion(p.nombre, termino) ||
                coincideIncrementalGestion(p.cedula, termino) ||
                coincideIncrementalGestion(p.orden, termino);
            if (!coincideTexto) return false;
            if (fechaObjetivo && normalizarFechaGestion(p.fechaRegistro) !== fechaObjetivo) return false;
            return true;
        }).sort(function(a, b) { return parseInt(a.orden, 10) - parseInt(b.orden, 10); });
        renderizarTablaGestionPacientes();
    }

    function renderizarTablaGestionPacientes() {
        var tbody = document.getElementById('tablaGestionPacientes');
        if (!tbody) return;
        var lista = _gestionPacientes.filtrados || [];
        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No se encontraron pacientes.</td></tr>';
            return;
        }
        var html = '';
        lista.forEach(function(p, index) {
            var ordenEsc = escapeHtml(p.orden);
            html += '<tr><td>' + (index + 1) + '</td><td class="fw-semibold">' + escapeHtml(p.nombre) + '</td><td>' + (p.cedula ? escapeHtml(p.cedula) : '<span class="text-muted">N/A</span>') + '</td><td><span class="badge bg-primary badge-orden">#' + ordenEsc + '</span></td><td>' + escapeHtml(p.fechaRegistro || '-') + '</td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="eliminarOrdenPaciente(' + p.id + ', \'' + ordenEsc + '\')"><i class="bi bi-trash"></i> Eliminar orden</button></td></tr>';
        });
        tbody.innerHTML = html;
    }

    function configurarFiltrosGestionPacientes() {
        var buscador = document.getElementById('buscadorGestionPacientes');
        var fechaFiltro = document.getElementById('fechaFiltroGestionPacientes');
        if (buscador && buscador.dataset.gestionListo !== 'true') {
            buscador.dataset.gestionListo = 'true';
            buscador.addEventListener('input', aplicarFiltrosGestionPacientes);
        }
        if (fechaFiltro && fechaFiltro.dataset.gestionListo !== 'true') {
            fechaFiltro.dataset.gestionListo = 'true';
            fechaFiltro.addEventListener('input', aplicarFiltrosGestionPacientes);
            fechaFiltro.addEventListener('change', aplicarFiltrosGestionPacientes);
        }
    }

    window.limpiarBusquedaGestionPacientes = function() {
        var buscador = document.getElementById('buscadorGestionPacientes');
        var fechaFiltro = document.getElementById('fechaFiltroGestionPacientes');
        if (buscador) buscador.value = '';
        if (fechaFiltro) fechaFiltro.value = '';
        _gestionPacientes.fechaFiltro = '';
        aplicarFiltrosGestionPacientes();
    };

    function cargarOrdenesGestion(pacientes) {
        var lista = (pacientes || []).slice();
        return Promise.all(lista.map(function(p) {
            var base = function() {
                return {
                    id: p.id,
                    nombre: p.nombre,
                    cedula: p.cedula,
                    orden: String(p.orden || '').padStart(3, '0'),
                    fechaRegistro: p.fechaRegistro || '',
                    esActual: true
                };
            };
            if (!window.api || !window.api.obtenerOrdenesArchivadas) return Promise.resolve([base()]);
            return window.api.obtenerOrdenesArchivadas({ pacienteId: p.id }).then(function(resp) {
                var registros = [base()];
                var ordenes = (resp && resp.success && resp.ordenes) ? resp.ordenes : [];
                ordenes.forEach(function(o) {
                    registros.push({
                        id: p.id,
                        nombre: p.nombre,
                        cedula: p.cedula,
                        orden: String(o.orden || '').padStart(3, '0'),
                        fechaRegistro: o.fecha || '',
                        esActual: false
                    });
                });
                return registros;
            }).catch(function() {
                return [base()];
            });
        })).then(function(grupos) {
            var registros = [];
            grupos.forEach(function(g) { registros = registros.concat(g); });
            registros.sort(function(a, b) { return parseInt(a.orden, 10) - parseInt(b.orden, 10); });
            return registros;
        });
    }

    function renderizarListaPacientesModal(recargar) {
        configurarFiltrosGestionPacientes();
        var tbody = document.getElementById('tablaGestionPacientes');
        if (recargar) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Cargando...</td></tr>';
            cargarPacientes().then(function(pacientes) {
                return cargarOrdenesGestion(pacientes || []);
            }).then(function(registros) {
                _gestionPacientes.todos = registros || [];
                aplicarFiltrosGestionPacientes();
            }).catch(function(e) {
                console.error('[gestionPacientes] Error cargando órdenes:', e);
                if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">Error al cargar pacientes.</td></tr>';
            });
            return;
        }
        aplicarFiltrosGestionPacientes();
    }

    window.eliminarOrdenPaciente = async function(pacienteId, orden) {
        var confirmado = await window.Notifications.confirm('¿Está seguro de eliminar la orden #' + orden + '? Se mantendrán las demás órdenes e historial del paciente.');
        if (!confirmado) return;
        window.api.eliminarOrden({ pacienteId: pacienteId, orden: String(orden || '') }).then(function(r) {
            if (r && r.success) {
                renderizarListaPacientesModal(true);
                refrescarPaginaActual();
                renderizarMetricas();
            } else {
                console.error('[eliminarOrdenPaciente] Error:', r ? r.error : 'Unknown error');
                window.Notifications.error('Error al eliminar la orden: ' + (r ? r.error : 'Unknown error'));
            }
        }).catch(function(e) {
            console.error('[eliminarOrdenPaciente] Error:', e);
            window.Notifications.error('Error al eliminar la orden.');
        });
    };

    window.eliminarPacienteIndividual = window.eliminarOrdenPaciente;

    window.eliminarTodosPacientes = async function() {
        var confirmado = await window.Notifications.confirm('¿Está seguro de eliminar TODOS los pacientes?\nEsta acción no se puede deshacer.');
        if (!confirmado) return;
        window.api.eliminarTodosPacientes().then(function(r) {
            if (r && r.success) {
                renderizarListaPacientesModal(true);
                refrescarPaginaActual();
                renderizarMetricas();
            } else {
                console.error('[eliminarTodosPacientes] Error:', r ? r.error : 'Unknown error');
                window.Notifications.error('Error al eliminar los pacientes: ' + (r ? r.error : 'Unknown error'));
            }
        }).catch(function(e) {
            console.error('[eliminarTodosPacientes] Error:', e);
            window.Notifications.error('Error al eliminar los pacientes.');
        });
    };

    window.initRecepcion = initRecepcion;
    window.renderizarCola = renderizarCola;
    window.renderizarMetricas = renderizarMetricas;

})();
