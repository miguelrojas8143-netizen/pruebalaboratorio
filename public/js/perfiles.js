/**
 * Módulo para gestionar los perfiles de exámenes
 */
window.App = window.App || {};
window.App.perfiles = window.App.perfiles || {};



window.App.perfiles.perfil_preoperatorio = {
    id: 'perfil_preoperatorio',
    nombre: 'Perfil Preoperatorio',
    area: 'Perfiles',
    examenes: [
        { id: 'hematologia_completa', nombre: 'Hematología Completa', area: 'Hematología', unidad: '', tipo: 'perfil' },
        { id: 'tiempo_protrombina', nombre: 'Tiempo de Protrombina (TP)', area: 'Coagulación', unidad: 'seg', refMin: 11, refMax: 13.5 },
        { id: 'tiempo_tromboplastina', nombre: 'Tiempo de Tromboplastina Parcial (TTP)', area: 'Coagulación', unidad: 'seg', refMin: 25, refMax: 35 },
        { id: 'glicemia_basal', nombre: 'Glicemia Basal', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 70, refMax: 100 },
        { id: 'vdrl', nombre: 'V.D.R.L.', area: 'Inmunología', unidad: '', tipo: 'texto' },
        { id: 'uroanalisis', nombre: 'Uroanálisis', area: 'Uroanálisis', unidad: '', tipo: 'uroanalisis' },
       //{id: 'examen_heces', nombre: 'Examen de Heces', area: 'Coproanálisis', unidad: '', tipo: 'heces' },
        { id: 'grupo_sanguineo', nombre: 'Grupo Sanguíneo', area: 'Hematología', unidad: '', tipo: 'texto' },
        { id: 'creatinina', nombre: 'Creatinina', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 0.7, refMax: 1.3 },
        { id: 'urea', nombre: 'Urea', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 10, refMax: 40 },
        { id: 'hbsag', nombre: 'Antígeno de Superficie Hep. B (HBsAg)', area: 'Inmunología', unidad: '', tipo: 'texto' }
    ]
};

