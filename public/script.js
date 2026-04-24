// ========== RAFAKITS25 - SCRIPT FINAL (CORRIGIDO) ==========
const API_BASE = '/.netlify/functions';

let products = [];
let categories = [];
let cart = JSON.parse(localStorage.getItem('rafakits25-cart')) || [];
let currentFilter = 'all';
let activeCoupon = null;
let pendingProduct = null;

function toNumber(v) { return parseFloat(v) || 0; }

function showNotification(msg, type = 'success') {
  const n = document.getElementById('notification');
  if (!n) return;
  n.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
  n.classList.add('active');
  setTimeout(() => n.classList.remove('active'), 3000);
}

function showLoading() { const l = document.getElementById('loading'); if (l) l.style.display = 'flex'; }
function hideLoading() { const l = document.getElementById('loading'); if (l) l.style.display = 'none'; }

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

async function loadProductsAndCategories() {
  showLoading();
  try {
    const [productsData, categoriesData] = await Promise.all([api('products'), api('categories')]);
    products = productsData;
    categories = categoriesData;
    renderProducts();
    renderCategories();
    loadFlashSaleProducts();
    updateCartPricesFromDB();
  } catch (err) {
    console.error(err);
    showNotification('Erro ao carregar produtos. Recarregue a página.', 'error');
  } finally {
    hideLoading();
  }
}

function updateCartPricesFromDB() {
  let updated = false;
  cart = cart.map(cartItem => {
    const fresh = products.find(p => p.id == cartItem.id);
    if (fresh && fresh.price !== cartItem.price) {
      updated = true;
      return { ...cartItem, price: fresh.price, name: fresh.name };
    }
    return cartItem;
  });
  if (updated) {
    localStorage.setItem('rafakits25-cart', JSON.stringify(cart));
    updateCartUI();
  }
}

