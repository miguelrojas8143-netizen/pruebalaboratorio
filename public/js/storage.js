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
                    window.DB.obtenerPacientes(),
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

    function obtenerOrdenDiaria() {
        try {
            var pacientes = window.obtenerPacientes ? window.obtenerPacientes() : [];
            var maxOrden = 0;
            pacientes.forEach(function(p) {
                var num = parseInt(p.orden, 10);
                if (!isNaN(num) && num > maxOrden) {
                    maxOrden = num;
                }
            });
            var nuevoOrden = maxOrden + 1;
            _cache.ultimoOrdenLab = nuevoOrden;
            if (_cache.listo && window.DB) {
                window.DB.guardarSetting('ultimoOrdenLab', String(nuevoOrden)).catch(function(e) {
                    console.error('[storage] Error guardando ultimoOrdenLab:', e);
                });
            }
            return String(nuevoOrden).padStart(3, '0');
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

    function archivarOrdenAnterior(paciente) {
        if (!paciente) return;
        var tieneExamenes = paciente.examenes && paciente.examenes.length > 0;
        var tieneHistorialResultados = false;
        if (paciente.examenes && paciente.examenes.length > 0) {
            tieneHistorialResultados = paciente.examenes.some(function(e) {
                if (e.tipoFormulario === 'heces' || e.tipoFormulario === 'uroanalisis' || e.tipoFormulario === 'antibiograma' || e.tipo === 'multiselect_cantidad') {
                    try {
                        var datos = JSON.parse(e.resultado || '{}');
                        return Object.keys(datos).length > 0 && Object.values(datos).some(function(v) { return v !== ''; });
                    } catch (err) { return false; }
                }
                return String(e.resultado || '').trim() !== '';
            });
        }
        if (!tieneExamenes && !tieneHistorialResultados) return;
        if (!paciente.ordenesPrevias) {
            paciente.ordenesPrevias = [];
        }
        paciente.ordenesPrevias.push({
            orden: String(paciente.orden || '').padStart(3, '0'),
            fecha: paciente.fechaRegistro || new Date().toLocaleDateString('es-ES'),
            examenes: JSON.parse(JSON.stringify(paciente.examenes || [])),
            refAdaptadas: !!paciente.refAdaptadas,
            perfiles: paciente.perfiles ? paciente.perfiles.slice() : [],
            historial: paciente.historial ? JSON.parse(JSON.stringify(paciente.historial || [])) : []
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
    window.obtenerCatalogoCustom = obtenerCatalogoCustom;
    window.guardarCatalogoCustom = guardarCatalogoCustom;
    window.obtenerPacienteExistenteRefer = obtenerPacienteExistenteRefer;
    window.guardarPacienteExistenteRefer = guardarPacienteExistenteRefer;
    window.obtenerUltimaOrdenCreada = obtenerUltimaOrdenCreada;
    window.guardarUltimaOrdenCreada = guardarUltimaOrdenCreada;

})();
