'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const elementosDom = {
    bloqueHeces: { innerHTML: '' },
    bloqueUroanalisis: { innerHTML: '' },
    bloqueAntibiograma: { innerHTML: '' }
};
const document = {
    getElementById: function(id) { return elementosDom[id] || null; },
    createElement: function() { return { className: '', innerHTML: '' }; }
};
const window = {
    App: {},
    detectarPerfilesPaciente: function() { return []; },
    normalizarExamen: function(examen) { return examen; },
    separarVSG: function(examenes) {
        return {
            vsg: examenes.filter(function(examen) { return examen.id === 'vsg'; }),
            otros: examenes.filter(function(examen) { return examen.id !== 'vsg'; })
        };
    },
    aplicarReferenciasAdaptadas: function(paciente, examenes) { return examenes; }
};
window.tieneDatosUroanalisis = function(examen) {
    try {
        const valores = JSON.parse(examen.resultado || '{}');
        return Object.values(valores).some(function(valor) { return String(valor).trim() !== ''; });
    } catch (error) {
        return false;
    }
};
window.tieneDatosHeces = function(examen) {
    try {
        const valores = JSON.parse(examen.resultado || '{}');
        return Object.values(valores).some(function(valor) { return String(valor).trim() !== ''; });
    } catch (error) {
        return false;
    }
};
window.interpretarSustanciasReductoras = function(valor) {
    const resultado = parseFloat(valor);
    return {
        texto: resultado >= 0.25 && resultado <= 0.50 ? 'INDETERMINADO' : 'NEGATIVO',
        clase: ''
    };
};
window.agruparUroanalisisPorGrupo = function(examenes) {
    return examenes.reduce(function(grupos, examen) {
        const grupo = examen.grupo || 'General';
        if (!grupos[grupo]) grupos[grupo] = [];
        grupos[grupo].push(examen);
        return grupos;
    }, {});
};
const contexto = vm.createContext({ window, document, console, Date, JSON, Map, Set });
const raiz = __dirname;

vm.runInContext(fs.readFileSync(path.join(raiz, 'public/js/examenes-detallados.js'), 'utf8'), contexto);
vm.runInContext(fs.readFileSync(path.join(raiz, 'public/js/uroanalisis-form.js'), 'utf8'), contexto);
vm.runInContext(fs.readFileSync(path.join(raiz, 'public/js/pdf.js'), 'utf8'), contexto);

const resultadoBiometria = JSON.stringify({
    globulos_blancos: '7.2',
    hemoglobina: '14.1',
    plaquetas: '230',
    __referencias: { hemoglobina: 'F: 12.0-16.0' }
});
const payload = window.PdfReport.buildPayload({
    nombre: 'Paciente de prueba',
    orden: '001',
    examenes: [{
        id: 'Examen',
        nombre: 'Examen',
        area: 'General',
        tipo: 'numerico',
        resultado: resultadoBiometria
    }]
});

assert.strictEqual(payload.secciones.length, 1);
assert.strictEqual(payload.secciones[0].nombre, 'Hematología');
const filas = payload.secciones[0].subareas.flatMap(function(subarea) { return subarea.rows || []; });
assert.strictEqual(filas.length, 23);
assert.strictEqual(filas.find(function(fila) { return fila.nombre === 'Glóbulos Blancos'; }).texto, '7.2');
assert.strictEqual(filas.find(function(fila) { return fila.nombre === 'Hemoglobina'; }).texto, '14.1');
assert.strictEqual(filas.find(function(fila) { return fila.nombre === 'Hemoglobina'; }).refTexto, 'F: 12.0-16.0');
assert.ok(filas.every(function(fila) { return fila.texto !== resultadoBiometria; }));

const payloadUro = window.PdfReport.buildPayload({
    nombre: 'Paciente de prueba',
    orden: '002',
    examenes: [{
        id: 'Examen',
        nombre: 'Examen',
        area: 'General',
        tipo: 'numerico',
        resultado: JSON.stringify({
            ur_aspecto: 'Turbio',
            ur_ph: '7.0',
            ur_densidad: '1.020',
            ur_bacterias: 'Moderadas'
        })
    }]
});

assert.ok(payloadUro.uro);
assert.strictEqual(payloadUro.secciones.length, 0);
assert.strictEqual(payloadUro.uro.grupos['Macroscópico'][0].nombre, 'Aspecto');
const filaPh = payloadUro.uro.grupos['Químico'].find(function(item) { return item.id === 'ur_ph'; });
assert.strictEqual(filaPh.refTexto, '4.5 - 8.0');
assert.strictEqual(payloadUro.uro.grupos['Químico'].find(function(item) { return item.id === 'ur_densidad'; }).refTexto, '1.005 - 1.030');
assert.strictEqual(Object.keys(payloadUro.uro.grupos).reduce(function(total, grupo) {
    return total + payloadUro.uro.grupos[grupo].length;
}, 0), 21);
assert.strictEqual(payloadUro.uro.grupos['Microscópico'].find(function(item) { return item.id === 'ur_bacterias'; }).nombre, 'Bacterias');
assert.strictEqual(payloadUro.hayResultados, true);
window.PdfReport.renderDom(payloadUro, {});
assert.ok(elementosDom.bloqueUroanalisis.innerHTML.includes('Valor de Referencia'));
assert.ok(elementosDom.bloqueUroanalisis.innerHTML.includes('7.0'));
assert.ok(elementosDom.bloqueUroanalisis.innerHTML.includes('4.5 - 8.0'));
assert.ok(elementosDom.bloqueUroanalisis.innerHTML.includes('cpo/campo'));
assert.ok(!elementosDom.bloqueUroanalisis.innerHTML.includes('"ur_aspecto"'));

