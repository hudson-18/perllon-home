// ============================================================
// PERLLON — Admin panel (single file SPA, hash routing)
// ============================================================
// Routes: #/login, #/dashboard, #/products, #/products/new,
//         #/products/:id, #/spotlight
// Authorization is enforced server-side via RLS; this SPA only
// reflects it (the UI hides nothing the DB doesn't already protect).

import './admin.css';
import { isSupabaseConfigured } from '../lib/supabase.js';
import * as admin from '../lib/admin.js';
import { money } from '../lib/catalog.js';
import { uploadProductImage, deleteProductImage, uploadMedia, deleteMedia, mediaPublicUrl, HERO_BUCKET } from '../lib/storage.js';
import logoPerllonUrl from '../assets/images/logo-perllon.svg';

const $ = (s, c = document) => c.querySelector(s);
const root = () => $('#admin-root');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer = null;
function toast(msg, type = '') {
  const old = $('.toast-admin');
  if (old) old.remove();
  clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = `toast-admin ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), 3200);
}

// ---------- Routing ----------
let currentProfile = null;

const routes = {
  login: renderLogin,
  dashboard: renderDashboard,
  products: renderProducts,
  'products/new': renderProductForm,
  'products/:id': renderProductForm,
  spotlight: renderSpotlight,
  hero: renderHero,
};

function parseHash() {
  const h = location.hash.replace(/^#\//, '');
  if (!h || h === '' || h === 'login') return { name: 'login' };
  if (h === 'dashboard') return { name: 'dashboard' };
  if (h === 'spotlight') return { name: 'spotlight' };
  if (h === 'hero') return { name: 'hero' };
  if (h === 'products') return { name: 'products' };
  if (h === 'products/new') return { name: 'products/new' };
  const m = h.match(/^products\/(.+)$/);
  if (m) return { name: 'products/:id', id: m[1] };
  return { name: 'dashboard' };
}

async function router() {
  const { name, id } = parseHash();

  // Not configured → friendly placeholder.
  if (!isSupabaseConfigured()) {
    root().innerHTML = notConfigured();
    return;
  }

  // Not authenticated → force login (for anything but login itself).
  currentProfile = await admin.currentProfile().catch(() => null);
  if (!currentProfile && name !== 'login') {
    location.hash = '#/login';
    return;
  }
  if (currentProfile && name === 'login') {
    location.hash = '#/dashboard';
    return;
  }

  const fn = routes[name];
  if (!fn) { location.hash = '#/dashboard'; return; }
  await fn(id);
}

// ---------- Shell ----------
function shell(active, content) {
  const roleName = currentProfile?.role?.name || '';
  const userLabel = esc(currentProfile?.full_name || currentProfile?.id || '');
  const navLinks = `
    <a href="#/dashboard" class="${active === 'dashboard' ? 'active' : ''}">Dashboard</a>
    <a href="#/products" class="${active === 'products' ? 'active' : ''}">Produtos</a>
    <a href="#/products/new" class="${active === 'product-new' ? 'active' : ''}">Novo produto</a>
    <a href="#/spotlight" class="${active === 'spotlight' ? 'active' : ''}">Destaque</a>
    <a href="#/hero" class="${active === 'hero' ? 'active' : ''}">Hero</a>`;

  return `
    <div class="admin-shell">
      <aside class="sidebar">
        <img class="sidebar-logo" src="${logoPerllonUrl}" alt="PERLLON">
        <nav>${navLinks}</nav>
        <div class="sidebar-footer">
          <div class="user">${userLabel}</div>
          <div class="role">${esc(roleName)}</div>
          <button class="btn btn-sm" id="logout-btn">Sair</button>
        </div>
      </aside>

      <header class="mobile-header">
        <img class="mobile-header-logo" src="${logoPerllonUrl}" alt="PERLLON">
        <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Abrir menu" aria-expanded="false" aria-controls="mobile-drawer">
          <span class="mobile-menu-icon"></span>
        </button>
      </header>

      <div class="drawer-overlay" id="drawer-overlay" hidden></div>
      <aside class="mobile-drawer" id="mobile-drawer" aria-hidden="true">
        <div class="mobile-drawer-head">
          <img class="mobile-drawer-logo" src="${logoPerllonUrl}" alt="PERLLON">
          <button class="mobile-close-btn" id="mobile-close-btn" aria-label="Fechar menu">×</button>
        </div>
        <nav id="mobile-drawer-nav">${navLinks}</nav>
        <div class="mobile-drawer-footer">
          <div class="user">${userLabel}</div>
          <div class="role">${esc(roleName)}</div>
          <button class="btn btn-sm" id="logout-btn-mobile">Sair</button>
        </div>
      </aside>

      <main class="main">${content}</main>
    </div>`;

  // rebind logout + mobile drawer after render
  setTimeout(() => {
    $('#logout-btn')?.addEventListener('click', doLogout);
    $('#logout-btn-mobile')?.addEventListener('click', doLogout);
    bindMobileDrawer();
  }, 0);
}

async function doLogout() {
  await admin.signOut();
  currentProfile = null;
  location.hash = '#/login';
}

// Mobile drawer: open/close, overlay, ESC, close-on-route.
// Module-level guard to prevent duplicate delegation listeners across re-renders.
let mobileDrawerClickHandlerInstalled = false;

function bindMobileDrawer() {
  // Remove previously installed delegation listener if any.
  if (mobileDrawerClickHandlerInstalled) {
    document.removeEventListener('click', handleMobileMenuClick);
    mobileDrawerClickHandlerInstalled = false;
  }

  const setOpen = (open) => {
    const drawer = $('#mobile-drawer');
    const btn = $('#mobile-menu-btn');
    const overlay = $('#drawer-overlay');
    const nav = $('#mobile-drawer-nav');
    if (!drawer || !btn) return;
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    if (overlay) overlay.hidden = !open;
    document.body.classList.toggle('drawer-open', open);
  };
  const close = () => setOpen(false);

  // Event delegation on document: robust against button re-creation
  // via shell(). listens for clicks on #mobile-menu-btn anywhere in the DOM.
  const handleMobileMenuClick = (e) => {
    const btn = e.target.closest('#mobile-menu-btn');
    if (!btn) return;
    e.stopPropagation();
    setOpen(!$('#mobile-drawer')?.classList.contains('is-open'));
  };
  document.addEventListener('click', handleMobileMenuClick);
  mobileDrawerClickHandlerInstalled = true;

  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  overlay?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  // Close when a nav route is selected.
  nav?.addEventListener('click', (e) => {
    if (e.target.closest('a')) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#mobile-drawer')?.classList.contains('is-open')) close();
  });
}

// ---------- Login ----------
function renderLogin() {
  root().innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <img class="login-logo" src="${logoPerllonUrl}" alt="PERLLON">
        <h1>Acesso administrativo</h1>
        <p class="login-sub">Entre com suas credenciais PERLLON.</p>
        <form id="login-form">
          <div class="field">
            <label for="email">E-mail</label>
            <input type="email" id="email" name="email" autocomplete="username" required>
          </div>
          <div class="field" style="margin-top:12px">
            <label for="password">Senha</label>
            <input type="password" id="password" name="password" autocomplete="current-password" required>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%;margin-top:20px">Entrar</button>
        </form>
        <p class="login-sub" style="margin-top:16px"><a href="/" style="color:var(--navy)">← Voltar ao site</a></p>
      </div>
    </div>`;

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#email').value.trim();
    const password = $('#password').value;
    if (!email || !password) { toast('Informe e-mail e senha.', 'error'); return; }
    const btn = $('#login-form button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      await admin.signIn(email, password);
      location.hash = '#/dashboard';
    } catch (err) {
      toast(err.message || 'Falha no login.', 'error');
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  });
}

