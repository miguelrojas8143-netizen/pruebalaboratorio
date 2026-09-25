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
                var pacientes = window.obtenerPacientes();
                var index = pacientes.findIndex(function(p) { return p.id === window.pacienteActivo && window.pacienteActivo.id === p.id; });
                if (index === -1) {
                    var ordenActual = window.getOrden ? window.getOrden() : '';
                    index = pacientes.findIndex(function(p) { return String(p.orden || '').padStart(3, '0') === ordenActual; });
                }
                if (index !== -1) {
                    pacientes[index].examenes = examenes;
                    window.guardarPacientes(pacientes).catch(function(e) {
                        console.error('[guardarPacientes] Error:', e);
                    });
                    window.pacienteActivo = pacientes[index];
                }
            } catch(e) {}
        }
        return migrado;
    };

    function initOrden(orden) {
        var ordenNormalizado = String(orden || '').padStart(3, '0');
        var pacientes = window.obtenerPacientes();
        var paciente = pacientes.find(function(p) { return p.orden === ordenNormalizado; });
        if (!paciente) {
            alert('Paciente no encontrado para la orden: ' + ordenNormalizado);
            window.location.href = '../index.html';
            return;
        }
        document.getElementById('pacienteNombre').textContent = paciente.nombre;
        document.getElementById('pacienteCedula').textContent = paciente.cedula;
        document.getElementById('pacienteFechaNac').textContent = paciente.fechaNac || 'N/A';
        document.getElementById('pacienteEdad').textContent = paciente.edad ? paciente.edad + ' años' : 'N/A';
        document.getElementById('pacienteTelefono').textContent = paciente.telefono || 'N/A';
        document.getElementById('pacienteOrden').textContent = paciente.orden;
        document.getElementById('pacienteVisitas').textContent = paciente.visitas || 1;
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
        window.migrarExamenesOrina(window.examenesOrden);
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
        renderizarHistorial();
        renderizarHistorialOrdenes();
    }

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
            var opciones = nuevoExamen.opciones || [];
            var indiceNoObs = opciones.findIndex(function(op) { return op.toLowerCase().indexOf('no se observaron') !== -1; });
            if (indiceNoObs !== -1) {
                nuevoExamen.resultado = opciones[indiceNoObs];
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
        if (datos.grupo) {
            nuevoExamen.grupo = datos.grupo;
        }
        if (!nuevoExamen.tipoFormulario && window.App.examenesDetallados[datos.id] && window.App.examenesDetallados[datos.id].items) {
            nuevoExamen.tipo = 'perfil';
            nuevoExamen.resultado = '{}';
        }
        if (datos.valorDefecto !== undefined && datos.valorDefecto !== null) {
            if (nuevoExamen.tipo === 'seleccion_unica') {
                var opts = nuevoExamen.opciones || [];
                if (opts.indexOf(datos.valorDefecto) !== -1) {
                    nuevoExamen.resultado = datos.valorDefecto;
                }
            } else if (!nuevoExamen.tipo || nuevoExamen.tipo === 'numerico' || nuevoExamen.tipo === 'texto' || nuevoExamen.tipo === 'tipo_sanguineo') {
                nuevoExamen.resultado = datos.valorDefecto;
            }
        }
        return nuevoExamen;
    }

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
            tbody.innerHTML = '<tr id="filaVaciaExamenes"><td colspan="5" class="sin-examenes"><i class="bi bi-inbox display-4"></i><p class="mt-2">No hay exámenes agregados. Use el selector de la izquierda.</p></td></tr>';
            return;
        }
        var grupoAnterior = null;
        var grupoId = 0;
        window.examenesOrden.forEach(function(examen, index) {
            if (tieneTipoSanguineoCompleto && examen.id === 'factor_rh') return;
            var grupoActual = examen.grupoPerfil || 'Exámenes individuales';
            if (grupoActual !== grupoAnterior) {
                var filaGrupo = document.createElement('tr');
                filaGrupo.className = 'grupo-examen-row';
                filaGrupo.setAttribute('data-grupo-id', grupoId);
                filaGrupo.innerHTML = '<td colspan="5" class="grupo-header-clickable"><i class="bi bi-chevron-right me-2 grupo-toggle-icon"></i>' + grupoActual + '<span class="badge bg-secondary ms-2">' + window.examenesOrden.filter(function(e) { return (e.grupoPerfil || 'Exámenes individuales') === grupoActual && !(tieneTipoSanguineoCompleto && e.id === 'factor_rh'); }).length + '</span></td>';
                filaGrupo.setAttribute('onclick', 'window.toggleGrupoExamen(' + grupoId + ')');
                tbody.appendChild(filaGrupo);
                grupoAnterior = grupoActual;
                grupoId++;
            }
            var fila = document.createElement('tr');
            fila.className = 'examen-row';
            fila.setAttribute('data-examen-id', examen.id);
            fila.setAttribute('data-grupo-id', grupoId - 1);
            if (examen.tipo === 'tipo_sanguineo') {
                fila.classList.add('tipificacion-row');
            }
            if (examen.tipoFormulario === 'heces') {
                var resumenHtml = '';
                try {
                    var datos = JSON.parse(examen.resultado || '{}');
                    if (Object.keys(datos).length > 0) {
                        var campos = [];
                        if (datos.sustanciasReductoras) {
                            var interp = window.interpretarSustanciasReductoras(datos.sustanciasReductoras);
                            campos.push('Sust. Reductoras: ' + datos.sustanciasReductoras + ' (' + interp.texto + ')');
                        }
                        if (datos.consistencia) campos.push('Consistencia: ' + datos.consistencia);
                        if (datos.colorHeces) campos.push('Color: ' + datos.colorHeces);
                        if (campos.length > 0) {
                            resumenHtml = '<br><small class="text-success">' + campos.join(' | ') + '</small>';
                        }
                    }
                } catch(e) {}
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td><button type="button" class="btn btn-outline-success btn-sm" onclick="window.abrirFormularioHeces(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i>Cargar Resultados</button>' + resumenHtml + '</td><td class="text-muted small">-</td><td>-</td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            } else if (examen.tipoFormulario === 'uroanalisis') {
                var resumenUro = '';
                try {
                    var datosUro = JSON.parse(examen.resultado || '{}');
                    if (Object.keys(datosUro).length > 0) {
                        var camposUro = [];
                        var detalleUro = window.App.examenesDetallados.uroanalisis;
                        var ordenUro = ['ur_aspecto', 'ur_color', 'ur_olor', 'ur_reaccion', 'ur_ph', 'ur_densidad', 'ur_urobilinogeno', 'ur_albumina', 'ur_glucosa', 'ur_cetonas', 'ur_proteinas', 'ur_hemoglobina', 'ur_bilirrubina', 'ur_nitritos', 'ur_leucocitos_tira', 'ur_leucocitos_micro', 'ur_celulas_epiteliales', 'ur_eritrocitos', 'ur_bacterias', 'ur_cilindros', 'ur_cristales'];
                        ordenUro.forEach(function(k) {
                            if (datosUro[k]) {
                                var item = detalleUro && detalleUro.items ? detalleUro.items.find(function(i) { return i.id === k; }) : null;
                                var nom = item ? item.nombre : k;
                                camposUro.push(nom + ': ' + datosUro[k]);
                            }
                        });
                        if (camposUro.length > 0) {
                            resumenUro = '<br><small class="text-success">' + camposUro.join(' | ') + '</small>';
                        }
                    }
                } catch(e) {}
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td><button type="button" class="btn btn-outline-success btn-sm" onclick="window.abrirFormularioUroanalisis(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i>Cargar Resultados</button>' + resumenUro + '</td><td class="text-muted small">-</td><td>-</td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
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
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td><button type="button" class="btn btn-outline-success btn-sm" onclick="window.abrirFormularioAntibiograma(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i>Cargar Resultados</button>' + resumenAb + '</td><td class="text-muted small">-</td><td>-</td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            } else if (examen.tipo === 'texto') {
                var refTexto = examen.refTexto ||
                    ((examen.refMin !== undefined && examen.refMax !== undefined && (examen.refMin || examen.refMax))
                        ? examen.refMin + ' - ' + examen.refMax : '-');
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td colspan="3"><button type="button" class="btn btn-outline-primary btn-sm" onclick="window.abrirEditorResultadoExamen(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i>Cargar resultados</button></td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            } else if (examen.tipo === 'tipo_sanguineo' || examen.tipo === 'tipo_sanguineo_completo') {
                var nombreTipoSanguineo = tieneTipoSanguineoCompleto ? 'Grupo Sanguíneo' : examen.nombre;
                var eliminarTipoSanguineo = tieneTipoSanguineoCompleto ? 'window.eliminarTipoSanguineo(this)' : 'window.eliminarExamen(this)';
                fila.innerHTML = '<td class="fw-semibold align-top">' + nombreTipoSanguineo + '</td><td><button type="button" class="btn btn-outline-danger btn-sm" onclick="window.abrirFormularioTipoSanguineo()"><i class="bi bi-pencil-square me-1"></i>Cargar resultados</button></td><td class="text-muted small">-</td><td>-</td><td class="text-center align-top"><button class="btn btn-sm btn-outline-danger" onclick="' + eliminarTipoSanguineo + '" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            } else if (examen.tipo === 'seleccion_unica') {
                var opcionesHtml2 = (examen.opciones || []).map(function(opt) { return '<option value="' + opt + '" ' + (examen.resultado === opt ? 'selected' : '') + '>' + opt + '</option>'; }).join('');
                if (window.esSecrecionVaginal(examen)) {
                    fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td colspan="3"><button type="button" class="btn btn-outline-primary btn-sm" onclick="window.abrirEditorResultadoExamen(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i>Cargar resultados</button></td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
                } else {
                    fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td><select class="form-select resultado-input" onchange="window.actualizarResultado(this)"><option value="">Seleccionar...</option>' + opcionesHtml2 + '</select></td><td class="text-muted small">-</td><td>-</td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
                }
            } else if (examen.tipo === 'perfil' && window.App.examenesDetallados[examen.id]) {
                var detalle = window.App.examenesDetallados[examen.id];
                var btnExpandir = (detalle && detalle.items && detalle.items.length > 0) ? '<button type="button" class="btn btn-sm btn-outline-primary" id="btnToggleItems_' + examen.id + '" onclick="window.toggleItemsExamenTabla(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i> Cargar resultados</button>' : '';
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
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td colspan="3"><button type="button" class="btn btn-outline-primary btn-sm" onclick="window.abrirFormularioFrotis(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i> Configurar</button>' + resumenFrotis + '</td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            } else {
                fila.innerHTML = '<td class="fw-semibold">' + examen.nombre + '</td><td colspan="3"><button type="button" class="btn btn-outline-primary btn-sm" onclick="window.abrirEditorResultadoExamen(\'' + examen.id + '\')"><i class="bi bi-pencil-square me-1"></i>Cargar resultados</button></td><td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="window.eliminarExamen(this)" title="Eliminar examen"><i class="bi bi-trash"></i></button></td>';
            }
            tbody.appendChild(fila);
        });
    }

    window.toggleGrupoExamen = function(grupoId) {
        var rows = document.querySelectorAll('#tablaExamenes tr.examen-row[data-grupo-id="' + grupoId + '"]');
        var header = document.querySelector('#tablaExamenes tr.grupo-examen-row[data-grupo-id="' + grupoId + '"]');
        if (!header) return;
        header.classList.toggle('grupo-colapsado');
        rows.forEach(function(row) {
            row.classList.toggle('d-none');
        });
    };

    window.toggleTodosGrupos = function() {
        var headers = document.querySelectorAll('#tablaExamenes tr.grupo-examen-row');
        var allCollapsed = headers.length > 0 && Array.from(headers).every(function(h) { return h.classList.contains('grupo-colapsado'); });
        headers.forEach(function(header) {
            var rows = document.querySelectorAll('#tablaExamenes tr.examen-row[data-grupo-id="' + header.getAttribute('data-grupo-id') + '"]');
            if (allCollapsed) {
                header.classList.remove('grupo-colapsado');
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
            alert('Por favor seleccione un examen.');
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
                alert('Este examen ya está en la orden.');
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
            window.abrirFormularioTipoSanguineo();
            return;
        }
        if (window.App.perfiles[examenId]) {
            $("#selectorExamenes").val(null).trigger("change");
            var perfil = window.App.perfiles[examenId];
            var catalogo = window.obtenerCatalogo();
            var catalogoMap = {};
            catalogo.forEach(function(e) { catalogoMap[e.id] = e; });
            var idsExistentes = window.examenesOrden.map(function(e) { return e.id; });

            if (examenId === 'hematologia_completa') {
                if (idsExistentes.indexOf(examenId) !== -1) {
                    alert('Este examen ya está en la orden.');
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
            nuevos.forEach(function(examen) {
                examen.grupoPerfil = perfil.nombre;
            });
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
                }
                return e;
            }).concat(nuevos);
            if (window.pacienteActivo) {
                if (!window.pacienteActivo.perfiles) window.pacienteActivo.perfiles = [];
                if (!window.pacienteActivo.perfiles.includes(examenId)) window.pacienteActivo.perfiles.push(examenId);
            }
            renderizarTablaExamenes();
            if (examenId === 'uroanalisis' || examenId === 'examen_orina') {
                window.abrirFormularioUroanalisis(examenId);
            }
            return;
        }
        if (window.examenesOrden.some(function(e) { return e.id === examenId; })) {
            alert('Este examen ya está en la orden.');
            return;
        }
        var datos = catalogo.find(function(e) { return e.id === examenId; });
        if (!datos) return;
        window.examenesOrden.push(crearExamenDesdeCatalogo(datos));
        $('#selectorExamenes').val(null).trigger('change');
        renderizarTablaExamenes();
        if (examenId === 'feces') {
            window.abrirFormularioHeces(examenId);
        }
        if (examenId === 'uroanalisis' || examenId === 'examen_orina') {
            window.abrirFormularioUroanalisis(examenId);
        }
        if (examenId === 'antibiograma') {
            window.abrirFormularioAntibiograma(examenId);
        }
    };

    window.actualizarResultado = function(input) {
        window.validarResultado(input);
        var fila = input.closest('tr');
        if (!fila) return;
        var examenId = fila.getAttribute('data-examen-id');
        var examenes = window.examenesOrden || [];
        var examen = examenes.find(function(e) { return e.id === examenId; });
        if (examen) {
            examen.resultado = input.value;
        }
        setTimeout(function() {
            if (window.ejecutarCalculosAutomaticos) {
                window.ejecutarCalculosAutomaticos();
            }
        }, 100);
    };

    window.actualizarReferencia = function(input) {
        var fila = input.closest('tr');
        if (!fila) return;
        var examenId = fila.getAttribute('data-examen-id');
        var examenes = window.examenesOrden || [];
        var examen = examenes.find(function(e) { return e.id === examenId; });
        if (!examen) return;
        if (input.classList.contains('ref-min-input')) {
            examen.refMin = parseFloat(input.value) || 0;
        }
        if (input.classList.contains('ref-max-input')) {
            examen.refMax = parseFloat(input.value) || 0;
        }
        var resultadoInput = fila.querySelector('.resultado-input');
        if (resultadoInput) window.validarResultado(resultadoInput);
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

    window.eliminarExamen = function(btn) {
        if (!confirm('¿Está seguro de eliminar este examen de la orden?')) return;
        var fila = btn.closest('tr');
        var examenId = fila.getAttribute('data-examen-id');
        window.examenesOrden = (window.examenesOrden || []).filter(function(e) { return e.id !== examenId; });
        renderizarTablaExamenes();
    };

    window.eliminarTipoSanguineo = function(btn) {
        if (!confirm('¿Está seguro de eliminar este examen de la orden?')) return;
        window.examenesOrden = (window.examenesOrden || []).filter(function(e) {
            return e.id !== 'grupo_sanguineo_abo' && e.id !== 'factor_rh';
        });
        renderizarTablaExamenes();
    };

    window.limpiarOrden = function() {
        if (!confirm('¿Está seguro de eliminar todos los exámenes de la orden?')) return;
        window.examenesOrden = [];
        renderizarTablaExamenes();
    };

    window.borrarTodosLosDatos = function() {
        if (!confirm('¿Eliminar TODOS los datos del laboratorio?\nEsta acción no se puede deshacer.')) return;
        var localStorageKeys = ['pacientesLab', 'ultimoOrdenLab', 'ordenesDiariasLab', 'pacienteExistenteRefer', 'ultimaOrdenCreada', 'catalogoCustom', 'dbMigrado'];
        localStorageKeys.forEach(function(k) { localStorage.removeItem(k); });
        window.examenesOrden = [];
        window.pacienteActivo = null;
        if (window.DB && typeof window.DB.limpiarDB === 'function') {
            window.DB.limpiarDB().then(function() {
                window.location.reload();
            }).catch(function(e) {
                console.error('[borrarTodosLosDatos] Error limpiando IndexedDB:', e);
                window.location.reload();
            });
        } else {
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
            html += '<div class="mb-3"><strong class="text-primary">' + examen + '</strong><div class="ms-3 mt-1">';
            registros.forEach(function(reg) {
                html += '<div class="historial-item small"><span class="text-muted">' + reg.fecha + '</span>: <strong>' + reg.resultado + ' ' + reg.unidad + '</strong></div>';
            });
            html += '</div></div>';
        });
        contenedor.innerHTML = html;
    }

    window.guardarResultados = function() {
        if (!window.examenesOrden || window.examenesOrden.length === 0) {
            alert('No hay exámenes en la orden para guardar.');
            return;
        }
        var examenesConResultado = window.examenesOrden.filter(function(e) {
            if (e.tipoFormulario === 'heces' || e.tipoFormulario === 'uroanalisis' || e.tipoFormulario === 'antibiograma' || e.tipo === 'multiselect_cantidad') {
                try {
                    var datos = JSON.parse(e.resultado || '{}');
                    return Object.keys(datos).length > 0 && Object.values(datos).some(function(v) { return v !== ''; });
                } catch(e) {
                    return false;
                }
            }
            return String(e.resultado || '').trim() !== '';
        });
        var pacientes = window.obtenerPacientes();
        var index = pacientes.findIndex(function(p) { return p.id === window.pacienteActivo.id; });
        if (index === -1) {
            alert('Error: Paciente no encontrado.');
            return;
        }
        pacientes[index].examenes = JSON.parse(JSON.stringify(window.examenesOrden));
        pacientes[index].refAdaptadas = window.pacienteActivo.refAdaptadas || false;
        if (!pacientes[index].historial) {
            pacientes[index].historial = [];
        }
        var fechaHoy = new Date().toLocaleDateString('es-ES');
        examenesConResultado.forEach(function(examen) {
            pacientes[index].historial.push({
                fecha: fechaHoy,
                examen: examen.nombre,
                resultado: examen.resultado,
                unidad: examen.unidad
            });
        });
        window.guardarPacientes(pacientes).catch(function(e) {
            console.error('[guardarPacientes] Error:', e);
        });
        window.pacienteActivo = pacientes[index];
        if (examenesConResultado.length === 0) {
            alert('Orden guardada sin resultados ingresados.');
        } else {
            alert('Resultados guardados exitosamente.');
        }
    };

    window.guardarSolicitud = function() {
        if (!window.examenesOrden || window.examenesOrden.length === 0) {
            alert('Debe agregar al menos un examen a la orden antes de guardar la solicitud.');
            return;
        }
        var pacientes = window.obtenerPacientes();
        var index = pacientes.findIndex(function(p) { return p.id === window.pacienteActivo.id; });
        if (index === -1) {
            alert('Error: Paciente no encontrado.');
            return;
        }
        pacientes[index].examenes = JSON.parse(JSON.stringify(window.examenesOrden));
        pacientes[index].refAdaptadas = window.pacienteActivo.refAdaptadas || false;
        window.guardarPacientes(pacientes).catch(function(e) {
            console.error('[guardarPacientes] Error:', e);
        });
        window.pacienteActivo = pacientes[index];
        alert('Solicitud guardada. En espera de resultados.');
        window.location.href = '../index.html';
    };

    window.irAImpresion = function() {
        var pacientes = window.obtenerPacientes();
        var index = pacientes.findIndex(function(p) { return p.id === window.pacienteActivo.id; });
        var refAdaptadasGuardada = window.pacienteActivo.refAdaptadas || false;
        if (index !== -1) {
            window.pacienteActivo = pacientes[index];
        }
        if (index !== -1 && window.examenesOrden && window.examenesOrden.length > 0) {
            pacientes[index].examenes = JSON.parse(JSON.stringify(window.examenesOrden));
            pacientes[index].refAdaptadas = refAdaptadasGuardada;
            window.guardarPacientes(pacientes).catch(function(e) {
                console.error('[guardarPacientes] Error:', e);
            });
            window.pacienteActivo = pacientes[index];
        }
        var examenesConResultados = (window.pacienteActivo.examenes || []).filter(function(e) {
            if (e.tipoFormulario === 'heces' || e.tipoFormulario === 'uroanalisis' || e.tipoFormulario === 'antibiograma' || e.tipo === 'multiselect_cantidad') {
                try {
                    var datos = JSON.parse(e.resultado || '{}');
                    return Object.keys(datos).length > 0 && Object.values(datos).some(function(v) { return v !== ''; });
                } catch(e) {
                    return false;
                }
            }
            return String(e.resultado || '').trim() !== '';
        });
        if (examenesConResultados.length === 0) {
            window.location.href = 'reporte.html?orden=' + window.pacienteActivo.orden + '&vacio=1';
            return;
        }
        window.location.href = 'reporte.html?orden=' + window.pacienteActivo.orden;
    };

    window.getOrden = function() {
        return String(new URLSearchParams(window.location.search).get('orden') || '').padStart(3, '0');
    };

    window.refrescarSelect2Catalogos = function() {
        var select = $("#selectorExamenes");
        if (!select.length) return;
        if (select.hasClass("select2-hidden-accessible")) {
            select.select2("destroy");
        }
        select.empty();
        select.append(new Option("", "", false, false));
        var catalogo = window.obtenerCatalogo();
        var porArea = {};
        catalogo.forEach(function(examen) {
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
                group.append(new Option(examen.nombre, examen.id));
            });
            select.append(group);
        });

        //Grupos de perfiles 
        var groupPerfiles = $("<optgroup>").attr("label", "Perfiles / Paneles");
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
            width: "100%"
        });
    };

    window.renderizarTablaExamenes = renderizarTablaExamenes;

    window.crearExamenDesdeCatalogo = crearExamenDesdeCatalogo;

    window.initOrden = initOrden;

    function renderizarHistorialOrdenes() {
        var contenedor = document.getElementById('historialOrdenes');
        if (!contenedor) return;
        var paciente = window.pacienteActivo;
        if (!paciente || !paciente.ordenesPrevias || paciente.ordenesPrevias.length === 0) {
            contenedor.innerHTML = '<p class="text-muted text-center mb-0 py-3">No hay órdenes anteriores registradas.</p>';
            return;
        }
        var html = '';
        paciente.ordenesPrevias.slice().reverse().forEach(function(ord) {
            var estadoClass = 'bg-warning text-dark';
            var estadoTexto = 'Sin resultados';
            var tieneResultados = false;
            if (ord.examenes && ord.examenes.length > 0) {
                tieneResultados = ord.examenes.some(function(e) {
                    if (e.tipoFormulario === 'heces' || e.tipoFormulario === 'uroanalisis' || e.tipoFormulario === 'antibiograma' || e.tipo === 'multiselect_cantidad') {
                        try {
                            var datos = JSON.parse(e.resultado || '{}');
                            return Object.keys(datos).length > 0 && Object.values(datos).some(function(v) { return v !== ''; });
                        } catch(err) { return false; }
                    }
                    return String(e.resultado || '').trim() !== '';
                });
            }
            var totalExamenes = (ord.examenes || []).length;
            if (tieneResultados) {
                estadoClass = 'bg-success';
                estadoTexto = 'Con resultados';
            } else if (totalExamenes > 0) {
                estadoClass = 'bg-primary';
                estadoTexto = 'En proceso';
            }
            html += '<div class="card mb-2 shadow-sm orden-anterior-card">';
            html += '<div class="card-header d-flex justify-content-between align-items-center">';
            html += '<div><strong>Orden #' + ord.orden + '</strong> <span class="text-muted small"> - ' + (ord.fecha || 'N/A') + '</span></div>';
            html += '<span class="badge ' + estadoClass + '">' + estadoTexto + '</span>';
            html += '</div>';
            html += '<div class="card-body">';
            if (totalExamenes > 0) {
                html += '<div class="table-responsive"><table class="table table-sm table-bordered mb-0"><thead class="table-light"><tr><th>Examen</th><th>Resultado</th><th>Unidad</th></tr></thead><tbody>';
                ord.examenes.forEach(function(e) {
                    var resultado = '-';
                    try {
                        if (e.tipoFormulario === 'antibiograma') {
                            var datosAb = JSON.parse(e.resultado || '{}');
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
                        } else if (e.tipoFormulario === 'heces' || e.tipoFormulario === 'uroanalisis' || e.tipo === 'multiselect_cantidad') {
                            var datos = JSON.parse(e.resultado || '{}');
                            var keys = Object.keys(datos).filter(function(k) { return datos[k] !== ''; });
                            if (keys.length > 0) {
                                resultado = keys.map(function(k) { return datos[k]; }).join(', ');
                            } else {
                                resultado = '-';
                            }
                        } else {
                            resultado = e.resultado || '-';
                        }
                    } catch(err) {
                        resultado = e.resultado || '-';
                    }
                    html += '<tr><td>' + (e.nombre || e.id || '-') + '</td><td>' + resultado + '</td><td>' + (e.unidad || '-') + '</td></tr>';
                });
                html += '</tbody></table></div>';
            } else {
                html += '<p class="text-muted mb-0">Sin exámenes registrados.</p>';
            }
            html += '</div>';
            html += '</div>';
        });
        contenedor.innerHTML = html;
    }

    window.renderizarHistorialOrdenes = renderizarHistorialOrdenes;

})();
