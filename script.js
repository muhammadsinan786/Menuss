const DATA_FILE = 'menu.json';
let DATA = null;
let CART = JSON.parse(localStorage.getItem('qr_cart') || '[]');
const langState = { current: 'en' };

function $(id){return document.getElementById(id)}

function formatCurrency(x){
  return (typeof x === 'number') ? '₹' + x : x;
}

function loadData(){
  fetch(DATA_FILE + '?t=' + Date.now())
    .then(r => r.json())
    .then(d => { DATA = d; initUI(); })
    .catch(e => { console.error('Failed to load menu.json', e); $('restaurant-name').textContent = 'Error loading menu'; });
}

function initUI(){
  document.documentElement.style.setProperty('--accent', DATA.themeColor || '#c58e48');
  $('restaurant-name').textContent = DATA.restaurantName || '';
  $('logo').src = DATA.logo || 'images/logo.svg';
  $('hero-text').textContent = DATA.hero || ('Welcome to ' + (DATA.restaurantName||''));
  $('info').innerHTML = `<strong>${DATA.restaurantName}</strong> • ${DATA.address || ''} • Last updated: ${DATA.lastUpdated || ''}`;
  updateOpenStatus();

  buildCategories();
  buildMenu();
  attachEvents();
  refreshCartUI();
  generateQRCode();
}

function updateOpenStatus(){
  const s = $('status');
  if(!DATA.openTime || !DATA.closeTime){ s.textContent = ''; return; }
  const now = new Date();
  const cur = now.getHours()*60 + now.getMinutes();
  const [oh,om] = DATA.openTime.split(':').map(Number);
  const [ch,cm] = DATA.closeTime.split(':').map(Number);
  const open = oh*60 + om, close = ch*60 + cm;
  s.textContent = (cur >= open && cur < close) ? 'Open now' : 'Closed';
}

function buildCategories(){
  const catWrap = $('category-buttons');
  catWrap.innerHTML = '';
  DATA.categories.forEach((cat, idx) => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.textContent = cat.name;
    btn.addEventListener('click', ()=> filterByCategory(cat.name));
    catWrap.appendChild(btn);
  });
  // Add 'All' button
  const allBtn = document.createElement('button');
  allBtn.className = 'cat-btn';
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', ()=> filterByCategory(null));
  catWrap.insertBefore(allBtn, catWrap.firstChild);
}

function buildMenu(filterText=''){
  const menu = $('menu');
  menu.innerHTML = '';
  const q = filterText.trim().toLowerCase();
  DATA.categories.forEach(cat => {
    const items = cat.items.filter(it => {
      if(!q) return true;
      return (it.name + ' ' + (it.desc||'')).toLowerCase().includes(q);
    });
    items.forEach(it => {
      const card = document.createElement('div'); card.className='card';
      const img = document.createElement('img'); img.src = it.image || 'images/menu-items/placeholder.svg';
      const info = document.createElement('div'); info.className='info';
      const title = document.createElement('div'); title.className='item-title';
      const nameSpan = document.createElement('div'); nameSpan.textContent = it.name;
      const priceSpan = document.createElement('div'); priceSpan.textContent = it.price;
      title.appendChild(nameSpan); title.appendChild(priceSpan);
      const desc = document.createElement('div'); desc.className='item-desc'; desc.textContent = it.desc || '';
      info.appendChild(title); info.appendChild(desc);
      const actions = document.createElement('div'); actions.className='actions';
      const addBtn = document.createElement('button'); addBtn.textContent = 'Add';
      addBtn.onclick = ()=> addToCart(it);
      if(it.badge){
        const badge = document.createElement('div'); badge.className='badge'; badge.textContent = it.badge;
        title.appendChild(badge);
      }
      actions.appendChild(addBtn);
      card.appendChild(img); card.appendChild(info); card.appendChild(actions);
      menu.appendChild(card);
    });
  });
}

function filterByCategory(name){
  if(!name){ buildMenu($('search').value); return; }
  const all = [];
  DATA.categories.forEach(cat => {
    if(cat.name === name) cat.items.forEach(it=> all.push(it));
  });
  const menu = $('menu'); menu.innerHTML = '';
  all.forEach(it => {
    const card = document.createElement('div'); card.className='card';
    const img = document.createElement('img'); img.src = it.image || 'images/menu-items/placeholder.svg';
    const info = document.createElement('div'); info.className='info';
    const title = document.createElement('div'); title.className='item-title';
    const nameSpan = document.createElement('div'); nameSpan.textContent = it.name;
    const priceSpan = document.createElement('div'); priceSpan.textContent = it.price;
    title.appendChild(nameSpan); title.appendChild(priceSpan);
    const desc = document.createElement('div'); desc.className='item-desc'; desc.textContent = it.desc || '';
    info.appendChild(title); info.appendChild(desc);
    const actions = document.createElement('div'); actions.className='actions';
    const addBtn = document.createElement('button'); addBtn.textContent = 'Add';
    addBtn.onclick = ()=> addToCart(it);
    actions.appendChild(addBtn);
    card.appendChild(img); card.appendChild(info); card.appendChild(actions);
    menu.appendChild(card);
  });
}

