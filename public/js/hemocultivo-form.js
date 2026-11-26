(function() {
    'use strict';

    var CATALOGO_MICROORGANISMOS = [
        "Burkholderia cepacia complex",
        "Staphylococcus aureus",
        "Staphylococcus epidermidis",
        "Escherichia coli",
        "Klebsiella pneumoniae",
        "Pseudomonas aeruginosa",
        "Enterococcus faecalis",
        "Acinetobacter baumannii",
        "Streptococcus pneumoniae",
        "Candida albicans"
    ];

    var CATALOGO_ANTIBIOTICOS = [
        "AMPICILINA",
        "AMPICILINA / SULBACTAM",
        "CEFTAZIDIMA",
        "CEFTRIAXONA",
        "CEFEPIME",
        "CIPROFLOXACINA",
        "GENTAMICINA",
        "AMIKACINA",
        "IMIPENEM",
        "MEROPENEM",
        "LEVOFLOXACINA",
        "MINOCICLINA",
        "PIPERACILINA / TAZOBACTAM",
        "TRIMETOPRIM / SULFAMETOXAZOL",
        "VANCOMICINA",
        "LINEZOLID"
    ];
    var catalogoAntibioticosFormulario = CATALOGO_ANTIBIOTICOS.map(function(nombre) {
        return { id: nombre, nombre: nombre };
    });

    var PLANTILLAS_OBSERVACIONES = {
        estandar_vitek: "*La identificación de este microorganismo se realizó mediante métodos convencionales y se confirmó con método automatizado (VITEK 2).\n\n*Ante cualquier duda referente a la interpretación de los resultados, por favor comunicarse con el <Servicio de Atención al Médico del Laboratorio Clínico>.",
        b_cepacia_clsi: "*La identificación de este microorganismo se realizó mediante métodos convencionales y se confirmó con método automatizado (VITEK 2).\n\n*El CLSI desde su publicación 2025, ya no aconseja realizar de manera rutinaria las pruebas de susceptibilidad a los antimicrobianos para los microorganismos del complejo B. cepacia, debido a que se eliminaron los puntos de corte de dichas pruebas (por concentración mínima inhibitoria y difusión en disco), basados en datos que demuestran una falta de correlación entre ambos métodos y los resultados clínicos en pacientes. Estos hallazgos están respaldados por estudios adicionales realizados en 2024 por el Comité Europeo de Pruebas de Susceptibilidad a los Antimicrobianos (EUCAST) y un estudio brasileño que demuestra problemas con la precisión de las pruebas de susceptibilidad en el complejo B. cepacia.\n\n*En otras palabras, el tratamiento será de <administración empírica> basado en el uso de ceftazidima, levofloxacina, meropenem, minociclina o trimetoprim/sulfametoxazol. La consideración de alguno o más de estos antibióticos como opción terapéutica quedará a criterio médico y deberá ser evaluado según el contexto clínico del paciente.\n\n*Microorganismo con resistencia intrínseca a los siguientes antibióticos: penicilinas (incluyendo combinaciones con inhibidores de betalactamasas), cefalosporinas (excepto ceftazidima), carbapenémicos (excepto meropenem), aztreonam, aminoglucósidos y polimixinas.\n\n*Ante cualquier duda referente a la interpretación de los resultados, por favor comunicarse con el <Servicio de Atención al Médico del Laboratorio Clínico>.",
        negativo_5_dias: "*No se observó crecimiento bacteriano ni fúngico tras 5 días de incubación en sistema automatizado.\n\n*Un resultado negativo no descarta completamente la presencia de bacteriemia; correlacionar con el cuadro clínico del paciente."
    };

    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function crearDatosHemocultivo(examen, catalogoAntibioticos) {
        var guardado = examen && examen.resultado;
        var datos = {};
        if (guardado && typeof guardado === 'object') {
            datos = guardado;
        } else if (guardado) {
            var texto = String(guardado);
            try {
                datos = JSON.parse(texto);
            } catch (error) {
                datos = {};
            }
            if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
                datos = {};
            }
        }

        var antibioticosGuardados = Array.isArray(datos.antibiograma) ? datos.antibiograma : [];
        var microorganismos = Array.isArray(datos.microorganismos)
            ? datos.microorganismos.map(function(microorganismo) {
                return { nombre: String(microorganismo && microorganismo.nombre || '') };
            })
            : [];
        if (!microorganismos.length) microorganismos.push({ nombre: '' });

        var metodosGuardados = datos.metodoAntibiograma || 'DIFUSIÓN';
        var metodos = { cmi: false, difusion: false };
        if (metodosGuardados === 'CMI (VITEK 2)') metodos.cmi = true;
        else if (metodosGuardados === 'E-TEST') metodos.cmi = true;
        else metodos.difusion = true;

        var panel = catalogoAntibioticos || [];
        var antibioticos = panel.map(function(abx) {
            var existente = antibioticosGuardados.find(function(item) {
                return item && (item.id === abx.id || item.antibiotico === abx.nombre);
            });
            return {
                id: abx.id || abx.nombre,
                nombre: abx.nombre,
                seleccionado: !!existente,
                interpretacion: existente ? (existente.interpretacion || '') : ''
            };
        });

        antibioticosGuardados.forEach(function(existente) {
            if (!existente || panel.some(function(abx) {
                return abx.id === existente.id || abx.nombre === existente.antibiotico;
            })) return;
            antibioticos.push({
                id: existente.id || existente.antibiotico,
                nombre: existente.antibiotico || existente.id,
                seleccionado: true,
                interpretacion: existente.interpretacion || ''
            });
        });

        return {
            examenSolicitado: String(datos.examenSolicitado || 'Hemocultivo.'),
            sitioAnatomico: String(datos.sitioAnatomico || ''),
            volumenMuestra: String(datos.volumenMuestra || ''),
            estadoCultivo: String(datos.estadoCultivo || 'positivo'),
            microorganismos: microorganismos,
            observaciones: String(datos.observaciones || PLANTILLAS_OBSERVACIONES.estandar_vitek),
            incluirAntibiograma: datos.incluirAntibiograma === true,
            metodoAntibiograma: metodosGuardados,
            antibioticos: antibioticos
        };
    }

    function elemento(tag, texto, clase) {
        var nodo = document.createElement(tag);
        if (texto !== undefined) nodo.textContent = texto;
        if (clase) nodo.className = clase;
        return nodo;
    }

    function actualizarDatosHemocultivoDesdeFormulario(draft) {
        draft.examenSolicitado = document.getElementById('hemo-examen-solicitado').value.trim();
        draft.sitioAnatomico = document.getElementById('hemo-sitio-anatomico').value.trim();
        draft.volumenMuestra = document.getElementById('hemo-volumen-muestra').value.trim();
        draft.estadoCultivo = document.getElementById('hemo-estado-cultivo').value;
        draft.observaciones = document.getElementById('hemo-observaciones').value.trim();
        draft.incluirAntibiograma = document.getElementById('hemo-check-antibiograma').checked;
        draft.metodoAntibiograma = document.getElementById('hemo-metodo-antibiograma').value;

        var listaMicro = document.getElementById('hemo-lista-microorganismos');
        draft.microorganismos = [];
        listaMicro.querySelectorAll('.hemo-select-micro').forEach(function(sel) {
            var valorSelect2 = window.jQuery ? window.jQuery(sel).val() : '';
            var val = valorSelect2 ? String(valorSelect2).trim() : sel.value.trim();
            if (val) draft.microorganismos.push({ nombre: val });
        });
        if (!draft.microorganismos.length && draft.estadoCultivo === 'positivo') {
            draft.microorganismos.push({ nombre: '' });
        }

        var tbody = document.getElementById('hemo-tbody-antibiograma');
        draft.antibiograma = [];
        tbody.querySelectorAll('tr').forEach(function(tr) {
            var selAtb = tr.querySelector('.hemo-select-atb');
            var valorSelect2 = window.jQuery ? window.jQuery(selAtb).val() : '';
            var antibiotico = (valorSelect2 ? String(valorSelect2) : selAtb.value).trim().toUpperCase();
            var interpretacion = tr.querySelector('.hemo-select-res').value;
            if (antibiotico) {
                draft.antibiograma.push({ antibiotico: antibiotico, interpretacion: interpretacion });
            }
        });
    }

    function agregarFilaMicroorganismo(draft, valorInicial) {
        var lista = document.getElementById('hemo-lista-microorganismos');
        var index = lista.children.length + 1;

        var row = document.createElement('div');
        row.className = 'hemo-micro-item';

        var opcionesHtml = CATALOGO_MICROORGANISMOS.map(function(m) {
            return '<option value="' + escapeHtml(m) + '"' + (m === valorInicial ? ' selected' : '') + '>' + escapeHtml(m) + '</option>';
        }).join('');

        var extraOption = '';
        if (valorInicial && !CATALOGO_MICROORGANISMOS.includes(valorInicial)) {
            extraOption = '<option value="' + escapeHtml(valorInicial) + '" selected>' + escapeHtml(valorInicial) + '</option>';
        }

        row.innerHTML = '\
            <span class="hemo-micro-numero">#' + index + '</span>\
            <select class="form-select hemo-select-micro">\
                <option value="">Seleccione o escriba el microorganismo...</option>\
                ' + opcionesHtml + '\
                ' + extraOption + '\
            </select>\
            <button type="button" class="btn btn-outline-danger hemo-btn-del-micro" title="Eliminar microorganismo" aria-label="Eliminar microorganismo"><i class="bi bi-trash3" aria-hidden="true"></i></button>\
        ';

        lista.appendChild(row);

        var selectEl = row.querySelector('.hemo-select-micro');
        if (window.jQuery && window.jQuery.fn.select2) {
            var $select = window.jQuery(selectEl);
            $select.select2({
                tags: true,
                placeholder: "Seleccione o escriba el microorganismo...",
                width: "resolve",
                theme: 'bootstrap-5'
            });

        }
        selectEl.addEventListener('change', function() {
            var val = selectEl.value.trim().toLowerCase();
            if (val.includes('burkholderia cepacia')) {
                document.getElementById('hemo-observaciones').value = PLANTILLAS_OBSERVACIONES.b_cepacia_clsi;
                var checkAtb = document.getElementById('hemo-check-antibiograma');
                checkAtb.checked = false;
                document.getElementById('hemo-contenedor-antibiograma').classList.add('d-none');
            }
        });

        row.querySelector('.hemo-btn-del-micro').addEventListener('click', function() {
            if (lista.children.length > 1) {
                row.remove();
                renumerarMicroorganismos();
            }
        });
        actualizarBotonesEliminarMicroorganismo();
    }

    function renumerarMicroorganismos() {
        var items = document.querySelectorAll('#hemo-lista-microorganismos .hemo-micro-item');
        items.forEach(function(item, idx) {
            item.querySelector('.hemo-micro-numero').textContent = '#' + (idx + 1);
        });
        actualizarBotonesEliminarMicroorganismo();
    }

    function actualizarBotonesEliminarMicroorganismo() {
        var items = document.querySelectorAll('#hemo-lista-microorganismos .hemo-micro-item');
        items.forEach(function(item) {
            item.querySelector('.hemo-btn-del-micro').disabled = items.length <= 1;
        });
    }

    function agregarFilaAntibiotico(draft, atbInicial, resultadoInicial) {
        var tbody = document.getElementById('hemo-tbody-antibiograma');
        var tr = document.createElement('tr');

        var catalogo = catalogoAntibioticosFormulario.length
            ? catalogoAntibioticosFormulario.map(function(item) { return item.nombre; })
            : CATALOGO_ANTIBIOTICOS;
        var opcionesAtb = catalogo.map(function(a) {
            return '<option value="' + escapeHtml(a) + '"' + (a === atbInicial ? ' selected' : '') + '>' + escapeHtml(a) + '</option>';
        }).join('');

        var extraAtb = '';
        if (atbInicial && !catalogo.includes(atbInicial)) {
            extraAtb = '<option value="' + escapeHtml(atbInicial) + '" selected>' + escapeHtml(atbInicial) + '</option>';
        }

        tr.innerHTML = '\
            <td>\
                <select class="form-select form-select-sm hemo-select-atb" style="width: 100%;">\
                    <option value="">Seleccione antibiótico...</option>\
                    ' + opcionesAtb + '\
                    ' + extraAtb + '\
                </select>\
            </td>\
            <td>\
                <select class="form-select form-select-sm hemo-select-res">\
                    <option value="SENSIBLE"' + (resultadoInicial === 'SENSIBLE' ? ' selected' : '') + '>SENSIBLE</option>\
                    <option value="INTERMEDIO"' + (resultadoInicial === 'INTERMEDIO' ? ' selected' : '') + '>INTERMEDIO</option>\
                    <option value="RESISTENTE"' + (resultadoInicial === 'RESISTENTE' ? ' selected' : '') + '>RESISTENTE</option>\
                </select>\
            </td>\
            <td class="text-center">\
                <button type="button" class="btn btn-sm btn-outline-danger hemo-btn-del-atb" title="Eliminar antibiótico" aria-label="Eliminar antibiótico"><i class="bi bi-trash3" aria-hidden="true"></i></button>\
            </td>\
        ';

        tbody.appendChild(tr);

        if (window.jQuery && window.jQuery.fn.select2) {
            var $atbSelect = window.jQuery(tr).find('.hemo-select-atb');
            $atbSelect.select2({
                tags: true,
                placeholder: "Seleccione o escriba...",
                width: "100%",
                theme: 'bootstrap-5'
            });
        }

        tr.querySelector('.hemo-btn-del-atb').addEventListener('click', function() {
            tr.remove();
        });
    }

    function inicializarEventosHemocultivo() {
        var form = document.getElementById('formularioHemocultivo');
        if (!form || form.dataset.eventosInicializados === 'true') return;

        var selectEstado = document.getElementById('hemo-estado-cultivo');
        var seccionMicro = document.getElementById('hemo-seccion-microorganismos');
        var checkAtb = document.getElementById('hemo-check-antibiograma');
        var contAtb = document.getElementById('hemo-contenedor-antibiograma');
        var observaciones = document.getElementById('hemo-observaciones');
        var tbodyAtb = document.getElementById('hemo-tbody-antibiograma');

        selectEstado.addEventListener('change', function(e) {
            if (e.target.value === 'negativo') {
                seccionMicro.classList.add('d-none');
                checkAtb.checked = false;
                checkAtb.disabled = true;
                contAtb.classList.add('d-none');
                if (window.jQuery && window.jQuery.fn.select2) {
                    tbodyAtb.querySelectorAll('.select2-hidden-accessible').forEach(function(select) {
                        window.jQuery(select).select2('destroy');
                    });
                }
                tbodyAtb.replaceChildren();
                observaciones.value = PLANTILLAS_OBSERVACIONES.negativo_5_dias;
            } else {
                seccionMicro.classList.remove('d-none');
                checkAtb.checked = false;
                checkAtb.disabled = false;
                contAtb.classList.add('d-none');
                if (observaciones.value === PLANTILLAS_OBSERVACIONES.negativo_5_dias) {
                    observaciones.value = PLANTILLAS_OBSERVACIONES.estandar_vitek;
                }
            }
        });

        document.getElementById('hemo-btn-agregar-micro').addEventListener('click', function() {
            agregarFilaMicroorganismo(window._hemocultivoDraft);
        });

        form.querySelectorAll('[data-plantilla]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var key = btn.getAttribute('data-plantilla');
                if (PLANTILLAS_OBSERVACIONES[key]) {
                    observaciones.value = PLANTILLAS_OBSERVACIONES[key];
                }
                if (key === 'b_cepacia_clsi') {
                    checkAtb.checked = false;
                    contAtb.classList.add('d-none');
                }
            });
        });

        checkAtb.addEventListener('change', function(e) {
            if (selectEstado.value === 'negativo') {
                checkAtb.checked = false;
                return;
            }
            if (e.target.checked) {
                contAtb.classList.remove('d-none');
                if (tbodyAtb.children.length === 0) {
                    agregarFilaAntibiotico(window._hemocultivoDraft);
                }
            } else {
                contAtb.classList.add('d-none');
            }
        });

        document.getElementById('hemo-btn-agregar-atb').addEventListener('click', function() {
            agregarFilaAntibiotico(window._hemocultivoDraft);
        });
        form.dataset.eventosInicializados = 'true';
    }

    function cargarDatosEnFormulario(draft) {
        document.getElementById('hemo-examen-solicitado').value = draft.examenSolicitado || 'Hemocultivo.';
        document.getElementById('hemo-sitio-anatomico').value = draft.sitioAnatomico || '';
        document.getElementById('hemo-volumen-muestra').value = draft.volumenMuestra || '';
        document.getElementById('hemo-estado-cultivo').value = draft.estadoCultivo || 'positivo';
        document.getElementById('hemo-observaciones').value = draft.observaciones || PLANTILLAS_OBSERVACIONES.estandar_vitek;
        document.getElementById('hemo-metodo-antibiograma').value = draft.metodoAntibiograma || 'DIFUSIÓN';

        var seccionMicro = document.getElementById('hemo-seccion-microorganismos');
        var listaMicro = document.getElementById('hemo-lista-microorganismos');
        var tbodyAtb = document.getElementById('hemo-tbody-antibiograma');
        var checkAtb = document.getElementById('hemo-check-antibiograma');
        var contAtb = document.getElementById('hemo-contenedor-antibiograma');

        if (window.jQuery && window.jQuery.fn.select2) {
            [listaMicro, tbodyAtb].forEach(function(contenedor) {
                contenedor.querySelectorAll('.select2-hidden-accessible').forEach(function(select) {
                    window.jQuery(select).select2('destroy');
                });
            });
        }
        listaMicro.replaceChildren();
        tbodyAtb.replaceChildren();

        if (draft.estadoCultivo === 'negativo') {
            seccionMicro.classList.add('d-none');
            checkAtb.checked = false;
            checkAtb.disabled = true;
            contAtb.classList.add('d-none');
        } else {
            seccionMicro.classList.remove('d-none');
            checkAtb.disabled = false;
            if (Array.isArray(draft.microorganismos) && draft.microorganismos.length > 0) {
                draft.microorganismos.forEach(function(m) { agregarFilaMicroorganismo(draft, m.nombre); });
            } else {
                agregarFilaMicroorganismo(draft);
            }
        }

        if (draft.estadoCultivo !== 'negativo' && draft.incluirAntibiograma &&
                Array.isArray(draft.antibiograma) && draft.antibiograma.length > 0) {
            checkAtb.checked = true;
            contAtb.classList.remove('d-none');
            draft.antibiograma.forEach(function(item) { agregarFilaAntibiotico(draft, item.antibiotico, item.interpretacion); });
        } else {
            checkAtb.checked = false;
            contAtb.classList.add('d-none');
        }
    }

    window.abrirFormularioHemocultivo = async function(examenId) {
        var examen = (window.examenesOrden || []).find(function(item) { return item.id === examenId; });
        var form = document.getElementById('formularioHemocultivo');
        if (!examen || !form) {
            window.Notifications.error('No se encontró el examen de Hemocultivo para editar.');
            return;
        }
        var catalogoAntibioticos = [];
        if (window.api && typeof window.api.obtenerAntibioticosActivos === 'function') {
            try {
                var respuesta = await window.api.obtenerAntibioticosActivos();
                if (!respuesta || !respuesta.success) {
                    throw new Error((respuesta && respuesta.error) || 'No se pudo cargar el catálogo de antibióticos.');
                }
                catalogoAntibioticos = (respuesta.antibioticos || []).map(function(antibiotico) {
                    return { id: antibiotico.id, nombre: antibiotico.nombre };
                });
            } catch (error) {
                console.error('[abrirFormularioHemocultivo] Error cargando el catálogo:', error);
                window.Notifications.warning('No se pudo cargar el catálogo de antibióticos. Puede escribirlos manualmente si agrega un antibiograma.');
            }
        } else {
            window.Notifications.warning('No está disponible el catálogo de antibióticos. Puede escribirlos manualmente si agrega un antibiograma.');
        }
        catalogoAntibioticosFormulario = catalogoAntibioticos.length
            ? catalogoAntibioticos
            : CATALOGO_ANTIBIOTICOS.map(function(nombre) { return { id: nombre, nombre: nombre }; });
        var draft = crearDatosHemocultivo(examen, catalogoAntibioticos);
        window._hemocultivoEditando = examenId;
        window._hemocultivoDraft = draft;

        cargarDatosEnFormulario(draft);
        inicializarEventosHemocultivo();

        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    window.guardarFormularioHemocultivo = async function() {
        var examenId = window._hemocultivoEditando;
        var draft = window._hemocultivoDraft;
        var examen = (window.examenesOrden || []).find(function(item) { return item.id === examenId; });
        if (!examenId || !draft || !examen) {
            window.Notifications.error('No se encontró el Hemocultivo que se va a guardar.');
            return;
        }
        actualizarDatosHemocultivoDesdeFormulario(draft);

        var datos = {
            examenSolicitado: draft.examenSolicitado,
            sitioAnatomico: draft.sitioAnatomico,
            volumenMuestra: draft.volumenMuestra,
            estadoCultivo: draft.estadoCultivo,
            microorganismos: draft.microorganismos,
            observaciones: draft.observaciones,
            incluirAntibiograma: draft.estadoCultivo !== 'negativo' &&
                draft.incluirAntibiograma && draft.antibiograma.length > 0,
            metodoAntibiograma: draft.metodoAntibiograma,
            antibiograma: draft.antibiograma
        };
        var orden = window.pacienteActivo ? window.pacienteActivo.orden :
            (window.getOrden ? window.getOrden() : '');
        if (!orden || !window.api || typeof window.api.guardarPacienteExamenes !== 'function') {
            window.Notifications.error('No está disponible el guardado del Hemocultivo para esta orden.');
            return;
        }

        var resultado = JSON.stringify(datos);
        var examenes = (window.examenesOrden || []).map(function(item) {
            if (item.id !== examenId) return item;
            return Object.assign({}, item, {
                tipo: 'hemocultivo',
                tipoFormulario: 'hemocultivo',
                resultado: resultado
            });
        });
        try {
            var guardado = await window.api.guardarPacienteExamenes(orden, examenes);
            if (!guardado || !guardado.success) {
                throw new Error(guardado && guardado.error ? guardado.error : 'No se pudieron guardar los resultados.');
            }
        } catch (error) {
            console.error('[guardarFormularioHemocultivo] Error:', error);
            window.Notifications.error('Error al guardar el Hemocultivo: ' + error.message);
            return;
        }

        examen.resultado = resultado;
        examen.tipo = 'hemocultivo';
        examen.tipoFormulario = 'hemocultivo';
        if (window.pacienteActivo) {
            window.pacienteActivo.examenes = JSON.parse(JSON.stringify(window.examenesOrden));
        }
        window.cerrarFormularioHemocultivo();
        window.renderizarTablaExamenes();
        window.Notifications.success('Resultados del Hemocultivo guardados correctamente.');
    };

    window.cerrarFormularioHemocultivo = function() {
        var form = document.getElementById('formularioHemocultivo');
        if (form) form.style.display = 'none';
        window._hemocultivoEditando = null;
        window._hemocultivoDraft = null;
    };

})();