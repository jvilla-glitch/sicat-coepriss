const express = require('express');
const router = express.Router();
const { pool, getNextNoEntrada, formatNoEntrada } = require('../database');
const ExcelJS = require('exceljs');
const multer = require('multer');
const path = require('path');

// Configurar multer
const upload = multer({ dest: 'uploads/' });

// GET - Obtener todos los trámites con paginación
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', estatus = '', capturo = '', fecha = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM tramites WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM tramites WHERE 1=1';
    const params = [];
    const countParams = [];
    let paramIndex = 1;
    let countParamIndex = 1;
    
    if (search) {
      query += ` AND (razon_social ILIKE $${paramIndex} OR no_recibo ILIKE $${paramIndex+1} OR clave_pago_derechos ILIKE $${paramIndex+2})`;
      countQuery += ` AND (razon_social ILIKE $${countParamIndex} OR no_recibo ILIKE $${countParamIndex+1} OR clave_pago_derechos ILIKE $${countParamIndex+2})`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
      countParams.push(searchParam, searchParam, searchParam);
      paramIndex += 3;
      countParamIndex += 3;
    }
    
    if (estatus) {
      query += ` AND estatus = $${paramIndex}`;
      countQuery += ` AND estatus = $${countParamIndex}`;
      params.push(estatus);
      countParams.push(estatus);
      paramIndex++;
      countParamIndex++;
    }
    
    if (capturo) {
      query += ` AND capturo = $${paramIndex}`;
      countQuery += ` AND capturo = $${countParamIndex}`;
      params.push(capturo);
      countParams.push(capturo);
      paramIndex++;
      countParamIndex++;
    }
    
    if (fecha) {
      query += ` AND fecha = $${paramIndex}`;
      countQuery += ` AND fecha = $${countParamIndex}`;
      params.push(fecha);
      countParams.push(fecha);
      paramIndex++;
      countParamIndex++;
    }
    
    query += ` ORDER BY no_entrada DESC LIMIT $${paramIndex} OFFSET $${paramIndex+1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const countResult = await pool.query(countQuery, countParams);
    const tramitesResult = await pool.query(query, params);
    
    const tramites = tramitesResult.rows.map(t => ({
  ...t,
  no_entrada_formatted: formatNoEntrada(t.no_entrada),
  fecha: t.fecha ? t.fecha.toISOString().split('T')[0] : null, // ✅ AGREGAR ESTA LÍNEA
  fecha_oficio: t.fecha_oficio ? t.fecha_oficio.toISOString().split('T')[0] : null, // ✅ AGREGAR ESTA LÍNEA
  pago_estatal: parseFloat(t.pago_estatal),
  pago_federal: parseFloat(t.pago_federal)
}));
    
    res.json({
      data: tramites,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Error al obtener trámites:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener un trámite por ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tramites WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trámite no encontrado' });
    }
    
    const tramite = {
  ...result.rows[0],
  no_entrada_formatted: formatNoEntrada(result.rows[0].no_entrada),
  fecha: result.rows[0].fecha ? result.rows[0].fecha.toISOString().split('T')[0] : null, // ✅ AGREGAR
  fecha_oficio: result.rows[0].fecha_oficio ? result.rows[0].fecha_oficio.toISOString().split('T')[0] : null, // ✅ AGREGAR
  pago_estatal: parseFloat(result.rows[0].pago_estatal),
  pago_federal: parseFloat(result.rows[0].pago_federal)
};
    
    res.json(tramite);
  } catch (error) {
    console.error('Error al obtener trámite:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nuevo trámite
router.post('/', async (req, res) => {
  try {
    const {
      capturo, fecha, ventanilla, no_oficio_foraneo, coordinacion, fecha_oficio,
      razon_social, telefono, tramite, giro, estatus, pago_estatal, no_recibo,
      pago_federal, clave_pago_derechos, observaciones
    } = req.body;
    
    if (!capturo || !fecha || !ventanilla || !razon_social || !estatus) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    const no_entrada = await getNextNoEntrada();
    
    const sql = `
      INSERT INTO tramites (
        capturo, no_entrada, fecha, ventanilla, no_oficio_foraneo, coordinacion,
        fecha_oficio, razon_social, telefono, tramite, giro, estatus,
        pago_estatal, no_recibo, pago_federal, clave_pago_derechos, observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;
    
    const result = await pool.query(sql, [
      capturo, no_entrada, fecha, ventanilla,
      ventanilla === 'foraneo' ? no_oficio_foraneo : null,
      ventanilla === 'foraneo' ? coordinacion : null,
      ventanilla === 'foraneo' ? fecha_oficio : null,
      razon_social, telefono, tramite, giro, estatus,
      pago_estatal || 0, no_recibo || null,
      pago_federal || 0, clave_pago_derechos || null,
      observaciones || null
    ]);
    
    const newTramite = {
      ...result.rows[0],
      no_entrada_formatted: formatNoEntrada(result.rows[0].no_entrada),
      pago_estatal: parseFloat(result.rows[0].pago_estatal),
      pago_federal: parseFloat(result.rows[0].pago_federal)
    };
    
    res.status(201).json(newTramite);
  } catch (error) {
    console.error('Error al crear trámite:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar trámite
router.put('/:id', async (req, res) => {
  try {
    const {
      capturo, fecha, ventanilla, no_oficio_foraneo, coordinacion, fecha_oficio,
      razon_social, telefono, tramite, giro, estatus, pago_estatal, no_recibo,
      pago_federal, clave_pago_derechos, observaciones
    } = req.body;
    
    const sql = `
      UPDATE tramites SET
        capturo = $1, fecha = $2, ventanilla = $3, no_oficio_foraneo = $4,
        coordinacion = $5, fecha_oficio = $6, razon_social = $7, telefono = $8,
        tramite = $9, giro = $10, estatus = $11, pago_estatal = $12, no_recibo = $13,
        pago_federal = $14, clave_pago_derechos = $15, observaciones = $16
      WHERE id = $17
      RETURNING *
    `;
    
    const result = await pool.query(sql, [
      capturo, fecha, ventanilla,
      ventanilla === 'foraneo' ? no_oficio_foraneo : null,
      ventanilla === 'foraneo' ? coordinacion : null,
      ventanilla === 'foraneo' ? fecha_oficio : null,
      razon_social, telefono, tramite, giro, estatus,
      pago_estatal || 0, no_recibo || null,
      pago_federal || 0, clave_pago_derechos || null,
      observaciones || null,
      req.params.id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trámite no encontrado' });
    }
    
    const updatedTramite = {
      ...result.rows[0],
      no_entrada_formatted: formatNoEntrada(result.rows[0].no_entrada),
      pago_estatal: parseFloat(result.rows[0].pago_estatal),
      pago_federal: parseFloat(result.rows[0].pago_federal)
    };
    
    res.json(updatedTramite);
  } catch (error) {
    console.error('Error al actualizar trámite:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar trámite
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM tramites WHERE id = $1 RETURNING id', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trámite no encontrado' });
    }
    
    res.json({ message: 'Trámite eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar trámite:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Dashboard
router.get('/stats/dashboard', async (req, res) => {
  try {
    const estatusStats = await pool.query('SELECT estatus, COUNT(*) as count FROM tramites GROUP BY estatus');
    
    const totales = await pool.query(`
      SELECT 
        SUM(pago_estatal) as total_estatal,
        SUM(pago_federal) as total_federal,
        COUNT(*) as total_tramites
      FROM tramites
    `);
    
    const total_recaudado = (parseFloat(totales.rows[0].total_estatal) || 0) + (parseFloat(totales.rows[0].total_federal) || 0);
    
    res.json({
      estatus: estatusStats.rows,
      total_recaudado,
      total_estatal: parseFloat(totales.rows[0].total_estatal) || 0,
      total_federal: parseFloat(totales.rows[0].total_federal) || 0,
      total_tramites: parseInt(totales.rows[0].total_tramites)
    });
  } catch (error) {
    console.error('Error al obtener dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Exportar a Excel
router.get('/export/excel', async (req, res) => {
  try {
    const { estatus = '', capturo = '', fecha = '' } = req.query;
    
    let query = 'SELECT * FROM tramites WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (estatus) {
      query += ` AND estatus = $${paramIndex}`;
      params.push(estatus);
      paramIndex++;
    }
    
    if (capturo) {
      query += ` AND capturo = $${paramIndex}`;
      params.push(capturo);
      paramIndex++;
    }
    
    if (fecha) {
      query += ` AND fecha = $${paramIndex}`;
      params.push(fecha);
      paramIndex++;
    }
    
    query += ' ORDER BY no_entrada DESC';
    
    const result = await pool.query(query, params);
    const tramites = result.rows;
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Trámites');
    
    worksheet.columns = [
      { header: 'No. Entrada', key: 'no_entrada', width: 12 },
      { header: 'Capturó', key: 'capturo', width: 20 },
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Ventanilla', key: 'ventanilla', width: 12 },
      { header: 'Razón Social', key: 'razon_social', width: 30 },
      { header: 'Teléfono', key: 'telefono', width: 15 },
      { header: 'Trámite', key: 'tramite', width: 25 },
      { header: 'Giro', key: 'giro', width: 20 },
      { header: 'Estatus', key: 'estatus', width: 15 },
      { header: 'Pago Estatal', key: 'pago_estatal', width: 15 },
      { header: 'No. Recibo', key: 'no_recibo', width: 15 },
      { header: 'Pago Federal', key: 'pago_federal', width: 15 },
      { header: 'Clave Pago', key: 'clave_pago_derechos', width: 15 },
      { header: 'Observaciones', key: 'observaciones', width: 30 }
    ];
    
    tramites.forEach(t => {
      worksheet.addRow({
        ...t,
        no_entrada: formatNoEntrada(t.no_entrada)
      });
    });
    
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0070C0' }
    };
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=tramites.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Catálogos
router.get('/catalogos/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    
    if (tipo !== 'tramite' && tipo !== 'giro') {
      return res.status(400).json({ error: 'Tipo inválido' });
    }
    
    const result = await pool.query('SELECT valor FROM catalogos WHERE tipo = $1 ORDER BY valor', [tipo]);
    res.json(result.rows.map(i => i.valor));
  } catch (error) {
    console.error('Error al obtener catálogos:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Generar reporte por rango de fechas
router.get('/reportes/rango', async (req, res) => {
  try {
    const { startDate, endDate, formato = 'json' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Fechas requeridas' });
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'La fecha de inicio debe ser anterior a la fecha fin' });
    }
    
    const query = `
      SELECT * FROM tramites 
      WHERE fecha BETWEEN $1 AND $2
      ORDER BY no_entrada DESC
    `;
    
    const result = await pool.query(query, [startDate, endDate]);
    const tramites = result.rows;
    
    // Calcular totales
    const totales = {
      cantidad: tramites.length,
      pago_estatal: tramites.reduce((sum, t) => sum + (parseFloat(t.pago_estatal) || 0), 0),
      pago_federal: tramites.reduce((sum, t) => sum + (parseFloat(t.pago_federal) || 0), 0)
    };
    totales.total_recaudado = totales.pago_estatal + totales.pago_federal;
    
    // Agrupar por estatus
    const porEstatus = tramites.reduce((acc, t) => {
      acc[t.estatus] = (acc[t.estatus] || 0) + 1;
      return acc;
    }, {});
    
    if (formato === 'excel') {
      // Exportar a Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Reporte de Trámites');
      
      // Agregar título y período
      worksheet.mergeCells('A1:N1');
      worksheet.getCell('A1').value = 'REPORTE DE TRÁMITES';
      worksheet.getCell('A1').font = { bold: true, size: 16 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };
      
      worksheet.mergeCells('A2:N2');
      worksheet.getCell('A2').value = `Período: ${startDate} al ${endDate}`;
      worksheet.getCell('A2').font = { bold: true };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };
      
      // Agregar totales
      worksheet.addRow([]);
      worksheet.addRow(['TOTALES']);
      worksheet.addRow(['Total de trámites:', totales.cantidad]);
      worksheet.addRow(['Pago Estatal:', totales.pago_estatal]);
      worksheet.addRow(['Pago Federal:', totales.pago_federal]);
      worksheet.addRow(['Total Recaudado:', totales.total_recaudado]);
      
      // Agregar tabla de trámites
      worksheet.addRow([]);
      worksheet.addRow([]);
      
      worksheet.columns = [
        { header: 'No. Entrada', key: 'no_entrada', width: 12 },
        { header: 'Capturó', key: 'capturo', width: 20 },
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Ventanilla', key: 'ventanilla', width: 12 },
        { header: 'Razón Social', key: 'razon_social', width: 30 },
        { header: 'Teléfono', key: 'telefono', width: 15 },
        { header: 'Trámite', key: 'tramite', width: 25 },
        { header: 'Giro', key: 'giro', width: 20 },
        { header: 'Estatus', key: 'estatus', width: 15 },
        { header: 'Pago Estatal', key: 'pago_estatal', width: 15 },
        { header: 'No. Recibo', key: 'no_recibo', width: 15 },
        { header: 'Pago Federal', key: 'pago_federal', width: 15 },
        { header: 'Clave Pago', key: 'clave_pago_derechos', width: 15 },
        { header: 'Observaciones', key: 'observaciones', width: 30 }
      ];
      
      tramites.forEach(t => {
        worksheet.addRow({
          ...t,
          no_entrada: formatNoEntrada(t.no_entrada)
        });
      });
      
      // Estilo de encabezados
      const headerRow = worksheet.getRow(10);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0070C0' }
      };
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_${startDate}_${endDate}.xlsx`);
      
      await workbook.xlsx.write(res);
      res.end();
    } else {
      // Devolver JSON
      res.json({
        periodo: {
          inicio: startDate,
          fin: endDate
        },
        totales,
        por_estatus: porEstatus,
        tramites: tramites.map(t => ({
          ...t,
          no_entrada_formatted: formatNoEntrada(t.no_entrada)
        }))
      });
    }
  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
