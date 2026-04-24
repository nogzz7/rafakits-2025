// ========== RAFAKITS25 - SCRIPT DINÂMICO (CORRIGIDO) ==========
const API_BASE = '/.netlify/functions';

// Estado global
let products = [];
let categories = [];
let cart = JSON.parse(localStorage.getItem('rafakits25-cart')) || [];
let currentFilter = 'all';
let activeCoupon = null;
let pendingProduct = null;      // produto temporário para o modal de tamanho
let currentModalProduct = null;
let currentSelectedSize = null;

// ========== FUNÇÕES AUXILIARES ==========
function toNumber(v) { return parseFloat(v) || 0; }

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

// ========== APIS ==========
async function api(endpoint, id = null) {
  let url = `${API_BASE}/${endpoint}`;
  if (id) url += `?id=${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
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

// ========== CARREGAR DADOS (CORRIGIDO: categorias não bloqueiam produtos) ==========
async function loadProductsAndCategories() {
  showLoading();
  try {
    // Carrega produtos primeiro (obrigatório)
    const productsData = await api('products');
    products = productsData;
    
    // Tenta carregar categorias, mas se falhar, usa array vazio e mostra fallback
    try {
      categories = await api('categories');
    } catch (err) {
      console.warn('Erro ao carregar categorias (continuando):', err);
      categories = [];
    }
    
    renderProducts();
    renderCategories();
    loadFlashSaleProducts();
    updateCartPricesFromDB();
  } catch (err) {
    console.error('Erro ao carregar produtos:', err);
    showNotification('Erro ao carregar produtos. Tente recarregar.', 'error');
    document.getElementById('products-grid').innerHTML = '<div style="text-align:center; padding:3rem;">Erro ao carregar produtos. Tente novamente mais tarde.</div>';
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

// ========== RENDERIZAÇÃO DE PRODUTOS ==========
function renderProducts() {
  const container = document.getElementById('products-grid');
  if (!container) return;
  
  let filtered = products;
  if (currentFilter !== 'all') {
    filtered = products.filter(p => p.collection === currentFilter);
  }
  
  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;"><i class="fas fa-box-open" style="font-size:64px;"></i><h3>Nenhum produto encontrado</h3></div>`;
    return;
  }
  
  container.innerHTML = filtered.map(product => {
    const isOnSale = product.on_sale && product.original_price && product.original_price > product.price;
    const isOutOfStock = product.inventory <= 0;
    const salePercentage = isOnSale ? Math.round((1 - product.price / product.original_price) * 100) : 0;
    const cat = categories.find(c => c.slug === product.collection);
    const catName = cat ? cat.name : (product.collection || 'Categoria');
    const imgUrl = product.image_1 || product.image_url || 'https://placehold.co/300x300?text=RK25';
    
    return `<div class="product-card">
      <div class="product-badges">
        ${isOnSale ? `<div class="badge badge-sale">${salePercentage}% OFF</div>` : ''}
        ${product.best_seller ? `<div class="badge badge-best">Mais Vendido</div>` : ''}
      </div>
      ${isOutOfStock ? `<div class="out-of-stock-label">ESGOTADO</div>` : ''}
      <img src="${imgUrl}" alt="${product.name}" class="product-image" onclick="openProductModal(${product.id})" onerror="this.src='https://placehold.co/300x300'">
      <div class="product-info">
        <span class="product-category" onclick="openProductModal(${product.id})">${catName}</span>
        <h3 class="product-title" onclick="openProductModal(${product.id})">${product.name}</h3>
        <div class="product-rating" onclick="openProductModal(${product.id})">
          <div class="stars">${'<i class="fas fa-star"></i>'.repeat(Math.floor(product.rating || 4))}</div>
          <span class="rating-count">(${product.rating || 4})</span>
        </div>
        <div class="stock-status" onclick="openProductModal(${product.id})">
          ${isOutOfStock ? '<i class="fas fa-times-circle out-of-stock"></i> <span class="out-of-stock">Esgotado</span>' : '<i class="fas fa-check-circle in-stock"></i> <span class="in-stock">Em estoque</span>'}
        </div>
        <div class="product-price" onclick="openProductModal(${product.id})">
          ${isOnSale ? `<span class="original-price">R$ ${product.original_price.toFixed(2)}</span>` : ''}
          <span class="current-price">R$ ${product.price.toFixed(2)}</span>
        </div>
        <p class="installment" onclick="openProductModal(${product.id})">em até <strong>6x de R$ ${(product.price / 6).toFixed(2)}</strong> sem juros</p>
        ${!isOutOfStock ? `<button class="btn-buy" data-id="${product.id}">COMPRAR</button>` : ''}
      </div>
    </div>`;
  }).join('');

  // Eventos dos botões COMPRAR
  document.querySelectorAll('.btn-buy').forEach(btn => {
    btn.removeEventListener('click', handleBuyClick);
    btn.addEventListener('click', handleBuyClick);
  });
}

