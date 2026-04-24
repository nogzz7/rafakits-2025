// ========== RAFAKITS25 - SCRIPT DINÂMICO (COM NEON) ==========
// Configuração
const API_BASE = '/.netlify/functions';

// Estado global
let products = [];
let categories = [];
let cart = JSON.parse(localStorage.getItem('rafakits25-cart')) || [];
let currentFilter = 'all';
let activeCoupon = null;

// ========== FUNÇÕES AUXILIARES ==========
function toNumber(v) {
  const num = parseFloat(v);
  return isNaN(num) ? 0 : num;
}

function safeToFixed(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '0.00';
  return parseFloat(value).toFixed(decimals);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function showNotification(msg, type = 'success') {
  const n = document.getElementById('notification');
  if (!n) return;
  n.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
  n.classList.add('active');
  setTimeout(() => n.classList.remove('active'), 3000);
}

function showLoading() { 
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'flex';
}
function hideLoading() { 
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'none';
}

// ========== APIs ==========
async function api(endpoint, id = null) {
  let url = `${API_BASE}/${endpoint}`;
  if (id) url += `?id=${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (Array.isArray(data)) {
    return data.map(item => ({
      ...item,
      price: toNumber(item.price),
      original_price: item.original_price ? toNumber(item.original_price) : null,
      inventory: parseInt(item.inventory) || 0,
    }));
  }
  return data;
}

// ========== CARREGAR DADOS DO BANCO ==========
async function loadProductsAndCategories() {
  showLoading();
  try {
    const [productsData, categoriesData] = await Promise.all([
      api('products'),
      api('categories')
    ]);
    products = productsData.map(p => ({
      ...p,
      price: typeof p.price === 'number' && !isNaN(p.price) ? p.price : 0,
      original_price: (p.original_price && typeof p.original_price === 'number' && !isNaN(p.original_price)) ? p.original_price : null,
      inventory: parseInt(p.inventory) || 0,
    }));
    categories = categoriesData;
    renderProducts();
    renderCategories();
    loadFlashSaleProducts();
    updateCartPricesFromDB();
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
    showNotification('Erro ao carregar produtos. Tente recarregar.', 'error');
  } finally {
    hideLoading();
  }
}

function updateCartPricesFromDB() {
  let updated = false;
  cart = cart.map(cartItem => {
    const freshProduct = products.find(p => p.id == cartItem.id);
    if (freshProduct && freshProduct.price !== cartItem.price) {
      updated = true;
      return { ...cartItem, price: freshProduct.price, name: freshProduct.name };
    }
    return cartItem;
  });
  if (updated) {
    localStorage.setItem('rafakits25-cart', JSON.stringify(cart));
    updateCartUI();
  }
}

// ========== SELETOR DE TAMANHO (MINI MODAL) ==========
// Cria dinamicamente um modal flutuante para escolher o tamanho
let activeSizePicker = null;

function askSizeAndAddToCart(productId) {
  const product = products.find(p => p.id == productId);
  if (!product) {
    showNotification('Produto não encontrado', 'error');
    return;
  }
  if (product.inventory <= 0) {
    showNotification('Produto esgotado!', 'error');
    return;
  }

  // Pega os tamanhos disponíveis (do metadata ou padrão)
  const availableSizes = product.metadata?.sizes || ['P', 'M', 'G', 'GG'];
  
  // Cria o modal de seleção de tamanho
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'size-picker-overlay';
  modalOverlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white; border-radius: 16px; padding: 24px; max-width: 300px; width: 90%;
    text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    font-family: 'Inter', sans-serif;
  `;
  modalContent.innerHTML = `
    <h3 style="margin-top:0">Escolha o tamanho</h3>
    <p style="margin-bottom:16px">${escapeHtml(product.name)}</p>
    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px;">
      ${availableSizes.map(size => `<button class="size-option-btn" data-size="${size}" style="background: #f0f0f0; border: none; padding: 10px 18px; border-radius: 40px; font-weight: 600; cursor: pointer; transition: all 0.2s;">${size}</button>`).join('')}
    </div>
    <button id="cancel-size-picker" style="background: #ccc; border: none; padding: 8px 16px; border-radius: 40px; cursor: pointer;">Cancelar</button>
  `;
  
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);
  
  // Adiciona eventos aos botões de tamanho
  document.querySelectorAll('.size-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedSize = btn.dataset.size;
      addToCart(product.id, selectedSize, 1);
      document.body.removeChild(modalOverlay);
    });
  });
  
  document.getElementById('cancel-size-picker').addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
  });
  
  // Fechar ao clicar fora do conteúdo
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) document.body.removeChild(modalOverlay);
  });
}

