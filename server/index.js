const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const tramitesRoutes = require('./routes/tramites');

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

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════');
  console.log('  Sistema de Gestión de Trámites - SICAT COEPRISS');
  console.log('═══════════════════════════════════════════════');
  console.log(`  ✓ Servidor ejecutándose en: http://localhost:${PORT}`);
  console.log(`  ✓ Base de datos: PostgreSQL`);
  console.log(`  ✓ Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log('═══════════════════════════════════════════════');
});

module.exports = app;
