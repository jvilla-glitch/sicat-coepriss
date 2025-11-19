const fs = require('fs');
const path = require('path');
const { getBackupInfo } = require('./backup');

console.log('\n═══════════════════════════════════════════════');
console.log('  VERIFICACIÓN DEL SISTEMA DE RESPALDOS');
console.log('═══════════════════════════════════════════════\n');

// Verificar archivos necesarios
const requiredFiles = [
  'backup.js',
  'backup-scheduler.js',
  'restore.js',
  '.env.backup'
];

console.log('📋 Verificando archivos del sistema...\n');

let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - NO ENCONTRADO`);
    allFilesExist = false;
  }
});

console.log('\n');

// Verificar dependencias
console.log('📦 Verificando dependencias...\n');

const requiredPackages = [
  'archiver',
  'unzipper',
  'node-cron'
];

let allPackagesInstalled = true;
requiredPackages.forEach(pkg => {
  try {
    require.resolve(pkg);
    console.log(`   ✅ ${pkg}`);
  } catch (e) {
    console.log(`   ❌ ${pkg} - NO INSTALADO`);
    allPackagesInstalled = false;
  }
});

console.log('\n');

// Verificar directorio de respaldos
console.log('📁 Verificando directorio de respaldos...\n');

const backupDir = path.join(__dirname, 'backups');
if (fs.existsSync(backupDir)) {
  console.log(`   ✅ Directorio existe: ${backupDir}`);
  
  // Contar respaldos
  const backups = getBackupInfo();
  console.log(`   📊 Respaldos disponibles: ${backups.length}`);
  
  if (backups.length > 0) {
    const latestBackup = backups[0];
    console.log(`   📅 Último respaldo: ${latestBackup.date}`);
    console.log(`   💾 Tamaño: ${latestBackup.size}`);
  } else {
    console.log(`   ⚠️  No hay respaldos creados aún`);
  }
} else {
  console.log(`   ⚠️  Directorio no existe (se creará al primer respaldo)`);
}

console.log('\n');

// Verificar configuración
console.log('⚙️  Verificando configuración...\n');

const envPath = path.join(__dirname, '.env.backup');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  lines.forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        console.log(`   ✅ ${key.trim()}: ${value.trim()}`);
      }
    }
  });
} else {
  console.log(`   ⚠️  Archivo .env.backup no encontrado`);
}

console.log('\n');

// Verificar espacio en disco
console.log('💽 Verificando espacio en disco...\n');

try {
  const stats = fs.statfsSync(__dirname);
  const totalSpace = (stats.blocks * stats.bsize / 1024 / 1024 / 1024).toFixed(2);
  const freeSpace = (stats.bfree * stats.bsize / 1024 / 1024 / 1024).toFixed(2);
  const usedSpace = (totalSpace - freeSpace).toFixed(2);
  const percentUsed = ((usedSpace / totalSpace) * 100).toFixed(1);
  
  console.log(`   💾 Espacio total: ${totalSpace} GB`);
  console.log(`   📊 Espacio usado: ${usedSpace} GB (${percentUsed}%)`);
  console.log(`   ✅ Espacio libre: ${freeSpace} GB`);
  
  if (parseFloat(freeSpace) < 1) {
    console.log(`   ⚠️  Advertencia: Poco espacio disponible`);
  }
} catch (error) {
  console.log(`   ⚠️  No se pudo verificar el espacio en disco`);
}

console.log('\n═══════════════════════════════════════════════');

// Resumen final
console.log('\n📊 RESUMEN:\n');

if (allFilesExist && allPackagesInstalled) {
  console.log('   ✅ Sistema de respaldos correctamente instalado');
  console.log('   ✅ Todas las dependencias están instaladas');
  console.log('\n   🚀 Comandos disponibles:');
  console.log('      npm run backup          - Crear respaldo manual');
  console.log('      npm run backup:list     - Listar respaldos');
  console.log('      npm run backup:scheduler - Iniciar programador');
  console.log('      npm run backup:now      - Respaldo inmediato');
  console.log('      npm run restore         - Restaurar respaldo');
} else {
  console.log('   ⚠️  El sistema no está completamente instalado\n');
  
  if (!allFilesExist) {
    console.log('   ❌ Faltan archivos del sistema');
    console.log('      Solución: Copia todos los archivos a la raíz del proyecto');
  }
  
  if (!allPackagesInstalled) {
    console.log('   ❌ Faltan dependencias');
    console.log('      Solución: Ejecuta "npm install"');
  }
}

console.log('\n═══════════════════════════════════════════════\n');
