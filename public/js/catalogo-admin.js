/**
 * Módulo para gestionar la administración del catálogo de exámenes
 */
(function() {
    'use strict';
// Sección de administración del catálogo de exámenes

    function mostrarToast(mensaje, tipo) {
        var container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            container.style.zIndex = '1080';
            document.body.appendChild(container);
        }
        var esError = tipo === 'danger';
        var toastClase = esError ? 'toast-danger-catalogo' : 'toast-success-catalogo';
        var icono = esError ? 'bi bi-x-circle' : 'bi bi-check-lg';
        var titulo = esError ? 'Error' : 'Guardado';
        var toastEl = document.createElement('div');
        toastEl.className = 'toast ' + toastClase + ' border-0';
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.innerHTML =
            '<div class="toast-header">' +
            '<i class="' + icono + ' me-2"></i>' +
            '<span class="me-auto small fw-medium">' + titulo + '</span>' +
            '<button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Cerrar"></button>' +
            '</div>' +
            '<div class="toast-body">' + mensaje + '</div>';
        container.appendChild(toastEl);
        var bsToast = new bootstrap.Toast(toastEl, { delay: 4500 });
        bsToast.show();
        toastEl.addEventListener('hidden.bs.toast', function() { toastEl.remove(); });
    }

    function actualizarTablaCatalogo() {
        var contenedor = document.getElementById('catalogoAcordeones');
        if (!contenedor) return;
        var catalogo = window.obtenerCatalogo().filter(function(e) {
            return e.tipo !== 'perfil' || window.esExamenNormalCompuesto(e.id);
        });
        var porArea = {};
        catalogo.forEach(function(examen) {
            var area = examen.area || 'General';
            if (!porArea[area]) porArea[area] = [];
            porArea[area].push(examen);
        });
        // Ordenar los exámenes dentro de cada área por nombre
        var areas = Object.keys(porArea).sort();
        contenedor.innerHTML = '';
        areas.forEach(function(area) {
            var examenes = porArea[area];
            examenes.sort(function(a, b) {
                return a.nombre.localeCompare(b.nombre);
            });
            var areaId = 'area-' + area.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            var item = document.createElement('div');
            item.className = 'accordion-item';
            item.innerHTML = '<h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#' + areaId + '">' + area + ' <span class="badge bg-secondary ms-2">' + examenes.length + '</span></button></h2><div id="' + areaId + '" class="accordion-collapse collapse"><div class="accordion-body p-0"><div class="table-responsive"><table class="table table-hover mb-0 align-middle"><thead class="table-light"><tr><th width="15%">ID</th><th width="18%">Nombre</th><th width="13%">Área</th><th width="13%">Unidad</th><th width="13%">Ref. Mín</th><th width="13%">Ref. Máx</th><th width="13%">Valor por Defecto</th><th width="10%" class="text-center">Guardar</th></tr></thead><tbody>' + examenes.map(function(examen) {
                return '<tr data-id="' + examen.id + '"><td>' + examen.id + '</td><td><input type="text" class="form-control form-control-sm cat-nombre" value="' + (examen.nombre || '') + '"></td><td><input type="text" class="form-control form-control-sm cat-area" value="' + (examen.area || '') + '"></td><td><input type="text" class="form-control form-control-sm cat-unidad" value="' + (examen.unidad || '') + '"></td><td><input type="number" step="0.01" class="form-control form-control-sm cat-refmin" value="' + (examen.refMin !== undefined ? examen.refMin : '') + '"></td><td><input type="number" step="0.01" class="form-control form-control-sm cat-refmax" value="' + (examen.refMax !== undefined ? examen.refMax : '') + '"></td><td><input type="text" class="form-control form-control-sm cat-valordefecto" value="' + (examen.valorDefecto || '') + '"></td><td class="text-center"><button class="btn btn-sm btn-success btn-guardar-examen" data-id="' + examen.id + '" title="Guardar este examen"><i class="bi bi-save"></i></button></td></tr>';
            }).join('') + '</tbody></table></div></div></div>';
            contenedor.appendChild(item);
        });
        // Agregar eventos a los botones de guardar
        contenedor.querySelectorAll('.btn-guardar-examen').forEach(function(btn) {
            btn.addEventListener('click', function() {
                try {
                    window.guardarExamenCatalogo(this.getAttribute('data-id'));
                } catch (err) {
                    console.error('[guardarExamenCatalogo]', err);
                }
            });
        });
        contenedor.querySelectorAll('tr[data-id]').forEach(function(tr) {
            var btn = tr.querySelector('.btn-guardar-examen');
            if (!btn) return;
            tr.querySelectorAll('.cat-nombre, .cat-area, .cat-unidad, .cat-refmin, .cat-refmax, .cat-valordefecto').forEach(function(input) {
                input.addEventListener('input', function() {
                    btn.classList.remove('guardado');
                    var icono = btn.querySelector('i');
                    if (icono) icono.className = 'bi bi-save';
                });
            });
        });
    }
// Función para guardar un examen en el catálogo
    window.guardarExamenCatalogo = function(id) {
        // Validar y guardar el examen con el ID proporcionado
        var fila = document.querySelector('#catalogoAcordeones tr[data-id="' + id + '"]');
        if (!fila) return;
        var nombre = fila.querySelector('.cat-nombre').value.trim();
        var area = fila.querySelector('.cat-area').value.trim();
        var unidad = fila.querySelector('.cat-unidad').value.trim();
        var refMin = fila.querySelector('.cat-refmin').value;
        var refMax = fila.querySelector('.cat-refmax').value;
        var valorDefecto = fila.querySelector('.cat-valordefecto').value.trim();
        if (!unidad) {
            alert('La unidad no puede estar vacía.');
            return;
        }
        var minNum = parseFloat(refMin);
        var maxNum = parseFloat(refMax);
        if (refMin !== '' && isNaN(minNum)) {
            alert('refMin debe ser un número para ' + nombre);
            return;
        }
        if (refMax !== '' && isNaN(maxNum)) {
            alert('refMax debe ser un número para ' + nombre);
            return;
        }
        var custom = window.obtenerCatalogoCustom();
        var existing = custom.findIndex(function(e) { return e.id === id; });
        var entry = { id: id, nombre: nombre, area: area, unidad: unidad };
        if (refMin !== '' && !isNaN(minNum)) entry.refMin = minNum;
        if (refMax !== '' && !isNaN(maxNum)) entry.refMax = maxNum;
        if (valorDefecto !== '') entry.valorDefecto = valorDefecto;
        if (existing !== -1) {
            custom[existing] = entry;
        } else {
            custom.push(entry);
        }
        window.guardarCatalogoCustom(custom);
        mostrarToast("Examen '" + nombre + "' guardado.", "success");
        fila.classList.add('fila-guardada');
        var btnGuardar = fila.querySelector('.btn-guardar-examen');
        if (btnGuardar) {
            btnGuardar.classList.add('guardado');
            var iconoGuardar = btnGuardar.querySelector('i');
            if (iconoGuardar) iconoGuardar.className = 'bi bi-check-lg';
        }
    };
// Función para restablecer el catálogo a los valores predeterminados
    window.initCatalogo = function() {
        actualizarTablaCatalogo();
        if (document.getElementById('tablaCatalogoPerfiles')) {
            var tbody = document.getElementById('tablaCatalogoPerfiles');
            tbody.innerHTML = '';
            Object.keys(window.App.perfiles).filter(function(key) {
                return !window.esExamenNormalCompuesto(key);
            }).forEach(function(key) {
                var perfil = window.App.perfiles[key];
                var fila = document.createElement('tr');
                var grupos = {};
                var ordenGrupos = [];
                perfil.examenes.forEach(function(e) {
                    var g = e.grupo || 'General';
                    if (!grupos[g]) { grupos[g] = []; ordenGrupos.push(g); }
                    grupos[g].push(e.nombre);
                });
                var examenesHtml = ordenGrupos.map(function(g) {
                    var titulo = g === 'General' ? '' : '<div class="fw-bold small text-secondary mb-1">' + g + '</div>';
                    return titulo + grupos[g].join(', ');
                }).join('<div class="py-1"></div>');
                fila.innerHTML = '<td>' + perfil.nombre + '</td><td>' + examenesHtml + '</td><td><span class="badge bg-secondary">' + perfil.examenes.length + ' exámenes</span></td>';
                tbody.appendChild(fila);
            });
        }
    };

    window.guardarCatalogo = function() {
        var filas = document.querySelectorAll('#catalogoAcordeones tbody tr[data-id]');
        var custom = [];
        var errores = [];
        filas.forEach(function(fila) {
            var id = fila.getAttribute('data-id');
            var nombre = fila.querySelector('.cat-nombre').value.trim();
            var area = fila.querySelector('.cat-area').value.trim();
            var unidad = fila.querySelector('.cat-unidad').value.trim();
            var refMin = fila.querySelector('.cat-refmin').value;
            var refMax = fila.querySelector('.cat-refmax').value;
            var valorDefecto = fila.querySelector('.cat-valordefecto').value.trim();
            if (!unidad) {
                errores.push('Examen "' + nombre + '" (' + id + '): La unidad no puede estar vacía.');
            }
            var minNum = parseFloat(refMin);
            var maxNum = parseFloat(refMax);
            if (refMin !== '' && isNaN(minNum)) {
                errores.push('Examen "' + nombre + '" (' + id + '): refMin debe ser un número.');
            }
            if (refMax !== '' && isNaN(maxNum)) {
                errores.push('Examen "' + nombre + '" (' + id + '): refMax debe ser un número.');
            }
            var entry = { id: id, nombre: nombre, area: area, unidad: unidad };
            if (refMin !== '' && !isNaN(minNum)) entry.refMin = minNum;
            if (refMax !== '' && !isNaN(maxNum)) entry.refMax = maxNum;
            if (valorDefecto !== '') entry.valorDefecto = valorDefecto;
            custom.push(entry);
        });
        if (errores.length > 0) {
            alert('Errores de validación:\n\n' + errores.join('\n'));
            return;
        }
        window.guardarCatalogoCustom(custom);
        window.refrescarSelect2Catalogos();
        actualizarTablaCatalogo();
        mostrarToast("Catálogo guardado exitosamente.", "success");
    };

    window.restablecerCatalogo = function() {
        if (!confirm('¿Restablecer todos los valores del catálogo a los predeterminados? Esta acción no se puede deshacer.')) return;
        window.guardarCatalogoCustom([]);
        actualizarTablaCatalogo();
    };

    window.toggleAllCatalogoSections = function(expand) {
        var collapses = document.querySelectorAll('#catalogoAcordeones .accordion-collapse');
        collapses.forEach(function(collapse) {
            var instance = bootstrap.Collapse.getInstance(collapse);
            if (!instance) {
                instance = new bootstrap.Collapse(collapse, { toggle: false });
            }
            if (expand) {
                instance.show();
            } else {
                instance.hide();
            }
        });
    };

    window.mostrarEstadisticas = function() {
        var pacientes = window.obtenerPacientes();
        document.getElementById('totalPacientesUnicos').textContent = pacientes.length;
        var totalVisitas = pacientes.reduce(function(sum, p) { return sum + (p.visitas || 1); }, 0);
        document.getElementById('totalVisitas').textContent = totalVisitas;
        var pacientesOrdenados = pacientes.slice().sort(function(a, b) { return (b.visitas || 1) - (a.visitas || 1); }).slice(0, 5);
        var html = '';
        pacientesOrdenados.forEach(function(p) {
            html += '<div class="d-flex justify-content-between border-bottom pb-2 mb-2"><span>' + p.nombre + '</span><span class="badge bg-primary">' + (p.visitas || 1) + ' visita(s)</span></div>';
        });
        document.getElementById('topPacientesVisitas').innerHTML = html || '<p class="text-muted">No hay datos</p>';
        new bootstrap.Modal(document.getElementById('modalEstadisticas')).show();
    };

})();