function attachEvents(){
  $('search').addEventListener('input', (e)=> buildMenu(e.target.value));
  $('shareBtn').addEventListener('click', shareMenu);
  $('qrBtn').addEventListener('click', showQR);
  $('langBtn').addEventListener('click', toggleLang);
  $('viewCart').addEventListener('click', openCartModal);
  $('modalClose').addEventListener('click', closeModal);
  $('whatsappOrder').addEventListener('click', sendWhatsAppOrder);
  window.addEventListener('beforeinstallprompt', (e)=> { /* optional for PWA */ });
  // register service worker
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW reg failed', e));
  }
}

function addToCart(item){
  const existing = CART.find(c => c.name === item.name);
  if(existing) existing.qty += 1;
  else CART.push({ name: item.name, price: item.price, qty: 1 });
  localStorage.setItem('qr_cart', JSON.stringify(CART));
  refreshCartUI();
}

function refreshCartUI(){
  const bar = $('cartBar');
  if(CART.length === 0){ bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const totalItems = CART.reduce((s,i)=> s + i.qty, 0);
  const totalPrice = CART.reduce((s,i)=> s + (Number(String(i.price).replace(/[^0-9.-]+/g,'')) * i.qty), 0);
  $('cartSummary').textContent = `${totalItems} items • ₹${totalPrice}`;
}

function openCartModal(){
  const body = $('modalBody'); body.innerHTML = '';
  if(CART.length === 0){ body.innerHTML = '<p>Cart is empty</p>'; $('modal').classList.remove('hidden'); return; }
  const list = document.createElement('div');
  CART.forEach((c, idx) => {
    const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.margin='8px 0';
    row.innerHTML = `<div>${c.name} x ${c.qty}</div><div>₹${(Number(String(c.price).replace(/[^0-9.-]+/g,'')) * c.qty)}</div>`;
    list.appendChild(row);
  });
  const checkout = document.createElement('div'); checkout.style.marginTop='12px';
  const clearBtn = document.createElement('button'); clearBtn.textContent='Clear'; clearBtn.onclick = ()=>{ CART=[]; localStorage.removeItem('qr_cart'); refreshCartUI(); closeModal(); };
  const whatsappBtn = document.createElement('button'); whatsappBtn.textContent='Order on WhatsApp'; whatsappBtn.onclick = sendWhatsAppOrder;
  checkout.appendChild(clearBtn); checkout.appendChild(whatsappBtn);
  body.appendChild(list); body.appendChild(checkout);
  $('modal').classList.remove('hidden');
}

function closeModal(){ $('modal').classList.add('hidden'); }

function sendWhatsAppOrder(){
  if(!DATA.contact || !DATA.contact.whatsapp){
    alert('WhatsApp contact not configured.');
    return;
  }
  if(CART.length === 0){ alert('Cart empty'); return; }
  const lines = CART.map(c => `${c.name} x ${c.qty}`).join('%0A');
  const msg = encodeURIComponent(`Order from ${DATA.restaurantName}%0A%0A`)+ lines + '%0A%0A' + encodeURIComponent('Please confirm. Thanks!');
  const url = DATA.contact.whatsapp.includes('wa.me') ? DATA.contact.whatsapp + '&text=' + lines : (DATA.contact.whatsapp + '?text=' + msg);
  window.open(url, '_blank');
}

function shareMenu(){
  const url = window.location.href;
  if(navigator.share){
    navigator.share({ title: DATA.restaurantName, text: DATA.hero || '', url }).catch(()=>{});
  } else {
    prompt('Copy link to share:', url);
  }
}

function generateQRCode(){
  const canvas = document.createElement('canvas');
  QRCode.toCanvas(canvas, window.location.href, function(err){
    if(err){ console.error(err); return; }
    // show in modal
    const btn = $('qrBtn');
    btn.onclick = ()=> {
      const mb = $('modalBody'); mb.innerHTML = '<h3>Scan QR</h3>'; mb.appendChild(canvas); $('modal').classList.remove('hidden');
    }
  });
}

function toggleLang(){
  // placeholder - language files could be loaded from /lang/en.json and ml.json
  if(langState.current === 'en'){ langState.current = 'ml'; alert('Switched to Malayalam (placeholder)'); }
  else { langState.current = 'en'; alert('Switched to English (placeholder)'); }
}

loadData();