function renderProducts() {
  const container = document.getElementById('products-grid');
  if (!container) {
    console.error('Elemento #products-grid não encontrado');
    return;
  }
  let filtered = products;
  if (currentFilter !== 'all') filtered = products.filter(p => p.collection === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;"><i class="fas fa-box-open" style="font-size:64px;"></i><h3>Nenhum produto encontrado</h3></div>`;
    return;
  }

  container.innerHTML = filtered.map(product => {
    const isOnSale = product.on_sale && product.original_price > product.price;
    const isOutOfStock = product.inventory <= 0;
    const salePercentage = isOnSale ? Math.round((1 - product.price / product.original_price) * 100) : 0;
    const cat = categories.find(c => c.slug === product.collection);
    const catName = cat ? cat.name : product.collection || 'Categoria';
    const imgUrl = product.image_1 || product.image_url || 'https://placehold.co/300x300?text=RK25';
    
    return `<div class="product-card">
      <div class="product-badges">
        ${isOnSale ? `<div class="badge badge-sale">${salePercentage}% OFF</div>` : ''}
        ${product.best_seller ? `<div class="badge badge-best">Mais Vendido</div>` : ''}
      </div>
      ${isOutOfStock ? `<div class="out-of-stock-label">ESGOTADO</div>` : ''}
      <img src="${imgUrl}" class="product-image" onclick="openProductModal(${product.id})" onerror="this.src='https://placehold.co/300x300'">
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
        <p class="installment" onclick="openProductModal(${product.id})">até 6x R$ ${(product.price / 6).toFixed(2)}</p>
        ${!isOutOfStock ? `<button class="btn-buy" data-id="${product.id}">COMPRAR</button>` : ''}
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('.btn-buy').forEach(btn => {
    btn.removeEventListener('click', handleBuyClick);
    btn.addEventListener('click', handleBuyClick);
  });
}

function handleBuyClick(e) {
  e.stopPropagation();
  const id = parseInt(this.dataset.id);
  const prod = products.find(p => p.id === id);
  if (!prod) return;
  if (prod.inventory <= 0) return showNotification('Produto esgotado!', 'error');
  openSizeModal(prod);
}

function renderCategories() {
  const container = document.getElementById('categories-grid');
  if (!container) return;
  container.innerHTML = categories.map(cat => `
    <div class="category-card" onclick="filterProducts('${cat.slug}')">
      <div class="category-icon"><i class="fas ${cat.icon || 'fa-tag'}"></i></div>
      <h3>${cat.name}</h3>
      <p>${products.filter(p => p.collection === cat.slug).length} produtos</p>
    </div>
  `).join('');
}

// EXPORTA GLOBALMENTE para funcionar no onclick do HTML
window.filterProducts = function(categoryId) {
  currentFilter = categoryId;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  renderProducts();
  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
};

// ========== MODAL DE TAMANHO ==========
function openSizeModal(product) {
  pendingProduct = product;
  const sizes = product.metadata?.sizes || ['P', 'M', 'G', 'GG'];
  document.getElementById('sizeProductName').innerText = product.name;
  const container = document.getElementById('sizeOptionsContainer');
  container.innerHTML = sizes.map(s => `<button class="size-btn" data-size="${s}">${s}</button>`).join('');
  const first = container.querySelector('.size-btn');
  if (first) first.classList.add('selected');
  container.querySelectorAll('.size-btn').forEach(btn => {
    btn.onclick = (e) => {
      container.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
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
  if (!selected) return showNotification('Selecione um tamanho', 'error');
  addToCart(pendingProduct.id, selected.dataset.size, 1);
  closeSizeModal();
});

// ========== MODAL PRODUTO (detalhes, com seleção de tamanho) ==========
let currentModalProduct = null, currentSelectedSize = null;
function openProductModal(productId) {
  const prod = products.find(p => p.id == productId);
  if (!prod) return;
  currentModalProduct = prod;
  currentSelectedSize = null;
  document.getElementById('modal-product-name').innerText = prod.name;
  const img = prod.image_1 || prod.image_url || 'https://placehold.co/400x400';
  document.getElementById('modal-main-image').src = img;
  const cat = categories.find(c => c.slug === prod.collection);
  document.getElementById('modal-category').innerText = cat ? cat.name : 'Coleção';
  document.getElementById('modal-title').innerText = prod.name;
  const stars = '★'.repeat(Math.floor(prod.rating || 4)) + '☆'.repeat(5 - Math.floor(prod.rating || 4));
  document.getElementById('modal-stars').innerHTML = stars;
  document.getElementById('modal-rating-count').innerText = `(${prod.rating || 4})`;
  const onSale = prod.on_sale && prod.original_price > prod.price;
  document.getElementById('modal-current-price').innerHTML = `R$ ${prod.price.toFixed(2)}`;
  if (onSale) {
    document.getElementById('modal-original-price').innerHTML = `R$ ${prod.original_price.toFixed(2)}`;
    document.getElementById('modal-original-price').style.display = 'inline';
  } else {
    document.getElementById('modal-original-price').style.display = 'none';
  }
  document.getElementById('modal-installment').innerHTML = `até 6x R$ ${(prod.price/6).toFixed(2)}`;
  document.getElementById('modal-stock').innerHTML = prod.inventory > 0 ? '✅ Em estoque' : '❌ Esgotado';
  const thumbs = [prod.image_1, prod.image_2, prod.image_3].filter(i => i);
  if (thumbs.length === 0) thumbs.push(img);
  document.getElementById('modal-thumbnails').innerHTML = thumbs.map((u, i) => `<img src="${u}" class="thumbnail ${i===0 ? 'active' : ''}" onclick="changeMainImage(this, '${u}')">`).join('');
  document.getElementById('product-details-under-gallery').innerHTML = `
    <span><i class="fas fa-tag"></i> Marca: ${prod.metadata?.marca || 'Rafakits25'}</span>
    <span><i class="fas fa-weight-hanging"></i> Material: ${prod.metadata?.material || 'Algodão'}</span>
    <span><i class="fas fa-ruler"></i> Tamanhos: ${(prod.metadata?.sizes || ['P','M','G','GG']).join(', ')}</span>
  `;
  const szCont = document.getElementById('product-sizes-container');
  if (szCont) {
    const sizes = prod.metadata?.sizes || ['P','M','G','GG'];
    szCont.innerHTML = `<div><strong>Tamanho:</strong></div><div class="size-selector">${sizes.map(s => `<button class="size-btn" data-size="${s}">${s}</button>`).join('')}</div>`;
    szCont.querySelectorAll('.size-btn').forEach(btn => {
      btn.onclick = () => {
        szCont.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        currentSelectedSize = btn.dataset.size;
      };
    });
  }
  document.getElementById('modal-tab-content').innerHTML = prod.description || 'Sem descrição.';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const firstTab = document.querySelector('.tab-btn[onclick*="descricao"]');
  if (firstTab) firstTab.classList.add('active');
  document.getElementById('product-modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeProductModal(e) {
  if (e && e.target !== e.currentTarget && !e.target.closest('.close-product-modal')) return;
  document.getElementById('product-modal-overlay').classList.remove('active');
  document.body.style.overflow = 'auto';
}
function changeMainImage(thumb, src) {
  document.getElementById('modal-main-image').src = src;
  document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}
function switchTab(tab, evt) {
  const btn = evt?.target;
  if (btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  let content = '';
  if (tab === 'descricao') content = currentModalProduct?.description || '';
  else if (tab === 'avaliacoes') content = '<div>⭐⭐⭐⭐⭐ Excelente qualidade!</div><div>⭐⭐⭐⭐ Muito bom!</div>';
  else if (tab === 'info') content = `<ul><li>Marca: ${currentModalProduct?.metadata?.marca || 'Rafakits25'}</li><li>Material: ${currentModalProduct?.metadata?.material || 'Algodão'}</li></ul>`;
  document.getElementById('modal-tab-content').innerHTML = content;
}
function addToCartFromModal() {
  if (!currentModalProduct) return;
  if (!currentSelectedSize) return showNotification('Selecione um tamanho', 'error');
  addToCart(currentModalProduct.id, currentSelectedSize, 1);
  closeProductModal();
}
function addToWishlistFromModal() { showNotification('Adicionado aos favoritos'); }

// ========== CARRINHO ==========
function addToCart(id, size, qty = 1) {
  const prod = products.find(p => p.id == id);
  if (!prod) return showNotification('Produto não encontrado', 'error');
  if (prod.inventory <= 0) return showNotification('Produto esgotado!', 'error');
  const existing = cart.find(i => i.id === id && i.size === size);
  if (existing) {
    if (existing.quantity + qty > prod.inventory) return showNotification(`Limite de ${prod.inventory} unidades`, 'error');
    existing.quantity += qty;
  } else {
    cart.push({ id: prod.id, name: prod.name, price: prod.price, image: prod.image_1 || prod.image_url, quantity: qty, size });
  }
  updateCartUI();
  showNotification(`${prod.name} (${size}) adicionado!`);
}
function updateCartUI() {
  const total = cart.reduce((s,i) => s + i.quantity, 0);
  const span = document.querySelector('.cart-count');
  if (span) span.textContent = total;
  localStorage.setItem('rafakits25-cart', JSON.stringify(cart));
  renderCartItems();
}
function renderCartItems() {
  const container = document.getElementById('cart-items');
  const summary = document.getElementById('cart-summary');
  if (!container) return;
  if (cart.length === 0) {
    container.innerHTML = '<div style="padding:2rem; text-align:center;">Carrinho vazio</div>';
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
  if (activeCoupon) discount = activeCoupon.type === 'percentage' ? subtotal * activeCoupon.discount / 100 : Math.min(activeCoupon.discount, subtotal);
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
  const newQty = cart[idx].quantity + delta;
  if (newQty < 1) removeItem(idx);
  else { cart[idx].quantity = newQty; updateCartUI(); }
};
function removeItem(idx) { cart.splice(idx,1); updateCartUI(); }
function openCart() { document.getElementById('cart-overlay').classList.add('active'); document.getElementById('cart-sidebar').classList.add('active'); }
function closeCart() { document.getElementById('cart-overlay').classList.remove('active'); document.getElementById('cart-sidebar').classList.remove('active'); }

// ========== CHECKOUT ==========
async function checkout() {
  const name = document.getElementById('customer-name')?.value.trim();
  const phone = document.getElementById('customer-phone')?.value.trim();
  const address = document.getElementById('customer-address')?.value.trim();
  if (!name || !phone || !address) return showNotification('Preencha nome, telefone e endereço', 'error');
  if (cart.length === 0) return showNotification('Carrinho vazio', 'error');
  let subtotal = cart.reduce((s,i)=>s + i.price*i.quantity,0);
  let discount = activeCoupon ? (activeCoupon.type==='percentage' ? subtotal*activeCoupon.discount/100 : Math.min(activeCoupon.discount,subtotal)) : 0;
  let total = subtotal - discount;
  const orderData = { customer_name: name, customer_phone: phone, items: cart.map(i=>({name:i.name,size:i.size,quantity:i.quantity,price:i.price})), total_amount: total, status: 'pending' };
  showLoading();
  try {
    await fetch(`${API_BASE}/orders`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(orderData) });
  } catch(err) { console.error(err); showNotification('Erro ao processar pedido', 'error'); hideLoading(); return; }
  const loja = '5533999953164';
  let msg = `*🛍️ RAFakits25 - NOVO PEDIDO*\n\nCliente: ${name}\nWhatsApp: ${phone}\nEndereço: ${address}\nPagamento: PIX\n\n📦 ITENS:\n`;
  cart.forEach(i => { msg += `${i.name} (${i.size}) x${i.quantity} = R$ ${(i.price*i.quantity).toFixed(2)}\n`; });
  msg += `\nSubtotal: R$ ${subtotal.toFixed(2)}${activeCoupon ? `\nDesconto: -R$ ${discount.toFixed(2)}` : ''}\n*TOTAL: R$ ${total.toFixed(2)}*`;
  window.open(`https://wa.me/${loja}?text=${encodeURIComponent(msg)}`, '_blank');
  cart = []; activeCoupon = null; updateCartUI(); closeCart();
  document.getElementById('customer-name').value = ''; document.getElementById('customer-phone').value = ''; document.getElementById('customer-address').value = '';
  await loadProductsAndCategories();
  showNotification('Pedido finalizado! Estoque atualizado.', 'success');
  hideLoading();
}
function applyCoupon() {
  const input = document.getElementById('coupon-input');
  const code = input.value.trim().toUpperCase();
  const msgDiv = document.getElementById('coupon-message');
  const coupons = { 'RAFAS10': { discount:10, type:'percentage', description:'10% OFF' }, 'FRETEGRATIS': { discount:100, type:'fixed', description:'Frete grátis' } };
  if (!coupons[code]) { if(msgDiv) msgDiv.innerHTML = '<span style="color:#ef4444;">Cupom inválido</span>'; return; }
  activeCoupon = { code, ...coupons[code] };
  if(msgDiv) msgDiv.innerHTML = `<span style="color:#10b981;">✓ ${coupons[code].description} aplicado</span>`;
  input.value = '';
  renderCartItems();
}
function removeCoupon() { activeCoupon = null; document.getElementById('coupon-message').innerHTML = ''; renderCartItems(); }

// ========== FLASH SALE ==========
function loadFlashSaleProducts() {
  const sale = products.filter(p => p.on_sale && p.inventory>0).slice(0,4);
  const container = document.getElementById('flash-sale-products');
  if (!container) return;
  if (sale.length===0) { container.innerHTML = '<div>Promoções em breve</div>'; return; }
  container.innerHTML = sale.map(p => {
    const perc = Math.round((1 - p.price/p.original_price)*100);
    return `<div class="flash-sale-card" onclick="openProductModal(${p.id})">
      <div class="sale-ribbon">-${perc}%</div>
      <img src="${p.image_1||p.image_url}" class="product-image">
      <div class="product-info"><span class="product-category">${p.collection}</span><h3>${p.name}</h3><div class="flash-sale-price"><span class="original">R$ ${p.original_price.toFixed(2)}</span><span class="current">R$ ${p.price.toFixed(2)}</span><span class="discount-badge">-${perc}%</span></div><button class="btn-flash-sale" data-id="${p.id}">COMPRAR</button></div>
    </div>`;
  }).join('');
  document.querySelectorAll('.btn-flash-sale').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); const id = parseInt(btn.dataset.id); const prod = products.find(p=>p.id===id); if(prod) openSizeModal(prod); };
  });
}
function startFlashSaleTimer() {
  const target = new Date(); target.setDate(target.getDate()+3); target.setHours(23,59,59);
  setInterval(() => {
    const diff = target - new Date(); if(diff<=0) return;
    document.getElementById('timer-days').innerText = String(Math.floor(diff/86400000)).padStart(2,'0');
    document.getElementById('timer-hours').innerText = String(Math.floor((diff%86400000)/3600000)).padStart(2,'0');
    document.getElementById('timer-minutes').innerText = String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
    document.getElementById('timer-seconds').innerText = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
  },1000);
}
function initFlashSaleCarousel() {
  if (window.innerWidth>768) return;
  const c = document.querySelector('.flash-sale-products');
  if(!c || document.querySelector('.carousel-arrow')) return;
  const s = document.querySelector('.flash-sale-section');
  if(!s) return;
  const left = document.createElement('div'); left.className = 'carousel-arrow left'; left.innerHTML = '<i class="fas fa-chevron-left"></i>';
  const right = document.createElement('div'); right.className = 'carousel-arrow right'; right.innerHTML = '<i class="fas fa-chevron-right"></i>';
  s.appendChild(left); s.appendChild(right);
  left.onclick = () => c.scrollBy({left:-300, behavior:'smooth'});
  right.onclick = () => c.scrollBy({left:300, behavior:'smooth'});
}

