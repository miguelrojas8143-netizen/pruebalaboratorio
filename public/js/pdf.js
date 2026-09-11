/**
 * Módulo de generación / impresión del PDF del reporte.
 * Versión corregida: usa <div> con display:table en lugar de <table>
 * para que html2pdf.js respete los saltos de página.
 */
(function() {
    'use strict';

    /* ---------- Helpers ---------- */
    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value == null ? '' : value;
    }

    /* ---------- Clasificación de resultados ----------*/
    function clasificarResultado(examen) {
        var tieneResultado = String(examen.resultado ?? '').trim() !== '';
        var numResultado = parseFloat(examen.resultado);
        var clase = 'resultado-normal-texto';
        var texto = '-';

        if (examen.tipo === 'multiselect_cantidad') {
            clase = '';
            if (tieneResultado) {
                try {
                    var datosFrotis = JSON.parse(examen.resultado || '{}');
                    var items = Object.keys(datosFrotis).filter(function(k) {
                        return datosFrotis[k] !== '';
                    });
                    if (items.length > 0) {
                        texto = items.map(function(k) {
                            return k + (datosFrotis[k] ? ' — ' + datosFrotis[k] : '');
                        }).join('; ');
                    } else {
                        texto = '-';
                    }
                } catch (e) {
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

        return { texto: texto, clase: clase };
    }

    function clasificarFila(examen) {
        var r = clasificarResultado(examen);
        var refTexto = (examen.refMin !== undefined && examen.refMax !== undefined && (examen.refMin || examen.refMax))
            ? examen.refMin + ' - ' + examen.refMax : '-';
        return {
            nombre: examen.nombre,
            texto: r.texto,
            clase: r.clase,
            unidad: examen.unidad || '-',
            refTexto: refTexto,
            esSecrecionVaginal: examen.area === 'Secreción Vaginal'
        };
    }

    function clasificarFilas(examenes) {
        return examenes.map(clasificarFila);
    }

    /* ---------- Construcción del payload unificado ---------- */
    function buildPayload(paciente) {
        var examenes = JSON.parse(JSON.stringify(paciente.examenes || []));
        var examenesHeces = examenes.find(function(e) { return e.tipoFormulario === 'heces'; });
        var examenesUro = examenes.find(function(e) { return e.tipoFormulario === 'uroanalisis'; });
        var examenesNormales = examenes.filter(function(e) {
            return e.tipoFormulario !== 'heces' && e.tipoFormulario !== 'uroanalisis';
        });

        if (!examenesUro) {
            var individules = examenesNormales.filter(function(e) {
                return e.area === 'Uroanálisis' && e.id && String(e.id).indexOf('ur_') === 0;
            });
            if (individules.length > 0) {
                var datosUroMigrados = {};
                individules.forEach(function(e) {
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

        var refAdaptadas = !!paciente.refAdaptadas;
        var categoriaRef = (paciente.edad !== null && paciente.edad !== undefined && paciente.edad !== '' && paciente.edad < 18) ? 'pedagógicas' : 'adultas';

        if (refAdaptadas) {
            window.pacienteReferenciasAdaptadas = true;
            examenesNormales = window.aplicarReferenciasAdaptadas(paciente, examenesNormales);
        }

        var ahora = new Date();
        var diasCortos = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        var mesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sept', 'Oct', 'Nov', 'Dic'];
        var fechaEmision = diasCortos[ahora.getDay()] + ' ' + ahora.getDate() +
            ' de ' + mesesCortos[ahora.getMonth()] + ' ' + ahora.getFullYear();

        var header = {
            nombre: paciente.nombre || 'N/A',
            cedula: paciente.cedula || 'N/A',
            edad: paciente.edad ? paciente.edad + ' años' : 'N/A',
            sexo: paciente.sexo === 'M' ? 'Masculino' : (paciente.sexo === 'F' ? 'Femenino' : 'N/A'),
            telefono: paciente.telefono || 'N/A',
            orden: paciente.orden || 'N/A',
            fechaEmision: fechaEmision,
            perfiles: window.detectarPerfilesPaciente(paciente)
        };

        var porArea = {};
        examenesNormales.forEach(function(examen) {
            var area = window.normalizarExamen(examen).area || 'General';
            if (!porArea[area]) porArea[area] = [];
            porArea[area].push(examen);
        });

        var secciones = [];
        Object.keys(porArea).sort().forEach(function(area) {
            var subareas = [];

            if (area === 'Uroanálisis') {
                var gruposU = window.agruparUroanalisisPorGrupo(porArea[area]);
                Object.keys(gruposU).forEach(function(grupo) {
                    subareas.push({ titulo: grupo, rows: clasificarFilas(gruposU[grupo]) });
                });
            } else if (area === 'Secreción Vaginal') {
                var examenesSV = porArea[area];
                var notasFrotis = examenesSV.find(function(e) { return e.id === 'notas_frotis'; });
                var examenesSVGraficar = examenesSV.filter(function(e) { return e.id !== 'notas_frotis'; });
                var gruposSV = window.agruparSecrecionVaginalPorGrupo(examenesSVGraficar);
                Object.keys(gruposSV).forEach(function(grupo) {
                    subareas.push({ titulo: grupo, rows: clasificarFilas(gruposSV[grupo]) });
                });
                if (notasFrotis && String(notasFrotis.resultado || '').trim() !== '') {
                    subareas.push({ notas: notasFrotis.resultado || '' });
                }
            } else if (area === 'Hematología') {
                var sep = window.separarVSG(porArea[area]);
                if (sep.vsg.length) subareas.push({ titulo: 'V.S.G.', rows: clasificarFilas(sep.vsg) });
                if (sep.otros.length) subareas.push({ rows: clasificarFilas(sep.otros) });
            } else {
                subareas.push({ rows: clasificarFilas(porArea[area]) });
            }

            secciones.push({ nombre: area, subareas: subareas });
        });

        var heces = null;
        if (examenesHeces && window.tieneDatosHeces(examenesHeces)) {
            heces = { datos: JSON.parse(examenesHeces.resultado || '{}') };
        }

        var uro = null;
        if (examenesUro && window.tieneDatosUroanalisis(examenesUro)) {
            var datosUro = JSON.parse(examenesUro.resultado || '{}');
            var gruposUro = {};
            if (window.UROANALISIS_FIELDS) {
                window.UROANALISIS_FIELDS.forEach(function(f) {
                    var g = f.grupo || 'General';
                    if (!gruposUro[g]) gruposUro[g] = [];
                    gruposUro[g].push(f);
                });
            }
            var ordenGruposUro = ['Macroscópico', 'Químico', 'Microscópico'];
            Object.keys(gruposUro).forEach(function(g) {
                if (ordenGruposUro.indexOf(g) === -1) ordenGruposUro.push(g);
            });
            uro = { datos: datosUro, grupos: gruposUro, ordenGrupos: ordenGruposUro };
        }

        var hayResultados = examenesNormales.length > 0 ||
            (examenesHeces && window.tieneDatosHeces(examenesHeces)) ||
            (examenesUro && window.tieneDatosUroanalisis(examenesUro));

        return {
            header: header,
            firma: {
                nombre: 'Lcda. Andréina Rondón',
                cargo: 'Bioanalista Responsable',
                colegiados: 'C.B. 17.774 | MPPS 20.913'
            },
            secciones: secciones,
            heces: heces,
            uro: uro,
            refAdaptadas: refAdaptadas,
            categoriaRef: categoriaRef,
            hayResultados: hayResultados
        };
    }

    /* ---------- Renderers para pantalla (Bootstrap) ---------- */
    function renderTablaDom(rows) {
        var esSecrecionVaginal = rows.length > 0 && rows[0].esSecrecionVaginal;
        var html = '<div class="table-responsive"><table class="table table-bordered"><thead><tr><th width="35%">Examen</th>' +
            (esSecrecionVaginal
                ? '<th width="65%">Resultado</th>'
                : '<th width="20%">Resultado</th><th width="15%">Unidad</th><th width="30%">Valores de Referencia</th>') +
            '</tr></thead><tbody>';

        rows.forEach(function(row) {
            if (esSecrecionVaginal) {
                html += '<tr><td class="fw-semibold">' + row.nombre + '</td><td class="' + row.clase + '">' + row.texto + '</td></tr>';
            } else {
                html += '<tr><td class="fw-semibold">' + row.nombre + '</td><td class="' + row.clase + '">' + row.texto + '</td><td class="text-muted">' + row.unidad + '</td><td>' + row.refTexto + '</td></tr>';
            }
        });

        html += '</tbody></table></div>';
        return html;
    }

    function renderAreaDom(seccion) {
        var html = '<h6 class="reporte-area-titulo">' + seccion.nombre + '</h6>';
        seccion.subareas.forEach(function(sub) {
            if (sub.titulo) html += '<h6 class="reporte-subarea-titulo mt-3">' + sub.titulo + '</h6>';
            if (sub.rows) html += renderTablaDom(sub.rows);
            if (sub.notas) {
                html += '<h6 class="reporte-subarea-titulo mt-3">Notas y Observaciones</h6>';
                html += '<div class="alert alert-light border rounded mb-0" style="white-space: pre-wrap;">' + escapeHtml(sub.notas) + '</div>';
            }
        });
        return html;
    }

    function renderHecesDom(heces) {
        if (!heces) return '';
        var d = heces.datos;
        return '<h6 class="reporte-area-titulo">Examen de Heces</h6>' +
            '<div class="table-responsive"><table class="table table-bordered table-sm"><tbody>' +
            '<tr><td class="fw-semibold" width="40%">Moco Fecal</td><td>' + (d.mocoFecal || '-') + '</td></tr>' +
            '<tr><td class="fw-semibold">pH Heces</td><td>' + (d.phHeces || '-') + '</td></tr>' +
            '<tr><td class="fw-semibold">Glucosa Heces</td><td>' + (d.glucosaHeces || '-') + '</td></tr>' +
            '<tr><td class="fw-semibold">Leucocitos PMN</td><td>' + (d.leucocitosPMN || '-') + '</td></tr>' +
            '<tr><td class="fw-semibold">Leucocitos Mononucleados</td><td>' + (d.leucocitosMononucleados || '-') + '</td></tr>' +
            '<tr><td class="fw-semibold">Sustancias Reductoras</td><td>' + (d.sustanciasReductoras ? d.sustanciasReductoras + ' (' + window.interpretarSustanciasReductoras(d.sustanciasReductoras).texto + ')' : '-') + '</td></tr>' +
            '<tr><td class="fw-semibold">Consistencia</td><td>' + (d.consistencia || '-') + '</td></tr>' +
            '<tr><td class="fw-semibold">Color Heces</td><td>' + (d.colorHeces || '-') + '</td></tr>' +
            '<tr><td class="fw-semibold">Directo Concentración</td><td>' + (d.directoConcentracion || '-') + '</td></tr>' +
            '<tr><td class="fw-semibold">Entamoeba coli</td><td>' + (d.entamoebaColi || '-') + '</td></tr>' +
            '<tr><td class="fw-semibold">Restos Alimentos</td><td>' + (d.restosAlimentos || '-') + '</td></tr>' +
            '<tr><td class="fw-semibold">Flora Bacteriana</td><td>' + (d.floraBacteriana || '-') + '</td></tr>' +
            '</tbody></table></div>';
    }

    function renderUroDom(uro) {
        if (!uro) return '';
        var datosUro = uro.datos;
        var html = '<h6 class="reporte-area-titulo">Examen de Orina / Uroanálisis</h6>';
        var primerGrupoUro = true;
        uro.ordenGrupos.forEach(function(grupo) {
            if (!uro.grupos[grupo]) return;
            if (primerGrupoUro) html += '<div class="pdf-titulo-contenido">';
            html += '<h6 class="reporte-subarea-titulo mt-3">' + grupo + '</h6>';
            html += '<div class="table-responsive"><table class="table table-bordered table-sm"><tbody>';
            uro.grupos[grupo].forEach(function(f) {
                var val = datosUro[f.id] || '-';
                if (val === '') val = '-';
                html += '<tr><td class="fw-semibold" width="40%">' + f.nombre + '</td><td>' + val + '</td></tr>';
            });
            html += '</tbody></table></div>';
            if (primerGrupoUro) {
                html += '</div>';
                primerGrupoUro = false;
            }
        });
        return html;
    }

    function renderDom(payload, root) {
        var h = payload.header;

        setText('reporteNombre', h.nombre);
        setText('reporteCedula', h.cedula);
        setText('reporteEdad', h.edad);
        setText('reporteSexo', h.sexo);
        setText('reporteTelefono', h.telefono);
        setText('ordenNumero', h.orden);
        setText('fechaEmision', h.fechaEmision);

        var perfilBadge = document.getElementById('reportePerfil');
        if (perfilBadge) {
            if (h.perfiles.length > 0) {
                perfilBadge.innerHTML = '<span class="info-label">Perfil(es):</span> <strong>' + h.perfiles.join(', ') + '</strong>';
            } else {
                perfilBadge.innerHTML = '';
            }
        }

        var badgeRef = document.getElementById('reporteRefAdaptadas');
        if (badgeRef) {
            if (payload.refAdaptadas) {
                badgeRef.style.display = 'inline-block';
                badgeRef.textContent = 'Referencias adaptadas (' + payload.categoriaRef + ')';
            } else {
                badgeRef.style.display = 'none';
            }
        }

        var contenedor = document.getElementById('contenedorResultados');
        if (contenedor) contenedor.innerHTML = '';

        payload.secciones.forEach(function(seccion) {
            var s = document.createElement('div');
            s.className = 'reporte-area-grupo';
            s.innerHTML = renderAreaDom(seccion);
            if (contenedor) contenedor.appendChild(s);
        });

        var bloqueHeces = document.getElementById('bloqueHeces');
        if (bloqueHeces) bloqueHeces.innerHTML = renderHecesDom(payload.heces);

        var bloqueUro = document.getElementById('bloqueUroanalisis');
        if (bloqueUro) bloqueUro.innerHTML = renderUroDom(payload.uro);
    }

    /* ============================================================
       HELPERS para "tablas" con <div> (html2pdf-friendly)
       Usamos display:table/table-row/table-cell en <div>s
       para que html2pdf.js maneje bien los saltos de página.
       ============================================================ */
    var TD_BORDER = 'border: 1px solid #ccc;';
    var TH_BORDER = 'border: 1px solid #000;';
    var CELL_PAD = 'padding: 4px 6px;';

    function divTableOpen() {
        return '<div style="display: table; width: 100%; border-collapse: collapse; font-size: 0.78rem; margin-bottom: 12px;">';
    }
    function divTableClose() { return '</div>'; }

    function divTheadOpen() {
        return '<div style="display: table-header-group; font-weight: bold;">';
    }
    function divTheadClose() { return '</div>'; }

    function divTbodyOpen() {
        return '<div style="display: table-row-group;">';
    }
    function divTbodyClose() { return '</div>'; }

    function divTrOpen() {
        return '<div style="display: table-row; page-break-inside: avoid; break-inside: avoid;">';
    }
    function divTrClose() { return '</div>'; }

    function divTh(content, widthPct, align) {
        var w = widthPct ? 'width: ' + widthPct + ';' : '';
        var a = align ? 'text-align: ' + align + ';' : 'text-align: left;';
        return '<div style="display: table-cell; ' + CELL_PAD + ' ' + TH_BORDER + ' background: #e9e9e9; ' + w + ' ' + a + '">' + content + '</div>';
    }

    function divTd(content, clase, align, widthPct) {
        var w = widthPct ? 'width: ' + widthPct + ';' : '';
        var a = align ? 'text-align: ' + align + ';' : '';
        var c = clase ? 'class="' + clase + '"' : '';
        return '<div ' + c + ' style="display: table-cell; ' + CELL_PAD + ' ' + TD_BORDER + ' ' + w + ' ' + a + '">' + content + '</div>';
    }

    /* ---------- Render inline (html2pdf) con DIVs ---------- */
    function renderTablaInline(rows) {
        var esSecrecionVaginal = rows.length > 0 && rows[0].esSecrecionVaginal;
        var html = divTableOpen();

        /* Encabezado */
        html += divTheadOpen();
        html += divTrOpen();
        html += divTh('Examen', '35%');
        if (esSecrecionVaginal) {
            html += divTh('Resultado', '65%');
        } else {
            html += divTh('Resultado', '20%', 'center');
            html += divTh('Unidad', '15%', 'center');
            html += divTh('Valores de Referencia', '30%', 'center');
        }
        html += divTrClose();
        html += divTheadClose();

        /* Cuerpo */
        html += divTbodyOpen();
        rows.forEach(function(row) {
            html += divTrOpen();
            html += divTd('<strong>' + row.nombre + '</strong>', '', '', '35%');
            if (esSecrecionVaginal) {
                html += divTd(row.texto, row.clase, 'center', '65%');
            } else {
                html += divTd(row.texto, row.clase, 'center', '20%');
                html += divTd(row.unidad, '', 'center', '15%');
                html += divTd(row.refTexto, '', 'center', '30%');
            }
            html += divTrClose();
        });
        html += divTbodyClose();
        html += divTableClose();
        return html;
    }

    function buildInlineHtml(payload) {
        var h = payload.header;
        var html = '<div style="font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; padding: 30px 40px; font-size: 10pt; line-height: 1.3;">';

        /* Encabezado del laboratorio */
        html += '<div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px;">';
        html += '<div style="font-size: 1.1rem; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">UNIDAD MÉDICO QUIRÚRGICA LUZ CORONADO C. A.</div>';
        html += '<div style="font-size: 0.7rem; line-height: 1.35;">Calle Principal Casa N° S/N Barrio Paéz. El Nula, Estado Apure, Venezuela<br>RIF: J-412745735 &nbsp;|&nbsp; Teléfono: 0416 4740671</div>';
        html += '</div>';
        html += '<br><br>';

        /* Datos del paciente */
        html += '<div style="margin-bottom: 14px; font-size: 0.78rem;">';
        html += '<div><strong>Nombre y Apellido:</strong> ' + escapeHtml(h.nombre) + '</div>';
        html += '<div><strong>Cédula:</strong> ' + escapeHtml(h.cedula) + '</div>';
        html += '<div><strong>Edad:</strong> ' + escapeHtml(h.edad) + '</div>';
        html += '<div><strong>Sexo:</strong> ' + escapeHtml(h.sexo) + '</div>';
        html += '<div><strong>Teléfono:</strong> ' + escapeHtml(h.telefono) + '</div>';
        html += '<div><strong>Orden N°:</strong> ' + escapeHtml(h.orden) + '</div>';
        if (h.perfiles.length > 0) html += '<div><strong>Perfil(es):</strong> ' + escapeHtml(h.perfiles.join(', ')) + '</div>';
        if (payload.refAdaptadas) html += '<div><strong>Referencias adaptadas:</strong> (' + payload.categoriaRef + ')</div>';
        html += '</div>';

        /* Título de resultados */
        html += '<h2 style="font-size: 1.1rem; font-weight: bold; text-align: center; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px; margin: 22px 0 12px;">Resultados de Exámenes de Laboratorio</h2>';

        /* Áreas de resultados */
        payload.secciones.forEach(function(seccion) {
            html += '<div class="pdf-bloque">';
            html += '<h3 style="font-size: 0.9rem; font-weight: bold; text-align: center; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3px; margin: 14px 0 8px;">' + seccion.nombre + '</h3>';
            seccion.subareas.forEach(function(sub) {
                if (sub.titulo) html += '<h4 style="font-size: 0.85rem; font-weight: 600; font-style: italic; margin: 6px 0 4px; text-align: center;">' + sub.titulo + '</h4>';
                if (sub.rows) html += renderTablaInline(sub.rows);
                if (sub.notas) {
                    html += '<h4 style="font-size: 0.85rem; font-weight: 600; font-style: italic; margin: 6px 0 4px; text-align: center;">Notas y Observaciones</h4>';
                    html += '<div style="background: #f8f9fa; border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; margin-bottom: 6px; white-space: pre-wrap; font-size: 0.78rem;">' + escapeHtml(sub.notas) + '</div>';
                }
            });
            html += '</div>';
        });

        /* Heces */
        if (payload.heces) {
            var d = payload.heces.datos;
            html += '<div class="pdf-bloque pdf-especial">';
            html += '<h3 style="font-size: 0.9rem; font-weight: bold; text-align: center; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3px; margin: 14px 0 8px;">Examen de Heces</h3>';
            html += divTableOpen();
            html += divTbodyOpen();
            function hecesRow(label, val) {
                html += divTrOpen();
                html += divTd('<strong>' + label + '</strong>', '', '', '40%');
                html += divTd(val || '-', '');
                html += divTrClose();
            }
            hecesRow('Moco Fecal', d.mocoFecal);
            hecesRow('pH Heces', d.phHeces);
            hecesRow('Glucosa Heces', d.glucosaHeces);
            hecesRow('Leucocitos PMN', d.leucocitosPMN);
            hecesRow('Leucocitos Mononucleados', d.leucocitosMononucleados);
            html += divTrOpen();
            html += divTd('<strong>Sustancias Reductoras</strong>', '', '', '40%');
            html += divTd(d.sustanciasReductoras ? d.sustanciasReductoras + ' (' + window.interpretarSustanciasReductoras(d.sustanciasReductoras).texto + ')' : '-', '');
            html += divTrClose();
            hecesRow('Consistencia', d.consistencia);
            hecesRow('Color Heces', d.colorHeces);
            hecesRow('Directo Concentración', d.directoConcentracion);
            hecesRow('Entamoeba coli', d.entamoebaColi);
            hecesRow('Restos Alimentos', d.restosAlimentos);
            hecesRow('Flora Bacteriana', d.floraBacteriana);
            html += divTbodyClose();
            html += divTableClose();
            html += '</div>';
        }

        /* Firma compacta al cierre de la primera hoja. */
        html += '<div class="reporte-firma-primera pdf-firma-primera">';
        html += '<div class="firma-linea">Lcda. Andréina Rondón</div>';
        html += '<div class="firma-profesional">Bioanalista Responsable<br>C.B. 17.774 | MPPS 20.913</div>';
        html += '</div>';

        /* Uroanálisis */
        if (payload.uro) {
            html += '<div class="pdf-bloque pdf-especial pdf-uroanalisis">';
            var primerGrupoUro = true;
            payload.uro.ordenGrupos.forEach(function(grupo) {
                if (!payload.uro.grupos[grupo]) return;
                if (primerGrupoUro) {
                    html += '<div class="pdf-titulo-contenido">';
                    html += '<h3 style="font-size: 0.9rem; font-weight: bold; text-align: center; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3px; margin: 14px 0 8px;">Examen de Orina / Uroanálisis</h3>';
                }
                html += '<h4 style="font-size: 0.85rem; font-weight: 600; font-style: italic; margin: 6px 0 4px; text-align: center;">' + grupo + '</h4>';
                html += divTableOpen();
                html += divTbodyOpen();
                payload.uro.grupos[grupo].forEach(function(f) {
                    var val = payload.uro.datos[f.id] || '-';
                    if (val === '') val = '-';
                    html += divTrOpen();
                    html += divTd('<strong>' + f.nombre + '</strong>', '', '', '40%');
                    html += divTd(val, '');
                    html += divTrClose();
                });
                html += divTbodyClose();
                html += divTableClose();
                if (primerGrupoUro) {
                    html += '</div>';
                    primerGrupoUro = false;
                }
            });
            html += '</div>';
        }

        /* Firma */
        var f = payload.firma;
        html += '<div class="reporte-firma-impresion pdf-firma-fija" style="margin-top: 30px; text-align: center; font-size: 0.78rem;">';
        html += '<div style="border-top: 1px solid #000; width: 220px; margin: 28px auto 3px; padding-top: 4px; text-align: center; font-weight: 700; font-size: 0.72rem;">' + f.nombre + '</div>';
        html += '<div style="text-align: center; font-size: 0.62rem; line-height: 1.3;">' + f.cargo + '<br>C.B. 17.774 | MPPS 20.913</div>';
        html += '</div>';

        html += '</div>';
        return html;
    }

    /* ---------- Acciones ---------- */
    function vistaPrevia() {
        window.print();
    }

    function descargarPDF() {
        var orden = new URLSearchParams(window.location.search).get('orden') || '';
        var paciente = window.obtenerPacientes().find(function(p) { return p.orden === orden; });
        if (!paciente) {
            alert('Paciente no encontrado.');
            return;
        }

        if (typeof html2pdf === 'undefined') {
            window.vistaPrevia();
            return;
        }

        var nombreSanitizado = (paciente.orden || paciente.nombre || 'reporte')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 100);

        var payload = buildPayload(paciente);
        var html = buildInlineHtml(payload);

        var div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div);

        html2pdf().from(div).set({
            filename: nombreSanitizado + '.pdf',
            margin: [10, 10, 10, 10],
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                letterRendering: true,
                allowTaint: false,
                logging: false
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
                compress: true
            },
            pagebreak: {
                mode: ['css', 'legacy'],
                avoid: ['.pdf-titulo-contenido', '.pdf-bloque h3', '.pdf-bloque h4', '[style*="display: table-row"]']
            }
        }).save().then(function() {
            if (div.parentNode) document.body.removeChild(div);
        }).catch(function(err) {
            console.error('Error generando PDF:', err);
            if (div.parentNode) document.body.removeChild(div);
            window.vistaPrevia();
        });
    }

    window.PdfReport = {
        buildPayload: buildPayload,
        renderDom: renderDom,
        buildInlineHtml: buildInlineHtml,
        vistaPrevia: vistaPrevia,
        descargarPDF: descargarPDF
    };

    window.vistaPrevia = vistaPrevia;
    window.descargarPDF = descargarPDF;
})();