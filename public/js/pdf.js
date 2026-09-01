/**
 * Módulo de generación / impresión del PDF del reporte.
 *
 * Punto único de control sobre qué exámenes/resultados se cargan en el PDF
 * antes de imprimir o descargar. Expone el namespace `window.PdfReport`:
 *   - buildPayload(paciente):  construye el modelo unificado de datos
 *                              (migración ur_*, referencias adaptadas,
 *                              clasificación de resultados, heces/uro).
 *   - renderDom(payload, root): rellena el reporte on-screen (#area-imprimir)
 *                              con markup idéntico al generado por reporte.js.
 *   - buildInlineHtml(payload): genera el HTML inline (estilos inline) usado
 *                              por html2pdf para descargar el PDF.
 *   - vistaPrevia():            abre el diálogo de impresión del navegador.
 *   - descargarPDF():           genera y descarga el PDF vía html2pdf.
 *
 * Requisitos de carga (ver plan): pdf.js se enlaza en reporte.html
 * DESPUÉS de reporte.js y de todos los helpers globales, y ANTES de app.js,
 * de modo que `PdfReport` está definido antes de que app.js dispare
 * DOMContentLoaded → initReporte().
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
/* Setea el texto de un elemento por id, o lo limpia si no existe. */
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
        } 
        /* Los exámenes de tipo "texto" o "seleccion_unica" 
        no se clasifican como alto/bajo. */
        else {
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
/* Clasifica un examen individual y devuelve un objeto con:
         - nombre: nombre del examen
            - texto: resultado clasificado (con flechas si es alto/bajo)
            - clase: clase CSS para colorear el resultado
            - unidad: unidad del examen (o '-' si no tiene)
            - refTexto: texto de referencia (ej. "3.5 - 5.0" o "-")
            - esSecrecionVaginal: true si el examen pertenece a Secreción Vaginal
    */

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
        // Trabajar sobre una copia profunda para no mutar los datos almacenados.
        var examenes = JSON.parse(JSON.stringify(paciente.examenes || []));
        var examenesHeces = examenes.find(function(e) { return e.tipoFormulario === 'heces'; });
        var examenesUro = examenes.find(function(e) { return e.tipoFormulario === 'uroanalisis'; });
        var examenesNormales = examenes.filter(function(e) {
            return e.tipoFormulario !== 'heces' && e.tipoFormulario !== 'uroanalisis';
        });

        /* Migrar uróis individuales ur_* a formulario uro (parity con reporte.js:20-41). */
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
        var fechaEmision = ahora.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        fechaEmision = fechaEmision.charAt(0).toUpperCase() + fechaEmision.slice(1);

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

        /* Áreas normales agrupadas por area (parity con reporte.js:95-143). */
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

        /* Heces (parity con reporte.js:145-151). */
        var heces = null;
        if (examenesHeces && window.tieneDatosHeces(examenesHeces)) {
            heces = { datos: JSON.parse(examenesHeces.resultado || '{}') };
        }

        /* Uroanálisis formulario (parity con reporte.js:153-181). */
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

    /* ---------- Renderers ----------
       renderDom: markup idéntico al de reporte.js (Bootstrap). */
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
        uro.ordenGrupos.forEach(function(grupo) {
            if (!uro.grupos[grupo]) return;
            html += '<h6 class="reporte-subarea-titulo mt-3">' + grupo + '</h6>';
            html += '<div class="table-responsive"><table class="table table-bordered table-sm"><tbody>';
            uro.grupos[grupo].forEach(function(f) {
                var val = datosUro[f.id] || '-';
                if (val === '') val = '-';
                html += '<tr><td class="fw-semibold" width="40%">' + f.nombre + '</td><td>' + val + '</td></tr>';
            });
            html += '</tbody></table></div>';
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

    /* ---------- Render inline (html2pdf) ----------
       Rama A unificada: lee del payload con page-break-inside: auto. */
    function renderTablaInline(rows) {
        var esSecrecionVaginal = rows.length > 0 && rows[0].esSecrecionVaginal;
        var html = '<table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid;">';
        html += '<thead><tr style="page-break-inside: avoid; break-inside: avoid;"><th style="font-weight: bold; padding: 4px 6px; border: 1px solid #000; background: #e9e9e9; width: 35%; text-align: left;">Examen</th>';
        if (esSecrecionVaginal) {
            html += '<th style="font-weight: bold; padding: 4px 6px; border: 1px solid #000; background: #e9e9e9; width: 65%; text-align: left;">Resultado</th>';
        } else {
            html += '<th style="font-weight: bold; padding: 4px 6px; border: 1px solid #000; background: #e9e9e9; width: 20%; text-align: center;">Resultado</th>' +
                '<th style="font-weight: bold; padding: 4px 6px; border: 1px solid #000; background: #e9e9e9; width: 15%; text-align: center;">Unidad</th>' +
                '<th style="font-weight: bold; padding: 4px 6px; border: 1px solid #000; background: #e9e9e9; width: 30%; text-align: center;">Valores de Referencia</th>';
        }
        html += '</tr></thead><tbody>';
        rows.forEach(function(row) {
            if (esSecrecionVaginal) {
                html += '<tr style="page-break-inside: avoid; break-inside: avoid;"><td style="font-weight: 600; padding: 4px 6px; border: 1px solid #ccc;">' + row.nombre + '</td><td class="' + row.clase + '" style="padding: 4px 6px; border: 1px solid #ccc; text-align: center;">' + row.texto + '</td></tr>';
            } else {
                html += '<tr style="page-break-inside: avoid; break-inside: avoid;"><td style="font-weight: 600; padding: 4px 6px; border: 1px solid #ccc;">' + row.nombre + '</td>' +
                    '<td class="' + row.clase + '" style="padding: 4px 6px; border: 1px solid #ccc; text-align: center;">' + row.texto + '</td>' +
                    '<td style="padding: 4px 6px; border: 1px solid #ccc; text-align: center; color: #555;">' + row.unidad + '</td>' +
                    '<td style="padding: 4px 6px; border: 1px solid #ccc; text-align: center;">' + row.refTexto + '</td></tr>';
            }
        });
        html += '</tbody></table>';
        return html;
    }

    function buildInlineHtml(payload) {
        var h = payload.header;
        var html = '<div style="font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; padding: 30px 40px; font-size: 10pt; line-height: 1.3;">';

        /* Encabezado del laboratorio con logo */
        html += '<div style="display: flex; align-items: flex-start; gap: 20px; padding-bottom: 10px; border-bottom: 2px solid #000; margin-bottom: 14px;">';
        html += '<div style="flex-shrink: 0;">';
        html += '<img src="../public/imagen/logo1.png" alt="logo" style="max-height: 100px; max-width: 100px; object-fit: contain;">';
        html += '</div>';
        html += '<div style="flex: 1; text-align: center;">';
        html += '<div style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">UNIDAD MÉDICO QUIRÚRGICA LUZ CORONADO C. A.</div>';
        html += '<div style="font-size: 0.62rem; line-height: 1.35;">Calle Principal Casa N° S/N Barrio Paéz. El Nula, Estado Apure, Venezuela<br>RIF: J-412745735 &nbsp;|&nbsp; Teléfono: 0416 4740671</div>';
        html += '</div>';
        html += '<div style="font-size: 0.62rem; text-align: right; white-space: nowrap; flex-shrink: 0;">';
        html += '<strong>Fecha de Emisión:</strong> ' + escapeHtml(h.fechaEmision);
        html += '</div>';
        html += '</div>';

        /* Datos del paciente en grid */
        html += '<div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 1px 15px; margin-bottom: 14px; padding-top: 4px; border-top: 1px solid #ccc; font-size: 0.78rem;">';
        html += '<div><strong>Nombre y Apellido:</strong> ' + escapeHtml(h.nombre) + '</div>';
        html += '<div><strong>Cédula de Identidad:</strong> ' + escapeHtml(h.cedula) + '</div>';
        html += '<div><strong>Edad:</strong> ' + escapeHtml(h.edad) + '</div>';
        html += '<div><strong>Sexo:</strong> ' + escapeHtml(h.sexo) + '</div>';
        html += '<div><strong>Teléfono de Contacto:</strong> ' + escapeHtml(h.telefono) + '</div>';
        html += '<div><strong>Orden N°:</strong> ' + escapeHtml(h.orden) + '</div>';
        if (h.perfiles.length > 0) html += '<div style="grid-column: 1 / -1;"><strong>Perfil(es):</strong> ' + escapeHtml(h.perfiles.join(', ')) + '</div>';
        if (payload.refAdaptadas) html += '<div style="grid-column: 1 / -1;"><strong>Referencias adaptadas:</strong> (' + payload.categoriaRef + ')</div>';
        html += '</div>';

        /* Título de resultados */
        html += '<h2 style="font-size: 0.95rem; font-weight: bold; text-align: center; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px; margin: 20px 0 12px;">Resultados de Exámenes de Laboratorio</h2>';

        /* Áreas de resultados */
        payload.secciones.forEach(function(seccion) {
            html += '<h3 style="font-size: 0.85rem; font-weight: bold; text-align: center; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; margin: 12px 0 8px;">' + seccion.nombre + '</h3>';
            seccion.subareas.forEach(function(sub) {
                if (sub.titulo) html += '<h4 style="font-size: 0.78rem; font-weight: 600; font-style: italic; margin: 4px 0 2px; text-align: center;">' + sub.titulo + '</h4>';
                if (sub.rows) html += renderTablaInline(sub.rows);
                if (sub.notas) {
                    html += '<h4 style="font-size: 0.78rem; font-weight: 600; font-style: italic; margin: 4px 0 2px; text-align: center;">Notas y Observaciones</h4>';
                    html += '<div style="background: #f8f9fa; border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; margin-bottom: 6px; white-space: pre-wrap; font-size: 0.78rem;">' + escapeHtml(sub.notas) + '</div>';
                }
            });
        });

        /* Heces */
        if (payload.heces) {
            var d = payload.heces.datos;
            html += '<h3 style="font-size: 0.85rem; font-weight: bold; text-align: center; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; margin: 12px 0 8px; page-break-after: avoid;">Examen de Heces</h3>';
            html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; margin-bottom: 10px; page-break-inside: avoid;"><tbody>';
            function hecesRow(label, val) {
                html += '<tr style="page-break-inside: avoid;"><td style="font-weight: 600; padding: 4px 6px; border: 1px solid #ccc; width: 40%;">' + label + '</td><td style="padding: 4px 6px; border: 1px solid #ccc;">' + (val || '-') + '</td></tr>';
            }
            hecesRow('Moco Fecal', d.mocoFecal);
            hecesRow('pH Heces', d.phHeces);
            hecesRow('Glucosa Heces', d.glucosaHeces);
            hecesRow('Leucocitos PMN', d.leucocitosPMN);
            hecesRow('Leucocitos Mononucleados', d.leucocitosMononucleados);
            html += '<tr style="page-break-inside: avoid;"><td style="font-weight: 600; padding: 4px 6px; border: 1px solid #ccc; width: 40%;">Sustancias Reductoras</td><td style="padding: 4px 6px; border: 1px solid #ccc;">' + (d.sustanciasReductoras ? d.sustanciasReductoras + ' (' + window.interpretarSustanciasReductoras(d.sustanciasReductoras).texto + ')' : '-') + '</td></tr>';
            hecesRow('Consistencia', d.consistencia);
            hecesRow('Color Heces', d.colorHeces);
            hecesRow('Directo Concentración', d.directoConcentracion);
            hecesRow('Entamoeba coli', d.entamoebaColi);
            hecesRow('Restos Alimentos', d.restosAlimentos);
            hecesRow('Flora Bacteriana', d.floraBacteriana);
            html += '</tbody></table>';
        }

        /* Uroanálisis */
        if (payload.uro) {
            html += '<h3 style="font-size: 0.85rem; font-weight: bold; text-align: center; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; margin: 12px 0 8px; page-break-after: avoid;">Examen de Orina / Uroanálisis</h3>';
            payload.uro.ordenGrupos.forEach(function(grupo) {
                if (!payload.uro.grupos[grupo]) return;
                html += '<h4 style="font-size: 0.78rem; font-weight: 600; font-style: italic; margin: 4px 0 2px; text-align: center; page-break-after: avoid;">' + grupo + '</h4>';
                html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; margin-bottom: 10px; page-break-inside: avoid;"><tbody>';
                payload.uro.grupos[grupo].forEach(function(f) {
                    var val = payload.uro.datos[f.id] || '-';
                    if (val === '') val = '-';
                    html += '<tr style="page-break-inside: avoid;"><td style="font-weight: 600; padding: 4px 6px; border: 1px solid #ccc; width: 40%;">' + f.nombre + '</td><td style="padding: 4px 6px; border: 1px solid #ccc;">' + val + '</td></tr>';
                });
                html += '</tbody></table>';
            });
        }

        /* Firma */
        var f = payload.firma;
        html += '<div style="margin-top: 30px; text-align: center; font-size: 0.78rem;">';
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
            window.print();
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

        /* Configuración optimizada para html2pdf:
           - Márgenes reducidos (10mm) para maximizar espacio útil
           - pagebreak: 'avoid-all' respeta las reglas CSS de salto de página
           - scale: 2 para mejor calidad de renderizado
           - letterRendering: true para mejor manejo de caracteres especiales
           - useCORS: true para cargar imágenes externas si es necesario
        */
        html2pdf().from(div).set({
            filename: nombreSanitizado + '.pdf',
            margin: [10, 10, 10, 10], // top, left, bottom, right en mm
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
                mode: ['avoid-all', 'css', 'legacy'],
                before: '.reporte-area-grupo, #bloqueHeces, #bloqueUroanalisis',
                after: '.reporte-area-titulo, .reporte-subarea-titulo',
                avoid: 'tr, tbody, .reporte-tabla'
            }
        }).save().then(function() {
            if (div.parentNode) document.body.removeChild(div);
        }).catch(function(err) {
            console.error('Error generando PDF:', err);
            if (div.parentNode) document.body.removeChild(div);
            // Fallback a impresión nativa si falla html2pdf
            window.print();
        });
    }

    window.PdfReport = {
        buildPayload: buildPayload,
        renderDom: renderDom,
        buildInlineHtml: buildInlineHtml,
        vistaPrevia: vistaPrevia,
        descargarPDF: descargarPDF
    };

    /* Exponer como globales para el onclick inline y la consola. */
    window.vistaPrevia = vistaPrevia;
    window.descargarPDF = descargarPDF;
})();
