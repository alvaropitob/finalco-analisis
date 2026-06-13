require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
// Servir archivos estáticos (index.html, finalco.png, etc.)
app.use(express.static(__dirname));


// Vercel requiere que validemos si process.env.DATABASE_URL existe
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.post('/api/reportes', async (req, res) => {
  const { infoBasica, resumen, endeudamiento, vigentes, cerradas, consultas, reconocer } = req.body;
  
  if (!infoBasica || !infoBasica.cedula) {
    return res.status(400).json({ success: false, error: 'Faltan datos de Info Básica (cédula)' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    
    // 1. Insertar Reporte
    const repRes = await client.query(`
      INSERT INTO reportes (tipo_doc, cedula, nombre, estado_doc, rango_edad, lugar_expedicion, fecha_expedicion, genero, antiguedad, ubicacion, consultado_por, fecha_consulta, hora_consulta)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      infoBasica.tipoDoc, infoBasica.cedula, infoBasica.nombre, infoBasica.estadoDoc, infoBasica.rangoEdad,
      infoBasica.lugarExpedicion, infoBasica.fechaExpedicion, infoBasica.genero, infoBasica.antiguedad,
      infoBasica.ubicacion, infoBasica.consultadoPor, infoBasica.fechaConsulta, infoBasica.horaConsulta
    ]);
    const reporte_id = repRes.rows[0].id;

    // 2. Resumen Moras
    if (resumen && resumen.moras) {
      await client.query(`
        INSERT INTO resumen_moras (reporte_id, total_moras_max, creditos_mora_30, creditos_mora_60)
        VALUES ($1, $2, $3, $4)
      `, [reporte_id, resumen.moras.totalMorasMax, resumen.moras.creditosMora30, resumen.moras.creditosMora60]);
    }

    // 3. Tendencia
    if (resumen && resumen.tendencia) {
      for (let i = 0; i < resumen.tendencia.length; i++) {
        const t = resumen.tendencia[i];
        await client.query(`
          INSERT INTO tendencia (reporte_id, label, mora, total, sort_index)
          VALUES ($1, $2, $3, $4, $5)
        `, [reporte_id, t.label, t.mora, t.total, i]);
      }
    }

    // 4. Perfil General
    if (resumen && resumen.perfil && resumen.perfil.grid) {
      const { grid, rowLabels, colLabels } = resumen.perfil;
      for (let r = 0; r < rowLabels.length; r++) {
        for (let c = 0; c < colLabels.length; c++) {
          await client.query(`
            INSERT INTO perfil_general (reporte_id, fila_label, columna_label, valor)
            VALUES ($1, $2, $3, $4)
          `, [reporte_id, rowLabels[r], colLabels[c], grid[c][r]]);
        }
      }
    }

    // 5. Endeudamiento
    if (endeudamiento && endeudamiento.sectores) {
      for (const s of endeudamiento.sectores) {
        await client.query(`
          INSERT INTO endeudamiento_sectores (reporte_id, sector, cuota, pct_part, saldo, pct_deuda, vlr_inicial, mora)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [reporte_id, s.sector, s.cuota, s.pctPart, s.saldo, s.pctDeuda, s.vlrInicial, s.mora]);
      }
    }

    // 6. Vigentes
    if (vigentes) {
      for (const v of vigentes) {
        await client.query(`
          INSERT INTO obligaciones_vigentes (reporte_id, entidad, tipo_cuenta, sector, estado, calificacion, saldo_actual, num_cuenta, vlr_inicial, saldo_mora, valor_cuota, fecha_apertura, fecha_vencimiento, fecha_actual, mora_maxima, cuotas_vigencia, pct_deuda, tipo_garantia, marca_clase, estado_titular, oficina, vector_pagos)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        `, [
          reporte_id, v.entidad, v.tipoCuenta, v.sector, v.estado, v.calificacion, v.saldoActual, v.numCuenta, v.vlrInicial,
          v.saldoMora, v.valorCuota, v.fechaApertura, v.fechaVencimiento, v.fechaActual, v.moraMaxima, v.cuotasVigencia,
          v.pctDeuda, v.tipoGarantia, v.marcaClase, v.estadoTitular, v.oficina, v.vector
        ]);
      }
    }

    // 7. Cerradas
    if (cerradas) {
      for (const c of cerradas) {
        await client.query(`
          INSERT INTO obligaciones_cerradas (reporte_id, entidad, tipo_cuenta, estado, calificacion, num_cuenta, vlr_inicial, fecha_apertura, fecha_cierre, oficina)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [reporte_id, c.entidad, c.tipoCuenta, c.estado, c.calificacion, c.numCuenta, c.vlrInicial, c.fechaApertura, c.fechaCierre, c.oficina]);
      }
    }

    // 8. Consultas
    if (consultas) {
      for (const c of consultas) {
        await client.query(`
          INSERT INTO consultas_historicas (reporte_id, fecha, quien, num_consultas)
          VALUES ($1, $2, $3, $4)
        `, [reporte_id, c.fecha, c.quien, c.numConsultas]);
      }
    }

    // 9. Reconocer
    if (reconocer) {
      if (reconocer.telefonos) {
        for (const t of reconocer.telefonos) {
          await client.query(`INSERT INTO reconocer_telefonos (reporte_id, telefono, tipo, ciudad, depto, desde, hasta, reportes, entidades, fuente) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [reporte_id, t.telefono, t.tipo, t.ciudad, t.depto, t.desde, t.hasta, t.reportes, t.entidades, t.fuente]);
        }
      }
      if (reconocer.celulares) {
        for (const c of reconocer.celulares) {
          await client.query(`INSERT INTO reconocer_celulares (reporte_id, celular, reportado_por, desde, hasta, reportes, entidades, fuente) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [reporte_id, c.celular, c.reportadoPor, c.desde, c.hasta, c.reportes, c.entidades, c.fuente]);
        }
      }
      if (reconocer.emails) {
        for (const e of reconocer.emails) {
          await client.query(`INSERT INTO reconocer_emails (reporte_id, email, reportado_por, desde, hasta, reportes, fuente) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [reporte_id, e.email, e.reportadoPor, e.desde, e.hasta, e.reportes, e.fuente]);
        }
      }
      if (reconocer.direcciones) {
        for (const d of reconocer.direcciones) {
          await client.query(`INSERT INTO reconocer_direcciones (reporte_id, direccion, estrato, tipo, ciudad, depto, desde, hasta, reportes, zona, entidades, fuente) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [reporte_id, d.direccion, d.estrato, d.tipo, d.ciudad, d.depto, d.desde, d.hasta, d.reportes, d.zona, d.entidades, d.fuente]);
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, reporte_id, message: 'Datos guardados correctamente en PostgreSQL' });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error guardando en DB:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Inicializar el servidor si no estamos en entorno Serverless (Vercel)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 8765;
  app.listen(PORT, () => console.log(`🚀 API lista en puerto ${PORT}`));
}

module.exports = app;