// ---------- Dashboard ----------
async function renderDashboard() {
  root().innerHTML = shell('dashboard', `<div class="loading">Carregando…</div>`);
  try {
    const [stats, audit] = await Promise.all([admin.dashboardStats(), admin.recentAudit(8)]);
    root().innerHTML = shell('dashboard', `
      <div class="main-head"><h2>Dashboard</h2>
        <a href="#/products/new" class="btn btn-orange">+ Novo produto</a>
      </div>
      <div class="stats-grid">
        <div class="stat"><div class="num">${stats.total}</div><div class="lbl">Produtos cadastrados</div></div>
        <div class="stat"><div class="num" style="color:#079455">${stats.active}</div><div class="lbl">Ativos</div></div>
        <div class="stat"><div class="num" style="color:#d92d20">${stats.inactive}</div><div class="lbl">Inativos</div></div>
        <div class="stat"><div class="num">${stats.archived}</div><div class="lbl">Arquivados</div></div>
      </div>
      <div class="card">
        <h3 style="margin:0 0 12px">Atividade recente</h3>
        ${audit.length ? auditTable(audit) : '<div class="empty">Nenhuma atividade registrada.</div>'}
      </div>`);
  } catch (err) {
    root().innerHTML = shell('dashboard', `<div class="empty">Erro ao carregar: ${esc(err.message)}</div>`);
  }
}