function handleBuyClick(e) {
  e.stopPropagation();
  const productId = parseInt(this.dataset.id);
  const product = products.find(p => p.id === productId);
  if (!product) return;
  if (product.inventory <= 0) {
    showNotification('Produto esgotado!', 'error');
    return;
  }
  openSizeModal(product);
}

function renderCategories() {
  const container = document.getElementById('categories-grid');
  if (!container) return;
  
  // Se não há categorias, exibe mensagem amigável
  if (!categories || categories.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:2rem;">Carregando categorias...</div>`;
    return;
  }
  
  container.innerHTML = categories.map(cat => {
    const count = products.filter(p => p.collection === cat.slug).length;
    return `<div class="category-card" onclick="filterProducts('${cat.slug}', this)">
      <div class="category-icon"><i class="fas ${cat.icon || 'fa-tag'}"></i></div>
      <h3>${cat.name}</h3>
      <p style="color:var(--gray-600); font-size:14px;">${count} produtos</p>
    </div>`;
  }).join('');
}

// CORRIGIDO: recebe o elemento clicado para ativar visualmente
function filterProducts(categoryId, btnElement = null) {
  currentFilter = categoryId;
  // Atualiza botões de filtro ativos (se houver elementos .filter-btn)
  const filterBtns = document.querySelectorAll('.filter-btn');
  if (filterBtns.length) {
    filterBtns.forEach(btn => btn.classList.remove('active'));
    if (btnElement && btnElement.classList && btnElement.classList.contains('filter-btn')) {
      btnElement.classList.add('active');
    } else {
      // Tenta encontrar o botão correspondente pelo atributo data-filter
      const matchingBtn = Array.from(filterBtns).find(btn => btn.dataset.filter === categoryId);
      if (matchingBtn) matchingBtn.classList.add('active');
    }
  }
  renderProducts();
  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
}

// ========== MODAL DE SELEÇÃO DE TAMANHO ==========
function openSizeModal(product) {
  pendingProduct = product;
  const sizes = product.metadata?.sizes || ['P', 'M', 'G', 'GG'];
  document.getElementById('sizeProductName').innerText = product.name;
  const container = document.getElementById('sizeOptionsContainer');
  if (!container) return;
  container.innerHTML = sizes.map(size => `<button class="size-btn" data-size="${size}">${size}</button>`).join('');
  const firstBtn = container.querySelector('.size-btn');
  if (firstBtn) firstBtn.classList.add('selected');
  container.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      container.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
      this.classList.add('selected');
    });
  });
  document.getElementById('sizeModalOverlay').classList.add('active');
}

function closeSizeModal() {
  document.getElementById('sizeModalOverlay').classList.remove('active');
  pendingProduct = null;
}

document.getElementById('confirmAddToCartBtn')?.addEventListener('click', () => {
  if (!pendingProduct) return;
  const selected = document.querySelector('#sizeOptionsContainer .size-btn.selected');
  if (!selected) {
    showNotification('Selecione um tamanho', 'error');
    return;
  }
  const size = selected.dataset.size;
  addToCart(pendingProduct.id, size, 1);
  closeSizeModal();
});

