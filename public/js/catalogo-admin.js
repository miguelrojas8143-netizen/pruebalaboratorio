/**
 * Administración del catálogo persistido en SQLite.
 */
(function() {
    'use strict';

    var examenes = [];
    var categorias = [];
    var antibioticos = [];
    var categoriaActiva = null;
    var examenEditando = null;
    var modal = null;
    var antigenosCatalogoModificados = false;
    var permitirCerrarCatalogo = false;

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

        function agregarFiltro(nombre, etiqueta, cantidad) {
            var boton = document.createElement('button');
            boton.type = 'button';
            boton.className = 'catalogo-filtro' + (categoriaActiva === nombre ? ' active' : '');
            boton.setAttribute('aria-pressed', categoriaActiva === nombre ? 'true' : 'false');
            boton.setAttribute('data-categoria', nombre);
            var titulo = document.createElement('span');
            titulo.textContent = etiqueta;
            var count = document.createElement('span');
            count.className = 'badge-count';
            count.textContent = String(cantidad);
            boton.appendChild(titulo);
            boton.appendChild(count);
            nav.appendChild(boton);
        }

        var filtros = categorias.map(function(categoria) {
            return {
                nombre: categoria.nombre,
                etiqueta: categoria.nombre,
                cantidad: conteos[categoria.nombre] || 0
            };
        });
        filtros.push({ nombre: '', etiqueta: 'Todas', cantidad: examenes.length });
        filtros.sort(function(a, b) {
            return a.etiqueta.localeCompare(b.etiqueta, 'es', { sensitivity: 'base' });
        });
        filtros.forEach(function(filtro) {
            agregarFiltro(filtro.nombre, filtro.etiqueta, filtro.cantidad);
        });

        categorias.slice().sort(function(a, b) {
            return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
        }).forEach(function(categoria) {
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
        var panelVisible = categoriaActiva !== null;
        var busqueda = elemento('buscarExamenCatalogo');
        var acciones = document.querySelector('.catalogo-toolbar-acciones');
        contenedor.classList.toggle('d-none', !panelVisible);
        busqueda.disabled = !panelVisible;
        busqueda.placeholder = panelVisible
            ? 'Buscar por código, nombre o categoría...'
            : 'Selecciona una categoría para buscar...';
        if (acciones) acciones.classList.toggle('d-none', !panelVisible);

        if (!panelVisible) {
            elemento('contadorExamenesCatalogo').textContent = '';
            return;
        }

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
        renderizarAntibioticos();
        renderizarPerfiles();
    }

    function renderizarAntibioticos() {
        var tbody = elemento('tablaAntibioticosCatalogo');
        tbody.replaceChildren();
        if (!antibioticos.length) {
            var filaVacia = document.createElement('tr');
            var mensaje = crearCelda('No hay antibióticos en el catálogo.', 'text-center text-muted py-3');
            mensaje.colSpan = 4;
            filaVacia.appendChild(mensaje);
            tbody.appendChild(filaVacia);
            return;
        }

        antibioticos.forEach(function(antibiotico) {
            var fila = document.createElement('tr');
            fila.setAttribute('data-antibiotico-id', antibiotico.id);
            fila.appendChild(crearCelda(antibiotico.id, 'font-monospace'));

            var nombreCell = document.createElement('td');
            var nombreInput = document.createElement('input');
            nombreInput.type = 'text';
            nombreInput.className = 'form-control form-control-sm';
            nombreInput.maxLength = 120;
            nombreInput.value = antibiotico.nombre;
            nombreInput.setAttribute('aria-label', 'Nombre de ' + antibiotico.nombre);
            nombreCell.appendChild(nombreInput);
            fila.appendChild(nombreCell);

            fila.appendChild(crearCelda(antibiotico.activo ? 'Activo' : 'Inactivo',
                antibiotico.activo ? 'text-success fw-semibold' : 'text-muted'));
            var acciones = document.createElement('td');
            acciones.className = 'text-end text-nowrap';
            var guardar = crearBoton('bi bi-save', 'Guardar nombre', 'btn-primary', 'guardar', antibiotico.id);
            guardar.disabled = nombreInput.value.trim() === '';
            nombreInput.addEventListener('input', function() {
                guardar.disabled = nombreInput.value.trim() === antibiotico.nombre || nombreInput.value.trim() === '';
            });
            acciones.appendChild(guardar);
            acciones.appendChild(crearBoton(
                antibiotico.activo ? 'bi bi-toggle-on' : 'bi bi-toggle-off',
                antibiotico.activo ? 'Desactivar antibiótico' : 'Activar antibiótico',
                antibiotico.activo ? 'btn-success' : 'btn-secondary',
                'estado',
                antibiotico.id
            ));
            acciones.appendChild(crearBoton(
                'bi bi-trash',
                'Eliminar antibiótico',
                'btn-danger',
                'eliminar',
                antibiotico.id
            ));
            fila.appendChild(acciones);
            tbody.appendChild(fila);
        });
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

    function esExamenAntigenosFebriles(examen) {
        return !!examen && examen.id === 'antigenos_febriles';
    }

    function agregarFilaAntigenoCatalogo(antigeno) {
        var cuerpo = elemento('catalogoAntigenosTablaBody');
        var fila = document.createElement('tr');
        var celdaNombre = document.createElement('td');
        var nombre = document.createElement('input');
        nombre.type = 'text';
        nombre.className = 'form-control form-control-sm catalogo-antigeno-nombre';
        nombre.maxLength = 120;
        nombre.placeholder = 'Ej.: Tífico O';
        nombre.setAttribute('aria-label', 'Nombre del antígeno');
        nombre.value = antigeno && antigeno.nombre ? antigeno.nombre : '';
        celdaNombre.appendChild(nombre);

        var celdaReferencia = document.createElement('td');
        var referencia = document.createElement('input');
        referencia.type = 'text';
        referencia.className = 'form-control form-control-sm catalogo-antigeno-referencia';
        referencia.maxLength = 240;
        referencia.placeholder = 'Ej.: Negativo o menor de 1:80';
        referencia.setAttribute('aria-label', 'Valor de referencia');
        referencia.value = antigeno && antigeno.referencia ? antigeno.referencia : '';
        celdaReferencia.appendChild(referencia);

        var celdaAccion = document.createElement('td');
        celdaAccion.className = 'text-center';
        var eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'btn btn-sm btn-outline-danger';
        eliminar.title = 'Eliminar antígeno';
        eliminar.setAttribute('aria-label', 'Eliminar antígeno');
        eliminar.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
        eliminar.addEventListener('click', function() {
            fila.remove();
            antigenosCatalogoModificados = true;
        });
        celdaAccion.appendChild(eliminar);

        fila.appendChild(celdaNombre);
        fila.appendChild(celdaReferencia);
        fila.appendChild(celdaAccion);
        cuerpo.appendChild(fila);
    }

    function cargarFilasAntigenosCatalogo(examen) {
        var seccion = elemento('catalogoAntigenosFebriles');
        var cuerpo = elemento('catalogoAntigenosTablaBody');
        var habilitado = esExamenAntigenosFebriles(examen);
        seccion.classList.toggle('d-none', !habilitado);
        elemento('catalogoCamposGenerales').classList.toggle('d-none', habilitado);
        elemento('btnGuardarExamenCatalogo').innerHTML = habilitado
            ? '<i class="bi bi-save me-1"></i>Guardar configuración Widal'
            : '<i class="bi bi-save me-1"></i>Guardar examen';
        antigenosCatalogoModificados = false;
        cuerpo.replaceChildren();
        if (!habilitado) return;

        var antigenos = Array.isArray(examen.antigenos) ? examen.antigenos : [];
        (antigenos.length ? antigenos : [{}]).forEach(agregarFilaAntigenoCatalogo);
    }

    function leerAntigenosCatalogo() {
        return Array.from(elemento('catalogoAntigenosTablaBody').querySelectorAll('tr'))
            .map(function(fila, indice) {
                var nombre = fila.querySelector('.catalogo-antigeno-nombre').value.trim();
                var referencia = fila.querySelector('.catalogo-antigeno-referencia').value.trim();
                if (!nombre && !referencia) return null;
                if (!nombre) {
                    throw new Error('Escribe el nombre del antígeno en la fila ' + (indice + 1) + '.');
                }
                return { nombre: nombre, referencia: referencia };
            })
            .filter(Boolean);
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
        cargarFilasAntigenosCatalogo(examen);

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
        var datos = {
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
        if (datos.id === 'antigenos_febriles') datos.antigenos = leerAntigenosCatalogo();
        return datos;
    }

    async function cargarCatalogo() {
        var respuestas = await Promise.all([
            window.api.obtenerCatalogoAdmin(),
            window.api.obtenerAntibioticosCatalogo()
        ]);
        var respuesta = respuestas[0];
        var respuestaAntibioticos = respuestas[1];
        if (!respuesta || !respuesta.success) throw new Error((respuesta && respuesta.error) || 'No se pudo cargar el catálogo.');
        if (!respuestaAntibioticos || !respuestaAntibioticos.success) {
            throw new Error((respuestaAntibioticos && respuestaAntibioticos.error) || 'No se pudo cargar el catálogo de antibióticos.');
        }
        antibioticos = respuestaAntibioticos.antibioticos || [];
        examenes = (respuesta.examenes || []).filter(function(examen) {
            var componenteTipoSanguineo = examen.id === 'grupo_sanguineo' ||
                examen.id === 'grupo_sanguineo_abo' ||
                examen.id === 'factor_rh';
            return !componenteTipoSanguineo &&
                (examen.tipo !== 'perfil' || window.esExamenNormalCompuesto(examen.id));
        });
        categorias = (respuesta.categorias || []).filter(function(categoria) {
            return examenes.some(function(examen) { return examen.categoria === categoria.nombre; });
        });
        if (categoriaActiva && !categorias.some(function(categoria) {
            return categoria.nombre === categoriaActiva;
        })) {
            categoriaActiva = null;
        }
        renderizar();
    }

    function generarCodigoAntibiotico(nombre) {
        return String(nombre || '').normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .replace(/^[^a-z]+/, '');
    }

    async function guardarAntibiotico(datos) {
        var respuesta = await window.api.guardarAntibioticoCatalogo(datos);
        if (!respuesta || !respuesta.success) {
            throw new Error((respuesta && respuesta.error) || 'No se pudo guardar el antibiótico.');
        }
        await cargarCatalogo();
        if (window.refrescarCatalogoDesdeSQLite) await window.refrescarCatalogoDesdeSQLite();
        return respuesta.antibiotico;
    }

    async function cambiarEstadoAntibiotico(id, activo) {
        try {
            var respuesta = await window.api.actualizarEstadoAntibioticoCatalogo({ id: id, activo: activo });
            if (!respuesta || !respuesta.success) {
                throw new Error((respuesta && respuesta.error) || 'No se pudo actualizar el antibiótico.');
            }
            await cargarCatalogo();
            if (window.refrescarCatalogoDesdeSQLite) await window.refrescarCatalogoDesdeSQLite();
            mostrarToast(activo ? 'Antibiótico activado para nuevas órdenes.' :
                'Antibiótico desactivado; los resultados guardados se conservaron.', 'success');
        } catch (error) {
            mostrarToast(error.message || 'No se pudo actualizar el antibiótico.', 'danger');
        }
    }

    async function eliminarAntibiotico(id) {
        var antibiotico = antibioticos.find(function(item) { return item.id === id; });
        if (!antibiotico) return;
        var confirmado = await window.Notifications.confirm({
            title: 'Eliminar antibiótico',
            message: '¿Eliminar permanentemente "' + antibiotico.nombre +
                '" del catálogo? No aparecerá en nuevos antibiogramas. Los resultados guardados no se modificarán.',
            type: 'warning',
            confirmText: 'Sí, eliminar',
            cancelText: 'Cancelar'
        });
        if (!confirmado) return;
        try {
            var respuesta = await window.api.eliminarAntibioticoCatalogo({ id: id });
            if (!respuesta || !respuesta.success) {
                throw new Error((respuesta && respuesta.error) || 'No se pudo eliminar el antibiótico.');
            }
            await cargarCatalogo();
            if (window.refrescarCatalogoDesdeSQLite) await window.refrescarCatalogoDesdeSQLite();
            mostrarToast('El antibiótico "' + antibiotico.nombre + '" fue eliminado del catálogo.', 'success');
        } catch (error) {
            mostrarToast(error.message || 'No se pudo eliminar el antibiótico.', 'danger');
        }
    }

    async function guardarAntibioticoDesdeFormulario(event) {
        event.preventDefault();
        var idInput = elemento('antibioticoCatalogoId');
        var nombreInput = elemento('antibioticoCatalogoNombre');
        var error = elemento('antibioticoCatalogoError');
        var boton = elemento('btnGuardarAntibioticoCatalogo');
        error.textContent = '';
        error.classList.add('d-none');
        boton.disabled = true;
        try {
            var antibiotico = await guardarAntibiotico({
                id: idInput.value.trim(),
                nombre: nombreInput.value.trim()
            });
            elemento('formAntibioticoCatalogo').reset();
            idInput.dataset.manuallyEdited = 'false';
            mostrarToast('Antibiótico "' + antibiotico.nombre + '" agregado al catálogo.', 'success');
        } catch (saveError) {
            error.textContent = saveError.message || 'No se pudo guardar el antibiótico.';
            error.classList.remove('d-none');
        } finally {
            boton.disabled = false;
        }
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
            antigenosCatalogoModificados = false;
            permitirCerrarCatalogo = true;
            modal.hide();
            permitirCerrarCatalogo = false;
            await cargarCatalogo();
            if (window.refrescarCatalogoDesdeSQLite) await window.refrescarCatalogoDesdeSQLite();
            mostrarToast(
                datos.id === 'antigenos_febriles'
                    ? 'La configuración de Antígenos Febriles (Widal) se guardó correctamente.'
                    : 'El examen "' + datos.nombre + '" se guardó correctamente.',
                'success'
            );
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
        if (!activo) {
            var confirmado = await window.Notifications.confirm({
                title: 'Confirmar',
                message: '¿Desactivar "' + examen.nombre + '"? Dejará de aparecer en nuevas órdenes, pero sus resultados históricos se conservarán.',
                type: 'warning',
                confirmText: 'Sí, desactivar',
                cancelText: 'Cancelar'
            });
            if (!confirmado) return;
        }
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
        if (!examen) return;
        var confirmado = await window.Notifications.confirm({
            title: 'Confirmar',
            message: '¿Retirar "' + examen.nombre + '" del catálogo? Sus órdenes e historial se conservarán y podrás reactivarlo después.',
            type: 'warning',
            confirmText: 'Sí, retirar',
            cancelText: 'Cancelar'
        });
        if (!confirmado) return;
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
        elemento('btnAgregarAntigenoCatalogo').addEventListener('click', function() {
            agregarFilaAntigenoCatalogo({});
            antigenosCatalogoModificados = true;
            var campos = elemento('catalogoAntigenosTablaBody').querySelectorAll('.catalogo-antigeno-nombre');
            campos[campos.length - 1].focus();
        });
        elemento('catalogoAntigenosTablaBody').addEventListener('input', function() {
            antigenosCatalogoModificados = true;
        });
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
        elemento('formAntibioticoCatalogo').addEventListener('submit', guardarAntibioticoDesdeFormulario);
        elemento('antibioticoCatalogoNombre').addEventListener('input', function() {
            var idInput = elemento('antibioticoCatalogoId');
            if (idInput.dataset.manuallyEdited === 'true') return;
            idInput.value = generarCodigoAntibiotico(this.value);
        });
        elemento('antibioticoCatalogoId').addEventListener('input', function() {
            this.dataset.manuallyEdited = 'true';
        });
        elemento('tablaAntibioticosCatalogo').addEventListener('click', function(event) {
            var boton = event.target.closest('[data-action]');
            if (!boton) return;
            var id = boton.getAttribute('data-id');
            var antibiotico = antibioticos.find(function(item) { return item.id === id; });
            if (!antibiotico) return;
            if (boton.getAttribute('data-action') === 'estado') {
                cambiarEstadoAntibiotico(id, !antibiotico.activo);
                return;
            }
            if (boton.getAttribute('data-action') === 'eliminar') {
                eliminarAntibiotico(id);
                return;
            }
            if (boton.getAttribute('data-action') === 'guardar') {
                var fila = boton.closest('tr');
                var nombre = fila.querySelector('input').value.trim();
                boton.disabled = true;
                guardarAntibiotico({ id: id, nombre: nombre })
                    .then(function(actualizado) {
                        mostrarToast('El antibiótico "' + actualizado.nombre + '" se actualizó.', 'success');
                    })
                    .catch(function(error) {
                        mostrarToast(error.message || 'No se pudo guardar el antibiótico.', 'danger');
                        renderizarAntibioticos();
                    });
            }
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
        elemento('modalExamenCatalogo').addEventListener('hide.bs.modal', function(event) {
            if (!antigenosCatalogoModificados || permitirCerrarCatalogo) return;
            event.preventDefault();
            window.Notifications.confirm({
                title: 'Cambios sin guardar',
                message: 'Los antígenos agregados o editados todavía no se han guardado. ¿Deseas descartarlos?',
                type: 'warning',
                confirmText: 'Descartar cambios',
                cancelText: 'Seguir editando'
            }).then(function(confirmado) {
                if (!confirmado) return;
                antigenosCatalogoModificados = false;
                permitirCerrarCatalogo = true;
                modal.hide();
                permitirCerrarCatalogo = false;
            });
        });
        window.addEventListener('beforeunload', function(event) {
            if (!antigenosCatalogoModificados) return;
            event.preventDefault();
            event.returnValue = '';
        });
        elemento('modalExamenCatalogo').addEventListener('hidden.bs.modal', function() {
            elemento('formExamenCatalogo').reset();
            elemento('catalogoAntigenosTablaBody').replaceChildren();
            elemento('catalogoAntigenosFebriles').classList.add('d-none');
            elemento('catalogoCamposGenerales').classList.remove('d-none');
            elemento('btnGuardarExamenCatalogo').innerHTML = '<i class="bi bi-save me-1"></i>Guardar examen';
            elemento('catalogoId').dataset.manuallyEdited = 'false';
            examenEditando = null;
            antigenosCatalogoModificados = false;
            permitirCerrarCatalogo = false;
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