// ========== RENDERIZAÇÃO DE PRODUTOS ==========
function renderProducts() {
  const container = document.getElementById('products-grid');
  let filtered = products;
  if (currentFilter !== 'all') filtered = products.filter(p => p.collection === currentFilter);
  
  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;">
      <i class="fas fa-box-open" style="font-size:64px; color:var(--gray-300);"></i>
      <h3>Nenhum produto encontrado</h3>
    </div>`;
    return;
  }
  
  container.innerHTML = filtered.map(product => {
    const currentPrice = toNumber(product.price);
    const originalPrice = product.original_price ? toNumber(product.original_price) : null;
    const isOnSale = product.on_sale && originalPrice > currentPrice;
    const isOutOfStock = product.inventory <= 0;
    const salePercentage = isOnSale ? Math.round((1 - currentPrice / originalPrice) * 100) : 0;
    const cat = categories.find(c => c.slug === product.collection);
    const catName = cat ? cat.name : product.collection || 'Categoria';
    const imgUrl = product.image_1 || product.image_url || 'https://placehold.co/300x300?text=RK25';
    
    return `<div class="product-card">
      <div class="product-badges">
        ${isOnSale ? `<div class="badge badge-sale">${salePercentage}% OFF</div>` : ''}
        ${product.best_seller ? `<div class="badge badge-best">Mais Vendido</div>` : ''}
      </div>
      ${isOutOfStock ? `<div class="out-of-stock-label">ESGOTADO</div>` : ''}
      <img src="${imgUrl}" alt="${product.name}" class="product-image" onclick="openProductModal(${product.id})" onerror="this.src='https://placehold.co/300x300?text=RK25'">
      <div class="product-info">
        <span class="product-category" onclick="openProductModal(${product.id})">${escapeHtml(catName)}</span>
        <h3 class="product-title" onclick="openProductModal(${product.id})">${escapeHtml(product.name)}</h3>
        <div class="product-rating" onclick="openProductModal(${product.id})">
          <div class="stars">${'<i class="fas fa-star"></i>'.repeat(Math.floor(product.rating || 4))}</div>
          <span class="rating-count">(${product.rating || 4})</span>
        </div>
        <div class="stock-status" onclick="openProductModal(${product.id})">
          ${isOutOfStock ? '<i class="fas fa-times-circle out-of-stock"></i> <span class="out-of-stock">Esgotado</span>' : '<i class="fas fa-check-circle in-stock"></i> <span class="in-stock">Em estoque</span>'}
        </div>
        <div class="product-price" onclick="openProductModal(${product.id})">
          ${isOnSale ? `<span class="original-price">R$ ${safeToFixed(originalPrice)}</span>` : ''}
          <span class="current-price">R$ ${safeToFixed(currentPrice)}</span>
        </div>
        <p class="installment" onclick="openProductModal(${product.id})">em até <strong>6x de R$ ${safeToFixed(currentPrice / 6)}</strong> sem juros</p>
        ${!isOutOfStock ? `<button class="btn-buy" onclick="event.stopPropagation(); askSizeAndAddToCart(${product.id})"><i class="fas fa-shopping-cart"></i> COMPRAR</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderCategories() {
  const container = document.getElementById('categories-grid');
  if (!container) return;
  container.innerHTML = categories.map(cat => {
    const count = products.filter(p => p.collection === cat.slug).length;
    return `<div class="category-card" onclick="filterProducts('${cat.slug}')">
      <div class="category-icon"><i class="fas ${cat.icon || 'fa-tag'}"></i></div>
      <h3>${escapeHtml(cat.name)}</h3>
      <p style="color:var(--gray-600); font-size:14px;">${count} produtos</p>
    </div>`;
  }).join('');
}

function filterProducts(categoryId) {
  currentFilter = categoryId;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  renderProducts();
  document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

// ========== MODAL PRODUTO (detalhes) ==========
let currentModalProduct = null;
let currentSelectedSize = null;

function openProductModal(productId) {
  const product = products.find(p => p.id == productId);
  if (!product) return;
  currentModalProduct = product;
  currentSelectedSize = null;
  
  document.getElementById('modal-product-name').innerText = product.name;
  const mainImg = document.getElementById('modal-main-image');
  const imgUrl = product.image_1 || product.image_url || 'https://placehold.co/400x400';
  mainImg.src = imgUrl;
  
  const cat = categories.find(c => c.slug === product.collection);
  document.getElementById('modal-category').innerText = cat ? cat.name : 'Coleção';
  document.getElementById('modal-title').innerText = product.name;
  
  const starsFull = Math.floor(product.rating || 4);
  let starsHtml = '<i class="fas fa-star"></i>'.repeat(starsFull);
  starsHtml += '<i class="far fa-star"></i>'.repeat(5 - starsFull);
  document.getElementById('modal-stars').innerHTML = starsHtml;
  document.getElementById('modal-rating-count').innerText = `(${product.rating || 4})`;
  
  const currentPrice = toNumber(product.price);
  const originalPrice = product.original_price ? toNumber(product.original_price) : null;
  const isOnSale = product.on_sale && originalPrice > currentPrice;
  document.getElementById('modal-current-price').innerHTML = `R$ ${safeToFixed(currentPrice)}`;
  if (isOnSale) {
    document.getElementById('modal-original-price').innerHTML = `R$ ${safeToFixed(originalPrice)}`;
    document.getElementById('modal-original-price').style.display = 'inline';
  } else {
    document.getElementById('modal-original-price').style.display = 'none';
  }
  document.getElementById('modal-installment').innerHTML = `em até <strong>6x de R$ ${safeToFixed(currentPrice / 6)}</strong> sem juros`;
  
  const inStock = product.inventory > 0;
  document.getElementById('modal-stock').innerHTML = inStock 
    ? '<i class="fas fa-check-circle in-stock"></i> <span class="in-stock">Em estoque</span>'
    : '<i class="fas fa-times-circle out-of-stock"></i> <span class="out-of-stock">Esgotado</span>';
  
  // Miniaturas
  const thumbContainer = document.getElementById('modal-thumbnails');
  const images = [product.image_1, product.image_2, product.image_3].filter(img => img);
  if (images.length === 0) images.push(imgUrl);
  thumbContainer.innerHTML = images.map((img, idx) => 
    `<img src="${img}" class="thumbnail ${idx === 0 ? 'active' : ''}" onclick="changeMainImage(this, '${img}')">`
  ).join('');
  
  // Informações adicionais
  const detailsContainer = document.getElementById('product-details-under-gallery');
  detailsContainer.innerHTML = `
    <span><i class="fas fa-tag"></i> <strong>Marca:</strong> ${product.metadata?.marca || 'Rafakits25'}</span>
    <span><i class="fas fa-weight-hanging"></i> <strong>Material:</strong> ${product.metadata?.material || 'Algodão Premium'}</span>
    <span><i class="fas fa-ruler"></i> <strong>Tamanhos:</strong> ${(product.metadata?.sizes || ['P','M','G','GG']).join(', ')}</span>
  `;
  
  // Seletor de tamanhos
  const sizeContainer = document.getElementById('product-sizes-container');
  if (sizeContainer) {
    const sizes = product.metadata?.sizes || ['P','M','G','GG'];
    sizeContainer.innerHTML = `<div style="margin: 0.5rem 0;"><strong>Tamanho:</strong></div><div class="size-selector">${sizes.map(s => `<button class="size-btn" data-size="${s}">${s}</button>`).join('')}</div>`;
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        currentSelectedSize = this.dataset.size;
      });
    });
  }
  
  // Aba descrição
  document.getElementById('modal-tab-content').innerHTML = product.description || 'Sem descrição disponível.';
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const firstTab = document.querySelector('.tab-btn[onclick*="descricao"]');
  if (firstTab) firstTab.classList.add('active');
  
  document.getElementById('product-modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeProductModal(event) {
  if (event && event.target !== event.currentTarget && !event.target.closest('.close-product-modal')) return;
  document.getElementById('product-modal-overlay').classList.remove('active');
  document.body.style.overflow = 'auto';
}

function changeMainImage(thumbnail, src) {
  document.getElementById('modal-main-image').src = src;
  document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
  thumbnail.classList.add('active');
}

function switchTab(tab, evt) {
  const btn = evt?.target;
  if (btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  let content = '';
  if (tab === 'descricao') content = currentModalProduct?.description || 'Descrição não disponível.';
  else if (tab === 'avaliacoes') content = '<div>⭐⭐⭐⭐⭐ João Silva: "Produto excelente!"</div><div>⭐⭐⭐⭐ Maria: "Muito bom!"</div>';
  else if (tab === 'info') content = `<ul><li>Marca: ${currentModalProduct?.metadata?.marca || 'Rafakits25'}</li><li>Material: ${currentModalProduct?.metadata?.material || 'Algodão'}</li></ul>`;
  document.getElementById('modal-tab-content').innerHTML = content;
}

function addToCartFromModal() {
  if (!currentModalProduct) return;
  if (!currentSelectedSize) {
    showNotification('Selecione um tamanho', 'error');
    return;
  }
  addToCart(currentModalProduct.id, currentSelectedSize, 1);
  closeProductModal();
}

function addToWishlistFromModal() {
  showNotification('Adicionado aos favoritos!', 'success');
}

// ========== CARRINHO ==========
function addToCart(productId, size, qty = 1) {
  const product = products.find(p => p.id == productId);
  if (!product) return showNotification('Produto não encontrado', 'error');
  if (product.inventory <= 0) return showNotification('Produto esgotado!', 'error');
  
  const existing = cart.find(i => i.id === productId && i.size === size);
  if (existing) {
    if (existing.quantity + qty > product.inventory) return showNotification(`Limite de ${product.inventory} unidades`, 'error');
    existing.quantity += qty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: toNumber(product.price),
      image: product.image_1 || product.image_url,
      quantity: qty,
      size: size
    });
  }
  updateCartUI();
  showNotification(`${product.name} (${size}) adicionado!`, 'success');
}

function updateCartUI() {
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const cartCountSpan = document.getElementById('cart-count');
  if (cartCountSpan) cartCountSpan.innerText = totalItems;
  localStorage.setItem('rafakits25-cart', JSON.stringify(cart));
  renderCartItems();
}

function renderCartItems() {
  const container = document.getElementById('cart-items');
  const summary = document.getElementById('cart-summary');
  if (!container) return;
  if (cart.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:2rem;">Carrinho vazio</div>';
    if (summary) summary.innerHTML = '';
    return;
  }
  let html = '', subtotal = 0;
  cart.forEach((item, idx) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    html += `<div class="cart-item">
      <img src="${item.image}" class="cart-item-image" onerror="this.src='https://placehold.co/80'">
      <div class="cart-item-info">
        <div class="cart-item-title">${escapeHtml(item.name)} (${item.size})</div>
        <div class="cart-item-price">R$ ${safeToFixed(item.price)}</div>
        <div class="quantity-control">
          <button class="quantity-btn" onclick="updateQty(${idx}, -1)">-</button>
          <span>${item.quantity}</span>
          <button class="quantity-btn" onclick="updateQty(${idx}, 1)">+</button>
          <button class="remove-btn" onclick="removeItem(${idx})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>`;
  });
  container.innerHTML = html;
  let discount = 0;
  if (activeCoupon) {
    if (activeCoupon.type === 'percentage') discount = subtotal * activeCoupon.discount / 100;
    else discount = Math.min(activeCoupon.discount, subtotal);
  }
  const total = subtotal - discount;
  if (summary) {
    summary.innerHTML = `
      <div class="summary-row"><span>Subtotal:</span><span>R$ ${safeToFixed(subtotal)}</span></div>
      <div class="summary-row"><span>Frete:</span><span>Grátis</span></div>
      ${activeCoupon ? `<div class="summary-row discount-row"><span>Desconto (${activeCoupon.code}):</span><span>- R$ ${safeToFixed(discount)}</span><button onclick="removeCoupon()" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fas fa-times"></i></button></div>` : ''}
      <div class="summary-row summary-total"><span>Total:</span><span>R$ ${safeToFixed(total)}</span></div>
    `;
  }
}

window.updateQty = (idx, delta) => {
  if (!cart[idx]) return;
  let newQty = cart[idx].quantity + delta;
  if (newQty < 1) removeItem(idx);
  else { cart[idx].quantity = newQty; updateCartUI(); }
};

window.removeItem = (idx) => {
  cart.splice(idx, 1);
  updateCartUI();
};

function openCart() {
  const overlay = document.getElementById('cart-overlay');
  const sidebar = document.getElementById('cart-sidebar');
  if (overlay) overlay.classList.add('active');
  if (sidebar) sidebar.classList.add('active');
}
function closeCart() {
  const overlay = document.getElementById('cart-overlay');
  const sidebar = document.getElementById('cart-sidebar');
  if (overlay) overlay.classList.remove('active');
  if (sidebar) sidebar.classList.remove('active');
}

// ========== CHECKOUT (WhatsApp) ==========
async function checkout() {
  const name = document.getElementById('customer-name')?.value.trim();
  const phone = document.getElementById('customer-phone')?.value.trim();
  const address = document.getElementById('customer-address')?.value.trim();
  const payment = document.querySelector('input[name="payment"]:checked')?.value;
  if (!name || !phone || !address) return showNotification('Preencha nome, telefone e endereço', 'error');
  if (cart.length === 0) return showNotification('Carrinho vazio', 'error');
  let subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  let discount = activeCoupon ? (activeCoupon.type === 'percentage' ? subtotal * activeCoupon.discount / 100 : Math.min(activeCoupon.discount, subtotal)) : 0;
  let total = subtotal - discount;
  let msg = `*🛍️ RAFakits25 - NOVO PEDIDO*\n\nCliente: ${name}\nWhatsApp: ${phone}\nEndereço: ${address}\nPagamento: ${payment}\n\n📦 ITENS:\n`;
  cart.forEach(i => { msg += `${i.name} (${i.size}) x${i.quantity} = R$ ${safeToFixed(i.price * i.quantity)}\n`; });
  msg += `\nSubtotal: R$ ${safeToFixed(subtotal)}${activeCoupon ? `\nDesconto: -R$ ${safeToFixed(discount)}` : ''}\n*TOTAL: R$ ${safeToFixed(total)}*`;
  window.open(`https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  cart = [];
  activeCoupon = null;
  updateCartUI();
  closeCart();
  document.getElementById('customer-name').value = '';
  document.getElementById('customer-phone').value = '';
  document.getElementById('customer-address').value = '';
  showNotification('Pedido enviado! Redirecionando ao WhatsApp.', 'success');
}

