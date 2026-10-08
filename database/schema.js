'use strict';

/**
 * Esquema relacional normalizado del catálogo de exámenes (SQLite).
 *
 * Jerarquía:
 *   categorias_examenes  -> área / disciplines (Hematología, Uroanálisis, Perfiles...)
 *   examenes             -> la prueba del catálogo ("Hematología Completa", "Urea"...)
 *   parametros_examen    -> los ítems que compone una prueba compuesta
 *   rangos_referencia    -> valores de referencia por sexo y franja etaria
 *   opciones_examen      -> valores de una lista desplegable a nivel de prueba
 *   opciones_parametro   -> valores de una lista desplegable a nivel de parámetro
 *   perfiles             -> paneles/paquetes
 *   perfiles_examenes    -> composición de un perfil (N:M)
 *
 * Las claves son TEXT porque la aplicación ya identifica cada examen por un
 * identificador estable (p. ej. 'hematologia_completa') usado en órdenes e
 * historial; no se renumeran nunca.
 */

const DDL_CATALOGO = `
CREATE TABLE IF NOT EXISTS categorias_examenes (
    id       TEXT PRIMARY KEY,
    nombre   TEXT NOT NULL UNIQUE,
    orden    INTEGER NOT NULL DEFAULT 0,
    activo   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS examenes (
    id              TEXT PRIMARY KEY,
    categoria_id    TEXT NOT NULL,
    nombre          TEXT NOT NULL,
    origen          TEXT NOT NULL DEFAULT 'base',
    unidad          TEXT NOT NULL DEFAULT '',
    tipo            TEXT NOT NULL DEFAULT 'numerico',
    tipo_formulario TEXT,
    grupo           TEXT NOT NULL DEFAULT '',
    valor_defecto   TEXT,
    ref_min         REAL,
    ref_max         REAL,
    ref_texto       TEXT NOT NULL DEFAULT '',
    orden           INTEGER NOT NULL DEFAULT 0,
    activo          INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (categoria_id) REFERENCES categorias_examenes(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS parametros_examen (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    examen_id     TEXT NOT NULL,
    codigo        TEXT NOT NULL,
    nombre        TEXT NOT NULL,
    tipo_dato     TEXT NOT NULL DEFAULT 'numerico',
    tipo_interfaz TEXT NOT NULL DEFAULT 'numerico',
    unidad        TEXT NOT NULL DEFAULT '',
    grupo         TEXT NOT NULL DEFAULT 'General',
    valor_defecto TEXT,
    ref_min       REAL,
    ref_max       REAL,
    ref_texto     TEXT NOT NULL DEFAULT '',
    obligatorio   INTEGER NOT NULL DEFAULT 0,
    orden         INTEGER NOT NULL DEFAULT 0,
    orden_render  INTEGER NOT NULL DEFAULT 0,
    UNIQUE (examen_id, codigo),
    FOREIGN KEY (examen_id) REFERENCES examenes(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS rangos_referencia (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    examen_id      TEXT,
    parametro_id   INTEGER,
    sexo           TEXT NOT NULL DEFAULT 'ambos',
    categoria_edad TEXT NOT NULL DEFAULT 'adulto',
    edad_min       INTEGER,
    edad_max       INTEGER,
    ref_min        REAL,
    ref_max        REAL,
    ref_texto      TEXT NOT NULL DEFAULT '',
    orden          INTEGER NOT NULL DEFAULT 0,
    CHECK (
        (examen_id IS NOT NULL AND parametro_id IS NULL) OR
        (examen_id IS NULL AND parametro_id IS NOT NULL)
    ),
    FOREIGN KEY (examen_id)    REFERENCES examenes(id)            ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (parametro_id) REFERENCES parametros_examen(id)    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS opciones_examen (
    examen_id TEXT NOT NULL,
    orden     INTEGER NOT NULL,
    valor     TEXT NOT NULL,
    PRIMARY KEY (examen_id, orden),
    UNIQUE (examen_id, valor),
    FOREIGN KEY (examen_id) REFERENCES examenes(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS opciones_parametro (
    parametro_id INTEGER NOT NULL,
    orden        INTEGER NOT NULL,
    valor        TEXT NOT NULL,
    PRIMARY KEY (parametro_id, orden),
    UNIQUE (parametro_id, valor),
    FOREIGN KEY (parametro_id) REFERENCES parametros_examen(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS perfiles (
    id     TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    area   TEXT NOT NULL DEFAULT 'Perfiles',
    orden  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS perfiles_examenes (
    perfil_id TEXT NOT NULL,
    examen_id TEXT NOT NULL,
    orden     INTEGER NOT NULL DEFAULT 0,
    grupo     TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (perfil_id, examen_id),
    FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (examen_id) REFERENCES examenes(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_examenes_categoria       ON examenes (categoria_id, orden);
CREATE INDEX IF NOT EXISTS idx_parametros_por_examen    ON parametros_examen (examen_id, orden_render, orden);
CREATE INDEX IF NOT EXISTS idx_parametros_por_codigo    ON parametros_examen (codigo);
CREATE INDEX IF NOT EXISTS idx_rangos_por_examen        ON rangos_referencia (examen_id, orden);
CREATE INDEX IF NOT EXISTS idx_rangos_por_parametro     ON rangos_referencia (parametro_id, orden);
CREATE INDEX IF NOT EXISTS idx_perfiles_examenes_perfil ON perfiles_examenes (perfil_id, orden);
`;

