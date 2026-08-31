import {
  deleteOne,
  deleteProductCascade,
  exportAllData,
  getAll,
  getOne,
  getResearchesForProduct,
  openDb,
  putOne,
  replaceAllData,
  validateBackupPayload
} from './db.js';

const APP_VERSION = '0.1.0';
const BACKUP_SCHEMA_VERSION = 1;
const DIAGNOSTIC_KEY = 'buylens:diagnostics:v1';
const DIAGNOSTIC_LIMIT = 100;

const STATUS_LABELS = {
  interested: '気になる',
  comparing: '比較中',
  wanted: '欲しい',
  sale_wait: 'セール待ち',
  planned: '購入予定',
  purchased: '購入済み',
  skipped: '見送り'
};

const DEFAULT_WEIGHTS = {
  price: 3,
  performance: 3,
  value: 3,
  design: 3,
  durability: 3,
  size: 3,
  material: 3
};

const state = {
  products: [],
  researches: [],
  comparisonGroups: [],
  preferences: [],
  settings: [],
  latestResearchByProduct: new Map(),
  compareIds: [],
  activeGroupId: '',
  activeView: 'products'
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  globalError: $('#globalError'),
  productList: $('#productList'),
  productCount: $('#productCount'),
  productSearch: $('#productSearch'),
  statusFilter: $('#statusFilter'),
  productSort: $('#productSort'),
  compareNavCount: $('#compareNavCount'),
  budgetAmountDisplay: $('#budgetAmountDisplay'),
  plannedTotalDisplay: $('#plannedTotalDisplay'),
  remainingBudgetDisplay: $('#remainingBudgetDisplay'),
  headerRemainingBudget: $('#headerRemainingBudget'),
  settingsPlannedTotal: $('#settingsPlannedTotal'),
  settingsRemainingBudget: $('#settingsRemainingBudget'),
  budgetInput: $('#budgetInput'),
  budgetSaveStatus: $('#budgetSaveStatus'),
  productDialog: $('#productDialog'),
  productForm: $('#productForm'),
  productDialogTitle: $('#productDialogTitle'),
  productId: $('#productId'),
  productName: $('#productName'),
  productManufacturer: $('#productManufacturer'),
  productCategory: $('#productCategory'),
  productPrice: $('#productPrice'),
  productStatus: $('#productStatus'),
  productUrl: $('#productUrl'),
  productImageUrl: $('#productImageUrl'),
  productMemo: $('#productMemo'),
  latestResearchDate: $('#latestResearchDate'),
  researchPrice: $('#researchPrice'),
  researchDate: $('#researchDate'),
  researchFeatures: $('#researchFeatures'),
  researchPros: $('#researchPros'),
  researchCons: $('#researchCons'),
  researchConcerns: $('#researchConcerns'),
  researchReviewSummary: $('#researchReviewSummary'),
  researchRecommendedFor: $('#researchRecommendedFor'),
  researchPersonalFit: $('#researchPersonalFit'),
  researchOverallScore: $('#researchOverallScore'),
  researchValueScore: $('#researchValueScore'),
  researchPerformanceScore: $('#researchPerformanceScore'),
  researchFitScore: $('#researchFitScore'),
  deleteProductButton: $('#deleteProductButton'),
  compareSelectionList: $('#compareSelectionList'),
  compareSelectionHelp: $('#compareSelectionHelp'),
  comparisonGroupSelect: $('#comparisonGroupSelect'),
  comparisonGroupName: $('#comparisonGroupName'),
  saveComparisonGroupButton: $('#saveComparisonGroupButton'),
  deleteComparisonGroupButton: $('#deleteComparisonGroupButton'),
  compareTableWrap: $('#compareTableWrap'),
  decisionBestOverall: $('#decisionBestOverall'),
  decisionBestValue: $('#decisionBestValue'),
  decisionBestPerformance: $('#decisionBestPerformance'),
  decisionAvoid: $('#decisionAvoid'),
  decisionNote: $('#decisionNote'),
  saveDecisionButton: $('#saveDecisionButton'),
  preferenceScope: $('#preferenceScope'),
  preferenceCategoryField: $('#preferenceCategoryField'),
  preferenceCategory: $('#preferenceCategory'),
  preferencePriorities: $('#preferencePriorities'),
  preferenceAvoid: $('#preferenceAvoid'),
  preferenceSaveStatus: $('#preferenceSaveStatus'),
  budgetSaveButton: $('#saveBudgetButton'),
  diagnosticSummary: $('#diagnosticSummary'),
  importBackupFile: $('#importBackupFile'),
  toastRegion: $('#toastRegion'),
  categoryOptions: $('#categoryOptions')
};

