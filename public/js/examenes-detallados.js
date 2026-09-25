// --- IGNORE ---
// se usa "Hemograma" para referirse a "Complete Blood Count" (CBC) y "Examen General de Orina" para "Urinalysis".
/**
 * Módulo para gestionar los exámenes detallados
 * 
 */

window.App = window.App || {};
window.App.examenesDetallados = window.App.examenesDetallados || {};
window.App.examenesDetallados.hematologia_completa = {
    nombre: 'Hematología Completa',
    items: [
        { id: 'globulos_blancos', nombre: 'Glóbulos Blancos', unidad: 'x10³/µL', refMin: 4.0, refMax: 10.0, grupo: 'Hemograma'},
        { id: 'neutrofilos_num', nombre: 'Neutrófilos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 2.0, refMax: 7.0, tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'linfocitos_num', nombre: 'Linfocitos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 1.0, refMax: 7.0, refTexto: 'A: 1.0-4.0; N: <7.0', tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'eosinofilos_num', nombre: 'Eosinófilos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 0.0, refMax: 0.85, refTexto: 'A <0.45 ; N: <0.85', tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'monocitos_num', nombre: 'Monocitos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 0.0, refMax: 0.8, refTexto: '<0.8', tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'basofilos_num', nombre: 'Basófilos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 0.0, refMax: 0.15, refTexto: '<0.15', tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'neutrofilos_por', nombre: 'Neutrófilos %', unidad: '%', refTexto: '-', tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'linfocitos_por', nombre: 'Linfocitos %', unidad: '%', refTexto: '-', tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'eosinofilos_por', nombre: 'Eosinófilos %', unidad: '%', refTexto: '-', tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'monocitos_por', nombre: 'Monocitos %', unidad: '%', refTexto: '-', tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'basofilos_por', nombre: 'Basófilos %', unidad: '%', refTexto: '-', tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'globulos_rojos', nombre: 'Glóbulos Rojos', unidad: 'x10⁶/µL', refMin: 4.5, refMax: 5.5, grupo: 'Hemograma' },
        { id: 'hemoglobina', nombre: 'Hemoglobina', unidad: 'g/dL', refMin: 12.0, refMax: 18.0, refTexto: 'F: 12.0-16.0; M: 13.0-18.0', grupo: 'Hemograma' },
        { id: 'hematocrito', nombre: 'Hematocrito', unidad: '%', refMin: 38.0, refMax: 54.0, grupo: 'Hemograma' },
        { id: 'vcm', nombre: 'V.C.M.', unidad: 'fL', refMin: 80, refMax: 100, grupo: 'Hemograma' },
        { id: 'hcm', nombre: 'H.C.M.', unidad: 'pg', refMin: 26, refMax: 34, grupo: 'Hemograma' },
        { id: 'chcm', nombre: 'C.H.C.M.', unidad: 'g/dL', refMin: 32, refMax: 36, grupo: 'Hemograma' },
        { id: 'rdw_cv', nombre: 'RDW-CV', unidad: '%', refMin: 0, refMax: 15.1, refTexto: '<15.1', grupo: 'Hemograma'},
        { id: 'plaquetas', nombre: 'Plaquetas', unidad: 'x10³/µL', refMin: 150, refMax: 450, grupo: 'Hemograma' },
        { id: 'vpm', nombre: 'V.P.M.', unidad: 'fL', refMin: 6.5, refMax: 13.5, grupo: 'Hemograma' },
        { id: 'pdw', nombre: 'P.D.W.', unidad: '%', refMin: 0, refMax: 16.8, refTexto: '<16.8', grupo: 'Hemograma' },
        { id: 'plcr', nombre: 'P.LCR', unidad: '%', refMin: 0, refMax: 42.3, refTexto: '<42.3', grupo: 'Hemograma' },
        { id: 'vsg', nombre: 'V.S.G. 1 Hora', unidad: 'mm/h', refMin: 3, refMax: 20, refTexto: 'Niño: 3 - 13 mm/h | Mujer: < 20', grupo: 'Hemograma' }
    ]
};

window.App.examenesDetallados.quimica_perfil_veinte = {
    nombre: 'Perfil veinte',
    items: [
        { id: 'trigliceridos', nombre: 'Triglicéridos', unidad: 'mg/dL', refMin: 0, refMax: 160, grupo: 'Química Sanguínea' },
        { id: 'colesterol_total', nombre: 'Colesterol Total', unidad: 'mg/dL', refMin: 0, refMax: 200, grupo: 'Química Sanguínea' },
        { id: 'colesterol_hdl', nombre: 'HDL Colesterol', unidad: 'mg/dL', refMin: 40, refMax: 60, grupo: 'Química Sanguínea' },
        { id: 'colesterol_ldl', nombre: 'LDL Colesterol', unidad: 'mg/dL', refMin: 0, refMax: 120, grupo: 'Química Sanguínea' },
        { id: 'glicemia_basal', nombre: 'Glicemia', unidad: 'mg/dL', refMin: 70, refMax: 100, grupo: 'Química Sanguínea' },
        { id: 'calcio', nombre: 'Calcio', unidad: 'mg/dL', refMin: 8.5, refMax: 10.5, grupo: 'Química Sanguínea' },
        { id: 'fosforo', nombre: 'Fósforo', unidad: 'mg/dL', refMin: 2.9, refMax: 4.7, grupo: 'Química Sanguínea' },
        { id: 'acido_urico', nombre: 'Ácido Úrico', unidad: 'mg/dL', refMin: 3.5, refMax: 6.5, grupo: 'Química Sanguínea' },
        { id: 'creatinina', nombre: 'Creatinina', unidad: 'mg/dL', refMin: 0.6, refMax: 1.2, grupo: 'Química Sanguínea' },
        { id: 'urea', nombre: 'Urea', unidad: 'mg/dL', refMin: 15, refMax: 40, grupo: 'Química Sanguínea' },
        { id: 'tgo', nombre: 'TGO/AST', unidad: 'U/L', refMin: 5, refMax: 40, grupo: 'Química Sanguínea' },
        { id: 'tgp', nombre: 'TGP/ALT', unidad: 'U/L', refMin: 7, refMax: 56, grupo: 'Química Sanguínea' }
    ]
};
// Hemograma Completo (CBC)Los elementos se definen arriba. A continuación se presentan exámenes detallados adicionales.

// A continuación se presentan exámenes detallados adicionales.
window.App.examenesDetallados.examen_orina = {
    nombre: 'Examen General de Orina',
    items: [
        { id: 'ur_aspecto', nombre: 'Aspecto', unidad: '', tipo: 'seleccion_unica', grupo: 'Macroscópico', opciones: ['Límpido', 'Turbio', 'Ligeramente turbio'] },
        { id: 'ur_color', nombre: 'Color', unidad: '', tipo: 'seleccion_unica', grupo: 'Macroscópico', opciones: ['Amarillo claro', 'Amarillo oscuro', 'Incoloro o amarillo muy pálido', 'Ámbar / Rojizo'] },
        { id: 'ur_olor', nombre: 'Olor', unidad: '', tipo: 'seleccion_unica', grupo: 'Macroscópico', opciones: ['Sui géneris (característica normal)', 'Fétido (amoniacal)', 'Afrutado (cetónico)', 'Fuerte'] },
        { id: 'ur_reaccion', nombre: 'Reacción', unidad: '', tipo: 'seleccion_unica', grupo: 'Químico', opciones: ['Ácida', 'Alcalina'] },
        { id: 'ur_ph', nombre: 'pH', unidad: '', refMin: 4.5, refMax: 8.0, grupo: 'Químico' },
        { id: 'ur_densidad', nombre: 'Densidad', unidad: '', refMin: 1.005, refMax: 1.030, grupo: 'Químico' },
        { id: 'ur_urobilinogeno', nombre: 'Urobilinógeno', unidad: '', tipo: 'seleccion_unica', grupo: 'Químico', opciones: ['Normal', 'Aumentado', 'Disminuido'] },
        { id: 'ur_albumina', nombre: 'Albúmina', unidad: '', tipo: 'seleccion_unica', grupo: 'Químico', opciones: ['Negativo', 'Trazas', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_glucosa', nombre: 'Glucosa', unidad: '', tipo: 'seleccion_unica', grupo: 'Químico', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_cetonas', nombre: 'Cetonas', unidad: '', tipo: 'seleccion_unica', grupo: 'Químico', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_proteinas', nombre: 'Proteínas', unidad: '', tipo: 'seleccion_unica', grupo: 'Químico', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_hemoglobina', nombre: 'Hemoglobina', unidad: '', tipo: 'seleccion_unica', grupo: 'Químico', opciones: ['Negativo', 'Trazas', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_bilirrubina', nombre: 'Bilirrubina', unidad: '', tipo: 'seleccion_unica', grupo: 'Químico', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_nitritos', nombre: 'Nitritos', unidad: '', tipo: 'seleccion_unica', grupo: 'Químico', opciones: ['Negativo', 'Positivo'] },
        { id: 'ur_leucocitos_tira', nombre: 'Leucocitos', unidad: '', tipo: 'seleccion_unica', grupo: 'Químico', opciones: ['Negativo', 'Positivo (+)', 'Positivo (++)', 'Positivo (+++)'] },
        { id: 'ur_leucocitos_micro', nombre: 'Leucocitos (Micro)', unidad: 'cpo/campo', tipo: 'seleccion_unica', grupo: 'Microscópico', opciones: ['0-2 por campo', '3-10 por campo', '11-20 por campo', '21-50 por campo', '> 50 por campo'] },
        { id: 'ur_celulas_epiteliales', nombre: 'Células Epiteliales', unidad: 'cpo/campo', tipo: 'seleccion_unica', grupo: 'Microscópico', opciones: ['Ausentes', 'Escasas', 'Moderadas', 'Abundantes'] },
        { id: 'ur_eritrocitos', nombre: 'Eritrocitos', unidad: 'cpo/campo', tipo: 'seleccion_unica', grupo: 'Microscópico', opciones: ['0-1 por campo', '2-5 por campo', '6-10 por campo', '> 10 por campo'] },
        { id: 'ur_bacterias', nombre: 'Bacterias', unidad: '', tipo: 'seleccion_unica', grupo: 'Microscópico', opciones: ['Ausentes', 'Escasas', 'Moderadas', 'Abundantes'] },
        { id: 'ur_cilindros', nombre: 'Cilindros', unidad: '', tipo: 'seleccion_unica', grupo: 'Microscópico', opciones: ['Ausentes', 'Hialinas', 'Granulosos', 'Eritrocitarios', 'Leucocíticos'] },
        { id: 'ur_cristales', nombre: 'Cristales', unidad: '', tipo: 'seleccion_unica', grupo: 'Microscópico', opciones: ['Ausentes', 'Oxalato de calcio', 'Fosfatos', 'Uratas', 'Carbonatos'] }
    ]
};


// A continuación se presentan exámenes detallados adicionales.
window.App.examenesDetallados.hemoglobina_hematocrito = {
    nombre: 'Hemoglobina + Hematocrito',
    items: [
        { id: 'hemoglobina', nombre: 'Hemoglobina', unidad: 'g/dL', refMin: 12.0, refMax: 17.0, grupo: 'Hemograma' },
        { id: 'hematocrito', nombre: 'Hematocrito', unidad: '%', refMin: 36, refMax: 54, grupo: 'Hemograma' }
    ]
};
// A continuación se presentan exámenes detallados adicionales.
window.App.examenesDetallados.depuracion_creatinina = {
    nombre: 'Depuración de Creatinina',
    items: [
        { id: 'creatinina_orina_24h', nombre: 'Creatinina en Orina 24h', unidad: 'mg/24h', tipo: 'texto', grupo: 'Orina 24h' },
        { id: 'acido_urico_orina_24h', nombre: 'Ácido Úrico en Orina 24h', unidad: 'mg/24h', tipo: 'texto', grupo: 'Orina 24h' },
        { id: 'fosforo_orina_24h', nombre: 'Fósforo en Orina 24h', unidad: 'mg/24h', tipo: 'texto', grupo: 'Orina 24h' },
        { id: 'calcio_orina_24h', nombre: 'Calcio en Orina 24h', unidad: 'mg/24h', tipo: 'texto', grupo: 'Orina 24h' },
        { id: 'creatinina_sangre', nombre: 'Creatinina en Sangre', unidad: 'mg/dL', refMin: 0.7, refMax: 1.3, grupo: 'Sangre' },
        { id: 'depuracion_valor', nombre: 'Depuración (Calculada)', unidad: 'mL/min/1.73m²', tipo: 'texto', grupo: 'Resultado' }
    ]
};
