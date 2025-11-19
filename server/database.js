const { Pool } = require('pg');

// Configuración de PostgreSQL
// Render proporciona DATABASE_URL automáticamente cuando creas una base de datos PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Probar conexión
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error al conectar a la base de datos PostgreSQL:', err);
    process.exit(1);
  } else {
    console.log('✓ Conectado a la base de datos PostgreSQL');
    release();
  }
});

// Crear tablas si no existen
const createTables = async () => {
  try {
    // Crear tabla de trámites
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tramites (
        id SERIAL PRIMARY KEY,
        capturo VARCHAR(255) NOT NULL,
        no_entrada INTEGER UNIQUE NOT NULL,
        fecha DATE NOT NULL,
        ventanilla VARCHAR(50) NOT NULL CHECK(ventanilla IN ('local', 'foraneo')),
        no_oficio_foraneo VARCHAR(255),
        coordinacion VARCHAR(255),
        fecha_oficio DATE,
        razon_social TEXT NOT NULL,
        telefono VARCHAR(50),
        tramite TEXT,
        giro TEXT,
        estatus VARCHAR(50) NOT NULL CHECK(estatus IN ('En proceso', 'Para entregar', 'Entregado')),
        pago_estatal DECIMAL(10,2) DEFAULT 0,
        no_recibo VARCHAR(255),
        pago_federal DECIMAL(10,2) DEFAULT 0,
        clave_pago_derechos VARCHAR(255),
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Crear tabla de catálogos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catalogos (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL CHECK(tipo IN ('tramite', 'giro')),
        valor TEXT NOT NULL UNIQUE
      );
    `);

    console.log('✓ Tablas creadas o verificadas correctamente');
    
    // Insertar datos de ejemplo si no existen
    await seedData();
    
  } catch (error) {
    console.error('Error al crear tablas:', error);
    throw error;
  }
};

// Función para obtener el siguiente no_entrada
async function getNextNoEntrada() {
  try {
    const result = await pool.query('SELECT MAX(no_entrada) as max FROM tramites');
    const nextNum = (result.rows[0].max || 0) + 1;
    return nextNum;
  } catch (error) {
    throw error;
  }
}

// Función para formatear número a 4 dígitos
function formatNoEntrada(num) {
  return String(num).padStart(4, '0');
}

// Insertar datos de ejemplo
async function seedData() {
  try {
    const countResult = await pool.query('SELECT COUNT(*) as count FROM catalogos WHERE tipo = $1', ['tramite']);
    
    if (countResult.rows[0].count > 0) {
      return; // Ya hay datos
    }

    const tramitesEjemplo = [
      'ACTUALIZACION DE CLAVE SCIAN LICENCIA SANITARIA FARMACIA',
      'BALANCE MEDICAMENTOS CONTROLADOS',
      'COFEPRIS-01-024 PERMISO DE SALIDA DEL TERRITORIO NACIONAL DE CELULAS Y TEJIDOS INCLUYENDO SANGRE, SUS COMPONENTES Y DERIVADOS, ASI COMO OTROS PRODUCTOS DE SERES HUMANOS',
      'COFEPRIS-01-027 PERMISO DE LIBROS DE REGISTRO QUE LLEVA EL BANCO DE SANGRE Y SERVICIO DE TRANSFUSION SANGUINEA',
      'COFEPRIS-02-002-A AVISO DE PUBLICIDAD MODALIDAD: ACTIVIDADES PROFESIONALES, TECNICAS, AUXILIARES Y ESPECIALIDADES',
      'COFEPRIS-03-005 PERMISO DE LIBROS DE CONTROL DE ESTUPEFACIENTES Y PSICOTRÓPICOS',
      'COFEPRIS-03-014 AVISO DE PREVISIONES DE COMPRA-VENTA DE MEDICAMENTOS QUE CONTENGAN ESTUPEFACIENTES PARA FARMACIAS, DROGUERIAS Y BOTICA.',
      'COFEPRIS-03-018-A SOLICITUD DE VISITA DE VERIFICACION DE MATERIA PRIMA Y MEDICAMENTOS QUE SEAN O CONTENGAN ESTUPEFACIENTES O PSICOTROPICOS',
      'COFEPRIS-05-001-G SOLICITUD DE EXPEDICION DE LICENCIA SANITARIA PARA ESTABLECIMIENTOS DE INSUMO PARA LA SALUD MODALIDAD G.- FARMACIA O BOTICA (CON VENTA DE MEDICAMENTOS CONTROLADOS)',
      'COFEPRIS-05-006-D AVISO DE FUNCIONAMIENTO Y DE RESPONSABLE SANITARIO DEL ESTABLECIMIENTO DE INSUMOS PARA LA SALUD. D.- FARMACIA ALOPÁTICA O FARMACIA HOMEOPÁTICA (SIN PREPARACIÓN DE ESPECIALIDADES FARMACÉUTICAS) O BOTICA.'
    ];

    const girosEjemplo = [
      '464111 FARMACIAS SIN MINISUPER (SIN MANEJO MEDICAMENTOS QUE CONTENGAN ESTUPEFACIENTES Y PSICOTRÓPICOS; VACUNAS; TOXOIDES; SUEROS Y ANTITOXINAS)',
      '464112 FARMACIAS CON MINISUPER (CON MANEJO MEDICAMENTOS QUE CONTENGAN ESTUPEFACIENTES Y PSICOTRÓPICOS; VACUNAS; TOXOIDES; SUEROS Y ANTITOXINAS)',
      '621112 CONSULTORIOS DE MEDICINA ESPECIALIZADA DEL SECTOR PRIVADO',
      '621115 CLINICAS DE CONSULTORIOS DEL SECTOR PRIVADO',
      '621511 LABORATORIOS MÉDICOS Y DE DIAGNÓSTICO DEL SECTOR PRIVADO (sólo GABINETE DE RAYOS X O MEDICINA NUCLEAR PARA TRATAMIENTO)',
      'ABARROTES',
      'FARMACIA',
      'RESTAURANTE',
      'CAFETERÍA',
      'CONSULTORIO MÉDICO'
    ];

    // Insertar catálogos
    for (const tramite of tramitesEjemplo) {
      await pool.query('INSERT INTO catalogos (tipo, valor) VALUES ($1, $2) ON CONFLICT (valor) DO NOTHING', ['tramite', tramite]);
    }

    for (const giro of girosEjemplo) {
      await pool.query('INSERT INTO catalogos (tipo, valor) VALUES ($1, $2) ON CONFLICT (valor) DO NOTHING', ['giro', giro]);
    }

    console.log('✓ Datos de ejemplo insertados correctamente');
    
  } catch (error) {
    console.error('Error al insertar datos de ejemplo:', error);
  }
}

// Inicializar base de datos
createTables().catch(err => {
  console.error('Error fatal al inicializar la base de datos:', err);
  process.exit(1);
});

module.exports = {
  pool,
  getNextNoEntrada,
  formatNoEntrada
};