function uid(prefix) {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${value}`;
}

function nowIso() {
  return new Date().toISOString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeHttpUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function scoreOrNull(value) {
  const number = numberOrNull(value);
  if (number === null) return null;
  return Math.min(5, Math.max(0, number));
}

function formatCurrency(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0
  }).format(Number(value));
}

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ja-JP', withTime
    ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit' }
  ).format(date);
}

function toDateTimeLocal(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  if (!value) return nowIso();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
}

function splitLines(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinLines(value) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function getDiagnostics() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DIAGNOSTIC_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(-DIAGNOSTIC_LIMIT) : [];
  } catch {
    return [];
  }
}

function setDiagnostics(entries) {
  try {
    localStorage.setItem(DIAGNOSTIC_KEY, JSON.stringify(entries.slice(-DIAGNOSTIC_LIMIT)));
  } catch {
    // Diagnostics failure must not break the app.
  }
}

function logDiagnostic(action, meta = {}, level = 'info') {
  const safeMeta = {};
  const allowedKeys = ['id', 'productId', 'groupId', 'count', 'view', 'type', 'store', 'schemaVersion'];
  for (const key of allowedKeys) {
    if (meta[key] !== undefined) safeMeta[key] = meta[key];
  }

  const entries = getDiagnostics();
  entries.push({
    id: uid('diag'),
    at: nowIso(),
    level,
    action,
    meta: safeMeta
  });
  setDiagnostics(entries);
  renderDiagnostics();
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' is-error' : ''}`;
  toast.textContent = message;
  els.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function showGlobalError(error) {
  const message = error instanceof Error ? error.message : String(error);
  els.globalError.textContent = `エラー: ${message}`;
  els.globalError.hidden = false;
  logDiagnostic('app.error', { type: error?.name || 'Error' }, 'error');
}

function clearGlobalError() {
  els.globalError.hidden = true;
  els.globalError.textContent = '';
}

function currentBudget() {
  const record = state.settings.find((item) => item.key === 'budget');
  return record && Number.isFinite(Number(record.amount)) ? Number(record.amount) : null;
}

function plannedTotal() {
  return state.products
    .filter((product) => product.status === 'planned')
    .reduce((total, product) => total + (Number(product.currentPrice) || 0), 0);
}

function buildLatestResearchMap() {
  const map = new Map();
  for (const research of state.researches) {
    const current = map.get(research.productId);
    if (!current || String(research.researchedAt).localeCompare(String(current.researchedAt)) > 0) {
      map.set(research.productId, research);
    }
  }
  state.latestResearchByProduct = map;
}

async function reloadState() {
  const [products, researches, comparisonGroups, preferences, settings] = await Promise.all([
    getAll('products'),
    getAll('researches'),
    getAll('comparisonGroups'),
    getAll('preferences'),
    getAll('settings')
  ]);

  state.products = products;
  state.researches = researches;
  state.comparisonGroups = comparisonGroups;
  state.preferences = preferences;
  state.settings = settings;
  state.compareIds = state.compareIds.filter((id) => products.some((product) => product.id === id)).slice(0, 4);
  buildLatestResearchMap();
  renderAll();
}

function renderAll() {
  renderBudget();
  renderProducts();
  renderCompare();
  renderGroupOptions();
  renderCategoryOptions();
  renderDiagnostics();
}

function renderBudget() {
  const budget = currentBudget();
  const planned = plannedTotal();
  const remaining = budget === null ? null : budget - planned;

  els.budgetAmountDisplay.textContent = budget === null ? '未設定' : formatCurrency(budget);
  els.plannedTotalDisplay.textContent = formatCurrency(planned);
  els.remainingBudgetDisplay.textContent = remaining === null ? '—' : formatCurrency(remaining);
  els.headerRemainingBudget.textContent = remaining === null ? '未設定' : formatCurrency(remaining);
  els.settingsPlannedTotal.textContent = formatCurrency(planned);
  els.settingsRemainingBudget.textContent = remaining === null ? '—' : formatCurrency(remaining);
  els.budgetInput.value = budget === null ? '' : String(budget);

  for (const element of [els.remainingBudgetDisplay, els.settingsRemainingBudget]) {
    element.classList.toggle('is-negative', remaining !== null && remaining < 0);
  }
}

function filterAndSortProducts() {
  const query = els.productSearch.value.trim().toLocaleLowerCase('ja');
  const status = els.statusFilter.value;
  const sort = els.productSort.value;

  const products = state.products.filter((product) => {
    if (status !== 'all' && product.status !== status) return false;
    if (!query) return true;
    const haystack = [product.name, product.manufacturer, product.category, product.memo]
      .join(' ')
      .toLocaleLowerCase('ja');
    return haystack.includes(query);
  });

  products.sort((a, b) => {
    const researchA = state.latestResearchByProduct.get(a.id);
    const researchB = state.latestResearchByProduct.get(b.id);
    if (sort === 'price-asc') return (Number(a.currentPrice) || Infinity) - (Number(b.currentPrice) || Infinity);
    if (sort === 'price-desc') return (Number(b.currentPrice) || -Infinity) - (Number(a.currentPrice) || -Infinity);
    if (sort === 'score-desc') return (Number(researchB?.overallScore) || -1) - (Number(researchA?.overallScore) || -1);
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });

  return products;
}

function renderScoreBar(label, value) {
  const score = Number(value);
  const valid = Number.isFinite(score);
  return `
    <div class="score-bar-row">
      <span>${escapeHtml(label)}</span>
      <div class="score-track"><div class="score-fill" style="width:${valid ? Math.max(0, Math.min(100, score / 5 * 100)) : 0}%"></div></div>
      <strong>${valid ? score.toFixed(1) : '—'}</strong>
    </div>
  `;
}

function renderPointList(items, type) {
  const values = Array.isArray(items) ? items.slice(0, 2) : [];
  if (!values.length) return '<span class="empty-point">まだ記録なし</span>';
  return `<ul class="point-list ${type}">${values.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function productBudgetDiff(product) {
  const budget = currentBudget();
  const price = numberOrNull(product.currentPrice);
  if (budget === null || price === null) return '';
  const diff = budget - price;
  if (diff >= 0) return `<div class="product-budget-diff">単品購入後 ${escapeHtml(formatCurrency(diff))} 残る</div>`;
  return `<div class="product-budget-diff is-over">予算より ${escapeHtml(formatCurrency(Math.abs(diff)))} オーバー</div>`;
}

function renderProducts() {
  const products = filterAndSortProducts();
  els.productCount.textContent = `${products.length}件`;

  if (!state.products.length) {
    els.productList.innerHTML = `
      <div class="empty-state">
        <h2>まだ商品がありません</h2>
        <p>最初の商品を登録して、ChatGPTの調査結果や比較候補をまとめ始めます。</p>
        <button class="button button-primary" type="button" data-action="add-product">最初の商品を追加</button>
      </div>`;
    return;
  }

  if (!products.length) {
    els.productList.innerHTML = `
      <div class="empty-state">
        <h2>条件に合う商品がありません</h2>
        <p>検索語か状態フィルターを変更してください。</p>
        <button class="button button-secondary" type="button" data-action="clear-filters">絞り込みを解除</button>
      </div>`;
    return;
  }

  els.productList.innerHTML = products.map((product) => {
    const research = state.latestResearchByProduct.get(product.id);
    const imageUrl = safeHttpUrl(product.imageUrl);
    const productUrl = safeHttpUrl(product.productUrl);
    const isSelected = state.compareIds.includes(product.id);
    const score = numberOrNull(research?.overallScore);

    return `
      <article class="product-card${isSelected ? ' is-selected' : ''}" data-product-id="${escapeHtml(product.id)}">
        <div class="product-media">
          ${imageUrl
            ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy">`
            : '<span class="product-media-placeholder">商品画像<br>未登録</span>'}
        </div>
        <div class="product-primary">
          <div class="product-title-row">
            <h2><button type="button" data-action="edit-product" data-product-id="${escapeHtml(product.id)}">${escapeHtml(product.name)}</button></h2>
            <span class="status-badge" data-status="${escapeHtml(product.status)}">${escapeHtml(STATUS_LABELS[product.status] || product.status)}</span>
          </div>
          <div class="product-meta">
            ${product.manufacturer ? `<span>${escapeHtml(product.manufacturer)}</span>` : ''}
            ${product.category ? `<span>${escapeHtml(product.category)}</span>` : ''}
            <span>更新 ${escapeHtml(formatDate(product.updatedAt))}</span>
          </div>
          <div class="product-price">${escapeHtml(formatCurrency(product.currentPrice))}</div>
          ${productBudgetDiff(product)}
          ${product.memo ? `<p class="product-note">${escapeHtml(product.memo)}</p>` : ''}
        </div>
        <div class="product-score">
          <span class="score-caption">ChatGPT総合評価</span>
          <div class="score-main"><strong>${score === null ? '—' : score.toFixed(1)}</strong><span>/ 5</span></div>
          <div class="score-bars">
            ${renderScoreBar('コスパ', research?.valueScore)}
            ${renderScoreBar('性能', research?.performanceScore)}
            ${renderScoreBar('相性', research?.fitScore)}
          </div>
          <div class="research-updated">調査 ${escapeHtml(formatDate(research?.researchedAt))}</div>
        </div>
        <div class="product-points">
          ${renderPointList(research?.pros, 'positive')}
          ${renderPointList(research?.cons, 'negative')}
        </div>
        <div class="product-actions">
          <button class="compare-toggle${isSelected ? ' is-selected' : ''}" type="button" data-action="toggle-compare" data-product-id="${escapeHtml(product.id)}">
            ${isSelected ? '比較から外す' : '比較に追加'}
          </button>
          ${productUrl ? `<a class="product-link" href="${escapeHtml(productUrl)}" target="_blank" rel="noopener noreferrer">商品ページ</a>` : '<span></span>'}
        </div>
      </article>`;
  }).join('');

  for (const image of els.productList.querySelectorAll('.product-media img')) {
    image.addEventListener('error', () => {
      image.replaceWith(Object.assign(document.createElement('span'), {
        className: 'product-media-placeholder',
        textContent: '画像を表示できません'
      }));
    }, { once: true });
  }
}

function renderCompareSelection() {
  const selected = state.compareIds
    .map((id) => state.products.find((product) => product.id === id))
    .filter(Boolean);

  els.compareNavCount.hidden = selected.length === 0;
  els.compareNavCount.textContent = String(selected.length);
  els.compareSelectionHelp.textContent = selected.length < 2
    ? '商品一覧から2〜4件選択してください。'
    : `${selected.length}件を比較中。最大4件です。`;

  if (!selected.length) {
    els.compareSelectionList.innerHTML = '<span class="empty-point">比較対象はまだありません。</span>';
    return;
  }

  els.compareSelectionList.innerHTML = selected.map((product) => `
    <div class="selection-item">
      <strong title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</strong>
      <button type="button" data-action="remove-compare" data-product-id="${escapeHtml(product.id)}" aria-label="${escapeHtml(product.name)}を比較から外す">×</button>
    </div>`).join('');
}

function comparisonProducts() {
  return state.compareIds
    .map((id) => state.products.find((product) => product.id === id))
    .filter(Boolean);
}

function compareCellList(items) {
  if (!Array.isArray(items) || !items.length) return '—';
  return `<ul class="compare-list">${items.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function compareBudgetText(product) {
  const budget = currentBudget();
  const price = numberOrNull(product.currentPrice);
  if (budget === null || price === null) return '—';
  const diff = budget - price;
  return diff >= 0 ? `${formatCurrency(diff)} 残る` : `${formatCurrency(Math.abs(diff))} 超過`;
}

function renderCompareTable() {
  const products = comparisonProducts();
  if (products.length < 2) {
    els.compareTableWrap.innerHTML = `
      <div class="empty-state">
        <h2>比較する商品を2件以上選択してください</h2>
        <p>商品画面の「比較に追加」から最大4件まで選べます。</p>
        <button class="button button-secondary" type="button" data-view="products">商品を選ぶ</button>
      </div>`;
    return;
  }

  const rows = [
    ['価格', (product) => `<span class="compare-price">${escapeHtml(formatCurrency(product.currentPrice))}</span>`],
    ['予算との差', (product) => escapeHtml(compareBudgetText(product))],
    ['総合評価', (product, research) => research?.overallScore == null ? '—' : `${Number(research.overallScore).toFixed(1)} / 5`],
    ['性能', (product, research) => research?.performanceScore == null ? '—' : `${Number(research.performanceScore).toFixed(1)} / 5`],
    ['コスパ', (product, research) => research?.valueScore == null ? '—' : `${Number(research.valueScore).toFixed(1)} / 5`],
    ['自分との相性', (product, research) => research?.fitScore == null ? '—' : `${Number(research.fitScore).toFixed(1)} / 5`],
    ['メリット', (product, research) => compareCellList(research?.pros)],
    ['デメリット', (product, research) => compareCellList(research?.cons)],
    ['気になる点', (product, research) => compareCellList(research?.concerns)],
    ['レビュー傾向', (product, research) => research?.reviewSummary ? escapeHtml(research.reviewSummary) : '—'],
    ['自分に合う理由', (product, research) => research?.personalFit ? escapeHtml(research.personalFit) : '—'],
    ['状態', (product) => escapeHtml(STATUS_LABELS[product.status] || product.status)],
    ['調査日', (product, research) => escapeHtml(formatDate(research?.researchedAt))]
  ];

  const header = products.map((product) => {
    const imageUrl = safeHttpUrl(product.imageUrl);
    return `<th class="compare-product-head" scope="col">
      <div class="compare-thumb">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="">` : '<span class="empty-point">画像なし</span>'}</div>
      <strong>${escapeHtml(product.name)}</strong>
    </th>`;
  }).join('');

  const body = rows.map(([label, render]) => `
    <tr>
      <th class="compare-row-label" scope="row">${escapeHtml(label)}</th>
      ${products.map((product) => `<td>${render(product, state.latestResearchByProduct.get(product.id))}</td>`).join('')}
    </tr>`).join('');

  els.compareTableWrap.innerHTML = `
    <table class="compare-table">
      <thead><tr><th class="compare-row-label" scope="col">項目</th>${header}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

function fillDecisionSelect(select, value = '') {
  const products = comparisonProducts();
  select.innerHTML = '<option value="">未選択</option>' + products
    .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)}</option>`)
    .join('');
  select.value = products.some((product) => product.id === value) ? value : '';
}

function currentGroup() {
  return state.comparisonGroups.find((group) => group.id === state.activeGroupId) || null;
}

function renderDecision() {
  const summary = currentGroup()?.summary || {};
  fillDecisionSelect(els.decisionBestOverall, summary.bestOverall || '');
  fillDecisionSelect(els.decisionBestValue, summary.bestValue || '');
  fillDecisionSelect(els.decisionBestPerformance, summary.bestPerformance || '');
  fillDecisionSelect(els.decisionAvoid, summary.avoid || '');
  els.decisionNote.value = summary.note || '';
  els.saveDecisionButton.disabled = !state.activeGroupId;
}

function renderCompare() {
  renderCompareSelection();
  renderCompareTable();
  renderDecision();
  renderProducts();
}

function renderGroupOptions() {
  const groups = [...state.comparisonGroups].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  els.comparisonGroupSelect.innerHTML = '<option value="">現在の選択</option>' + groups
    .map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`)
    .join('');
  els.comparisonGroupSelect.value = state.activeGroupId;
  els.deleteComparisonGroupButton.disabled = !state.activeGroupId;
}

function renderCategoryOptions() {
  const defaults = ['PC用品', 'オーディオ', 'デスク・家具', '家電', '生活用品'];
  const categories = [...new Set([...defaults, ...state.products.map((product) => product.category).filter(Boolean)])];
  els.categoryOptions.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}"></option>`).join('');
}

function renderDiagnostics() {
  if (!els.diagnosticSummary) return;
  const entries = getDiagnostics();
  if (!entries.length) {
    els.diagnosticSummary.innerHTML = '<span class="empty-point">診断ログはありません。</span>';
    return;
  }

  els.diagnosticSummary.innerHTML = entries.slice(-8).reverse().map((entry) => `
    <div class="diagnostic-line">
      <time>${escapeHtml(formatDate(entry.at, true))}</time>
      <span>${escapeHtml(entry.level)}</span>
      <strong>${escapeHtml(entry.action)}</strong>
    </div>`).join('');
}

function showView(view, updateHash = true) {
  const valid = ['products', 'compare', 'preferences', 'settings'].includes(view) ? view : 'products';
  state.activeView = valid;

  for (const panel of $$('[data-view-panel]')) {
    const active = panel.dataset.viewPanel === valid;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  }

  for (const button of $$('.nav-button')) {
    button.classList.toggle('is-active', button.dataset.view === valid);
  }

  if (updateHash && location.hash !== `#${valid}`) history.replaceState(null, '', `#${valid}`);
  if (valid === 'preferences') loadPreferenceForm();
  if (valid === 'settings') renderBudget();
  logDiagnostic('view.open', { view: valid });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function toggleCompare(productId) {
  if (state.compareIds.includes(productId)) {
    state.compareIds = state.compareIds.filter((id) => id !== productId);
  } else {
    if (state.compareIds.length >= 4) {
      showToast('同時比較は最大4商品です。', 'error');
      return;
    }
    state.compareIds.push(productId);
  }

  state.activeGroupId = '';
  els.comparisonGroupName.value = '';
  renderCompare();
  renderGroupOptions();
}

function resetProductForm() {
  els.productForm.reset();
  els.productId.value = '';
  els.productStatus.value = 'interested';
  els.researchDate.value = toDateTimeLocal();
  els.deleteProductButton.hidden = true;
  els.latestResearchDate.textContent = '調査履歴なし';
  els.productDialog.dataset.researchSignature = '';
}

function researchSignature(research) {
  if (!research) return '';
  const normalized = {
    price: research.price ?? null,
    features: research.features || [],
    pros: research.pros || [],
    cons: research.cons || [],
    concerns: research.concerns || [],
    reviewSummary: research.reviewSummary || '',
    recommendedFor: research.recommendedFor || [],
    personalFit: research.personalFit || '',
    overallScore: research.overallScore ?? null,
    valueScore: research.valueScore ?? null,
    performanceScore: research.performanceScore ?? null,
    fitScore: research.fitScore ?? null,
    researchedAt: research.researchedAt || ''
  };
  return JSON.stringify(normalized);
}

function fillResearchForm(research) {
  els.researchPrice.value = research?.price ?? '';
  els.researchDate.value = toDateTimeLocal(research?.researchedAt);
  els.researchFeatures.value = joinLines(research?.features);
  els.researchPros.value = joinLines(research?.pros);
  els.researchCons.value = joinLines(research?.cons);
  els.researchConcerns.value = joinLines(research?.concerns);
  els.researchReviewSummary.value = research?.reviewSummary || '';
  els.researchRecommendedFor.value = joinLines(research?.recommendedFor);
  els.researchPersonalFit.value = research?.personalFit || '';
  els.researchOverallScore.value = research?.overallScore ?? '';
  els.researchValueScore.value = research?.valueScore ?? '';
  els.researchPerformanceScore.value = research?.performanceScore ?? '';
  els.researchFitScore.value = research?.fitScore ?? '';
  els.latestResearchDate.textContent = research ? `最新調査 ${formatDate(research.researchedAt, true)}` : '調査履歴なし';
  els.productDialog.dataset.researchSignature = researchSignature(research);
}

async function openProductDialog(productId = '') {
  resetProductForm();
  clearGlobalError();

  if (productId) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    const research = state.latestResearchByProduct.get(productId);

    els.productDialogTitle.textContent = '商品を編集';
    els.productId.value = product.id;
    els.productName.value = product.name || '';
    els.productManufacturer.value = product.manufacturer || '';
    els.productCategory.value = product.category || '';
    els.productPrice.value = product.currentPrice ?? '';
    els.productStatus.value = product.status || 'interested';
    els.productUrl.value = product.productUrl || '';
    els.productImageUrl.value = product.imageUrl || '';
    els.productMemo.value = product.memo || '';
    els.deleteProductButton.hidden = false;
    fillResearchForm(research);
  } else {
    els.productDialogTitle.textContent = '商品を追加';
    fillResearchForm(null);
  }

  els.productDialog.showModal();
  requestAnimationFrame(() => els.productName.focus());
}

function buildResearchFromForm(productId) {
  const research = {
    productId,
    price: numberOrNull(els.researchPrice.value),
    features: splitLines(els.researchFeatures.value),
    pros: splitLines(els.researchPros.value),
    cons: splitLines(els.researchCons.value),
    concerns: splitLines(els.researchConcerns.value),
    reviewSummary: els.researchReviewSummary.value.trim(),
    recommendedFor: splitLines(els.researchRecommendedFor.value),
    personalFit: els.researchPersonalFit.value.trim(),
    overallScore: scoreOrNull(els.researchOverallScore.value),
    valueScore: scoreOrNull(els.researchValueScore.value),
    performanceScore: scoreOrNull(els.researchPerformanceScore.value),
    fitScore: scoreOrNull(els.researchFitScore.value),
    researchedAt: fromDateTimeLocal(els.researchDate.value)
  };

  const hasContent = [
    research.price,
    ...research.features,
    ...research.pros,
    ...research.cons,
    ...research.concerns,
    research.reviewSummary,
    ...research.recommendedFor,
    research.personalFit,
    research.overallScore,
    research.valueScore,
    research.performanceScore,
    research.fitScore
  ].some((value) => value !== null && value !== '');

  return hasContent ? research : null;
}

async function saveProduct(event) {
  event.preventDefault();
  clearGlobalError();

  const name = els.productName.value.trim();
  if (!name) {
    els.productName.focus();
    return;
  }

  const existing = state.products.find((product) => product.id === els.productId.value);
  const id = existing?.id || uid('product');
  const timestamp = nowIso();
  const product = {
    id,
    name,
    imageUrl: safeHttpUrl(els.productImageUrl.value.trim()),
    productUrl: safeHttpUrl(els.productUrl.value.trim()),
    currentPrice: numberOrNull(els.productPrice.value),
    currency: 'JPY',
    category: els.productCategory.value.trim(),
    manufacturer: els.productManufacturer.value.trim(),
    status: STATUS_LABELS[els.productStatus.value] ? els.productStatus.value : 'interested',
    memo: els.productMemo.value.trim(),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp
  };

  try {
    await putOne('products', product);
    const research = buildResearchFromForm(id);
    if (research && researchSignature(research) !== els.productDialog.dataset.researchSignature) {
      await putOne('researches', {
        ...research,
        id: uid('research'),
        createdAt: timestamp
      });
    }
    logDiagnostic(existing ? 'product.update' : 'product.create', { productId: id });
    els.productDialog.close();
    await reloadState();
    showToast(existing ? '商品を更新しました。' : '商品を追加しました。');
  } catch (error) {
    showGlobalError(error);
    showToast('商品の保存に失敗しました。', 'error');
  }
}

async function deleteCurrentProduct() {
  const productId = els.productId.value;
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  if (!window.confirm(`「${product.name}」を削除します。関連する調査履歴も削除されます。よろしいですか？`)) return;

  try {
    await deleteProductCascade(productId);
    state.compareIds = state.compareIds.filter((id) => id !== productId);
    state.activeGroupId = '';
    logDiagnostic('product.delete', { productId });
    els.productDialog.close();
    await reloadState();
    showToast('商品を削除しました。');
  } catch (error) {
    showGlobalError(error);
  }
}

function collectDecision() {
  return {
    bestOverall: els.decisionBestOverall.value,
    bestValue: els.decisionBestValue.value,
    bestPerformance: els.decisionBestPerformance.value,
    avoid: els.decisionAvoid.value,
    note: els.decisionNote.value.trim()
  };
}

async function saveComparisonGroup() {
  if (state.compareIds.length < 2) {
    showToast('比較グループには2商品以上必要です。', 'error');
    return;
  }

  const name = els.comparisonGroupName.value.trim();
  if (!name) {
    els.comparisonGroupName.focus();
    showToast('グループ名を入力してください。', 'error');
    return;
  }

  const existing = currentGroup();
  const timestamp = nowIso();
  const group = {
    id: existing?.id || uid('comparison'),
    name,
    productIds: [...state.compareIds],
    summary: existing?.summary || collectDecision(),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp
  };

  try {
    await putOne('comparisonGroups', group);
    state.activeGroupId = group.id;
    logDiagnostic(existing ? 'comparison.update' : 'comparison.create', { groupId: group.id, count: group.productIds.length });
    await reloadState();
    els.comparisonGroupName.value = group.name;
    state.activeGroupId = group.id;
    renderGroupOptions();
    renderDecision();
    showToast('比較グループを保存しました。');
  } catch (error) {
    showGlobalError(error);
  }
}

function loadComparisonGroup(groupId) {
  const group = state.comparisonGroups.find((item) => item.id === groupId);
  if (!group) {
    state.activeGroupId = '';
    els.comparisonGroupName.value = '';
    renderCompare();
    renderGroupOptions();
    return;
  }

  state.activeGroupId = group.id;
  state.compareIds = group.productIds.filter((id) => state.products.some((product) => product.id === id)).slice(0, 4);
  els.comparisonGroupName.value = group.name;
  renderCompare();
  renderGroupOptions();
  logDiagnostic('comparison.open', { groupId: group.id, count: state.compareIds.length });
}

async function deleteCurrentComparisonGroup() {
  const group = currentGroup();
  if (!group) return;
  if (!window.confirm(`比較グループ「${group.name}」を削除しますか？商品自体は削除されません。`)) return;

  try {
    await deleteOne('comparisonGroups', group.id);
    logDiagnostic('comparison.delete', { groupId: group.id });
    state.activeGroupId = '';
    els.comparisonGroupName.value = '';
    await reloadState();
    showToast('比較グループを削除しました。');
  } catch (error) {
    showGlobalError(error);
  }
}

async function saveDecision() {
  const group = currentGroup();
  if (!group) {
    showToast('結論を残すには先に比較グループを保存してください。', 'error');
    return;
  }

  try {
    const updated = {
      ...group,
      summary: collectDecision(),
      updatedAt: nowIso()
    };
    await putOne('comparisonGroups', updated);
    logDiagnostic('comparison.decision.save', { groupId: group.id });
    await reloadState();
    state.activeGroupId = group.id;
    els.comparisonGroupName.value = group.name;
    renderGroupOptions();
    renderDecision();
    showToast('比較の結論を保存しました。');
  } catch (error) {
    showGlobalError(error);
  }
}

function preferenceId() {
  if (els.preferenceScope.value === 'common') return 'common';
  const category = els.preferenceCategory.value.trim();
  return category ? `category:${category}` : '';
}

function preferenceRecord() {
  const id = preferenceId();
  return state.preferences.find((item) => item.id === id) || null;
}

function loadPreferenceForm() {
  const categoryMode = els.preferenceScope.value === 'category';
  els.preferenceCategoryField.hidden = !categoryMode;
  const record = preferenceRecord();
  const weights = { ...DEFAULT_WEIGHTS, ...(record?.weights || {}) };

  for (const input of $$('#weightGrid input[type="range"]')) {
    input.value = String(weights[input.name] ?? 3);
    input.nextElementSibling.value = input.value;
  }

  els.preferencePriorities.value = joinLines(record?.priorities);
  els.preferenceAvoid.value = joinLines(record?.avoid);
  els.preferenceSaveStatus.textContent = record?.updatedAt ? `保存済み ${formatDate(record.updatedAt, true)}` : '未保存';
}

async function savePreferences() {
  const id = preferenceId();
  if (!id) {
    els.preferenceCategory.focus();
    showToast('カテゴリ名を入力してください。', 'error');
    return;
  }

  const weights = {};
  for (const input of $$('#weightGrid input[type="range"]')) weights[input.name] = Number(input.value);

  const record = {
    id,
    scope: els.preferenceScope.value,
    category: els.preferenceScope.value === 'category' ? els.preferenceCategory.value.trim() : null,
    weights,
    priorities: splitLines(els.preferencePriorities.value),
    avoid: splitLines(els.preferenceAvoid.value),
    updatedAt: nowIso()
  };

  try {
    await putOne('preferences', record);
    logDiagnostic('preferences.save', { id });
    await reloadState();
    loadPreferenceForm();
    showToast('好みを保存しました。');
  } catch (error) {
    showGlobalError(error);
  }
}

async function saveBudget() {
  const amount = numberOrNull(els.budgetInput.value);
  if (amount === null || amount < 0) {
    els.budgetInput.focus();
    showToast('0円以上の予算を入力してください。', 'error');
    return;
  }

  try {
    await putOne('settings', {
      key: 'budget',
      amount: Math.round(amount),
      currency: 'JPY',
      updatedAt: nowIso()
    });
    logDiagnostic('budget.save');
    await reloadState();
    els.budgetSaveStatus.textContent = `保存済み ${formatDate(nowIso(), true)}`;
    showToast('現在の予算を保存しました。');
  } catch (error) {
    showGlobalError(error);
  }
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportBackup() {
  try {
    const data = await exportAllData();
    const payload = {
      app: 'BuyLens',
      appVersion: APP_VERSION,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: nowIso(),
      data,
      diagnostics: getDiagnostics()
    };
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    downloadJson(`buylens_backup_${date}.json`, payload);
    logDiagnostic('backup.export', { schemaVersion: BACKUP_SCHEMA_VERSION });
    showToast('Backupを書き出しました。');
  } catch (error) {
    showGlobalError(error);
  }
}

function sanitizeImportedDiagnostics(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-DIAGNOSTIC_LIMIT).filter((entry) => entry && typeof entry.action === 'string').map((entry) => ({
    id: typeof entry.id === 'string' ? entry.id : uid('diag'),
    at: typeof entry.at === 'string' ? entry.at : nowIso(),
    level: ['info', 'error', 'warn'].includes(entry.level) ? entry.level : 'info',
    action: entry.action.slice(0, 120),
    meta: {}
  }));
}

async function importBackupFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const payload = validateBackupPayload(JSON.parse(text));
    if (!window.confirm('Backupを読み込むと現在のBuyLensデータを置き換えます。続行しますか？')) return;

    await replaceAllData(payload);
    if (payload.diagnostics) setDiagnostics(sanitizeImportedDiagnostics(payload.diagnostics));
    state.compareIds = [];
    state.activeGroupId = '';
    logDiagnostic('backup.import', { schemaVersion: payload.schemaVersion });
    await reloadState();
    loadPreferenceForm();
    showToast('Backupを読み込みました。');
  } catch (error) {
    showGlobalError(error);
    showToast('Backupを読み込めませんでした。現在データは置換していません。', 'error');
  } finally {
    els.importBackupFile.value = '';
  }
}

