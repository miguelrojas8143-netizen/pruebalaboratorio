(function() {
    'use strict';

    var examenEditandoId = null;

    function obtenerFilasGuardadas(resultado) {
        if (!resultado) return [];
        if (typeof resultado !== 'string') {
            return resultado && Array.isArray(resultado.antigenos) ? resultado.antigenos : [];
        }

        var texto = resultado.trim();
        if (!texto) return [];
        if (texto.charAt(0) !== '{' && texto.charAt(0) !== '[') {
            return [{ nombre: '', resultado: texto, referencia: '' }];
        }

        var datos = JSON.parse(texto);
        if (Array.isArray(datos)) return datos;
        if (datos && Array.isArray(datos.antigenos)) return datos.antigenos;
        return [];
    }

    function agregarFilaAntigeno(valores) {
        var cuerpo = document.getElementById('antigenosFebrilesTablaBody');
        if (!cuerpo) return;

        valores = valores || {};
        var fila = document.createElement('tr');
        var celdaNombre = document.createElement('td');
        var grupoNombre = document.createElement('div');
        grupoNombre.className = 'input-group input-group-sm';

        var nombre = document.createElement('input');
        nombre.type = 'text';
        nombre.className = 'form-control antigeno-febril-nombre';
        nombre.placeholder = 'Ej.: Tífico O';
        nombre.setAttribute('aria-label', 'Nombre del antígeno');
        nombre.value = valores.nombre == null ? '' : String(valores.nombre);

        var eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'btn btn-outline-danger';
        eliminar.title = 'Eliminar antígeno';
        eliminar.setAttribute('aria-label', 'Eliminar antígeno');
        eliminar.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
        eliminar.addEventListener('click', function() {
            fila.remove();
        });

        grupoNombre.appendChild(nombre);
        grupoNombre.appendChild(eliminar);
        celdaNombre.appendChild(grupoNombre);

        var celdaResultado = document.createElement('td');
        var resultado = document.createElement('input');
        resultado.type = 'text';
        resultado.className = 'form-control form-control-sm antigeno-febril-resultado';
        resultado.placeholder = 'Ej.: 1:80 o Negativo';
        resultado.setAttribute('aria-label', 'Resultado del antígeno');
        resultado.value = valores.resultado == null ? '' : String(valores.resultado);
        celdaResultado.appendChild(resultado);

        var celdaReferencia = document.createElement('td');
        var referencia = document.createElement('input');
        referencia.type = 'text';
        referencia.className = 'form-control form-control-sm antigeno-febril-referencia';
        referencia.placeholder = 'Valor de referencia';
        referencia.setAttribute('aria-label', 'Valor de referencia del antígeno');
        referencia.value = valores.referencia == null ? '' : String(valores.referencia);
        celdaReferencia.appendChild(referencia);

        fila.appendChild(celdaNombre);
        fila.appendChild(celdaResultado);
        fila.appendChild(celdaReferencia);
        cuerpo.appendChild(fila);
    }

    window.abrirFormularioAntigenosFebriles = function(examenId) {
        var examen = (window.examenesOrden || []).find(function(item) {
            return item.id === examenId || item.examen_id === examenId;
        });
        var formulario = document.getElementById('formularioAntigenosFebriles');
        var cuerpo = document.getElementById('antigenosFebrilesTablaBody');
        if (!examen || !formulario || !cuerpo) {
            window.Notifications.error('No se pudo abrir el formulario de antígenos febriles.');
            return;
        }

        var filas;
        try {
            filas = obtenerFilasGuardadas(examen.resultado);
        } catch (error) {
            console.error('[AntigenosFebriles] No se pudieron leer los datos guardados:', error);
            window.Notifications.error('Los resultados guardados de antígenos febriles no tienen un formato válido.');
            return;
        }

        examenEditandoId = examen.id;
        cuerpo.replaceChildren();
        (filas.length ? filas : [{}]).forEach(agregarFilaAntigeno);
        formulario.style.display = 'block';
        formulario.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var primerCampo = cuerpo.querySelector('.antigeno-febril-nombre');
        if (primerCampo) primerCampo.focus();
    };

    window.agregarAntigenoFebril = function() {
        agregarFilaAntigeno({});
        var cuerpo = document.getElementById('antigenosFebrilesTablaBody');
        var campos = cuerpo && cuerpo.querySelectorAll('.antigeno-febril-nombre');
        if (campos && campos.length) campos[campos.length - 1].focus();
    };

    window.guardarFormularioAntigenosFebriles = function() {
        if (!examenEditandoId) {
            window.Notifications.error('No se pudo identificar el examen de antígenos febriles que se está editando.');
            return;
        }
        var cuerpo = document.getElementById('antigenosFebrilesTablaBody');
        var examen = (window.examenesOrden || []).find(function(item) {
            return item.id === examenEditandoId;
        });
        if (!cuerpo || !examen) {
            window.Notifications.error('No se pudieron recopilar los resultados de antígenos febriles.');
            return;
        }

        var antigenos = Array.from(cuerpo.querySelectorAll('tr')).map(function(fila) {
            return {
                nombre: fila.querySelector('.antigeno-febril-nombre').value.trim(),
                resultado: fila.querySelector('.antigeno-febril-resultado').value.trim(),
                referencia: fila.querySelector('.antigeno-febril-referencia').value.trim()
            };
        }).filter(function(antigeno) {
            return antigeno.nombre || antigeno.resultado || antigeno.referencia;
        });

        examen.tipoFormulario = 'antigenos_febriles';
        examen.tipo = 'antigenos_febriles';
        examen.resultado = JSON.stringify({ antigenos: antigenos });
        examenEditandoId = null;
        document.getElementById('formularioAntigenosFebriles').style.display = 'none';
        window.renderizarTablaExamenes();
    };

    window.cerrarFormularioAntigenosFebriles = function() {
        var formulario = document.getElementById('formularioAntigenosFebriles');
        if (formulario) formulario.style.display = 'none';
        examenEditandoId = null;
    };
})();