function auditTable(audit) {
  const rows = audit.map((a) => `
    <tr>
      <td>${esc(a.action)}</td>
      <td>${esc(a.entity)}${a.entity_id ? ' · ' + esc(a.entity_id) : ''}</td>
      <td>${esc(a.actor_email || '—')}</td>
      <td>${new Date(a.created_at).toLocaleString('pt-BR')}</td>
    </tr>`).join('');
  return `<div class="table-wrap"><table><thead><tr><th>Ação</th><th>Entidade</th><th>Usuário</th><th>Quando</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ---------- Products list ----------
async function renderProducts() {
  root().innerHTML = shell('products', `<div class="loading">Carregando produtos…</div>`);
  try {
    const [products, brands, categories] = await Promise.all([
      admin.listProductsAll(), admin.listBrands(), admin.listCategories(),
    ]);
    const brandById = Object.fromEntries(brands.map((b) => [b.id, b.name]));
    const catById = Object.fromEntries(categories.map((c) => [c.id, c.name]));

    const rows = products.map((p) => {
      const primary = (p.product_images || []).find((i) => i.is_primary) || (p.product_images || [])[0];
      const img = primary ? imageUrlOrNull(primary.storage_path) : null;
      const brand = p.brand_id ? brandById[p.brand_id] : (p.brand?.name || '—');
      const cat = p.category_id ? catById[p.category_id] : (p.category?.name || '—');
      return `
        <tr>
          <td>${img ? `<img class="thumb" src="${esc(img)}" alt="">` : '<span style="color:var(--muted)">—</span>'}</td>
          <td><a href="#/products/${p.id}" style="color:var(--navy);font-weight:600;text-decoration:none">${esc(p.name)}</a></td>
          <td>${esc(brand)}</td>
          <td>${esc(cat)}</td>
          <td>${money(p.price_cents)}</td>
          <td><span class="badge ${p.status}">${esc(p.status)}</span></td>
          <td style="white-space:nowrap">
            <a href="#/products/${p.id}" class="btn btn-sm">Editar</a>
            ${p.status !== 'active'
              ? `<button class="btn btn-sm" data-activate="${p.id}">Ativar</button>`
              : `<button class="btn btn-sm" data-deactivate="${p.id}">Desativar</button>`}
          </td>
        </tr>`;
    }).join('');

    root().innerHTML = shell('products', `
      <div class="main-head"><h2>Produtos</h2><a href="#/products/new" class="btn btn-orange">+ Novo produto</a></div>
      <div class="toolbar">
        <input type="search" id="product-search" placeholder="Buscar produto…">
        <select id="filter-category"><option value="">Todas as categorias</option>${categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
        <select id="filter-status">
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="archived">Arquivados</option>
        </select>
      </div>
      <div class="table-wrap">
        <table><thead><tr><th></th><th>Nome</th><th>Marca</th><th>Categoria</th><th>Preço</th><th>Status</th><th></th></tr></thead>
        <tbody id="products-tbody">${rows || '<tr><td colspan="7" class="empty">Nenhum produto cadastrado.</td></tr>'}</tbody></table>
      </div>`);

    // inline filters (client-side, quick)
    const applyFilter = () => {
      const q = $('#product-search')?.value.toLowerCase() || '';
      const cat = $('#filter-category')?.value || '';
      const st = $('#filter-status')?.value || '';
      const filtered = products.filter((p) => {
        const okQ = !q || p.name.toLowerCase().includes(q);
        const okC = !cat || p.category_id === cat;
        const okS = !st || p.status === st;
        return okQ && okC && okS;
      });
      $('#products-tbody').innerHTML = filtered.length
        ? filtered.map((p) => {
            const primary = (p.product_images || []).find((i) => i.is_primary) || (p.product_images || [])[0];
            const img = primary ? imageUrlOrNull(primary.storage_path) : null;
            const brand = p.brand_id ? brandById[p.brand_id] : (p.brand?.name || '—');
            const cat2 = p.category_id ? catById[p.category_id] : (p.category?.name || '—');
            return `<tr>
              <td>${img ? `<img class="thumb" src="${esc(img)}" alt="">` : '—'}</td>
              <td><a href="#/products/${p.id}" style="color:var(--navy);font-weight:600;text-decoration:none">${esc(p.name)}</a></td>
              <td>${esc(brand)}</td><td>${esc(cat2)}</td><td>${money(p.price_cents)}</td>
              <td><span class="badge ${p.status}">${esc(p.status)}</span></td>
              <td style="white-space:nowrap"><a href="#/products/${p.id}" class="btn btn-sm">Editar</a>
              ${p.status !== 'active' ? `<button class="btn btn-sm" data-activate="${p.id}">Ativar</button>` : `<button class="btn btn-sm" data-deactivate="${p.id}">Desativar</button>`}</td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="7" class="empty">Nenhum resultado.</td></tr>';
      bindStatusButtons();
    };
    $('#product-search')?.addEventListener('input', applyFilter);
    $('#filter-category')?.addEventListener('change', applyFilter);
    $('#filter-status')?.addEventListener('change', applyFilter);
    bindStatusButtons();
  } catch (err) {
    root().innerHTML = shell('products', `<div class="empty">Erro: ${esc(err.message)}</div>`);
  }
}

function imageUrlOrNull(path) {
  if (!path) return null;
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (url && !url.includes('YOUR-PROJECT')) return `${url}/storage/v1/object/public/product-images/${path}`;
  return null;
}

function bindStatusButtons() {
  $$('[data-activate]').forEach((b) => b.addEventListener('click', async () => {
    try { await admin.setProductStatus(b.dataset.activate, 'active'); toast('Produto ativado.', 'success'); router(); }
    catch (e) { toast(e.message, 'error'); }
  }));
  $$('[data-deactivate]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Desativar este produto? Ele deixará de aparecer no site.')) return;
    try { await admin.setProductStatus(b.dataset.deactivate, 'inactive'); toast('Produto desativado.', 'success'); router(); }
    catch (e) { toast(e.message, 'error'); }
  }));
}