/**
 * Vista de lectura: aplana la matriz de rangos por sexo/edad a columnas para
 * que el renderer pueda consumir una sola fila por parámetro
 * (equivalente a SELECT * FROM parametros_examen WHERE examen_id = ?).
 */
const DDL_VISTAS = `
CREATE VIEW IF NOT EXISTS parametros_examen_rangos AS
SELECT
    p.id            AS id,
    p.codigo        AS codigo,
    p.examen_id     AS examen_id,
    p.nombre        AS nombre,
    p.tipo_dato     AS tipo_dato,
    p.tipo_interfaz AS tipo_interfaz,
    p.unidad        AS unidad,
    p.grupo         AS grupo,
    p.valor_defecto AS valor_defecto,
    p.obligatorio   AS obligatorio,
    p.orden         AS orden,
    p.orden_render  AS orden_render,
    p.ref_min       AS ref_min,
    p.ref_max       AS ref_max,
    p.ref_texto     AS ref_texto,
    MAX(CASE WHEN s.sexo = 'M' AND s.categoria_edad = 'adulto' THEN s.ref_min END) AS ref_min_m_adulto,
    MAX(CASE WHEN s.sexo = 'M' AND s.categoria_edad = 'adulto' THEN s.ref_max END) AS ref_max_m_adulto,
    MAX(CASE WHEN s.sexo = 'F' AND s.categoria_edad = 'adulto' THEN s.ref_min END) AS ref_min_f_adulto,
    MAX(CASE WHEN s.sexo = 'F' AND s.categoria_edad = 'adulto' THEN s.ref_max END) AS ref_max_f_adulto,
    MAX(CASE WHEN s.categoria_edad = 'pediatrico'             THEN s.ref_min END) AS ref_min_pediatrico,
    MAX(CASE WHEN s.categoria_edad = 'pediatrico'             THEN s.ref_max END) AS ref_max_pediatrico
FROM parametros_examen p
LEFT JOIN rangos_referencia r ON r.parametro_id = p.id
LEFT JOIN rangos_referencia s ON s.examen_id = p.codigo
GROUP BY p.id;

/**
 * Vista unificada que resuelve un idresultado del historial tanto si apunta a
 * una prueba del catálogo como a un parámetro de una prueba compuesta.
 * Devuelve exactamente una fila por código: si existe como parámetro,
 * mandan sus valores, y si no, los de la prueba del catálogo.
 */
CREATE VIEW IF NOT EXISTS vw_parametros_catalogo AS
SELECT
    p.codigo AS codigo,
    p.nombre AS nombre,
    COALESCE(NULLIF(p.unidad, ''), e.unidad, '') AS unidad,
    p.ref_min AS ref_min,
    p.ref_max AS ref_max,
    COALESCE(NULLIF(p.ref_texto, ''), e.ref_texto, '') AS ref_texto,
    COALESCE(NULLIF(p.grupo, ''), e.grupo, '') AS grupo,
    MIN(p.orden) AS orden
FROM parametros_examen p
LEFT JOIN examenes e ON e.id = p.codigo
GROUP BY p.codigo
UNION
SELECT
    e.id,
    e.nombre,
    e.unidad,
    e.ref_min,
    e.ref_max,
    e.ref_texto,
    e.grupo,
    0
FROM examenes e
WHERE e.id NOT IN (SELECT codigo FROM parametros_examen);
`;

