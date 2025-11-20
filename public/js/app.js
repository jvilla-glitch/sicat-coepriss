// Variables globales
let currentPage = 1;
let currentFilters = {};
let tramiteModal, viewModal, importModal, reportModal;
let currentTramiteId = null;

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
  tramiteModal = new bootstrap.Modal(document.getElementById('tramiteModal'));
  viewModal = new bootstrap.Modal(document.getElementById('viewModal'));
  importModal = new bootstrap.Modal(document.getElementById('importModal'));
  reportModal = new bootstrap.Modal(document.getElementById('reportModal'));
  
  loadDashboard();
  loadTramites();
  loadCatalogos();
  
  document.getElementById('fecha').valueAsDate = new Date();
  
  document.getElementById('search').addEventListener('input', debounce(applyFilters, 500));
  document.getElementById('filter-estatus').addEventListener('change', applyFilters);
  document.getElementById('filter-capturo').addEventListener('change', applyFilters);
  document.getElementById('filter-fecha').addEventListener('change', applyFilters);
});

// Función debounce para búsqueda
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Cargar dashboard con estadísticas
async function loadDashboard() {
  try {
    const response = await fetch('/api/tramites/stats/dashboard');
    const data = await response.json();
    
    const estatusMap = {
      'En proceso': 'proceso',
      'Para entregar': 'entregar',
      'Entregado': 'entregado'
    };
    
    Object.values(estatusMap).forEach(key => {
      document.getElementById(`stat-${key}`).textContent = '0';
    });
    
    data.estatus.forEach(item => {
      const key = estatusMap[item.estatus];
      if (key) {
        document.getElementById(`stat-${key}`).textContent = item.count;
      }
    });
    
    document.getElementById('stat-recaudado').textContent = 
      `$${parseFloat(data.total_recaudado).toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    
    document.getElementById('stat-total-tramites').textContent = 
      `${data.total_tramites} trámites`;
    
  } catch (error) {
    console.error('Error al cargar dashboard:', error);
  }
}

// Cargar lista de trámites
async function loadTramites(page = 1) {
  try {
    currentPage = page;
    const params = new URLSearchParams({
      page,
      limit: 10,
      ...currentFilters
    });
    
    const response = await fetch(`/api/tramites?${params}`);
    const data = await response.json();
    
    renderTramites(data.data);
    renderPagination(data.pagination);
    
  } catch (error) {
    console.error('Error al cargar trámites:', error);
    document.getElementById('tramites-tbody').innerHTML = 
      '<tr><td colspan="8" class="text-center text-danger">Error al cargar datos</td></tr>';
  }
}

// Renderizar tabla de trámites
function renderTramites(tramites) {
  const tbody = document.getElementById('tramites-tbody');
  
  if (tramites.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">No se encontraron trámites</td></tr>';
    return;
  }
  
  tbody.innerHTML = tramites.map(t => {
    const total = (parseFloat(t.pago_estatal) || 0) + (parseFloat(t.pago_federal) || 0);
    const badgeClass = t.estatus === 'En proceso' ? 'badge-proceso' :
                       t.estatus === 'Para entregar' ? 'badge-entregar' : 'badge-entregado';
    
    return `
      <tr>
        <td><strong>${t.no_entrada_formatted}</strong></td>
        <td>${formatDate(t.fecha)}</td>
        <td>${t.capturo}</td>
        <td>${t.razon_social}</td>
        <td>${t.tramite}</td>
        <td><span class="badge ${badgeClass}">${t.estatus}</span></td>
        <td><strong>$${total.toLocaleString('es-MX', {minimumFractionDigits: 2})}</strong></td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-info" onclick="viewTramite(${t.id})" title="Ver">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-warning" onclick="editTramite(${t.id})" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteTramite(${t.id})" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Renderizar paginación
function renderPagination(pagination) {
  const paginationEl = document.getElementById('pagination');
  const { page, pages } = pagination;
  
  if (pages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }
  
  let html = '';
  
  html += `
    <li class="page-item ${page === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="loadTramites(${page - 1}); return false;">Anterior</a>
    </li>
  `;
  
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
      html += `
        <li class="page-item ${i === page ? 'active' : ''}">
          <a class="page-link" href="#" onclick="loadTramites(${i}); return false;">${i}</a>
        </li>
      `;
    } else if (i === page - 3 || i === page + 3) {
      html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }
  }
  
  html += `
    <li class="page-item ${page === pages ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="loadTramites(${page + 1}); return false;">Siguiente</a>
    </li>
  `;
  
  paginationEl.innerHTML = html;
}

// Aplicar filtros
function applyFilters() {
  currentFilters = {
    search: document.getElementById('search').value,
    estatus: document.getElementById('filter-estatus').value,
    capturo: document.getElementById('filter-capturo').value,
    fecha: document.getElementById('filter-fecha').value
  };
  
  loadTramites(1);
}

