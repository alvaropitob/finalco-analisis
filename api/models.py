from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, EmailStr, Field


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    rol: str
    nombre: str

class RefreshRequest(BaseModel):
    refresh_token: str

class UsuarioCreate(BaseModel):
    email: str
    nombre: str
    password: str
    rol: Literal["admin", "analista", "asesor", "cliente"]

class UsuarioResponse(BaseModel):
    id: int
    email: str
    nombre: str
    rol: str
    activo: bool


# ── Tipos de Producto ─────────────────────────────────────────────────────────

class TipoProductoResponse(BaseModel):
    id: int
    codigo: str
    nombre: str
    descripcion: Optional[str]
    activo: bool


# ── Rule Engine — Esquema genérico de reglas ──────────────────────────────────

class CriterioElegibilidad(BaseModel):
    campo: str = Field(..., description="Campo del cliente a evaluar, ej: 'score_datacredito'")
    operador: Literal[">=", "<=", "==", "!=", "in", "not_in"]
    valor: Union[float, int, bool, str, List[str]]
    peso: int = Field(..., ge=0, le=100, description="Peso en el score total (0-100)")
    mensaje_rechazo: str
    obligatorio: bool = True

class CondicionesCredito(BaseModel):
    monto_minimo: float = 500_000
    monto_maximo_base: float = 50_000_000
    tasa_base_anual_pct: float = 24.0
    ajuste_tasa_riesgo_medio_pct: float = 4.0
    plazo_minimo_meses: int = 3
    plazo_maximo_meses: int = 60
    factor_capacidad_pago: float = 0.30
    score_minimo_aprobacion: int = 60
    score_revision_manual: int = 40

class EsquemaReglas(BaseModel):
    elegibilidad: List[CriterioElegibilidad]
    condiciones: Dict[str, Any]

class ReglaNegocioCreate(BaseModel):
    tipo_producto_codigo: str
    nombre: str
    descripcion: Optional[str] = ""
    esquema: EsquemaReglas

class ReglaNegocioResponse(BaseModel):
    id: int
    tipo_producto_codigo: str
    tipo_producto_nombre: str
    nombre: str
    descripcion: Optional[str]
    version: int
    activa: bool
    esquema: dict
    fecha_creacion: str
    fecha_activacion: Optional[str]

class ActivarReglaRequest(BaseModel):
    motivo: Optional[str] = "Activación manual"

class VersionReglaResponse(BaseModel):
    id: int
    version: int
    esquema_anterior: Optional[dict]
    esquema_nuevo: dict
    fecha: str
    motivo: Optional[str]


# ── Decisiones ────────────────────────────────────────────────────────────────

class EvaluarRequest(BaseModel):
    monto_solicitado: float = Field(..., gt=0)
    regla_id: Optional[int] = None
    tipo_producto_codigo: Optional[str] = "credito"

class DecisionResponse(BaseModel):
    decision: Literal["aprobado", "rechazado", "revision_manual"]
    score: int
    motivos_rechazo: List[str]
    condiciones: List[str]
    monto_aprobado: Optional[float]
    tasa_interes_anual: Optional[float]
    plazo_maximo_meses: Optional[int]
    justificacion_ia: str
    regla_aplicada: str
    tipo_producto: str


# ── Clientes ──────────────────────────────────────────────────────────────────

class AnalizarRequest(BaseModel):
    carpeta: str


# ── Documentos (API legacy) ───────────────────────────────────────────────────

class PoliticaLegacyRequest(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    criterios: dict
    creada_por: Optional[str] = "usuario"


# ── Sprint 2: Simulador ──────────────────────────────────────────────────────

class SimulacionRequest(BaseModel):
    monto: float = Field(..., gt=0, description="Monto del crédito en COP")
    plazo_meses: int = Field(..., ge=1, le=60, description="Plazo en meses")
    tasa_ea: Optional[float] = Field(None, description="Tasa EA como decimal (ej: 0.2426). Si es None, se usa la del parametrizador")
    seguro_vida_pct: Optional[float] = 0.001
    fianza_pct: Optional[float] = 0.0
    gastos_tecnologia: Optional[float] = 7800
    iva_pct: Optional[float] = 0.19
    cliente_id: Optional[int] = None

class SimulacionResponse(BaseModel):
    id: Optional[int] = None
    resumen: dict
    tabla: list


# ── Sprint 2: Scoring ────────────────────────────────────────────────────────

class ScoringResponse(BaseModel):
    puntaje_base: float
    puntaje_final: float
    banda: str
    decision: str
    monto_rango_sugerido: str
    ejes: dict
    ajustes: dict


# ── Sprint 2: Parametrizador ─────────────────────────────────────────────────

class ParametrosRiesgoRequest(BaseModel):
    tasa_ea: Optional[float] = None
    seguro_vida_pct: Optional[float] = None
    fianza_pct: Optional[float] = None
    gastos_tecnologia: Optional[float] = None
    administracion: Optional[float] = None
    iva_pct: Optional[float] = None
    peso_capacidad: Optional[int] = None
    peso_comportamiento: Optional[int] = None
    peso_flujo: Optional[int] = None
    peso_entorno: Optional[int] = None
    banda_a_corte: Optional[int] = None
    banda_b_corte: Optional[int] = None
    banda_c_corte: Optional[int] = None
    banda_c_menos_corte: Optional[int] = None
    factor_nano: Optional[float] = None
    umbral_mora_evidente: Optional[float] = None
    mora_vigente_dias: Optional[int] = None
    alerta_consultas_6m: Optional[int] = None
    monto_min_a: Optional[float] = None
    monto_max_a: Optional[float] = None
    monto_min_b: Optional[float] = None
    monto_max_b: Optional[float] = None
    monto_c: Optional[float] = None