// Identificadores de tablas/columnas SQLite: solo [A-Za-z0-9_].
const IDENTIFICADOR_SQLITE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function columnasDe(db, tabla) {
    if (!IDENTIFICADOR_SQLITE.test(tabla)) {
        throw new Error('Nombre de tabla no permitido: ' + tabla);
    }
    return db.prepare('PRAGMA table_info(' + tabla + ')').all();
}

function existeTabla(db, tabla) {
    return columnasDe(db, tabla).length > 0;
}

/**
 * El esquema anterior usaba `examenes` como si fuera la tabla de parámetros
 * (columna `examen` apuntando al examen compuesto padre). Se detecta para
 * retirarla y conservar sus filas.
 */
function esEsquemaLegado(db) {
    if (!existeTabla(db, 'examenes')) return false;
    return columnasDe(db, 'examenes').some(function(c) { return c.name === 'examen'; });
}

/**
 * Retira la tabla `examenes` legada conservando sus filas en `examenes_legado`
 * para poder copiar los parámetros que el esquema nuevo representa.
 */
function apartarEsquemaLegado(db) {
    const yaApartada = existeTabla(db, 'examenes_legado');
    const crearCopia = db.transaction(function() {
        if (!yaApartada) {
            db.exec(`
                CREATE TABLE examenes_legado AS
                SELECT id, examen, nombre, area, unidad, refMin, refMax, refTexto, tipo, grupo
                FROM examenes
            `);
        }
        db.exec('DROP TABLE IF EXISTS examenes');
    });
    crearCopia();
}

/**
 * Crea (o actualiza) el esquema completo del catálogo.
 * Es idempotente: se puede invocar en cada arranque de la aplicación.
 */
function crearEsquemaCatalogo(db) {
    const legado = esEsquemaLegado(db);
    db.pragma('foreign_keys = OFF');
    try {
        if (legado) apartarEsquemaLegado(db);
        db.exec('DROP TABLE IF EXISTS examenes_opciones');
        db.exec(DDL_CATALOGO);
        if (!columnasDe(db, 'examenes').some(function(c) { return c.name === 'origen'; })) {
            db.exec("ALTER TABLE examenes ADD COLUMN origen TEXT NOT NULL DEFAULT 'base'");
        }
        db.exec(DDL_VISTAS);
    } finally {
        db.pragma('foreign_keys = ON');
    }
    return { esquemaLegadoMigrado: legado };
}

/**
 * Copia al esquema normalizado los parámetros que solo existían en la tabla
 * legada y que los archivos de configuración ya no declaran.
 * Se ejecuta después de la siembra principal.
 */
