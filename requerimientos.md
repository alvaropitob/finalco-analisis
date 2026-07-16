Documento de Especificación de Requerimientos: "Motor de Decisión y Simulador de Créditos"
1. Resumen Ejecutivo
El objetivo es desarrollar una aplicación web centralizada que permita a los analistas de crédito cargar documentos de soporte (DataCrédito, ADRES, pruebas psicométricas), parametrizar las políticas de riesgo de la compañía y obtener automáticamente una decisión de aprobación o rechazo, junto con el plan de pagos correspondiente.
2. Definición de Perfiles de Usuario
Administrador de Riesgo: Define las reglas de negocio, tasas de interés, topes de endeudamiento y niveles de riesgo permitidos.
Analista de Crédito: Carga los documentos de los clientes, completa la información faltante y genera los resultados de la solicitud.
3. Requerimientos Funcionales
Módulo A: Ingreso de Datos y Gestión Documental
Carga de Documentos: El sistema permitirá subir archivos PDF para:
Cédula de Ciudadanía.
Reporte de Centrales de Riesgo (DataCrédito/TransUnion).
Consulta ADRES (FOSYGA).
Resultado de prueba psicométrica (Begini).
Extracción y Captura de Datos:
El sistema deberá permitir la entrada manual de campos clave (o mediante OCR en fases avanzadas) tales como: Ingresos mensuales, Gastos totales, Puntaje de crédito, Nivel de riesgo, y Estado de afiliación a salud.
Formulario de Solicitud: Entrada manual del monto solicitado y plazo (meses).
Módulo B: Motor de Decisión (Lógica de Negocio)
El sistema evaluará automáticamente la viabilidad del crédito cruzando la información capturada con los parámetros configurados:
Validación de Identidad: Verificación de datos básicos vs. Cédula.
Validación de Estabilidad: Estado "Activo" en ADRES.
Cálculo de Capacidad de Pago:
Disponible = Ingresos - Gastos - (Cuota Estimada)
% Endeudamiento = (Gastos Totales / Ingresos) * 100
Cruce de Riesgo: Aplicación de una matriz de decisión (Ej: Si Score < X y Riesgo Psicométrico es "Muy Alto" -> Rechazar).
Módulo C: Parametrizador de Riesgo (Panel de Control)
Un módulo exclusivo para el Administrador donde podrá modificar sin programar:
Tasas de Interés: Configuración de Tasa Efectiva Anual (EA) y Nominal según el perfil de riesgo o convenio.
Costos Fijos: Definición de valores para Seguro de Vida, Fianza, Gastos de Tecnología e IVA.
Umbrales de Decisión:
Puntaje de crédito mínimo requerido.
Porcentaje máximo de endeudamiento permitido.
Políticas de exclusión (Ej: no prestar a estados "Inactivos" en salud).
Descuentos: Parametrización de beneficios (Inclusión financiera, convenios, etc.).
Módulo D: Simulador y Amortización
Generación de la tabla de pagos basándose en la estructura del Excel analizado:
Cálculo automático de la Cuota Fija (Sistema Francés).
Desglose de: Capital, Interés, Seguro de Vida y Fianza.
Proyección de fechas de pago automáticas.
4. Requerimientos de Interfaz (UI/UX)
Dashboard de Estado: Indicador visual claro del resultado (Semáforo: Verde-Aprobado, Amarillo-Estudio Manual, Rojo-Rechazado).
Vista Previa de Tabla: Visualización interactiva del plan de pagos.
Exportación: Botón para descargar el resultado y la tabla de amortización en formato PDF.
Diseño Responsivo: Optimizado para uso en computadoras de escritorio y tablets.
5. Especificaciones Técnicas (Sugeridas)
Frontend: React.js con Tailwind CSS (para una interfaz limpia y moderna).
Gestión de Estado: Context API o Redux Toolkit.
Cálculos Financieros: Librerías de precisión decimal para evitar errores de redondeo presentes en Excel.
Seguridad: Autenticación de usuarios y cifrado de documentos cargados.
6. Lógica de Evaluación (Ejemplo de Reglas)
Para que el crédito sea Aprobado, se deben cumplir simultáneamente:
Estado Laboral: ADRES = "Activo".
Capacidad: % Endeudamiento < [Valor Parametrizado, ej: 50%].
Puntaje: Score DataCrédito > [Valor Parametrizado, ej: 600].
Psicometría: Nivel de riesgo diferente a "Very High Risk" (según el apetito de riesgo configurado en el parametrizador).
7. Estructura de la Tabla de Amortización (Salida)
El sistema debe replicar el cálculo del Excel:
Interés Mensual: Convertido a partir de la Tasa EA configurada.
Seguro de Vida: Proporcional al saldo o monto.
Fianza: Calculada según los parámetros de la empresa.
Cargos de Tecnología y Administración: Sumados al gran total de la deuda.


Adjunto envío el formato de Excel ajustado con las variables que quisiéramos incorporar en el modelo del motor de decisión, las cuales serían extraídas de diferentes fuentes como son:


Datacredito
Adress
Runt / Registro casa
Digiventure (o formulario de solicitud)
Begini (es un score comportamental, lo tienen algunos clientes, otros no
CC se anexa, pero si no se requiere el PDF solo no usarlo y ya.
 

Se anexa la información del señor

RUIZ 1216971324 (sin/poca experiencia)
Daniel Fabian Ortiz Motta 1110485228
Katherine lorena Beltran Gaitan  1104701529
 

Así mismo se anexa el formato de Analisis con variables y puntuaciones que permite de 1 a 100 dar una calificación a cada cliente