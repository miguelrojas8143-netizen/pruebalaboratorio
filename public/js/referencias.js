window.App = window.App || {};
window.App.referencias = window.App.referencias || {};
window.App.referencias.sexSpecific = {
    hemoglobina: {
        adulto:  { M: { refMin: 12.0, refMax: 17.5 }, F: { refMin: 12.0, refMax: 15.5 } },
        pediatrico: { M: { refMin: 10.0, refMax: 13.5 }, F: { refMin: 10.0, refMax: 13.5 } }
    },
    hematocrito: {
        adulto:  { M: { refMin: 36,   refMax: 50 },  F: { refMin: 35,   refMax: 45 }  },
        pediatrico: { M: { refMin: 30,   refMax: 40 },  F: { refMin: 30,   refMax: 40 }  }
    },
    globulos_rojos: {
        adulto:  { M: { refMin: 4.0,  refMax: 6.0 },  F: { refMin: 3.8,  refMax: 5.5 }  },
        pediatrico: { M: { refMin: 3.5,  refMax: 5.5 },  F: { refMin: 3.5,  refMax: 5.2 }  }
    }
};
window.App.referencias.shared = {
    globulos_blancos:  { adulto: { refMin: 4.5,  refMax: 11.0 }, pediatrico: { refMin: 6.0,  refMax: 17.0 } },
    neutrofilos_por:   { adulto: { refMin: 40,   refMax: 70 },  pediatrico: { refMin: 35,   refMax: 65 } },
    neutrofilos_num:   { adulto: { refMin: 2.0,  refMax: 7.0 },  pediatrico: { refMin: 2.0,  refMax: 10.0 } },
    linfocitos_por:    { adulto: { refMin: 20,   refMax: 40 },  pediatrico: { refMin: 30,   refMax: 60 } },
    linfocitos_num:    { adulto: { refMin: 1.0,  refMax: 4.0 },  pediatrico: { refMin: 1.5,  refMax: 6.0 } },
    eosinofilos_por:   { adulto: { refMin: 1,    refMax: 6 },   pediatrico: { refMin: 1,    refMax: 6 } },
    eosinofilos_num:   { adulto: { refMin: 0.0,  refMax: 0.5 },  pediatrico: { refMin: 0.0,  refMax: 0.5 } },
    monocitos_por:     { adulto: { refMin: 2,    refMax: 10 },  pediatrico: { refMin: 2,    refMax: 10 } },
    monocitos_num:     { adulto: { refMin: 0.2,  refMax: 1.0 },  pediatrico: { refMin: 0.2,  refMax: 1.0 } },
    basofilos_por:     { adulto: { refMin: 0,    refMax: 2 },   pediatrico: { refMin: 0,    refMax: 2 } },
    basofilos_num:     { adulto: { refMin: 0.0,  refMax: 0.2 },  pediatrico: { refMin: 0.0,  refMax: 0.2 } },
    vcm:               { adulto: { refMin: 80,   refMax: 100 },  pediatrico: { refMin: 75,   refMax: 95 } },
    hcm:               { adulto: { refMin: 27,   refMax: 32 },   pediatrico: { refMin: 25,   refMax: 30 } },
    chcm:              { adulto: { refMin: 32,   refMax: 36 },   pediatrico: { refMin: 32,   refMax: 36 } },
    rdw_cv:            { adulto: { refMin: 11.5, refMax: 14.5 },  pediatrico: { refMin: 11.5, refMax: 14.5 } },
    plaquetas:         { adulto: { refMin: 150,  refMax: 400 },  pediatrico: { refMin: 150,  refMax: 450 } },
    vpm:               { adulto: { refMin: 7.5,  refMax: 11.5 },  pediatrico: { refMin: 7.5,  refMax: 11.5 } },
    pdw:               { adulto: { refMin: 9,    refMax: 17 },   pediatrico: { refMin: 9,    refMax: 17 } },
    plcr:              { adulto: { refMin: 13,   refMax: 43 },   pediatrico: { refMin: 13,   refMax: 43 } },
    vsg:               { adulto: { refMin: 0,    refMax: 20 },   pediatrico: { refMin: 0,    refMax: 10 } },
    reticulocitos:     { adulto: { refMin: 0.5,  refMax: 1.5 },  pediatrico: { refMin: 0.5,  refMax: 2.0 } },
    eosinofilos_sangre: { adulto: { refMin: 0.0,  refMax: 0.5 },  pediatrico: { refMin: 0.0,  refMax: 0.5 } }
};

function aplicarReferenciasAdaptadas(paciente, examenes) {
    if (!paciente || !paciente.refAdaptadas) return examenes;
    var edad = paciente.edad;
    var sexo = paciente.sexo;
    var esPediatrico = (edad !== null && edad !== undefined && edad !== '' && edad < 18);
    var categoriaEdad = esPediatrico ? 'pediatrico' : 'adulto';

    return examenes.map(function(examen) {
        var copia = JSON.parse(JSON.stringify(examen));
        var refs;

        if (window.App.referencias.sexSpecific[copia.id]) {
            refs = window.App.referencias.sexSpecific[copia.id][categoriaEdad];
            if (refs && refs[sexo]) {
                copia.refMin = refs[sexo].refMin;
                copia.refMax = refs[sexo].refMax;
            }
        } else if (window.App.referencias.shared[copia.id]) {
            refs = window.App.referencias.shared[copia.id][categoriaEdad];
            if (refs) {
                copia.refMin = refs.refMin;
                copia.refMax = refs.refMax;
            }
        }

        return copia;
    });
}

function detectarPerfilesPaciente(paciente) {
    var perfiles = paciente.perfiles || [];
    var nombresPerfiles = perfiles
        .map(function(perfilId) {
            var perfil = window.App.perfiles[perfilId];
            return perfil ? perfil.nombre : null;
        })
        .filter(Boolean);
    return nombresPerfiles;
}

window.aplicarReferenciasAdaptadas = aplicarReferenciasAdaptadas;
window.detectarPerfilesPaciente = detectarPerfilesPaciente;
