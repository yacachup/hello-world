'use strict';

/* ── State ──────────────────────────────── */
const state = {
  query: '',
  filters: { type: '', city: '', bedsMin: '', priceMin: '', priceMax: '', sort: 'relevance' },
  selected: [],   // IDs in compare list (max 4)
  view: 'grid',   // 'grid' | 'list'
};

/* ── Helpers ────────────────────────────── */
const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

function stars(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
}

function matchesFilters(p) {
  const { query, filters } = state;
  if (query) {
    const q = query.toLowerCase();
    if (![p.title, p.location, p.neighborhood, p.type].some(s => s.toLowerCase().includes(q))) return false;
  }
  if (filters.type && p.type !== filters.type) return false;
  if (filters.city && p.city !== filters.city) return false;
  if (filters.bedsMin && p.bedrooms < Number(filters.bedsMin)) return false;
  if (filters.priceMin && p.price < Number(filters.priceMin)) return false;
  if (filters.priceMax && p.price > Number(filters.priceMax)) return false;
  return true;
}

function sortedProperties() {
  const filtered = PROPERTIES.filter(matchesFilters);
  const s = state.filters.sort;
  if (s === 'price-asc')  return [...filtered].sort((a,b) => a.price - b.price);
  if (s === 'price-desc') return [...filtered].sort((a,b) => b.price - a.price);
  if (s === 'area-desc')  return [...filtered].sort((a,b) => b.area - a.area);
  if (s === 'rating')     return [...filtered].sort((a,b) => b.rating - a.rating);
  return filtered;
}

/* ── Badge style ────────────────────────── */
function typeBadgeClass(type) {
  const map = { apartamento: '', casa: '', loft: 'loft', penthouse: 'penthouse', ph: 'ph', studio: 'studio' };
  return map[type] || '';
}