// ========== HERO CARROSSEL ==========
let currentSlide = 0;
const slides = document.querySelectorAll('.hero-item');
const dots = document.querySelectorAll('.hero-dot');
const nums = document.querySelector('.hero-numbers');
function showSlide(index) {
  if (!slides.length) return;
  if (index>=slides.length) index=0;
  if (index<0) index=slides.length-1;
  slides.forEach((s,i)=>s.classList.toggle('active', i===index));
  dots.forEach((d,i)=>d.classList.toggle('active', i===index));
  if (nums) nums.innerText = (index+1).toString().padStart(2,'0');
  currentSlide = index;
}
function nextSlide() { showSlide(currentSlide+1); }
function prevSlide() { showSlide(currentSlide-1); }
document.getElementById('hero-prev')?.addEventListener('click', prevSlide);
document.getElementById('hero-next')?.addEventListener('click', nextSlide);
dots.forEach((d,i)=>d.addEventListener('click',()=>showSlide(i)));
let autoplay = setInterval(nextSlide,5000);
const hero = document.querySelector('.hero-carousel');
if(hero) {
  hero.addEventListener('mouseenter',()=>clearInterval(autoplay));
  hero.addEventListener('mouseleave',()=>autoplay=setInterval(nextSlide,5000));
}
document.querySelectorAll('.hero-btn').forEach(btn => {
  btn.onclick = () => {
    const name = btn.dataset.name, price = parseFloat(btn.dataset.price), img = btn.dataset.img;
    const prod = products.find(p=>p.name===name);
    if(prod) openSizeModal(prod);
    else openSizeModal({ id:Date.now(), name, price, image_url:img, inventory:10, metadata:{sizes:['P','M','G','GG']} });
  };
});