// ========== MODAL PRODUTO (detalhes) ==========
function openProductModal(productId) {
  const product = products.find(p => p.id == productId);
  if (!product) return;
  currentModalProduct = product;
  currentSelectedSize = null;
  
  document.getElementById('modal-product-name').innerText = product.name;
  const imgUrl = product.image_1 || product.image_url || 'https://placehold.co/400x400';
  document.getElementById('modal-main-image').src = imgUrl;
  const cat = categories.find(c => c.slug === product.collection);
  document.getElementById('modal-category').innerText = cat ? cat.name : 'Coleção';
  document.getElementById('modal-title').innerText = product.name;
  const starsFull = Math.floor(product.rating || 4);
  let starsHtml = '<i class="fas fa-star"></i>'.repeat(starsFull) + '<i class="far fa-star"></i>'.repeat(5 - starsFull);
  document.getElementById('modal-stars').innerHTML = starsHtml;
  document.getElementById('modal-rating-count').innerText = `(${product.rating || 4})`;
  const isOnSale = product.on_sale && product.original_price && product.original_price > product.price;
  document.getElementById('modal-current-price').innerHTML = `R$ ${product.price.toFixed(2)}`;
  if (isOnSale) {
    document.getElementById('modal-original-price').innerHTML = `R$ ${product.original_price.toFixed(2)}`;
    document.getElementById('modal-original-price').style.display = 'inline';
  } else {
    document.getElementById('modal-original-price').style.display = 'none';
  }
  document.getElementById('modal-installment').innerHTML = `em até <strong>6x de R$ ${(product.price / 6).toFixed(2)}</strong> sem juros`;
  document.getElementById('modal-stock').innerHTML = product.inventory > 0 ? '<i class="fas fa-check-circle"></i> Em estoque' : '<i class="fas fa-times-circle"></i> Esgotado';
  
  const thumbContainer = document.getElementById('modal-thumbnails');
  let images = [product.image_1, product.image_2, product.image_3].filter(img => img && img.trim());
  if (images.length === 0 && imgUrl) images.push(imgUrl);
  thumbContainer.innerHTML = images.map((img, idx) => `<img src="${img}" class="thumbnail ${idx === 0 ? 'active' : ''}" onclick="changeMainImage(this, '${img}')">`).join('');
  
  const detailsContainer = document.getElementById('product-details-under-gallery');
  if (detailsContainer) {
    detailsContainer.innerHTML = `<span><i class="fas fa-tag"></i> <strong>Marca:</strong> ${product.metadata?.marca || 'Rafakits25'}</span><span><i class="fas fa-weight-hanging"></i> <strong>Material:</strong> ${product.metadata?.material || 'Algodão Premium'}</span><span><i class="fas fa-ruler"></i> <strong>Tamanhos:</strong> ${(product.metadata?.sizes || ['P','M','G','GG']).join(', ')}</span>`;
  }
  
  const sizeContainer = document.getElementById('product-sizes-container');
  if (sizeContainer) {
    const sizes = product.metadata?.sizes || ['P','M','G','GG'];
    sizeContainer.innerHTML = `<div style="margin: 0.5rem 0;"><strong>Tamanho:</strong></div><div class="size-selector">${sizes.map(s => `<button class="size-btn" data-size="${s}">${s}</button>`).join('')}</div>`;
    sizeContainer.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        sizeContainer.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        currentSelectedSize = this.dataset.size;
      });
    });
  }
  
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
      price: product.price,
      image: product.image_1 || product.image_url || 'https://placehold.co/80',
      quantity: qty,
      size: size
    });
  }
  updateCartUI();
  showNotification(`${product.name} (${size}) adicionado!`, 'success');
}

function updateCartUI() {
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const cartCountSpan = document.querySelector('.cart-count');
  if (cartCountSpan) cartCountSpan.textContent = totalItems;
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
    const imgSrc = item.image && item.image !== 'null' ? item.image : 'https://placehold.co/80';
    html += `<div class="cart-item">
      <img src="${imgSrc}" class="cart-item-image" onerror="this.src='https://placehold.co/80'">
      <div class="cart-item-info">
        <div class="cart-item-title">${item.name} (${item.size})</div>
        <div class="cart-item-price">R$ ${item.price.toFixed(2)}</div>
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
      <div class="summary-row"><span>Subtotal:</span><span>R$ ${subtotal.toFixed(2)}</span></div>
      <div class="summary-row"><span>Frete:</span><span>Grátis</span></div>
      ${activeCoupon ? `<div class="summary-row discount-row"><span>Desconto (${activeCoupon.code}):</span><span>- R$ ${discount.toFixed(2)}</span><button onclick="removeCoupon()" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fas fa-times"></i></button></div>` : ''}
      <div class="summary-row summary-total"><span>Total:</span><span>R$ ${total.toFixed(2)}</span></div>
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
  document.getElementById('cart-overlay').classList.add('active');
  document.getElementById('cart-sidebar').classList.add('active');
}
function closeCart() {
  document.getElementById('cart-overlay').classList.remove('active');
  document.getElementById('cart-sidebar').classList.remove('active');
}

