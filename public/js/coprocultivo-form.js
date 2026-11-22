(function(){
    'use strict';
    function crearDatosCoprocultivo(examen, catalogoAntibioticos) {
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
            examenDirecto: String(datos.examenDirecto || ''),
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

    function actualizarDatosCoprocultivoDesdeFormulario(draft) {
        var examenDirecto = document.getElementById('coprocultivoExamenDirecto');
        var coloracionGram = document.getElementById('coprocultivoColoracionGram');
        var recuentoColonias = document.getElementById('coprocultivoRecuentoColonias');
        var observaciones = document.getElementById('coprocultivoObservaciones');
        var omitir = document.getElementById('coprocultivoOmitirAntibiograma');
        var cmi = document.getElementById('coprocultivoMetodoCmi');
        var difusion = document.getElementById('coprocultivoMetodoDifusion');
        if (examenDirecto) draft.examenDirecto = examenDirecto.value.trim();
        if (coloracionGram) draft.coloracionGram = coloracionGram.value.trim();
        if (recuentoColonias) draft.recuentoColonias = recuentoColonias.value.trim();
        if (observaciones) draft.observaciones = observaciones.value.trim();
        if (omitir) draft.antibioticoOmitido = omitir.checked;
        if (cmi && difusion) {
            draft.metodos = { cmi: cmi.checked, difusion: difusion.checked };
        }

        var cantidad = document.getElementById('coprocultivoCantidadMicroorganismos');
        var nombres = document.querySelectorAll('#coprocultivoMicroorganismos [data-coprocultivo-nombre]');
        var resultados = document.querySelectorAll('#coprocultivoResultadosCultivo [data-coprocultivo-cultivo]');
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

        var seleccionados = document.querySelectorAll('#coprocultivoAntibioticosSeleccion [data-coprocultivo-quitar]');
        seleccionados.forEach(function(boton) {
            var antibiotico = draft.antibioticos[Number(boton.getAttribute('data-coprocultivo-quitar'))];
            if (antibiotico) antibiotico.seleccionado = true;
        });

        document.querySelectorAll('#coprocultivoAntibiogramaTablas [data-coprocultivo-valor]').forEach(function(control) {
            var antibiotico = draft.antibioticos[Number(control.getAttribute('data-abx-idx'))];
            var indice = control.getAttribute('data-microbio-idx');
            var metodo = control.getAttribute('data-metodo');
            if (!antibiotico) return;
            if (!antibiotico.resultados[indice]) antibiotico.resultados[indice] = { cmi: '', difusion: '' };
            antibiotico.resultados[indice][metodo] = control.value.trim();
        });
    }

    function actualizarVistaAntibioticosCoprocultivo(draft) {
        var seleccion = document.getElementById('coprocultivoAntibioticosSeleccion');
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
            var chip = elemento('div', undefined, 'coprocultivo-antibiotico-chip');
            chip.appendChild(elemento('span', item.antibiotico.nombre, 'fw-semibold'));
            var quitar = document.createElement('button');
            quitar.type = 'button';
            quitar.className = 'btn-close';
            quitar.title = 'Quitar ' + item.antibiotico.nombre;
            quitar.setAttribute('aria-label', 'Quitar ' + item.antibiotico.nombre);
            quitar.setAttribute('data-coprocultivo-quitar', String(item.indice));
            chip.appendChild(quitar);
            seleccion.appendChild(chip);
        });

        var opciones = document.getElementById('coprocultivoAntibioticosOpciones');
        if (opciones) opciones.classList.add('d-none');
    }

    function renderizarFormularioCoprocultivo(draft) {
        var seleccion = document.getElementById('coprocultivoAntibioticosSeleccion');
        var microorganismos = document.getElementById('coprocultivoMicroorganismos');
        var tablas = document.getElementById('coprocultivoAntibiogramaTablas');
        var config = document.getElementById('coprocultivoAntibiogramaConfig');
        if (!seleccion || !microorganismos || !tablas || !config) return;

        var omitido = document.getElementById('coprocultivoOmitirAntibiograma');
        var metodoCmi = document.getElementById('coprocultivoMetodoCmi');
        var metodoDifusion = document.getElementById('coprocultivoMetodoDifusion');
        var cantidad = document.getElementById('coprocultivoCantidadMicroorganismos');
        document.getElementById('coprocultivoExamenDirecto').value = draft.examenDirecto;
        document.getElementById('coprocultivoColoracionGram').value = draft.coloracionGram;
        document.getElementById('coprocultivoRecuentoColonias').value = draft.recuentoColonias;
        document.getElementById('coprocultivoObservaciones').value = draft.observaciones;
        if (omitido) omitido.checked = draft.antibioticoOmitido;
        if (metodoCmi) metodoCmi.checked = draft.metodos.cmi;
        if (metodoDifusion) metodoDifusion.checked = draft.metodos.difusion;
        if (cantidad) cantidad.value = String(draft.microorganismos.length);
        config.hidden = draft.antibioticoOmitido;

        var resultadosCultivo = document.getElementById('coprocultivoResultadosCultivo');
        resultadosCultivo.replaceChildren();
        draft.resultadosCultivo.forEach(function(resultado, indice) {
            var grupo = elemento('div', undefined, 'coprocultivo-item mb-2');
            var label = elemento('label', 'Resultado de cultivo #' + (indice + 1), 'form-label fw-semibold');
            var textarea = document.createElement('textarea');
            textarea.className = 'form-control';
            textarea.rows = 2;
            textarea.value = resultado;
            textarea.placeholder = 'Escriba el resultado del cultivo #' + (indice + 1);
            textarea.setAttribute('data-coprocultivo-cultivo', '');
            label.htmlFor = 'coprocultivoResultadoCultivo' + indice;
            textarea.id = label.htmlFor;
            grupo.appendChild(label);
            grupo.appendChild(textarea);
            resultadosCultivo.appendChild(grupo);
        });

        actualizarVistaAntibioticosCoprocultivo(draft);

        microorganismos.replaceChildren();
        draft.microorganismos.forEach(function(microorganismo, indice) {
            var grupo = elemento('div', undefined, 'coprocultivo-item mb-2');
            var label = elemento('label', 'Microorganismo aislado #' + (indice + 1) + ' (opcional)', 'form-label fw-semibold');
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-control';
            input.value = microorganismo.nombre;
            input.placeholder = 'Nombre del microorganismo aislado';
            input.setAttribute('data-coprocultivo-nombre', '');
            label.htmlFor = 'coprocultivoMicroorganismo' + indice;
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
                    control.setAttribute('data-coprocultivo-valor', '');
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

    function configurarControlesCoprocultivo() {
        var form = document.getElementById('formularioCoprocultivo');
        if (!form || form.getAttribute('data-inicializado') === 'true') return;
        form.setAttribute('data-inicializado', 'true');
        var metodos = ['coprocultivoMetodoCmi', 'coprocultivoMetodoDifusion'];
        metodos.forEach(function(id) {
            document.getElementById(id).addEventListener('change', function(event) {
                var draft = window._coprocultivoDraft;
                if (!draft) return;
                actualizarDatosCoprocultivoDesdeFormulario(draft);
                if (!draft.metodos.cmi && !draft.metodos.difusion) {
                    event.target.checked = true;
                    draft.metodos[event.target.id === 'coprocultivoMetodoCmi' ? 'cmi' : 'difusion'] = true;
                }
                renderizarFormularioCoprocultivo(draft);
            });
        });
        var cantidadCoprocultivo = document.getElementById('coprocultivoCantidadMicroorganismos');
        function actualizarCantidadCoprocultivo() {
            var draft = window._coprocultivoDraft;
            if (!draft) return;

            var resultadosActuales = Array.prototype.map.call(
                document.querySelectorAll('#coprocultivoResultadosCultivo [data-coprocultivo-cultivo]'),
                function(input) { return input.value.trim(); }
            );
            var microorganismosActuales = Array.prototype.map.call(
                document.querySelectorAll('#coprocultivoMicroorganismos [data-coprocultivo-nombre]'),
                function(input) { return input.value.trim(); }
            );

            var valor = Math.max(1, Math.floor(Number(cantidadCoprocultivo.value) || 1));
            cantidadCoprocultivo.value = String(valor);

            draft.resultadosCultivo = Array.from({ length: valor }, function(_item, indice) {
                return resultadosActuales[indice] !== undefined ? resultadosActuales[indice] : '';
            });
            draft.microorganismos = Array.from({ length: valor }, function(_item, indice) {
                return {
                    nombre: microorganismosActuales[indice] !== undefined ? microorganismosActuales[indice] : '',
                    resultadoCultivo: draft.microorganismos[indice] ? draft.microorganismos[indice].resultadoCultivo || '' : ''
                };
            });

            renderizarFormularioCoprocultivo(draft);
        }
        cantidadCoprocultivo.addEventListener('input', actualizarCantidadCoprocultivo);
        cantidadCoprocultivo.addEventListener('change', actualizarCantidadCoprocultivo);
        ['coprocultivoExamenDirecto', 'coprocultivoColoracionGram', 'coprocultivoRecuentoColonias',
            'coprocultivoResultadosCultivo', 'coprocultivoMicroorganismos', 'coprocultivoObservaciones']
            .forEach(function(id) {
                document.getElementById(id).addEventListener('input', function() {
                    var draft = window._coprocultivoDraft;
                    if (draft) actualizarDatosCoprocultivoDesdeFormulario(draft);
                });
            });
        var seleccion = document.getElementById('coprocultivoAntibioticosSeleccion');
        seleccion.addEventListener('click', function(event) {
            var quitar = event.target.closest('[data-coprocultivo-quitar]');
            if (!quitar) return;
            var draft = window._coprocultivoDraft;
            if (!draft) return;
            actualizarDatosCoprocultivoDesdeFormulario(draft);
            var indice = Number(quitar.getAttribute('data-coprocultivo-quitar'));
            var antibiotico = draft.antibioticos[indice];
            if (antibiotico) antibiotico.seleccionado = false;
            actualizarVistaAntibioticosCoprocultivo(draft);
            actualizarOpcionesCopro(draft);
            var buscar = document.getElementById('coprocultivoAntibioticoBuscar');
            if (buscar) buscar.focus();
        });

        var buscarCopro = document.getElementById('coprocultivoAntibioticoBuscar');
        function actualizarOpcionesCopro(draft) {
            if (!buscarCopro || !window.jQuery) return;
            var $buscar = window.jQuery(buscarCopro);
            if ($buscar.hasClass('select2-hidden-accessible')) $buscar.select2('destroy');
            buscarCopro.innerHTML = '<option value=""></option>';
            draft.antibioticos
                .map(function(abx, indice) { return { antibiotico: abx, indice: indice }; })
                .filter(function(item) { return !item.antibiotico.seleccionado; })
                .sort(function(a, b) {
                    return a.antibiotico.nombre.localeCompare(b.antibiotico.nombre, 'es', { sensitivity: 'base' });
                })
                .forEach(function(item) {
                    buscarCopro.appendChild(new Option(item.antibiotico.nombre, String(item.indice)));
                });
            $buscar.select2({
                theme: 'bootstrap-5',
                placeholder: 'Escriba para buscar antibiótico...',
                allowClear: true,
                width: '100%',
                maximumResultsToShow: 20
            });
            $buscar.off('select2:select').on('select2:select', function(event) {
                var indice = Number(event.params.data.id);
                if (!Number.isInteger(indice)) return;
                actualizarDatosCoprocultivoDesdeFormulario(draft);
                draft.antibioticos[indice].seleccionado = true;
                actualizarVistaAntibioticosCoprocultivo(draft);
                renderizarFormularioCoprocultivo(draft);
                actualizarOpcionesCopro(draft);
                $buscar.val('').trigger('change');
            });
            $buscar.off('select2:open').on('select2:open', function() {
                setTimeout(function() {
                    var campo = document.querySelector('.formulario-flotante-coprocultivo .select2-search__field');
                    if (campo) campo.focus();
                }, 0);
            });
        }
        actualizarOpcionesCopro(window._coprocultivoDraft);
        document.getElementById('coprocultivoOmitirAntibiograma').addEventListener('change', function() {
            var draft = window._coprocultivoDraft;
            if (!draft) return;
            actualizarDatosCoprocultivoDesdeFormulario(draft);
            renderizarFormularioCoprocultivo(draft);
        });
    }

    window.abrirFormularioCoprocultivo = async function(examenId) {
        var examen = (window.examenesOrden || []).find(function(item) { return item.id === examenId; });
        var form = document.getElementById('formularioCoprocultivo');
        var urocultivo = document.getElementById('formularioUrocultivo');
        if (urocultivo) urocultivo.style.display = 'none';
        if (!examen || !form) {
            window.Notifications.error('No se encontró el examen de Coprocultivo para editar.');
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
            console.error('[abrirFormularioCoprocultivo] Error cargando el catálogo:', error);
            window.Notifications.error('No se pudo cargar el catálogo de antibióticos: ' + error.message);
            return;
        }
        var catalogoAntibioticos = (respuesta.antibioticos || []).map(function(antibiotico) {
            return { id: antibiotico.id, nombre: antibiotico.nombre };
        });
        var draft = crearDatosCoprocultivo(examen, catalogoAntibioticos);
        window._coprocultivoEditando = examenId;
        window._coprocultivoDraft = draft;
        renderizarFormularioCoprocultivo(draft);
        configurarControlesCoprocultivo();
        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    window.guardarFormularioCoprocultivo = async function() {
        var examenId = window._coprocultivoEditando;
        var draft = window._coprocultivoDraft;
        var examen = (window.examenesOrden || []).find(function(item) { return item.id === examenId; });
        if (!examenId || !draft || !examen) {
            window.Notifications.error('No se encontró el Coprocultivo que se va a guardar.');
            return;
        }
        actualizarDatosCoprocultivoDesdeFormulario(draft);

        var datos = {
            version: 3,
            resultadoCultivo: draft.resultadosCultivo[0] || '',
            resultadosCultivo: draft.resultadosCultivo,
            examenDirecto: draft.examenDirecto,
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
            window.Notifications.error('No está disponible el guardado del Coprocultivo para esta orden.');
            return;
        }

        var resultado = JSON.stringify(datos);
        var examenes = (window.examenesOrden || []).map(function(item) {
            if (item.id !== examenId) return item;
            return Object.assign({}, item, {
                tipo: 'coprocultivo',
                tipoFormulario: 'coprocultivo',
                resultado: resultado
            });
        });
        try {
            var guardado = await window.api.guardarPacienteExamenes(orden, examenes);
            if (!guardado || !guardado.success) {
                throw new Error(guardado && guardado.error ? guardado.error : 'No se pudieron guardar los resultados.');
            }
        } catch (error) {
            console.error('[guardarFormularioCoprocultivo] Error:', error);
            window.Notifications.error('Error al guardar el Coprocultivo: ' + error.message);
            return;
        }

        examen.resultado = resultado;
        examen.tipo = 'coprocultivo';
        examen.tipoFormulario = 'coprocultivo';
        if (window.pacienteActivo) {
            window.pacienteActivo.examenes = JSON.parse(JSON.stringify(window.examenesOrden));
        }
        window.cerrarFormularioCoprocultivo();
        window.renderizarTablaExamenes();
        window.Notifications.success('Resultados del Coprocultivo guardados correctamente.');
    };

    window.cerrarFormularioCoprocultivo = function() {
        var form = document.getElementById('formularioCoprocultivo');
        if (form) form.style.display = 'none';
        window._coprocultivoEditando = null;
        window._coprocultivoDraft = null;
    };

})();