// ---------- Product form (new + edit) ----------
async function renderProductForm(id) {
  const isNew = !id;
  root().innerHTML = shell(isNew ? 'product-new' : 'products', `<div class="loading">Carregando…</div>`);

  try {
    const [brands, categories] = await Promise.all([admin.listBrands(), admin.listCategories()]);
    let product = null;
    if (!isNew) product = await admin.getProduct(id);

    const p = product || {};
    const specs = p.product_specifications || [];
    const images = p.product_images || [];

    root().innerHTML = shell(isNew ? 'product-new' : 'products', `
      <div class="main-head"><h2>${isNew ? 'Novo produto' : 'Editar produto'}</h2>
        <a href="#/products" class="btn">← Voltar</a></div>

      <form id="product-form">
        <div class="card" style="margin-bottom:16px">
          <h3 style="margin:0 0 16px">Dados básicos</h3>
          <div class="form-grid">
            <div class="field full">
              <label>Nome *</label>
              <input name="name" value="${esc(p.name || '')}" required placeholder="Ex.: iPhone 17">
            </div>
            <div class="field">
              <label>Marca</label>
              <select name="brand_id" id="brand-select">
                <option value="">—</option>
                ${brands.map((b) => `<option value="${b.id}" ${p.brand_id === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
              </select>
              <button type="button" class="btn btn-sm" id="new-brand-btn">+ Nova marca</button>
              <div id="new-brand-row" style="display:none;flex;gap:8px;align-items:center">
                <input id="new-brand-name" placeholder="Nome da marca" style="flex:1">
                <button type="button" class="btn btn-sm btn-primary" id="save-brand-btn">Criar</button>
                <button type="button" class="btn btn-sm" id="cancel-brand-btn">×</button>
              </div>
            </div>
            <div class="field">
              <label>Categoria</label>
              <select name="category_id" id="category-select">
                <option value="">—</option>
                ${categories.map((c) => `<option value="${c.id}" ${p.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
              </select>
              <button type="button" class="btn btn-sm" id="new-category-btn">+ Nova categoria</button>
              <div id="new-category-row" style="display:none;flex;gap:8px;align-items:center">
                <input id="new-category-name" placeholder="Nome da categoria" style="flex:1">
                <button type="button" class="btn btn-sm btn-primary" id="save-category-btn">Criar</button>
                <button type="button" class="btn btn-sm" id="cancel-category-btn">×</button>
              </div>
            </div>
            <div class="field full">
              <label>Descrição</label>
              <textarea name="description">${esc(p.description || '')}</textarea>
            </div>
            <div class="field full">
              <label>Slug</label>
              <input name="slug" value="${esc(p.slug || '')}" placeholder="iphone-17-256gb-preto">
              <span class="hint">Identificador único na URL (minúsculas, hífens).</span>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <h3 style="margin:0 0 16px">Preço</h3>
          <div class="form-grid">
            <div class="field">
              <label>Preço à vista (R$) *</label>
              <input name="price" type="number" min="0" step="0.01" value="${p.price_cents != null ? (p.price_cents / 100) : ''}" required placeholder="5600.00">
            </div>
            <div class="field">
              <label>Nº de parcelas</label>
              <input name="installments_count" type="number" min="0" value="${p.installments_count ?? ''}" placeholder="12">
            </div>
            <div class="field">
              <label>Valor da parcela (R$)</label>
              <input name="installment" type="number" min="0" step="0.01" value="${p.installment_cents != null ? (p.installment_cents / 100) : ''}" placeholder="537.00">
            </div>
            <div class="field">
              <label>Status</label>
              <select name="status">
                <option value="inactive" ${p.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                <option value="active" ${p.status === 'active' ? 'selected' : ''}>Ativo</option>
                <option value="archived" ${p.status === 'archived' ? 'selected' : ''}>Arquivado</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <h3 style="margin:0 0 8px">Especificações</h3>
          <p style="color:var(--muted);font-size:13px;margin:0 0 16px">Chave/valor flexível (ex.: Armazenamento → 256 GB). Adicione apenas o que for confirmado.</p>
          <div id="specs-list"></div>
          <button type="button" class="btn" id="add-spec">+ Especificação</button>
        </div>

        <div class="card" style="margin-bottom:16px">
          <h3 style="margin:0 0 12px">Imagens</h3>
          <div id="images-list"></div>
          <input type="file" id="image-upload" accept="image/jpeg,image/png,image/webp,image/avif" style="margin-top:12px">
          <span class="hint" style="display:block;margin-top:6px">JPG, PNG, WebP ou AVIF · até 8 MB</span>
        </div>

        <div style="display:flex;gap:12px;justify-content:flex-end">
          <a href="#/products" class="btn">Cancelar</a>
          <button type="submit" class="btn btn-orange btn-lg">Salvar produto</button>
        </div>
      </form>`);

    // inline brand/category creation
    const brandSelect = $('#brand-select');
    const categorySelect = $('#category-select');
    const newBrandBtn = $('#new-brand-btn');
    const newCategoryBtn = $('#new-category-btn');
    const brandRow = $('#new-brand-row');
    const categoryRow = $('#new-category-row');
    const brandNameInput = $('#new-brand-name');
    const categoryNameInput = $('#new-category-name');

    newBrandBtn.addEventListener('click', () => { brandRow.style.display = 'flex'; newBrandBtn.style.display = 'none'; brandNameInput.focus(); });
    $('#cancel-brand-btn').addEventListener('click', () => { brandRow.style.display = 'none'; newBrandBtn.style.display = ''; brandNameInput.value = ''; });
    $('#save-brand-btn').addEventListener('click', async () => {
      const name = brandNameInput.value.trim();
      if (!name) { toast('Informe o nome da marca.', 'error'); return; }
      try {
        const created = await admin.upsertBrand({ name });
        const opt = document.createElement('option');
        opt.value = created.id; opt.textContent = created.name; opt.selected = true;
        brandSelect.appendChild(opt);
        brandRow.style.display = 'none'; newBrandBtn.style.display = ''; brandNameInput.value = '';
        toast('Marca criada.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });

    newCategoryBtn.addEventListener('click', () => { categoryRow.style.display = 'flex'; newCategoryBtn.style.display = 'none'; categoryNameInput.focus(); });
    $('#cancel-category-btn').addEventListener('click', () => { categoryRow.style.display = 'none'; newCategoryBtn.style.display = ''; categoryNameInput.value = ''; });
    $('#save-category-btn').addEventListener('click', async () => {
      const name = categoryNameInput.value.trim();
      if (!name) { toast('Informe o nome da categoria.', 'error'); return; }
      try {
        const created = await admin.upsertCategory({ name });
        const opt = document.createElement('option');
        opt.value = created.id; opt.textContent = created.name; opt.selected = true;
        categorySelect.appendChild(opt);
        categoryRow.style.display = 'none'; newCategoryBtn.style.display = ''; categoryNameInput.value = '';
        toast('Categoria criada.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });

    // specs editor
    const specsList = $('#specs-list');
    const renderSpecs = () => {
      specsList.innerHTML = specs.map((s, i) => `
        <div class="spec-row" data-i="${i}">
          <input value="${esc(s.key)}" placeholder="Chave" data-k>
          <input value="${esc(s.value)}" placeholder="Valor" data-v>
          <button type="button" class="btn btn-sm btn-danger" data-del>×</button>
        </div>`).join('');
      // keep in-memory sync helper (inputs update `specs` on change)
      specsList.querySelectorAll('.spec-row').forEach((row) => {
        const i = +row.dataset.i;
        row.querySelector('[data-k]').addEventListener('input', (e) => { specs[i].key = e.target.value; });
        row.querySelector('[data-v]').addEventListener('input', (e) => { specs[i].value = e.target.value; });
        row.querySelector('[data-del]').addEventListener('click', () => { specs.splice(i, 1); renderSpecs(); });
      });
    };
    specs.forEach((s, i) => { /* already arrays of objects */ });
    renderSpecs();
    $('#add-spec').addEventListener('click', () => { specs.push({ key: '', value: '', sort_order: specs.length }); renderSpecs(); });

    // images list
    const imagesList = $('#images-list');
    const renderImages = () => {
      imagesList.innerHTML = images.length
        ? images.map((im, i) => `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <img class="thumb" style="width:48px;height:48px" src="${esc(imageUrlOrNull(im.storage_path) || '')}" alt="">
            <span style="flex:1;font-size:13px;color:var(--muted)">${esc(im.storage_path)}</span>
            <span class="badge ${im.is_primary ? 'active' : 'inactive'}">${im.is_primary ? 'principal' : 'secundária'}</span>
            <button type="button" class="btn btn-sm btn-danger" data-rmimg="${im.id}" data-path="${esc(im.storage_path)}">Remover</button>
          </div>`).join('')
        : '<div class="empty" style="padding:16px">Nenhuma imagem.</div>';
      imagesList.querySelectorAll('[data-rmimg]').forEach((b) => b.addEventListener('click', async () => {
        try {
          await admin.removeProductImage(b.dataset.rmimg);
          if (b.dataset.path) await deleteProductImage(b.dataset.path).catch(() => {});
          toast('Imagem removida.', 'success');
          const idx = images.findIndex((im) => im.id === b.dataset.rmimg);
          if (idx >= 0) images.splice(idx, 1);
          renderImages();
        } catch (e) { toast(e.message, 'error'); }
      }));
    };
    renderImages();

    // image upload (needs an existing product id)
    $('#image-upload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (isNew) { toast('Salve o produto antes de enviar imagens.', 'error'); return; }
      try {
        const isPrimary = images.length === 0;
        const { path } = await uploadProductImage(file, id);
        await admin.addProductImage(id, { storage_path: path, alt_text: p.name || '', is_primary: isPrimary, sort_order: images.length });
        images.push({ id: crypto.randomUUID(), storage_path: path, is_primary: isPrimary });
        toast('Imagem enviada.', 'success');
        renderImages();
      } catch (err) { toast(err.message, 'error'); }
      e.target.value = '';
    });

    // submit
    $('#product-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = (fd.get('name') || '').toString().trim();
      const priceStr = (fd.get('price') || '0').toString();
      const priceCents = Math.round(parseFloat(priceStr) * 100);
      if (!name) { toast('Informe o nome do produto.', 'error'); return; }
      if (!priceStr || isNaN(priceCents) || priceCents < 0) { toast('Preço inválido.', 'error'); return; }

      let slug = (fd.get('slug') || '').toString().trim();
      if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9áéíóúãõç]+/g, '-').replace(/^-+|-+$/g, '');

      const payload = {
        name,
        slug,
        description: (fd.get('description') || '').toString().trim() || null,
        brand_id: (fd.get('brand_id') || '').toString() || null,
        category_id: (fd.get('category_id') || '').toString() || null,
        price_cents: priceCents,
        installments_count: fd.get('installments_count') ? parseInt(fd.get('installments_count'), 10) : null,
        installment_cents: fd.get('installment') ? Math.round(parseFloat(fd.get('installment')) * 100) : null,
        status: fd.get('status') || 'inactive',
      };

      try {
        let savedId = id;
        if (isNew) {
          const created = await admin.createProduct(payload);
          savedId = created.id;
        } else {
          await admin.updateProduct(id, payload);
          savedId = id;
        }
        // persist specs (only for existing; new handle after create)
        if (!isNew || savedId) {
          await admin.replaceSpecifications(savedId, specs.filter((s) => s.key && s.value));
        }
        toast(isNew ? 'Produto criado.' : 'Produto salvo.', 'success');
        location.hash = `#/products/${savedId}`;
        router();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  } catch (err) {
    root().innerHTML = shell('products', `<div class="empty">Erro: ${esc(err.message)}</div>`);
  }
}

// ---------- Spotlight ----------
async function renderSpotlight() {
  root().innerHTML = shell('spotlight', `<div class="loading">Carregando…</div>`);
  try {
    const [products, spot, categories] = await Promise.all([
      admin.listProductsAll(), admin.getSpotlight(), admin.listCategories(),
    ]);
    const activeProducts = products.filter((p) => p.status === 'active');
    const catById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    const overrideUrl = spot?.image_path_override ? mediaPublicUrl('product-images', spot.image_path_override) : null;

    root().innerHTML = shell('spotlight', `
      <div class="main-head"><h2>Produto em destaque</h2></div>
      <form id="spot-form">
        <div class="card" style="margin-bottom:16px">
          <div class="field">
            <label>Produto destacado</label>
            <select name="product_id" required>
              <option value="">— selecione um produto ativo —</option>
              ${activeProducts.map((p) => `<option value="${p.id}" ${spot?.product_id === p.id ? 'selected' : ''}>${esc(p.name)}${p.category_id ? ' (' + esc(catById[p.category_id] || '') + ')' : ''}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="margin-top:16px">
            <label>Imagem do destaque</label>
            <p style="font-size:12px;color:var(--muted);margin:4px 0 8px">Por padrão, o destaque usa a imagem principal do produto. Você pode trocar por uma imagem personalizada.</p>
            <div class="media-picker">
              ${overrideUrl
                ? `<img src="${esc(overrideUrl)}" alt="Imagem personalizada do destaque">`
                : `<div class="media-empty">Usando a imagem do produto</div>`}
              <div class="media-actions">
                <label class="btn btn-ghost btn-sm" for="spot-image-input">Escolher imagem</label>
                <input type="file" id="spot-image-input" accept="image/jpeg,image/png,image/webp,image/avif" hidden>
                ${spot?.image_path_override ? `<button type="button" id="spot-image-remove" class="btn btn-ghost btn-sm">Remover imagem personalizada</button>` : ''}
              </div>
            </div>
          </div>
          <div class="field" style="margin-top:16px">
            <label>Título editorial (opcional)</label>
            <input name="editorial_title" value="${esc(spot?.editorial_title || '')}" placeholder="Usa o nome do produto se vazio">
          </div>
          <div class="field" style="margin-top:12px">
            <label>Subtítulo (opcional)</label>
            <input name="editorial_subtitle" value="${esc(spot?.editorial_subtitle || '')}">
          </div>
          <div class="field" style="margin-top:12px">
            <label>Descrição (opcional)</label>
            <textarea name="editorial_body">${esc(spot?.editorial_body || '')}</textarea>
          </div>
          <div class="field" style="margin-top:12px">
            <label>Rótulo do CTA (opcional)</label>
            <input name="cta_label" value="${esc(spot?.cta_label || '')}" placeholder="Consultar pelo WhatsApp">
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin-top:16px;font-size:14px">
            <input type="checkbox" name="active" ${spot?.active === false ? '' : 'checked'}> Em destaque no site
          </label>
        </div>
        <div style="display:flex;gap:12px;justify-content:flex-end">
          <button type="submit" class="btn btn-orange btn-lg">Salvar destaque</button>
        </div>
      </form>`);

    // ---- Image picker: upload persists immediately, remove clears ----
    const imgInput = $('#spot-image-input');
    const rmBtn = $('#spot-image-remove');
    if (imgInput) imgInput.addEventListener('change', async () => {
      const f = imgInput.files?.[0];
      if (!f) return;
      imgInput.disabled = true;
      try {
        toast('Enviando imagem…');
        const { path } = await uploadMedia('product-images', f, 'spotlight', 'image');
        // Persist immediately so the preview + public site reflect it at once.
        await admin.setSpotlight({
          product_id: spot?.product_id || $('#spot-form [name=product_id]')?.value,
          active: spot?.active ?? true,
          editorial_title: spot?.editorial_title ?? null,
          editorial_subtitle: spot?.editorial_subtitle ?? null,
          editorial_body: spot?.editorial_body ?? null,
          cta_label: spot?.cta_label ?? null,
          image_path_override: path,
        });
        toast('Imagem do destaque atualizada com sucesso.', 'success');
        await renderSpotlight();
      } catch (err) { toast(err.message || 'Não foi possível enviar a imagem.', 'error'); imgInput.disabled = false; }
    });
    if (rmBtn) rmBtn.addEventListener('click', async () => {
      rmBtn.disabled = true;
      try {
        await deleteMedia('product-images', spot.image_path_override);
        await admin.setSpotlight({
          product_id: spot?.product_id,
          active: spot?.active ?? true,
          editorial_title: spot?.editorial_title ?? null,
          editorial_subtitle: spot?.editorial_subtitle ?? null,
          editorial_body: spot?.editorial_body ?? null,
          cta_label: spot?.cta_label ?? null,
          image_path_override: null,
        });
        toast('Imagem personalizada removida. Usando a imagem do produto.', 'success');
        await renderSpotlight();
      } catch (err) { toast(err.message || 'Não foi possível remover a imagem.', 'error'); rmBtn.disabled = false; }
    });

    $('#spot-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const product_id = (fd.get('product_id') || '').toString();
      if (!product_id) { toast('Selecione um produto.', 'error'); return; }
      try {
        await admin.setSpotlight({
          product_id,
          active: fd.get('active') === 'on',
          editorial_title: (fd.get('editorial_title') || '').toString().trim() || null,
          editorial_subtitle: (fd.get('editorial_subtitle') || '').toString().trim() || null,
          editorial_body: (fd.get('editorial_body') || '').toString().trim() || null,
          cta_label: (fd.get('cta_label') || '').toString().trim() || null,
          image_path_override: spot?.image_path_override ?? null,
        });
        toast('Destaque publicado.', 'success');
        router();
      } catch (err) { toast(err.message || 'Não foi possível salvar o destaque.', 'error'); }
    });
  } catch (err) {
    root().innerHTML = shell('spotlight', `<div class="empty">Erro: ${esc(err.message)}</div>`);
  }
}

// ---------- Hero media management ----------
async function renderHero() {
  root().innerHTML = shell('hero', `<div class="loading">Carregando…</div>`);
  try {
    const hero = await admin.getHeroMedia();

    const videoUrl = hero?.video_path ? mediaPublicUrl(HERO_BUCKET, hero.video_path) : null;
    const posterUrl = hero?.poster_path ? mediaPublicUrl(HERO_BUCKET, hero.poster_path) : null;

    root().innerHTML = shell('hero', `
      <div class="main-head"><h2>Hero principal</h2></div>
      <form id="hero-form">
        <div class="card" style="margin-bottom:16px">

          <div class="field">
            <label>Vídeo do Hero</label>
            <p style="font-size:12px;color:var(--muted);margin:4px 0 8px">Se nenhum vídeo novo for enviado, o site continua usando o vídeo atual.</p>
            <div class="media-picker">
              ${videoUrl
                ? `<video src="${esc(videoUrl)}" muted playsinline controls></video>`
                : `<div class="media-empty">Usando o vídeo padrão do site</div>`}
              <div class="media-actions">
                <label class="btn btn-ghost btn-sm" for="hero-video-input">Escolher vídeo</label>
                <input type="file" id="hero-video-input" accept="video/mp4,video/webm,video/quicktime" hidden>
                ${hero?.video_path ? `<button type="button" id="hero-video-remove" class="btn btn-ghost btn-sm">Remover vídeo personalizado</button>` : ''}
              </div>
            </div>
            <p style="font-size:12px;color:var(--muted);margin-top:6px">MP4, WebM ou MOV • até 25 MB.</p>
          </div>

          <div class="field" style="margin-top:16px">
            <label>Imagem de capa do vídeo</label>
            <p style="font-size:12px;color:var(--muted);margin:4px 0 8px">Imagem exibida enquanto o vídeo não estiver sendo reproduzido. Se vazio, será usada a imagem padrão do site.</p>
            <div class="media-picker">
              ${posterUrl
                ? `<img src="${esc(posterUrl)}" alt="Imagem de capa do vídeo">`
                : `<div class="media-empty">Usando a imagem padrão do site</div>`}
              <div class="media-actions">
                <label class="btn btn-ghost btn-sm" for="hero-poster-input">Escolher imagem</label>
                <input type="file" id="hero-poster-input" accept="image/jpeg,image/png,image/webp,image/avif" hidden>
                ${hero?.poster_path ? `<button type="button" id="hero-poster-remove" class="btn btn-ghost btn-sm">Remover imagem personalizada</button>` : ''}
              </div>
            </div>
          </div>

          <div class="field" style="margin-top:16px">
            <label>Título (opcional — mantém o atual se vazio)</label>
            <input name="title" value="${esc(hero?.title || '')}" placeholder="Seu Apple merece um cuidado à altura.">
          </div>
          <div class="field" style="margin-top:12px">
            <label>Subtítulo (opcional)</label>
            <input name="subtitle" value="${esc(hero?.subtitle || '')}" placeholder="Diagnóstico preciso, atendimento próximo…">
          </div>
          <div class="field" style="margin-top:12px">
            <label>Rótulo do botão (opcional)</label>
            <input name="cta_label" value="${esc(hero?.cta_label || '')}" placeholder="Solicitar Orçamento">
          </div>
          <div class="field" style="margin-top:12px">
            <label>Link do botão (opcional — mantém o WhatsApp atual se vazio)</label>
            <input name="cta_href" value="${esc(hero?.cta_href || '')}" placeholder="https://… (link do WhatsApp/outro)">
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin-top:16px;font-size:14px">
            <input type="checkbox" name="active" ${hero === null || hero?.active !== false ? 'checked' : ''}> Hero ativo no site
          </label>
        </div>
        <div style="display:flex;gap:12px;justify-content:flex-end">
          <button type="submit" class="btn btn-orange btn-lg">Salvar e publicar Hero</button>
        </div>
      </form>`);

    // ---- Media uploads persist immediately; remove clears back to default ----
    const vInput = $('#hero-video-input');
    const vRm = $('#hero-video-remove');
    if (vInput) vInput.addEventListener('change', async () => {
      const f = vInput.files?.[0];
      if (!f) return;
      vInput.disabled = true;
      try {
        toast('Enviando vídeo…');
        const r = await uploadMedia(HERO_BUCKET, f, 'hero', 'video');
        await admin.setHeroMedia({ video_path: r.path });
        toast('Vídeo do Hero atualizado com sucesso.', 'success');
        await renderHero();
      } catch (err) { toast(err.message || 'Não foi possível enviar o vídeo. Verifique o formato e tente novamente.', 'error'); vInput.disabled = false; }
    });
    if (vRm) vRm.addEventListener('click', async () => {
      vRm.disabled = true;
      try {
        await deleteMedia(HERO_BUCKET, hero.video_path);
        await admin.setHeroMedia({ video_path: null });
        toast('Vídeo personalizado removido. Site usa o vídeo padrão.', 'success');
        await renderHero();
      } catch (err) { toast(err.message || 'Não foi possível remover o vídeo.', 'error'); vRm.disabled = false; }
    });

    const pInput = $('#hero-poster-input');
    const pRm = $('#hero-poster-remove');
    if (pInput) pInput.addEventListener('change', async () => {
      const f = pInput.files?.[0];
      if (!f) return;
      pInput.disabled = true;
      try {
        toast('Enviando imagem…');
        const r = await uploadMedia(HERO_BUCKET, f, 'hero', 'image');
        await admin.setHeroMedia({ poster_path: r.path });
        toast('Imagem de capa atualizada com sucesso.', 'success');
        await renderHero();
      } catch (err) { toast(err.message || 'Não foi possível enviar a imagem.', 'error'); pInput.disabled = false; }
    });
    if (pRm) pRm.addEventListener('click', async () => {
      pRm.disabled = true;
      try {
        await deleteMedia(HERO_BUCKET, hero.poster_path);
        await admin.setHeroMedia({ poster_path: null });
        toast('Imagem de capa removida. Site usa a imagem padrão.', 'success');
        await renderHero();
      } catch (err) { toast(err.message || 'Não foi possível remover a imagem.', 'error'); pRm.disabled = false; }
    });

    $('#hero-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        // Editorial + publish only — do NOT send video/poster paths, leaving
        // the uploaded media intact (upload/remove buttons already persist
        // those immediately).
        await admin.setHeroMedia({
          title: (fd.get('title') || '').toString().trim() || null,
          subtitle: (fd.get('subtitle') || '').toString().trim() || null,
          cta_label: (fd.get('cta_label') || '').toString().trim() || null,
          cta_href: (fd.get('cta_href') || '').toString().trim() || null,
          active: fd.get('active') === 'on',
        });
        toast('Hero publicado.', 'success');
        router();
      } catch (err) { toast(err.message || 'Não foi possível publicar o Hero.', 'error'); }
    });
  } catch (err) {
    root().innerHTML = shell('hero', `<div class="empty">Erro: ${esc(err.message)}</div>`);
  }
}

// ---------- Not configured ----------
function notConfigured() {
  return `
    <div class="login-wrap">
      <div class="login-card">
        <img class="login-logo" src="${logoPerllonUrl}" alt="PERLLON">
        <h1>Administração não configurada</h1>
        <p class="login-sub">
          Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>
          no arquivo <code>.env.local</code> (veja <code>.env.example</code>) e aplique
          as migrations para habilitar o painel.
        </p>
        <a href="/" class="btn btn-primary" style="width:100%">← Voltar ao site</a>
      </div>
    </div>`;
}

// ---------- Boot ----------
window.addEventListener('hashchange', router);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
router();