/* =========================================
   CONFIGURACIÓN Y CONSTANTES
========================================= */
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1rLTU357l-8vbBXPl7ZgvxFoOhqRWuorn4v7zW3eLsLE/export?format=csv&gid=91821095";
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/600x360?text=Sin+Imagen';

/* =========================================
   ELEMENTOS DEL DOM
========================================= */
const DOM = {
  catalog: document.getElementById('catalog'),
  search: document.getElementById('search'),
  origen: document.getElementById('origen'),
  sort: document.getElementById('sort'),
  pager: document.getElementById('pager'),
  perPageSel: document.getElementById('perPage'),
  lightbox: document.getElementById('lightbox'),
  lbImg: document.getElementById('lb-img'),
  lbCaption: document.getElementById('lb-caption'),
  lbClose: document.querySelector('.lb-close')
};

/* =========================================
   VARIABLES GLOBALES
========================================= */
let allProducts = [];             // Todos los productos
let currentFilteredProducts = []; // Productos filtrados
let currentPage = 1;
let itemsPerPage = 12;
let cart = [];                     // Carrito de compras

/* =========================================
   UTILIDADES
========================================= */

// Debounce para inputs
const debounce = (func, delay = 300) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
};

// Escapar HTML para seguridad
const escapeHtml = (str) => {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
};

/* =========================================
   PARSING DE CSV
========================================= */
function parseCSV(csv) {
  const lines = csv.split(/\r?\n/);
  let headers = null;
  const rows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (!headers) {
      headers = parseCSVLine(line);
      continue;
    }

    const values = parseCSVLine(line);
    if (values.length < headers.length) continue;

    const obj = {};
    headers.forEach((h, idx) => obj[h] = (values[idx] || '').trim());
    rows.push(obj);
  }

  return rows;
}

function parseCSVLine(line) {
  const res = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      res.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  res.push(cur);
  return res;
}

/* =========================================
   CARGA DE PRODUCTOS
========================================= */
async function loadProducts() {
  DOM.catalog.innerHTML = `<div class="loading-message">Cargando productos...</div>`;

  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error(`Error al cargar la hoja de cálculo: ${response.status}`);
    const csvText = await response.text();
    const rawRows = parseCSV(csvText);

    allProducts = rawRows.map(r => ({
      codigo: r.codigo || r.Codigo || r.CODIGO || '',
      producto: r.producto || r.Producto || r.nombre || r.Nombre || '',
      uni_x_ca: Number(r.uni_x_ca || r.unidades_por_caja || 0),
      precio: Number(String(r.precio ?? r.precio_unitario ?? r.Precio ?? '0')
        .replace(/[^0-9\.,\-]/g, '')
        .replace(',', '.')) || 0,
      origen: r.origen || r.Origen || '',
      nota: r.nota || r.Nota || '',
      imagen: r.imagen || r.img || r.imagen_url || ''
    }));

    populateFilters();
    applyFilters(); // Render inicial
  } catch (error) {
    console.error("Error al cargar los productos:", error);
    DOM.catalog.innerHTML = `<div class="error-message">Error al cargar los productos. Por favor, inténtalo de nuevo más tarde.</div>`;
  }
}

/* =========================================
   FILTROS
========================================= */
function populateFilters() {
  const origins = [...new Set(allProducts.map(p => p.origen).filter(Boolean))].sort();
  DOM.origen.innerHTML = '<option value="">Todos</option>' + origins.map(o => `<option>${escapeHtml(o)}</option>`).join('');
}

function applyFilters() {
  const searchTerm = (DOM.search.value || '').toLowerCase().trim();
  const selectedOrigin = DOM.origen.value;
  const sortOrder = DOM.sort.value;
  itemsPerPage = Number(DOM.perPageSel.value || 12);
  currentPage = 1;

  currentFilteredProducts = allProducts.filter(product => {
    if (selectedOrigin && product.origen !== selectedOrigin) return false;
    if (searchTerm && !(product.producto.toLowerCase().includes(searchTerm) || product.codigo.toLowerCase().includes(searchTerm))) return false;
    return true;
  });

  // Sorting
  if (sortOrder === 'precio_asc') currentFilteredProducts.sort((a,b) => a.precio - b.precio);
  else if (sortOrder === 'precio_desc') currentFilteredProducts.sort((a,b) => b.precio - a.precio);

  renderCatalogPage();
}

