(function() {
    'use strict';

    function normalizarExamen(examen) {
        if (!examen) return examen;
        if (!examen.area) examen.area = 'General';
        if (!examen.tipo) {
            examen.tipo = examen.tipoFormulario === 'heces' ? 'heces' : 'numerico';
        }
        return examen;
    }

    function calcularEstadoPaciente(paciente) {
        var examenes = (paciente.examenes || []).map(normalizarExamen);
        if (examenes.length === 0) return 'en_espera';
        var conResultado = examenes.filter(function(e) {
            if (e.tipoFormulario === 'heces' || e.tipo === 'multiselect_cantidad') {
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

    function tieneDatosHeces(examen) {
        try {
            var datos = JSON.parse(examen.resultado || '{}');
            return Object.keys(datos).length > 0 && Object.values(datos).some(function(v) { return v !== ''; });
        } catch(e) {
            return false;
        }
    }

    function tieneDatosUroanalisis(examen) {
        try {
            var datos = JSON.parse(examen.resultado || '{}');
            return Object.keys(datos).length > 0 && Object.values(datos).some(function(v) { return String(v).trim() !== ''; });
        } catch(e) {
            return false;
        }
    }

    function obtenerValor(examenesOrden, examenId) {
        var examen = examenesOrden.find(function(e) { return e.id === examenId; });
        if (!examen || !examen.resultado) return NaN;
        var valor = parseFloat(examen.resultado.replace(',', '.'));
        return isNaN(valor) ? NaN : valor;
    }

   // window.normalizarExamen = normalizarExamen;
   window.normalizarExamen=normalizarExamen;
    window.calcularEstadoPaciente = calcularEstadoPaciente;
    window.textoEstado = textoEstado;
    window.calcularEdad = calcularEdad;
    window.interpretarSustanciasReductoras = interpretarSustanciasReductoras;
    window.tieneDatosHeces = tieneDatosHeces;
    window.tieneDatosUroanalisis = tieneDatosUroanalisis;
    window.obtenerValor = obtenerValor;

})();
