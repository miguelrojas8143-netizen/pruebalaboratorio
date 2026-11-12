/**
 * Módulo para gestionar la orden de exámenes de laboratorio 
 */

(function() {
    'use strict';

    window.migrarExamenesOrina = function(examenes) {
        if (!examenes || !window.obtenerCatalogo) return false;
        var catalogo = window.obtenerCatalogo();
        var migrado = false;

        var tieneFormulario = examenes.some(function(e) { return e.tipoFormulario === 'uroanalisis'; });

        var examenesUroIndividuales = examenes.filter(function(e) {
            return e.area === 'Uroanálisis' && e.id && String(e.id).indexOf('ur_') === 0 && e.tipoFormulario !== 'uroanalisis';
        });

        if (examenesUroIndividuales.length > 0 && !tieneFormulario) {
            var datos = {};
            examenesUroIndividuales.forEach(function(e) {
                datos[e.id] = e.resultado || '';
            });

            window.examenesOrden = examenes.filter(function(e) {
                return !(e.area === 'Uroanálisis' && e.id && String(e.id).indexOf('ur_') === 0 && e.tipoFormulario !== 'uroanalisis');
            });

            var catalogoEntry = catalogo.find(function(e) { return e.id === 'uroanalisis'; });
            var nuevoExamen = {
                id: 'uroanalisis',
                nombre: catalogoEntry ? (catalogoEntry.nombre || 'Uroanálisis') : 'Uroanálisis',
                area: 'Uroanálisis',
                unidad: '',
                tipoFormulario: 'uroanalisis',
                tipo: 'uroanalisis',
                resultado: JSON.stringify(datos)
            };
            window.examenesOrden.push(nuevoExamen);
            examenes = window.examenesOrden;
            migrado = true;
        }

        examenes.filter(function(e) { return e.id === 'examen_orina' && !e.tipoFormulario; }).forEach(function(e) {
            e.tipoFormulario = 'uroanalisis';
            e.tipo = 'uroanalisis';
            e.resultado = e.resultado || '{}';
            migrado = true;
        });

        if (migrado) {
            try {
                var ordenActual = window.getOrden ? window.getOrden() : '';
                if (window.pacienteActivo && !window.pacienteActivo.esArchivada &&
                    window.pacienteActivo.orden === ordenActual) {
                    window.pacienteActivo.examenes = examenes;
                    if (window.api && window.api.guardarPacienteExamenes) {
                        window.api.guardarPacienteExamenes(ordenActual, examenes).catch(function(e) {
                            console.error('[migrarExamenesOrina] Error:', e);
                        });
                    }
                }
            } catch(e) {}
        }
        return migrado;
    };

    async function initOrden(orden) {
        var ordenActual = String(orden || '').padStart(3, '0');
        try {
            var result = await window.api.obtenerPacientePorOrden(ordenActual);
            if (!result.success || !result.paciente) {
                window.Notifications.error('Paciente no encontrado para la orden: ' + ordenActual);
                window.location.href = '../index.html';
                return;
            }
            var paciente = result.paciente;
            var examenesGuardados = (result.examenes || []).map(function(e) {
                if (paciente.esArchivada) {
                    return Object.assign({}, e, {
                        id: e.examen_id || e.id || e.nombre_examen,
                        nombre: e.nombre_examen || e.nombre || '',
                        resultado: e.resultado || ''
                    });
                }
                return {
                    id: e.examen_id || e.id || e.nombre_examen,
                    examen_id: e.examen_id || e.id || null,
                    nombre: e.nombre_examen || e.nombre || '',
                    grupoPerfil: e.grupoPerfil || null,
                    resultado: e.resultado || ''
                };
            });
            paciente.examenes = window.enriquecerExamenesDesdeCatalogo
                ? window.enriquecerExamenesDesdeCatalogo(examenesGuardados)
                : examenesGuardados;
            paciente.id = paciente.id || null;
            paciente.visitas = paciente.visitas || 1;
            paciente.refAdaptadas = paciente.refAdaptadas || false;
            paciente.historial = paciente.historial || [];
            paciente.perfiles = paciente.perfiles || [];
            paciente.telefono = paciente.telefono || '';
            document.getElementById('pacienteNombre').textContent = paciente.nombre;
            document.getElementById('pacienteCedula').textContent = paciente.cedula || 'N/A';
            document.getElementById('pacienteFechaNac').textContent = paciente.fechaNac || 'N/A';
            document.getElementById('pacienteEdad').textContent = paciente.edad ? paciente.edad + ' años' : 'N/A';
            document.getElementById('pacienteTelefono').textContent = paciente.telefono || 'N/A';
            document.getElementById('pacienteOrden').textContent = paciente.orden;
            document.getElementById('pacienteVisitas').textContent = paciente.visitas;
            window.pacienteActivo = paciente;
            window.examenesOrden = paciente.examenes || [];
            var catalogoActual = window.obtenerCatalogo();
            window.examenesOrden.forEach(function(examen) {
                var catalogoExamen = catalogoActual.find(function(item) { return item.id === examen.id; });
                if (!catalogoExamen || catalogoExamen.area !== 'Bacteriología') return;
                if (!examen.unidad || examen.unidad === 'N/A') examen.unidad = catalogoExamen.unidad;
                if (!examen.refTexto || examen.refTexto === 'Según criterio del bioquímico') {
                    examen.refTexto = catalogoExamen.refTexto;
                }
            });
            if (!paciente.esArchivada) window.migrarExamenesOrina(window.examenesOrden);
            var chkRef = document.getElementById('refAdaptadas');
            if (chkRef) {
                chkRef.checked = !!paciente.refAdaptadas;
                if (paciente.refAdaptadas) {
                    setTimeout(function() {
                        var inputs = document.querySelectorAll('#tablaExamenes .resultado-input');
                        inputs.forEach(function(input) { window.validarResultado(input); });
                    }, 100);
                }
            }
            window.refrescarSelect2Catalogos();
            renderizarTablaExamenes();
            inicializarDelegadosResultados();
            inicializarNavegacionTabResultados();
            renderizarHistorial();

            var alertaSinGuardar = document.getElementById('alertSinGuardar');
            if (alertaSinGuardar) {
                alertaSinGuardar.style.display = (window.pacienteActivoTieneCambiosSinGuardar() ? 'block' : 'none');
            }
        } catch (err) {
            console.error('[initOrden] Error:', err);
            window.Notifications.error('Error cargando la orden: ' + err.message);
            window.location.href = '../index.html';
        }
    }

    window.pacienteActivoTieneCambiosSinGuardar = function() {
        if (!window.examenesOrden || !window.pacienteActivo) return false;
        try {
            return JSON.stringify(window.examenesOrden) !== JSON.stringify(window.pacienteActivo.examenes);
        } catch (e) {
            return false;
        }
    };

    var examenesEnSeleccionImpresion = [];

    function actualizarContadorSeleccionImpresion() {
        var lista = document.getElementById('listaExamenesImpresion');
        var contador = document.getElementById('seleccionImpresionContador');
        if (!lista || !contador) return;
        var total = lista.querySelectorAll('input[type="checkbox"]').length;
        var seleccionados = lista.querySelectorAll('input[type="checkbox"]:checked').length;
        contador.textContent = 'Seleccionados: ' + seleccionados + ' de ' + total;
    }

    window.abrirModalSeleccionImpresion = function() {
        var lista = document.getElementById('listaExamenesImpresion');
        var elementoModal = document.getElementById('modalSeleccionImpresion');
        if (!lista || !elementoModal || !window.bootstrap || !window.bootstrap.Modal) {
            window.Notifications.error('No se pudo abrir la selección de exámenes para imprimir.');
            return;
        }

        examenesEnSeleccionImpresion = (window.examenesOrden || []).slice();
        if (examenesEnSeleccionImpresion.length === 0) {
            window.Notifications.error('La orden no tiene exámenes para imprimir.');
            return;
        }

        lista.replaceChildren();
        examenesEnSeleccionImpresion.forEach(function(examen, indice) {
            var etiqueta = document.createElement('label');
            etiqueta.className = 'examen-impresion-item';

            var casilla = document.createElement('input');
            casilla.type = 'checkbox';
            casilla.className = 'form-check-input';
            casilla.checked = true;
            casilla.value = String(indice);
            casilla.addEventListener('change', actualizarContadorSeleccionImpresion);

            var detalle = document.createElement('span');
            detalle.className = 'examen-impresion-detalle';

            var nombre = document.createElement('span');
            nombre.className = 'fw-semibold';
            nombre.textContent = examen.nombre || examen.id || 'Examen sin nombre';

            var area = document.createElement('span');
            area.className = 'examen-impresion-area';
            area.textContent = examen.area || examen.categoria || '';

            detalle.appendChild(nombre);
            if (area.textContent) detalle.appendChild(area);
            etiqueta.appendChild(casilla);
            etiqueta.appendChild(detalle);
            lista.appendChild(etiqueta);
        });

        actualizarContadorSeleccionImpresion();
        window.bootstrap.Modal.getOrCreateInstance(elementoModal).show();
    };

    window.seleccionarTodosParaImpresion = function(marcar) {
        var lista = document.getElementById('listaExamenesImpresion');
        if (!lista) return;
        lista.querySelectorAll('input[type="checkbox"]').forEach(function(casilla) {
            casilla.checked = !!marcar;
        });
        actualizarContadorSeleccionImpresion();
    };

    window.confirmarSeleccionImpresion = function() {
        var lista = document.getElementById('listaExamenesImpresion');
        if (!lista) {
            window.Notifications.error('No se encontró la lista de exámenes para imprimir.');
            return;
        }

        var indicesSeleccionados = Array.prototype.map.call(
            lista.querySelectorAll('input[type="checkbox"]:checked'),
            function(casilla) { return Number(casilla.value); }
        );
        if (indicesSeleccionados.length === 0) {
            window.Notifications.error('Seleccione al menos un examen para generar el reporte.');
            return;
        }

        var idsSeleccionados = indicesSeleccionados.map(function(indice) {
            var examen = examenesEnSeleccionImpresion[indice];
            return String(examen.examen_id || examen.id || examen.nombre || '');
        }).filter(function(id) { return id !== ''; });

        if (idsSeleccionados.length === 0) {
            window.Notifications.error('No se pudieron identificar los exámenes seleccionados.');
            return;
        }

        window.bootstrap.Modal.getOrCreateInstance(
            document.getElementById('modalSeleccionImpresion')
        ).hide();
        window.irAImpresion(idsSeleccionados);
    };

    window.iniciarNuevaVisita = async function() {
        if (window.pacienteActivoTieneCambiosSinGuardar && window.pacienteActivoTieneCambiosSinGuardar()) {
            var confirmado = await window.Notifications.confirm({
                title: 'Cambios sin guardar',
                message: 'Hay exámenes sin guardar en la orden actual.\n\nSi continúa, los cambios no guardados se perderán y la orden actual se archivará con los datos guardados.\n\n¿Desea continuar de todos modos?',
                type: 'warning',
                confirmText: 'Sí, continuar',
                cancelText: 'No'
            });
            if (!confirmado) {
                return;
            }
        }
        window.crearNuevaVisita(window.pacienteActivo.id, { actualizarPaciente: false, navegar: true });
    };

    window.toggleRefAdaptadas = function() {
        var chk = document.getElementById('refAdaptadas');
        if (!chk || !window.pacienteActivo) return;
        window.pacienteActivo.refAdaptadas = chk.checked;
        var inputs = document.querySelectorAll('#tablaExamenes .resultado-input');
        inputs.forEach(function(input) { window.validarResultado(input); });
    };

    function crearExamenDesdeCatalogo(datos) {
        var nuevoExamen = {
            id: datos.id,
            nombre: datos.nombre,
            area: datos.area || 'General',
            unidad: datos.unidad,
            refMin: datos.refMin,
            refMax: datos.refMax,
            refTexto: datos.refTexto,
            resultado: ''
        };
        if (datos.tipo === 'texto') {
            nuevoExamen.tipo = 'texto';
        }
        if (datos.tipo === 'tipo_sanguineo') {
            nuevoExamen.tipo = 'tipo_sanguineo';
        }
        if (datos.tipo === 'tipo_sanguineo_completo') {
            nuevoExamen.tipo = 'tipo_sanguineo_completo';
        }
        if (datos.tipo === 'seleccion_unica') {
            nuevoExamen.tipo = 'seleccion_unica';
            nuevoExamen.opciones = datos.opciones || [];
            if (nuevoExamen.opciones.length === 0 && window.obtenerCatalogo) {
                var itemCatalogo = window.obtenerCatalogo().find(function(e) { return e.id === datos.id; });
                if (itemCatalogo && itemCatalogo.opciones) {
                    nuevoExamen.opciones = itemCatalogo.opciones;
                }
            }
        }
        if (datos.tipo === 'multiselect_cantidad') {
            nuevoExamen.tipo = 'multiselect_cantidad';
            nuevoExamen.opciones = datos.opciones || [];
            if (nuevoExamen.opciones.length === 0 && window.obtenerCatalogo) {
                var itemCatalogoMs = window.obtenerCatalogo().find(function(e) { return e.id === datos.id; });
                if (itemCatalogoMs && itemCatalogoMs.opciones) {
                    nuevoExamen.opciones = itemCatalogoMs.opciones;
                }
            }
            nuevoExamen.resultado = '{}';
        }
        if (datos.tipo === 'heces' || datos.id === 'feces') {
            nuevoExamen.tipoFormulario = 'heces';
            nuevoExamen.tipo = 'heces';
            nuevoExamen.resultado = '{}';
        }
        if (datos.tipo === 'uroanalisis') {
            nuevoExamen.tipoFormulario = 'uroanalisis';
            nuevoExamen.tipo = 'uroanalisis';
            nuevoExamen.resultado = '{}';
        }
        if (datos.tipo === 'antibiograma') {
            nuevoExamen.tipoFormulario = 'antibiograma';
            nuevoExamen.tipo = 'antibiograma';
            nuevoExamen.resultado = '{}';
        }
        if (datos.id === 'examen_heces' || datos.id === 'feces') {
            nuevoExamen.tipoFormulario = 'heces';
            nuevoExamen.tipo = 'heces';
            nuevoExamen.resultado = nuevoExamen.resultado || '{}';
        }
        if (datos.grupo) {
            nuevoExamen.grupo = datos.grupo;
        }
        if (!nuevoExamen.tipoFormulario && window.App.examenesDetallados[datos.id] && window.App.examenesDetallados[datos.id].items) {
            nuevoExamen.tipo = 'perfil';
            nuevoExamen.resultado = '{}';
        }
        return nuevoExamen;
    }

    function esFormularioHeces(examen) {
        return !!examen && (
            examen.tipoFormulario === 'heces' ||
            examen.tipo === 'heces' ||
            examen.id === 'examen_heces' ||
            examen.id === 'feces'
        );
    }

    function tieneResultadosFormulario(examen) {
        return window.examenTieneResultados(examen);
    }

    var gruposExamenesExpandidos = new Set();

    function renderizarTablaExamenes() {
        var tbody = document.getElementById('tablaExamenes');
        tbody.innerHTML = '';
        var tieneTipoSanguineoCompleto = (window.examenesOrden || []).some(function(e) {
            return e.id === 'grupo_sanguineo_abo' && window.examenesOrden.some(function(otro) {
                return otro.id === 'factor_rh';
            });
        });
        var gruposContados = [];
        var totalExamenes = (window.examenesOrden || []).filter(function(examen) {
            if (tieneTipoSanguineoCompleto && examen.id === 'factor_rh') return false;
            if (!examen.grupoPerfil) return true;
            if (gruposContados.indexOf(examen.grupoPerfil) !== -1) return false;
            gruposContados.push(examen.grupoPerfil);
            return true;
        }).length;
        document.getElementById('totalExamenes').textContent = totalExamenes + ' exámenes';
        if (!window.examenesOrden || window.examenesOrden.length === 0) {
            gruposExamenesExpandidos.clear();
            tbody.innerHTML = '<tr id="filaVaciaExamenes"><td colspan="5" class="sin-examenes"><i class="bi bi-inbox display-4"></i><p class="mt-2">No hay exámenes agregados. Use el selector de la izquierda.</p></td></tr>';
            return;
        }
        var grupoAnterior = null;
        var grupoId = 0;
        var gruposPresentes = new Set();
        window.examenesOrden.forEach(function(examen, index) {
            if (tieneTipoSanguineoCompleto && examen.id === 'factor_rh') return;
            var grupoActual = examen.grupoPerfil || 'Exámenes individuales';
            if (grupoActual !== grupoAnterior) {
                gruposPresentes.add(grupoActual);
                var filaGrupo = document.createElement('tr');
                var expandido = gruposExamenesExpandidos.has(grupoActual);
                filaGrupo.className = 'grupo-examen-row' + (expandido ? '' : ' grupo-colapsado');
                filaGrupo.setAttribute('data-grupo-id', grupoId);
                filaGrupo.setAttribute('data-grupo-nombre', grupoActual);
                filaGrupo.innerHTML = '<td colspan="5" class="grupo-header-clickable"><i class="bi bi-chevron-right me-2 grupo-toggle-icon"></i>' + grupoActual + '<span class="badge bg-secondary ms-2">' + window.examenesOrden.filter(function(e) { return (e.grupoPerfil || 'Exámenes individuales') === grupoActual && !(tieneTipoSanguineoCompleto && e.id === 'factor_rh'); }).length + '</span></td>';
                filaGrupo.setAttribute('onclick', 'window.toggleGrupoExamen(' + grupoId + ')');
                tbody.appendChild(filaGrupo);
                grupoAnterior = grupoActual;
                grupoId++;
            }
            var fila = document.createElement('tr');
            fila.className = 'examen-row' + (gruposExamenesExpandidos.has(grupoActual) ? '' : ' d-none');
            fila.setAttribute('data-examen-id', examen.id);
            fila.setAttribute('data-grupo-id', grupoId - 1);
            if (esFormularioHeces(examen)) {
                examen.tipoFormulario = 'heces';
                examen.tipo = 'heces';
            }
            var tieneResultados = tieneResultadosFormulario(examen);
            var btnClass = 'btn examen-action-btn btn-sm' + (tieneResultados ? ' has-results' : '');
            if (esFormularioHeces(examen)) {
                var accionHeces = tieneResultados ? 'Editar resultados' : 'Cargar resultados';
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td colspan="3"><button type="button" class="' + btnClass + '" onclick="window.abrirFormularioHeces(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i>' + accionHeces + '</button></td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            } else if (examen.tipoFormulario === 'uroanalisis') {
                var accionUro = tieneResultados ? 'Editar resultados' : 'Cargar resultados';
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td colspan="3"><button type="button" class="' + btnClass + '" onclick="window.abrirFormularioUroanalisis(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i>' + accionUro + '</button></td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            } else if (examen.tipoFormulario === 'antibiograma') {
                var resumenAb = '';
                try {
                    var datosAb = JSON.parse(examen.resultado || '{}');
                    var antibiotics = datosAb.antibioticos || [];
                    var resistentes = antibiotics.filter(function(a) { return a.resultado === 'Resistente'; });
                    if (resistentes.length > 0) {
                        resumenAb = '<br><small class="text-danger">Resistentes: ' + resistentes.map(function(a) { return a.antibiotico; }).join(', ') + '</small>';
                    } else if (antibiotics.length > 0) {
                        resumenAb = '<br><small class="text-success">' + antibiotics.length + ' antibióticos configurados</small>';
                    }
                } catch(e) {}
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td><button type="button" class="' + btnClass + '" onclick="window.abrirFormularioAntibiograma(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i>Cargar Resultados</button>' + resumenAb + '</td><td class="text-muted small">-</td><td>-</td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            } else if (examen.tipo === 'texto') {
                var refTexto = examen.refTexto ||
                    ((examen.refMin !== undefined && examen.refMax !== undefined && (examen.refMin || examen.refMax))
                        ? examen.refMin + ' - ' + examen.refMax : '-');
                var btnClass = 'btn examen-action-btn btn-sm' + (tieneResultados ? ' has-results' : '');
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td colspan="3"><button type="button" class="' + btnClass + '" onclick="window.abrirEditorResultadoExamen(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i>Cargar resultados</button></td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            } else if (examen.tipo === 'tipo_sanguineo' || examen.tipo === 'tipo_sanguineo_completo') {
                var nombreTipoSanguineo = tieneTipoSanguineoCompleto ? 'Grupo Sanguíneo' : examen.nombre;
                var eliminarTipoSanguineo = tieneTipoSanguineoCompleto ? 'window.eliminarTipoSanguineo(this)' : 'window.eliminarExamen(this)';
                var btnClass = 'btn examen-action-btn btn-sm' + (tieneResultados ? ' has-results' : '');
                fila.innerHTML = '<td class="fw-semibold align-top">' + nombreTipoSanguineo + '</td><td><button type="button" class="' + btnClass + '" onclick="window.abrirFormularioTipoSanguineo()"><i class="bi bi-pencil-square me-1"></i>Cargar resultados</button></td><td class="text-muted small">-</td><td>-</td><td class="text-center align-top"><button class="btn btn-sm btn-outline-danger" onclick="' + eliminarTipoSanguineo + '" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            } else if (examen.tipo === 'seleccion_unica') {
                var opcionesHtml2 = (examen.opciones || []).map(function(opt) { return '<option value="' + opt + '" ' + (examen.resultado === opt ? 'selected' : '') + '>' + opt + '</option>'; }).join('');
                if (window.esSecrecionVaginal(examen)) {
                    var btnClass = 'btn examen-action-btn btn-sm' + (tieneResultados ? ' has-results' : '');
                    fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td colspan="3"><button type="button" class="' + btnClass + '" onclick="window.abrirEditorResultadoExamen(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i>Cargar resultados</button></td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
                } else {
                    fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td><select class="form-select resultado-input"><option value="">Seleccionar...</option>' + opcionesHtml2 + '</select></td><td class="text-muted small">-</td><td>-</td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
                }
            } else if (examen.tipo === 'perfil' && window.App.examenesDetallados[examen.id]) {
                var detalle = window.App.examenesDetallados[examen.id];
                var btnExpandir = (detalle && detalle.items && detalle.items.length > 0) ? '<button type="button" class="btn examen-action-btn btn-sm' + (tieneResultados ? ' has-results' : '') + '" id="btnToggleItems_' + examen.id + '" onclick="window.toggleItemsExamenTabla(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i> Cargar resultados</button>' : '';
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td colspan="3">' + btnExpandir + '</td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            } else if (examen.tipo === 'multiselect_cantidad') {
                var resumenFrotis = '';
                try {
                    var datosFrotis = JSON.parse(examen.resultado || '{}');
                    var items = Object.keys(datosFrotis).filter(function(k) { return datosFrotis[k] !== ''; });
                    if (items.length > 0) {
                        resumenFrotis = '<br><small class="text-success">' + items.map(function(k) {
                            return k + (datosFrotis[k] ? ' — ' + datosFrotis[k] : '');
                        }).join('; ') + '</small>';
                    }
                } catch(e) {}
                var btnClass = 'btn examen-action-btn btn-sm' + (tieneResultados ? ' has-results' : '');
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td colspan="3"><button type="button" class="' + btnClass + '" onclick="window.abrirFormularioFrotis(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i> Configurar</button>' + resumenFrotis + '</td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            } else {
                var btnClass = 'btn examen-action-btn btn-sm' + (tieneResultados ? ' has-results' : '');
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td colspan="3"><button type="button" class="' + btnClass + '" onclick="window.abrirEditorResultadoExamen(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i>Cargar resultados</button></td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            }
            tbody.appendChild(fila);
        });
        gruposExamenesExpandidos.forEach(function(nombre) {
            if (!gruposPresentes.has(nombre)) gruposExamenesExpandidos.delete(nombre);
        });
    }

    window.toggleGrupoExamen = function(grupoId) {
        var header = document.querySelector('#tablaExamenes tr.grupo-examen-row[data-grupo-id="' + grupoId + '"]');
        if (!header) return;

        var estabaExpandido = !header.classList.contains('grupo-colapsado');
        var headers = document.querySelectorAll('#tablaExamenes tr.grupo-examen-row');
        gruposExamenesExpandidos.clear();
        headers.forEach(function(grupo) {
            grupo.classList.add('grupo-colapsado');
            var filas = document.querySelectorAll('#tablaExamenes tr.examen-row[data-grupo-id="' + grupo.getAttribute('data-grupo-id') + '"]');
            filas.forEach(function(row) {
                row.classList.add('d-none');
            });
        });

        if (!estabaExpandido) {
            header.classList.remove('grupo-colapsado');
            gruposExamenesExpandidos.add(header.getAttribute('data-grupo-nombre'));
            document.querySelectorAll('#tablaExamenes tr.examen-row[data-grupo-id="' + grupoId + '"]').forEach(function(row) {
                row.classList.remove('d-none');
            });
        }
    };

    window.toggleTodosGrupos = function() {
        var headers = document.querySelectorAll('#tablaExamenes tr.grupo-examen-row');
        var allCollapsed = headers.length > 0 && Array.from(headers).every(function(h) { return h.classList.contains('grupo-colapsado'); });
        gruposExamenesExpandidos.clear();
        headers.forEach(function(header) {
            var rows = document.querySelectorAll('#tablaExamenes tr.examen-row[data-grupo-id="' + header.getAttribute('data-grupo-id') + '"]');
            if (allCollapsed) {
                header.classList.remove('grupo-colapsado');
                gruposExamenesExpandidos.add(header.getAttribute('data-grupo-nombre'));
                rows.forEach(function(r) { r.classList.remove('d-none'); });
            } else {
                header.classList.add('grupo-colapsado');
                rows.forEach(function(r) { r.classList.add('d-none'); });
            }
        });
    };

    window.agregarExamen = function() {
        var examenId = $('#selectorExamenes').val();
        if (!examenId) {
            window.Notifications.warning('Por favor seleccione un examen.');
            return;
        }
        var catalogo = window.obtenerCatalogo();
        var catalogoMap = {};
        catalogo.forEach(function(e) { catalogoMap[e.id] = e; });
        if (examenId === 'tipo_sanguineo_completo') {
            var idsTipoSanguineo = ['grupo_sanguineo_abo', 'factor_rh'];
            if (idsTipoSanguineo.some(function(id) {
                return window.examenesOrden.some(function(e) { return e.id === id; });
            })) {
                window.Notifications.warning('Este examen ya está en la orden.');
                return;
            }
            idsTipoSanguineo.forEach(function(id) {
                var examenTipo = crearExamenDesdeCatalogo(catalogoMap[id]);
                examenTipo.tipoFormulario = 'tipo_sanguineo';
                examenTipo.tipoSanguineoCompleto = true;
                window.examenesOrden.push(examenTipo);
            });
            $('#selectorExamenes').val(null).trigger('change');
            renderizarTablaExamenes();
            return;
        }
        if (window.App.perfiles[examenId]) {
            $("#selectorExamenes").val(null).trigger("change");
            var perfil = window.App.perfiles[examenId];
            var esSecrecionVaginalIndividual = examenId === 'perfil_secrecion_vaginal';
            var catalogo = window.obtenerCatalogo();
            var catalogoMap = {};
            catalogo.forEach(function(e) { catalogoMap[e.id] = e; });
            var idsExistentes = window.examenesOrden.map(function(e) { return e.id; });

            if (examenId === 'hematologia_completa') {
                if (idsExistentes.indexOf(examenId) !== -1) {
                    window.Notifications.warning('Este examen ya está en la orden.');
                    return;
                }
                var datosHematologia = catalogoMap[examenId] || perfil;
                var hematologia = crearExamenDesdeCatalogo(datosHematologia);
                hematologia.tipo = 'perfil';
                hematologia.resultado = '{}';
                hematologia.grupoPerfil = perfil.nombre;
                window.examenesOrden.push(hematologia);
                if (window.pacienteActivo) {
                    if (!window.pacienteActivo.perfiles) window.pacienteActivo.perfiles = [];
                    if (!window.pacienteActivo.perfiles.includes(examenId)) window.pacienteActivo.perfiles.push(examenId);
                }
                renderizarTablaExamenes();
                return;
            }

            var examenesPerfil = [];
            perfil.examenes.forEach(function(examenPerfil) {
                if (examenPerfil.tipo === 'perfil' && window.App.perfiles[examenPerfil.id]) {
                    var perfilHijo = window.App.perfiles[examenPerfil.id];
                    if (examenId === 'perfil_veinte' && examenPerfil.id === 'hematologia_completa') {
                        var datosHematologiaPerfil = catalogoMap[examenPerfil.id] || perfilHijo;
                        var hematologiaPerfil = window.crearExamenDesdeCatalogo(datosHematologiaPerfil);
                        hematologiaPerfil.tipo = 'perfil';
                        hematologiaPerfil.resultado = '{}';
                        examenesPerfil.push(hematologiaPerfil);
                    } else {
                        perfilHijo.examenes.forEach(function(examenHijo) {
                            var override = catalogoMap[examenHijo.id];
                            var merged = override ? Object.assign({}, examenHijo, override) : examenHijo;
                            examenesPerfil.push(window.crearExamenDesdeCatalogo(merged));
                        });
                    }
                } else {
                    var override = catalogoMap[examenPerfil.id];
                    var merged = override ? Object.assign({}, examenPerfil, override) : examenPerfil;
                    examenesPerfil.push(window.crearExamenDesdeCatalogo(merged));
                }
            });
            var nuevos = examenesPerfil.filter(function(e) { return !idsExistentes.includes(e.id); });
            if (!esSecrecionVaginalIndividual) {
                nuevos.forEach(function(examen) {
                    examen.grupoPerfil = perfil.nombre;
                });
            }
            window.examenesOrden = window.examenesOrden.map(function(e) {
                var actualizado = examenesPerfil.find(function(n) { return n.id === e.id; });
                if (actualizado) {
                    e.tipo = actualizado.tipo;
                    e.tipoFormulario = actualizado.tipoFormulario;
                    e.opciones = actualizado.opciones;
                    e.nombre = actualizado.nombre;
                    e.area = actualizado.area;
                    e.unidad = actualizado.unidad;
                    e.grupo = actualizado.grupo;
                    if (esSecrecionVaginalIndividual) delete e.grupoPerfil;
                }
                return e;
            }).concat(nuevos);
            if (window.pacienteActivo && !esSecrecionVaginalIndividual) {
                if (!window.pacienteActivo.perfiles) window.pacienteActivo.perfiles = [];
                if (!window.pacienteActivo.perfiles.includes(examenId)) window.pacienteActivo.perfiles.push(examenId);
            }
            renderizarTablaExamenes();
            return;
        }
        if (window.examenesOrden.some(function(e) { return e.id === examenId; })) {
            window.Notifications.warning('Este examen ya está en la orden.');
            return;
        }
        var datos = catalogo.find(function(e) { return e.id === examenId; });
        if (!datos) return;
        var nuevoExamen = crearExamenDesdeCatalogo(datos);
        window.examenesOrden.push(nuevoExamen);
        $('#selectorExamenes').val(null).trigger('change');
        renderizarTablaExamenes();
    };

    function _debounceValidarYCalcular(input) {
        if (window.validarResultado) window.validarResultado(input);
        if (window.ejecutarCalculosAutomaticos) window.ejecutarCalculosAutomaticos();
    }

    var _debounceValidarYCalcularFn = debounce(_debounceValidarYCalcular, 250);

    function actualizarCeldaExamen(examenId, newValue) {
        var fila = document.querySelector('tr[data-examen-id="' + examenId + '"]');
        if (!fila) return false;
        var input = fila.querySelector('select.form-select');
        if (input) {
            if (input.value !== String(newValue)) {
                input.value = newValue;
            }
            if (window.validarResultado) window.validarResultado(input);
        }
        return true;
    }

    window.actualizarCeldasCalculadas = function(cambios) {
        Object.keys(cambios).forEach(function(examenId) {
            actualizarCeldaExamen(examenId, cambios[examenId]);
        });
    };

    var _delegadosResultadosInstalados = false;

    function inicializarDelegadosResultados() {
        if (_delegadosResultadosInstalados) return;
        _delegadosResultadosInstalados = true;

        var tbody = document.getElementById('tablaExamenes');
        if (!tbody) return;

        tbody.addEventListener('change', function(event) {
            var select = event.target.closest('select.form-select');
            if (!select || !select.closest('#tablaExamenes')) return;
            var fila = select.closest('tr');
            if (!fila) return;
            var examenId = fila.getAttribute('data-examen-id');
            var examenes = window.examenesOrden || [];
            var examen = examenes.find(function(e) { return e.id === examenId; });
            if (examen) {
                examen.resultado = select.value;
            }
            _debounceValidarYCalcularFn(select);
        });

        tbody.addEventListener('input', function(event) {
            var input = event.target.closest('.resultado-input');
            if (!input || !input.closest('#tablaExamenes')) return;
            var fila = input.closest('tr');
            if (!fila) return;
            var examenId = fila.getAttribute('data-examen-id');
            var examenes = window.examenesOrden || [];
            var examen = examenes.find(function(e) { return e.id === examenId; });
            if (examen) {
                examen.resultado = input.value;
            }
            _debounceValidarYCalcularFn(input);
        });
    }

    var _navegacionTabResultadosInstalada = false;

    function inicializarNavegacionTabResultados() {
        if (_navegacionTabResultadosInstalada) return;
        _navegacionTabResultadosInstalada = true;

        var zonasResultados = [
            { selector: '#tablaExamenes', campos: '.resultado-input' },
            { selector: '#modalItemsExamenBody', campos: '.tabla-item-input:not([readonly]), .observaciones-bioanalista-input, .editor-resultado-input' },
            { selector: '#formHeces', campos: 'input, select, textarea' },
            { selector: '#formUroanalisis', campos: 'input, select, textarea' },
            { selector: '#formularioAntibiograma', campos: '.abx-resultado, .abx-cmi, #antibiogramaObservaciones' },
            { selector: '#formularioTipoSanguineo', campos: 'select' },
            { selector: '#modalFrotisBody', campos: '.chk-frotis, .select-frotis' }
        ];

        document.addEventListener('keydown', function(event) {
            if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
            var actual = event.target;
            if (!actual || typeof actual.closest !== 'function') return;

            var zona = zonasResultados.find(function(item) {
                return actual.closest(item.selector);
            });
            if (!zona) return;

            var contenedor = actual.closest(zona.selector);
            var campos = Array.from(contenedor.querySelectorAll(zona.campos)).filter(function(campo) {
                return !campo.disabled && !campo.readOnly && !campo.hidden &&
                    campo.getClientRects().length > 0;
            });
            var indice = campos.indexOf(actual);
            if (indice < 0) return;

            var siguiente = campos[indice + (event.shiftKey ? -1 : 1)];
            if (!siguiente) return;
            event.preventDefault();
            siguiente.focus();
        });
    }

    window.actualizarResultado = function(input) {
        var fila = input.closest('tr');
        if (!fila) return;
        var examenId = fila.getAttribute('data-examen-id');
        var examenes = window.examenesOrden || [];
        var examen = examenes.find(function(e) { return e.id === examenId; });
        if (examen) {
            examen.resultado = input.value;
        }
        _debounceValidarYCalcularFn(input);
    };

    window.validarResultado = function(input) {
        var fila = input.closest('tr');
        if (!fila) return;
        var examenId = fila.getAttribute('data-examen-id');
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (examen && (examen.tipo === 'texto' || examen.tipo === 'tipo_sanguineo' || examen.tipo === 'seleccion_unica' || examen.tipo === 'multiselect_cantidad' || examen.tipoFormulario === 'heces' || examen.tipoFormulario === 'uroanalisis' || examen.tipoFormulario === 'antibiograma')) return;

        var refMin = examen ? parseFloat(examen.refMin) : 0;
        var refMax = examen ? parseFloat(examen.refMax) : 0;
        if (window.pacienteActivo && window.pacienteActivo.refAdaptadas && window.App.referencias) {
            var paciente = window.pacienteActivo;
            var edad = paciente.edad;
            var sexo = paciente.sexo;
            var esPediatrico = (edad !== null && edad !== undefined && edad !== '' && edad < 18);
            var categoriaEdad = esPediatrico ? 'pediatrico' : 'adulto';
            var refs;
            if (window.App.referencias.sexSpecific[examenId]) {
                refs = window.App.referencias.sexSpecific[examenId][categoriaEdad];
                if (refs && refs[sexo]) {
                    refMin = refs[sexo].refMin;
                    refMax = refs[sexo].refMax;
                }
            } else if (window.App.referencias.shared[examenId]) {
                refs = window.App.referencias.shared[examenId][categoriaEdad];
                if (refs) {
                    refMin = refs.refMin;
                    refMax = refs.refMax;
                }
            }
        }

        var valor = parseFloat(input.value);
        input.classList.remove('resultado-alto', 'resultado-bajo', 'resultado-normal');
        if (isNaN(valor)) return;
        if (valor < refMin) {
            input.classList.add('resultado-bajo');
        } else if (valor > refMax) {
            input.classList.add('resultado-alto');
        } else {
            input.classList.add('resultado-normal');
        }
    };

    async function persistirEliminacionExamenes(examenes) {
        var orden = window.pacienteActivo ? window.pacienteActivo.orden : window.getOrden();
        try {
            if (!orden || !window.api || typeof window.api.eliminarExamenesPaciente !== 'function') {
                throw new Error('No se pudo conectar con la base de datos para eliminar el examen.');
            }
            var respuesta = await window.api.eliminarExamenesPaciente(orden, examenes);
            if (!respuesta || !respuesta.success) {
                throw new Error((respuesta && respuesta.error) || 'No se pudo eliminar el examen.');
            }
        } catch (err) {
            console.error('[eliminarExamenesPaciente] Error:', err);
            window.Notifications.error('Error al eliminar el examen: ' + err.message);
            return false;
        }

        var ids = new Set(examenes.map(function(examen) { return String(examen.id || examen.examen_id || ''); }));
        var nombres = new Set(examenes.map(function(examen) {
            return String(examen.nombre || examen.nombre_examen || '').trim().toLocaleLowerCase();
        }).filter(Boolean));
        window.examenesOrden = (window.examenesOrden || []).filter(function(examen) {
            return !ids.has(String(examen.id || '')) &&
                !nombres.has(String(examen.nombre || '').trim().toLocaleLowerCase());
        });
        if (window.pacienteActivo) {
            window.pacienteActivo.examenes = JSON.parse(JSON.stringify(window.examenesOrden));
        }
        if (window.pacienteActivo && Array.isArray(window.pacienteActivo.historial)) {
            window.pacienteActivo.historial = window.pacienteActivo.historial.filter(function(registro) {
                var nombre = String(
                    registro.examen_completo || registro.examen || registro.nombre_examen || registro.nombre || ''
                ).trim().toLocaleLowerCase();
                return !nombres.has(nombre);
            });
        }
        renderizarTablaExamenes();
        renderizarHistorial();
        return true;
    }

    window.eliminarExamen = async function(btn) {
        var confirmado = await window.Notifications.confirm({
            title: 'Confirmar eliminación',
            message: '¿Está seguro de eliminar este examen y sus resultados guardados?',
            type: 'warning',
            confirmText: 'Sí',
            cancelText: 'Cancelar'
        });
        if (!confirmado) return;
        var fila = btn.closest('tr');
        var examenId = fila && fila.getAttribute('data-examen-id');
        var examen = (window.examenesOrden || []).find(function(item) { return item.id === examenId; });
        if (!examenId || !examen) {
            window.Notifications.error('No se pudo identificar el examen que desea eliminar.');
            return;
        }
        await persistirEliminacionExamenes([{
            id: examen.id,
            nombre: examen.nombre
        }]);
    };

    window.eliminarTipoSanguineo = async function() {
        var confirmado = await window.Notifications.confirm({
            title: 'Confirmar eliminación',
            message: '¿Está seguro de eliminar este examen y sus resultados guardados?',
            type: 'warning',
            confirmText: 'Sí',
            cancelText: 'Cancelar'
        });
        if (!confirmado) return;
        var examenesTipoSanguineo = (window.examenesOrden || []).filter(function(examen) {
            return examen.id === 'grupo_sanguineo_abo' || examen.id === 'factor_rh';
        }).map(function(examen) {
            return { id: examen.id, nombre: examen.nombre };
        });
        if (!examenesTipoSanguineo.length) {
            window.Notifications.error('No se encontró el examen de tipo sanguíneo que desea eliminar.');
            return;
        }
        await persistirEliminacionExamenes(examenesTipoSanguineo);
    };

    window.limpiarOrden = async function() {
        var confirmado = await window.Notifications.confirm({
            title: 'Confirmar limpieza',
            message: '¿Está seguro de eliminar todos los exámenes y sus resultados guardados de esta orden?',
            type: 'warning',
            confirmText: 'Sí, limpiar',
            cancelText: 'Cancelar'
        });
        if (!confirmado) return;
        var examenes = (window.examenesOrden || []).map(function(examen) {
            return { id: examen.id, nombre: examen.nombre };
        });
        if (!examenes.length) {
            window.examenesOrden = [];
            renderizarTablaExamenes();
            return;
        }
        await persistirEliminacionExamenes(examenes);
    };

    window.borrarTodosLosDatos = async function() {
        var confirmado = await window.Notifications.confirm({
            title: '¡Atención!',
            message: '¿Eliminar TODOS los datos del laboratorio?\nEsta acción no se puede deshacer.',
            type: 'error',
            confirmText: 'Sí, eliminar todo',
            cancelText: 'Cancelar'
        });
        if (!confirmado) return;
        var localStorageKeys = ['pacientesLab', 'ultimoOrdenLab', 'ordenesDiariasLab', 'pacienteExistenteRefer', 'ultimaOrdenCreada', 'catalogoCustom', 'dbMigrado'];
        localStorageKeys.forEach(function(k) { localStorage.removeItem(k); });
        window.examenesOrden = [];
        window.pacienteActivo = null;
        try {
            if (window.api && typeof window.api.eliminarTodosPacientes === 'function') {
                await window.api.eliminarTodosPacientes();
            }
            window.location.reload();
        } catch (e) {
            console.error('[borrarTodosLosDatos] Error:', e);
            window.location.reload();
        }
    };

    function renderizarHistorial() {
        var contenedor = document.getElementById('historialPaciente');
        if (!contenedor) return;
        var paciente = window.pacienteActivo;
        if (!paciente || !paciente.historial || paciente.historial.length === 0) {
            contenedor.innerHTML = '<p class="text-muted text-center mb-0">No hay historial previo.</p>';
            return;
        }
        var historialPorExamen = {};
        paciente.historial.forEach(function(registro) {
            if (!historialPorExamen[registro.examen]) {
                historialPorExamen[registro.examen] = [];
            }
            historialPorExamen[registro.examen].push(registro);
        });
        var html = '';
        Object.keys(historialPorExamen).forEach(function(examen) {
            var registros = historialPorExamen[examen].slice(-3);
            html += '<div class="mb-3"><strong class="text-primary">' + escaparHtmlHistorial(examen) + '</strong><div class="ms-3 mt-1">';
            registros.forEach(function(reg) {
                var referencia = reg.referencia || ((reg.refMin != null && reg.refMax != null) ? reg.refMin + ' - ' + reg.refMax : '');
                html += '<div class="historial-item small"><span class="text-muted">' + escaparHtmlHistorial(reg.fecha) + '</span>: <strong>' + escaparHtmlHistorial(reg.resultado) + ' ' + escaparHtmlHistorial(reg.unidad) + '</strong>';
                if (referencia) html += ' <span class="text-muted">(Ref: ' + escaparHtmlHistorial(referencia) + ')</span>';
                html += '</div>';
            });
            html += '</div></div>';
        });
        contenedor.innerHTML = html;
    }

    function escaparHtmlHistorial(valor) {
        return String(valor == null ? '' : valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    window.guardarResultados = async function() {
        if (!window.examenesOrden || window.examenesOrden.length === 0) {
            window.Notifications.error('No hay exámenes en la orden para guardar.');
            return;
        }
        var examenesConResultado = window.examenesOrden.filter(window.examenTieneResultados);
        var orden = window.pacienteActivo ? window.pacienteActivo.orden : window.getOrden();
        if (!orden) {
            window.Notifications.error('Error: No se pudo determinar la orden.');
            return;
        }
        try {
            if (window.examenesOrden && window.examenesOrden.length > 0) {
                var examenesGuardados = await window.api.guardarPacienteExamenes(orden, window.examenesOrden);
                if (!examenesGuardados || !examenesGuardados.success) {
                    throw new Error((examenesGuardados && examenesGuardados.error) || 'No se pudieron guardar los exámenes.');
                }
            }
            var referenciasGuardadas = await window.api.guardarRefAdaptadas(orden, window.pacienteActivo.refAdaptadas || false);
            if (!referenciasGuardadas || !referenciasGuardadas.success) {
                throw new Error((referenciasGuardadas && referenciasGuardadas.error) || 'No se pudieron guardar las referencias.');
            }
            var historialExistente = window.pacienteActivo.historial || [];
            var fechaHoy = new Date().toLocaleDateString('es-ES');
            var nuevasEntradas = examenesConResultado.map(function(examen) {
                return {
                    fecha: fechaHoy,
                    examen: examen.nombre,
                    // El id del catálogo y el tipo de formulario son los que
                    // permiten a `guardarHistorialPaciente` explotar un examen
                    // compuesto a una fila por parámetro. Sin ellos el motor
                    // solo puede adivinar por el nombre.
                    examen_id: examen.examen_id || examen.id || null,
                    tipoFormulario: examen.tipoFormulario || null,
                    idresultado: examen.idresultado || null,
                    resultado: examen.resultado,
                    unidad: examen.unidad || '',
                    referencia: examen.referencia || null
                };
            });
            var historialCombinado = historialExistente.concat(nuevasEntradas);
            window.pacienteActivo.historial = historialCombinado;
            var historialGuardado = await window.api.guardarHistorialPaciente(orden, historialCombinado);
            if (!historialGuardado || !historialGuardado.success) {
                throw new Error((historialGuardado && historialGuardado.error) || 'No se pudo guardar el historial.');
            }
            window.pacienteActivo.examenes = JSON.parse(JSON.stringify(window.examenesOrden));
            if (examenesConResultado.length === 0) {
                window.Notifications.warning('Exámenes guardados correctamente, pero aún no se ingresaron resultados.');
            } else if (window.pacienteActivo.esArchivada) {
                window.Notifications.success('Resultados de la orden archivada actualizados.');
            } else {
                window.Notifications.success('Exámenes y resultados guardados correctamente.');
            }
        } catch (err) {
            console.error('[guardarResultados] Error:', err);
            window.Notifications.error('Error al guardar los resultados: ' + err.message);
        }
    };

    window.guardarSolicitud = async function() {
        if (!window.examenesOrden || window.examenesOrden.length === 0) {
            window.Notifications.error('Debe agregar al menos un examen a la orden antes de guardar la solicitud.');
            return;
        }
        var orden = window.pacienteActivo ? window.pacienteActivo.orden : window.getOrden();
        if (!orden) {
            window.Notifications.error('Error: No se pudo determinar la orden.');
            return;
        }
        try {
            var examenesGuardados = await window.api.guardarPacienteExamenes(orden, window.examenesOrden);
            if (!examenesGuardados || !examenesGuardados.success) {
                throw new Error((examenesGuardados && examenesGuardados.error) || 'No se pudieron guardar los exámenes.');
            }
            var referenciasGuardadas = await window.api.guardarRefAdaptadas(orden, window.pacienteActivo.refAdaptadas || false);
            if (!referenciasGuardadas || !referenciasGuardadas.success) {
                throw new Error((referenciasGuardadas && referenciasGuardadas.error) || 'No se pudieron guardar las referencias.');
            }
            if (window.pacienteActivo) {
                window.pacienteActivo.examenes = JSON.parse(JSON.stringify(window.examenesOrden));
                window.pacienteActivo.refAdaptadas = window.pacienteActivo.refAdaptadas || false;
            }
            if (window.pacienteActivo && window.pacienteActivo.esArchivada) {
                window.Notifications.success('Orden archivada actualizada. Puede continuar editándola.');
            } else {
                window.Notifications.success('Solicitud guardada. En espera de resultados.');
                window.location.href = '../index.html';
            }
        } catch (err) {
            console.error('[guardarSolicitud] Error:', err);
            window.Notifications.error('Error al guardar la solicitud: ' + err.message);
        }
    };

    window.irAImpresion = async function(examenesSeleccionados) {
        var orden = window.pacienteActivo ? window.pacienteActivo.orden : window.getOrden();
        var refAdaptadasGuardada = window.pacienteActivo ? window.pacienteActivo.refAdaptadas || false : false;
        try {
            if (window.examenesOrden && window.examenesOrden.length > 0) {
                var resultadoGuardado = await window.api.guardarPacienteExamenes(orden, window.examenesOrden);
                if (!resultadoGuardado || !resultadoGuardado.success) {
                    throw new Error((resultadoGuardado && resultadoGuardado.error) || 'No se pudieron guardar los resultados.');
                }
                var referenciasGuardadas = await window.api.guardarRefAdaptadas(orden, refAdaptadasGuardada);
                if (!referenciasGuardadas || !referenciasGuardadas.success) {
                    throw new Error((referenciasGuardadas && referenciasGuardadas.error) || 'No se pudieron guardar las referencias.');
                }
                if (window.pacienteActivo) {
                    window.pacienteActivo.examenes = JSON.parse(JSON.stringify(window.examenesOrden));
                    window.pacienteActivo.refAdaptadas = refAdaptadasGuardada;
                }
            }
        } catch (err) {
            console.error('[irAImpresion] Error:', err);
            window.Notifications.error('No se pudo guardar la orden antes de generar el reporte: ' + err.message);
            return;
        }
        var examenesConResultados = (window.pacienteActivo.examenes || []).filter(window.examenTieneResultados);
        var parametros = new URLSearchParams();
        parametros.set('orden', orden);
        if (Array.isArray(examenesSeleccionados)) {
            parametros.set('seleccion', JSON.stringify(examenesSeleccionados));
        }
        if (examenesConResultados.length === 0) parametros.set('vacio', '1');
        window.location.href = 'reporte.html?' + parametros.toString();
    };

    window.getOrden = function() {
        return String(new URLSearchParams(window.location.search).get('orden') || '').padStart(3, '0');
    };

    function debounce(func, wait) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function() { func.apply(context, args); }, wait);
        };
    }

    var _select2Cache = {
        inicializado: false,
        ultimaFirmaCatalogo: '',
        ultimaFirmaPerfiles: ''
    };

    function _firmaCatalogo() {
        try {
            var catalogo = window.App.catalogo || [];
            var catalogoIds = catalogo.map(function(e) { return e.id; }).join('|');
            return catalogo.length + ':' + catalogoIds.length;
        } catch (e) {
            return '0:0';
        }
    }

    function _firmaPerfiles() {
        try {
            var perfiles = window.App.perfiles || {};
            var keys = Object.keys(perfiles).sort().join('|');
            return keys.length;
        } catch (e) {
            return 0;
        }
    }

    window.refrescarSelect2Catalogos = debounce(function() {
        var select = $("#selectorExamenes");
        if (!select.length) return;

        var firmaCatalogo = _firmaCatalogo();
        var firmaPerfiles = _firmaPerfiles();

        if (_select2Cache.inicializado &&
            _select2Cache.ultimaFirmaCatalogo === firmaCatalogo &&
            _select2Cache.ultimaFirmaPerfiles === firmaPerfiles) {
            return;
        }

        _select2Cache.inicializado = true;
        _select2Cache.ultimaFirmaCatalogo = firmaCatalogo;
        _select2Cache.ultimaFirmaPerfiles = firmaPerfiles;

        if (select.hasClass("select2-hidden-accessible")) {
            select.select2("destroy");
        }
        select.empty();
        select.append(new Option("", "", false, false));
        var catalogo = window.obtenerCatalogo();
        var porArea = {};
        catalogo.filter(function(examen) {
            return examen.tipo !== 'perfil' || window.esExamenNormalCompuesto(examen.id);
        }).forEach(function(examen) {
            var area = examen.area || "General";
            if (!porArea[area]) porArea[area] = [];
            porArea[area].push(examen);
        });
        Object.keys(porArea).sort().forEach(function(area) {
            var group = $("<optgroup>").attr("label", area);
            porArea[area].sort(function(a, b) {
                return String(a.nombre || "").localeCompare(
                    String(b.nombre || ""),
                    "es",
                    { sensitivity: "base" }
                );
            }).forEach(function(examen) {
                var nombre = examen.id === 'perfil_secrecion_vaginal'
                    ? 'Secreción Vaginal'
                    : examen.nombre;
                group.append(new Option(nombre, examen.id));
            });
            select.append(group);
        });

        //Grupos de perfiles 
        var groupPerfiles = $("<optgroup>").attr("label", "Perfiles");
        Object.keys(window.App.perfiles).filter(function(key) {
            return !window.esExamenNormalCompuesto(key);
        }).sort(function(a, b) {
            return String(window.App.perfiles[a].nombre || "").localeCompare(
                String(window.App.perfiles[b].nombre || ""),
                "es",
                { sensitivity: "base" }
            );
        }).forEach(function(key) {
            groupPerfiles.append(new Option("★ " + window.App.perfiles[key].nombre, window.App.perfiles[key].id));
        });
        
        select.append(groupPerfiles);
        select.select2({
            theme: "bootstrap-5",
            placeholder: "Escriba para buscar examen...",
            allowClear: true,
            width: "100%",
            maximumResultsToShow: 20
        });

        // Select2 4.1.0-rc.0 no enfoca su campo de búsqueda al abrir el
        // dropdown, así que todo lo que se teclea se pierde y el selector
        // parece congelado. Se fuerza el foco cada vez que se abre; la función
        // es inofensiva si una versión futura de Select2 ya lo hace.
        select.off('select2:open', enfocarBuscadorSelect2)
            .on('select2:open', enfocarBuscadorSelect2);
    }, 300);

    /**
     * Lleva el foco al campo de búsqueda de Select2.
     *
     * Reintenta unos instantes porque el campo se crea cuando el dropdown ya
     * se está abriendo: enfocarlo antes de que exista no tiene efecto.
     */
    function enfocarBuscadorSelect2() {
        var intentos = 0;
        (function intentar() {
            var campo = document.querySelector('.select2-search__field');
            if (campo) {
                campo.focus();
                return;
            }
            if (intentos++ < 10) setTimeout(intentar, 20);
        })();
    }

    window.renderizarTablaExamenes = renderizarTablaExamenes;

    window.crearExamenDesdeCatalogo = crearExamenDesdeCatalogo;

    window.initOrden = initOrden;

})();