function absorberParametrosLegados(db) {
    if (!existeTabla(db, 'examenes_legado')) return 0;

    const copiar = db.transaction(function() {
        const stmtLegado = db.prepare(`
            INSERT INTO parametros_examen
                (examen_id, codigo, nombre, tipo_dato, unidad, grupo, ref_min, ref_max, ref_texto, orden, orden_render)
            SELECT
                l.examen,
                l.id,
                l.nombre,
                COALESCE(NULLIF(l.tipo, ''), 'numerico'),
                COALESCE(l.unidad, ''),
                COALESCE(NULLIF(l.grupo, ''), 'General'),
                l.refMin,
                l.refMax,
                COALESCE(l.refTexto, ''),
                0,
                0
            FROM examenes_legado l
            JOIN examenes e ON e.id = l.examen
            WHERE l.id IS NOT NULL AND l.examen IS NOT NULL
            ON CONFLICT(examen_id, codigo) DO NOTHING
        `);
        stmtLegado.run();
        const info = db.prepare('SELECT COUNT(*) AS total FROM examenes_legado').get();
        db.exec('DROP TABLE examenes_legado');
        return info ? info.total : 0;
    });
    return copiar();
}

/**
 * Sentencias preparadas de solo lectura que consume el proceso principal.
 */
function prepararConsultasCatalogo(db) {
    return {
        categorias: db.prepare(`
            SELECT c.id, c.nombre, c.orden
            FROM categorias_examenes c
            JOIN examenes e ON e.categoria_id = c.id
            WHERE c.activo = 1
            GROUP BY c.id
            ORDER BY c.orden, c.nombre
        `),
        examenes: db.prepare(`
            SELECT e.id, e.categoria_id, c.nombre AS categoria, e.nombre, e.unidad,
                   e.tipo, e.tipo_formulario, e.grupo, e.valor_defecto,
                   e.ref_min, e.ref_max, e.ref_texto, e.orden
            FROM examenes e
            JOIN categorias_examenes c ON c.id = e.categoria_id
            WHERE e.activo = 1
            ORDER BY e.orden, e.nombre
        `),
        categoriasAdmin: db.prepare(`
            SELECT c.id, c.nombre, c.orden
            FROM categorias_examenes c
            JOIN examenes e ON e.categoria_id = c.id
            GROUP BY c.id
            ORDER BY c.orden, c.nombre
        `),
        examenesAdmin: db.prepare(`
            SELECT e.id, e.categoria_id, c.nombre AS categoria, e.nombre, e.unidad,
                   e.tipo, e.tipo_formulario, e.grupo, e.valor_defecto,
                   e.ref_min, e.ref_max, e.ref_texto, e.orden, e.activo
            FROM examenes e
            JOIN categorias_examenes c ON c.id = e.categoria_id
            ORDER BY c.orden, c.nombre, e.orden, e.nombre
        `),
        opcionesExamen: db.prepare(`
            SELECT examen_id, orden, valor FROM opciones_examen ORDER BY examen_id, orden
        `),
        parametros: db.prepare(`
            SELECT * FROM parametros_examen_rangos
            WHERE examen_id = ?
            ORDER BY orden_render, orden
        `),
        todosParametros: db.prepare(`
            SELECT * FROM parametros_examen_rangos ORDER BY examen_id, orden
        `),
        opcionesParametro: db.prepare(`
            SELECT parametro_id, orden, valor FROM opciones_parametro
            ORDER BY parametro_id, orden
        `),
        rangos: db.prepare(`
            SELECT id, examen_id, parametro_id, sexo, categoria_edad,
                   edad_min, edad_max, ref_min, ref_max, ref_texto, orden
            FROM rangos_referencia
            ORDER BY orden, id
        `),
        perfiles: db.prepare(`
            SELECT id, nombre, area FROM perfiles ORDER BY orden, nombre
        `),
        perfilesExamenes: db.prepare(`
            SELECT perfil_id, examen_id, orden FROM perfiles_examenes
            ORDER BY perfil_id, orden
        `),
        catalogoVacio: db.prepare('SELECT COUNT(*) AS total FROM examenes')
    };
}

module.exports = {
    DDL_CATALOGO,
    DDL_VISTAS,
    crearEsquemaCatalogo,
    absorberParametrosLegados,
    prepararConsultasCatalogo,
    existeTabla,
    columnasDe,
    esEsquemaLegado
};
