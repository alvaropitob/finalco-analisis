-- ============================================================================
-- Sprint 2: Schema de base de datos ampliado
-- Ejecutar sobre la BD existente `clientes_credito`
-- ============================================================================

-- ── 1. Ampliar tabla clientes_credito ─────────────────────────────────────

ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    ingresos_mensuales NUMERIC(15,2);
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    gastos_totales NUMERIC(15,2);
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    ingresos_netos NUMERIC(15,2);
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    actividad_economica TEXT;
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    antiguedad_laboral TEXT;
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    personas_a_cargo INTEGER DEFAULT 0;
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    destino_credito TEXT;

-- Datos ADRES
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    estado_adres TEXT;
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    regimen_salud TEXT;
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    tipo_afiliado TEXT;
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    entidad_eps TEXT;

-- Datos Begini
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    score_begini INTEGER;
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    nivel_riesgo_begini TEXT;
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    riesgo_normalizado TEXT;

-- Datos Preselecta
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    score_acierta_mas INTEGER;
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    quanto_ingreso NUMERIC(15,2);
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    decision_preselecta TEXT;
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    pct_endeudamiento NUMERIC(8,4);
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    monto_maximo_aprobado NUMERIC(15,2);

-- Datos RUNT / Activos
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    tiene_vehiculo BOOLEAN DEFAULT FALSE;
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    tiene_propiedad BOOLEAN DEFAULT FALSE;
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    valor_activos NUMERIC(15,2) DEFAULT 0;

-- Solicitud
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    monto_solicitado NUMERIC(15,2);
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    plazo_solicitado INTEGER;

-- Documentos cargados (JSON con rutas y tipos)
ALTER TABLE clientes_credito ADD COLUMN IF NOT EXISTS
    documentos_cargados JSONB DEFAULT '[]'::jsonb;


-- ── 2. Parametrizador de riesgo ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parametros_riesgo (
    id                    SERIAL PRIMARY KEY,
    nombre                TEXT NOT NULL DEFAULT 'Configuración Activa',
    
    -- Tasas
    tasa_ea               NUMERIC(8,4) DEFAULT 0.2426,
    tasa_nominal          NUMERIC(8,4),
    
    -- Costos
    seguro_vida_pct       NUMERIC(6,4) DEFAULT 0.001,
    fianza_pct            NUMERIC(6,4) DEFAULT 0.0,
    gastos_tecnologia     NUMERIC(15,2) DEFAULT 7800,
    administracion        NUMERIC(15,2) DEFAULT 30000,
    iva_pct               NUMERIC(5,4) DEFAULT 0.19,
    
    -- Pesos del scoring (4 ejes)
    peso_capacidad        INTEGER DEFAULT 30,
    peso_comportamiento   INTEGER DEFAULT 30,
    peso_flujo            INTEGER DEFAULT 20,
    peso_entorno          INTEGER DEFAULT 8,
    
    -- Bandas de decisión
    banda_a_corte         INTEGER DEFAULT 80,
    banda_b_corte         INTEGER DEFAULT 65,
    banda_c_corte         INTEGER DEFAULT 50,
    banda_c_menos_corte   INTEGER DEFAULT 40,
    
    -- Capacidad de pago
    factor_nano           NUMERIC(5,4) DEFAULT 0.50,
    gasto_sostenimiento   NUMERIC(5,4) DEFAULT 0.35,
    descuentos_ley_pct    NUMERIC(5,4) DEFAULT 0.08,
    colchon_imprevistos   NUMERIC(5,4) DEFAULT 0.08,
    limite_cuota_ingreso  NUMERIC(5,4) DEFAULT 0.30,
    manutencion_persona   NUMERIC(5,4) DEFAULT 0.10,
    
    -- Umbrales de rechazo
    umbral_mora_evidente  NUMERIC(15,2) DEFAULT 400000,
    mora_vigente_dias     INTEGER DEFAULT 60,
    alerta_consultas_6m   INTEGER DEFAULT 10,
    
    -- Montos por banda
    monto_min_a           NUMERIC(15,2) DEFAULT 400000,
    monto_max_a           NUMERIC(15,2) DEFAULT 600000,
    monto_min_b           NUMERIC(15,2) DEFAULT 300000,
    monto_max_b           NUMERIC(15,2) DEFAULT 400000,
    monto_c               NUMERIC(15,2) DEFAULT 200000,
    
    -- Meta
    activo                BOOLEAN DEFAULT TRUE,
    creado_por            INTEGER REFERENCES usuarios(id),
    fecha_creacion        TIMESTAMP DEFAULT NOW(),
    fecha_modificacion    TIMESTAMP DEFAULT NOW()
);

