(function() {
    'use strict';

    var _cache = {
        pacientes: [],
        catalogoCustom: [],
        ultimoOrdenLab: 0,
        ultimaOrdenCreada: null,
        pacienteExistenteRefer: null,
        listo: false
    };

    var _callbacks = [];

    function _marcarListo() {
        _cache.listo = true;
        var callbacks = _callbacks;
        _callbacks = [];
        callbacks.forEach(function(cb) {
            try { cb(); } catch (e) { console.error('[onStorageReady] Error en callback:', e); }
        });
    }

    function initStorage() {
        return _initDBAsync();
    }

    function _initDBAsync() {
        if (!window.DB || typeof window.DB.init !== 'function') {
            console.warn('[storage] DB no disponible, usando caché vacía');
            return Promise.resolve();
        }

        return window.DB.init()
            .then(function() {
                return window.DB.migrarDesdeLocalStorage();
            })
            .then(function() {
                return Promise.all([
                    window.DB.obtenerPacientes(1000, 0).then(function(r) {
                        return (r && r.pacientes) ? r.pacientes : (r || []);
                    }),
                    window.DB.obtenerCatalogoCustom(),
                    window.DB.obtenerSetting('ultimoOrdenLab'),
                    window.DB.obtenerSetting('ultimaOrdenCreada'),
                    window.DB.obtenerSetting('pacienteExistenteRefer')
                ]);
            })
            .then(function(results) {
                _cache.pacientes = results[0] || [];
                _cache.catalogoCustom = results[1] || [];
                if (results[2] !== null && results[2] !== undefined) {
                    _cache.ultimoOrdenLab = parseInt(results[2]) || 0;
                }
                _cache.ultimaOrdenCreada = results[3];
                _cache.pacienteExistenteRefer = results[4];
                _marcarListo();
            })
            .catch(function(e) {
                console.error('[storage] Error inicializando IndexedDB:', e);
                _cache.listo = false;
            });
    }

    if (window.DB && typeof window.DB.init === 'function') {
        initStorage();
    }

    function esStorageListo() {
        return _cache.listo;
    }

    function onStorageReady(callback) {
        if (_cache.listo) {
            callback();
        } else {
            _callbacks.push(callback);
        }
    }

    function _emitirCambioCatalogo() {
        try {
            window.dispatchEvent(new CustomEvent('catalogoCustomChange'));
        } catch (e) {
            console.error('[storage] Error dispatching catalogoCustomChange:', e);
        }
    }

    function calcularProximaOrden() {
        var pacientes = window.obtenerPacientes ? window.obtenerPacientes() : [];
        var maxOrden = 0;
        function considerar(n) {
            var v = parseInt(n, 10);
            if (!isNaN(v) && v > maxOrden) {
                maxOrden = v;
            }
        }
        considerar(_cache.ultimoOrdenLab);
        pacientes.forEach(function(p) {
            considerar(p.orden);
            (p.ordenesPrevias || []).forEach(function(o) {
                considerar(o.orden);
            });
        });
        return String(maxOrden + 1).padStart(3, '0');
    }

    function obtenerOrdenDiaria() {
        try {
            var nuevoOrdenStr = calcularProximaOrden();
            var nuevoOrden = parseInt(nuevoOrdenStr, 10);
            _cache.ultimoOrdenLab = nuevoOrden;
            if (_cache.listo && window.DB) {
                window.DB.guardarSetting('ultimoOrdenLab', String(nuevoOrden)).catch(function(e) {
                    console.error('[storage] Error guardando ultimoOrdenLab:', e);
                });
            }
            return nuevoOrdenStr;
        } catch (e) {
            console.error('[obtenerOrdenDiaria] Error:', e);
            return String(Date.now() % 1000).padStart(3, '0');
        }
    }

    function obtenerCatalogo() {
        try {
            var base = JSON.parse(JSON.stringify(window.App.catalogo || []));
            var custom = _cache.catalogoCustom;
            var customMap = {};
            custom.forEach(function(e) { customMap[e.id] = e; });
            return base.map(function(e) {
                var override = customMap[e.id];
                if (!override) return e;
                var merged = Object.assign({}, e, override, { id: e.id });
                if (!merged.unidad) merged.unidad = e.unidad || '';
                if (!merged.refTexto) merged.refTexto = e.refTexto || '';
                if (e.area === 'Bacteriología' && (!merged.unidad || merged.unidad === 'N/A')) {
                    merged.unidad = e.unidad || merged.unidad;
                }
                if (e.area === 'Bacteriología' &&
                    (!merged.refTexto || merged.refTexto === 'Según criterio del bioquímico')) {
                    merged.refTexto = e.refTexto || merged.refTexto;
                }
                if (merged.refMin === undefined && e.refMin !== undefined) merged.refMin = e.refMin;
                if (merged.refMax === undefined && e.refMax !== undefined) merged.refMax = e.refMax;
                return merged;
            });
        } catch (e) {
            return JSON.parse(JSON.stringify(window.App.catalogo || []));
        }
    }

    function obtenerPacientes() {
        return _cache.pacientes.slice();
    }

    function guardarPacientes(pacientes) {
        _cache.pacientes = pacientes.slice();
        if (_cache.listo && window.DB) {
            return window.DB.guardarPacientes(pacientes).catch(function(e) {
                console.error('[storage] Error guardando pacientes:', e);
                throw e;
            });
        }
        return Promise.resolve();
    }

    function obtenerUltimaOrden() {
        return _cache.ultimoOrdenLab;
    }

    function guardarUltimaOrden(numero) {
        _cache.ultimoOrdenLab = parseInt(numero) || 0;
        if (_cache.listo && window.DB) {
            window.DB.guardarSetting('ultimoOrdenLab', String(numero)).catch(function(e) {
                console.error('[storage] Error guardando ultimaOrdenLab:', e);
            });
        }
    }

    function obtenerCatalogoCustom() {
        return _cache.catalogoCustom.slice();
    }

    function guardarCatalogoCustom(custom) {
        _cache.catalogoCustom = custom.slice();
        if (_cache.listo && window.DB) {
            window.DB.guardarCatalogoCustom(custom).catch(function(e) {
                console.error('[storage] Error guardando catalogoCustom:', e);
            });
        }
        _emitirCambioCatalogo();
    }

    function obtenerPacienteExistenteRefer() {
        return _cache.pacienteExistenteRefer;
    }

    function guardarPacienteExistenteRefer(data) {
        var json = data !== null ? JSON.stringify(data) : null;
        _cache.pacienteExistenteRefer = json;
        if (_cache.listo && window.DB) {
            window.DB.guardarSetting('pacienteExistenteRefer', json).catch(function(e) {
                console.error('[storage] Error guardando pacienteExistenteRefer:', e);
            });
        }
    }

    function obtenerUltimaOrdenCreada() {
        return _cache.ultimaOrdenCreada;
    }

    function guardarUltimaOrdenCreada(orden) {
        _cache.ultimaOrdenCreada = orden;
        if (_cache.listo && window.DB) {
            window.DB.guardarSetting('ultimaOrdenCreada', orden).catch(function(e) {
                console.error('[storage] Error guardando ultimaOrdenCreada:', e);
            });
        }
    }

    function tieneResultadosEnExamenes(examenes) {
        if (!examenes || examenes.length === 0) return false;
        return examenes.some(function(e) {
            if (e.tipoFormulario === 'heces' || e.tipoFormulario === 'uroanalisis' || e.tipoFormulario === 'antibiograma' || e.tipo === 'multiselect_cantidad') {
                try {
                    var datos = JSON.parse(e.resultado || '{}');
                    return Object.keys(datos).length > 0 && Object.values(datos).some(function(v) { return v !== ''; });
                } catch (err) { return false; }
            }
            return String(e.resultado || '').trim() !== '';
        });
    }

    function archivarOrdenAnterior(paciente) {
        if (!paciente) return;
        if (!paciente.ordenesPrevias) {
            paciente.ordenesPrevias = [];
        }
        if (paciente.ordenesPrevias.length > 0 &&
            paciente.ordenesPrevias[paciente.ordenesPrevias.length - 1].orden === String(paciente.orden || '').padStart(3, '0')) {
            return;
        }
        paciente.ordenesPrevias.push({
            orden: String(paciente.orden || '').padStart(3, '0'),
            fecha: paciente.fechaRegistro || new Date().toLocaleDateString('es-ES'),
            examenes: JSON.parse(JSON.stringify(paciente.examenes || [])),
            refAdaptadas: !!paciente.refAdaptadas,
            perfiles: paciente.perfiles ? paciente.perfiles.slice() : [],
            historial: paciente.historial ? JSON.parse(JSON.stringify(paciente.historial || [])) : [],
            estado: 'archivada'
        });
    }

    // MIGRADO A SQLITE: crearNuevaVisita usa window.api.crearNuevaVisita() IPC
    // Línea ~255 (antes): window.obtenerPacientes() + window.guardarPacientes() — IndexedDB
    // Ahora: window.api.crearNuevaVisita() — SQLite (archiva orden + crea nueva)
    function crearNuevaVisita(pacienteId, opciones) {
        return new Promise(function(resolve) {
            opciones = opciones || {};

            // Buscar el paciente en la caché local (para mostrar confirmación)
            var pacientesCache = window.obtenerPacientes ? window.obtenerPacientes() : [];
            var pacienteCache = pacientesCache.find(function(p) {
                return String(p.id) === String(pacienteId);
            });

            // Si no está en caché pero actualizarPaciente está activo, buscar por cédula
            if (!pacienteCache && opciones.actualizarPaciente) {
                var refer = window.obtenerPacienteExistenteRefer();
                var datos = refer ? JSON.parse(refer) : null;
                if (datos && datos.cedula) {
                    pacienteCache = pacientesCache.find(function(p) { return p.cedula === datos.cedula; });
                }
            }

            // LÍNEA ~278: Confirmación obligatoria — ¿asignar nueva orden a este paciente?
            var nombrePac = pacienteCache ? pacienteCache.nombre : 'este paciente';
            var ordenActual = pacienteCache ? String(pacienteCache.orden || '').padStart(3, '0') : '?';
            var msgConfirmacion = '¿Desea asignar una nueva orden a ' + nombrePac + '?\n' +
                'La orden actual #' + ordenActual + ' será archivada y pasará al historial del paciente.\n\n' +
                '¿Continuar? (No / Sí)';

            // Usar confirmación personalizada con botones "No" / "Sí"
            var confirmPromise = window.confirmar ?
                window.confirmar(msgConfirmacion) :
                Promise.resolve(confirm(msgConfirmacion));

            confirmPromise.then(function(proceed) {
                if (!proceed) {
                    resolve(null);
                    return;
                }

                // Confirmar si el paciente tiene resultados (confirmación adicional)
                if (pacienteCache && window.tieneResultadosEnExamenes(pacienteCache.examenes)) {
                    var ordenAnterior = String(pacienteCache.orden || '').padStart(3, '0');
                    var examenesConResultados = (pacienteCache.examenes || []).filter(function(e) {
                        return window.tieneResultadosEnExamenes([e]);
                    });
                    var nuevoTemp = calcularProximaOrden();
                    var msg = 'La orden #' + ordenAnterior + ' tiene ' + examenesConResultados.length +
                        ' examen(es) con resultados.\n\n' +
                        'Al continuar pasará al Historial del paciente y se generará una nueva orden #' + nuevoTemp + '.\n\n' +
                        '¿Desea continuar?';
                    if (!confirm(msg)) {
                        resolve(null);
                        return;
                    }
                }

                // Llamar al handler SQLite IPC que archiva la orden y crea la nueva
                var data = { pacienteId: pacienteId };
                if (!pacienteCache && opciones.actualizarPaciente) {
                    var refDatos = window.obtenerPacienteExistenteRefer();
                    var datosActualizar = refDatos ? JSON.parse(refDatos) : null;
                    if (datosActualizar && datosActualizar.cedula) {
                        data = { cedula: datosActualizar.cedula };
                    }
                }

                window.api.crearNuevaVisita(data).then(function(result) {
                    if (!result.success) {
                        alert('Error al crear nueva orden: ' + result.error);
                        resolve(null);
                        return;
                    }

                    var nuevaOrden = result.nuevaOrden;
                    var pacienteNuevo = result.paciente;

                    // Actualizar referencias locales
                    window.guardarUltimaOrdenCreada(nuevaOrden);

                    // Refrescar UI si las funciones están disponibles
                    if (typeof window.renderizarCola === 'function') {
                        window.renderizarCola();
                    }
                    if (typeof window.renderizarMetricas === 'function') {
                        window.renderizarMetricas();
                    }

                    if (opciones.actualizarPaciente) {
                        window.guardarPacienteExistenteRefer(null);
                    }

                    if (opciones.limpiarBuscador) {
                        var b = document.getElementById('buscadorGlobal');
                        if (b) b.value = '';
                        var r = document.getElementById('resultadosBusqueda');
                        if (r) r.style.display = 'none';
                        var l = document.getElementById('listaResultadosBusqueda');
                        if (l) l.innerHTML = '';
                    }

                    if (opciones.navegar) {
                        var enVistas = window.location.pathname.indexOf('/vistas/') !== -1;
                        var prefijo = enVistas ? '' : 'vistas/';
                        window.location.href = prefijo + 'orden.html?orden=' + nuevaOrden;
                    }

                    resolve(nuevaOrden);
                }).catch(function(e) {
                    console.error('[crearNuevaVisita] Error:', e);
                    alert('No se pudo crear la nueva orden. Intente nuevamente.');
                    resolve(null);
                });
            });
        });
    }

    window.initStorage = initStorage;
    window.esStorageListo = esStorageListo;
    window.onStorageReady = onStorageReady;
    window.obtenerOrdenDiaria = obtenerOrdenDiaria;
    window.obtenerCatalogo = obtenerCatalogo;
    window.obtenerPacientes = obtenerPacientes;
    window.guardarPacientes = guardarPacientes;
    window.obtenerUltimaOrden = obtenerUltimaOrden;
    window.guardarUltimaOrden = guardarUltimaOrden;
    window.archivarOrdenAnterior = archivarOrdenAnterior;
    window.tieneResultadosEnExamenes = tieneResultadosEnExamenes;
    window.crearNuevaVisita = crearNuevaVisita;
    window.obtenerCatalogoCustom = obtenerCatalogoCustom;
    window.guardarCatalogoCustom = guardarCatalogoCustom;
    window.obtenerPacienteExistenteRefer = obtenerPacienteExistenteRefer;
    window.guardarPacienteExistenteRefer = guardarPacienteExistenteRefer;
    window.obtenerUltimaOrdenCreada = obtenerUltimaOrdenCreada;
    window.guardarUltimaOrdenCreada = guardarUltimaOrdenCreada;

})();
