// Módulo para gestionar la recepción de pacientes y la cola de espera
(function() {
    'use strict';

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

    function paginaSiguiente() {
        window.DB.obtenerPacientes(_paginacion.limit, _paginacion.cursorActual).then(function(result) {
            if (!result) {
                result = { pacientes: [], hayMas: false, nuevoCursor: 0 };
            }
            var pacientes = result.pacientes || [];
            _paginacion.cursorStack.push({ cursorActual: _paginacion.cursorActual, pagina: _paginacion.pagina });
            _paginacion.cursorActual = result.nuevoCursor || 0;
            _paginacion.hayMas = result.hayMas || false;
            _paginacion.pagina = _paginacion.cursorStack.length;
            actualizarEstadoPaginacion(pacientes);
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
            window.DB.obtenerPacientes(_paginacion.limit, _paginacion.cursorActual).then(function(result) {
                if (!result) {
                    result = { pacientes: [], hayMas: false, nuevoCursor: 0 };
                }
                _paginacion.hayMas = result.hayMas || false;
                actualizarEstadoPaginacion(result.pacientes || []);
            }).catch(function(e) {
                console.error('[paginaAnterior] Error:', e);
                actualizarEstadoPaginacion([]);
            });
        }
    }

    function cargarPaginaActual() {
        window.DB.obtenerPacientes(_paginacion.limit, _paginacion.cursorActual).then(function(result) {
            if (!result) {
                result = { pacientes: [], hayMas: false, nuevoCursor: 0 };
            }
            var pacientes = result.pacientes || [];
            _paginacion.cursorActual = result.nuevoCursor || 0;
            _paginacion.hayMas = result.hayMas || false;
            actualizarEstadoPaginacion(pacientes);
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

    window.initRecepcion = initRecepcion;

    function initRecepcion() {
        inicializarPaginacion();
        renderizarMetricas();
        inicializarSelect2();
        document.getElementById('formRegistro').addEventListener('submit', function(e) {
            e.preventDefault();
            var self = this;
            var nombre = document.getElementById('nombre').value.trim();
            var sexo = document.getElementById('sexo').value;
            var cedula = document.getElementById('cedula').value.trim();
            var telefono = document.getElementById('telefono').value.trim();
            var fechaNac = document.getElementById('fechaNac').value.trim();
            var edad = window.calcularEdad(fechaNac);
            if (!nombre || !sexo) {
                alert('Nombre y sexo son obligatorios.');
                return;
            }

            window.DB.obtenerPacientes(1000, null).then(function(r) {
                var pacientes = (r && r.pacientes) ? r.pacientes : (r || []);
                if (cedula && pacientes.some(function(p) { return p.cedula === cedula; })) {
                    var pacienteExistente = pacientes.find(function(p) { return p.cedula === cedula; });
                    document.getElementById('pacienteExistenteNombre').textContent = pacienteExistente.nombre;
                    document.getElementById('cedulaDuplicada').textContent = pacienteExistente.cedula || 'N/A';
                    document.getElementById('pacienteExistenteOrden').textContent = pacienteExistente.orden;
                    document.getElementById('pacienteExistenteFecha').textContent = pacienteExistente.fechaRegistro || 'N/A';
                    document.getElementById('pacienteVisitas').textContent = pacienteExistente.visitas || 1;
                    document.getElementById('pacienteExistenteEdad').textContent = pacienteExistente.edad ? pacienteExistente.edad + ' años' : 'N/A';
                    document.getElementById('btnIrOrdenExistente').href = 'vistas/orden.html?orden=' + pacienteExistente.orden;
                    window.guardarPacienteExistenteRefer({
                        nombre: nombre,
                        sexo: sexo,
                        cedula: cedula,
                        fechaNac: fechaNac,
                        telefono: telefono,
                        edad: edad
                    });
                    var modal = new bootstrap.Modal(document.getElementById('modalDuplicado'));
                    modal.show();
                    return;
                }
                var nuevoOrden = window.obtenerOrdenDiaria();
                var nuevoPaciente = {
                    id: Date.now(),
                    orden: String(nuevoOrden).padStart(3, '0'),
                    nombre: nombre,
                    sexo: sexo,
                    cedula: cedula || null,
                    fechaNac: fechaNac || null,
                    telefono: telefono || null,
                    edad: edad,
                    fechaRegistro: new Date().toLocaleDateString('es-ES'),
                    examenes: [],
                    historial: [],
                    visitas: 1
                };
                pacientes.push(nuevoPaciente);
                window.guardarPacientes(pacientes).then(function() {
                    window.guardarUltimaOrdenCreada(nuevoPaciente.orden);
                    self.reset();
                    refrescarPaginaActual();
                    renderizarMetricas();
                    new bootstrap.Modal(document.getElementById('modalExito')).show();
                }).catch(function(err) {
                    console.error('[guardarPacientes] Error:', err);
                });
            });
        });
        document.getElementById('buscadorGlobal').addEventListener('input', function() {
            renderizarCola(this.value);
            window.buscarPaciente(this.value);
        });
        document.getElementById('btnNuevaOrden').addEventListener('click', function() {
            var modal = bootstrap.Modal.getInstance(document.getElementById('modalDuplicado'));
            modal.hide();
            var refer = window.obtenerPacienteExistenteRefer();
            var datos = refer ? JSON.parse(refer) : null;
            if (!datos || !datos.cedula) return;
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
            window.DB.obtenerPacientes(1000, null).then(function(r) {
                var pacientes = (r && r.pacientes) ? r.pacientes : (r || []);
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
                    html += '<div class="list-group-item d-flex justify-content-between align-items-center"><div><strong>' + p.nombre + '</strong><small class="text-muted d-block">Cédula: ' + (p.cedula || 'N/A') + ' | Orden: #' + p.orden + ' | Visitas: ' + (p.visitas || 1) + '</small></div><div class="d-flex gap-2"><a href="vistas/orden.html?orden=' + p.orden + '" class="btn btn-sm btn-outline-primary"><i class="bi bi-arrow-right-circle"></i> Ir a Orden</a><a href="vistas/historial.html?id=' + p.id + '" class="btn btn-sm btn-outline-info"><i class="bi bi-clock-history"></i> Historial</a><button class="btn btn-sm btn-success" onclick="window.crearNuevaOrden(' + p.id + ')"><i class="bi bi-plus-circle"></i> Nueva Orden</button></div></div>';
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
        var pacientesHoy = pacientes.filter(function(p) {
            return p.fechaRegistro === hoy;
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
        if (totalEl) totalEl.textContent = pacientesFiltrados.length + ' pacientes';
        if (pacientesFiltrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No se encontraron pacientes.</td></tr>';
            return;
        }
        pacientesFiltrados.forEach(function(p) {
            var estado = window.calcularEstadoPaciente(p);
            var badgeEstado = window.textoEstado(estado);
            var fila = document.createElement('tr');
            fila.innerHTML = '<td><span class="badge bg-primary badge-orden">#' + p.orden + '</span></td><td class="fw-semibold">' + p.nombre + '</td><td>' + (p.cedula ? p.cedula : '<span class="text-muted">N/A</span>') + '</td><td class="text-center"><span class="badge ' + badgeEstado.clase + '">' + badgeEstado.texto + '</span></td><td class="text-center"><a href="vistas/orden.html?orden=' + p.orden + '" class="btn btn-sm btn-outline-primary"><i class="bi bi-arrow-right-circle me-1"></i> Cargar Exámenes</a></td>';
            tbody.appendChild(fila);
        });
    }

    function renderizarMetricas() {
        window.DB.obtenerPacientes(1000, null).then(function(r) {
            var pacientes = (r && r.pacientes) ? r.pacientes : (r || []);
            var hoy = new Date().toLocaleDateString('es-ES');
            var hoyPacientes = pacientes.filter(function(p) {
                return p.fechaRegistro === hoy;
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
        renderizarListaPacientesModal();
        var modal = new bootstrap.Modal(document.getElementById('modalGestionPacientes'));
        modal.show();
    };

    function renderizarListaPacientesModal() {
        var tbody = document.getElementById('tablaGestionPacientes');
        if (!tbody) return;
        window.DB.obtenerPacientes(1000, null).then(function(r) {
            var pacientes = (r && r.pacientes) ? r.pacientes : (r || []);
            if (pacientes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No hay pacientes registrados.</td></tr>';
                return;
            }
            pacientes.sort(function(a, b) { return parseInt(b.orden) - parseInt(a.orden); });
            var html = '';
            pacientes.forEach(function(p, index) {
                html += '<tr><td>' + (index + 1) + '</td><td class="fw-semibold">' + p.nombre + '</td><td>' + (p.cedula || '<span class="text-muted">N/A</span>') + '</td><td><span class="badge bg-primary badge-orden">#' + p.orden + '</span></td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="eliminarPacienteIndividual(' + p.id + ')"><i class="bi bi-trash"></i> Eliminar</button></td></tr>';
            });
            tbody.innerHTML = html;
        });
    }

    window.eliminarPacienteIndividual = function(pacienteId) {
        if (!confirm('¿Está seguro de eliminar este paciente?')) return;
        window.DB.obtenerPacientes(1000, null).then(function(r) {
            var pacientes = (r && r.pacientes) ? r.pacientes : (r || []);
            var index = pacientes.findIndex(function(p) { return p.id === pacienteId; });
            if (index === -1) {
                alert('Paciente no encontrado.');
                return;
            }
            pacientes.splice(index, 1);
            window.guardarPacientes(pacientes).then(function() {
                renderizarListaPacientesModal();
                refrescarPaginaActual();
                renderizarMetricas();
            }).catch(function(e) {
                console.error('[eliminarPacienteIndividual] Error:', e);
                alert('Error al eliminar el paciente.');
            });
        });
    };

    window.eliminarTodosPacientes = function() {
        if (!confirm('¿Está seguro de eliminar TODOS los pacientes?\nEsta acción no se puede deshacer.')) return;
        window.guardarPacientes([]).then(function() {
            renderizarListaPacientesModal();
            refrescarPaginaActual();
            renderizarMetricas();
        }).catch(function(e) {
            console.error('[eliminarTodosPacientes] Error:', e);
            alert('Error al eliminar los pacientes.');
        });
    };

    window.initRecepcion = initRecepcion;
    window.renderizarCola = renderizarCola;
    window.renderizarMetricas = renderizarMetricas;

})();
