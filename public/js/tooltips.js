(function () {
    'use strict';

    var LABELS = {
        abrirFormularioHeces: "Editar resultado de heces",
        abrirFormularioUroanalisis: "Editar uroanálisis",
        abrirFormularioAntibiograma: "Editar antibiograma",
        abrirFormularioTipoSanguineo: "Editar tipo de sangre",
        abrirFormularioFrotis: "Editar frotis",
        abrirEditorResultadoExamen: "Editar resultado del examen",
        eliminarExamen: "Eliminar examen",
        eliminarTipoSanguineo: "Eliminar tipo de sangre",
        toggleItemsExamenTabla: "Ver/ocultar parámetros",
        toggleItemsPerfil: "Ver/ocultar perfil",
        guardarFormularioHeces: "Guardar heces",
        guardarFormularioUroanalisis: "Guardar uroanálisis",
        guardarFormularioAntibiograma: "Guardar antibiograma",
        guardarFormularioTipoSanguineo: "Guardar tipo de sangre",
        guardarFormularioFrotis: "Guardar frotis",
        cerrarFormularioHeces: "Cerrar",
        cerrarFormularioUroanalisis: "Cerrar",
        cerrarFormularioAntibiograma: "Cerrar",
        cerrarFormularioTipoSanguineo: "Cerrar",
        agregarExamen: "Agregar examen a la orden",
        toggleTodosGrupos: "Alternar todos los grupos",
        limpiarOrden: "Limpiar orden",
        guardarSolicitud: "Guardar solicitud",
        guardarResultados: "Guardar resultados",
        irAImpresion: "Vista previa / imprimir",
        mostrarEstadisticas: "Estadísticas",
        abrirGestionPacientes: "Eliminar pacientes",
        eliminarPacienteIndividual: "Eliminar paciente",
        crearNuevaOrden: "Nueva orden",
        imprimirOrdenPaciente: "Imprimir reporte de la orden",
        borrarTodosLosDatos: "Borrar todos los datos",
        limpiarBusquedaHistorial: "Limpiar búsqueda",
        toggleAllCatalogoSections: "Alternar secciones",
        INSERTAR_OBSERVACION_DEFAULT: "Insertar observación predeterminada"
    };

    var TITLE_EXCEPTIONS = {
        '#btnAnterior': 'Orden anterior',
        '#btnSiguiente': 'Orden siguiente',
        'button[type="submit"]': 'Guardar',
        '#btnNuevaOrden': 'Crear nueva orden',
        '#btnIrOrdenExistente': 'Ir a su orden',
        '#btnIrOrden': 'Ir a la orden',
        '.btn-close': 'Cerrar',
        '.btn-secondary[data-bs-dismiss="modal"]': 'Cancelar'
    };

    var ICON_LABELS = {
        'btn-volver': 'Volver'
    };

    var INIT_KEY = '_kiloTooltip';
    var initialized = false;
    var observer = null;

    function extraerFuncion(onclick) {
        if (!onclick) return null;
        var m = String(onclick).match(/^\s*(window\.)?([A-Za-z_$][\w$]*)\s*\(/);
        return m ? m[2] : null;
    }

    function cumpleSelector(el, selector) {
        try {
            return typeof el.matches === 'function' ? el.matches(selector) : false;
        } catch (e) {
            return false;
        }
    }

    function resolverLabel(el) {
        var id = el.id;
        var dataAction = el.getAttribute('data-action');
        var href = el.getAttribute('href');

        var keys = Object.keys(TITLE_EXCEPTIONS);
        for (var i = 0; i < keys.length; i++) {
            var sel = keys[i];
            if (cumpleSelector(el, sel)) {
                return TITLE_EXCEPTIONS[sel];
            }
        }

        if (dataAction) {
            var daSel = '[data-action="' + dataAction + '"]';
            if (cumpleSelector(el, daSel) && TITLE_EXCEPTIONS.hasOwnProperty(daSel)) {
                return TITLE_EXCEPTIONS[daSel];
            }
        }

        if (id && cumpleSelector(el, '#' + id) && TITLE_EXCEPTIONS.hasOwnProperty('#' + id)) {
            return TITLE_EXCEPTIONS['#' + id];
        }

        var fn = extraerFuncion(el.getAttribute('onclick'));
        if (fn && LABELS.hasOwnProperty(fn)) {
            return LABELS[fn];
        }

        var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();

        if (href) {
            if (txt) return txt;
            return href;
        }

        if (txt) return txt;

        var classes = el.className ? String(el.className).split(/\s+/).filter(Boolean) : [];
        for (var k = 0; k < classes.length; k++) {
            if (ICON_LABELS.hasOwnProperty(classes[k])) return ICON_LABELS[classes[k]];
        }

        return null;
    }

    function aplicarTooltip(el) {
        if (!el || el.nodeType !== 1) return;
        if (el[INIT_KEY]) return;

        if (el.hasAttribute('data-bs-toggle')) {
            el[INIT_KEY] = true;
            return;
        }

        var classList = el.classList;
        if (classList.contains('sidebar-link') && classList.contains('active')) {
            el[INIT_KEY] = true;
            return;
        }

        var dataBsTitle = el.getAttribute('data-bs-title');
        var nativeTitle = el.getAttribute('title');
        var label = null;

        if (dataBsTitle) {
            label = dataBsTitle;
        } else if (nativeTitle) {
            label = nativeTitle;
        } else {
            label = resolverLabel(el);
        }

        if (!label || String(label).trim() === '') {
            el[INIT_KEY] = true;
            return;
        }

        el.setAttribute('data-bs-toggle', 'tooltip');
        el.setAttribute('data-bs-title', label);

        if (nativeTitle && !dataBsTitle) {
            el.removeAttribute('title');
        }

        if (window.bootstrap && window.bootstrap.Tooltip) {
            try {
                var tip = new bootstrap.Tooltip(el, { container: 'body', trigger: 'manual' });
                el.addEventListener('mouseenter', function () { tip.show(); });
                el.addEventListener('mouseleave', function () { tip.hide(); });
                el.addEventListener('focusin', function () { tip.show(); });
                el.addEventListener('focusout', function () { tip.hide(); });
                tip.enable();
            } catch (e) {
                // ignorar errores de inicialización individual
            }
        }

        el[INIT_KEY] = true;
    }

    function escanear(root) {
        var ctx = root || document;
        var nodos = ctx.querySelectorAll('button, a');
        var arr = [];
        for (var i = 0; i < nodos.length; i++) arr.push(nodos[i]);

        if (ctx && ctx.nodeType === 1 && cumpleSelector(ctx, 'button, a')) {
            arr.unshift(ctx);
        }

        for (var j = 0; j < arr.length; j++) aplicarTooltip(arr[j]);
    }

    function procesarNodo(node) {
        if (!node || node.nodeType !== 1) return;
        escanear(node);
    }

    function cerrarTooltips() {
        var elementos = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        for (var i = 0; i < elementos.length; i++) {
            var tip = bootstrap.Tooltip.getInstance(elementos[i]);
            if (tip) tip.hide();
        }
    }

    function limpiarTooltips(node) {
        if (!node || node.nodeType !== 1) return;
        var elementos = [];
        if (cumpleSelector(node, '[data-bs-toggle="tooltip"]')) elementos.push(node);
        var descendientes = node.querySelectorAll('[data-bs-toggle="tooltip"]');
        for (var i = 0; i < descendientes.length; i++) elementos.push(descendientes[i]);

        for (var j = 0; j < elementos.length; j++) {
            var tip = bootstrap.Tooltip.getInstance(elementos[j]);
            if (tip) tip.dispose();
        }
    }

    function init() {
        if (initialized) return;
        initialized = true;

        if (!window.bootstrap || !window.bootstrap.Tooltip) {
            console.warn('[Tooltips] Bootstrap no disponible (bootstrap.Tooltip no definido).');
            return;
        }

        escanear(document);
        document.addEventListener('click', cerrarTooltips, true);

        if (window.MutationObserver) {
            observer = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    var added = mutations[i].addedNodes;
                    for (var j = 0; j < added.length; j++) {
                        procesarNodo(added[j]);
                    }
                    var removed = mutations[i].removedNodes;
                    for (var k = 0; k < removed.length; k++) {
                        limpiarTooltips(removed[k]);
                    }
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.Tooltips = { escanear: escanear, init: init };
})();