// ========== BUSCA, NEWSLETTER E EVENTOS ==========
function setupEvents() {
  document.getElementById('cart-btn')?.addEventListener('click', openCart);
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
  document.getElementById('checkout-btn')?.addEventListener('click', checkout);
  document.getElementById('search-input')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    if (!term) renderProducts();
    else {
      const filtered = products.filter(p => p.name.toLowerCase().includes(term));
      const container = document.getElementById('products-grid');
      if (!filtered.length) container.innerHTML = '<div style="text-align:center; padding:3rem;"><i class="fas fa-search"></i><h3>Nenhum produto encontrado</h3></div>';
      else container.innerHTML = filtered.map(p => `<div class="product-card" onclick="openProductModal(${p.id})"><img src="${p.image_1||p.image_url}"><h3>${p.name}</h3><div class="price">R$ ${p.price.toFixed(2)}</div></div>`).join('');
    }
  });
  document.getElementById('newsletter-form')?.addEventListener('submit', e => { e.preventDefault(); showNotification('Inscrito com sucesso!'); e.target.reset(); });
  document.getElementById('coupon-input')?.addEventListener('keypress', e => { if(e.key==='Enter') applyCoupon(); });
  document.addEventListener('keydown', e => { if(e.key==='Escape') { closeCart(); closeProductModal(); closeSizeModal(); } });
  window.addEventListener('resize', () => {
    if (window.innerWidth>768) document.querySelectorAll('.carousel-arrow').forEach(el=>el.remove());
    else if (!document.querySelector('.carousel-arrow')) initFlashSaleCarousel();
  });
}

// ========== INICIO ==========
document.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  loadProductsAndCategories();
  startFlashSaleTimer();
  updateCartUI();
  initFlashSaleCarousel();
});