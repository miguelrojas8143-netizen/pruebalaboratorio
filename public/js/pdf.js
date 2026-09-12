/**
 * Módulo de generación / impresión del PDF del reporte.
 * La descarga usa jsPDF + jspdf-autotable; la vista previa conserva HTML/CSS.
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

    function expandirExamenesDetallados(examenes) {
        var resultado = [];
        examenes.forEach(function(examen) {
            var detalle = window.App && window.App.examenesDetallados
                ? window.App.examenesDetallados[examen.id]
                : null;
            if (examen.tipo !== 'perfil' || !detalle || !detalle.items || !detalle.items.length) {
                resultado.push(examen);
                return;
            }

            var valores = {};
            try {
                valores = JSON.parse(examen.resultado || '{}');
            } catch (e) {}

            detalle.items.forEach(function(item) {
                resultado.push({
                    id: item.id,
                    nombre: item.nombre,
                    area: item.area || examen.area || 'General',
                    unidad: item.unidad || '',
                    refMin: item.refMin,
                    refMax: item.refMax,
                    tipo: item.tipo === 'calculado' ? 'numerico' : (item.tipo || 'numerico'),
                    resultado: valores[item.id] == null ? '' : String(valores[item.id]),
                    grupoPerfil: examen.grupoPerfil,
                    grupo: item.grupo || examen.nombre
                });
            });
        });
        return resultado;
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

        examenesNormales = expandirExamenesDetallados(examenesNormales);

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

    /*
     * Generacion HTML para html2pdf.js desactivada.
     * El PDF se genera exclusivamente con jsPDF + jspdf-autotable.
     * La vista previa del reporte usa renderDom() directamente.
     */

    /* ---------- Acciones ---------- */
    async function generarPDF(accion) {
        var orden = new URLSearchParams(window.location.search).get('orden') || '';
        var paciente = window.obtenerPacientes().find(function(p) { return p.orden === orden; });
        if (!paciente) {
            alert('Paciente no encontrado.');
            return;
        }

        if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.API.autoTable) {
            alert('No se pudo cargar el generador PDF. Revise las librerías jsPDF y autoTable.');
            return;
        }

        var ventanaImpresion = null;
        if (accion === 'imprimir') {
            ventanaImpresion = window.open('', '_blank');
            if (!ventanaImpresion) {
                alert('El navegador bloqueó la ventana de impresión. Permita las ventanas emergentes para este sitio.');
                return;
            }
            ventanaImpresion.document.write('<p style="font-family: Arial; padding: 24px;">Preparando documento para imprimir...</p>');
            ventanaImpresion.document.close();
        }

        var nombreSanitizado = (paciente.orden || paciente.nombre || 'reporte')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 100);

        var logoData = await cargarLogoPDF();
        var doc = construirPDF(buildPayload(paciente), logoData);
        if (!doc) {
            if (ventanaImpresion) ventanaImpresion.close();
            return;
        }

        if (accion === 'imprimir') {
            doc.autoPrint();
            ventanaImpresion.location.href = doc.output('bloburl');
        } else {
            doc.save(nombreSanitizado + '.pdf');
        }
    }

    function vistaPrevia() {
        generarPDF('imprimir');
    }

    function textoPlano(valor) {
        return String(valor == null ? '' : valor).replace(/<[^>]*>/g, '').trim();
    }

    function agregarTablaPDF(doc, titulo, encabezados, filas, opciones) {
        opciones = opciones || {};
        var filasTabla = filas.slice();
        var yInicial = opciones.y || 20;
        var pageHeight = doc.internal.pageSize.getHeight();
        var espacioInferior = 30;
        if (titulo && opciones.alturaMinima && yInicial + opciones.alturaMinima > pageHeight - espacioInferior) {
            doc.addPage();
            if (opciones.didDrawPage) {
                opciones.didDrawPage({ pageNumber: doc.getNumberOfPages() });
            }
            yInicial = 56;
        }
        if (titulo) {
            filasTabla.unshift([{
                content: titulo.toUpperCase(),
                colSpan: encabezados.length,
                styles: {
                    fillColor: [224, 235, 242],
                    textColor: [31, 78, 104],
                    fontStyle: 'bold',
                    fontSize: 8.5,
                    halign: 'left'
                }
            }]);
        }
        doc.autoTable({
            startY: yInicial,
            head: [encabezados],
            body: filasTabla,
            theme: 'grid',
            margin: { top: 43, right: 14, bottom: 30, left: 14 },
            styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, textColor: [25, 25, 25] },
            headStyles: { fillColor: [31, 78, 104], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 251, 253] },
            columnStyles: opciones.columnStyles || {},
            didDrawPage: opciones.didDrawPage,
            pageBreak: opciones.pageBreak || 'avoid',
            rowPageBreak: 'avoid'
        });
        return doc.lastAutoTable.finalY + 7;
    }

    function construirPDF(payload, logoData) {
        if (!window.jspdf || !window.jspdf.jsPDF) return null;
        var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
        var pageWidth = doc.internal.pageSize.getWidth();
        var pageHeight = doc.internal.pageSize.getHeight();
        var h = payload.header;

        function encabezadoPagina(data) {
            var logoX = 14;
            var logoY = 14;
            var logoSize = 22;
            if (logoData) {
                try {
                    doc.addImage(logoData, 'PNG', logoX, logoY, logoSize, logoSize);
                } catch (e) {}
            }
            doc.setTextColor(25, 25, 25);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.text('UNIDAD MÉDICO QUIRÚRGICA', 42, 16);
            doc.text('LUZ CORONADO C. A.', 42, 21);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text('Calle Principal Casa N° S/N Barrio Páez. El Nula, Estado Apure, Venezuela', 42, 26);
            doc.text('RIF: J-412745735  |  Teléfono: 0416 4740671', 42, 30);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text('Fecha de Emisión:', pageWidth - 14, 17, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.text(textoPlano(h.fechaEmision), pageWidth - 14, 22, { align: 'right' });
            doc.text('Orden N° ' + textoPlano(h.orden), pageWidth - 14, 27, { align: 'right' });
            doc.setDrawColor(31, 78, 104);
            doc.setLineWidth(0.5);
            doc.line(14, 36, pageWidth - 14, 36);
            doc.setFontSize(7);
            doc.setTextColor(90, 90, 90);
            doc.text('Página ' + data.pageNumber, pageWidth / 2, pageHeight - 8, { align: 'center' });
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.3);
            doc.line(pageWidth / 2 - 30, pageHeight - 22, pageWidth / 2 + 30, pageHeight - 22);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(25, 25, 25);
            doc.text('Lcda. Andréina Rondón', pageWidth / 2, pageHeight - 18, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text('Bioanalista Responsable  |  C.B. 17.774  |  MPPS 20.913', pageWidth / 2, pageHeight - 14, { align: 'center' });
        }

        doc.setProperties({ title: 'Reporte de resultados - ' + textoPlano(h.nombre), subject: 'Resultados de laboratorio' });
        encabezadoPagina({ pageNumber: 1 });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(25, 25, 25);
        var datosPaciente = 'Paciente: ' + textoPlano(h.nombre) +
            '  |  Cédula: ' + textoPlano(h.cedula) +
            '  |  Edad: ' + textoPlano(h.edad) +
            '  |  Sexo: ' + textoPlano(h.sexo) +
            '  |  Teléfono: ' + textoPlano(h.telefono);
        var lineasPaciente = doc.splitTextToSize(datosPaciente, pageWidth - 28);
        doc.text(lineasPaciente, 14, 43);
        var lineaSeparadoraY = 43 + (lineasPaciente.length * 3.5) + 1;
        doc.setDrawColor(190, 200, 210);
        doc.setLineWidth(0.25);
        doc.line(14, lineaSeparadoraY, pageWidth - 14, lineaSeparadoraY);

        var y = lineaSeparadoraY + 9;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('RESULTADOS DE EXÁMENES DE LABORATORIO', pageWidth / 2, y, { align: 'center' });
        y += 6;

        payload.secciones.forEach(function(seccion) {
            seccion.subareas.forEach(function(sub) {
                if (sub.rows) {
                    var tituloSeccion = seccion.nombre + (sub.titulo ? ' - ' + sub.titulo : '');
                    y = agregarTablaPDF(doc, tituloSeccion, ['Examen', 'Resultado', 'Unidad', 'Valores de referencia'], sub.rows.map(function(row) {
                        return [textoPlano(row.nombre), textoPlano(row.texto), textoPlano(row.unidad), textoPlano(row.refTexto)];
                    }), { y: y, alturaMinima: 18, didDrawPage: encabezadoPagina });
                }
                if (sub.notas) {
                    y = agregarTablaPDF(doc, seccion.nombre + ' - Notas y Observaciones', ['Observación'], [[textoPlano(sub.notas)]], { y: y, didDrawPage: encabezadoPagina });
                }
            });
            y += 2;
        });

        if (payload.heces) {
            var d = payload.heces.datos;
            var hecesFilas = [
                ['Moco Fecal', d.mocoFecal], ['pH Heces', d.phHeces], ['Glucosa Heces', d.glucosaHeces],
                ['Leucocitos PMN', d.leucocitosPMN], ['Leucocitos Mononucleados', d.leucocitosMononucleados],
                ['Sustancias Reductoras', d.sustanciasReductoras ? d.sustanciasReductoras + ' (' + window.interpretarSustanciasReductoras(d.sustanciasReductoras).texto + ')' : '-'],
                ['Consistencia', d.consistencia], ['Color Heces', d.colorHeces], ['Directo Concentración', d.directoConcentracion],
                ['Entamoeba coli', d.entamoebaColi], ['Restos Alimentos', d.restosAlimentos], ['Flora Bacteriana', d.floraBacteriana]
            ];
            y = agregarTablaPDF(doc, 'EXAMEN DE HECES', ['Parámetro', 'Resultado'], hecesFilas.map(function(row) { return [row[0], textoPlano(row[1] || '-')]; }), { y: y, alturaMinima: 72, didDrawPage: encabezadoPagina });
        }

        if (payload.uro) {
            payload.uro.ordenGrupos.forEach(function(grupo) {
                if (!payload.uro.grupos[grupo]) return;
                y = agregarTablaPDF(doc, 'EXAMEN DE ORINA - ' + grupo, ['Parámetro', 'Resultado'], payload.uro.grupos[grupo].map(function(field) {
                    return [textoPlano(field.nombre), textoPlano(payload.uro.datos[field.id] || '-')];
                }), { y: y, didDrawPage: encabezadoPagina });
            });
        }

        return doc;
    }

    function cargarLogoPDF() {
        return new Promise(function(resolve) {
            var imagen = new Image();
            imagen.onload = function() {
                try {
                    var canvas = document.createElement('canvas');
                    canvas.width = imagen.naturalWidth || imagen.width;
                    canvas.height = imagen.naturalHeight || imagen.height;
                    canvas.getContext('2d').drawImage(imagen, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (e) {
                    resolve(null);
                }
            };
            imagen.onerror = function() { resolve(null); };
            imagen.src = '../public/imagen/logo1.png';
        });
    }

    function descargarPDF() {
        generarPDF('descargar');
    }

    window.PdfReport = {
        buildPayload: buildPayload,
        renderDom: renderDom,
        construirPDF: construirPDF,
        generarPDF: generarPDF,
        vistaPrevia: vistaPrevia,
        descargarPDF: descargarPDF
    };

    window.vistaPrevia = vistaPrevia;
    window.descargarPDF = descargarPDF;
})();