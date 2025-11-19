const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');

// Configuración
const BACKUP_DIR = path.join(__dirname, 'backups');
const CREDENTIALS_PATH = path.join(__dirname, 'google-credentials.json');
const TOKEN_PATH = path.join(__dirname, 'google-token.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Cargar configuración
let DRIVE_FOLDER_ID = process.env.GDRIVE_FOLDER_ID || null;

// Función para obtener cliente autenticado
async function getAuthClient() {
  try {
    // Verificar si existen las credenciales
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error('Archivo google-credentials.json no encontrado');
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Verificar si existe el token
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oAuth2Client.setCredentials(token);
      return oAuth2Client;
    } else {
      // Obtener nuevo token
      return await getNewToken(oAuth2Client);
    }
  } catch (error) {
    console.error('Error al autenticar con Google:', error.message);
    throw error;
  }
}

// Función para obtener nuevo token
async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\n═══════════════════════════════════════════════');
  console.log('  CONFIGURACIÓN DE GOOGLE DRIVE');
  console.log('═══════════════════════════════════════════════');
  console.log('\n1. Abre esta URL en tu navegador:\n');
  console.log(authUrl);
  console.log('\n2. Autoriza la aplicación');
  console.log('3. Copia el código que aparece\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('Pega el código aquí: ', (code) => {
      rl.close();
      
      oAuth2Client.getToken(code, (err, token) => {
        if (err) {
          console.error('Error al obtener token:', err);
          reject(err);
          return;
        }

        oAuth2Client.setCredentials(token);
        
        // Guardar token para uso futuro
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        console.log('\n✓ Token guardado en:', TOKEN_PATH);
        console.log('═══════════════════════════════════════════════\n');
        
        resolve(oAuth2Client);
      });
    });
  });
}

// Función para crear carpeta en Drive (si no existe)
async function createDriveFolder(auth, folderName = 'Respaldos Sistema Trámites') {
  try {
    const drive = google.drive({ version: 'v3', auth });

    // Buscar si ya existe la carpeta
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (response.data.files.length > 0) {
      console.log(`✓ Carpeta "${folderName}" ya existe en Drive`);
      return response.data.files[0].id;
    }

    // Crear nueva carpeta
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };

    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id'
    });

    console.log(`✓ Carpeta "${folderName}" creada en Drive`);
    console.log(`  ID: ${folder.data.id}`);
    
    return folder.data.id;
  } catch (error) {
    console.error('Error al crear carpeta en Drive:', error.message);
    throw error;
  }
}

// Función para subir archivo a Drive
async function uploadToDrive(filePath, folderId = null) {
  try {
    console.log('\n═══════════════════════════════════════════════');
    console.log('  Subiendo respaldo a Google Drive');
    console.log('═══════════════════════════════════════════════');
    
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    // Si no hay folder ID, crear o buscar carpeta
    if (!folderId) {
      folderId = await createDriveFolder(auth);
      
      // Guardar folder ID en .env.backup
      const envPath = path.join(__dirname, '.env.backup');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (!envContent.includes('GDRIVE_FOLDER_ID')) {
          envContent += `\n\n# ID de carpeta en Google Drive\nGDRIVE_FOLDER_ID=${folderId}\n`;
          fs.writeFileSync(envPath, envContent);
          console.log('✓ ID de carpeta guardado en .env.backup');
        }
      }
    }

    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

    console.log(`  Archivo: ${fileName}`);
    console.log(`  Tamaño: ${fileSizeMB} MB`);
    console.log('  Subiendo...');

    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    const media = {
      mimeType: 'application/zip',
      body: fs.createReadStream(filePath)
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink'
    });

    console.log('  ✓ Archivo subido exitosamente');
    console.log(`  ID: ${file.data.id}`);
    console.log(`  Link: ${file.data.webViewLink}`);
    console.log('═══════════════════════════════════════════════\n');

    return file.data;
  } catch (error) {
    console.error('✗ Error al subir a Google Drive:', error.message);
    throw error;
  }
}

// Función para subir el último respaldo
async function uploadLatestBackup() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup_') && file.endsWith('.zip'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      console.log('⚠ No hay respaldos disponibles para subir');
      return;
    }

    const latestBackup = files[0];
    console.log(`Subiendo último respaldo: ${latestBackup.name}`);
    
    await uploadToDrive(latestBackup.path, DRIVE_FOLDER_ID);
  } catch (error) {
    console.error('Error al subir último respaldo:', error);
  }
}

// Función para limpiar respaldos antiguos de Drive
async function cleanOldDriveBackups(maxBackups = 30) {
  try {
    console.log('\n═══════════════════════════════════════════════');
    console.log('  Limpiando respaldos antiguos de Google Drive');
    console.log('═══════════════════════════════════════════════');
    
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    if (!DRIVE_FOLDER_ID) {
      DRIVE_FOLDER_ID = await createDriveFolder(auth);
    }

    // Listar archivos en la carpeta
    const response = await drive.files.list({
      q: `'${DRIVE_FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
      spaces: 'drive'
    });

    const files = response.data.files;
    console.log(`  Total de respaldos en Drive: ${files.length}`);

    if (files.length > maxBackups) {
      const filesToDelete = files.slice(maxBackups);
      console.log(`  Eliminando ${filesToDelete.length} respaldo(s) antiguo(s)...`);

      for (const file of filesToDelete) {
        await drive.files.delete({
          fileId: file.id
        });
        console.log(`    ✓ Eliminado: ${file.name}`);
      }
    } else {
      console.log('  No hay respaldos antiguos para eliminar');
    }

    console.log('═══════════════════════════════════════════════\n');
  } catch (error) {
    console.error('Error al limpiar respaldos de Drive:', error.message);
  }
}

// Función para listar respaldos en Drive
async function listDriveBackups() {
  try {
    console.log('\n═══════════════════════════════════════════════');
    console.log('  Respaldos en Google Drive');
    console.log('═══════════════════════════════════════════════');
    
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    if (!DRIVE_FOLDER_ID) {
      DRIVE_FOLDER_ID = await createDriveFolder(auth);
    }

    const response = await drive.files.list({
      q: `'${DRIVE_FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id, name, size, createdTime, webViewLink)',
      orderBy: 'createdTime desc',
      spaces: 'drive'
    });

    const files = response.data.files;

    if (files.length === 0) {
      console.log('  No hay respaldos en Google Drive');
    } else {
      files.forEach((file, index) => {
        const sizeMB = (parseInt(file.size) / 1024 / 1024).toFixed(2);
        const date = new Date(file.createdTime).toLocaleString('es-MX', { 
          timeZone: 'America/Mazatlan' 
        });
        
        console.log(`\n  ${index + 1}. ${file.name}`);
        console.log(`     Tamaño: ${sizeMB} MB`);
        console.log(`     Fecha: ${date}`);
        console.log(`     Link: ${file.webViewLink}`);
      });
      console.log(`\n  Total: ${files.length} respaldo(s)`);
    }

    console.log('═══════════════════════════════════════════════\n');
  } catch (error) {
    console.error('Error al listar respaldos de Drive:', error.message);
  }
}

module.exports = {
  uploadToDrive,
  uploadLatestBackup,
  cleanOldDriveBackups,
  listDriveBackups,
  getAuthClient,
  createDriveFolder
};

// Si se ejecuta directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'list') {
    listDriveBackups()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else if (args[0] === 'clean') {
    cleanOldDriveBackups()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    uploadLatestBackup()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}
