const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const tramitesRoutes = require('./routes/tramites');

// ============================================
// SISTEMA DE RESPALDOS AUTOMÁTICOS
// ============================================
// Descomentar la siguiente línea para activar respaldos automáticos al iniciar el servidor
// const { startScheduler } = require('../backup-scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rutas API
app.use('/api/tramites', tramitesRoutes);

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════');
  console.log('  Sistema de Gestión de Trámites');
  console.log('═══════════════════════════════════════════════');
  console.log(`  ✓ Servidor ejecutándose en: http://localhost:${PORT}`);
  console.log(`  ✓ Base de datos: SQLite (db.sqlite3)`);
  
  // ============================================
  // ACTIVAR RESPALDOS AUTOMÁTICOS
  // ============================================
  // Descomentar las siguientes 2 líneas para activar respaldos automáticos:
  // console.log('  ✓ Sistema de respaldos: Activo');
  // startScheduler();
  
  console.log('═══════════════════════════════════════════════');
});

module.exports = app;
