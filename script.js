const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1rLTU357l-8vbBXPl7ZgvxFoOhqRWuorn4v7zW3eLsLE/export?format=csv&gid=91821095";

const el = {
  catalog: document.getElementById('catalog'),
  search: document.getElementById('search'),
  categoria: document.getElementById('categoria'),
  origen: document.getElementById('origen'),
  sort: document.getElementById('sort'),
  pager: document.getElementById('pager'),
  perPageSel: document.getElementById('perPage')
};

let products = [], filtered = [], page = 1, perPage = 12;

function parseCSV(csv){
  const lines = csv.split(/\r?\n/);
  let headers = null;
  const rows = [];
  for (let i=0;i<lines.length;i++){
    const line = lines[i];
    if (!line.trim()) continue;
    if (!headers){
      headers = parseCSVLine(line);
      continue;
    }
    const values = parseCSVLine(line);
    if (values.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (values[idx]||'').trim());
    rows.push(obj);
  }
  return rows;
}

function parseCSVLine(line){
  const res = [];
  let cur = '';
  let inQ = false;
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    if (ch === '"'){
      if (inQ && line[i+1] === '"') { cur += '"'; i++; continue; }
      inQ = !inQ; continue;
    }
    if (ch === ',' && !inQ){ res.push(cur); cur = ''; continue; }
    cur += ch;
  }
  res.push(cur);
  return res;
}

async function loadSheet(){
  try{
    const r = await fetch(SHEET_CSV_URL);
    if (!r.ok) throw new Error('Error cargando sheet: '+r.status);
    const txt = await r.text();
    const rows = parseCSV(txt);
    products = rows.map(r => ({
      codigo: r.codigo || r.Codigo || r.CODIGO || '',
      producto: r.producto || r.Producto || r.nombre || r.Nombre || '',
      uni_x_ca: Number(r.uni_x_ca || r.unidades_por_caja || 0) || 0,
      precio: Number(String(r.precio ?? r.precio_unitario ?? r.Precio ?? '0').replace(/[^0-9\.,\-]/g,'').replace(',', '.')) || 0,
      categoria: r.categoria || r.Categoria || '',
      origen: r.origen || r.Origen || '',
      nota: r.nota || r.Nota || '',
      imagen: r.imagen || r.img || r.imagen_url || ''
    }));
    populateFilters();
    applyFilters();
  }catch(e){
    console.error(e);
    el.catalog.innerHTML = `<div style="padding:1rem;color:#900">Error cargando la Google Sheet.</div>`;
  }
}

function populateFilters(){
  const cats = [...new Set(products.map(p=>p.categoria).filter(Boolean))].sort();
  const orgs = [...new Set(products.map(p=>p.origen).filter(Boolean))].sort();
  el.categoria.innerHTML = '<option value="">Todas</option>' + cats.map(c=>`<option>${c}</option>`).join('');
  el.origen.innerHTML = '<option value="">Todos</option>' + orgs.map(o=>`<option>${o}</option>`).join('');
}

function applyFilters(){
  const q = (el.search.value||'').toLowerCase().trim();
  const cat = el.categoria.value;
  const org = el.origen.value;
  const sort = el.sort.value;
  perPage = Number(el.perPageSel.value || 12);
  page = 1;

  filtered = products.filter(p => {
    if (cat && p.categoria !== cat) return false;
    if (org && p.origen !== org) return false;
    if (!q) return true;
    return (p.producto||'').toLowerCase().includes(q) || (p.codigo||'').toLowerCase().includes(q);
  });

  if (sort === 'precio_asc') filtered.sort((a,b)=>a.precio-b.precio);
  if (sort === 'precio_desc') filtered.sort((a,b)=>b.precio-a.precio);

  renderPage();
}

function renderPage(){
  const start = (page-1)*perPage;
  const items = filtered.slice(start, start+perPage);
  el.catalog.innerHTML = items.map(p => {
    const img = p.imagen ? escapeHtml(p.imagen) : 'https://via.placeholder.com/600x360?text=Sin+Imagen';
    return `\n      <article class="card" tabindex="0">\n        <img loading="lazy" src="${img}" alt="${escapeHtml(p.producto)}" data-img="${img}" onerror="this.onerror=null;this.src='https://via.placeholder.com/600x360?text=Sin+Imagen';">\n        <div class="card-body">\n          <div class="card-title">${escapeHtml(p.producto)}</div>\n          <div class="meta">Código: ${escapeHtml(p.codigo)} • ${p.uni_x_ca} u/caja</div>\n          <div class="meta">${escapeHtml(p.categoria)} — ${escapeHtml(p.origen)}${p.nota ? ' • ' + escapeHtml(p.nota) : ''}</div>\n          <div class="price">$ ${Number(p.precio).toLocaleString('es-AR',{minimumFractionDigits:2})}</div>\n        </div>\n      </article>\n    `;
  }).join('') || '<div style="padding:1rem;color:#666">No hay productos que coincidan.</div>';

  document.querySelectorAll('.card img').forEach(img => {
    img.addEventListener('click', ()=> openLightbox(img.dataset.img, img.alt));
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  el.pager.innerHTML = `${page>1?`<button onclick="prevPage()">«</button>`:''}<span class="small">Página ${page} de ${totalPages} — ${filtered.length} items</span>${page<totalPages?`<button onclick="nextPage()">»</button>`:''}`;
}

function nextPage(){ page++; renderPage(); window.scrollTo({top:0,behavior:'smooth'}); }
function prevPage(){ page--; renderPage(); window.scrollTo({top:0,behavior:'smooth'}); }

function debounce(fn, ms=200){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms) } }

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lb-img');
const lbCaption = document.getElementById('lb-caption');
const lbClose = document.querySelector('.lb-close');

function openLightbox(src, alt){
  lbImg.src = src;
  lbImg.alt = alt || '';
  lbCaption.textContent = alt || '';
  lightbox.setAttribute('aria-hidden', 'false');
}
function closeLightbox(){
  lightbox.setAttribute('aria-hidden', 'true');
  lbImg.src = '';
}

lbClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e)=>{ if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e=>{ if (e.key === 'Escape') closeLightbox(); });

el.search.addEventListener('input', debounce(applyFilters, 300));
el.categoria.addEventListener('change', applyFilters);
el.origen.addEventListener('change', applyFilters);
el.sort.addEventListener('change', applyFilters);
el.perPageSel.addEventListener('change', applyFilters);

loadSheet();