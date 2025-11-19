const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const readline = require('readline');

const BACKUP_DIR = path.join(__dirname, 'backups');

function getAvailableBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup_') && file.endsWith('.zip'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
          date: stats.mtime.toLocaleString('es-MX', { timeZone: 'America/Mazatlan' })
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return files;
  } catch (error) {
    console.error('Error al listar respaldos:', error.message);
    return [];
  }
}

async function restoreBackup(backupPath, targetDir = __dirname) {
  return new Promise((resolve, reject) => {
    console.log('\n═══════════════════════════════════════════════');
    console.log('  Restaurando respaldo');
    console.log('═══════════════════════════════════════════════');
    console.log(`  Archivo: ${path.basename(backupPath)}`);
    console.log(`  Destino: ${targetDir}\n`);
    
    fs.createReadStream(backupPath)
      .pipe(unzipper.Extract({ path: targetDir }))
      .on('close', () => {
        console.log('\n✓ Respaldo restaurado exitosamente');
        console.log('═══════════════════════════════════════════════\n');
        resolve();
      })
      .on('error', (err) => {
        console.error('\n✗ Error al restaurar respaldo:', err.message);
        reject(err);
      });
  });
}

async function interactiveRestore() {
  const backups = getAvailableBackups();
  
  if (backups.length === 0) {
    console.log('\n⚠ No hay respaldos disponibles para restaurar');
    return;
  }
  
  console.log('\n═══════════════════════════════════════════════');
  console.log('  Respaldos disponibles para restaurar');
  console.log('═══════════════════════════════════════════════');
  
  backups.forEach((backup, index) => {
    console.log(`\n  ${index + 1}. ${backup.name}`);
    console.log(`     Tamaño: ${backup.size}`);
    console.log(`     Fecha: ${backup.date}`);
  });
  
  console.log('\n═══════════════════════════════════════════════');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('\nSelecciona el número del respaldo a restaurar (0 para cancelar): ', async (answer) => {
    const selection = parseInt(answer);
    
    if (selection === 0 || isNaN(selection)) {
      console.log('Operación cancelada');
      rl.close();
      return;
    }
    
    if (selection < 1 || selection > backups.length) {
      console.log('Selección inválida');
      rl.close();
      return;
    }
    
    const selectedBackup = backups[selection - 1];
    
    rl.question('\n⚠ ADVERTENCIA: Esta operación sobrescribirá los archivos actuales.\n¿Estás seguro? (si/no): ', async (confirm) => {
      if (confirm.toLowerCase() === 'si' || confirm.toLowerCase() === 's') {
        try {
          await restoreBackup(selectedBackup.path);
          console.log('✓ Sistema restaurado correctamente');
          console.log('  Recuerda reiniciar el servidor si estaba en ejecución');
        } catch (error) {
          console.error('✗ Error durante la restauración:', error.message);
        }
      } else {
        console.log('Operación cancelada');
      }
      
      rl.close();
    });
  });
}

async function restoreLatest() {
  const backups = getAvailableBackups();
  
  if (backups.length === 0) {
    console.log('\n⚠ No hay respaldos disponibles para restaurar');
    return;
  }
  
  const latestBackup = backups[0];
  
  console.log('\n⚠ ADVERTENCIA: Se restaurará el respaldo más reciente');
  console.log(`   Archivo: ${latestBackup.name}`);
  console.log(`   Fecha: ${latestBackup.date}\n`);
  
  try {
    await restoreBackup(latestBackup.path);
    console.log('✓ Sistema restaurado correctamente');
    console.log('  Recuerda reiniciar el servidor si estaba en ejecución');
  } catch (error) {
    console.error('✗ Error durante la restauración:', error.message);
  }
}

module.exports = {
  restoreBackup,
  interactiveRestore,
  restoreLatest,
  getAvailableBackups
};

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'latest') {
    restoreLatest()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    interactiveRestore()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}
