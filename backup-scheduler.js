const cron = require('node-cron');
const { createBackup } = require('./backup');

// Cargar variables de entorno
try {
  const fs = require('fs');
  const path = require('path');
  const envBackup = path.join(__dirname, '.env.backup');
  if (fs.existsSync(envBackup)) {
    const envContent = fs.readFileSync(envBackup, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  }
} catch (error) {
  console.log('No se encontró archivo .env.backup, usando configuración por defecto');
}

// Configuración del horario (por defecto a las 2:00 AM todos los días)
const BACKUP_TIME = process.env.BACKUP_TIME || '0 2 * * *';

console.log('\n═══════════════════════════════════════════════');
console.log('  Sistema de Respaldos Automáticos');
console.log('═══════════════════════════════════════════════');
console.log(`  ✓ Respaldos programados: ${BACKUP_TIME}`);
console.log('  ✓ Formato horario: minuto hora día mes día-semana');
console.log('  ✓ Ejemplos:');
console.log('     - 0 2 * * *   = Todos los días a las 2:00 AM');
console.log('     - 0 */6 * * * = Cada 6 horas');
console.log('     - 0 0 * * 0   = Todos los domingos a medianoche');
console.log('═══════════════════════════════════════════════\n');

// Programar respaldo automático
const scheduledTask = cron.schedule(BACKUP_TIME, async () => {
  console.log('\n🕐 Iniciando respaldo programado...');
  try {
    await createBackup();
    console.log('✓ Respaldo programado completado exitosamente');
  } catch (error) {
    console.error('✗ Error en respaldo programado:', error.message);
  }
}, {
  scheduled: true,
  timezone: "America/Mazatlan"
});

function startScheduler() {
  scheduledTask.start();
  console.log('✓ Programador de respaldos iniciado');
  console.log('  Presiona Ctrl+C para detener\n');
  
  process.stdin.resume();
}

function stopScheduler() {
  scheduledTask.stop();
  console.log('\n✓ Programador de respaldos detenido');
}

process.on('SIGINT', () => {
  console.log('\n\n🛑 Deteniendo programador de respaldos...');
  stopScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Deteniendo programador de respaldos...');
  stopScheduler();
  process.exit(0);
});

module.exports = {
  startScheduler,
  stopScheduler,
  scheduledTask
};

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'now') {
    console.log('Ejecutando respaldo inmediato...\n');
    createBackup()
      .then(() => {
        console.log('✓ Respaldo inmediato completado');
        process.exit(0);
      })
      .catch((error) => {
        console.error('✗ Error en respaldo inmediato:', error);
        process.exit(1);
      });
  } else {
    startScheduler();
  }
}