/* =========================================
   RENDER DE PRODUCTOS
========================================= */
function renderCatalogPage() {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const itemsToRender = currentFilteredProducts.slice(startIndex, startIndex + itemsPerPage);

  if (!itemsToRender.length) {
    DOM.catalog.innerHTML = '<div class="no-results-message">No hay productos que coincidan con tu búsqueda.</div>';
    return;
  }

  DOM.catalog.innerHTML = itemsToRender.map(product => {
    const imgSrc = product.imagen ? escapeHtml(product.imagen) : PLACEHOLDER_IMAGE;
    return `
<article class="card" tabindex="0">
  <img loading="lazy" src="${imgSrc}" alt="${escapeHtml(product.producto)}" data-img="${imgSrc}" 
       onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGE}';">
  <div class="card-body">
    <div class="card-title">${escapeHtml(product.producto)}</div>
    <div class="meta">Código: ${escapeHtml(product.codigo)} • ${product.uni_x_ca} u/caja</div>
    <div class="meta">Origen: ${escapeHtml(product.origen)}${product.nota ? ' • ' + escapeHtml(product.nota) : ''}</div>
    <div class="price">$ ${Number(product.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
    <button class="add-to-cart" data-code="${escapeHtml(product.codigo)}">Agregar al carrito</button>
  </div>
</article>`;
  }).join('');

  // Lightbox
  DOM.catalog.querySelectorAll('.card img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.dataset.img, img.alt));
  });

  // Botones agregar al carrito
  DOM.catalog.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.code));
  });

  renderPagination();
}

/* =========================================
   PAGINACIÓN
========================================= */
function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(currentFilteredProducts.length / itemsPerPage));
  let pagerHtml = '';

  if (currentPage > 1) pagerHtml += `<button onclick="goToPage(${currentPage - 1})" aria-label="Página anterior">«</button>`;
  pagerHtml += `<span class="small">Página ${currentPage} de ${totalPages} — ${currentFilteredProducts.length} items</span>`;
  if (currentPage < totalPages) pagerHtml += `<button onclick="goToPage(${currentPage + 1})" aria-label="Página siguiente">»</button>`;

  DOM.pager.innerHTML = pagerHtml;
}

function goToPage(pageNumber) {
  currentPage = pageNumber;
  renderCatalogPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =========================================
   LIGHTBOX
========================================= */
function openLightbox(src, alt) {
  DOM.lbImg.src = src;
  DOM.lbImg.alt = alt || '';
  DOM.lbCaption.textContent = alt || '';
  DOM.lightbox.setAttribute('aria-hidden', 'false');
  DOM.lightbox.focus();
}

function closeLightbox() {
  DOM.lightbox.setAttribute('aria-hidden', 'true');
  DOM.lbImg.src = '';
}

/* =========================================
   FILTROS TOGGLE
========================================= */
const toggleFilters = () => {
  const filtersForm = document.getElementById('filtersForm');
  const toggleButton = document.getElementById('toggle-filters');
  if (filtersForm.classList.contains('hidden')) {
    filtersForm.classList.remove('hidden');
    toggleButton.textContent = 'Ocultar Filtros';
  } else {
    filtersForm.classList.add('hidden');
    toggleButton.textContent = 'Mostrar Filtros';
  }
};
document.getElementById('toggle-filters').addEventListener('click', toggleFilters);

/* =========================================
   EVENT LISTENERS
========================================= */
DOM.search.addEventListener('input', debounce(applyFilters, 300));
DOM.origen.addEventListener('change', applyFilters);
DOM.sort.addEventListener('change', applyFilters);
DOM.perPageSel.addEventListener('change', applyFilters);

DOM.lbClose.addEventListener('click', closeLightbox);
DOM.lightbox.addEventListener('click', (e) => { if (e.target === DOM.lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && DOM.lightbox.getAttribute('aria-hidden') === 'false') closeLightbox(); });

/* =========================================
   CAROUSEL / CARRITO (placeholder)
========================================= */
function addToCart(code) {
  const product = allProducts.find(p => p.codigo === code);
  if (!product) return;

  const existing = cart.find(item => item.codigo === code);
  if (existing) existing.cantidad++;
  else cart.push({ codigo: product.codigo, nombre: product.producto, precio: product.precio, cantidad: 1 });

  alert(`Se agregó al carrito: ${product.producto}`);
}

/* =========================================
   INICIALIZACIÓN
========================================= */
loadProducts();
