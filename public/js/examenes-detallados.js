// --- IGNORE ---
// se usa "Hemograma" para referirse a "Complete Blood Count" (CBC) y "Examen General de Orina" para "Urinalysis".
/**
 * Módulo para gestionar los exámenes detallados
 * 
 */

window.App = window.App || {};
window.App.examenesDetallados = window.App.examenesDetallados || {};
window.App.examenesDetallados.hematologia_completa = {
    nombre: 'Hematología Completa-----',
    items: [
        { id: 'globulos_blancos', nombre: 'Glóbulos Blancos', unidad: 'x10³/µL', refMin: 4.5, refMax: 11.0, grupo: 'Hemograma'},
        { id: 'neutrofilos_num', nombre: 'Neutrófilos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 2.0, refMax: 7.0, tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'linfocitos_num', nombre: 'Linfocitos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 1.0, refMax: 4.0, tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'eosinofilos_num', nombre: 'Eosinófilos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 0.0, refMax: 0.5, tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'monocitos_num', nombre: 'Monocitos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 0.2, refMax: 1.0, tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'basofilos_num', nombre: 'Basófilos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 0.0, refMax: 0.2, tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'neutrofilos_por', nombre: 'Neutrófilos %', unidad: '%', tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'linfocitos_por', nombre: 'Linfocitos %', unidad: '%', tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'eosinofilos_por', nombre: 'Eosinófilos %', unidad: '%', tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'monocitos_por', nombre: 'Monocitos %', unidad: '%', tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'basofilos_por', nombre: 'Basofilos %', unidad: '%', tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'globulos_rojos', nombre: 'Glóbulos Rojos', unidad: 'x10⁶/µL', refMin: 4.0, refMax: 6.0, grupo: 'Hemograma' },
        { id: 'hemoglobina', nombre: 'Hemoglobina', unidad: 'g/dL', refMin: 12.0, refMax: 17.0, grupo: 'Hemograma' },
        { id: 'hematocrito', nombre: 'Hematocrito', unidad: '%', refMin: 36, refMax: 54, grupo: 'Hemograma' },
        { id: 'vcm', nombre: 'V.C.M.', unidad: 'fL', refMin: 80, refMax: 100, grupo: 'Hemograma' },
        { id: 'hcm', nombre: 'H.C.M.', unidad: 'pg', refMin: 27, refMax: 32, grupo: 'Hemograma' },
        { id: 'chcm', nombre: 'C.H.C.M.', unidad: 'g/dL', refMin: 32, refMax: 36, grupo: 'Hemograma' },
        { id: 'rdw_cv', nombre: 'RDW-CV', unidad: '%', refMin: 11.5, refMax: 14.5, grupo: 'Hemograma'},
        { id: 'plaquetas', nombre: 'Plaquetas', unidad: 'x10³/µL', refMin: 150, refMax: 400, grupo: 'Hemograma' },
        { id: 'vpm', nombre: 'V.P.M.', unidad: 'fL', refMin: 7.5, refMax: 11.5, grupo: 'Hemograma' },
        { id: 'pdw', nombre: 'P.D.W.', unidad: 'fL', refMin: 9, refMax: 17, grupo: 'Hemograma' },
        { id: 'plcr', nombre: 'P.LCR', unidad: '%', refMin: 13, refMax: 43, grupo: 'Hemograma' }
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
//

/*
window.App.examenesDetallados.uroanalisis = {
    nombre: 'Uroanálisis',
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

*/


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
