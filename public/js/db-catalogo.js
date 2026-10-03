/**
 * Puente entre SQLite y el renderer (JavaScript Vanilla).
 *
 * Sustituye a los archivos estáticos de configuración (catálogo de exámenes,
 * parámetros y valores de referencia). Al cargar:
 *
 *   1. Pide el catálogo por IPC (una sola consulta) y lo cachea en memoria.
 *   2. Reconstruye window.App.catalogo / window.App.examenesDetallados /
 *      window.App.referencias / window.App.perfiles con la misma forma que
 *      tenían los .js, de modo que ningún consumidor cambia y la interfaz
 *      queda idéntica.
 *   3. Expone window.renderizarParametrosDesdeSQLite(), que consulta
 *      `parametros_examen` por examen y dibuja <label>/<input> en el DOM.
 *
 * window.catalogoListo es la promesa de carga: todo el código de arranque
 * debe esperarla antes de leer window.App.
 */
(function() {
    'use strict';

    window.App = window.App || {};

    var estado = {
        categorias: [],
        examenes: [],
        perfiles: [],
        examenesPorId: Object.create(null),
        parametrosPorExamen: Object.create(null),
        cargando: null
    };

    // ----------------------------------------------------------------------
    // Normalización de filas SQLite -> objetos que consume el renderer
    // ----------------------------------------------------------------------

    function parametrosDeFila(fila) {
        var parametro = {
            id: fila.codigo,
            nombre: fila.nombre,
            area: undefined,
            unidad: fila.unidad || '',
            tipo: fila.tipo_interfaz || fila.tipo_dato || 'numerico',
            tipoDato: fila.tipo_dato || 'numerico',
            grupo: fila.grupo || 'General',
            obligatorio: !!fila.obligatorio,
            valorDefecto: fila.valor_defecto,
            opciones: fila.opciones || [],
            orden: fila.orden,
            ordenRender: fila.orden_render,
            rangos: {
                adulto: {
                    M: { refMin: fila.ref_min_m_adulto, refMax: fila.ref_max_m_adulto },
                    F: { refMin: fila.ref_min_f_adulto, refMax: fila.ref_max_f_adulto }
                },
                pediatrico: { refMin: fila.ref_min_pediatrico, refMax: fila.ref_max_pediatrico }
            }
        };
        // Las claves de referencia se omiten cuando no hay valor, igual que en
        // los .js estáticos: los consumidores que encadenan
        // refTexto -> refMin/refMax distinguen "ausente" de null/vacío, y un
        // refMin presente con refMax ausente se renderizaría como "null - null".
        if (fila.ref_min !== null && fila.ref_min !== undefined) parametro.refMin = fila.ref_min;
        if (fila.ref_max !== null && fila.ref_max !== undefined) parametro.refMax = fila.ref_max;
        if (fila.ref_texto) parametro.refTexto = fila.ref_texto;
        return parametro;
    }

    function examenDeFila(fila) {
        var examen = {
            id: fila.id,
            nombre: fila.nombre,
            area: fila.categoria,
            categoria_id: fila.categoria_id,
            unidad: fila.unidad || '',
            tipo: fila.tipo || 'numerico',
            grupo: fila.grupo || undefined,
            orden: fila.orden
        };
        if (fila.ref_min !== null && fila.ref_min !== undefined) examen.refMin = fila.ref_min;
        if (fila.ref_max !== null && fila.ref_max !== undefined) examen.refMax = fila.ref_max;
        if (fila.ref_texto) examen.refTexto = fila.ref_texto;
        if (fila.tipo_formulario) examen.tipoFormulario = fila.tipo_formulario;
        if (fila.valor_defecto !== null && fila.valor_defecto !== undefined) {
            examen.valorDefecto = fila.valor_defecto;
        }
        if (fila.opciones && fila.opciones.length > 0) examen.opciones = fila.opciones;
        if (fila.parametros && fila.parametros.length > 0) {
            examen.items = fila.parametros.map(parametrosDeFila);
        }
        return examen;
    }

    function perfilDeFila(fila) {
        return {
            id: fila.id,
            nombre: fila.nombre,
            area: fila.area || 'Perfiles',
            examenes: (fila.examenes || []).map(function(miembro) {
                var copia = { id: miembro.id, nombre: miembro.nombre, area: miembro.area };
                if (miembro.unidad) copia.unidad = miembro.unidad;
                if (miembro.tipo) copia.tipo = miembro.tipo;
                if (miembro.refMin !== undefined && miembro.refMin !== null) copia.refMin = miembro.refMin;
                if (miembro.refMax !== undefined && miembro.refMax !== null) copia.refMax = miembro.refMax;
                if (miembro.refTexto) copia.refTexto = miembro.refTexto;
                if (miembro.grupo) copia.grupo = miembro.grupo;
                return copia;
            })
        };
    }

    // ----------------------------------------------------------------------
    // Hidratación de window.App
    // ----------------------------------------------------------------------

    function hidratar(catalogo, referencias) {
        var catalogoPlano = [];
        var examenesDetallados = {};

        catalogo.examenes.forEach(function(fila) {
            var examen = examenDeFila(fila);
            estado.examenesPorId[examen.id] = examen;
            catalogoPlano.push(examen);

            if (examen.items && examen.items.length > 0) {
                examenesDetallados[examen.id] = { nombre: examen.nombre, items: examen.items };
                estado.parametrosPorExamen[examen.id] = examen.items;
            }
        });

        estado.categorias = catalogo.categorias || [];
        estado.examenes = catalogoPlano;
        estado.perfiles = (catalogo.perfiles || []).map(perfilDeFila);

        window.App.catalogo = catalogoPlano;
        window.App.examenesDetallados = examenesDetallados;

        // Los perfiles se indexan por id porque orden.js y catalogo-admin.js
        // recorren Object.keys(window.App.perfiles).
        var perfilesPorId = {};
        estado.perfiles.forEach(function(perfil) { perfilesPorId[perfil.id] = perfil; });
        window.App.profiles = perfilesPorId;
        window.App.referencias = referencias
            ? { sexSpecific: referencias.sexSpecific || {}, shared: referencias.shared || {} }
            : { sexSpecific: {}, shared: {} };

        var perfilesPorId = {};
        estado.perfiles.forEach(function(perfil) { perfilesPorId[perfil.id] = perfil; });
        window.App.perfiles = perfilesPorId;

        return {
            categorias: estado.categorias.length,
            examenes: catalogoPlano.length,
            examenesDetallados: Object.keys(examenesDetallados).length,
            perfiles: estado.perfiles.length
        };
    }

    function cargarCatalogo() {
        if (!window.api || typeof window.api.obtenerCatalogo !== 'function') {
            console.warn('[db-catalogo] API de SQLite no disponible; el catálogo queda vacío');
            hidratar({ categorias: [], examenes: [], perfiles: [] }, null);
            return Promise.resolve(null);
        }

        return Promise.all([
            window.api.obtenerCatalogo(),
            window.api.obtenerReferencias().catch(function() { return null; })
        ]).then(function(respuestas) {
            var catalogo = respuestas[0];
            if (!catalogo || !catalogo.success) {
                throw new Error((catalogo && catalogo.error) || 'No se pudo leer el catálogo');
            }
            var resumen = hidratar(catalogo, respuestas[1]);
            console.log('✅ Catálogo cargado desde SQLite:', resumen);
            return resumen;
        }).catch(function(error) {
            console.error('[db-catalogo] Error cargando catálogo:', error);
            hidratar({ categorias: [], examenes: [], perfiles: [] }, null);
            throw error;
        });
    }

    // ----------------------------------------------------------------------
    // Compatibilidad con los .js estáticos
    // ----------------------------------------------------------------------
    // referencias.js y perfiles.js ya no se cargan en el HTML: su contenido vive
    // en SQLite. Estos ayudantes solo dependen de window.App.referencias y
    // window.App.perfiles, así que se exponen aquí para que orden.js,
    // catalogo-admin.js y pdf.js los sigan encontrando.

    // Exámenes que se listan como perfil pero se agregan a la orden como
    // exámenes normales, es decir, se expanden en sus parámetros.
    window.App.examenesNormalesCompuestos = ['perfil_secrecion_vaginal', 'hematologia_completa', 'uroanalisis'];

    window.esExamenNormalCompuesto = function(examenId) {
        return window.App.examenesNormalesCompuestos.indexOf(examenId) !== -1;
    };

    window.aplicarReferenciasAdaptadas = function(paciente, examenes) {
        if (!paciente || !paciente.refAdaptadas) return examenes;
        var edad = paciente.edad;
        var sexo = paciente.sexo;
        var esPediatrico = (edad !== null && edad !== undefined && edad !== '' && edad < 18);
        var categoriaEdad = esPediatrico ? 'pediatrico' : 'adulto';

        // App.referencias se puebla de forma asíncrona; si aún no llegó, se
        // devuelve la lista sin tocar para no interrumpir el renderizado.
        var referencias = window.App.referencias || {};
        var porSexo = referencias.sexSpecific || {};
        var compartidas = referencias.shared || {};

        return examenes.map(function(examen) {
            var copia = JSON.parse(JSON.stringify(examen));
            var refs;

            if (porSexo[copia.id]) {
                refs = porSexo[copia.id][categoriaEdad];
                if (refs && refs[sexo]) {
                    copia.refMin = refs[sexo].refMin;
                    copia.refMax = refs[sexo].refMax;
                }
            } else if (compartidas[copia.id]) {
                refs = compartidas[copia.id][categoriaEdad];
                if (refs) {
                    copia.refMin = refs.refMin;
                    copia.refMax = refs.refMax;
                }
            }

            return copia;
        });
    };

    window.detectarPerfilesPaciente = function(paciente) {
        var perfiles = (paciente && paciente.perfiles) || [];
        return perfiles
            .map(function(perfilId) {
                var perfil = (window.App.profiles || {})[perfilId];
                return perfil ? perfil.nombre : null;
            })
            .filter(Boolean);
    };

    // ----------------------------------------------------------------------
    // Consulta de parámetros bajo demanda (la que usa el renderer)
    // ----------------------------------------------------------------------

    function cachearParametros(examenId, parametros, opciones) {
        estado.parametrosPorExamen[examenId] = parametros.map(function(fila) {
            fila.opciones = (opciones || []).filter(function(opcion) {
                return opcion.parametro_id === fila.id;
            }).map(function(opcion) { return opcion.valor; });
            return parametrosDeFila(fila);
        });
        return estado.parametrosPorExamen[examenId];
    }

    /**
     * SELECT * FROM parametros_examen WHERE examen_id = ?
     * Se sirve desde la caché si el examen ya se cargó con el catálogo.
     */
    window.obtenerParametrosDesdeSQLite = function(examenId) {
        var id = String(examenId || '');
        var enCache = estado.parametrosPorExamen[id];
        if (enCache) return Promise.resolve(enCache);
        if (!window.api || typeof window.api.obtenerParametrosExamen !== 'function') {
            return Promise.resolve([]);
        }
        return window.api.obtenerParametrosExamen(id).then(function(respuesta) {
            if (!respuesta || !respuesta.success) {
                console.error('[db-catalogo] Error leyendo parámetros de ' + id, respuesta && respuesta.error);
                return [];
            }
            return cachearParametros(id, respuesta.parametros || [], respuesta.opciones || []);
        });
    };

    // ----------------------------------------------------------------------
    // Renderizado dinámico del DOM
    // ----------------------------------------------------------------------

    /**
     * Dibuja los <label> e <input> de una prueba compuesta usando exclusivamente
     * lo que devuelve SQLite.
     *
     * Se construye con nodos del DOM (no innerHTML) y un DocumentFragment: una
     * sola inserción en el contenedor, sin reparseo y sin riesgo de inyección
     *proveniente de los datos de la base.
     *
     * @param {HTMLElement} contenedor  nodo destino (por ejemplo el cuerpo del modal)
     * @param {string} examenId         clave foránea que se consulta
     * @param {Object} valores          { codigo: resultado } ya guardado
     * @param {Object} opciones         { prefijo, examenId, agrupar, grupoUnico, clasesFila,
     *                                    cabecera, unidades }
     * @returns {Promise<HTMLElement[]>} nodos creados
     */
    window.renderizarParametrosDesdeSQLite = function(contenedor, examenId, valores, opciones) {
        valores = valores || {};
        opciones = opciones || {};

        return window.obtenerParametrosDesdeSQLite(examenId).then(function(parametros) {
            if (!contenedor) return [];
            contenedor.textContent = '';
            if (parametros.length === 0) return [];

            // `orden_render` es el orden de aparición en pantalla definido en la
            // base de datos; `orden` conserva el orden natural de declaración.
            var ordenados = parametros.slice().sort(function(a, b) {
                return (a.ordenRender || 0) - (b.ordenRender || 0) || (a.orden || 0) - (b.orden || 0);
            });

            var prefijo = opciones.prefijo || 'paramItem_';
            var claveExamen = opciones.examenId || examenId;
            var agrupar = opciones.agrupar !== false;
            var conUnidades = opciones.unidades !== false;
            var fragmento = document.createDocumentFragment();
            var creado = [];

            function crearEntrada(parametro) {
                var columna = document.createElement('div');
                columna.className = 'col-md-4 col-sm-6';

                var etiqueta = document.createElement('label');
                etiqueta.className = 'form-label small fw-semibold mb-1';
                etiqueta.textContent = parametro.nombre;
                if (parametro.obligatorio) {
                    var asterisco = document.createElement('span');
                    asterisco.className = 'text-danger';
                    asterisco.textContent = '*';
                    etiqueta.appendChild(asterisco);
                }

                var esTexto = parametro.tipo === 'texto';
                var entrada = document.createElement('input');
                entrada.type = esTexto ? 'text' : 'number';
                if (!esTexto) entrada.step = '0.01';
                entrada.className = 'form-control form-control-sm tabla-item-input'
                    + (esTexto ? '' : ' item-input-numerico');
                entrada.id = prefijo + claveExamen + '_' + parametro.id;
                entrada.placeholder = '-';
                entrada.setAttribute('data-item-id', parametro.id);
                entrada.setAttribute('data-examen-id', claveExamen);
                entrada.value = valores[parametro.id] === undefined ? '' : valores[parametro.id];

                if (parametro.tipo === 'calculado') {
                    entrada.readOnly = true;
                    entrada.title = 'Valor calculado automáticamente';
                }

                columna.appendChild(etiqueta);
                columna.appendChild(entrada);

                var referencia = document.createElement('input');
                referencia.type = 'text';
                referencia.className = 'form-control form-control-sm referencia-item-input';
                referencia.setAttribute('data-item-id', parametro.id);
                referencia.placeholder = 'Referencia';
                referencia.value = valores.__referencias && valores.__referencias[parametro.id] !== undefined
                    ? valores.__referencias[parametro.id]
                    : referenciaPorDefecto(parametro);

                if (conUnidades) {
                    var unidad = document.createElement('span');
                    unidad.className = 'item-unidad';
                    unidad.textContent = parametro.unidad || '-';
                    var zona = document.createElement('span');
                    zona.className = 'item-referencia';
                    zona.appendChild(referencia);
                    columna.appendChild(unidad);
                    columna.appendChild(zona);
                } else {
                    var contenedorRef = document.createElement('div');
                    contenedorRef.className = 'mt-1';
                    contenedorRef.appendChild(referencia);
                    columna.appendChild(contenedorRef);
                }

                creado.push(columna);
                return columna;
            }

            if (opciones.cabecera) {
                var cabecera = document.createElement('div');
                cabecera.className = 'items-detallados-cabecera';
                ['Parámetro', 'Resultado', 'Unidad', 'Valores de Referencia'].forEach(function(texto) {
                    var celda = document.createElement('span');
                    celda.textContent = texto;
                    cabecera.appendChild(celda);
                });
                fragmento.appendChild(cabecera);
            }

            function crearFila() {
                var fila = document.createElement('div');
                fila.className = 'row g-3' + (opciones.clasesFila ? ' ' + opciones.clasesFila : '');
                return fila;
            }

            if (!agrupar) {
                var filaPlana = crearFila();
                ordenados.forEach(function(parametro) { filaPlana.appendChild(crearEntrada(parametro)); });
                fragmento.appendChild(filaPlana);
            } else {
                var porGrupo = new Map();
                ordenados.forEach(function(parametro) {
                    var grupo = opciones.grupoUnico || parametro.grupo || 'General';
                    if (!porGrupo.has(grupo)) porGrupo.set(grupo, []);
                    porGrupo.get(grupo).push(parametro);
                });

                Array.from(porGrupo.keys()).sort().forEach(function(grupo) {
                    var titulo = document.createElement('h6');
                    titulo.className = 'small fw-bold text-secondary mb-2 mt-3';
                    titulo.textContent = grupo;
                    fragmento.appendChild(titulo);

                    var fila = crearFila();
                    porGrupo.get(grupo).forEach(function(parametro) { fila.appendChild(crearEntrada(parametro)); });
                    fragmento.appendChild(fila);
                });
            }

            contenedor.appendChild(fragmento);
            return creado;
        });
    };

    function referenciaPorDefecto(parametro) {
        if (parametro.refTexto) return parametro.refTexto;
        if (parametro.refMin !== null && parametro.refMin !== undefined
            && parametro.refMax !== null && parametro.refMax !== undefined) {
            return parametro.refMin + ' - ' + parametro.refMax;
        }
        return '';
    }

    // ----------------------------------------------------------------------
    // Arranque
    // ----------------------------------------------------------------------

    window.App.catalogoDB = estado;
    window.catalogoListo = estado.cargando || (estado.cargando = cargarCatalogo());
    window.catalogoListo.catch(function() { /* ya registrado en cargarCatalogo */ });

    window.recargarCatalogoDesdeSQLite = function() {
        estado.parametrosPorExamen = Object.create(null);
        return cargarCatalogo();
    };

})();