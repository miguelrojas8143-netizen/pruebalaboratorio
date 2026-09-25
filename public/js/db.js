(function() {
    'use strict';

    var DB_NAME = 'MiroLabDB';
    var DB_VERSION = 2;
    var db = null;
    var dbReady = false;
    var readyPromise = null;

    function initDB() {
        if (dbReady && db) {
            return Promise.resolve(db);
        }
        if (readyPromise) return readyPromise;
        
        readyPromise = new Promise(function(resolve, reject) {
            if (typeof indexedDB === 'undefined' || !window.indexedDB) {
                var err = new Error('IndexedDB no disponible');
                readyPromise = null;
                console.error('[initDB]', err.message);
                reject(err);
                return;
            }

            var request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = function() {
                readyPromise = null;
                dbReady = false;
                db = null;
                var errMsg = request.error ? request.error.message || request.error.toString() : 'Error desconocido';
                console.error('[initDB] Error abriendo IndexedDB:', errMsg);
                reject(new Error(errMsg));
            };

            request.onsuccess = function() {
                db = request.result;
                dbReady = true;
                console.log('✅ IndexedDB conectada');
                resolve(db);
            };

            request.onblocked = function() {
                console.error('[initDB] Apertura de IndexedDB bloqueada: otra conexión existe con una versión mayor');
            };

            request.onupgradeneeded = function(event) {
                var database = event.target.result;
                
                if (!database.objectStoreNames.contains('pacientes')) {
                    var store = database.createObjectStore('pacientes', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('orden', 'orden', { unique: true });
                    store.createIndex('cedula', 'cedula', { unique: false });
                    store.createIndex('nombre', 'nombre', { unique: false });
                }

                if (!database.objectStoreNames.contains('catalogoCustom')) {
                    var storeCat = database.createObjectStore('catalogoCustom', { keyPath: 'id', autoIncrement: true });
                    storeCat.createIndex('nombre', 'nombre', { unique: false });
                }

                if (!database.objectStoreNames.contains('settings')) {
                    database.createObjectStore('settings', { keyPath: 'key' });
                }

                if (!database.objectStoreNames.contains('ordenes')) {
                    var storeOrdenes = database.createObjectStore('ordenes', { keyPath: 'id', autoIncrement: true });
                    storeOrdenes.createIndex('pacienteId', 'pacienteId', { unique: false });
                    storeOrdenes.createIndex('fecha', 'fecha', { unique: false });
                }

                console.log('📊 Estructura de base de datos creada');
            };
        });

        return readyPromise;
    }

    function requireDB() {
        return new Promise(function(resolve, reject) {
            if (dbReady && db) {
                resolve(db);
            } else {
                initDB().then(function() {
                    resolve(db);
                }).catch(reject);
            }
        });
    }

    // ============================================
    // FUNCIONES GENÉRICAS (Nuevas - para app.js)
    // ============================================

    function obtenerTodos(tabla) {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                if (!database.objectStoreNames.contains(tabla)) {
                    console.warn('[obtenerTodos] Tabla no existe:', tabla);
                    resolve([]);
                    return;
                }
                var tx = database.transaction([tabla], 'readonly');
                var store = tx.objectStore(tabla);
                var request = store.getAll();
                request.onsuccess = function() {
                    console.log('[obtenerTodos] ✅ Obtenidos', (request.result || []).length, 'registros de', tabla);
                    resolve(request.result || []);
                };
                request.onerror = function() {
                    console.error('[obtenerTodos] Error:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    function agregar(tabla, datos) {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction([tabla], 'readwrite');
                var store = tx.objectStore(tabla);
                var request = store.add(datos);
                request.onsuccess = function() {
                    console.log('[agregar] ✅ Guardado en', tabla, 'con ID:', request.result);
                    resolve(request.result);
                };
                request.onerror = function() {
                    console.error('[agregar] Error:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    function actualizar(tabla, datos) {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction([tabla], 'readwrite');
                var store = tx.objectStore(tabla);
                var request = store.put(datos);
                request.onsuccess = function() {
                    console.log('[actualizar] ✅ Actualizado en', tabla);
                    resolve(request.result);
                };
                request.onerror = function() {
                    console.error('[actualizar] Error:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    function eliminar(tabla, id) {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction([tabla], 'readwrite');
                var store = tx.objectStore(tabla);
                var request = store.delete(id);
                request.onsuccess = function() {
                    console.log('[eliminar] ✅ Eliminado de', tabla, 'ID:', id);
                    resolve();
                };
                request.onerror = function() {
                    console.error('[eliminar] Error:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    function buscarPor(tabla, indice, valor) {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                if (!database.objectStoreNames.contains(tabla)) {
                    resolve([]);
                    return;
                }
                var tx = database.transaction([tabla], 'readonly');
                var store = tx.objectStore(tabla);
                
                if (!store.indexNames.contains(indice)) {
                    console.warn('[buscarPor] Índice no existe:', indice, 'en tabla', tabla);
                    resolve([]);
                    return;
                }
                
                var index = store.index(indice);
                var request = index.getAll(valor);
                request.onsuccess = function() {
                    console.log('[buscarPor] ✅ Encontrados', (request.result || []).length, 'registros');
                    resolve(request.result || []);
                };
                request.onerror = function() {
                    console.error('[buscarPor] Error:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    // ============================================
    // FUNCIONES ESPECÍFICAS (Originales - mantener)
    // ============================================

    function obtenerPacientes() {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction(['pacientes'], 'readonly');
                var store = tx.objectStore('pacientes');
                var request = store.getAll();
                request.onsuccess = function() { resolve(request.result || []); };
                request.onerror = function() {
                    console.error('[obtenerPacientes] Error:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    function guardarPaciente(paciente) {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction(['pacientes'], 'readwrite');
                var store = tx.objectStore('pacientes');
                var request = store.put(paciente);
                request.onsuccess = function() { resolve(); };
                request.onerror = function() {
                    console.error('[guardarPaciente] Error:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    function guardarPacientes(pacientes) {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction(['pacientes'], 'readwrite');
                var store = tx.objectStore('pacientes');
                store.clear();
                pacientes.forEach(function(p) {
                    store.put(p);
                });
                tx.oncomplete = function() { resolve(); };
                tx.onerror = function() {
                    console.error('[guardarPacientes] Error:', tx.error);
                    reject(tx.error);
                };
            });
        });
    }

    function eliminarPaciente(id) {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction(['pacientes'], 'readwrite');
                var store = tx.objectStore('pacientes');
                var request = store.delete(id);
                request.onsuccess = function() { resolve(); };
                request.onerror = function() {
                    console.error('[eliminarPaciente] Error:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    function obtenerCatalogoCustom() {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction(['catalogoCustom'], 'readonly');
                var store = tx.objectStore('catalogoCustom');
                var request = store.getAll();
                request.onsuccess = function() { resolve(request.result || []); };
                request.onerror = function() {
                    console.error('[obtenerCatalogoCustom] Error:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    function guardarCatalogoCustom(custom) {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction(['catalogoCustom'], 'readwrite');
                var store = tx.objectStore('catalogoCustom');
                store.clear();
                custom.forEach(function(c) {
                    store.put(c);
                });
                tx.oncomplete = function() { resolve(); };
                tx.onerror = function() {
                    console.error('[guardarCatalogoCustom] Error:', tx.error);
                    reject(tx.error);
                };
            });
        });
    }

    function obtenerSetting(key) {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction(['settings'], 'readonly');
                var store = tx.objectStore('settings');
                var request = store.get(key);
                request.onsuccess = function() {
                    resolve(request.result ? request.result.value : null);
                };
                request.onerror = function() {
                    console.error('[obtenerSetting] Error:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    function guardarSetting(key, value) {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction(['settings'], 'readwrite');
                var store = tx.objectStore('settings');
                var request = store.put({ key: key, value: value });
                request.onsuccess = function() { resolve(); };
                request.onerror = function() {
                    console.error('[guardarSetting] Error:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    function eliminarSetting(key) {
        return requireDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction(['settings'], 'readwrite');
                var store = tx.objectStore('settings');
                var request = store.delete(key);
                request.onsuccess = function() { resolve(); };
                request.onerror = function() {
                    console.error('[eliminarSetting] Error:', request.error);
                    reject(request.error);
                };
            });
        });
    }

    function migrarDesdeLocalStorage() {
        return initDB().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx = database.transaction(['settings'], 'readonly');
                var settingsStore = tx.objectStore('settings');
                var request = settingsStore.get('dbMigrado');
                request.onsuccess = function() {
                    if (request.result && request.result.value === 'true') {
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                };
                request.onerror = function() {
                    console.error('[migrarDesdeLocalStorage] Error checking dbMigrado:', request.error);
                    resolve(true);
                };
            });
        }).then(function(necesitaMigracion) {
            if (!necesitaMigracion) {
                return false;
            }

            return new Promise(function(resolve, reject) {
                var tx = db.transaction(['pacientes', 'catalogoCustom', 'settings'], 'readwrite');
                var pacStore = tx.objectStore('pacientes');
                var catStore = tx.objectStore('catalogoCustom');
                var settingsStore = tx.objectStore('settings');

                var pacientesStr = localStorage.getItem('pacientesLab');
                if (pacientesStr) {
                    try {
                        var pacientes = JSON.parse(pacientesStr);
                        pacientes.forEach(function(p) {
                            pacStore.put(p);
                        });
                    } catch (e) {
                        console.error('[migrarDesdeLocalStorage] Error parsing pacientesLab:', e);
                    }
                }

                var customStr = localStorage.getItem('catalogoCustom');
                if (customStr) {
                    try {
                        var custom = JSON.parse(customStr);
                        custom.forEach(function(c) {
                            catStore.put(c);
                        });
                    } catch (e) {
                        console.error('[migrarDesdeLocalStorage] Error parsing catalogoCustom:', e);
                    }
                }

                var settingsKeys = ['ultimoOrdenLab', 'ultimaOrdenCreada', 'pacienteExistenteRefer'];
                settingsKeys.forEach(function(key) {
                    var val = localStorage.getItem(key);
                    if (val !== null) {
                        settingsStore.put({ key: key, value: val });
                    }
                });

                settingsStore.put({ key: 'dbMigrado', value: 'true' });

                tx.oncomplete = function() {
                    localStorage.removeItem('pacientesLab');
                    localStorage.removeItem('catalogoCustom');
                    localStorage.removeItem('ultimoOrdenLab');
                    localStorage.removeItem('ultimaOrdenCreada');
                    localStorage.removeItem('pacienteExistenteRefer');
                    localStorage.removeItem('dbMigrado');
                    console.log('✅ Migración desde localStorage completada');
                    resolve(true);
                };
                tx.onerror = function() {
                    console.error('[migrarDesdeLocalStorage] Error en transacción:', tx.error);
                    reject(tx.error);
                };
            });
        });
    }

    function limpiarDB() {
        return initDB().then(function() {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(['pacientes', 'catalogoCustom', 'ordenes', 'settings'], 'readwrite');
                tx.objectStore('pacientes').clear();
                tx.objectStore('catalogoCustom').clear();
                tx.objectStore('ordenes').clear();
                tx.objectStore('settings').clear();
                tx.oncomplete = function() { resolve(); };
                tx.onerror = function() {
                    console.error('[limpiarDB] Error:', tx.error);
                    reject(tx.error);
                };
            });
        });
    }

    // ============================================
    // EXPOSICIÓN GLOBAL
    // ============================================
    window.DB = {
        // Funciones genéricas (NUEVAS)
        init: initDB,
        isReady: function() { return dbReady; },
        obtenerTodos: obtenerTodos,
        agregar: agregar,
        actualizar: actualizar,
        eliminar: eliminar,
        buscarPor: buscarPor,
        
        // Funciones específicas (ORIGINALES)
        obtenerPacientes: obtenerPacientes,
        guardarPaciente: guardarPaciente,
        guardarPacientes: guardarPacientes,
        eliminarPaciente: eliminarPaciente,
        obtenerCatalogoCustom: obtenerCatalogoCustom,
        guardarCatalogoCustom: guardarCatalogoCustom,
        obtenerSetting: obtenerSetting,
        guardarSetting: guardarSetting,
        eliminarSetting: eliminarSetting,
        migrarDesdeLocalStorage: migrarDesdeLocalStorage,
        limpiarDB: limpiarDB
    };

    console.log(' Módulo DB cargado con funciones genéricas y específicas');
})();