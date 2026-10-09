/**
 * Administración del catálogo persistido en SQLite.
 */
(function() {
    'use strict';

    var examenes = [];
    var categorias = [];
    var categoriaActiva = '';
    var examenEditando = null;
    var modal = null;

    function elemento(id) {
        return document.getElementById(id);
    }

    function mostrarToast(mensaje, tipo) {
        var container = elemento('toastContainer');
        if (!container) return;
        var esError = tipo === 'danger';
        var toastEl = document.createElement('div');
        toastEl.className = 'toast ' + (esError ? 'toast-danger-catalogo' : 'toast-success-catalogo') + ' border-0';
        toastEl.setAttribute('role', 'status');
        toastEl.setAttribute('aria-live', esError ? 'assertive' : 'polite');
        toastEl.setAttribute('aria-atomic', 'true');

        var header = document.createElement('div');
        header.className = 'toast-header';
        var icono = document.createElement('i');
        icono.className = (esError ? 'bi bi-x-circle' : 'bi bi-check-lg') + ' me-2';
        header.appendChild(icono);
        var titulo = document.createElement('span');
        titulo.className = 'me-auto small fw-medium';
        titulo.textContent = esError ? 'Error' : 'Catálogo actualizado';
        header.appendChild(titulo);
        var cerrar = document.createElement('button');
        cerrar.type = 'button';
        cerrar.className = 'btn-close';
        cerrar.setAttribute('data-bs-dismiss', 'toast');
        cerrar.setAttribute('aria-label', 'Cerrar');
        header.appendChild(cerrar);

        var body = document.createElement('div');
        body.className = 'toast-body';
        body.textContent = mensaje;
        toastEl.appendChild(header);
        toastEl.appendChild(body);
        container.appendChild(toastEl);
        var bsToast = new bootstrap.Toast(toastEl, { delay: 4500 });
        bsToast.show();
        toastEl.addEventListener('hidden.bs.toast', function() { toastEl.remove(); });
    }

    function crearCelda(texto, clase) {
        var celda = document.createElement('td');
        if (clase) celda.className = clase;
        celda.textContent = texto === undefined || texto === null ? '' : String(texto);
        return celda;
    }

    function crearBoton(icono, titulo, clase, accion, id) {
        var boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'btn btn-sm catalogo-action ' + clase;
        boton.title = titulo;
        boton.setAttribute('aria-label', titulo);
        boton.setAttribute('data-action', accion);
        boton.setAttribute('data-id', id);
        var icon = document.createElement('i');
        icon.className = icono;
        boton.appendChild(icon);
        return boton;
    }

    function referenciaDe(examen) {
        if (examen.ref_texto) return examen.ref_texto;
        if (examen.refTexto) return examen.refTexto;
        var min = examen.ref_min !== undefined ? examen.ref_min : examen.refMin;
        var max = examen.ref_max !== undefined ? examen.ref_max : examen.refMax;
        if (min !== null && min !== undefined && max !== null && max !== undefined) {
            return min + ' - ' + max;
        }
        if (min !== null && min !== undefined) return '≥ ' + min;
        if (max !== null && max !== undefined) return '≤ ' + max;
        return '-';
    }

    function tipoDe(examen) {
        if (examen.tipo_formulario) return examen.tipo_formulario;
        if (examen.tipoFormulario) return examen.tipoFormulario;
        return examen.tipo || 'numerico';
    }

    function tipoLegible(tipo) {
        var nombres = {
            numerico: 'Cuantitativo',
            texto: 'Cualitativo',
            uroanalisis: 'Uroanálisis',
            heces: 'Coproanálisis',
            antibiograma: 'Antibiograma',
            perfil: 'Perfil'
        };
        return nombres[tipo] || tipo;
    }

    function filtrarExamenes() {
        var termino = (elemento('buscarExamenCatalogo').value || '').trim().toLocaleLowerCase();
        return examenes.filter(function(examen) {
            var coincideCategoria = !categoriaActiva || examen.categoria === categoriaActiva;
            var texto = [examen.id, examen.nombre, examen.categoria, examen.unidad, tipoDe(examen)]
                .join(' ').toLocaleLowerCase();
            return coincideCategoria && (!termino || texto.indexOf(termino) !== -1);
        });
    }

    function renderizarCategorias() {
        var nav = elemento('catalogoCategorias');
        var lista = elemento('catalogoCategoriasLista');
        nav.textContent = '';
        lista.textContent = '';
        var conteos = Object.create(null);
        examenes.forEach(function(examen) {
            conteos[examen.categoria] = (conteos[examen.categoria] || 0) + 1;
        });

        function agregarFiltro(nombre, cantidad) {
            var boton = document.createElement('button');
            boton.type = 'button';
            boton.className = 'catalogo-filtro' + (categoriaActiva === nombre ? ' active' : '');
            boton.setAttribute('aria-pressed', categoriaActiva === nombre ? 'true' : 'false');
            boton.setAttribute('data-categoria', nombre);
            var titulo = document.createElement('span');
            titulo.textContent = nombre || 'Todas';
            var count = document.createElement('span');
            count.className = 'badge-count';
            count.textContent = String(cantidad);
            boton.appendChild(titulo);
            boton.appendChild(count);
            nav.appendChild(boton);
        }

        agregarFiltro('', examenes.length);
        categorias.forEach(function(categoria) {
            var cantidad = conteos[categoria.nombre] || 0;
            agregarFiltro(categoria.nombre, cantidad);
            var opcion = document.createElement('option');
            opcion.value = categoria.nombre;
            lista.appendChild(opcion);
        });
    }

    function slugify(texto) {
        return String(texto).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function agruparPorCategoria(examenesFiltrados) {
        var grupos = {};
        var orden = [];
        examenesFiltrados.forEach(function(examen) {
            var cat = examen.categoria || 'Sin categoría';
            if (!grupos[cat]) {
                grupos[cat] = [];
                orden.push(cat);
            }
            grupos[cat].push(examen);
        });
        return { grupos: grupos, orden: orden };
    }

    function crearTarjetaExamen(examen) {
        var card = document.createElement('div');
        card.className = 'catalogo-examen-card';
        card.setAttribute('data-id', examen.id);

        var info = document.createElement('div');
        info.className = 'catalogo-examen-info';

        var codeSpan = document.createElement('span');
        codeSpan.className = 'catalogo-code';
        codeSpan.textContent = examen.id;
        info.appendChild(codeSpan);

        var nombreSpan = document.createElement('span');
        nombreSpan.className = 'catalogo-nombre';
        nombreSpan.textContent = examen.nombre;
        info.appendChild(nombreSpan);

        var tipoValor = tipoDe(examen);
        var tipoBadge = document.createElement('span');
        tipoBadge.className = 'catalogo-type' + (tipoValor === 'texto' || tipoValor === 'heces' ? ' texto' : '');
        tipoBadge.textContent = tipoLegible(tipoValor);
        info.appendChild(tipoBadge);

        if (examen.unidad) {
            var unidadSpan = document.createElement('span');
            unidadSpan.className = 'catalogo-unidad';
            unidadSpan.textContent = examen.unidad;
            info.appendChild(unidadSpan);
        }

        var refSpan = document.createElement('span');
        refSpan.className = 'catalogo-ref';
        refSpan.textContent = referenciaDe(examen);
        info.appendChild(refSpan);

        var estadoLabel = document.createElement('span');
        estadoLabel.className = 'catalogo-status' + (examen.activo ? ' activo' : '');
        estadoLabel.textContent = examen.activo ? 'Activo' : 'Inactivo';
        info.appendChild(estadoLabel);

        card.appendChild(info);

        var botones = document.createElement('div');
        botones.className = 'catalogo-examen-botones';
        botones.appendChild(crearBoton('bi bi-pencil', 'Editar examen', 'btn-warning', 'editar', examen.id));
        botones.appendChild(crearBoton(
            examen.activo ? 'bi bi-toggle-on' : 'bi bi-toggle-off',
            examen.activo ? 'Desactivar examen' : 'Activar examen',
            examen.activo ? 'btn-success' : 'btn-secondary',
            'estado',
            examen.id
        ));
        if (examen.activo) {
            botones.appendChild(crearBoton('bi bi-trash', 'Eliminar del catálogo', 'btn-danger', 'eliminar', examen.id));
        }
        card.appendChild(botones);

        return card;
    }

    function renderizarAcordeon() {
        var contenedor = elemento('catalogoAcordeones');
        contenedor.textContent = '';
        var filtrados = filtrarExamenes().sort(function(a, b) {
            return a.nombre.localeCompare(b.nombre, 'es');
        });
        elemento('contadorExamenesCatalogo').textContent =
            filtrados.length + (filtrados.length === 1 ? ' examen' : ' exámenes');

        if (filtrados.length === 0) {
            var vacio = document.createElement('div');
            vacio.className = 'catalogo-vacio';
            vacio.textContent = 'No se encontraron exámenes para este filtro.';
            contenedor.appendChild(vacio);
            return;
        }

        var agrupados = agruparPorCategoria(filtrados);

        agrupados.orden.forEach(function(categoria) {
            var examenesCat = agrupados.grupos[categoria];
            var slug = slugify(categoria);

            var item = document.createElement('div');
            item.className = 'accordion-item catalogo-acordeon-item';

            var header = document.createElement('h2');
            header.className = 'accordion-header';
            header.id = 'heading-' + slug;

            var botonHeader = document.createElement('button');
            botonHeader.className = 'accordion-button catalogo-acordeon-toggle';
            botonHeader.type = 'button';
            botonHeader.setAttribute('data-bs-toggle', 'collapse');
            botonHeader.setAttribute('data-bs-target', '#collapse-' + slug);
            botonHeader.setAttribute('aria-expanded', 'true');
            botonHeader.setAttribute('aria-controls', 'collapse-' + slug);

            var tituloSpan = document.createElement('span');
            tituloSpan.className = 'catalogo-categoria-titulo';
            tituloSpan.textContent = categoria;
            botonHeader.appendChild(tituloSpan);

            var badge = document.createElement('span');
            badge.className = 'badge bg-primary catalogo-acordeon-badge';
            badge.textContent = String(examenesCat.length);
            botonHeader.appendChild(badge);

            header.appendChild(botonHeader);
            item.appendChild(header);

            var collapse = document.createElement('div');
            collapse.id = 'collapse-' + slug;
            collapse.className = 'accordion-collapse collapse show';
            collapse.setAttribute('aria-labelledby', 'heading-' + slug);

            var body = document.createElement('div');
            body.className = 'accordion-body catalogo-acordeon-body';

            examenesCat.forEach(function(examen) {
                body.appendChild(crearTarjetaExamen(examen));
            });

            collapse.appendChild(body);
            item.appendChild(collapse);
            contenedor.appendChild(item);
        });
    }

    function renderizarPerfiles() {
        var tbody = elemento('tablaCatalogoPerfiles');
        tbody.textContent = '';
        var perfiles = Object.keys(window.App.perfiles || {}).map(function(key) {
            return window.App.perfiles[key];
        }).filter(function(perfil) {
            return !window.esExamenNormalCompuesto(perfil.id);
        }).sort(function(a, b) {
            return a.nombre.localeCompare(b.nombre, 'es');
        });

        if (perfiles.length === 0) {
            var vacio = document.createElement('tr');
            var mensaje = crearCelda('No hay perfiles configurados.', 'text-center text-muted py-4');
            mensaje.colSpan = 3;
            vacio.appendChild(mensaje);
            tbody.appendChild(vacio);
            return;
        }

        perfiles.forEach(function(perfil) {
            var fila = document.createElement('tr');
            fila.appendChild(crearCelda(perfil.nombre));
            var examenesCell = document.createElement('td');
            var grupos = Object.create(null);
            (perfil.examenes || []).forEach(function(examen) {
                var grupo = examen.grupo || 'General';
                if (!grupos[grupo]) grupos[grupo] = [];
                grupos[grupo].push(examen.nombre);
            });
            Object.keys(grupos).forEach(function(grupo) {
                if (grupo !== 'General') {
                    var titulo = document.createElement('strong');
                    titulo.className = 'd-block small text-secondary mt-1';
                    titulo.textContent = grupo;
                    examenesCell.appendChild(titulo);
                }
                var texto = document.createElement('span');
                texto.textContent = grupos[grupo].join(', ');
                examenesCell.appendChild(texto);
            });
            fila.appendChild(examenesCell);
            var count = document.createElement('td');
            count.className = 'text-center';
            var badge = document.createElement('span');
            badge.className = 'catalogo-perfil-count';
            var total = (perfil.examenes || []).length;
            badge.textContent = total + (total === 1 ? ' examen' : ' exámenes');
            count.appendChild(badge);
            fila.appendChild(count);
            tbody.appendChild(fila);
        });
    }

    function renderizar() {
        renderizarCategorias();
        renderizarAcordeon();
        renderizarPerfiles();
    }

    function informarError(mensaje) {
        var error = elemento('catalogoFormularioError');
        error.textContent = mensaje;
        error.classList.remove('d-none');
    }

    function limpiarError() {
        var error = elemento('catalogoFormularioError');
        error.textContent = '';
        error.classList.add('d-none');
    }

    function mostrarErrorCarga(mensaje) {
        var contenedor = elemento('catalogoAcordeones');
        contenedor.textContent = '';
        var vacio = document.createElement('div');
        vacio.className = 'catalogo-vacio text-danger';
        vacio.textContent = mensaje;
        contenedor.appendChild(vacio);
    }

    function abrirFormulario(examen) {
        examenEditando = examen || null;
        limpiarError();
        elemento('modalExamenTitulo').textContent = examen ? 'Editar examen' : 'Nuevo examen';
        elemento('btnGuardarExamenCatalogo').innerHTML = '<i class="bi bi-save me-1"></i>Guardar examen';

        var id = elemento('catalogoId');
        id.value = examen ? examen.id : '';
        id.readOnly = !!examen;
        elemento('catalogoNombre').value = examen ? examen.nombre : '';
        elemento('catalogoCategoria').value = examen ? examen.categoria : categoriaActiva;
        elemento('catalogoUnidad').value = examen ? (examen.unidad || '') : '';
        elemento('catalogoRefMin').value = examen && examen.ref_min !== null && examen.ref_min !== undefined
            ? examen.ref_min : (examen && examen.refMin !== undefined && examen.refMin !== null ? examen.refMin : '');
        elemento('catalogoRefMax').value = examen && examen.ref_max !== null && examen.ref_max !== undefined
            ? examen.ref_max : (examen && examen.refMax !== undefined && examen.refMax !== null ? examen.refMax : '');
        elemento('catalogoRefTexto').value = examen ? (examen.ref_texto || examen.refTexto || '') : '';
        elemento('catalogoValorDefecto').value = examen ? (examen.valor_defecto || examen.valorDefecto || '') : '';

        var tipoEspecial = elemento('catalogoTipoEspecial');
        var selectTipo = elemento('catalogoTipo');
        var tipoActual = examen ? (examen.tipo || 'numerico') : 'numerico';
        var tipoSimple = tipoActual === 'numerico' || tipoActual === 'texto';
        selectTipo.value = tipoSimple ? tipoActual : 'numerico';
        selectTipo.disabled = !!examen && !tipoSimple;
        tipoEspecial.classList.toggle('d-none', !examen || tipoSimple);
        tipoEspecial.textContent = examen && !tipoSimple
            ? 'Tipo especializado protegido para conservar su formulario y sus parámetros (' + tipoActual + ').'
            : '';

        modal.show();
        if (!examen) elemento('catalogoNombre').focus();
    }

    function datosFormulario() {
        var refMin = elemento('catalogoRefMin').value.trim();
        var refMax = elemento('catalogoRefMax').value.trim();
        var min = refMin === '' ? null : Number(refMin);
        var max = refMax === '' ? null : Number(refMax);
        if (min !== null && !Number.isFinite(min)) throw new Error('La referencia mínima debe ser numérica.');
        if (max !== null && !Number.isFinite(max)) throw new Error('La referencia máxima debe ser numérica.');
        if (min !== null && max !== null && min > max) {
            throw new Error('La referencia mínima no puede superar la máxima.');
        }
        return {
            id: elemento('catalogoId').value.trim(),
            nombre: elemento('catalogoNombre').value.trim(),
            categoria: elemento('catalogoCategoria').value.trim(),
            unidad: elemento('catalogoUnidad').value.trim(),
            tipo: elemento('catalogoTipo').value,
            refMin: min,
            refMax: max,
            refTexto: elemento('catalogoRefTexto').value.trim(),
            valorDefecto: elemento('catalogoValorDefecto').value.trim()
        };
    }

    async function cargarCatalogo() {
        var respuesta = await window.api.obtenerCatalogoAdmin();
        if (!respuesta || !respuesta.success) {
            throw new Error((respuesta && respuesta.error) || 'No se pudo cargar el catálogo.');
        }
        examenes = (respuesta.examenes || []).filter(function(examen) {
            return examen.tipo !== 'perfil' || window.esExamenNormalCompuesto(examen.id);
        });
        categorias = (respuesta.categorias || []).filter(function(categoria) {
            return examenes.some(function(examen) { return examen.categoria === categoria.nombre; });
        });
        renderizar();
    }

    async function guardarFormulario(event) {
        event.preventDefault();
        limpiarError();
        var boton = elemento('btnGuardarExamenCatalogo');
        boton.disabled = true;
        var guardado = false;
        try {
            var datos = datosFormulario();
            if (examenEditando) datos.id = examenEditando.id;
            var respuesta = await window.api.guardarExamenCatalogo(datos);
            if (!respuesta || !respuesta.success) {
                throw new Error((respuesta && respuesta.error) || 'No se pudo guardar el examen.');
            }
            guardado = true;
            modal.hide();
            await cargarCatalogo();
            if (window.refrescarCatalogoDesdeSQLite) await window.refrescarCatalogoDesdeSQLite();
            mostrarToast('El examen "' + datos.nombre + '" se guardó correctamente.', 'success');
        } catch (error) {
            if (guardado) {
                mostrarToast('El examen se guardó, pero no se pudo actualizar la vista: ' + error.message, 'danger');
            } else {
                informarError(error.message || 'No se pudo guardar el examen.');
            }
        } finally {
            boton.disabled = false;
        }
    }

    async function actualizarEstado(id, activo) {
        var examen = examenes.find(function(item) { return item.id === id; });
        if (!examen) return;
        if (!activo && !confirm('¿Desactivar "' + examen.nombre + '"? Dejará de aparecer en nuevas órdenes, pero sus resultados históricos se conservarán.')) return;
        try {
            var respuesta = await window.api.actualizarEstadoExamenCatalogo({ id: id, activo: activo });
            if (!respuesta || !respuesta.success) {
                throw new Error((respuesta && respuesta.error) || 'No se pudo actualizar el estado del examen.');
            }
            await cargarCatalogo();
            if (window.refrescarCatalogoDesdeSQLite) await window.refrescarCatalogoDesdeSQLite();
            mostrarToast(activo ? 'Examen activado.' : 'Examen desactivado; el historial se conservó.', 'success');
        } catch (error) {
            mostrarToast(error.message || 'No se pudo actualizar el estado del examen.', 'danger');
        }
    }

    async function eliminarExamen(id) {
        var examen = examenes.find(function(item) { return item.id === id; });
        if (!examen || !confirm('¿Retirar "' + examen.nombre + '" del catálogo? Sus órdenes e historial se conservarán y podrás reactivarlo después.')) return;
        try {
            var respuesta = await window.api.eliminarExamenCatalogo({ id: id });
            if (!respuesta || !respuesta.success) {
                throw new Error((respuesta && respuesta.error) || 'No se pudo retirar el examen.');
            }
            await cargarCatalogo();
            if (window.refrescarCatalogoDesdeSQLite) await window.refrescarCatalogoDesdeSQLite();
            mostrarToast('El examen fue retirado del catálogo y se conservó el historial.', 'success');
        } catch (error) {
            mostrarToast(error.message || 'No se pudo retirar el examen.', 'danger');
        }
    }

    function instalarEventos() {
        elemento('btnNuevoExamen').addEventListener('click', function() { abrirFormulario(null); });
        elemento('buscarExamenCatalogo').addEventListener('input', renderizarAcordeon);
        elemento('catalogoCategorias').addEventListener('click', function(event) {
            var boton = event.target.closest('[data-categoria]');
            if (!boton) return;
            categoriaActiva = boton.getAttribute('data-categoria');
            renderizarCategorias();
            renderizarAcordeon();
        });
        elemento('catalogoAcordeones').addEventListener('click', function(event) {
            var boton = event.target.closest('[data-action]');
            if (!boton) return;
            var accion = boton.getAttribute('data-action');
            var id = boton.getAttribute('data-id');
            var examen = examenes.find(function(item) { return item.id === id; });
            if (accion === 'editar' && examen) abrirFormulario(examen);
            if (accion === 'estado' && examen) actualizarEstado(id, !examen.activo);
            if (accion === 'eliminar') eliminarExamen(id);
        });

        var btnExpandir = elemento('btnExpandirTodo');
        var btnColapsar = elemento('btnColapsarTodo');
        if (btnExpandir) {
            btnExpandir.addEventListener('click', function() {
                document.querySelectorAll('.accordion-collapse').forEach(function(el) { el.classList.add('show'); });
                document.querySelectorAll('.catalogo-acordeon-toggle').forEach(function(btn) {
                    btn.setAttribute('aria-expanded', 'true');
                });
            });
        }
        if (btnColapsar) {
            btnColapsar.addEventListener('click', function() {
                document.querySelectorAll('.accordion-collapse').forEach(function(el) { el.classList.remove('show'); });
                document.querySelectorAll('.catalogo-acordeon-toggle').forEach(function(btn) {
                    btn.setAttribute('aria-expanded', 'false');
                });
            });
        }

        elemento('formExamenCatalogo').addEventListener('submit', guardarFormulario);
        elemento('catalogoNombre').addEventListener('input', function() {
            if (examenEditando || elemento('catalogoId').dataset.manuallyEdited === 'true') return;
            elemento('catalogoId').value = elemento('catalogoNombre').value
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
                .replace(/^[^a-z]+/, '');
        });
        elemento('catalogoId').addEventListener('input', function() {
            this.dataset.manuallyEdited = 'true';
        });
        elemento('modalExamenCatalogo').addEventListener('hidden.bs.modal', function() {
            elemento('formExamenCatalogo').reset();
            elemento('catalogoId').dataset.manuallyEdited = 'false';
            examenEditando = null;
            limpiarError();
        });
    }

    window.initCatalogo = function() {
        if (!window.api || typeof window.api.obtenerCatalogoAdmin !== 'function') {
            var error = 'La administración del catálogo requiere la conexión con SQLite.';
            mostrarErrorCarga(error);
            mostrarToast(error, 'danger');
            return;
        }
        if (!modal) {
            modal = new bootstrap.Modal(elemento('modalExamenCatalogo'));
            instalarEventos();
        }
        cargarCatalogo().catch(function(error) {
            console.error('[catalogo] Error cargando catálogo:', error);
            var mensaje = error.message || 'No se pudo cargar el catálogo.';
            mostrarErrorCarga(mensaje);
            mostrarToast(mensaje, 'danger');
        });
    };
})();
