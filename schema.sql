-- schema.sql
-- Ejecuta este script en tu base de datos local o en Supabase para crear las tablas

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS reportes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_doc VARCHAR(50),
    cedula VARCHAR(50) NOT NULL,
    nombre VARCHAR(255),
    estado_doc VARCHAR(50),
    rango_edad VARCHAR(50),
    lugar_expedicion VARCHAR(255),
    fecha_expedicion VARCHAR(50),
    genero VARCHAR(50),
    antiguedad VARCHAR(50),
    ubicacion VARCHAR(255),
    consultado_por VARCHAR(255),
    fecha_consulta VARCHAR(50),
    hora_consulta VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resumen_moras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporte_id UUID REFERENCES reportes(id) ON DELETE CASCADE,
    total_moras_max VARCHAR(50),
    creditos_mora_30 INT,
    creditos_mora_60 INT
);

CREATE TABLE IF NOT EXISTS tendencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporte_id UUID REFERENCES reportes(id) ON DELETE CASCADE,
    label VARCHAR(50),
    mora NUMERIC,
    total NUMERIC,
    sort_index INT
);

CREATE TABLE IF NOT EXISTS perfil_general (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporte_id UUID REFERENCES reportes(id) ON DELETE CASCADE,
    fila_label VARCHAR(100),
    columna_label VARCHAR(100),
    valor VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS endeudamiento_sectores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporte_id UUID REFERENCES reportes(id) ON DELETE CASCADE,
    sector VARCHAR(100),
    cuota VARCHAR(50),
    pct_part VARCHAR(50),
    saldo VARCHAR(50),
    pct_deuda VARCHAR(50),
    vlr_inicial VARCHAR(50),
    mora VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS obligaciones_vigentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporte_id UUID REFERENCES reportes(id) ON DELETE CASCADE,
    entidad VARCHAR(255),
    tipo_cuenta VARCHAR(100),
    sector VARCHAR(100),
    estado VARCHAR(100),
    calificacion VARCHAR(10),
    saldo_actual VARCHAR(50),
    num_cuenta VARCHAR(100),
    vlr_inicial VARCHAR(50),
    saldo_mora VARCHAR(50),
    valor_cuota VARCHAR(50),
    fecha_apertura VARCHAR(50),
    fecha_vencimiento VARCHAR(50),
    fecha_actual VARCHAR(50),
    mora_maxima VARCHAR(50),
    cuotas_vigencia VARCHAR(50),
    pct_deuda VARCHAR(50),
    tipo_garantia VARCHAR(100),
    marca_clase VARCHAR(100),
    estado_titular VARCHAR(100),
    oficina VARCHAR(100),
    vector_pagos VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS obligaciones_cerradas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporte_id UUID REFERENCES reportes(id) ON DELETE CASCADE,
    entidad VARCHAR(255),
    tipo_cuenta VARCHAR(100),
    estado VARCHAR(100),
    calificacion VARCHAR(10),
    num_cuenta VARCHAR(100),
    vlr_inicial VARCHAR(50),
    fecha_apertura VARCHAR(50),
    fecha_cierre VARCHAR(50),
    oficina VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS consultas_historicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporte_id UUID REFERENCES reportes(id) ON DELETE CASCADE,
    fecha VARCHAR(50),
    quien VARCHAR(255),
    num_consultas INT
);

CREATE TABLE IF NOT EXISTS reconocer_telefonos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporte_id UUID REFERENCES reportes(id) ON DELETE CASCADE,
    telefono VARCHAR(100),
    tipo VARCHAR(100),
    ciudad VARCHAR(255),
    depto VARCHAR(255),
    desde VARCHAR(50),
    hasta VARCHAR(50),
    reportes INT,
    entidades INT,
    fuente VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS reconocer_celulares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporte_id UUID REFERENCES reportes(id) ON DELETE CASCADE,
    celular VARCHAR(100),
    reportado_por VARCHAR(255),
    desde VARCHAR(50),
    hasta VARCHAR(50),
    reportes INT,
    entidades INT,
    fuente VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS reconocer_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporte_id UUID REFERENCES reportes(id) ON DELETE CASCADE,
    email VARCHAR(255),
    reportado_por VARCHAR(255),
    desde VARCHAR(50),
    hasta VARCHAR(50),
    reportes INT,
    fuente VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS reconocer_direcciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporte_id UUID REFERENCES reportes(id) ON DELETE CASCADE,
    direccion TEXT,
    estrato VARCHAR(50),
    tipo VARCHAR(100),
    ciudad VARCHAR(255),
    depto VARCHAR(255),
    desde VARCHAR(50),
    hasta VARCHAR(50),
    reportes INT,
    zona VARCHAR(100),
    entidades INT,
    fuente VARCHAR(255)
);