window.App.perfiles.tipo_sanguineo_completo = {
    id: 'tipo_sanguineo_completo',
    nombre: 'Tipo Sanguíneo Completo',
    area: 'Hematología',
    examenes: [
        { id: 'grupo_sanguineo_abo', nombre: 'Grupo Sanguíneo ABO', area: 'Hematología', unidad: '', tipo: 'tipo_sanguineo' },
        { id: 'factor_rh', nombre: 'Factor Rh', area: 'Hematología', unidad: '', tipo: 'tipo_sanguineo' }
    ]
};
window.App.perfiles.perfil_hepatico = {
    id: 'perfil_hepatico',
    nombre: 'Perfil Hepático',
    area: 'Perfiles',
    examenes: [
        { id: 'ggt', nombre: 'G.G.T.', area: 'Química Sanguínea', unidad: 'U/L', refMin: 0, refMax: 50 },
        { id: 'proteinas_totales', nombre: 'Proteínas Totales y Albúmina', area: 'Química Sanguínea', unidad: 'g/dL', refMin: 6.5, refMax: 8.5 },
        { id: 'albumina', nombre: 'Albúmina', area: 'Química Sanguínea', unidad: 'g/dL', refMin: 3.5, refMax: 5.5 },
        { id: 'bilirrubina_total', nombre: 'Bilirrubina Total y Fraccionada', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 0, refMax: 1.3 },
        { id: 'bilirrubina_directa', nombre: 'Bilirrubina Directa', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 0, refMax: 0.2 },
        { id: 'fosfatasa_alcalina', nombre: 'Fosfatasa Alcalina', area: 'Química Sanguínea', unidad: 'U/L', refMin: 30, refMax: 120 },
        { id: 'tgo', nombre: 'Transaminasas TGO', area: 'Química Sanguínea', unidad: 'U/L', refMin: 5, refMax: 40 },
        { id: 'tgp', nombre: 'Transaminasas TGP', area: 'Química Sanguínea', unidad: 'U/L', refMin: 7, refMax: 56 },
        { id: 'hematologia_completa', nombre: 'Hematología Completa', area: 'Hematología', unidad: '', tipo: 'perfil' },
        { id: 'tiempo_protrombina', nombre: 'Tiempo de Protrombina', area: 'Coagulación', unidad: 'seg', refMin: 11, refMax: 13.5 },
        { id: 'colesterol_total', nombre: 'Colesterol', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 0, refMax: 200 },
        { id: 'ldh', nombre: 'Deshidrogenasa Láctica', area: 'Química Sanguínea', unidad: 'U/L', refMin: 200, refMax: 480 }
    ]
};
window.App.perfiles.perfil_prenatal = {
    id: 'perfil_prenatal',
    nombre: 'Perfil Pre-Natal',
    area: 'Perfiles',
    examenes: [
        { id: 'hematologia_completa', nombre: 'Hematología Completa', area: 'Hematología', unidad: '', tipo: 'perfil' },
        { id: 'grupo_sanguineo', nombre: 'Grupo Sanguíneo', area: 'Hematología', unidad: '', tipo: 'texto' },
        { id: 'glicemia_basal', nombre: 'Glicemia', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 70, refMax: 100 },
        { id: 'vdrl', nombre: 'V.D.R.L.', area: 'Inmunología', unidad: '', tipo: 'texto' },
        { id: 'examen_orina', nombre: 'Examen de Orina', area: 'Uroanálisis', unidad: '', tipo: 'uroanalisis' },
        { id: 'toxoplasmosis_igg', nombre: 'Toxoplasmosis Ig G', area: 'Inmunología', unidad: '', tipo: 'texto' },
        { id: 'toxoplasmosis_igm', nombre: 'Toxoplasmosis Ig M', area: 'Inmunología', unidad: '', tipo: 'texto' },
        { id: 'hiv', nombre: 'H.I.V.', area: 'Inmunología', unidad: '', tipo: 'texto' },
        { id: 'creatinina', nombre: 'Creatinina', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 0.7, refMax: 1.3 },
        { id: 'urea', nombre: 'Urea', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 10, refMax: 40 },
        { id: 'hbsag', nombre: 'Antígeno de Superficie', area: 'Inmunología', unidad: '', tipo: 'texto' }
    ]
};
window.App.perfiles.perfil_reumatoide = {
    id: 'perfil_reumatoide',
    nombre: 'Perfil Reumatoide',
    area: 'Perfiles',
    examenes: [
        { id: 'hematologia_completa', nombre: 'Hematología Completa', area: 'Hematología', unidad: '', tipo: 'perfil' },
        { id: 'factor_reumatoide', nombre: 'R.A. Test', area: 'Inmunología', unidad: 'UI/mL', refMin: 0, refMax: 14 },
        { id: 'vsg', nombre: 'V.S.G.', area: 'Hematología', unidad: 'mm/h', refMin: 0, refMax: 20 },
        { id: 'vdrl', nombre: 'V.D.R.L.', area: 'Inmunología', unidad: '', tipo: 'texto' },
        { id: 'proteina_c_reactiva', nombre: 'Proteína C Reactiva', area: 'Inmunología', unidad: 'mg/L', refMin: 0, refMax: 5 },
        { id: 'asto', nombre: 'ASTO', area: 'Inmunología', unidad: 'UI/mL', refMin: 0, refMax: 200 },
        { id: 'acido_urico', nombre: 'Ácido Úrico', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 2.4, refMax: 6.5 }
    ]
};
window.App.perfiles.perfil_veinte = {
    id: 'perfil_veinte',
    nombre: 'Perfil Veinte',
    area: 'Perfiles',
    examenes: [
        { id: 'hematologia_completa', nombre: 'Hematología Completa', area: 'Hematología', unidad: '', tipo: 'perfil' },
        { id: 'trigliceridos', nombre: 'Triglicéridos', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 0, refMax: 150 },
        { id: 'colesterol_total', nombre: 'Colesterol Total y Fraccionado', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 0, refMax: 200 },
        { id: 'colesterol_hdl', nombre: 'Colesterol HDL', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 40, refMax: 60 },
        { id: 'glicemia_basal', nombre: 'Glicemia', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 70, refMax: 100 },
        { id: 'calcio', nombre: 'Calcio', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 8.5, refMax: 10.5 },
        { id: 'fosforo', nombre: 'Fósforo', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 2.9, refMax: 4.7 },
        { id: 'acido_urico', nombre: 'Ácido Úrico', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 2.4, refMax: 6.5 },
        { id: 'creatinina', nombre: 'Creatinina', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 0.7, refMax: 1.3 },
        { id: 'urea', nombre: 'Urea', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 10, refMax: 40 },
        { id: 'tgo', nombre: 'TGO', area: 'Química Sanguínea', unidad: 'U/L', refMin: 5, refMax: 40 },
        { id: 'tgp', nombre: 'TGP', area: 'Química Sanguínea', unidad: 'U/L', refMin: 7, refMax: 56 },
        { id: 'examen_orina', nombre: 'Orina', area: 'Uroanálisis', unidad: '', tipo: 'uroanalisis' },
        { id: 'examen_heces', nombre: 'Heces', area: 'Coproanálisis', unidad: '', tipo: 'heces' }
    ]
};
window.App.perfiles.perfil_lipidico = {
    id: 'perfil_lipidico',
    nombre: 'Perfil Lipídico',
    area: 'Perfiles',
    examenes: [
        { id: 'colesterol_total', nombre: 'Colesterol Total', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 0, refMax: 200 },
        { id: 'colesterol_hdl', nombre: 'Colesterol HDL', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 40, refMax: 60 },
        { id: 'trigliceridos', nombre: 'Triglicéridos', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 0, refMax: 150 }
    ]
};
window.App.perfiles.perfil_renal = {
    id: 'perfil_renal',
    nombre: 'Perfil Renal',
    area: 'Perfiles',
    examenes: [
        { id: 'urea', nombre: 'Urea', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 10, refMax: 40 },
        { id: 'creatinina', nombre: 'Creatinina', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 0.7, refMax: 1.3 },
        { id: 'acido_urico', nombre: 'Ácido Úrico', area: 'Química Sanguínea', unidad: 'mg/dL', refMin: 2.4, refMax: 6.5 },
        { id: 'examen_orina', nombre: 'Examen de Orina', area: 'Uroanálisis', unidad: '', tipo: 'perfil' }
    ]
};
window.App.perfiles.perfil_secrecion_vaginal = {
    id: 'perfil_secrecion_vaginal',
    nombre: 'Perfil de Secreción Vaginal',
    area: 'Perfiles',
    examenes: [
        { id: 'trofozoitos_trichomonas', nombre: 'Trofozoitos de Trichomonas vaginalis', area: 'Secreción Vaginal', tipo: 'seleccion_unica', grupo: 'Examen Directo' },
        { id: 'elementos_micoticos_directo', nombre: 'Elementos Micóticos', area: 'Secreción Vaginal', tipo: 'seleccion_unica', grupo: 'Examen Directo' },
        { id: 'pmn_directo', nombre: 'Polimorfonucleares (PMN)', area: 'Secreción Vaginal', tipo: 'seleccion_unica', grupo: 'Examen Directo' },
        { id: 'celulas_clave_directo', nombre: 'Células Clave', area: 'Secreción Vaginal', tipo: 'seleccion_unica', grupo: 'Examen Directo' },
        { id: 'hematies_directo', nombre: 'Hematíes', area: 'Secreción Vaginal', tipo: 'seleccion_unica', grupo: 'Examen Directo' },
        { id: 'bacterias_gram', nombre: 'Bacterias (Gram)', area: 'Secreción Vaginal', tipo: 'multiselect_cantidad', grupo: 'Coloración de Gram' },
        { id: 'elementos_micoticos_gram', nombre: 'Elementos Micóticos', area: 'Secreción Vaginal', tipo: 'multiselect_cantidad', grupo: 'Coloración de Gram' },
        { id: 'pmn_gram', nombre: 'Polimorfonucleares (PMN)', area: 'Secreción Vaginal', tipo: 'seleccion_unica', grupo: 'Coloración de Gram' },
        { id: 'celulas_clave_gram', nombre: 'Células Clave', area: 'Secreción Vaginal', tipo: 'seleccion_unica', grupo: 'Coloración de Gram' },
        { id: 'interpretacion_nugent', nombre: 'Interpretación según Criterios de Nugent', area: 'Secreción Vaginal', tipo: 'seleccion_unica', grupo: 'Coloración de Gram' },
        { id: 'notas_frotis', nombre: 'Notas y Observaciones (Frotis)', area: 'Secreción Vaginal', tipo: 'texto' }
    ]
};

