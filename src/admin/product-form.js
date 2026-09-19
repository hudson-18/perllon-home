import * as admin from '../lib/admin.js';
import { uploadProductImage, deleteProductImage } from '../lib/storage.js';
import { esc, toast, beginPending, finishPending, reportAdminError } from './ui.js';
import { specificationKey, specificationLabel } from '../lib/specifications.js';

const $ = (s, c = document) => c.querySelector(s);

// ---------- Product form (new + edit) ----------
export async function renderProductForm(id, runId, { root, shell, isCurrentNavigation, router, imageUrlOrNull }) {
  const isNew = !id;
  root().innerHTML = shell(isNew ? 'product-new' : 'products', `<div class="loading">Carregando…</div>`);

  try {
    const [brands, categories] = await Promise.all([admin.listBrands(), admin.listCategories()]);
    let product = null;
    if (!isNew) product = await admin.getProduct(id);
    if (!isCurrentNavigation(runId)) return;

    const p = product || {};
    const specs = (p.product_specifications || []).map((spec) => ({ ...spec, key: specificationLabel(spec.key) }));
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
      const button = $('#save-brand-btn');
      if (!beginPending(button, 'Criando…')) return;
      try {
        const created = await admin.upsertBrand({ name });
        const opt = document.createElement('option');
        opt.value = created.id; opt.textContent = created.name; opt.selected = true;
        brandSelect.appendChild(opt);
        brandRow.style.display = 'none'; newBrandBtn.style.display = ''; brandNameInput.value = '';
        toast('Marca criada.', 'success');
      } catch (error) {
        reportAdminError(error, 'Não foi possível criar a marca. Verifique se ela já existe e tente novamente.');
      } finally {
        finishPending(button);
      }
    });

    newCategoryBtn.addEventListener('click', () => { categoryRow.style.display = 'flex'; newCategoryBtn.style.display = 'none'; categoryNameInput.focus(); });
    $('#cancel-category-btn').addEventListener('click', () => { categoryRow.style.display = 'none'; newCategoryBtn.style.display = ''; categoryNameInput.value = ''; });
    $('#save-category-btn').addEventListener('click', async () => {
      const name = categoryNameInput.value.trim();
      if (!name) { toast('Informe o nome da categoria.', 'error'); return; }
      const button = $('#save-category-btn');
      if (!beginPending(button, 'Criando…')) return;
      try {
        const created = await admin.upsertCategory({ name });
        const opt = document.createElement('option');
        opt.value = created.id; opt.textContent = created.name; opt.selected = true;
        categorySelect.appendChild(opt);
        categoryRow.style.display = 'none'; newCategoryBtn.style.display = ''; categoryNameInput.value = '';
        toast('Categoria criada.', 'success');
      } catch (error) {
        reportAdminError(error, 'Não foi possível criar a categoria. Verifique se ela já existe e tente novamente.');
      } finally {
        finishPending(button);
      }
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
            <img class="thumb" style="width:48px;height:48px" src="${esc(imageUrlOrNull(im.storage_path) || '')}" alt="" loading="lazy" decoding="async">
            <span style="flex:1;font-size:13px;color:var(--muted)">${esc(im.storage_path)}</span>
            <span class="badge ${im.is_primary ? 'active' : 'inactive'}">${im.is_primary ? 'principal' : 'secundária'}</span>
            <button type="button" class="btn btn-sm btn-danger" data-rmimg="${im.id}" data-path="${esc(im.storage_path)}">Remover</button>
          </div>`).join('')
        : '<div class="empty" style="padding:16px">Nenhuma imagem.</div>';
      imagesList.querySelectorAll('[data-rmimg]').forEach((b) => b.addEventListener('click', async () => {
        if (!beginPending(b, 'Removendo…')) return;
        try {
          await admin.removeProductImage(b.dataset.rmimg);
          const idx = images.findIndex((im) => im.id === b.dataset.rmimg);
          if (idx >= 0) images.splice(idx, 1);
          renderImages();
          if (b.dataset.path) {
            try {
              await deleteProductImage(b.dataset.path);
            } catch (storageError) {
              reportAdminError(storageError, 'A imagem foi removida do produto, mas o arquivo antigo não pôde ser limpo. Tente novamente mais tarde.');
              return;
            }
          }
          toast('Imagem removida.', 'success');
        } catch (error) {
          reportAdminError(error, 'Não foi possível remover a imagem. Tente novamente.');
        } finally {
          finishPending(b);
        }
      }));
    };
    renderImages();

    // image upload (needs an existing product id)
    $('#image-upload').addEventListener('change', async (e) => {
      const input = e.currentTarget;
      const file = input.files[0];
      if (!file) return;
      if (isNew) {
        toast('Salve o produto antes de enviar imagens.', 'error');
        input.value = '';
        return;
      }
      if (!beginPending(input)) return;
      let uploadedPath = null;
      try {
        const isPrimary = images.length === 0;
        const { path } = await uploadProductImage(file, id);
        uploadedPath = path;
        const savedImage = await admin.addProductImage(id, { storage_path: path, alt_text: p.name || '', is_primary: isPrimary, sort_order: images.length });
        uploadedPath = null;
        images.push(savedImage);
        toast('Imagem enviada.', 'success');
        renderImages();
      } catch (err) {
        if (uploadedPath) {
          try {
            await deleteProductImage(uploadedPath);
          } catch (cleanupError) {
            // Cleanup is best-effort: the database write failed, so no UI or
            // database record references this orphaned object.
            console.error('Falha ao limpar upload sem registro no banco.', cleanupError);
          }
        }
        reportAdminError(err, 'Não foi possível enviar a imagem. Tente novamente.', true);
      } finally {
        input.value = '';
        finishPending(input);
      }
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
      const submitButton = e.currentTarget.querySelector('button[type="submit"]');
      if (!beginPending(submitButton, 'Salvando…')) return;

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

      let savedId = id;
      let basicDataSaved = false;
      try {
        if (isNew) {
          const created = await admin.createProduct(payload);
          savedId = created.id;
        } else {
          await admin.updateProduct(id, payload);
          savedId = id;
        }
        basicDataSaved = true;
        // persist specs (only for existing; new handle after create)
        if (!isNew || savedId) {
          await admin.replaceSpecifications(savedId, specs.filter((s) => s.key && s.value)
            .map((spec) => ({ ...spec, key: specificationKey(spec.key) })));
        }
        toast(isNew ? 'Produto criado.' : 'Produto salvo.', 'success');
        const destination = `#/products/${savedId}`;
        if (location.hash === destination) router();
        else location.hash = destination;
      } catch (err) {
        if (basicDataSaved) {
          reportAdminError(err, `${isNew ? 'O produto foi criado' : 'Os dados básicos foram salvos'}, mas não foi possível salvar as especificações. Revise os dados e tente salvar novamente.`);
          if (isNew && savedId) location.hash = `#/products/${savedId}`;
        } else {
          reportAdminError(err, 'Não foi possível salvar o produto. Revise os dados e tente novamente.');
        }
      } finally {
        finishPending(submitButton);
      }
    });
  } catch (err) {
    if (!isCurrentNavigation(runId)) return;
    console.error('Não foi possível carregar o formulário de produto.', err);
    root().innerHTML = shell('products', `<div class="empty">Não foi possível carregar o produto. Tente novamente.</div>`);
  }
}
