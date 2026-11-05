/**
 * Construcción y manejo de los campos del formulario de examen de heces.
 * La definición de los campos y sus opciones vive aquí para que la interfaz no
 * dependa de parámetros antiguos guardados en la base de datos.
 */
(function() {
    'use strict';

    var controles = Object.create(null);

    var observacionesPorDefecto = 'No se observaron formas parasitarias en la muestra observada.';
    var campos = [
        { id: 'colorHeces', nombre: 'Color', tipo: 'seleccion_unica', opciones: ['Marrón', 'Amarillo', 'Rojo', 'Negro', 'Verde'], grupo: 'Examen Macroscópico' },
        { id: 'aspectoHeces', nombre: 'Aspecto', tipo: 'seleccion_unica', opciones: ['Homogéneo', 'Heterogéneo'], grupo: 'Examen Macroscópico' },
        { id: 'consistencia', nombre: 'Consistencia', tipo: 'seleccion_unica', opciones: ['Líquidas', 'Blandas', 'Pastosa', 'Duras'], refTexto: 'Blandas/Pastosas', grupo: 'Examen Macroscópico' },
        { id: 'restosAlimentos', nombre: 'Restos de Alimentos', tipo: 'seleccion_unica', opciones: ['Presente', 'Ausente'], grupo: 'Examen Macroscópico' },
        { id: 'mocoFecal', nombre: 'Moco', tipo: 'seleccion_unica', opciones: ['Presente', 'Ausente'], refTexto: 'Ausente', grupo: 'Examen Macroscópico' },
        { id: 'sangreHeces', nombre: 'Sangre', tipo: 'seleccion_unica', opciones: ['Presente', 'Ausente'], refTexto: 'Ausente', grupo: 'Examen Macroscópico' },
        { id: 'reaccion', nombre: 'Reacción', tipo: 'seleccion_unica', opciones: ['Ácida', 'Alcalina', 'Neutra'], grupo: 'Examen Macroscópico' },
        { id: 'eritrocitosHeces', nombre: 'Eritrocitos', tipo: 'numerico', unidad: 'xcpo', refTexto: '0 xcpo', grupo: 'Examen Microscópico' },
        { id: 'leucocitosHeces', nombre: 'Leucocitos', tipo: 'numerico', unidad: 'xcpo', refTexto: '0 xcpo', grupo: 'Examen Microscópico' },
        { id: 'helmintos', nombre: 'Helmintos', tipo: 'seleccion_unica', opciones: ['Presente', 'Ausente'], refTexto: 'Ausente', grupo: 'Examen Microscópico' },
        { id: 'protozoarios', nombre: 'Protozoarios', tipo: 'seleccion_unica', opciones: ['Presente', 'Ausente'], refTexto: 'Ausente', grupo: 'Examen Microscópico' },
        { id: 'otrosHeces', nombre: 'Otros', tipo: 'texto', placeholder: 'Blastocystis spp', grupo: 'Examen Microscópico' }
    ];

    var camposObsoletos = [
        'phHeces',
        'glucosaHeces',
        'sustanciasReductoras',
        'leucocitosPMN',
        'leucocitosMononucleados',
        'directoConcentracion',
        'entamoebaColi',
        'floraBacteriana'
    ];

    function crearCampo(campo) {
        var columna = document.createElement('div');
        columna.className = 'col-6 col-md-4';

        var etiqueta = document.createElement('label');
        etiqueta.className = 'form-label fw-semibold small';
        etiqueta.htmlFor = campo.id;
        etiqueta.textContent = campo.nombre + ':';
        columna.appendChild(etiqueta);

        var control;
        var entradaManual = null;
        if (campo.tipo === 'seleccion_unica') {
            control = document.createElement('select');
            control.className = 'form-select form-select-sm';
            control.appendChild(new Option('Seleccionar...', ''));
            (campo.opciones || []).forEach(function(opcion) {
                control.appendChild(new Option(opcion, opcion));
            });
            control.appendChild(new Option('Otro (especificar)', '__manual__'));

            entradaManual = document.createElement('input');
            entradaManual.type = 'text';
            entradaManual.className = 'form-control form-control-sm mt-1';
            entradaManual.placeholder = 'Escriba otro resultado';
            entradaManual.setAttribute('aria-label', campo.nombre + ': otro resultado');
            entradaManual.hidden = true;
            control.addEventListener('change', function() {
                entradaManual.hidden = control.value !== '__manual__';
                if (!entradaManual.hidden) entradaManual.focus();
            });
        } else {
            control = document.createElement('input');
            control.type = campo.tipo === 'numerico' ? 'number' : 'text';
            if (campo.tipo === 'numerico') {
                control.min = '0';
                control.step = '1';
                control.inputMode = 'numeric';
                control.addEventListener('input', function() {
                    validarCampoNumerico(control);
                });
            }
            control.className = 'form-control form-control-sm';
            control.placeholder = campo.placeholder || 'Escriba el resultado';
        }
        control.id = campo.id;
        if (campo.unidad) {
            var grupoEntrada = document.createElement('div');
            grupoEntrada.className = 'input-group input-group-sm';
            grupoEntrada.appendChild(control);
            var sufijo = document.createElement('span');
            sufijo.className = 'input-group-text';
            sufijo.textContent = campo.unidad;
            grupoEntrada.appendChild(sufijo);
            columna.appendChild(grupoEntrada);
        } else {
            columna.appendChild(control);
        }

        if (campo.refTexto) {
            var referencia = document.createElement('small');
            referencia.className = 'text-muted d-block mt-1';
            referencia.textContent = 'Ref: ' + campo.refTexto;
            columna.appendChild(referencia);
        }

        if (entradaManual) columna.appendChild(entradaManual);

        controles[campo.id] = { control: control, entradaManual: entradaManual };
        return columna;
    }

    function validarCampoNumerico(control) {
        var valor = control.value;
        var enteroValido = valor === '' ||
            (/^\d+$/.test(valor) && Number.isSafeInteger(Number(valor)));
        control.setCustomValidity(enteroValido ? '' : 'Ingrese un número entero mayor o igual a 0.');
        return enteroValido && control.checkValidity();
    }

    function validar() {
        var entradas = campos.filter(function(campo) { return campo.tipo === 'numerico'; });
        for (var i = 0; i < entradas.length; i += 1) {
            var control = controles[entradas[i].id].control;
            if (!validarCampoNumerico(control)) {
                control.reportValidity();
                return false;
            }
        }
        return true;
    }

    function crearObservaciones(formulario) {
        var contenedor = document.createElement('div');
        contenedor.className = 'mt-3';

        var etiqueta = document.createElement('label');
        etiqueta.htmlFor = 'heces_observaciones';
        etiqueta.className = 'form-label fw-semibold';
        etiqueta.textContent = 'OBSERVACIONES';

        var observaciones = document.createElement('textarea');
        observaciones.id = 'heces_observaciones';
        observaciones.className = 'form-control';
        observaciones.rows = 3;
        observaciones.value = observacionesPorDefecto;

        contenedor.appendChild(etiqueta);
        contenedor.appendChild(observaciones);
        formulario.appendChild(contenedor);
    }

    function construir() {
        var formulario = document.getElementById('formHeces');
        if (!formulario) return false;

        formulario.replaceChildren();
        controles = Object.create(null);
        var grupos = [];
        campos.forEach(function(campo) {
            var nombreGrupo = campo.grupo || 'General';
            var grupo = grupos.find(function(item) { return item.nombre === nombreGrupo; });
            if (!grupo) {
                grupo = { nombre: nombreGrupo, items: [] };
                grupos.push(grupo);
            }
            grupo.items.push(campo);
        });

        var ordenGrupos = [
            'Examen Macroscópico',
            'Examen Microscópico'
        ];
        grupos.sort(function(a, b) {
            var indiceA = ordenGrupos.indexOf(a.nombre);
            var indiceB = ordenGrupos.indexOf(b.nombre);
            if (indiceA < 0) return indiceB < 0 ? 0 : 1;
            if (indiceB < 0) return -1;
            return indiceA - indiceB;
        });

        grupos.forEach(function(grupo) {
            var titulo = document.createElement('h6');
            titulo.className = 'fw-bold text-primary mt-3 mb-1';
            titulo.textContent = grupo.nombre;
            formulario.appendChild(titulo);

            var fila = document.createElement('div');
            fila.className = 'row g-2';
            grupo.items.forEach(function(campo) {
                fila.appendChild(crearCampo(campo));
            });
            formulario.appendChild(fila);
        });
        crearObservaciones(formulario);
        return true;
    }

    function cargar(datos) {
        var equivalencias = {
            'Líquida': 'Líquidas',
            'Blanda': 'Blandas',
            'Dura': 'Duras'
        };
        campos.forEach(function(campo) {
            var estado = controles[campo.id];
            var valor = datos[campo.id] == null ? '' : String(datos[campo.id]);
            if (campo.tipo === 'numerico') {
                valor = valor.replace(/\s*xcpo$/i, '').trim();
                if (!/^\d+$/.test(valor)) valor = '';
            }
            if (campo.id === 'consistencia' && equivalencias[valor]) {
                valor = equivalencias[valor];
            }
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
        var observaciones = document.getElementById('heces_observaciones');
        if (observaciones) {
            observaciones.value = datos.__observaciones == null || String(datos.__observaciones).trim() === ''
                ? observacionesPorDefecto
                : String(datos.__observaciones);
        }
    }

    function obtenerResultados(datosGuardados) {
        if (!validar()) return null;
        var datos = Object.assign({}, datosGuardados || {});
        camposObsoletos.forEach(function(id) { delete datos[id]; });
        campos.forEach(function(campo) {
            var estado = controles[campo.id];
            var valor = estado.control.tagName === 'SELECT' && estado.control.value === '__manual__'
                ? String(estado.entradaManual.value || '').trim()
                : String(estado.control.value || '').trim();
            if (campo.tipo === 'numerico' && valor) valor += ' ' + campo.unidad;
            if (valor !== '') datos[campo.id] = valor;
            else delete datos[campo.id];
        });
        var observaciones = document.getElementById('heces_observaciones');
        datos.__observaciones = observaciones ? String(observaciones.value || '').trim() : '';
        return datos;
    }

    window.HecesForm = {
        construir: construir,
        cargar: cargar,
        obtenerResultados: obtenerResultados,
        obtenerCampos: function() {
            return campos.map(function(campo) {
                return Object.assign({}, campo, {
                    opciones: campo.opciones ? campo.opciones.slice() : undefined
                });
            });
        },
        validar: validar
    };
})();