-- Insertar configuración por defecto si no existe
INSERT INTO parametros_riesgo (nombre, activo)
SELECT 'Configuración Nanocredito Finamigo', TRUE
WHERE NOT EXISTS (SELECT 1 FROM parametros_riesgo WHERE activo = TRUE);


-- ── 3. Tabla de simulaciones guardadas ───────────────────────────────────

CREATE TABLE IF NOT EXISTS simulaciones (
    id                    SERIAL PRIMARY KEY,
    cliente_id            INTEGER REFERENCES clientes_credito(id),
    decision_id           INTEGER REFERENCES decisiones_credito(id),
    
    -- Parámetros de entrada
    monto                 NUMERIC(15,2) NOT NULL,
    plazo_meses           INTEGER NOT NULL,
    tasa_ea               NUMERIC(8,4) NOT NULL,
    tasa_mensual          NUMERIC(12,8),
    
    -- Resultado
    cuota_fija            NUMERIC(15,2),
    seguro_vida           NUMERIC(15,2) DEFAULT 0,
    fianza                NUMERIC(15,2) DEFAULT 0,
    gastos_tecnologia     NUMERIC(15,2) DEFAULT 0,
    administracion        NUMERIC(15,2) DEFAULT 0,
    iva                   NUMERIC(15,2) DEFAULT 0,
    total_a_pagar         NUMERIC(15,2),
    
    -- Tabla completa
    tabla_amortizacion    JSONB,
    resumen               JSONB,
    
    -- Meta
    fecha_simulacion      TIMESTAMP DEFAULT NOW(),
    creado_por            INTEGER REFERENCES usuarios(id)
);


-- ── 4. Scoring multi-fuente ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scoring_multifuente (
    id                    SERIAL PRIMARY KEY,
    cliente_id            INTEGER REFERENCES clientes_credito(id),
    
    -- Puntaje
    puntaje_base          NUMERIC(6,2),
    puntaje_final         NUMERIC(6,2),
    banda                 CHAR(2),
    decision              TEXT,
    
    -- Desglose por eje
    ejes                  JSONB,
    ajustes               JSONB,
    
    -- Pesos y bandas usadas
    pesos_usados          JSONB,
    bandas_usadas         JSONB,
    
    -- Meta
    fecha_scoring         TIMESTAMP DEFAULT NOW()
);


-- ── 5. Historial de cambios del parametrizador ──────────────────────────

CREATE TABLE IF NOT EXISTS historial_parametros (
    id                    SERIAL PRIMARY KEY,
    parametro_id          INTEGER REFERENCES parametros_riesgo(id),
    campo_modificado      TEXT NOT NULL,
    valor_anterior        TEXT,
    valor_nuevo           TEXT,
    modificado_por        INTEGER REFERENCES usuarios(id),
    fecha                 TIMESTAMP DEFAULT NOW(),
    motivo                TEXT
);


-- ── 6. Índices ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_simulaciones_cliente ON simulaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_scoring_cliente ON scoring_multifuente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_parametros_activo ON parametros_riesgo(activo) WHERE activo = TRUE;