/* ── Render grid ────────────────────────── */
function renderGrid() {
  const grid = document.getElementById('propertyGrid');
  const results = sortedProperties();

  document.getElementById('resultsCount').innerHTML =
    `<strong>${results.length}</strong> propiedad${results.length !== 1 ? 'es' : ''} encontrada${results.length !== 1 ? 's' : ''}`;

  if (!results.length) {
    grid.innerHTML = `
      <div class="no-results" style="grid-column:1/-1">
        <div class="emoji">🏠</div>
        <h3>No encontramos propiedades</h3>
        <p>Probá ajustando los filtros o la búsqueda</p>
      </div>`;
    return;
  }

  grid.innerHTML = results.map(p => {
    const isSelected = state.selected.includes(p.id);
    return `
    <article class="property-card${isSelected ? ' selected' : ''}" data-id="${p.id}">
      <div class="card-image-wrap">
        <img src="${p.image}" alt="${p.title}" loading="lazy">
        <span class="card-badge ${typeBadgeClass(p.type)}">${p.type}</span>
        <button class="card-compare-check" onclick="toggleCompare(${p.id}, event)" title="Comparar">
          ${isSelected ? '✓' : '+'}
        </button>
      </div>
      <div class="card-body">
        <div class="card-price">${fmt(p.price)}</div>
        ${p.expenses ? `<div class="card-expenses">+ $${p.expenses}/mes expensas</div>` : '<div class="card-expenses">Sin expensas</div>'}
        <h3 class="card-title">${p.title}</h3>
        <p class="card-location">📍 ${p.location}</p>
        <div class="card-stats">
          <span class="stat"><span class="stat-icon">🛏</span>${p.bedrooms} dorm.</span>
          <span class="stat"><span class="stat-icon">🚿</span>${p.bathrooms} baño${p.bathrooms > 1 ? 's' : ''}</span>
          <span class="stat"><span class="stat-icon">📐</span>${p.area} m²</span>
          ${p.parking ? `<span class="stat"><span class="stat-icon">🚗</span>${p.parking}</span>` : ''}
        </div>
        <div class="card-footer">
          <span class="card-rating"><span class="star">★</span> ${p.rating}</span>
          <button class="btn-detail" onclick="openDetail(${p.id})">Ver detalles</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

/* ── Compare bar ────────────────────────── */
function renderCompareBar() {
  const bar = document.getElementById('compareBar');
  const slots = document.getElementById('compareSlots');
  const btn = document.getElementById('btnCompareNow');

  if (!state.selected.length) { bar.classList.remove('visible'); return; }
  bar.classList.add('visible');

  const MAX = 4;
  let html = '';
  for (let i = 0; i < MAX; i++) {
    const id = state.selected[i];
    if (id) {
      const p = PROPERTIES.find(x => x.id === id);
      html += `<div class="compare-slot filled">
        <span class="slot-name">${p.title}</span>
        <button class="slot-remove" onclick="toggleCompare(${id})" title="Quitar">×</button>
      </div>`;
    } else {
      html += `<div class="compare-slot"><span class="slot-placeholder">+ Agregar propiedad</span></div>`;
    }
  }
  slots.innerHTML = html;
  btn.disabled = state.selected.length < 2;

  // update header button
  const hBtn = document.getElementById('headerCompareBtn');
  hBtn.classList.toggle('hidden', !state.selected.length);
  document.getElementById('headerCompareCount').textContent = state.selected.length;
}

/* ── Toggle compare ─────────────────────── */
function toggleCompare(id, event) {
  if (event) event.stopPropagation();
  const idx = state.selected.indexOf(id);
  if (idx === -1) {
    if (state.selected.length >= 4) {
      showToast('Máximo 4 propiedades para comparar');
      return;
    }
    state.selected.push(id);
  } else {
    state.selected.splice(idx, 1);
  }
  renderGrid();
  renderCompareBar();
}

/* ── Comparison modal ───────────────────── */
function openComparison() {
  if (state.selected.length < 2) return;
  const props = state.selected.map(id => PROPERTIES.find(p => p.id === id));
  const modal = document.getElementById('compareModal');

  const minPrice = Math.min(...props.map(p => p.price));
  const maxArea  = Math.max(...props.map(p => p.area));

  const headers = props.map(p => `
    <th>
      <div class="comp-card-header">
        <img src="${p.image}" alt="${p.title}">
        <div class="comp-card-price">${fmt(p.price)}
          ${p.price === minPrice ? '<div class="best-value">Mejor precio</div>' : ''}
        </div>
        <div class="comp-card-title">${p.title}</div>
        <div class="comp-card-loc">📍 ${p.location}</div>
      </div>
    </th>`).join('');

  const rows = [
    { label: 'Tipo',         fn: p => p.type.charAt(0).toUpperCase() + p.type.slice(1) },
    { label: 'Superficie',   fn: p => `${p.area} m²${p.area === maxArea ? ' ★' : ''}`, cls: 'highlight-row' },
    { label: 'Dormitorios',  fn: p => p.bedrooms },
    { label: 'Baños',        fn: p => p.bathrooms },
    { label: 'Cochera',      fn: p => p.parking ? `${p.parking} espacio${p.parking > 1 ? 's' : ''}` : '—' },
    { label: 'Piso',         fn: p => p.floor != null ? `Piso ${p.floor}` : 'PB / Casa' },
    { label: 'Año const.',   fn: p => p.yearBuilt },
    { label: 'Estado',       fn: p => p.condition },
    { label: 'Expensas',     fn: p => p.expenses ? `$${p.expenses}/mes` : 'Sin expensas' },
    { label: 'Calificación', fn: p => `★ ${p.rating}`, cls: 'highlight-row' },
    { label: 'Amenities',    fn: p => p.amenities.join(', '), wide: true },
  ];

  const tbody = rows.map(row => `
    <tr${row.cls ? ` class="${row.cls}"` : ''}>
      <td>${row.label}</td>
      ${props.map(p => `<td>${row.fn(p)}</td>`).join('')}
    </tr>`).join('');

  document.getElementById('compareTableWrap').innerHTML = `
    <table class="comparison-table">
      <thead><tr><th></th>${headers}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>`;

  modal.classList.add('open');
}

/* ── Detail modal ───────────────────────── */
function openDetail(id) {
  const p = PROPERTIES.find(x => x.id === id);
  const modal = document.getElementById('detailModal');
  const isSelected = state.selected.includes(id);

  document.getElementById('detailContent').innerHTML = `
    <img class="detail-image" src="${p.image}" alt="${p.title}">
    <div class="detail-body">
      <div class="detail-price-row">
        <div class="detail-price">${fmt(p.price)}</div>
        <span class="detail-type-badge">${p.type}</span>
      </div>
      <h2 class="detail-title">${p.title}</h2>
      <p class="detail-location">📍 ${p.location}</p>
      <div class="detail-stats">
        <div class="detail-stat"><div class="detail-stat-icon">🛏</div><div class="detail-stat-val">${p.bedrooms}</div><div class="detail-stat-lbl">Dorm.</div></div>
        <div class="detail-stat"><div class="detail-stat-icon">🚿</div><div class="detail-stat-val">${p.bathrooms}</div><div class="detail-stat-lbl">Baños</div></div>
        <div class="detail-stat"><div class="detail-stat-icon">📐</div><div class="detail-stat-val">${p.area}</div><div class="detail-stat-lbl">m²</div></div>
        <div class="detail-stat"><div class="detail-stat-icon">🚗</div><div class="detail-stat-val">${p.parking || '—'}</div><div class="detail-stat-lbl">Cochera</div></div>
        <div class="detail-stat"><div class="detail-stat-icon">🏢</div><div class="detail-stat-val">${p.floor != null ? p.floor : '—'}</div><div class="detail-stat-lbl">Piso</div></div>
        <div class="detail-stat"><div class="detail-stat-icon">📅</div><div class="detail-stat-val">${p.yearBuilt}</div><div class="detail-stat-lbl">Año</div></div>
        <div class="detail-stat"><div class="detail-stat-icon">⭐</div><div class="detail-stat-val">${p.rating}</div><div class="detail-stat-lbl">Rating</div></div>
        <div class="detail-stat"><div class="detail-stat-icon">💰</div><div class="detail-stat-val">${p.expenses ? `$${p.expenses}` : '—'}</div><div class="detail-stat-lbl">Expensas</div></div>
      </div>
      <p class="detail-section-title">Descripción</p>
      <p class="detail-description">${p.description}</p>
      <p class="detail-section-title">Amenities</p>
      <div class="amenities-list">${p.amenities.map(a => `<span class="amenity-tag">✓ ${a}</span>`).join('')}</div>
      <div class="detail-actions">
        <button class="btn-add-compare" onclick="toggleCompare(${p.id}); renderCompareBar(); updateDetailBtn(${p.id})">
          ${isSelected ? '✓ En comparación' : '+ Agregar a comparación'}
        </button>
      </div>
    </div>`;

  modal.classList.add('open');
}

function updateDetailBtn(id) {
  const btn = document.querySelector('#detailContent .btn-add-compare');
  if (!btn) return;
  const selected = state.selected.includes(id);
  btn.textContent = selected ? '✓ En comparación' : '+ Agregar a comparación';
}

/* ── Modals close ───────────────────────── */
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

/* ── Toast ──────────────────────────────── */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(20px)'; }, 2400);
}

/* ── Filter & search handlers ───────────── */
function applyFilters() {
  state.filters.type    = document.getElementById('filterType').value;
  state.filters.city    = document.getElementById('filterCity').value;
  state.filters.bedsMin = document.getElementById('filterBeds').value;
  state.filters.priceMin = document.getElementById('filterPriceMin').value;
  state.filters.priceMax = document.getElementById('filterPriceMax').value;
  state.filters.sort    = document.getElementById('filterSort').value;
  renderGrid();
}

function clearFilters() {
  state.query = '';
  state.filters = { type: '', city: '', bedsMin: '', priceMin: '', priceMax: '', sort: 'relevance' };
  document.getElementById('searchInput').value = '';
  document.getElementById('filterType').value = '';
  document.getElementById('filterCity').value = '';
  document.getElementById('filterBeds').value = '';
  document.getElementById('filterPriceMin').value = '';
  document.getElementById('filterPriceMax').value = '';
  document.getElementById('filterSort').value = 'relevance';
  renderGrid();
}

/* ── Init ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderGrid();
  renderCompareBar();

  // search
  const searchInput = document.getElementById('searchInput');
  const doSearch = () => { state.query = searchInput.value.trim(); renderGrid(); };
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  document.getElementById('btnSearch').addEventListener('click', doSearch);

  // filters
  ['filterType','filterCity','filterBeds','filterSort'].forEach(id =>
    document.getElementById(id).addEventListener('change', applyFilters));
  ['filterPriceMin','filterPriceMax'].forEach(id =>
    document.getElementById(id).addEventListener('input', applyFilters));

  // view toggle
  document.getElementById('btnGrid').addEventListener('click', () => {
    state.view = 'grid';
    document.getElementById('propertyGrid').classList.remove('list-view');
    document.getElementById('btnGrid').classList.add('active');
    document.getElementById('btnList').classList.remove('active');
  });
  document.getElementById('btnList').addEventListener('click', () => {
    state.view = 'list';
    document.getElementById('propertyGrid').classList.add('list-view');
    document.getElementById('btnList').classList.add('active');
    document.getElementById('btnGrid').classList.remove('active');
  });

  // compare now
  document.getElementById('btnCompareNow').addEventListener('click', openComparison);
  document.getElementById('headerCompareBtn').addEventListener('click', openComparison);

  // clear compare
  document.getElementById('btnClearCompare').addEventListener('click', () => {
    state.selected = [];
    renderGrid();
    renderCompareBar();
  });

  // modal overlays
  document.getElementById('compareModal').addEventListener('click', e => {
    if (e.target.id === 'compareModal') closeModal('compareModal');
  });
  document.getElementById('detailModal').addEventListener('click', e => {
    if (e.target.id === 'detailModal') closeModal('detailModal');
  });

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('compareModal');
      closeModal('detailModal');
    }
  });
});
