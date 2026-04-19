// ========== GLOBAL ==========
let products = [];
let cart = JSON.parse(localStorage.getItem("rafakits_cart")) || [];
let selectedShipping = 'free';
let selectedPaymentMethod = 'whatsapp';

// ========== BUSCAR PRODUTOS DO BANCO (NEON) ==========
async function fetchProducts() {
  try {
    const res = await fetch('/.netlify/functions/products');
    if (!res.ok) throw new Error('Erro ao buscar produtos');
    products = await res.json();
    // Após carregar, renderizar tudo
    renderProductsForCurrentCollection();
    updateCategoryCounts();
    updateCartUI();
  } catch (err) {
    console.error('Erro ao carregar produtos:', err);
    products = [];
    renderProductsForCurrentCollection();
  }
}

// Coleção atual (definida pelas tabs)
let currentCollection = 'all';

function renderProductsForCurrentCollection() {
  let filtered = products;
  if (currentCollection !== 'all') {
    filtered = products.filter(p => p.collection === currentCollection);
  }
  renderProducts(filtered, currentCollection);
}

function renderProducts(productsArray, collectionId) {
  const containerId = collectionId === 'all' ? 'all-grid' :
                      collectionId === 'colecao-30-1' ? '30-grid' :
                      collectionId === 'oversized' ? 'oversized-grid' : 'shorts-grid';
  const container = document.getElementById(containerId);
  if (!container) return;

  if (productsArray.length === 0) {
    container.innerHTML = '<p style="text-align:center; grid-column:1/-1;">Nenhum produto encontrado.</p>';
    return;
  }

  container.innerHTML = productsArray.map(p => `
    <div class="product-card">
      <img src="${p.image || 'https://placehold.co/400x500/111/ffd700?text=Produto'}" onerror="this.src='https://placehold.co/400x500/111/ffd700?text=Produto'">
      <h3>${p.name}</h3>
      <div>${p.original_price ? `<span class="original-price">R$ ${Number(p.original_price).toFixed(2)}</span>` : ''}<span class="price">R$ ${Number(p.price).toFixed(2)}</span></div>
      <button class="btn-add" onclick="addToCart({id:'${p.id}', name:'${p.name}', price:${p.price}, image:'${p.image}'})">Adicionar</button>
    </div>
  `).join('');
}

// ========== CARRINHO ==========
function saveCart() {
  localStorage.setItem("rafakits_cart", JSON.stringify(cart));
  updateCartUI();
}

function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  saveCart();
  alert(`${product.name} adicionado ao carrinho!`);
}

function updateCartUI() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById("cart-count").innerText = count;
  const container = document.getElementById("cart-items");
  if (!cart.length) {
    container.innerHTML = "<p>Carrinho vazio</p>";
    document.getElementById("cart-total").innerHTML = "";
    return;
  }
  container.innerHTML = cart.map((item, idx) => `
    <div style="display:flex; gap:10px; margin-bottom:10px;">
      <img src="${item.image}" width="50" style="object-fit:cover; border-radius:8px;">
      <div style="flex:1">
        <strong>${item.name}</strong><br>
        R$ ${item.price} x ${item.qty} = R$ ${(item.price * item.qty).toFixed(2)}<br>
        <button onclick="changeQty(${idx}, -1)">-</button>
        <button onclick="changeQty(${idx}, 1)">+</button>
        <button onclick="removeItem(${idx})">remover</button>
      </div>
    </div>
  `).join("");
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById("cart-total").innerHTML = `<strong>Total: R$ ${total.toFixed(2)}</strong>`;
}

window.changeQty = (idx, delta) => {
  if (cart[idx]) {
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    saveCart();
  }
};

window.removeItem = (idx) => {
  cart.splice(idx, 1);
  saveCart();
};

// ========== ABRIR/FECHAR CARRINHO ==========
document.getElementById("cart-icon").addEventListener("click", () => {
  document.getElementById("cart-sidebar").classList.add("open");
  document.getElementById("overlay").classList.add("active");
});
document.getElementById("overlay").addEventListener("click", () => {
  document.getElementById("cart-sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("active");
});

// ========== CHECKOUT WHATSAPP ==========
document.getElementById("checkout-btn").addEventListener("click", () => {
  if (!cart.length) return alert("Carrinho vazio");
  let msg = "🛍️ PEDIDO RAFAKITS25%0A";
  cart.forEach(i => msg += `${i.name} x${i.qty} = R$ ${(i.price * i.qty).toFixed(2)}%0A`);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  msg += `%0ATOTAL: R$ ${total.toFixed(2)}%0A%0APagamento via PIX (WhatsApp)`;
  window.open(`https://wa.me/553399953164?text=${msg}`, "_blank");
});

// ========== TABS COLEÇÕES ==========
function setupTabs() {
  const tabs = document.querySelectorAll(".collection-tab");
  const sections = document.querySelectorAll(".collection-section");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.collection;
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      sections.forEach(s => s.classList.remove("active-section"));
      document.getElementById(target).classList.add("active-section");
      currentCollection = target;
      renderProductsForCurrentCollection();
    });
  });
}