function clearDiagnostics() {
  if (!window.confirm('ローカル診断ログを消去しますか？')) return;
  setDiagnostics([]);
  renderDiagnostics();
  showToast('診断ログを消去しました。');
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      showView(viewButton.dataset.view);
      return;
    }

    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const { action, productId } = actionButton.dataset;

    if (action === 'add-product') openProductDialog();
    if (action === 'edit-product') openProductDialog(productId);
    if (action === 'toggle-compare') toggleCompare(productId);
    if (action === 'remove-compare') toggleCompare(productId);
    if (action === 'clear-filters') {
      els.productSearch.value = '';
      els.statusFilter.value = 'all';
      renderProducts();
    }
  });

  $('#addProductButton').addEventListener('click', () => openProductDialog());
  $('#closeProductDialogButton').addEventListener('click', () => els.productDialog.close());
  $('#cancelProductButton').addEventListener('click', () => els.productDialog.close());
  els.productForm.addEventListener('submit', saveProduct);
  els.deleteProductButton.addEventListener('click', deleteCurrentProduct);

  for (const element of [els.productSearch, els.statusFilter, els.productSort]) {
    element.addEventListener(element === els.productSearch ? 'input' : 'change', renderProducts);
  }

  els.comparisonGroupSelect.addEventListener('change', () => loadComparisonGroup(els.comparisonGroupSelect.value));
  els.saveComparisonGroupButton.addEventListener('click', saveComparisonGroup);
  els.deleteComparisonGroupButton.addEventListener('click', deleteCurrentComparisonGroup);
  els.saveDecisionButton.addEventListener('click', saveDecision);

  els.preferenceScope.addEventListener('change', loadPreferenceForm);
  els.preferenceCategory.addEventListener('change', loadPreferenceForm);
  els.preferenceCategory.addEventListener('blur', loadPreferenceForm);
  for (const input of $$('#weightGrid input[type="range"]')) {
    input.addEventListener('input', () => {
      input.nextElementSibling.value = input.value;
    });
  }
  $('#savePreferencesButton').addEventListener('click', savePreferences);

  els.budgetSaveButton.addEventListener('click', saveBudget);
  $('#exportBackupButton').addEventListener('click', exportBackup);
  $('#importBackupButton').addEventListener('click', () => els.importBackupFile.click());
  els.importBackupFile.addEventListener('change', () => importBackupFile(els.importBackupFile.files?.[0]));
  $('#clearDiagnosticsButton').addEventListener('click', clearDiagnostics);

  els.productDialog.addEventListener('click', (event) => {
    if (event.target === els.productDialog) els.productDialog.close();
  });

  window.addEventListener('hashchange', () => showView(location.hash.slice(1), false));
  window.addEventListener('error', (event) => {
    logDiagnostic('runtime.error', { type: event.error?.name || 'Error' }, 'error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    logDiagnostic('runtime.unhandledrejection', { type: event.reason?.name || 'PromiseRejection' }, 'error');
  });
}

async function init() {
  try {
    bindEvents();
    await openDb();
    await reloadState();
    loadPreferenceForm();
    showView(location.hash.slice(1) || 'products', false);
    logDiagnostic('app.init', { schemaVersion: BACKUP_SCHEMA_VERSION });
  } catch (error) {
    showGlobalError(error);
  }
}

init();
