(function() {
    'use strict';

    function normalizarExamen(examen) {
        if (!examen) return examen;
        if (!examen.area) examen.area = 'General';
        if (!examen.tipo) {
            if (examen.id === 'grupo_sanguineo' || examen.id === 'grupo_sanguineo_abo' || examen.id === 'factor_rh') {
                examen.tipo = examen.id === 'grupo_sanguineo' ? 'texto' : 'tipo_sanguineo';
            } else {
                examen.tipo = examen.tipoFormulario === 'heces' ? 'heces' : examen.tipoFormulario === 'antibiograma' ? 'antibiograma' : 'numerico';
            }
        }
        return examen;
    }

    function enriquecerExamenDesdeCatalogo(examen) {
        if (!examen || !window.obtenerCatalogo) return examen;
        var catalogo = window.obtenerCatalogo();
        var cat = catalogo.find(function(c) { return c.id === examen.id; });
        if (!cat && examen.nombre) {
            cat = catalogo.find(function(c) { return c.tipo === 'heces' && c.nombre === examen.nombre; });
        }
        if (!cat) return examen;
        if (cat.area && !examen.area) examen.area = cat.area;
        if (cat.tipo && !examen.tipo) examen.tipo = cat.tipo;
        if (cat.tipoFormulario && !examen.tipoFormulario) examen.tipoFormulario = cat.tipoFormulario;
        if (cat.tipo === 'heces' && !examen.tipoFormulario) examen.tipoFormulario = 'heces';
        if (cat.unidad !== undefined && !examen.unidad) examen.unidad = cat.unidad;
        if (cat.refMin !== undefined && examen.refMin === undefined) examen.refMin = cat.refMin;
        if (cat.refMax !== undefined && examen.refMax === undefined) examen.refMax = cat.refMax;
        if (cat.refTexto !== undefined && !examen.refTexto) examen.refTexto = cat.refTexto;
        if (cat.opciones && !examen.opciones) examen.opciones = cat.opciones;
        if (cat.grupo !== undefined && examen.grupo === undefined) examen.grupo = cat.grupo;
        if (cat.valorDefecto !== undefined && examen.valorDefecto === undefined) examen.valorDefecto = cat.valorDefecto;
        return examen;
    }

    function enriquecerExamenesDesdeCatalogo(examenes) {
        if (!examenes) return [];
        return examenes.map(function(e) { return enriquecerExamenDesdeCatalogo(JSON.parse(JSON.stringify(e))); });
    }
    
    // Función para calcular el estado del paciente según sus exámenes
    function calcularEstadoPaciente(paciente) {
        var examenes = (paciente.examenes || []).map(normalizarExamen);
        if (examenes.length === 0) return 'en_espera';
        var conResultado = examenes.filter(function(e) {
            if (e.tipoFormulario === 'heces' || e.tipoFormulario === 'uroanalisis' || e.tipoFormulario === 'antibiograma' || e.tipo === 'multiselect_cantidad') {
                try {
                    var datos = JSON.parse(e.resultado || '{}');
                    return Object.keys(datos).length > 0 && Object.values(datos).some(function(v) { return v !== ''; });
                } catch(err) {
                    return false;
                }
            }
            return String(e.resultado || '').trim() !== '';
        });
        if (conResultado.length === 0) return 'en_espera';
        if (conResultado.length < examenes.length) return 'parcial';
        return 'completo';
    }

    // Función para obtener el texto y la clase CSS correspondiente al estado del paciente
    function textoEstado(estado) {
        switch (estado) {
            case 'completo': return { texto: 'Completo', clase: 'bg-success' };
            case 'parcial': return { texto: 'Parcial', clase: 'bg-primary' };
            default: return { texto: 'En espera', clase: 'bg-warning text-dark' };
        }
    }

    window.formatearFecha = function(input) {
        var valor = input.value.replace(/\D/g, '');
        if (valor.length >= 4) {
            valor = valor.slice(0,2) + '/' + valor.slice(2,4) + '/' + valor.slice(4,8);
        } else if (valor.length >= 2) {
            valor = valor.slice(0,2) + '/' + valor.slice(2);
        }
        input.value = valor;
    };

    function calcularEdad(fechaNacStr) {
        if (!fechaNacStr) return null;
        var partes = fechaNacStr.split('/');
        if (partes.length !== 3) return null;
        var dia = parseInt(partes[0], 10);
        var mes = parseInt(partes[1], 10) - 1;
        var anio = parseInt(partes[2], 10);
        if (isNaN(dia) || isNaN(mes) || isNaN(anio)) return null;
        var nacimiento = new Date(anio, mes, dia);
        var hoy = new Date();
        var edad = hoy.getFullYear() - nacimiento.getFullYear();
        var m = hoy.getMonth() - nacimiento.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad--;
        }
        return edad;
    }

    window.mostrarEdad = function(input) {
        var edadInput = document.getElementById('edad');
        if (!edadInput) return;
        var edad = calcularEdad(input.value.trim());
        edadInput.value = edad !== null ? edad + ' años' : '';
    };

    window.mostrarFechaHoy = function() {
        var hoy = new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        var el = document.getElementById('fechaHoy');
        if (el) el.textContent = hoy.charAt(0).toUpperCase() + hoy.slice(1);
    };
    
    // Interpretar resultado de sustancias reductoras  
    function interpretarSustanciasReductoras(valor) {
        var num = parseFloat(valor);
        if (isNaN(num)) {
            return { texto: '', clase: '' };
        }
        if (num >= 0.01 && num < 0.25) {
            return { texto: 'NEGATIVO', clase: 'text-success fw-bold' };
        } else if (num >= 0.25 && num <= 0.50) {
            return { texto: 'INDETERMINADO', clase: 'text-warning fw-bold' };
        } else {
            return { texto: 'POSITIVO', clase: 'text-danger fw-bold' };
        }
    }
    
    // Funciones para verificar si un examen tiene datos válidos
    function tieneDatosHeces(examen) {
        try {
            var datos = JSON.parse(examen.resultado || '{}');
            return Object.keys(datos).length > 0 && Object.values(datos).some(function(v) { return v !== ''; });
        } catch(e) {
            return false;
        }
    }

    // Función para verificar si un examen de uroanálisis tiene datos válidos
    function tieneDatosUroanalisis(examen) {
        try {
            var datos = JSON.parse(examen.resultado || '{}');
            return Object.keys(datos).length > 0 && Object.values(datos).some(function(v) { return String(v).trim() !== ''; });
        } catch(e) {
            return false;
        }
    }
    
    function tieneDatosAntibiograma(examen) {
        try {
            var datos = JSON.parse(examen.resultado || '{}');
            var antibioticos = datos.antibioticos || [];
            if (antibioticos.some(function(a) { return a.resultado || a.cmi; })) return true;
            if (datos.observaciones && String(datos.observaciones).trim() !== '') return true;
            return false;
        } catch(e) {
            return false;
        }
    }
    
    // Función para obtener el valor numérico de un examen por su ID
    function obtenerValor(examenesOrden, examenId) {
        var examen = examenesOrden.find(function(e) { return e.id === examenId; });
        if (!examen || !examen.resultado) return NaN;
        var valor = parseFloat(examen.resultado.replace(',', '.'));
        return isNaN(valor) ? NaN : valor;
    }

    window.normalizarExamen = normalizarExamen;
    window.enriquecerExamenDesdeCatalogo = enriquecerExamenDesdeCatalogo;
    window.enriquecerExamenesDesdeCatalogo = enriquecerExamenesDesdeCatalogo;
    window.calcularEstadoPaciente = calcularEstadoPaciente;
    window.textoEstado = textoEstado;
    window.calcularEdad = calcularEdad;
    window.interpretarSustanciasReductoras = interpretarSustanciasReductoras;
    window.tieneDatosHeces = tieneDatosHeces;
    window.tieneDatosUroanalisis = tieneDatosUroanalisis;
    window.tieneDatosAntibiograma = tieneDatosAntibiograma;
    window.obtenerValor = obtenerValor;

    window.determinarTipoSangre = function() {
        var antiA = document.getElementById('antiA');
        var antiB = document.getElementById('antiB');
        var antiD = document.getElementById('antiD');
        if (!antiA || !antiB || !antiD) return null;

        var reaccionaA = antiA.value === 'si';
        var reaccionaB = antiB.value === 'si';
        var reaccionaRh = antiD.value === 'si';
        var entradasCompletas = antiA.value !== '' && antiB.value !== '' && antiD.value !== '';
        var grupo = '';
        var factorRh = '';

        if (entradasCompletas) {
            if (reaccionaA && reaccionaB) grupo = 'AB';
            else if (reaccionaA) grupo = 'A';
            else if (reaccionaB) grupo = 'B';
            else grupo = 'O';
            factorRh = reaccionaRh ? 'Positivo (+)' : 'Negativo (-)';
        }

        var resultadoABO = document.getElementById('grupoSanguineoResultado');
        var resultadoRh = document.getElementById('factorRhResultado');
        if (resultadoABO) resultadoABO.value = grupo;
        if (resultadoRh) resultadoRh.value = factorRh;

        var estadoA = document.getElementById('antiAEstado');
        var estadoB = document.getElementById('antiBEstado');
        var estadoD = document.getElementById('antiDEstado');
        if (estadoA) estadoA.textContent = antiA.value === '' ? 'Pendiente' : (reaccionaA ? 'Hay reacción' : 'No hay reacción');
        if (estadoB) estadoB.textContent = antiB.value === '' ? 'Pendiente' : (reaccionaB ? 'Hay reacción' : 'No hay reacción');
        if (estadoD) estadoD.textContent = antiD.value === '' ? 'Pendiente' : (reaccionaRh ? 'Hay reacción' : 'No hay reacción');

        var examenes = window.examenesOrden || [];
        var examenABO = examenes.find(function(examen) { return examen.id === 'grupo_sanguineo_abo'; });
        var examenRh = examenes.find(function(examen) { return examen.id === 'factor_rh'; });
        if (examenABO) examenABO.resultado = grupo;
        if (examenRh) examenRh.resultado = factorRh;

        var resultadoTexto = document.getElementById('resultadoTexto');
        var resultadoCaja = document.getElementById('resultadoCaja');
        if (resultadoTexto) {
            resultadoTexto.innerText = entradasCompletas
                ? 'Grupo Sanguíneo: ' + grupo + ' ' + factorRh
                : 'Complete las reacciones para determinar el grupo sanguíneo';
        }
        if (resultadoCaja) resultadoCaja.style.display = entradasCompletas ? 'block' : 'none';

        return entradasCompletas ? { grupo: grupo, factorRh: factorRh } : null;
    };

    // LÍNEA ~227: Diálogo de confirmación personalizado con botones "No" / "Sí"
    // Uso: window.confirmar('¿Desea...?').then(function(resultado) { if (resultado) { ... } })
    function confirmar(mensaje) {
        return new Promise(function(resolve) {
            var modalId = 'modal-confirm-' + Date.now();
            var html =
                '<div class="modal fade" id="' + modalId + '" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">' +
                '<div class="modal-dialog modal-dialog-centered">' +
                '<div class="modal-content">' +
                '<div class="modal-header"><h5 class="modal-title">Confirmación</h5></div>' +
                '<div class="modal-body"><p class="mb-0">' + mensaje.replace(/\n/g, '<br>') + '</p></div>' +
                '<div class="modal-footer">' +
                '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">No</button>' +
                '<button type="button" class="btn btn-success">Sí</button>' +
                '</div></div></div></div>';
            
            var div = document.createElement('div');
            div.innerHTML = html;
            document.body.appendChild(div);
            
            var modalEl = div.querySelector('.modal');
            var bsModal = new bootstrap.Modal(modalEl);
            var btnSi = div.querySelector('.btn-success');
            
            var confirmado = false; // Bandera para saber qué botón se pulsó

            // Acción del botón "Sí"
            btnSi.onclick = function() {
                confirmado = true;
                bsModal.hide(); // Esto activará el evento hidden.bs.modal abajo
            };

            // Evento que se dispara al terminar de ocultarse el modal (ya sea por el botón "Sí" o el botón "No")
            modalEl.addEventListener('hidden.bs.modal', function() {
                // Validación para eliminar de forma segura el nodo
                if (document.body.contains(div)) {
                    document.body.removeChild(div);
                }
                // Resuelve la promesa (true si fue Sí, false si fue No u otro botón)
                resolve(confirmado);
            });
            
            bsModal.show();
        });
    }

    window.confirmar = confirmar;

})();