// ========== CHECKOUT (WhatsApp + PIX) ==========
async function checkout() {
  const name = document.getElementById('customer-name')?.value.trim();
  const phone = document.getElementById('customer-phone')?.value.trim();
  const cep = document.getElementById('customer-cep')?.value.trim();
  const address = document.getElementById('customer-address')?.value.trim();
  const number = document.getElementById('customer-number')?.value.trim();
  const neighborhood = document.getElementById('customer-neighborhood')?.value.trim();
  const city = document.getElementById('customer-city')?.value.trim();
  const state = document.getElementById('customer-state')?.value.trim().toUpperCase();

  if (!name || !phone || !address || !cep || !number || !neighborhood || !city || !state) {
    return showNotification('Preencha todos os campos obrigatórios!', 'error');
  }
  if (cart.length === 0) return showNotification('Carrinho vazio', 'error');

  let subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  let discount = activeCoupon ? (activeCoupon.type === 'percentage' ? subtotal * activeCoupon.discount / 100 : Math.min(activeCoupon.discount, subtotal)) : 0;
  let total = subtotal - discount;

  // Opcional: enviar pedido para API (se existir)
  try {
    const orderData = {
      customer_name: name,
      customer_phone: phone,
      items: cart.map(item => ({
        name: item.name,
        size: item.size,
        quantity: item.quantity,
        price: item.price
      })),
      total_amount: total,
      status: 'pending'
    };
    await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
  } catch (err) {
    console.warn('Erro ao salvar pedido (continuando):', err);
  }

  const lojaWhatsApp = '5533999953164';
  let msg = `*🛍️ RAFakits25 - NOVO PEDIDO*\n\n`;
  msg += `*Cliente:* ${name}\n*WhatsApp:* ${phone}\n*Endereço:* ${address}, ${number}, ${neighborhood}, ${city} - ${state}\n*Pagamento:* PIX\n\n📦 ITENS:\n`;
  cart.forEach(i => { msg += `${i.name} (${i.size}) x${i.quantity} = R$ ${(i.price * i.quantity).toFixed(2)}\n`; });
  msg += `\nSubtotal: R$ ${subtotal.toFixed(2)}${activeCoupon ? `\nDesconto: -R$ ${discount.toFixed(2)}` : ''}\n*TOTAL: R$ ${total.toFixed(2)}*`;
  window.open(`https://wa.me/${lojaWhatsApp}?text=${encodeURIComponent(msg)}`, '_blank');

  cart = [];
  activeCoupon = null;
  updateCartUI();
  closeCart();
  // Limpar campos
  ['customer-name', 'customer-phone', 'customer-cep', 'customer-address', 'customer-number', 'customer-neighborhood', 'customer-city', 'customer-state'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  showNotification('✅ Pedido finalizado! Você será redirecionado ao WhatsApp da loja.', 'success');
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
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;"><i class="fas fa-tag" style="font-size:48px;"></i><h3>Novas promoções em breve!</h3></div>`;
    return;
  }
  container.innerHTML = featuredSales.map(p => {
    const salePercentage = Math.round((1 - p.price / p.original_price) * 100);
    const cat = categories.find(c => c.slug === p.collection);
    const catName = cat ? cat.name : p.collection;
    const imgUrl = p.image_1 || p.image_url || 'https://placehold.co/300x300';
    return `<div class="flash-sale-card" onclick="openProductModal(${p.id})">
      <div class="sale-ribbon">-${salePercentage}%</div>
      <img src="${imgUrl}" class="product-image" onerror="this.src='https://placehold.co/300x300'">
      <div class="product-info">
        <span class="product-category">${catName}</span>
        <h3 class="product-title">${p.name}</h3>
        <div class="flash-sale-price"><span class="original">R$ ${p.original_price.toFixed(2)}</span><span class="current">R$ ${p.price.toFixed(2)}</span><span class="discount-badge">-${salePercentage}%</span></div>
        <div class="flash-sale-savings"><i class="fas fa-piggy-bank"></i><span>Economize R$ ${(p.original_price - p.price).toFixed(2)}</span></div>
        <button class="btn-flash-sale" data-id="${p.id}">COMPRAR</button>
      </div>
    </div>`;
  }).join('');
  document.querySelectorAll('.btn-flash-sale').forEach(btn => {
    btn.removeEventListener('click', handleFlashSaleClick);
    btn.addEventListener('click', handleFlashSaleClick);
  });
}

