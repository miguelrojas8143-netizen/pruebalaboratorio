
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
                return {
                    nombre: String(microorganismo && microorganismo.nombre || ''),
                    resultadoCultivo: String(microorganismo && microorganismo.resultadoCultivo || '')
                };
            })
            : [];
        if (!microorganismos.length) microorganismos.push({ nombre: '' });
        var tieneResultadosCultivo = Array.isArray(datos.resultadosCultivo);
        var resultadosCultivo = tieneResultadosCultivo
            ? datos.resultadosCultivo.map(function(resultado) {
                return String(resultado == null ? '' : resultado);
            })
            : microorganismos.map(function(microorganismo) {
                return String(microorganismo.resultadoCultivo || '');
            });
        if (!tieneResultadosCultivo && !resultadosCultivo.some(Boolean)) {
            resultadosCultivo = [String(datos.resultadoCultivo || datos.resultado || '')];
        }
        var cantidadResultados = Math.max(microorganismos.length, resultadosCultivo.length, 1);
        microorganismos = Array.from({ length: cantidadResultados }, function(_item, indice) {
            return microorganismos[indice] || { nombre: '', resultadoCultivo: '' };
        });
        resultadosCultivo = Array.from({ length: cantidadResultados }, function(_item, indice) {
            return resultadosCultivo[indice] !== undefined
                ? resultadosCultivo[indice]
                : microorganismos[indice].resultadoCultivo;
        });

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
            resultadosCultivo: resultadosCultivo,
            sedimentoUrinario: String(datos.sedimentoUrinario || ''),
            coloracionGram: String(datos.coloracionGram || ''),
            recuentoColonias: String(datos.recuentoColonias || ''),
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
        var sedimento = document.getElementById('urocultivoSedimento');
        var coloracionGram = document.getElementById('urocultivoColoracionGram');
        var recuentoColonias = document.getElementById('urocultivoRecuentoColonias');
        var observaciones = document.getElementById('urocultivoObservaciones');
        var omitir = document.getElementById('urocultivoOmitirAntibiograma');
        var cmi = document.getElementById('urocultivoMetodoCmi');
        var difusion = document.getElementById('urocultivoMetodoDifusion');
        if (sedimento) draft.sedimentoUrinario = sedimento.value.trim();
        if (coloracionGram) draft.coloracionGram = coloracionGram.value.trim();
        if (recuentoColonias) draft.recuentoColonias = recuentoColonias.value.trim();
        if (observaciones) draft.observaciones = observaciones.value.trim();
        if (omitir) draft.antibioticoOmitido = omitir.checked;
        if (cmi && difusion) {
            draft.metodos = { cmi: cmi.checked, difusion: difusion.checked };
        }

        var cantidad = document.getElementById('urocultivoCantidadMicroorganismos');
        var nombres = document.querySelectorAll('#urocultivoMicroorganismos [data-urocultivo-nombre]');
        var resultados = document.querySelectorAll('#urocultivoResultadosCultivo [data-urocultivo-cultivo]');
        if (cantidad) {
            var cuenta = Math.max(1, Math.floor(Number(cantidad.value) || 1));
            var actuales = Array.prototype.map.call(nombres, function(input) {
                return { nombre: input.value.trim() };
            });
            var resultadosActuales = Array.prototype.map.call(resultados, function(input) {
                return input.value.trim();
            });
            draft.microorganismos = Array.from({ length: cuenta }, function(_item, indice) {
                return Object.assign(
                    {},
                    draft.microorganismos[indice] || { nombre: '', resultadoCultivo: '' },
                    actuales[indice] || {}
                );
            });
            draft.resultadosCultivo = Array.from({ length: cuenta }, function(_item, indice) {
                return resultadosActuales[indice] !== undefined
                    ? resultadosActuales[indice]
                    : draft.resultadosCultivo[indice] || '';
            });
        }

        var seleccionados = document.querySelectorAll('#urocultivoAntibioticosSeleccion [data-urocultivo-quitar]');
        seleccionados.forEach(function(boton) {
            var antibiotico = draft.antibioticos[Number(boton.getAttribute('data-urocultivo-quitar'))];
            if (antibiotico) antibiotico.seleccionado = true;
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

    function actualizarVistaAntibioticosUrocultivo(draft) {
        var seleccion = document.getElementById('urocultivoAntibioticosSeleccion');
        if (!seleccion) return;
        seleccion.replaceChildren();

        if (!draft.antibioticos.length) {
            var alerta = elemento('div', undefined, 'alert alert-warning mb-0');
            alerta.appendChild(document.createTextNode('No hay antibióticos activos. Agréguelos en el '));
            var enlaceCatalogo = elemento('a', 'Catálogo de antibióticos');
            enlaceCatalogo.href = 'catalogo.html';
            enlaceCatalogo.target = '_blank';
            enlaceCatalogo.rel = 'noopener';
            alerta.appendChild(enlaceCatalogo);
            alerta.appendChild(document.createTextNode(' y vuelva a abrir este formulario.'));
            seleccion.appendChild(alerta);
            return;
        }

        var seleccionados = draft.antibioticos
            .map(function(abx, indice) { return { antibiotico: abx, indice: indice }; })
            .filter(function(item) { return item.antibiotico.seleccionado; })
            .sort(function(a, b) {
                return a.antibiotico.nombre.localeCompare(b.antibiotico.nombre, 'es', { sensitivity: 'base' });
            });

        if (!seleccionados.length) {
            seleccion.appendChild(elemento('div', 'Seleccione antibióticos del buscador.', 'text-muted small'));
        }
        seleccionados.forEach(function(item) {
            var chip = elemento('div', undefined, 'urocultivo-antibiotico-chip');
            chip.appendChild(elemento('span', item.antibiotico.nombre, 'fw-semibold'));
            var quitar = document.createElement('button');
            quitar.type = 'button';
            quitar.className = 'btn-close';
            quitar.title = 'Quitar ' + item.antibiotico.nombre;
            quitar.setAttribute('aria-label', 'Quitar ' + item.antibiotico.nombre);
            quitar.setAttribute('data-urocultivo-quitar', String(item.indice));
            chip.appendChild(quitar);
            seleccion.appendChild(chip);
        });

        var opciones = document.getElementById('urocultivoAntibioticosOpciones');
        if (opciones) opciones.classList.add('d-none');
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
        document.getElementById('urocultivoSedimento').value = draft.sedimentoUrinario;
        document.getElementById('urocultivoColoracionGram').value = draft.coloracionGram;
        document.getElementById('urocultivoRecuentoColonias').value = draft.recuentoColonias;
        document.getElementById('urocultivoObservaciones').value = draft.observaciones;
        if (omitido) omitido.checked = draft.antibioticoOmitido;
        if (metodoCmi) metodoCmi.checked = draft.metodos.cmi;
        if (metodoDifusion) metodoDifusion.checked = draft.metodos.difusion;
        if (cantidad) cantidad.value = String(draft.microorganismos.length);
        config.hidden = draft.antibioticoOmitido;

        var resultadosCultivo = document.getElementById('urocultivoResultadosCultivo');
        resultadosCultivo.replaceChildren();
        draft.resultadosCultivo.forEach(function(resultado, indice) {
            var grupo = elemento('div', undefined, 'urocultivo-item mb-2');
            var label = elemento('label', 'Resultado de cultivo #' + (indice + 1), 'form-label fw-semibold');
            var textarea = document.createElement('textarea');
            textarea.className = 'form-control';
            textarea.rows = 2;
            textarea.value = resultado;
            textarea.placeholder = 'Escriba el resultado del cultivo #' + (indice + 1);
            textarea.setAttribute('data-urocultivo-cultivo', '');
            label.htmlFor = 'urocultivoResultadoCultivo' + indice;
            textarea.id = label.htmlFor;
            grupo.appendChild(label);
            grupo.appendChild(textarea);
            resultadosCultivo.appendChild(grupo);
        });

        actualizarVistaAntibioticosUrocultivo(draft);

        microorganismos.replaceChildren();
        draft.microorganismos.forEach(function(microorganismo, indice) {
            var grupo = elemento('div', undefined, 'urocultivo-item mb-2');
            var label = elemento('label', 'Microorganismo aislado #' + (indice + 1) + ' (opcional)', 'form-label fw-semibold');
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
        if (draft.metodos.difusion) metodos.push({ id: 'difusion', nombre: 'Difusión' });
        if (draft.metodos.cmi) metodos.push({ id: 'cmi', nombre: 'CMI' });
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
                        ['Sensible', 'Intermedio', 'Resistente'].forEach(function(opcion) {
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
        ['urocultivoSedimento', 'urocultivoColoracionGram', 'urocultivoRecuentoColonias',
            'urocultivoResultadosCultivo', 'urocultivoMicroorganismos', 'urocultivoObservaciones']
            .forEach(function(id) {
                document.getElementById(id).addEventListener('input', function() {
                    var draft = window._urocultivoDraft;
                    if (draft) actualizarDatosUrocultivoDesdeFormulario(draft);
                });
            });
        var seleccion = document.getElementById('urocultivoAntibioticosSeleccion');
        seleccion.addEventListener('click', function(event) {
            var quitar = event.target.closest('[data-urocultivo-quitar]');
            if (!quitar) return;
            var draft = window._urocultivoDraft;
            if (!draft) return;
            actualizarDatosUrocultivoDesdeFormulario(draft);
            var indice = Number(quitar.getAttribute('data-urocultivo-quitar'));
            var antibiotico = draft.antibioticos[indice];
            if (antibiotico) antibiotico.seleccionado = false;
            actualizarVistaAntibioticosUrocultivo(draft);
            var buscar = document.getElementById('urocultivoAntibioticoBuscar');
            if (buscar) buscar.focus();
        });

        var buscar = document.getElementById('urocultivoAntibioticoBuscar');
        var opciones = document.getElementById('urocultivoAntibioticosOpciones');
        function cerrarOpciones() {
            if (opciones) opciones.classList.add('d-none');
        }
        function mostrarOpciones() {
            var draft = window._urocultivoDraft;
            if (!draft || !opciones) return;
            var termino = buscar.value.trim().toLocaleLowerCase('es');
            var coincidencias = draft.antibioticos
                .map(function(abx, indice) { return { antibiotico: abx, indice: indice }; })
                .filter(function(item) { return !item.antibiotico.seleccionado; })
                .filter(function(item) {
                    return !termino || item.antibiotico.nombre.toLocaleLowerCase('es').indexOf(termino) !== -1;
                })
                .sort(function(a, b) {
                    return a.antibiotico.nombre.localeCompare(b.antibiotico.nombre, 'es', { sensitivity: 'base' });
                });
            opciones.replaceChildren();
            if (!coincidencias.length) {
                opciones.appendChild(elemento('div', termino ? 'Sin coincidencias.' : 'Todos los antibióticos ya están seleccionados.', 'urocultivo-antibiotico-sin-resultados'));
            } else {
                coincidencias.forEach(function(item) {
                    var boton = elemento('button', item.antibiotico.nombre, 'urocultivo-antibiotico-opcion');
                    boton.type = 'button';
                    boton.setAttribute('data-urocultivo-agregar', String(item.indice));
                    opciones.appendChild(boton);
                });
            }
            opciones.classList.remove('d-none');
        }
        buscar.addEventListener('focus', mostrarOpciones);
        buscar.addEventListener('input', mostrarOpciones);
        opciones.addEventListener('mousedown', function(event) {
            var boton = event.target.closest('[data-urocultivo-agregar]');
            if (!boton) return;
            event.preventDefault();
            var draft = window._urocultivoDraft;
            if (!draft) return;
            actualizarDatosUrocultivoDesdeFormulario(draft);
            var indice = Number(boton.getAttribute('data-urocultivo-agregar'));
            draft.antibioticos[indice].seleccionado = true;
            buscar.value = '';
            actualizarVistaAntibioticosUrocultivo(draft);
            buscar.focus();
            mostrarOpciones();
        });
        buscar.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') cerrarOpciones();
            if (event.key === 'Enter') {
                var primer = opciones.querySelector('[data-urocultivo-agregar]');
                if (primer) {
                    event.preventDefault();
                    primer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                }
            }
        });
        document.addEventListener('pointerdown', function(event) {
            if (!event.target.closest('#urocultivoAntibioticoBuscar') && !event.target.closest('#urocultivoAntibioticosOpciones')) {
                cerrarOpciones();
            }
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
            version: 3,
            resultadoCultivo: draft.resultadosCultivo[0] || '',
            resultadosCultivo: draft.resultadosCultivo,
            sedimentoUrinario: draft.sedimentoUrinario,
            coloracionGram: draft.coloracionGram,
            recuentoColonias: draft.recuentoColonias,
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
