const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Configuración
const BACKUP_DIR = path.join(__dirname, 'backups');
const DB_PATH = path.join(__dirname, 'db.sqlite3');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SERVER_DIR = path.join(__dirname, 'server');

// Cargar variables de entorno si existe archivo .env.backup
try {
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

// Configuración personalizable
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS) || 30;

// Crear directorio de backups si no existe
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log('✓ Directorio de respaldos creado');
}

function getBackupFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `backup_${year}${month}${day}_${hours}${minutes}${seconds}.zip`;
}

async function createBackup() {
  try {
    console.log('\n═══════════════════════════════════════════════');
    console.log('  Iniciando respaldo automático');
    console.log('═══════════════════════════════════════════════');
    
    const backupFileName = getBackupFileName();
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);
    
    const output = fs.createWriteStream(backupFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });
    
    output.on('close', async () => {
      const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`✓ Respaldo completado: ${backupFileName}`);
      console.log(`  Tamaño: ${sizeInMB} MB`);
      
      await cleanOldBackups();
      await writeBackupLog(backupFileName, sizeInMB);
      
      console.log('═══════════════════════════════════════════════\n');
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('⚠ Advertencia:', err);
      } else {
        throw err;
      }
    });
    
    archive.pipe(output);
    
    if (fs.existsSync(DB_PATH)) {
      console.log('  → Respaldando base de datos...');
      archive.file(DB_PATH, { name: 'db.sqlite3' });
    }
    
    if (fs.existsSync(UPLOADS_DIR)) {
      console.log('  → Respaldando archivos subidos...');
      archive.directory(UPLOADS_DIR, 'uploads');
    }
    
    if (fs.existsSync(SERVER_DIR)) {
      console.log('  → Respaldando configuración del servidor...');
      archive.directory(SERVER_DIR, 'server');
    }
    
    if (fs.existsSync(PUBLIC_DIR)) {
      console.log('  → Respaldando archivos públicos...');
      archive.directory(PUBLIC_DIR, 'public');
    }
    
    const packagePath = path.join(__dirname, 'package.json');
    if (fs.existsSync(packagePath)) {
      console.log('  → Respaldando configuración del proyecto...');
      archive.file(packagePath, { name: 'package.json' });
    }
    
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      console.log('  → Respaldando variables de entorno...');
      archive.file(envPath, { name: '.env' });
    }
    
    await archive.finalize();
    
  } catch (error) {
    console.error('✗ Error al crear respaldo:', error.message);
    throw error;
  }
}

async function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup_') && file.endsWith('.zip'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    
    if (files.length > MAX_BACKUPS) {
      const filesToDelete = files.slice(MAX_BACKUPS);
      console.log(`  → Limpiando ${filesToDelete.length} respaldo(s) antiguo(s)...`);
      
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`    ✓ Eliminado: ${file.name}`);
      });
    }
  } catch (error) {
    console.error('⚠ Error al limpiar respaldos antiguos:', error.message);
  }
}

async function writeBackupLog(fileName, size) {
  try {
    const logPath = path.join(BACKUP_DIR, 'backup_log.txt');
    const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Mazatlan' });
    const logEntry = `[${now}] ${fileName} - ${size} MB\n`;
    
    fs.appendFileSync(logPath, logEntry);
  } catch (error) {
    console.error('⚠ Error al escribir log:', error.message);
  }
}

function getBackupInfo() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup_') && file.endsWith('.zip'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
          date: stats.mtime.toLocaleString('es-MX', { timeZone: 'America/Mazatlan' })
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return files;
  } catch (error) {
    console.error('Error al obtener información de respaldos:', error.message);
    return [];
  }
}

function listBackups() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  Respaldos disponibles');
  console.log('═══════════════════════════════════════════════');
  
  const backups = getBackupInfo();
  
  if (backups.length === 0) {
    console.log('  No hay respaldos disponibles');
  } else {
    backups.forEach((backup, index) => {
      console.log(`\n  ${index + 1}. ${backup.name}`);
      console.log(`     Tamaño: ${backup.size}`);
      console.log(`     Fecha: ${backup.date}`);
    });
    console.log(`\n  Total: ${backups.length} respaldo(s)`);
  }
  
  console.log('═══════════════════════════════════════════════\n');
}

module.exports = {
  createBackup,
  getBackupInfo,
  listBackups,
  cleanOldBackups
};

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'list') {
    listBackups();
  } else {
    createBackup()
      .then(() => {
        console.log('Proceso de respaldo completado exitosamente');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Error en el proceso de respaldo:', error);
        process.exit(1);
      });
  }
}
