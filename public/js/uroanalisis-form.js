(function() {
    'use strict';

    // Dynamically generate UROANALISIS_FIELDS from the SQLite catalog
    // This ensures field definitions come from parametros_examen instead of being hardcoded
    window.UROANALISIS_FIELDS = [];

    var examenOrina = (window.App && window.App.examenesDetallados)
        ? window.App.examenesDetallados.examen_orina
        : null;
    if (examenOrina && examenOrina.items && examenOrina.items.length > 0) {
        examenOrina.items.forEach(function(item) {
            window.UROANALISIS_FIELDS.push({
                id: item.id,
                nombre: item.nombre,
                tipo: item.tipo || 'numerico',
                grupo: item.grupo || 'General',
                refMin: item.refMin,
                refMax: item.refMax,
                refTexto: item.refTexto
            });
        });
    }
})();

window.abrirFormularioUroanalisis = function(examenId) {
    var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
    if (!examen) return;
    window._uroEditando = examenId;

    var form = document.getElementById('formularioUroanalisis');
    if (!form) return;
    form.style.display = 'block';

    var datos = {};
    try { datos = JSON.parse(examen.resultado || '{}'); } catch(e) {}

    window.UROANALISIS_FIELDS.forEach(function(f) {
        var input = document.getElementById('uro_' + f.id);
        if (input) {
            input.value = datos[f.id] !== undefined ? datos[f.id] : '';
        }
    });

    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.guardarFormularioUroanalisis = async function() {
        var examenId = window._uroEditando;
        if (!examenId) {
            alert('No se encontró el examen de orina que se va a guardar.');
            return;
        }

        var datos = {};
        window.UROANALISIS_FIELDS.forEach(function(f) {
            var input = document.getElementById('uro_' + f.id);
            datos[f.id] = input ? String(input.value || '').trim() : '';
        });

        var examenes = window.examenesOrden || [];
        var examen = examenes.find(function(e) { return e.id === examenId; });
        if (!examen) {
            alert('No se encontró el examen de orina en la orden.');
            return;
        }
        var orden = window.pacienteActivo ? window.pacienteActivo.orden : (window.getOrden ? window.getOrden() : '');
        if (!orden) {
            alert('Error: No se pudo determinar la orden.');
            return;
        }
        if (!window.api || typeof window.api.guardarPacienteExamenes !== 'function') {
            alert('Error: No está disponible el guardado en la base de datos.');
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
            alert('Error al guardar los resultados: ' + error.message);
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