function handleFlashSaleClick(e) {
  e.stopPropagation();
  const productId = parseInt(this.dataset.id);
  const product = products.find(p => p.id === productId);
  if (!product) return;
  if (product.inventory <= 0) {
    showNotification('Produto esgotado!', 'error');
    return;
  }
  openSizeModal(product);
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
    const daysEl = document.getElementById('timer-days');
    const hoursEl = document.getElementById('timer-hours');
    const minsEl = document.getElementById('timer-minutes');
    const secsEl = document.getElementById('timer-seconds');
    if (daysEl) daysEl.innerText = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.innerText = String(hours).padStart(2, '0');
    if (minsEl) minsEl.innerText = String(mins).padStart(2, '0');
    if (secsEl) secsEl.innerText = String(secs).padStart(2, '0');
  }
  update();
  setInterval(update, 1000);
}

// ========== CARROSSEL MOBILE FLASH SALE ==========
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
  leftArrow.addEventListener('click', () => container.scrollBy({ left: -300, behavior: 'smooth' }));
  rightArrow.addEventListener('click', () => container.scrollBy({ left: 300, behavior: 'smooth' }));
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
  heroSlides.forEach((slide, i) => slide.classList.toggle('active', i === index));
  heroDots.forEach((dot, i) => dot.classList.toggle('active', i === index));
  if (heroNumbers) heroNumbers.innerText = (index + 1).toString().padStart(2, '0');
  currentHeroSlide = index;
}
function nextHeroSlide() { showHeroSlide(currentHeroSlide + 1); }
function prevHeroSlide() { showHeroSlide(currentHeroSlide - 1); }
document.getElementById('hero-prev')?.addEventListener('click', prevHeroSlide);
document.getElementById('hero-next')?.addEventListener('click', nextHeroSlide);
heroDots.forEach((dot, idx) => dot.addEventListener('click', () => showHeroSlide(idx)));
let heroAutoplay = setInterval(nextHeroSlide, 5000);
const heroSection = document.querySelector('.hero-carousel');
if (heroSection) {
  heroSection.addEventListener('mouseenter', () => clearInterval(heroAutoplay));
  heroSection.addEventListener('mouseleave', () => { heroAutoplay = setInterval(nextHeroSlide, 5000); });
}

// Botões do hero (se existirem)
document.querySelectorAll('.hero-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.name, price = parseFloat(btn.dataset.price), img = btn.dataset.img;
    const prod = products.find(p => p.name === name);
    if (prod) openSizeModal(prod);
    else {
      const tempProd = { id: Date.now(), name, price, image_url: img, inventory: 10, metadata: { sizes: ['P','M','G','GG'] } };
      openSizeModal(tempProd);
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
    if (!filtered.length) container.innerHTML = '<div style="text-align:center; padding:3rem;"><i class="fas fa-search"></i><h3>Nenhum produto encontrado</h3></div>';
    else container.innerHTML = filtered.map(p => `<div class="product-card" onclick="openProductModal(${p.id})"><img src="${p.image_1 || p.image_url || 'https://placehold.co/300x300'}" class="product-image"><h3>${p.name}</h3><div class="price">R$ ${p.price.toFixed(2)}</div></div>`).join('');
  });
  document.getElementById('newsletter-form')?.addEventListener('submit', e => { e.preventDefault(); showNotification('Inscrito com sucesso!'); e.target.reset(); });
  document.getElementById('coupon-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') applyCoupon(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCart(); closeProductModal(); closeSizeModal(); } });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) document.querySelectorAll('.carousel-arrow').forEach(el => el.remove());
    else if (!document.querySelector('.carousel-arrow')) initFlashSaleCarousel();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  loadProductsAndCategories();
  startFlashSaleTimer();
  updateCartUI();
  initFlashSaleCarousel();
});