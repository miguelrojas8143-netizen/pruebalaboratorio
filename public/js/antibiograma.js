
/**
 * Módulo para gestionar el formulario de Antibiograma
 */
(function() {
    'use strict';

    var OBSERVACIONES_DEFAULT = 'La cepa aislada no es productora de Beta-lactamasas de Espectro Extendido (BLEE negativo). Favor de correlacionar el resultado con el cuadro clínico del paciente.';

    /**
     * Panel de antibióticos tomado del catálogo, no hardcodeado.
     * `window.App.examenesDetallados.antibiograma` se hidrata desde
     * `parametros_examen` (SQLite), así que el panel se edita desde el
     * administrador del catálogo sin tocar este archivo.
     */
    function antibioticosPanel() {
        var detalle = window.App && window.App.examenesDetallados
            ? window.App.examenesDetallados.antibiograma
            : null;
        if (detalle && detalle.items && detalle.items.length) return detalle.items;
        return [];
    }

    function crearDatosUrocultivo(examen, catalogoAntibioticos) {
        var guardado = examen && examen.resultado;
        var datos = {};
        if (guardado && typeof guardado === 'object') {
            datos = guardado;
        } else if (guardado) {
            var texto = String(guardado);
            try {
                datos = JSON.parse(texto);
            } catch (error) {
                datos = { resultadoCultivo: texto };
            }
            if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
                datos = { resultadoCultivo: texto };
            }
        }

        var antibioticosGuardados = Array.isArray(datos.antibioticos) ? datos.antibioticos : [];
        var microorganismos = Array.isArray(datos.microorganismos)
            ? datos.microorganismos.map(function(microorganismo) {
                return { nombre: String(microorganismo && microorganismo.nombre || '') };
            })
            : [];
        if (!microorganismos.length) microorganismos.push({ nombre: '' });

        var metodosGuardados = datos.metodos && typeof datos.metodos === 'object' ? datos.metodos : null;
        var tieneCmi = antibioticosGuardados.some(function(abx) {
            return !!(abx && (abx.cmi || (abx.resultados && Object.keys(abx.resultados).some(function(indice) {
                return abx.resultados[indice] && abx.resultados[indice].cmi;
            }))));
        });
        var metodos = {
            cmi: metodosGuardados ? metodosGuardados.cmi === true : tieneCmi,
            difusion: metodosGuardados ? metodosGuardados.difusion === true : true
        };
        if (!metodos.cmi && !metodos.difusion) metodos.difusion = true;

        var panel = catalogoAntibioticos || antibioticosPanel();
        var antibioticos = panel.map(function(abx) {
            var existente = antibioticosGuardados.find(function(item) {
                return item && (item.id === abx.id || item.antibiotico === abx.nombre);
            });
            var resultados = {};
            if (existente && existente.resultados && typeof existente.resultados === 'object') {
                Object.keys(existente.resultados).forEach(function(indice) {
                    resultados[indice] = {
                        cmi: String(existente.resultados[indice] && existente.resultados[indice].cmi != null
                            ? existente.resultados[indice].cmi : ''),
                        difusion: String(existente.resultados[indice] && existente.resultados[indice].difusion != null
                            ? existente.resultados[indice].difusion : '')
                    };
                });
            } else if (existente) {
                resultados['0'] = {
                    cmi: String(existente.cmi || ''),
                    difusion: String(existente.difusion || existente.resultado || '')
                };
            }
            return {
                id: abx.id || abx.nombre,
                nombre: abx.nombre,
                seleccionado: !!existente,
                resultados: resultados
            };
        });

        antibioticosGuardados.forEach(function(existente) {
            if (!existente || panel.some(function(abx) {
                return abx.id === existente.id || abx.nombre === existente.antibiotico;
            })) return;
            var resultados = existente.resultados && typeof existente.resultados === 'object'
                ? existente.resultados
                : {};
            antibioticos.push({
                id: existente.id || existente.antibiotico,
                nombre: existente.antibiotico || existente.id,
                seleccionado: true,
                resultados: resultados
            });
        });

        return {
            resultadoCultivo: String(datos.resultadoCultivo || datos.resultado || ''),
            antibioticoOmitido: datos.antibiogramaOmitido === true || datos.omitido === true,
            metodos: metodos,
            microorganismos: microorganismos,
            antibioticos: antibioticos,
            observaciones: String(datos.observaciones || '')
        };
    }

    function elemento(tag, texto, clase) {
        var nodo = document.createElement(tag);
        if (texto !== undefined) nodo.textContent = texto;
        if (clase) nodo.className = clase;
        return nodo;
    }

    function actualizarDatosUrocultivoDesdeFormulario(draft) {
        var resultado = document.getElementById('urocultivoResultado');
        var observaciones = document.getElementById('urocultivoObservaciones');
        var omitir = document.getElementById('urocultivoOmitirAntibiograma');
        var cmi = document.getElementById('urocultivoMetodoCmi');
        var difusion = document.getElementById('urocultivoMetodoDifusion');
        if (resultado) draft.resultadoCultivo = resultado.value.trim();
        if (observaciones) draft.observaciones = observaciones.value.trim();
        if (omitir) draft.antibioticoOmitido = omitir.checked;
        if (cmi && difusion) {
            draft.metodos = { cmi: cmi.checked, difusion: difusion.checked };
        }

        var cantidad = document.getElementById('urocultivoCantidadMicroorganismos');
        var nombres = document.querySelectorAll('#urocultivoMicroorganismos [data-urocultivo-nombre]');
        if (cantidad) {
            var cuenta = Math.max(1, Math.floor(Number(cantidad.value) || 1));
            var actuales = Array.prototype.map.call(nombres, function(input) {
                return { nombre: input.value.trim() };
            });
            draft.microorganismos = Array.from({ length: cuenta }, function(_item, indice) {
                return actuales[indice] || draft.microorganismos[indice] || { nombre: '' };
            });
        }

        var seleccion = document.querySelectorAll('#urocultivoAntibioticosSeleccion [data-urocultivo-abx]');
        seleccion.forEach(function(checkbox) {
            var antibiotico = draft.antibioticos[Number(checkbox.getAttribute('data-urocultivo-abx'))];
            if (antibiotico) antibiotico.seleccionado = checkbox.checked;
        });

        document.querySelectorAll('#urocultivoAntibiogramaTablas [data-urocultivo-valor]').forEach(function(control) {
            var antibiotico = draft.antibioticos[Number(control.getAttribute('data-abx-idx'))];
            var indice = control.getAttribute('data-microbio-idx');
            var metodo = control.getAttribute('data-metodo');
            if (!antibiotico) return;
            if (!antibiotico.resultados[indice]) antibiotico.resultados[indice] = { cmi: '', difusion: '' };
            antibiotico.resultados[indice][metodo] = control.value.trim();
        });
    }

    function renderizarFormularioUrocultivo(draft) {
        var seleccion = document.getElementById('urocultivoAntibioticosSeleccion');
        var microorganismos = document.getElementById('urocultivoMicroorganismos');
        var tablas = document.getElementById('urocultivoAntibiogramaTablas');
        var config = document.getElementById('urocultivoAntibiogramaConfig');
        if (!seleccion || !microorganismos || !tablas || !config) return;

        var omitido = document.getElementById('urocultivoOmitirAntibiograma');
        var metodoCmi = document.getElementById('urocultivoMetodoCmi');
        var metodoDifusion = document.getElementById('urocultivoMetodoDifusion');
        var cantidad = document.getElementById('urocultivoCantidadMicroorganismos');
        document.getElementById('urocultivoResultado').value = draft.resultadoCultivo;
        document.getElementById('urocultivoObservaciones').value = draft.observaciones;
        if (omitido) omitido.checked = draft.antibioticoOmitido;
        if (metodoCmi) metodoCmi.checked = draft.metodos.cmi;
        if (metodoDifusion) metodoDifusion.checked = draft.metodos.difusion;
        if (cantidad) cantidad.value = String(draft.microorganismos.length);
        config.hidden = draft.antibioticoOmitido;

        seleccion.replaceChildren();
        if (!draft.antibioticos.length) {
            var aviso = elemento('div', undefined, 'col-12');
            var alerta = elemento('div', undefined, 'alert alert-warning mb-0');
            alerta.appendChild(document.createTextNode('No hay antibióticos activos. Agréguelos en el '));
            var enlaceCatalogo = elemento('a', 'Catálogo de antibióticos');
            enlaceCatalogo.href = 'catalogo.html';
            enlaceCatalogo.target = '_blank';
            enlaceCatalogo.rel = 'noopener';
            alerta.appendChild(enlaceCatalogo);
            alerta.appendChild(document.createTextNode(' y vuelva a abrir este formulario.'));
            aviso.appendChild(alerta);
            seleccion.appendChild(aviso);
        }
        draft.antibioticos.forEach(function(abx, indice) {
            var contenedor = elemento('div', undefined, 'col');
            var label = elemento('label', undefined, 'form-check border rounded p-2 h-100');
            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input me-2';
            checkbox.checked = abx.seleccionado;
            checkbox.setAttribute('data-urocultivo-abx', String(indice));
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(abx.nombre));
            contenedor.appendChild(label);
            seleccion.appendChild(contenedor);
        });

        microorganismos.replaceChildren();
        draft.microorganismos.forEach(function(microorganismo, indice) {
            var grupo = elemento('div', undefined, 'mb-2');
            var label = elemento('label', 'Microorganismo #' + (indice + 1), 'form-label fw-semibold');
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-control';
            input.value = microorganismo.nombre;
            input.placeholder = 'Nombre del microorganismo aislado';
            input.setAttribute('data-urocultivo-nombre', '');
            label.htmlFor = 'urocultivoMicroorganismo' + indice;
            input.id = label.htmlFor;
            grupo.appendChild(label);
            grupo.appendChild(input);
            microorganismos.appendChild(grupo);
        });

        tablas.replaceChildren();
        var metodos = [];
        if (draft.metodos.cmi) metodos.push({ id: 'cmi', nombre: 'CMI' });
        if (draft.metodos.difusion) metodos.push({ id: 'difusion', nombre: 'Difusión' });
        var antibioticosSeleccionados = draft.antibioticos
            .map(function(abx, indice) { return { antibiotico: abx, indice: indice }; })
            .filter(function(item) { return item.antibiotico.seleccionado; });

        draft.microorganismos.forEach(function(microorganismo, indiceMicrobio) {
            var bloque = elemento('div', undefined, 'mb-3');
            var titulo = elemento('h6', 'Microorganismo #' + (indiceMicrobio + 1) +
                (microorganismo.nombre ? ' - ' + microorganismo.nombre : ''), 'fw-bold text-primary mt-3');
            var wrapper = elemento('div', undefined, 'table-responsive');
            var tabla = elemento('table', undefined, 'table table-sm table-bordered align-middle mb-0');
            var thead = document.createElement('thead');
            thead.className = 'table-light';
            var filaEncabezados = document.createElement('tr');
            [elemento('th', 'Antibiótico')].concat(metodos.map(function(metodo) {
                return elemento('th', metodo.nombre);
            })).forEach(function(celda) { filaEncabezados.appendChild(celda); });
            thead.appendChild(filaEncabezados);
            var tbody = document.createElement('tbody');

            antibioticosSeleccionados.forEach(function(item) {
                var fila = document.createElement('tr');
                fila.appendChild(elemento('td', item.antibiotico.nombre, 'fw-semibold'));
                metodos.forEach(function(metodo) {
                    var celda = document.createElement('td');
                    var control;
                    var valores = item.antibiotico.resultados[String(indiceMicrobio)] || {};
                    if (metodo.id === 'cmi') {
                        control = document.createElement('input');
                        control.type = 'text';
                        control.placeholder = 'Ej. 4, <=2, >16';
                        control.value = valores.cmi || '';
                    } else {
                        control = document.createElement('select');
                        control.appendChild(new Option('Seleccionar...', ''));
                        ['Sensible', 'Intermedio', 'Resistente', 'S', 'I', 'R'].forEach(function(opcion) {
                            control.appendChild(new Option(opcion, opcion));
                        });
                        control.value = valores.difusion || '';
                    }
                    control.className = 'form-control form-control-sm';
                    control.setAttribute('data-urocultivo-valor', '');
                    control.setAttribute('data-abx-idx', String(item.indice));
                    control.setAttribute('data-microbio-idx', String(indiceMicrobio));
                    control.setAttribute('data-metodo', metodo.id);
                    celda.appendChild(control);
                    fila.appendChild(celda);
                });
                tbody.appendChild(fila);
            });
            tabla.appendChild(thead);
            tabla.appendChild(tbody);
            wrapper.appendChild(tabla);
            bloque.appendChild(titulo);
            bloque.appendChild(wrapper);
            tablas.appendChild(bloque);
        });
    }

    function configurarControlesUrocultivo() {
        var form = document.getElementById('formularioUrocultivo');
        if (!form || form.getAttribute('data-inicializado') === 'true') return;
        form.setAttribute('data-inicializado', 'true');
        var metodos = ['urocultivoMetodoCmi', 'urocultivoMetodoDifusion'];
        metodos.forEach(function(id) {
            document.getElementById(id).addEventListener('change', function(event) {
                var draft = window._urocultivoDraft;
                if (!draft) return;
                actualizarDatosUrocultivoDesdeFormulario(draft);
                if (!draft.metodos.cmi && !draft.metodos.difusion) {
                    event.target.checked = true;
                    draft.metodos[event.target.id === 'urocultivoMetodoCmi' ? 'cmi' : 'difusion'] = true;
                }
                renderizarFormularioUrocultivo(draft);
            });
        });
        document.getElementById('urocultivoCantidadMicroorganismos').addEventListener('change', function() {
            var draft = window._urocultivoDraft;
            if (!draft) return;
            var valor = Number(this.value);
            if (!Number.isInteger(valor) || valor < 1) {
                this.value = String(draft.microorganismos.length);
                return;
            }
            actualizarDatosUrocultivoDesdeFormulario(draft);
            renderizarFormularioUrocultivo(draft);
        });
        document.getElementById('urocultivoAntibioticosSeleccion').addEventListener('change', function() {
            var draft = window._urocultivoDraft;
            if (!draft) return;
            actualizarDatosUrocultivoDesdeFormulario(draft);
            renderizarFormularioUrocultivo(draft);
        });
        document.getElementById('urocultivoOmitirAntibiograma').addEventListener('change', function() {
            var draft = window._urocultivoDraft;
            if (!draft) return;
            actualizarDatosUrocultivoDesdeFormulario(draft);
            renderizarFormularioUrocultivo(draft);
        });
    }

    window.abrirFormularioUrocultivo = async function(examenId) {
        var examen = (window.examenesOrden || []).find(function(item) { return item.id === examenId; });
        var form = document.getElementById('formularioUrocultivo');
        if (!examen || !form) {
            window.Notifications.error('No se encontró el examen de Urocultivo para editar.');
            return;
        }
        if (!window.api || typeof window.api.obtenerAntibioticosActivos !== 'function') {
            window.Notifications.error('No está disponible el catálogo de antibióticos.');
            return;
        }
        var respuesta;
        try {
            respuesta = await window.api.obtenerAntibioticosActivos();
            if (!respuesta || !respuesta.success) {
                throw new Error((respuesta && respuesta.error) || 'No se pudo cargar el catálogo de antibióticos.');
            }
        } catch (error) {
            console.error('[abrirFormularioUrocultivo] Error cargando el catálogo:', error);
            window.Notifications.error('No se pudo cargar el catálogo de antibióticos: ' + error.message);
            return;
        }
        var catalogoAntibioticos = (respuesta.antibioticos || []).map(function(antibiotico) {
            return { id: antibiotico.id, nombre: antibiotico.nombre };
        });
        var draft = crearDatosUrocultivo(examen, catalogoAntibioticos);
        window._urocultivoEditando = examenId;
        window._urocultivoDraft = draft;
        renderizarFormularioUrocultivo(draft);
        configurarControlesUrocultivo();
        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    window.guardarFormularioUrocultivo = async function() {
        var examenId = window._urocultivoEditando;
        var draft = window._urocultivoDraft;
        var examen = (window.examenesOrden || []).find(function(item) { return item.id === examenId; });
        if (!examenId || !draft || !examen) {
            window.Notifications.error('No se encontró el Urocultivo que se va a guardar.');
            return;
        }
        actualizarDatosUrocultivoDesdeFormulario(draft);

        var datos = {
            version: 2,
            resultadoCultivo: draft.resultadoCultivo,
            antibiogramaOmitido: draft.antibioticoOmitido,
            metodos: draft.metodos,
            microorganismos: draft.microorganismos,
            antibioticos: draft.antibioticos.filter(function(abx) { return abx.seleccionado; })
                .map(function(abx) {
                    var resultados = {};
                    draft.microorganismos.forEach(function(_microorganismo, indice) {
                        var valores = abx.resultados[String(indice)] || {};
                        resultados[String(indice)] = {
                            cmi: valores.cmi || '',
                            difusion: valores.difusion || ''
                        };
                    });
                    return { id: abx.id, antibiotico: abx.nombre, resultados: resultados };
                }),
            observaciones: draft.observaciones
        };
        var orden = window.pacienteActivo ? window.pacienteActivo.orden :
            (window.getOrden ? window.getOrden() : '');
        if (!orden || !window.api || typeof window.api.guardarPacienteExamenes !== 'function') {
            window.Notifications.error('No está disponible el guardado del Urocultivo para esta orden.');
            return;
        }

        var resultado = JSON.stringify(datos);
        var examenes = (window.examenesOrden || []).map(function(item) {
            if (item.id !== examenId) return item;
            return Object.assign({}, item, {
                tipo: 'urocultivo',
                tipoFormulario: 'urocultivo',
                resultado: resultado
            });
        });
        try {
            var guardado = await window.api.guardarPacienteExamenes(orden, examenes);
            if (!guardado || !guardado.success) {
                throw new Error(guardado && guardado.error ? guardado.error : 'No se pudieron guardar los resultados.');
            }
        } catch (error) {
            console.error('[guardarFormularioUrocultivo] Error:', error);
            window.Notifications.error('Error al guardar el Urocultivo: ' + error.message);
            return;
        }

        examen.resultado = resultado;
        examen.tipo = 'urocultivo';
        examen.tipoFormulario = 'urocultivo';
        if (window.pacienteActivo) {
            window.pacienteActivo.examenes = JSON.parse(JSON.stringify(window.examenesOrden));
        }
        window.cerrarFormularioUrocultivo();
        window.renderizarTablaExamenes();
        window.Notifications.success('Resultados del Urocultivo guardados correctamente.');
    };

    window.cerrarFormularioUrocultivo = function() {
        var form = document.getElementById('formularioUrocultivo');
        if (form) form.style.display = 'none';
        window._urocultivoEditando = null;
        window._urocultivoDraft = null;
    };

    window.abrirFormularioAntibiograma = function(examenId) {
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;
        window._antibiogramaEditando = examenId;

        var form = document.getElementById('formularioAntibiograma');
        if (!form) return;
        form.style.display = 'block';

        var datos = {};
        try { datos = JSON.parse(examen.resultado || '{}'); } catch(e) {}

        var antibioticos = datos.antibioticos || [];
        var observaciones = datos.observaciones || '';

        var tbody = document.getElementById('antibiogramaTablaBody');
        if (!tbody) return;

        var html = '';
        antibioticosPanel().forEach(function(abx, idx) {
            var existente = antibioticos.find(function(a) { return a.antibiotico === abx.nombre; });
            var resultadoSel = existente ? existente.resultado : abx.valorDefecto;
            var cmiVal = existente ? existente.cmi : '';

            html += '<tr>';
            html += '<td class="fw-semibold">' + abx.nombre + '</td>';
            html += '<td><select class="form-select form-select-sm abx-resultado" data-idx="' + idx + '"><option value="Sensible">Sensible</option><option value="Resistente">Resistente</option><option value="Intermedio">Intermedio</option></select></td>';
            html += '<td><input type="text" class="form-control form-control-sm abx-cmi" data-idx="' + idx + '" value="' + (cmiVal || '') + '"></td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;

        antibioticosPanel().forEach(function(abx, idx) {
            var existente = antibioticos.find(function(a) { return a.antibiotico === abx.nombre; });
            var resultadoSel = existente ? existente.resultado : abx.valorDefecto;
            var select = tbody.querySelector('.abx-resultado[data-idx="' + idx + '"]');
            if (select) {
                var optionToSelect = select.querySelector('option[value="' + resultadoSel + '"]') || select.querySelector('option[value="Sensible"]');
                if (optionToSelect) optionToSelect.selected = true;
            }
        });

        var obsInput = document.getElementById('antibiogramaObservaciones');
        if (obsInput) {
            obsInput.value = observaciones || '';
        }

        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.guardarFormularioAntibiograma = function() {
        var examenId = window._antibiogramaEditando;
        if (!examenId) return;

        var tbody = document.getElementById('antibiogramaTablaBody');
        if (!tbody) return;

        var antibioticos = [];
        antibioticosPanel().forEach(function(abx, idx) {
            var select = tbody.querySelector('.abx-resultado[data-idx="' + idx + '"]');
            var cmiInput = tbody.querySelector('.abx-cmi[data-idx="' + idx + '"]');
            var resultado = select ? select.value : '';
            var cmi = cmiInput ? cmiInput.value.trim() : '';
            antibioticos.push({
                antibiotico: abx.nombre,
                resultado: resultado,
                cmi: cmi
            });
        });

        var obsInput = document.getElementById('antibiogramaObservaciones');
        var observaciones = obsInput ? obsInput.value.trim() : '';

        var datos = {
            antibioticos: antibioticos,
            observaciones: observaciones
        };

        var examenes = window.examenesOrden || [];
        var examen = examenes.find(function(e) { return e.id === examenId; });
        if (examen) {
            examen.resultado = JSON.stringify(datos);
        }

        window._antibiogramaEditando = null;
        window.renderizarTablaExamenes();
        window.cerrarFormularioAntibiograma();
    };

    window.INSERTAR_OBSERVACION_DEFAULT = async function() {
        var obsInput = document.getElementById('antibiogramaObservaciones');
        if (!obsInput) return;
        if (obsInput.value.trim() !== '') {
            var confirmado = await window.Notifications.confirm('Esto reemplazará el texto actual. ¿Continuar?');
            if (!confirmado) return;
        }
        obsInput.value = OBSERVACIONES_DEFAULT;
        obsInput.focus();
    };

    window.cerrarFormularioAntibiograma = function() {
        var form = document.getElementById('formularioAntibiograma');
        if (form) form.style.display = 'none';
        window._antibiogramaEditando = null;
    };

})();
