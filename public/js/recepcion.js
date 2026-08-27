// Módulo para gestionar la recepción de pacientes y la cola de espera
(function() {
    'use strict';

    function initRecepcion() {
        renderizarCola();
        inicializarSelect2();
        document.getElementById('formRegistro').addEventListener('submit', function(e) {
            e.preventDefault();
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

            var pacientes = window.obtenerPacientes();
            if (cedula && pacientes.some(function(p) { return p.cedula === cedula; })) {
                var pacienteExistente = pacientes.find(function(p) { return p.cedula === cedula; });
                document.getElementById('pacienteExistenteNombre').textContent = pacienteExistente.nombre;
                document.getElementById('cedulaDuplicada').textContent = pacienteExistente.cedula || 'N/A';
                document.getElementById('pacienteExistenteOrden').textContent = pacienteExistente.orden;
                document.getElementById('pacienteExistenteFecha').textContent = pacienteExistente.fechaRegistro || 'N/A';
                document.getElementById('pacienteVisitas').textContent = pacienteExistente.visitas || 1;
                document.getElementById('pacienteExistenteEdad').textContent = pacienteExistente.edad ? pacienteExistente.edad + ' años' : 'N/A';
                document.getElementById('btnIrOrdenExistente').href = 'vistas/orden.html?orden=' + pacienteExistente.orden;
                localStorage.setItem('pacienteExistenteRefer', JSON.stringify({
                    nombre: nombre,
                    sexo: sexo,
                    cedula: cedula,
                    fechaNac: fechaNac,
                    telefono: telefono,
                    edad: edad
                }));
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
            window.guardarPacientes(pacientes);
            localStorage.setItem('ultimaOrdenCreada', nuevoPaciente.orden);
            this.reset();
            renderizarCola();
            new bootstrap.Modal(document.getElementById('modalExito')).show();
        });
        document.getElementById('buscadorGlobal').addEventListener('input', function() {
            renderizarCola(this.value);
            window.buscarPaciente(this.value);
        });
        document.getElementById('btnNuevaOrden').addEventListener('click', function() {
            var modal = bootstrap.Modal.getInstance(document.getElementById('modalDuplicado'));
            modal.hide();
            var pacientes = window.obtenerPacientes();
            var datos = JSON.parse(localStorage.getItem('pacienteExistenteRefer'));
            if (!datos || !datos.cedula) return;
            var index = pacientes.findIndex(function(p) { return p.cedula === datos.cedula; });
            if (index === -1) return;
            if (!pacientes[index].visitas) {
                pacientes[index].visitas = 0;
            }
            pacientes[index].visitas++;
            var nuevoOrden = window.obtenerOrdenDiaria();
            pacientes[index].orden = String(nuevoOrden).padStart(3, '0');
            pacientes[index].fechaRegistro = new Date().toLocaleDateString('es-ES');
            if (datos.nombre) pacientes[index].nombre = datos.nombre;
            if (datos.sexo) pacientes[index].sexo = datos.sexo;
            if (datos.fechaNac) pacientes[index].fechaNac = datos.fechaNac;
            if (datos.telefono) pacientes[index].telefono = datos.telefono;
            if (datos.edad) pacientes[index].edad = datos.edad;
            pacientes[index].examenes = [];
            window.guardarPacientes(pacientes);
            localStorage.setItem('ultimaOrdenCreada', pacientes[index].orden);
            localStorage.removeItem('pacienteExistenteRefer');
            document.getElementById('formRegistro').reset();
            document.getElementById('edad').value = '';
            renderizarCola();
            window.location.href = 'vistas/orden.html?orden=' + pacientes[index].orden;
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
            var pacientes = window.obtenerPacientes();
            var t = termino.toLowerCase();
            var encontrados = pacientes.filter(function(p) {
                return p.nombre.toLowerCase().includes(t) ||
                    (p.cedula && p.cedula.includes(t)) ||
                    p.orden.includes(t);
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
                html += '<div class="list-group-item d-flex justify-content-between align-items-center"><div><strong>' + p.nombre + '</strong><small class="text-muted d-block">Cédula: ' + (p.cedula || 'N/A') + ' | Orden: #' + p.orden + ' | Visitas: ' + (p.visitas || 1) + '</small></div><div class="d-flex gap-2"><a href="vistas/orden.html?orden=' + p.orden + '" class="btn btn-sm btn-outline-primary"><i class="bi bi-arrow-right-circle"></i> Ir a Orden</a><button class="btn btn-sm btn-success" onclick="window.crearNuevaOrden(' + p.id + ')"><i class="bi bi-plus-circle"></i> Nueva Orden</button></div></div>';
            });
            listaDiv.innerHTML = html;
            resultadosDiv.style.display = 'block';
        };
        window.crearNuevaOrden = function(pacienteId) {
            var pacientes = window.obtenerPacientes();
            var index = pacientes.findIndex(function(p) { return p.id === pacienteId; });
            if (index === -1) {
                alert('Paciente no encontrado.');
                return;
            }
            if (!pacientes[index].visitas) {
                pacientes[index].visitas = 0;
            }
            pacientes[index].visitas++;
            var nuevoOrden = window.obtenerOrdenDiaria();
            pacientes[index].orden = String(nuevoOrden).padStart(3, '0');
            pacientes[index].fechaRegistro = new Date().toLocaleDateString('es-ES');
            pacientes[index].examenes = [];
            window.guardarPacientes(pacientes);
            localStorage.setItem('ultimaOrdenCreada', pacientes[index].orden);
            var resultadosDiv = document.getElementById('resultadosBusqueda');
            if (resultadosDiv) resultadosDiv.style.display = 'none';
            var buscador = document.getElementById('buscadorGlobal');
            if (buscador) buscador.value = '';
            window.location.href = 'vistas/orden.html?orden=' + pacientes[index].orden;
        };
    }

    function renderizarCola(filtro) {
        var pacientes = window.obtenerPacientes();
        var tbody = document.getElementById('tablaCola');
        tbody.innerHTML = '';
        var termino = (filtro || '').toLowerCase();
        var pacientesFiltrados = pacientes.filter(function(p) {
            return p.nombre.toLowerCase().includes(termino) ||
                (p.cedula && p.cedula.includes(termino)) ||
                p.orden.includes(termino);
        });
        pacientesFiltrados.sort(function(a, b) { return parseInt(a.orden) - parseInt(b.orden); });
        document.getElementById('totalPacientes').textContent = pacientesFiltrados.length + ' pacientes';
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

    function inicializarSelect2() {
        window.refrescarSelect2Catalogos();
    }

    window.initRecepcion = initRecepcion;

})();