// Mostrar modal para crear nuevo trámite
function showModal() {
  document.getElementById('modalTitle').textContent = 'Nuevo Trámite';
  document.getElementById('tramiteForm').reset();
  document.getElementById('tramite-id').value = '';
  document.getElementById('fecha').valueAsDate = new Date();
  document.getElementById('ventanilla-local').checked = true;
  toggleVentanilla();
  currentTramiteId = null;
  
  // Usar el modal ya inicializado al cargar la página
  const modalElement = document.getElementById('tramiteModal');
  const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
  modal.show();
}

// Toggle campos de ventanilla foránea
function toggleVentanilla() {
  const isForaneo = document.getElementById('ventanilla-foraneo').checked;
  const camposForaneo = document.getElementById('campos-foraneo');
  camposForaneo.style.display = isForaneo ? 'block' : 'none';
  
  if (!isForaneo) {
    document.getElementById('no_oficio_foraneo').value = '';
    document.getElementById('coordinacion').value = '';
    document.getElementById('fecha_oficio').value = '';
  }
}

// Guardar trámite
async function saveTramite() {
  const form = document.getElementById('tramiteForm');
  
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  const ventanilla = document.querySelector('input[name="ventanilla"]:checked').value;
  
  const tramiteData = {
    capturo: document.getElementById('capturo').value,
    fecha: document.getElementById('fecha').value,
    ventanilla,
    no_oficio_foraneo: ventanilla === 'foraneo' ? document.getElementById('no_oficio_foraneo').value : null,
    coordinacion: ventanilla === 'foraneo' ? document.getElementById('coordinacion').value : null,
    fecha_oficio: ventanilla === 'foraneo' ? document.getElementById('fecha_oficio').value : null,
    razon_social: document.getElementById('razon_social').value,
    telefono: document.getElementById('telefono').value,
    tramite: document.getElementById('tramite').value,
    giro: document.getElementById('giro').value,
    estatus: document.getElementById('estatus').value,
    pago_estatal: parseFloat(document.getElementById('pago_estatal').value) || 0,
    no_recibo: document.getElementById('no_recibo').value,
    pago_federal: parseFloat(document.getElementById('pago_federal').value) || 0,
    clave_pago_derechos: document.getElementById('clave_pago_derechos').value,
    observaciones: document.getElementById('observaciones').value
  };
  
  try {
    let response;
    if (currentTramiteId) {
      response = await fetch(`/api/tramites/${currentTramiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tramiteData)
      });
    } else {
      response = await fetch('/api/tramites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tramiteData)
      });
    }
    
    if (response.ok) {
      tramiteModal.hide();
      loadTramites(currentPage);
      loadDashboard();
      showAlert('success', currentTramiteId ? 'Trámite actualizado correctamente' : 'Trámite creado correctamente');
    } else {
      const error = await response.json();
      showAlert('danger', `Error: ${error.error}`);
    }
  } catch (error) {
    console.error('Error al guardar trámite:', error);
    showAlert('danger', 'Error al guardar el trámite');
  }
}

// Ver detalles de un trámite
async function viewTramite(id) {
  try {
    const response = await fetch(`/api/tramites/${id}`);
    const tramite = await response.json();
    
    const total = (parseFloat(tramite.pago_estatal) || 0) + (parseFloat(tramite.pago_federal) || 0);
    const badgeClass = tramite.estatus === 'En proceso' ? 'badge-proceso' :
                       tramite.estatus === 'Para entregar' ? 'badge-entregar' : 'badge-entregado';
    
    currentTramiteId = id;
    
    const html = `
      <div class="row">
        <div class="col-md-6">
          <p><strong>No. Entrada:</strong> ${tramite.no_entrada_formatted}</p>
          <p><strong>Fecha:</strong> ${formatDate(tramite.fecha)}</p>
          <p><strong>Capturó:</strong> ${tramite.capturo}</p>
          <p><strong>Ventanilla:</strong> ${tramite.ventanilla}</p>
          ${tramite.ventanilla === 'foraneo' ? `
            <p><strong>No. Oficio Foráneo:</strong> ${tramite.no_oficio_foraneo || 'N/A'}</p>
            <p><strong>Coordinación:</strong> ${tramite.coordinacion || 'N/A'}</p>
            <p><strong>Fecha Oficio:</strong> ${tramite.fecha_oficio ? formatDate(tramite.fecha_oficio) : 'N/A'}</p>
          ` : ''}
        </div>
        <div class="col-md-6">
          <p><strong>Estatus:</strong> <span class="badge ${badgeClass}">${tramite.estatus}</span></p>
          <p><strong>Razón Social:</strong> ${tramite.razon_social}</p>
          <p><strong>Teléfono:</strong> ${tramite.telefono}</p>
          <p><strong>Trámite:</strong> ${tramite.tramite}</p>
          <p><strong>Giro:</strong> ${tramite.giro}</p>
        </div>
      </div>
      <hr>
      <div class="row">
        <div class="col-md-6">
          <p><strong>Pago Estatal:</strong> $${parseFloat(tramite.pago_estatal).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
          <p><strong>No. Recibo:</strong> ${tramite.no_recibo || 'N/A'}</p>
        </div>
        <div class="col-md-6">
          <p><strong>Pago Federal:</strong> $${parseFloat(tramite.pago_federal).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
          <p><strong>Clave Pago Derechos:</strong> ${tramite.clave_pago_derechos || 'N/A'}</p>
        </div>
      </div>
      <div class="row">
        <div class="col-md-12">
          <p><strong>Total:</strong> <span class="text-success fs-5">$${total.toLocaleString('es-MX', {minimumFractionDigits: 2})}</span></p>
        </div>
      </div>
      ${tramite.observaciones ? `
        <hr>
        <div class="row">
          <div class="col-md-12">
            <p><strong>Observaciones:</strong></p>
            <p>${tramite.observaciones}</p>
          </div>
        </div>
      ` : ''}
    `;
    
    document.getElementById('viewModalBody').innerHTML = html;
    viewModal.show();
    
  } catch (error) {
    console.error('Error al cargar trámite:', error);
    showAlert('danger', 'Error al cargar los detalles del trámite');
  }
}

// Editar trámite
async function editTramite(id) {
  try {
    const response = await fetch(`/api/tramites/${id}`);
    const tramite = await response.json();
    
    document.getElementById('modalTitle').textContent = 'Editar Trámite';
    document.getElementById('tramite-id').value = tramite.id;
    document.getElementById('capturo').value = tramite.capturo;
    document.getElementById('fecha').value = tramite.fecha;
    
    if (tramite.ventanilla === 'foraneo') {
      document.getElementById('ventanilla-foraneo').checked = true;
      document.getElementById('no_oficio_foraneo').value = tramite.no_oficio_foraneo || '';
      document.getElementById('coordinacion').value = tramite.coordinacion || '';
      document.getElementById('fecha_oficio').value = tramite.fecha_oficio || '';
    } else {
      document.getElementById('ventanilla-local').checked = true;
    }
    
    toggleVentanilla();
    
    document.getElementById('razon_social').value = tramite.razon_social;
    document.getElementById('telefono').value = tramite.telefono;
    document.getElementById('tramite').value = tramite.tramite;
    document.getElementById('giro').value = tramite.giro;
    document.getElementById('estatus').value = tramite.estatus;
    document.getElementById('pago_estatal').value = tramite.pago_estatal || 0;
    document.getElementById('no_recibo').value = tramite.no_recibo || '';
    document.getElementById('pago_federal').value = tramite.pago_federal || 0;
    document.getElementById('clave_pago_derechos').value = tramite.clave_pago_derechos || '';
    document.getElementById('observaciones').value = tramite.observaciones || '';
    
    currentTramiteId = id;
    tramiteModal.show();
    
  } catch (error) {
    console.error('Error al cargar trámite para editar:', error);
    showAlert('danger', 'Error al cargar el trámite');
  }
}

// Eliminar trámite
async function deleteTramite(id) {
  if (!confirm('¿Está seguro de que desea eliminar este trámite?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/tramites/${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      loadTramites(currentPage);
      loadDashboard();
      showAlert('success', 'Trámite eliminado correctamente');
    } else {
      showAlert('danger', 'Error al eliminar el trámite');
    }
  } catch (error) {
    console.error('Error al eliminar trámite:', error);
    showAlert('danger', 'Error al eliminar el trámite');
  }
}

// Exportar a Excel
async function exportToExcel() {
  try {
    const params = new URLSearchParams(currentFilters);
    window.location.href = `/api/tramites/export/excel?${params}`;
    showAlert('success', 'Exportando a Excel...');
  } catch (error) {
    console.error('Error al exportar:', error);
    showAlert('danger', 'Error al exportar los datos');
  }
}

// Mostrar modal de importación
function showImportModal() {
  document.getElementById('import-file').value = '';
  document.getElementById('import-result').innerHTML = '';
  importModal.show();
}

// Importar desde Excel
async function importExcel() {
  const fileInput = document.getElementById('import-file');
  
  if (!fileInput.files || fileInput.files.length === 0) {
    showAlert('danger', 'Por favor seleccione un archivo');
    return;
  }
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  
  try {
    const response = await fetch('/api/tramites/import/excel', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok) {
      const resultHtml = `
        <div class="alert alert-success">
          <h6>Importación completada</h6>
          <p>Registros importados: ${result.importados}</p>
          <p>Errores: ${result.errores}</p>
        </div>
      `;
      
      document.getElementById('import-result').innerHTML = resultHtml;
      
      setTimeout(() => {
        importModal.hide();
        loadTramites(currentPage);
        loadDashboard();
      }, 2000);
    } else {
      document.getElementById('import-result').innerHTML = `
        <div class="alert alert-danger">Error: ${result.error}</div>
      `;
    }
  } catch (error) {
    console.error('Error al importar:', error);
    document.getElementById('import-result').innerHTML = `
      <div class="alert alert-danger">Error al importar el archivo</div>
    `;
  }
}

// Mostrar modal de reportes
function showReportModal() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  
  document.getElementById('report-start').valueAsDate = start;
  document.getElementById('report-end').valueAsDate = end;
  reportModal.show();
}

// Generar reporte
async function generateReport() {
  const startDate = document.getElementById('report-start').value;
  const endDate = document.getElementById('report-end').value;
  const formato = document.getElementById('report-format').value;
  
  if (!startDate || !endDate) {
    showAlert('danger', 'Por favor seleccione las fechas');
    return;
  }
  
  if (new Date(startDate) > new Date(endDate)) {
    showAlert('danger', 'La fecha de inicio debe ser anterior a la fecha fin');
    return;
  }
  
  try {
    const params = new URLSearchParams({ startDate, endDate, formato });
    
    if (formato === 'excel') {
      window.location.href = `/api/tramites/reportes/rango?${params}`;
      reportModal.hide();
      showAlert('success', 'Generando reporte...');
    } else {
      const response = await fetch(`/api/tramites/reportes/rango?${params}`);
      const data = await response.json();
      
      console.log('Reporte:', data);
      
      const win = window.open('', '_blank');
      win.document.write(`
        <html>
          <head>
            <title>Reporte de Trámites</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
          </head>
          <body class="p-4">
            <h2>Reporte de Trámites</h2>
            <p><strong>Período:</strong> ${formatDate(data.periodo.inicio)} - ${formatDate(data.periodo.fin)}</p>
            <div class="alert alert-info">
              <h5>Totales</h5>
              <p><strong>Total de trámites:</strong> ${data.totales.cantidad}</p>
              <p><strong>Pago Estatal:</strong> $${data.totales.pago_estatal.toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
              <p><strong>Pago Federal:</strong> $${data.totales.pago_federal.toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
              <p><strong>Total Recaudado:</strong> $${data.totales.total_recaudado.toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
            </div>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </body>
        </html>
      `);
      
      reportModal.hide();
    }
  } catch (error) {
    console.error('Error al generar reporte:', error);
    showAlert('danger', 'Error al generar el reporte');
  }
}

// Imprimir trámite actual
function printTramite() {
  window.print();
}

// Cargar catálogos para autocompletado
async function loadCatalogos() {
  try {
    const tramitesResponse = await fetch('/api/tramites/catalogos/tramite');
    const tramites = await tramitesResponse.json();
    
    const tramitesList = document.getElementById('tramites-list');
    tramitesList.innerHTML = tramites.map(t => `<option value="${t}">`).join('');
    
    const girosResponse = await fetch('/api/tramites/catalogos/giro');
    const giros = await girosResponse.json();
    
    const girosList = document.getElementById('giros-list');
    girosList.innerHTML = giros.map(g => `<option value="${g}">`).join('');
    
  } catch (error) {
    console.error('Error al cargar catálogos:', error);
  }
}

// Formatear fecha
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    // Si la fecha es solo formato YYYY-MM-DD, agregar la hora
    // Si ya tiene timestamp, usarla directamente
    let date;
    
    if (dateString.includes('T') || dateString.includes(' ')) {
      // Ya tiene hora, usar directamente
      date = new Date(dateString);
    } else {
      // Solo tiene fecha, agregar hora para evitar problemas de zona horaria
      date = new Date(dateString + 'T00:00:00');
    }
    
    // Verificar si la fecha es válida
    if (isNaN(date.getTime())) {
      console.error('Fecha inválida:', dateString);
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('es-MX', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      timeZone: 'America/Mexico_City'
    });
  } catch (error) {
    console.error('Error al formatear fecha:', dateString, error);
    return 'Invalid Date';
  }
}

// Mostrar alertas
function showAlert(type, message) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
  alertDiv.style.zIndex = '9999';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(alertDiv);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}
// Mostrar usuario actual
function showCurrentUser() {
  const usuario = sessionStorage.getItem('usuario');
  if (usuario) {
    document.getElementById('current-user').textContent = usuario;
  }
}

// Cerrar sesión
function logout() {
  if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
    sessionStorage.clear();
    window.location.href = 'login.html';
  }
}

// Llamar al cargar la página
showCurrentUser();