// ========== CUPONS ==========
const coupons = { 'RAFAS10': { discount: 10, type: 'percentage', description: '10% OFF' }, 'FRETEGRATIS': { discount: 100, type: 'fixed', description: 'Frete grátis' } };
function applyCoupon() {
  const input = document.getElementById('coupon-input');
  const code = input.value.trim().toUpperCase();
  const msgDiv = document.getElementById('coupon-message');
  if (!coupons[code]) {
    if (msgDiv) msgDiv.innerHTML = '<span style="color:#ef4444;">Cupom inválido</span>';
    return;
  }
  activeCoupon = { code, ...coupons[code] };
  if (msgDiv) msgDiv.innerHTML = `<span style="color:#10b981;">✓ ${coupons[code].description} aplicado</span>`;
  input.value = '';
  renderCartItems();
}
function removeCoupon() {
  activeCoupon = null;
  const msgDiv = document.getElementById('coupon-message');
  if (msgDiv) msgDiv.innerHTML = '';
  renderCartItems();
}

// ========== FLASH SALE ==========
function loadFlashSaleProducts() {
  const saleProducts = products.filter(p => p.on_sale === true && p.inventory > 0);
  const featuredSales = saleProducts.slice(0, 4);
  const container = document.getElementById('flash-sale-products');
  if (!container) return;
  
  if (featuredSales.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;">
      <i class="fas fa-tag" style="font-size:48px; color:var(--gray-300);"></i>
      <h3>Novas promoções em breve!</h3>
      <p>Fique ligado para ofertas imperdíveis.</p>
    </div>`;
    return;
  }
  
  container.innerHTML = featuredSales.map(p => {
    const currentPrice = toNumber(p.price);
    const originalPrice = p.original_price ? toNumber(p.original_price) : currentPrice;
    const salePercentage = originalPrice > currentPrice ? Math.round((1 - currentPrice / originalPrice) * 100) : 0;
    const savings = originalPrice - currentPrice;
    const cat = categories.find(c => c.slug === p.collection);
    const catName = cat ? cat.name : p.collection;
    const imgUrl = p.image_1 || p.image_url || 'https://placehold.co/300x300?text=RK25';
    
    return `<div class="flash-sale-card" onclick="openProductModal(${p.id})">
      <div class="sale-ribbon">-${salePercentage}%</div>
      <img src="${imgUrl}" class="product-image" onerror="this.src='https://placehold.co/300x300'" loading="lazy">
      <div class="product-info">
        <span class="product-category">${escapeHtml(catName)}</span>
        <h3 class="product-title">${escapeHtml(p.name)}</h3>
        <div class="flash-sale-price">
          ${originalPrice > currentPrice ? `<span class="original">R$ ${safeToFixed(originalPrice)}</span>` : ''}
          <span class="current">R$ ${safeToFixed(currentPrice)}</span>
          <span class="discount-badge">-${salePercentage}%</span>
        </div>
        <div class="flash-sale-savings">
          <i class="fas fa-piggy-bank"></i>
          <span>Economize R$ ${safeToFixed(savings)}</span>
        </div>
        <button class="btn-flash-sale" onclick="event.stopPropagation(); askSizeAndAddToCart(${p.id})">
          <i class="fas fa-shopping-cart"></i> COMPRAR AGORA
        </button>
      </div>
    </div>`;
  }).join('');
}

function startFlashSaleTimer() {
  const target = new Date();
  target.setDate(target.getDate() + 3);
  target.setHours(23, 59, 59);
  function update() {
    const diff = target - new Date();
    if (diff <= 0) return;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const d = document.getElementById('timer-days');
    const h = document.getElementById('timer-hours');
    const m = document.getElementById('timer-minutes');
    const s = document.getElementById('timer-seconds');
    if (d) d.innerText = String(days).padStart(2, '0');
    if (h) h.innerText = String(hours).padStart(2, '0');
    if (m) m.innerText = String(mins).padStart(2, '0');
    if (s) s.innerText = String(secs).padStart(2, '0');
  }
  update();
  setInterval(update, 1000);
}

// ========== CARROSSEL MOBILE ==========
function initFlashSaleCarousel() {
  if (window.innerWidth > 768) return;
  const container = document.querySelector('.flash-sale-products');
  if (!container || document.querySelector('.carousel-arrow')) return;
  const section = document.querySelector('.flash-sale-section');
  if (!section) return;
  const leftArrow = document.createElement('div');
  leftArrow.className = 'carousel-arrow left';
  leftArrow.innerHTML = '<i class="fas fa-chevron-left"></i>';
  const rightArrow = document.createElement('div');
  rightArrow.className = 'carousel-arrow right';
  rightArrow.innerHTML = '<i class="fas fa-chevron-right"></i>';
  section.appendChild(leftArrow);
  section.appendChild(rightArrow);
  leftArrow.addEventListener('click', () => {
    container.scrollBy({ left: -300, behavior: 'smooth' });
  });
  rightArrow.addEventListener('click', () => {
    container.scrollBy({ left: 300, behavior: 'smooth' });
  });
}

// ========== HERO CARROSSEL ==========
let currentHeroSlide = 0;
const heroSlides = document.querySelectorAll('.hero-item');
const heroDots = document.querySelectorAll('.hero-dot');
const heroNumbers = document.querySelector('.hero-numbers');

function showHeroSlide(index) {
  if (!heroSlides.length) return;
  if (index >= heroSlides.length) index = 0;
  if (index < 0) index = heroSlides.length - 1;
  heroSlides.forEach((slide, i) => {
    slide.classList.toggle('active', i === index);
  });
  heroDots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
  if (heroNumbers) {
    heroNumbers.innerText = (index + 1).toString().padStart(2, '0');
  }
  currentHeroSlide = index;
}

function nextHeroSlide() {
  showHeroSlide(currentHeroSlide + 1);
}

function prevHeroSlide() {
  showHeroSlide(currentHeroSlide - 1);
}

const heroPrevBtn = document.getElementById('hero-prev');
const heroNextBtn = document.getElementById('hero-next');
if (heroPrevBtn) heroPrevBtn.addEventListener('click', prevHeroSlide);
if (heroNextBtn) heroNextBtn.addEventListener('click', nextHeroSlide);
heroDots.forEach((dot, idx) => {
  dot.addEventListener('click', () => showHeroSlide(idx));
});

let heroAutoplay = setInterval(nextHeroSlide, 5000);
const heroSection = document.querySelector('.hero-carousel');
if (heroSection) {
  heroSection.addEventListener('mouseenter', () => clearInterval(heroAutoplay));
  heroSection.addEventListener('mouseleave', () => {
    heroAutoplay = setInterval(nextHeroSlide, 5000);
  });
}

document.querySelectorAll('.hero-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.name, price = parseFloat(btn.dataset.price), img = btn.dataset.img;
    const prod = products.find(p => p.name === name);
    if (prod) askSizeAndAddToCart(prod.id);
    else {
      const tempProd = { id: Date.now(), name, price, image_url: img, inventory: 10 };
      // Para produto não cadastrado, pergunta tamanho mesmo assim
      askSizeAndAddToCart(tempProd.id);
    }
  });
});

// ========== INICIALIZAÇÃO ==========
function setupEvents() {
  document.getElementById('cart-btn')?.addEventListener('click', openCart);
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
  document.getElementById('checkout-btn')?.addEventListener('click', checkout);
  document.getElementById('search-input')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    if (!term) return renderProducts();
    const filtered = products.filter(p => p.name.toLowerCase().includes(term));
    const container = document.getElementById('products-grid');
    if (!filtered.length) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;"><i class="fas fa-search" style="font-size:64px;"></i><h3>Nenhum produto encontrado</h3></div>`;
    } else {
      container.innerHTML = filtered.map(p => `<div class="product-card" onclick="openProductModal(${p.id})"><img src="${p.image_1 || p.image_url}"><h3>${p.name}</h3><div class="price">R$ ${safeToFixed(p.price)}</div></div>`).join('');
    }
  });
  document.getElementById('newsletter-form')?.addEventListener('submit', e => { e.preventDefault(); showNotification('Inscrito com sucesso!', 'success'); e.target.reset(); });
  document.getElementById('coupon-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') applyCoupon(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCart(); closeProductModal(); } });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      document.querySelectorAll('.carousel-arrow').forEach(el => el.remove());
    } else {
      if (!document.querySelector('.carousel-arrow')) initFlashSaleCarousel();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  loadProductsAndCategories();
  startFlashSaleTimer();
  updateCartUI();
  initFlashSaleCarousel();
});