function buildTabs() {
  const container = document.getElementById("collections-tabs");
  const collections = ["all", "colecao-30-1", "oversized", "shorts-calcas"];
  const names = { all: "Todas", "colecao-30-1": "30.1 Premium", oversized: "Oversized", "shorts-calcas": "Shorts" };
  container.innerHTML = collections.map(c => `<button class="collection-tab ${c === 'all' ? 'active' : ''}" data-collection="${c}">${names[c]}</button>`).join("");
  setupTabs();
}

// ========== CATEGORIAS RÁPIDAS ==========
function buildCategories() {
  const cats = [
    { name: "30.1 Premium", img: "https://i.ibb.co/hFJ06ZP7/cbf.png", coll: "colecao-30-1" },
    { name: "Oversized", img: "https://i.ibb.co/27s6DrX0/over.png", coll: "oversized" },
    { name: "Shorts", img: "https://i.ibb.co/v65FdJ6r/rf.png", coll: "shorts-calcas" }
  ];
  const grid = document.getElementById("categories-grid");
  grid.innerHTML = cats.map(c => `
    <div class="category-card" data-collection="${c.coll}">
      <div class="category-image"><img src="${c.img}" onerror="this.src='https://placehold.co/100/111/ffd700'"></div>
      <div class="category-name">${c.name}</div>
    </div>
  `).join("");
  document.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", () => {
      const coll = card.dataset.collection;
      const tab = document.querySelector(`.collection-tab[data-collection="${coll}"]`);
      if (tab) tab.click();
    });
  });
}

function updateCategoryCounts() {
  const counts = {
    'colecao-30-1': products.filter(p => p.collection === 'colecao-30-1').length,
    'oversized': products.filter(p => p.collection === 'oversized').length,
    'shorts-calcas': products.filter(p => p.collection === 'shorts-calcas').length
  };
  Object.keys(counts).forEach(category => {
    const countElement = document.querySelector(`.category-card[data-collection="${category}"] .category-count`);
    if (countElement) countElement.textContent = `${counts[category]} produtos`;
  });
}

// ========== CARROSSEL PRINCIPAL (FADE) ==========
let currentSlide = 0;
const heroItems = document.querySelectorAll('.hero-item');
const heroDots = document.querySelectorAll('.hero-dot');
const heroNumbers = document.querySelector('.hero-numbers');
let autoInterval;

function updateHero(index) {
  heroItems.forEach(i => i.classList.remove('active'));
  heroItems[index].classList.add('active');
  heroDots.forEach((d, i) => d.classList.toggle('active', i === index));
  heroNumbers.textContent = String(index + 1).padStart(2, '0');
  currentSlide = index;
}

function nextHero() { updateHero((currentSlide + 1) % heroItems.length); }
function prevHero() { updateHero((currentSlide - 1 + heroItems.length) % heroItems.length); }

document.getElementById('hero-next').addEventListener('click', () => {
  clearInterval(autoInterval);
  nextHero();
  startAuto();
});
document.getElementById('hero-prev').addEventListener('click', () => {
  clearInterval(autoInterval);
  prevHero();
  startAuto();
});
heroDots.forEach((dot, i) => dot.addEventListener('click', () => {
  clearInterval(autoInterval);
  updateHero(i);
  startAuto();
}));

function startAuto() { autoInterval = setInterval(nextHero, 5000); }
startAuto();

// ========== ADICIONAR PRODUTOS DO CARROSSEL AO CARRINHO ==========
document.querySelectorAll('.add-to-cart-hero').forEach(btn => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.name;
    const price = parseFloat(btn.dataset.price);
    const img = btn.dataset.img;
    addToCart({ id: name.replace(/\s/g, ''), name, price, image: img });
  });
});

// ========== INICIALIZAÇÃO ==========
async function init() {
  buildTabs();
  buildCategories();
  await fetchProducts(); // carrega produtos do banco
  updateCartUI();
}
init();