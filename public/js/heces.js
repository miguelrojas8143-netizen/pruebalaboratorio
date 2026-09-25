
/**
 * Módulo para gestionar los exámenes de heces
 * 
 */
(function() {
    'use strict';
// Sección de exámenes de heces
    window.abrirFormularioHeces = function(examenId) {
        var examen = (window.examenesOrden || []).find(function(e) { return e.id === examenId; });
        if (!examen) return;
        // Guardar el examenId en una variable global para usarlo al guardar
        window._examenHecesEditando = examenId;

        var form = document.getElementById('formularioHeces');
        if (!form) return;
        form.style.display = 'block';
        try {
            var datos = JSON.parse(examen.resultado || '{}');
            if (datos.mocoFecal) document.getElementById('mocoFecal').value = datos.mocoFecal;
            if (datos.phHeces) document.getElementById('phHeces').value = datos.phHeces;
            if (datos.glucosaHeces) document.getElementById('glucosaHeces').value = datos.glucosaHeces;
            if (datos.leucocitosPMN) document.getElementById('leucocitosPMN').value = datos.leucocitosPMN;
            if (datos.leucocitosMononucleados) document.getElementById('leucocitosMononucleados').value = datos.leucocitosMononucleados;
            if (datos.sustanciasReductoras) document.getElementById('sustanciasReductoras').value = datos.sustanciasReductoras;
            if (datos.consistencia) document.getElementById('consistencia').value = datos.consistencia;
            if (datos.colorHeces) document.getElementById('colorHeces').value = datos.colorHeces;
            if (datos.directoConcentracion) document.getElementById('directoConcentracion').value = datos.directoConcentracion;
            if (datos.entamoebaColi) document.getElementById('entamoebaColi').value = datos.entamoebaColi;
            if (datos.restosAlimentos) document.getElementById('restosAlimentos').value = datos.restosAlimentos;
            if (datos.floraBacteriana) document.getElementById('floraBacteriana').value = datos.floraBacteriana;
        } catch(e) {}

        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };


    
    window.guardarFormularioHeces = function() {
        var examenId = window._examenHecesEditando;
        if (!examenId) return;
        var datos = {
            mocoFecal: document.getElementById('mocoFecal') ? document.getElementById('mocoFecal').value : '',
            phHeces: document.getElementById('phHeces') ? document.getElementById('phHeces').value : '',
            glucosaHeces: document.getElementById('glucosaHeces') ? document.getElementById('glucosaHeces').value : '',
            leucocitosPMN: document.getElementById('leucocitosPMN') ? document.getElementById('leucocitosPMN').value : '',
            leucocitosMononucleados: document.getElementById('leucocitosMononucleados') ? document.getElementById('leucocitosMononucleados').value : '',
            sustanciasReductoras: document.getElementById('sustanciasReductoras') ? document.getElementById('sustanciasReductoras').value : '',
            consistencia: document.getElementById('consistencia') ? document.getElementById('consistencia').value : '',
            colorHeces: document.getElementById('colorHeces') ? document.getElementById('colorHeces').value : '',
            directoConcentracion: document.getElementById('directoConcentracion') ? document.getElementById('directoConcentracion').value : '',
            entamoebaColi: document.getElementById('entamoebaColi') ? document.getElementById('entamoebaColi').value : '',
            restosAlimentos: document.getElementById('restosAlimentos') ? document.getElementById('restosAlimentos').value : '',
            floraBacteriana: document.getElementById('floraBacteriana') ? document.getElementById('floraBacteriana').value : ''
        };

        var examenes = window.examenesOrden || [];
        var examen = examenes.find(function(e) { return e.id === examenId; });
        if (!examen) return;

        examen.resultado = JSON.stringify(datos);
        window.renderizarTablaExamenes();
        window.cerrarFormularioHeces();
    };

    window.cerrarFormularioHeces = function() {
        var form = document.getElementById('formularioHeces');
        if (form) form.style.display = 'none';
        window._examenHecesEditando = null;
    };

    window.validarSustanciasReductoras = function(valor) {
        var div = document.getElementById('interpretacionReductoras');
        if (!div) return;
        var num = parseFloat(valor);
        if (isNaN(num) || valor === '') {
            div.innerHTML = '';
            return;
        }
        var resultado = window.interpretarSustanciasReductoras(valor);
        if (resultado.texto) {
            div.innerHTML = '<span class="badge ' + resultado.clase + '">' + resultado.texto + '</span>';
        } else {
            div.innerHTML = '';
        }
    };

})();
