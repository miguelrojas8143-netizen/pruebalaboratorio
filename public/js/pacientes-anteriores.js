// Módulo para gestionar la vista de pacientes de días anteriores
(function() {
    'use strict';

    var _paginacion = {
        pagina: 1,
        limit: 10,
        cursorActual: 0,
        pacientesBase: []
    };

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
            return p.fechaRegistro && p.fechaRegistro !== hoy;
        });
    }

    function buscarCoincidencia(p, termino) {
        return (p.nombre && p.nombre.toLowerCase().includes(termino)) ||
            (p.cedula && String(p.cedula).includes(termino)) ||
            (p.orden && String(p.orden).includes(termino));
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

    function renderizarTabla(pacientes) {
        var tbody = document.getElementById('tablaAnteriores');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (pacientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No se encontraron pacientes.</td></tr>';
            var totalEl = document.getElementById('totalAnteriores');
            if (totalEl) totalEl.textContent = '0 pacientes';
            return;
        }

        pacientes.sort(function(a, b) { return parseInt(b.orden) - parseInt(a.orden); });

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
                '<button class="btn btn-outline-info" onclick="window.verHistorialAnterior(' + p.id + ')" title="Historial"><i class="bi bi-clock-history"></i></button>' +
                '</div></td>';
            tbody.appendChild(fila);
        });

        var totalEl = document.getElementById('totalAnteriores');
        if (totalEl) totalEl.textContent = pacientes.length + ' pacientes';
    }

    function renderizarPagina() {
        var result = paginar(_paginacion.pacientesBase);
        actualizarControlesPaginacion(result.totalPaginas);
        renderizarTabla(result.page);
    }

    window.initPacientesAnteriores = function() {
        inicializarPaginacion();

        cargarPacientes().then(function(pacientes) {
            var hoy = calcularHoy();
            var anteriores = filtrarAnteriores(pacientes);
            anteriores.sort(function(a, b) { return parseInt(b.orden) - parseInt(a.orden); });
            _paginacion.pacientesBase = anteriores;
            _paginacion.pagina = 1;

            var result = paginar(anteriores);
            actualizarControlesPaginacion(result.totalPaginas);
            renderizarTabla(result.page);

            var buscador = document.getElementById('buscadorAnteriores');
            if (buscador) {
                buscador.addEventListener('input', function() {
                    var termino = this.value.toLowerCase();
                    if (!termino || termino.length < 3) {
                        _paginacion.pacientesBase = anteriores;
                        _paginacion.pagina = 1;
                        var r = paginar(anteriores);
                        actualizarControlesPaginacion(r.totalPaginas);
                        renderizarTabla(r.page);
                        return;
                    }
                    var filtrados = anteriores.filter(function(p) {
                        return buscarCoincidencia(p, termino);
                    });
                    _paginacion.pacientesBase = filtrados;
                    _paginacion.pagina = 1;
                    var r2 = paginar(filtrados);
                    actualizarControlesPaginacion(r2.totalPaginas);
                    renderizarTabla(r2.page);
                });
            }
        }).catch(function(e) {
            console.error('[pacientes-anteriores] Error:', e);
            mostrarNotificacion('Error al cargar pacientes: ' + e.message, 'danger');
        });
    };

    window.limpiarBusquedaAnteriores = function() {
        var buscador = document.getElementById('buscadorAnteriores');
        if (buscador) {
            buscador.value = '';
            window.initPacientesAnteriores();
        }
    };

    window.renderizarTablaAnteriores = renderizarTabla;
})();