const datosHeces = {
    mocoFecal: 'Escaso',
    phHeces: '6.5',
    glucosaHeces: 'Negativa',
    leucocitosPMN: '<observado>',
    leucocitosMononucleados: 'Ausentes',
    sustanciasReductoras: '0.30',
    consistencia: 'Blanda',
    colorHeces: 'Marrón',
    directoConcentracion: 'Sin parásitos',
    entamoebaColi: 'Ausente',
    restosAlimentos: 'Escasos',
    floraBacteriana: 'Normal'
};
const payloadHeces = window.PdfReport.buildPayload({
    nombre: 'Paciente de prueba',
    orden: '003',
    examenes: [{
        id: 'examen_heces',
        nombre: 'Examen Directo de Heces',
        tipoFormulario: 'heces',
        resultado: JSON.stringify(datosHeces)
    }]
});
assert.strictEqual(payloadHeces.heces.ordenGrupos.length, 3);
assert.strictEqual(payloadHeces.heces.grupos['Macroscópico'].length, 3);
assert.strictEqual(payloadHeces.heces.grupos['Químico'].length, 3);
assert.strictEqual(payloadHeces.heces.grupos['Microscópico y parasitológico'].length, 6);
assert.strictEqual(payloadHeces.heces.grupos['Químico'][2].resultado, '0.30 (INDETERMINADO)');
window.PdfReport.renderDom(payloadHeces, {});
// Formato universal: Parámetro | Resultado | Unidad | Valores de Referencia.
assert.ok(elementosDom.bloqueHeces.innerHTML.includes('<th width="35%">Parámetro</th><th width="20%">Resultado</th><th width="15%">Unidad</th>'));
assert.ok(elementosDom.bloqueHeces.innerHTML.includes('Valores de Referencia'));
assert.ok(elementosDom.bloqueHeces.innerHTML.includes('Microscópico y parasitológico'));
assert.ok(elementosDom.bloqueHeces.innerHTML.includes('&lt;observado&gt;'));
assert.ok(!elementosDom.bloqueHeces.innerHTML.includes('<observado>'));
// Regresiones reportadas: ni 'undefined' ni el JSON crudo en ninguna celda.
assert.ok(!elementosDom.bloqueHeces.innerHTML.includes('undefined'));
assert.ok(!elementosDom.bloqueHeces.innerHTML.includes(JSON.stringify(datosHeces)));
assert.ok(elementosDom.bloqueHeces.innerHTML.includes('Moco Fecal'));
assert.ok(elementosDom.bloqueHeces.innerHTML.includes('5.5 - 8'));

const textosPdf = [];
const documentosPdf = [];
class JsPDFPrueba {
    constructor() {
        this.paginas = 1;
        documentosPdf.push(this);
        this.internal = {
            pageSize: {
                getWidth: function() { return 210; },
                getHeight: function() { return 297; }
            }
        };
    }
    addImage() {}
    addPage() { this.paginas++; }
    getNumberOfPages() { return this.paginas; }
    setTextColor() {}
    setFont() {}
    setFontSize() {}
    setFillColor() {}
    setDrawColor() {}
    setLineWidth() {}
    rect() {}
    line() {}
    setProperties() {}
    text(valor) {
        textosPdf.push(Array.isArray(valor) ? valor.join(' ') : String(valor));
    }
    splitTextToSize(valor, ancho) {
        const texto = String(valor);
        const maxCaracteres = Math.max(1, Math.floor(ancho / 1.5));
        if (texto.length <= maxCaracteres) return texto;
        const lineas = [];
        for (let inicio = 0; inicio < texto.length; inicio += maxCaracteres) {
            lineas.push(texto.slice(inicio, inicio + maxCaracteres));
        }
        return lineas;
    }
}
window.jspdf = { jsPDF: JsPDFPrueba };
window.PdfReport.construirPDF(payloadHeces, null);
assert.ok(textosPdf.includes('EXAMEN DE HECES'));
assert.ok(textosPdf.includes('MACROSCÓPICO'));
assert.ok(textosPdf.includes('QUÍMICO'));
assert.ok(textosPdf.includes('MICROSCÓPICO Y PARASITOLÓGICO'));
assert.ok(textosPdf.includes('0.30 (INDETERMINADO)'));
assert.ok(textosPdf.includes('<observado>'));
assert.ok(!textosPdf.includes(JSON.stringify(datosHeces)));

const hecesLargas = JSON.parse(JSON.stringify(payloadHeces));
hecesLargas.heces.grupos['Microscópico y parasitológico'][0].resultado = 'Hallazgo '.repeat(1000);
window.PdfReport.construirPDF(hecesLargas, null);
assert.ok(documentosPdf[1].paginas > 1);
assert.ok(textosPdf.filter(function(texto) { return texto === 'PARÁMETRO'; }).length > 2);

console.log('OK: el PDF estructura resultados de Hematología, Uroanálisis y Heces en tablas.');