window.App.perfiles.hematologia_completa = {
    id: 'hematologia_completa',
    nombre: 'Hematología Completa',
    area: 'Hematología',
    examenes: [
        { id: 'globulos_blancos', nombre: 'Glóbulos Blancos', area: 'Hematología', unidad: 'x10³/µL', refMin: 4.5, refMax: 11.0, grupo: 'Absolutos' },
        { id: 'neutrofilos_num', nombre: 'Neutrófilos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 2.0, refMax: 7.0, tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'linfocitos_num', nombre: 'Linfocitos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 1.0, refMax: 4.0, tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'eosinofilos_num', nombre: 'Eosinófilos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 0.0, refMax: 0.5, tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'monocitos_num', nombre: 'Monocitos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 0.2, refMax: 1.0, tipo: 'calculado', grupo: 'Absolutos' },
        { id: 'basofilos_num', nombre: 'Basófilos #', area: 'Hematología', unidad: 'x10³/µL', refMin: 0.0, refMax: 0.2, tipo: 'calculado', grupo: 'Absolutos' },
      
      
        { id: 'neutrofilos_por', nombre: 'Neutrófilos %', area: 'Hematología', unidad: '%', refMin: 0, refMax: 0, tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'linfocitos_por', nombre: 'Linfocitos %', area: 'Hematología', unidad: '%', refMin: 0, refMax: 0, tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'eosinofilos_por', nombre: 'Eosinófilos %', area: 'Hematología', unidad: '%', refMin: 0, refMax: 0, tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'monocitos_por', nombre: 'Monocitos %', area: 'Hematología', unidad: '%', refMin: 0, refMax: 0, tipo: 'texto', grupo: 'Porcentuales' },
        { id: 'basofilos_por', nombre: 'Basofilos %', area: 'Hematología', unidad: '%', refMin: 0, refMax: 0, tipo: 'texto', grupo: 'Porcentuales' },
       
        { id: 'globulos_rojos', nombre: 'Glóbulos Rojos', area: 'Hematología', unidad: 'x10⁶/µL', refMin: 4.0, refMax: 6.0, grupo: 'Hemograma' },
        { id: 'hemoglobina', nombre: 'Hemoglobina', area: 'Hematología', unidad: 'g/dL', refMin: 12.0, refMax: 17.0, grupo: 'Hemograma' },
        { id: 'hematocrito', nombre: 'Hematocrito', area: 'Hematología', unidad: '%', refMin: 36, refMax: 54, grupo: 'Hemograma' },
        { id: 'vcm', nombre: 'V.C.M.', area: 'Hematología', unidad: 'fL', refMin: 80, refMax: 100, grupo: 'Hemograma' },
        { id: 'hcm', nombre: 'H.C.M.', area: 'Hematología', unidad: 'pg', refMin: 27, refMax: 32, grupo: 'Hemograma' },
        { id: 'chcm', nombre: 'C.H.C.M.', area: 'Hematología', unidad: 'g/dL', refMin: 32, refMax: 36, grupo: 'Hemograma' },
        { id: 'rdw_cv', nombre: 'RDW-CV', area: 'Hematología', unidad: '%', refMin: 11.5, refMax: 14.5, grupo: 'Hemograma' },
        { id: 'plaquetas', nombre: 'Plaquetas', area: 'Hematología', unidad: 'x10³/µL', refMin: 150, refMax: 400, grupo: 'Hemograma' },
        { id: 'vpm', nombre: 'V.P.M.', area: 'Hematología', unidad: 'fL', refMin: 7.5, refMax: 11.5, grupo: 'Hemograma' },
        { id: 'pdw', nombre: 'P.D.W.', area: 'Hematología', unidad: 'fL', refMin: 9, refMax: 17, grupo: 'Hemograma' },
        { id: 'plcr', nombre: 'P.LCR', area: 'Hematología', unidad: '%', refMin: 13, refMax: 43, grupo: 'Hemograma' }
    ]
};


// Sección de perfiles de Uroanálisis

window.App.perfiles.uroanalisis = {
    id: 'uroanalisis',
    nombre: 'Uroanálisis',
    area: 'Uroanálisis',
    examenes: [
        { id: 'uroanalisis', nombre: 'Uroanálisis', area: 'Uroanálisis', unidad: '', tipo: 'uroanalisis' }
    ]
};
