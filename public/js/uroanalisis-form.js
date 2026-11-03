(function() {
    'use strict';

    var grupos = [
        {
            nombre: 'Examen Físico',
            items: [
                { id: 'ur_color', nombre: 'Color', refTexto: 'Incoloro / Amarillo', opciones: ['Incoloro', 'Amarillo', 'Ámbar', 'Rosado', 'Rojo', 'Naranja', 'Verde', 'Marrón'] },
                { id: 'ur_olor', nombre: 'Olor', opciones: ['Característico', 'Amoniacal', 'Medicamento'] }
            ]
        },
        {
            nombre: 'Examen Químico',
            items: [
                { id: 'ur_leucocitos_tira', nombre: 'Esterasa Leucocitaria', refTexto: 'Negativo', opciones: ['Negativo', 'Positivo 1+', 'Positivo 2+', 'Positivo 3+'] },
                { id: 'ur_nitritos', nombre: 'Nitritos', refTexto: 'Negativo', opciones: ['Negativo', 'Positivo'] },
                { id: 'ur_urobilinogeno', nombre: 'Urobilinógeno', refTexto: 'Normal', opciones: ['Negativo', 'Positivo 1+', 'Positivo 2+', 'Positivo 3+'] },
                { id: 'ur_bilirrubina', nombre: 'Bilirrubina', refTexto: 'Negativo', opciones: ['Negativo', 'Positivo 1+', 'Positivo 2+', 'Positivo 3+'] },
                { id: 'ur_proteinas', nombre: 'Proteínas', refTexto: 'Negativo', opciones: ['Negativo', 'Positivo 1+', 'Positivo 2+', 'Positivo 3+'] },
                { id: 'ur_ph', nombre: 'pH', refTexto: '6.0 - 7.0', opciones: ['5', '6', '6,5', '7', '8', '9'] },
                { id: 'ur_reaccion', nombre: 'Reacción', opciones: ['Ácida', 'Neutra', 'Alcalina'] },
                { id: 'ur_hemoglobina', nombre: 'Hemoglobina', refTexto: 'Negativo', opciones: ['Negativo', '1+', '2+', '3+'] },
                { id: 'ur_densidad', nombre: 'Densidad', refTexto: '1.015 - 1.020', opciones: ['1,000', '1,005', '1,010', '1,015', '1,020', '1,025', '1,030'] },
                { id: 'ur_cetonas', nombre: 'Cuerpos cetónicos', refTexto: 'Negativo', opciones: ['Negativo', '1+', '2+', '3+'] },
                { id: 'ur_glucosa', nombre: 'Glucosa', refTexto: 'Negativo', opciones: ['Negativo', 'Positivo 1+', 'Positivo 2+', 'Positivo 3+'] }
            ]
        },
        {
            nombre: 'Examen Microscópico',
            items: [
                { id: 'ur_celulas_epiteliales', nombre: 'Células epiteliales', refTexto: 'Escasas / Moderadas', opciones: ['0-1', '1-3', '3-5'] },
                { id: 'ur_leucocitos_micro', nombre: 'Leucocitos', refTexto: '0 - 5 X CGA', opciones: ['0-1 X cpo', '1-3 X cpo', '3-5 X cpo', '5-10 X cpo', '10-15 X cpo', '20-30 X cpo', '30-40 X cpo', '40-50 X cpo', '50-100 X cpo'] },
                { id: 'ur_eritrocitos', nombre: 'Eritrocitos dismórficos', refTexto: '0 - 3 X CGA', opciones: ['0-1 X cpo', '1-3 X cpo', '3-5 X cpo', '5-10 X cpo', '10-15 X cpo', '20-30 X cpo', '30-40 X cpo', '40-50 X cpo', '50-100 X cpo'] },
                { id: 'ur_eritrocitos_isomorfos', nombre: 'Eritrocitos isomórficos', refTexto: '0 - 3 X CGA', opciones: ['0-1 X cpo', '1-3 X cpo', '3-5 X cpo', '5-10 X cpo', '10-15 X cpo', '20-30 X cpo', '30-40 X cpo', '40-50 X cpo', '50-100 X cpo'] },
                { id: 'ur_bacterias', nombre: 'Bacterias', refTexto: 'Ausente / Escasas', opciones: ['Escasas', 'Moderadas', 'Abundantes'] },
                { id: 'ur_cristales', nombre: 'Cristales', refTexto: 'Ausente / Variable', opciones: ['0-1', '1-3', '3-5', '5-10', '10-15', '15-20'] },
                { id: 'ur_cilindros', nombre: 'Cilindros', refTexto: 'Ausente XCBA', tipo: 'texto' },
                { id: 'ur_otros', nombre: 'Otros', tipo: 'texto' }
            ]
        }
    ];
    var items = [];
    var controles = Object.create(null);

    grupos.forEach(function(grupo) {
        grupo.items.forEach(function(item) {
            item.grupo = grupo.nombre;
            item.unidad = '';
            item.tipo = item.tipo || 'seleccion_unica';
            items.push(item);
        });
    });

    window.UROANALISIS_FIELDS = items;

    function crearCampo(item) {
        var columna = document.createElement('div');
        columna.className = 'col-6 col-md-4';

        var etiqueta = document.createElement('label');
        etiqueta.className = 'form-label fw-semibold small';
        etiqueta.htmlFor = 'uro_' + item.id;
        etiqueta.textContent = item.nombre + ':';
        columna.appendChild(etiqueta);

        var control;
        var entradaManual = null;
        if (item.tipo === 'seleccion_unica') {
            control = document.createElement('select');
            control.className = 'form-select form-select-sm';
            control.appendChild(new Option('...', ''));
            item.opciones.forEach(function(opcion) {
                control.appendChild(new Option(opcion, opcion));
            });
            control.appendChild(new Option('Otro (especificar)', '__manual__'));

            entradaManual = document.createElement('input');
            entradaManual.type = 'text';
            entradaManual.className = 'form-control form-control-sm mt-1';
            entradaManual.placeholder = 'Escriba otro resultado';
            entradaManual.setAttribute('aria-label', item.nombre + ': otro resultado');
            entradaManual.hidden = true;
            entradaManual.addEventListener('input', function() {
                entradaManual.setCustomValidity('');
            });
            control.addEventListener('change', function() {
                entradaManual.hidden = control.value !== '__manual__';
                if (!entradaManual.hidden) entradaManual.focus();
            });
        } else {
            control = document.createElement('input');
            control.type = 'text';
            control.className = 'form-control form-control-sm';
            control.placeholder = 'Escriba el resultado';
        }
        control.id = 'uro_' + item.id;
        columna.appendChild(control);
        if (entradaManual) columna.appendChild(entradaManual);

        controles[item.id] = { control: control, entradaManual: entradaManual };
        return columna;
    }

    function construirFormulario() {
        var formulario = document.getElementById('formUroanalisis');
        if (!formulario) return;

        formulario.replaceChildren();
        grupos.forEach(function(grupo) {
            var titulo = document.createElement('h6');
            titulo.className = 'fw-bold text-primary mt-3 mb-1';
            titulo.textContent = grupo.nombre;
            formulario.appendChild(titulo);

            var fila = document.createElement('div');
            fila.className = 'row g-2';
            grupo.items.forEach(function(item) {
                fila.appendChild(crearCampo(item));
            });
            formulario.appendChild(fila);
        });
    }

    function sincronizarCatalogo() {
        if (!window.App) window.App = {};
        if (!window.App.examenesDetallados) window.App.examenesDetallados = {};
        window.App.examenesDetallados.examen_orina = {
            nombre: 'Examen General de Orina',
            items: items.map(function(item) {
                return {
                    id: item.id,
                    nombre: item.nombre,
                    unidad: item.unidad,
                    tipo: item.tipo,
                    grupo: item.grupo,
                    refTexto: item.refTexto,
                    opciones: item.opciones ? item.opciones.slice() : undefined
                };
            })
        };
    }

    function leerDatos(examen) {
        if (!examen || !examen.resultado) return {};
        if (typeof examen.resultado === 'string') {
            return JSON.parse(examen.resultado || '{}');
        }
        return examen.resultado;
    }

    construirFormulario();
    if (window.catalogoListo && typeof window.catalogoListo.then === 'function') {
        window.catalogoListo.then(sincronizarCatalogo, sincronizarCatalogo);
    } else {
        sincronizarCatalogo();
    }

    window.abrirFormularioUroanalisis = function(examenId) {
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;

        var form = document.getElementById('formularioUroanalisis');
        if (!form) return;

        var datos;
        try {
            datos = leerDatos(examen);
        } catch (error) {
            window.Notifications.error('No se pudieron leer los resultados guardados del examen de orina: ' + error.message);
            return;
        }

        window._uroEditando = examenId;
        items.forEach(function(item) {
            var estado = controles[item.id];
            var valor = datos[item.id] === undefined || datos[item.id] === null ? '' : String(datos[item.id]);
            if (estado.control.tagName === 'SELECT') {
                var existe = Array.prototype.some.call(estado.control.options, function(opcion) {
                    return opcion.value === valor && opcion.value !== '__manual__';
                });
                estado.control.value = existe || !valor ? valor : '__manual__';
                estado.entradaManual.value = existe ? '' : valor;
                estado.entradaManual.hidden = estado.control.value !== '__manual__';
            } else {
                estado.control.value = valor;
            }
        });
        var observaciones = document.getElementById('uro_observaciones');
        if (observaciones) observaciones.value = datos.__observaciones || '';

        form.style.display = 'block';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    window.guardarFormularioUroanalisis = async function() {
        var examenId = window._uroEditando;
        if (!examenId) {
            window.Notifications.error('No se encontró el examen de orina que se va a guardar.');
            return;
        }

        var examenes = window.examenesOrden || [];
        var examen = examenes.find(function(e) { return e.id === examenId; });
        if (!examen) {
            window.Notifications.error('No se encontró el examen de orina en la orden.');
            return;
        }

        var datos;
        try {
            datos = leerDatos(examen);
        } catch (error) {
            window.Notifications.error('No se pudieron leer los resultados guardados del examen de orina: ' + error.message);
            return;
        }
        items.forEach(function(item) {
            var estado = controles[item.id];
            datos[item.id] = estado.control.tagName === 'SELECT'
                ? (estado.control.value === '__manual__' ? estado.entradaManual.value.trim() : estado.control.value)
                : estado.control.value.trim();
        });
        var observaciones = document.getElementById('uro_observaciones');
        datos.__observaciones = observaciones ? String(observaciones.value || '').trim() : '';

        var orden = window.pacienteActivo ? window.pacienteActivo.orden : (window.getOrden ? window.getOrden() : '');
        if (!orden) {
            window.Notifications.error('Error: No se pudo determinar la orden.');
            return;
        }
        if (!window.api || typeof window.api.guardarPacienteExamenes !== 'function') {
            window.Notifications.error('Error: No está disponible el guardado en la base de datos.');
            return;
        }

        var resultado = JSON.stringify(datos);
        var examenesActualizados = examenes.map(function(item) {
            if (item.id !== examenId) return item;
            return Object.assign({}, item, {
                resultado: resultado,
                examen_id: 'examen_orina',
                tipoFormulario: 'uroanalisis',
                tipo: 'uroanalisis'
            });
        });

        try {
            var examenesParaGuardar = examenesActualizados.map(function(item) {
                if (item.id !== examenId) return item;
                return Object.assign({}, item, { resultado: datos });
            });
            var guardado = await window.api.guardarPacienteExamenes(orden, examenesParaGuardar);
            if (!guardado || !guardado.success) {
                throw new Error(guardado && guardado.error ? guardado.error : 'No se pudieron guardar los resultados.');
            }
        } catch (error) {
            console.error('[guardarFormularioUroanalisis] Error:', error);
            window.Notifications.error('Error al guardar los resultados: ' + error.message);
            return;
        }

        examen.resultado = resultado;
        examen.examen_id = 'examen_orina';
        examen.tipoFormulario = 'uroanalisis';
        examen.tipo = 'uroanalisis';
        if (window.pacienteActivo) {
            window.pacienteActivo.examenes = JSON.parse(JSON.stringify(examenes));
        }

        window._uroEditando = null;
        var form = document.getElementById('formularioUroanalisis');
        if (form) form.style.display = 'none';
        window.renderizarTablaExamenes();
    };

    window.cerrarFormularioUroanalisis = function() {
        window._uroEditando = null;
        var form = document.getElementById('formularioUroanalisis');
        if (form) form.style.display = 'none';
    };
})();
