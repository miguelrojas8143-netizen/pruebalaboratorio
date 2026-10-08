(function() {
    'use strict';

    window.UROANALISIS_FIELDS = [
        { id: 'ur_aspecto', nombre: 'Aspecto', tipo: 'select', grupo: 'Macroscópico', opciones: ['Límpido', 'Turbio', 'Ligeramente turbio'] },
        { id: 'ur_color', nombre: 'Color', tipo: 'select', grupo: 'Macroscópico', opciones: ['Amarillo claro', 'Amarillo oscuro', 'Incoloro o amarillo muy pálido', 'Ámbar / Rojizo'] },
        { id: 'ur_olor', nombre: 'Olor', tipo: 'select', grupo: 'Macroscópico', opciones: ['Sui géneris (característica normal)', 'Fétido (amoniacal)', 'Afrutado (cetónico)', 'Fuerte'] },
        { id: 'ur_reaccion', nombre: 'Reacción', tipo: 'select', grupo: 'Químico', opciones: ['Ácida', 'Alcalina'] },
        { id: 'ur_ph', nombre: 'pH', tipo: 'number', grupo: 'Químico', refMin: 4.5, refMax: 8.0 },
        { id: 'ur_densidad', nombre: 'Densidad', tipo: 'number', grupo: 'Químico', refMin: 1.005, refMax: 1.030 },
        { id: 'ur_urobilinogeno', nombre: 'Urobilinógeno', tipo: 'select', grupo: 'Químico', opciones: ['Normal', 'Aumentado', 'Disminuido'] },
        { id: 'ur_albumina', nombre: 'Albúmina', tipo: 'select', grupo: 'Químico', opciones: ['Negativo', 'Trazas', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_glucosa', nombre: 'Glucosa', tipo: 'select', grupo: 'Químico', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_cetonas', nombre: 'Cetonas', tipo: 'select', grupo: 'Químico', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_proteinas', nombre: 'Proteínas', tipo: 'select', grupo: 'Químico', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_hemoglobina', nombre: 'Hemoglobina', tipo: 'select', grupo: 'Químico', opciones: ['Negativo', 'Trazas', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_bilirrubina', nombre: 'Bilirrubina', tipo: 'select', grupo: 'Químico', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_nitritos', nombre: 'Nitritos', tipo: 'select', grupo: 'Químico', opciones: ['Negativo', 'Positivo'] },
        { id: 'ur_leucocitos_tira', nombre: 'Leucocitos', tipo: 'select', grupo: 'Químico', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_leucocitos_micro', nombre: 'Leucocitos (Micro)', tipo: 'select', grupo: 'Microscópico', opciones: ['0-2 por campo', '3-10 por campo', '11-20 por campo', '21-50 por campo', '> 50 por campo'] },
        { id: 'ur_celulas_epiteliales', nombre: 'Células Epiteliales', tipo: 'select', grupo: 'Microscópico', opciones: ['Ausentes', 'Escasas', 'Moderadas', 'Abundantes'] },
        { id: 'ur_eritrocitos', nombre: 'Eritrocitos', tipo: 'select', grupo: 'Microscópico', opciones: ['0-1 por campo', '2-5 por campo', '6-10 por campo', '> 10 por campo'] },
        { id: 'ur_bacterias', nombre: 'Bacterias', tipo: 'select', grupo: 'Microscópico', opciones: ['Ausentes', 'Escasas', 'Moderadas', 'Abundantes'] },
        { id: 'ur_cilindros', nombre: 'Cilindros', tipo: 'select', grupo: 'Microscópico', opciones: ['Ausentes', 'Hialinas', 'Granulosos', 'Eritrocitarios', 'Leucocíticos'] },
        { id: 'ur_cristales', nombre: 'Cristales', tipo: 'select', grupo: 'Microscópico', opciones: ['Ausentes', 'Oxalato de calcio', 'Fosfatos', 'Uratas', 'Carbonatos'] }
    ];

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

})();
