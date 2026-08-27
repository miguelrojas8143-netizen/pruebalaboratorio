(function() {
    'use strict';

    function initReporte(orden) {
        var ordenNormalizado = String(orden || '').padStart(3, '0');
        var pacientes = window.obtenerPacientes();
        var paciente = pacientes.find(function(p) { return p.orden === ordenNormalizado; });
        if (!paciente) {
            var ordenesDisponibles = pacientes.map(function(p) { return '# ' + p.orden + ' - ' + p.nombre; }).join('\n');
            alert('Paciente no encontrado para la orden: ' + ordenNormalizado + '\n\nÓrdenes disponibles:\n' + (ordenesDisponibles || 'Ninguna'));
            window.location.href = '../index.html';
            return;
        }
        var examenes = paciente.examenes || [];
        var examenesHeces = examenes.find(function(e) { return e.tipoFormulario === 'heces'; });
        var examenesUro = examenes.find(function(e) { return e.tipoFormulario === 'uroanalisis'; });
        var examenesNormales = examenes.filter(function(e) { return e.tipoFormulario !== 'heces' && e.tipoFormulario !== 'uroanalisis'; });

        // Migrate old individual ur_* exams into form-based uroanalisis for report display
        if (!examenesUro) {
            var examenesUroIndividuales = examenesNormales.filter(function(e) {
                return e.area === 'Uroanálisis' && e.id && String(e.id).indexOf('ur_') === 0;
            });
            if (examenesUroIndividuales.length > 0) {
                var datosUroMigrados = {};
                examenesUroIndividuales.forEach(function(e) {
                    datosUroMigrados[e.id] = e.resultado || '';
                });
                examenesUro = {
                    id: 'uroanalisis',
                    nombre: 'Uroanálisis',
                    area: 'Uroanálisis',
                    tipoFormulario: 'uroanalisis',
                    tipo: 'uroanalisis',
                    resultado: JSON.stringify(datosUroMigrados)
                };
                examenesNormales = examenesNormales.filter(function(e) {
                    return !(e.area === 'Uroanálisis' && e.id && String(e.id).indexOf('ur_') === 0);
                });
            }
        }

        if (paciente.refAdaptadas) {
            window.pacienteReferenciasAdaptadas = true;
            examenesNormales = window.aplicarReferenciasAdaptadas(paciente, examenesNormales);
        }

        var params = new URLSearchParams(window.location.search);
        var vacio = params.get('vacio') === '1';
        var hayResultados = examenesNormales.length > 0 || (examenesHeces && window.tieneDatosHeces(examenesHeces)) || (examenesUro && window.tieneDatosUroanalisis(examenesUro));
        if (vacio || !hayResultados) {
            document.getElementById('area-imprimir').style.display = 'none';
            document.getElementById('sinResultados').style.display = 'block';
        } else {
            document.getElementById('area-imprimir').style.display = 'block';
            document.getElementById('sinResultados').style.display = 'none';
            var ahora = new Date();
            var fechaEmision = ahora.toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            document.getElementById('fechaEmision').textContent = fechaEmision.charAt(0).toUpperCase() + fechaEmision.slice(1);
            document.getElementById('ordenNumero').textContent = paciente.orden || 'N/A';
            document.getElementById('reporteNombre').textContent = paciente.nombre || 'N/A';
            document.getElementById('reporteCedula').textContent = paciente.cedula || 'N/A';
            var sexoTexto = paciente.sexo === 'M' ? 'Masculino' : (paciente.sexo === 'F' ? 'Femenino' : 'N/A');
            document.getElementById('reporteEdad').textContent = paciente.edad ? paciente.edad + ' años' : 'N/A';
            document.getElementById('reporteSexo').textContent = sexoTexto;
            document.getElementById('reporteTelefono').textContent = paciente.telefono || 'N/A';

            var perfilBadge = document.getElementById('reportePerfil');
            if (perfilBadge) {
                var nombresPerfiles = window.detectarPerfilesPaciente(paciente);
                if (nombresPerfiles.length > 0) {
                    perfilBadge.innerHTML = '<span class="info-label">Perfil(es):</span> <strong>' + nombresPerfiles.join(', ') + '</strong>';
                } else {
                    perfilBadge.innerHTML = '';
                }
            }

            var badgeRef = document.getElementById('reporteRefAdaptadas');
            if (badgeRef) {
                if (paciente.refAdaptadas) {
                    badgeRef.style.display = 'inline-block';
                    var cat = (paciente.edad !== null && paciente.edad !== undefined && paciente.edad !== '' && paciente.edad < 18) ? 'pedagógicas' : 'adultas';
                    badgeRef.textContent = 'Referencias adaptadas (' + cat + ')';
                } else {
                    badgeRef.style.display = 'none';
                }
            }
            var contenedorResultados = document.getElementById('contenedorResultados');
            if (contenedorResultados) contenedorResultados.innerHTML = '';
            var porArea = {};
            examenesNormales.forEach(function(examen) {
                var area = window.normalizarExamen(examen).area || 'General';
                if (!porArea[area]) porArea[area] = [];
                porArea[area].push(examen);
            });

            Object.keys(porArea).sort().forEach(function(area) {
                var seccion = document.createElement('div');
                seccion.className = 'reporte-area-grupo';
                var subHtml = '<h6 class="reporte-area-titulo">' + area + '</h6>';
                if (area === "Uroanálisis") {
                    var grupos = window.agruparUroanalisisPorGrupo(porArea[area]);
                    Object.keys(grupos).forEach(function(grupo) {
                        subHtml += '<h6 class="reporte-subarea-titulo mt-3">' + grupo + '</h6>';
                        subHtml += renderTablaArea(grupos[grupo]);
                    });
                } else if (area === "Secreción Vaginal") {
                    var examenesSV = porArea[area];
                    var notasFrotis = examenesSV.find(function(e) { return e.id === 'notas_frotis'; });
                    var examenesSVGraficar = examenesSV.filter(function(e) { return e.id !== 'notas_frotis'; });
                    var grupos = window.agruparSecrecionVaginalPorGrupo(examenesSVGraficar);
                    Object.keys(grupos).forEach(function(grupo) {
                        subHtml += '<h6 class="reporte-subarea-titulo mt-3">' + grupo + '</h6>';
                        subHtml += renderTablaArea(grupos[grupo]);
                    });
                    if (notasFrotis && String(notasFrotis.resultado || '').trim() !== '') {
                        var notasTexto = notasFrotis.resultado || '';
                        subHtml += '<h6 class="reporte-subarea-titulo mt-3">Notas y Observaciones</h6>';
                        subHtml += '<div class="alert alert-light border rounded mb-0" style="white-space: pre-wrap;">' + notasTexto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
                    }
                } else if (area === "Hematología") {
                    var vsg = window.separarVSG(porArea[area]).vsg;
                    var otros = window.separarVSG(porArea[area]).otros;
                    if (vsg.length) {
                        subHtml += '<h6 class="reporte-subarea-titulo mt-3">V.S.G.</h6>';
                        subHtml += renderTablaArea(vsg);
                    }
                    if (otros.length) {
                        subHtml += renderTablaArea(otros);
                    }
                } else {
                    subHtml += renderTablaArea(porArea[area]);
                }
                seccion.innerHTML = subHtml;
                if (contenedorResultados) {
                    contenedorResultados.appendChild(seccion);
                }
            });

            if (examenesHeces && window.tieneDatosHeces(examenesHeces)) {
                var datosHeces = JSON.parse(examenesHeces.resultado || '{}');
                var contenedorHeces = document.getElementById('bloqueHeces');
                if (contenedorHeces) {
                    contenedorHeces.innerHTML = '<h6 class="reporte-area-titulo">Examen de Heces</h6><div class="table-responsive"><table class="table table-bordered table-sm"><tbody><tr><td class="fw-semibold" width="40%">Moco Fecal</td><td>' + (datosHeces.mocoFecal || '-') + '</td></tr><tr><td class="fw-semibold">pH Heces</td><td>' + (datosHeces.phHeces || '-') + '</td></tr><tr><td class="fw-semibold">Glucosa Heces</td><td>' + (datosHeces.glucosaHeces || '-') + '</td></tr><tr><td class="fw-semibold">Leucocitos PMN</td><td>' + (datosHeces.leucocitosPMN || '-') + '</td></tr><tr><td class="fw-semibold">Leucocitos Mononucleados</td><td>' + (datosHeces.leucocitosMononucleados || '-') + '</td></tr><tr><td class="fw-semibold">Sustancias Reductoras</td><td>' + (datosHeces.sustanciasReductoras ? datosHeces.sustanciasReductoras + ' (' + window.interpretarSustanciasReductoras(datosHeces.sustanciasReductoras).texto + ')' : '-') + '</td></tr><tr><td class="fw-semibold">Consistencia</td><td>' + (datosHeces.consistencia || '-') + '</td></tr><tr><td class="fw-semibold">Color Heces</td><td>' + (datosHeces.colorHeces || '-') + '</td></tr><tr><td class="fw-semibold">Directo Concentración</td><td>' + (datosHeces.directoConcentracion || '-') + '</td></tr><tr><td class="fw-semibold">Entamoeba coli</td><td>' + (datosHeces.entamoebaColi || '-') + '</td></tr><tr><td class="fw-semibold">Restos Alimentos</td><td>' + (datosHeces.restosAlimentos || '-') + '</td></tr><tr><td class="fw-semibold">Flora Bacteriana</td><td>' + (datosHeces.floraBacteriana || '-') + '</td></tr></tbody></table></div>';
                }
            }

            if (examenesUro && window.tieneDatosUroanalisis(examenesUro)) {
                var datosUro = JSON.parse(examenesUro.resultado || '{}');
                var contenedorUro = document.getElementById('bloqueUroanalisis');
                if (contenedorUro) {
                    var gruposUro = {};
                    if (window.UROANALISIS_FIELDS) {
                        window.UROANALISIS_FIELDS.forEach(function(f) {
                            var g = f.grupo || 'General';
                            if (!gruposUro[g]) gruposUro[g] = [];
                            gruposUro[g].push(f);
                        });
                    }
                    var ordenGruposUro = ['Macroscópico', 'Químico', 'Microscópico'];
                    Object.keys(gruposUro).forEach(function(g) { if (ordenGruposUro.indexOf(g) === -1) ordenGruposUro.push(g); });
                    var htmlUro = '<h6 class="reporte-area-titulo">Examen de Orina / Uroanálisis</h6>';
                    ordenGruposUro.forEach(function(grupo) {
                        if (!gruposUro[grupo]) return;
                        htmlUro += '<h6 class="reporte-subarea-titulo mt-3">' + grupo + '</h6>';
                        htmlUro += '<div class="table-responsive"><table class="table table-bordered table-sm"><tbody>';
                        gruposUro[grupo].forEach(function(f) {
                            var val = datosUro[f.id] || '-';
                            if (val === '') val = '-';
                            htmlUro += '<tr><td class="fw-semibold" width="40%">' + f.nombre + '</td><td>' + val + '</td></tr>';
                        });
                        htmlUro += '</tbody></table></div>';
                    });
                    contenedorUro.innerHTML = htmlUro;
                }
            }
        }
    }

    function renderTablaArea(examenes) {
        var esSecrecionVaginal = examenes.length > 0 && examenes[0].area === 'Secreción Vaginal';
        var html = '<div class="table-responsive"><table class="table table-bordered"><thead><tr><th width="35%">Examen</th>' + (esSecrecionVaginal ? '<th width="65%">Resultado</th>' : '<th width="20%">Resultado</th><th width="15%">Unidad</th><th width="30%">Valores de Referencia</th>') + '</tr></thead><tbody>';

        examenes.forEach(function(examen) {
            var tieneResultado = String(examen.resultado ?? '').trim() !== '';
            var numResultado = parseFloat(examen.resultado);
            var clase = 'resultado-normal-texto';
            var texto = '-';
            if (examen.tipo === 'multiselect_cantidad') {
                clase = '';
                if (tieneResultado) {
                    try {
                        var datosFrotis = JSON.parse(examen.resultado || '{}');
                        var items = Object.keys(datosFrotis).filter(function(k) { return datosFrotis[k] !== ''; });
                        if (items.length > 0) {
                            texto = items.map(function(k) {
                                return k + (datosFrotis[k] ? ' — ' + datosFrotis[k] : '');
                            }).join('; ');
                        } else {
                            texto = '-';
                        }
                    } catch(e) {
                        texto = examen.resultado || '-';
                    }
                }
            } else {
                texto = tieneResultado ? examen.resultado : '-';
                if (examen.tipo === 'texto' || examen.tipo === 'seleccion_unica') {
                    clase = '';
                } else if (tieneResultado && !isNaN(numResultado)) {
                    if (numResultado < examen.refMin) {
                        clase = 'resultado-bajo-texto';
                        texto = examen.resultado + ' ↓';
                    } else if (numResultado > examen.refMax) {
                        clase = 'resultado-alto-texto';
                        texto = examen.resultado + ' ↑';
                    }
                }
            }
            if (esSecrecionVaginal) {
                html += '<tr><td class="fw-semibold">' + examen.nombre + '</td><td class="' + clase + '">' + texto + '</td></tr>';
            } else {
                var refTexto = (examen.refMin !== undefined && examen.refMax !== undefined && (examen.refMin || examen.refMax)) ? examen.refMin + ' - ' + examen.refMax : '-';
                html += '<tr><td class="fw-semibold">' + examen.nombre + '</td><td class="' + clase + '">' + texto + '</td><td class="text-muted">' + (examen.unidad || '-') + '</td><td>' + refTexto + '</td></tr>';
            }
        });
        html += '</tbody></table></div>';
        return html;
    }

    window.initReporte = initReporte;

})();
