import { products, accessories, havellsAccessories, services } from './products.js';

const formatPrice = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(amount);

const productGrid = document.querySelector('#product-grid');
const brandButtons = [...document.querySelectorAll('[data-brand]')];
const searchInput = document.querySelector('#product-search');
let activeBrand = 'all';

document.querySelector('#year').textContent = new Date().getFullYear();
document.querySelector('[data-count="all"]').textContent = products.length;
for (const brand of ['KENT', 'Havells', 'Livpure']) {
  document.querySelector(`[data-count="${brand}"]`).textContent = products.filter((product) => product.brand === brand).length;
}

function productArtwork(product, className = '') {
  if (product.image) {
    return `<img src="${product.image}" alt="${product.brand} ${product.name} water purifier" loading="lazy" decoding="async" />`;
  }
  return `<div class="product-placeholder ${className}" aria-hidden="true"><div class="placeholder-purifier"><span class="placeholder-logo">${product.brand}</span></div></div>`;
}

function renderProductCard(product) {
  const offer = Math.round(product.mrp * 0.8);
  const tags = product.tags.slice(0, 3).map((tag) => `<span>${tag}</span>`).join('');
  return `<article class="product-card">
    <button class="product-card-open" type="button" data-product-id="${product.id}" aria-label="View ${product.brand} ${product.name} details">
      <div class="product-card-media">
        ${productArtwork(product)}
        <span class="product-card-brand">${product.brand}</span>
        <span class="discount-label">20% OFF</span>
      </div>
      <div class="product-card-body">
        <h3>${product.name}</h3>
        <p>${product.short}</p>
        <div class="product-tags">${tags}</div>
        <div class="card-price"><span><small>Brochure MRP</small><s>${formatPrice(product.mrp)}</s></span><span><small>Offer price</small><strong>${formatPrice(offer)}</strong></span></div>
        <span class="card-enquire">View details &amp; enquire <span aria-hidden="true">↗</span></span>
      </div>
    </button>
  </article>`;
}

function renderProducts() {
  const term = searchInput.value.trim().toLowerCase();
  const visible = products.filter((product) => {
    const brandMatches = activeBrand === 'all' || product.brand === activeBrand;
    const searchable = [product.brand, product.name, product.short, ...product.tags].join(' ').toLowerCase();
    return brandMatches && searchable.includes(term);
  });
  document.querySelector('#catalog-count').textContent = `${visible.length} ${visible.length === 1 ? 'purifier' : 'purifier models'}`;
  productGrid.innerHTML = visible.length
    ? visible.map(renderProductCard).join('')
    : '<p class="empty-state">No models match that search. Try a brand name or purification type.</p>';
}

renderProducts();

brandButtons.forEach((button) => button.addEventListener('click', () => {
  activeBrand = button.dataset.brand;
  brandButtons.forEach((item) => {
    const active = item === button;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  renderProducts();
}));
searchInput.addEventListener('input', renderProducts);

function openProductDialog(product, group = 'purifier') {
  const dialog = document.querySelector('#product-dialog');
  const imageWrap = dialog.querySelector('.dialog-image-wrap');
  imageWrap.querySelector('img')?.remove();
  imageWrap.querySelector('.product-placeholder')?.remove();
  if (product.image) {
    const image = document.createElement('img');
    image.id = 'dialog-image';
    image.src = product.image;
    image.alt = `${product.brand || 'RO'} ${product.name}`;
    imageWrap.prepend(image);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'product-placeholder';
    placeholder.innerHTML = `<div class="placeholder-purifier"><span class="placeholder-logo">${product.brand || 'RO'}</span></div>`;
    imageWrap.prepend(placeholder);
  }
  dialog.querySelector('.dialog-badge').textContent = product.mrp ? '20% OFF' : 'ASK FOR A QUOTE';
  dialog.querySelector('.dialog-badge').hidden = !product.mrp;
  dialog.querySelector('#dialog-brand').textContent = product.brand || 'RO Accessories';
  dialog.querySelector('#dialog-title').textContent = product.name;
  dialog.querySelector('#dialog-short').textContent = product.short || product.description || '';
  const details = product.details || [product.description];
  dialog.querySelector('#dialog-specs').innerHTML = details.filter(Boolean).map((item) => `<div>${item}</div>`).join('');
  const mrpText = product.mrp ? formatPrice(product.mrp) : 'Enquire for price';
  const offerText = product.mrp ? formatPrice(Math.round(product.mrp * 0.8)) : 'Ask our team';
  dialog.querySelector('#dialog-mrp').textContent = mrpText;
  dialog.querySelector('#dialog-offer').textContent = offerText;
  dialog.querySelector('.dialog-price span:last-child small').textContent = product.mrp ? '20% enquiry offer' : 'Current price';
  dialog.dataset.productId = product.id;
  dialog.dataset.group = group;
  dialog.showModal();
  document.body.classList.add('modal-open');
}

document.querySelector('#product-grid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-product-id]');
  if (!button) return;
  const product = products.find((item) => item.id === button.dataset.productId);
  if (product) openProductDialog(product);
});

function renderAccessoryCard(item, source) {
  const price = item.mrp ? `<small>Brochure MRP · ${formatPrice(item.mrp)} · 20% off</small>` : '<small>Ask for today’s price</small>';
  const product = {
    ...item,
    brand: item.brand || source,
    details: item.details || [item.description],
    short: item.description,
  };
  return `<button class="accessory-card" type="button" data-accessory-id="${item.id}" data-source="${source}">
    <span class="accessory-symbol" aria-hidden="true">${item.icon}</span>
    <div class="accessory-card-copy"><h3>${item.name}</h3><p>${item.description}</p>${price}</div>
  </button>`;
}

const accessoryGrid = document.querySelector('#accessory-grid');
accessoryGrid.innerHTML = [
  ...accessories.map((item) => renderAccessoryCard(item, 'RO Accessories')),
  ...havellsAccessories.map((item) => renderAccessoryCard({ ...item, brand: 'Havells' }, 'Havells')),
].join('');

accessoryGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-accessory-id]');
  if (!button) return;
  const item = [...accessories, ...havellsAccessories].find((part) => part.id === button.dataset.accessoryId);
  if (item) openProductDialog({ ...item, brand: button.dataset.source === 'Havells' ? 'Havells' : 'RO Accessories', details: [item.description], short: item.description }, 'accessory');
});

document.querySelector('#service-list').innerHTML = services.map((service, index) => `<div class="service-row">
  <span class="service-row-number">0${index + 1}</span>
  <span><h3>${service.name}</h3><p>${service.note}</p></span>
  <button type="button" aria-label="Enquire about ${service.name}" data-open-enquiry data-request="${service.name}">↗</button>
</div>`).join('');

const dialog = document.querySelector('#product-dialog');
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function chooseRequest(request) {
  const select = document.querySelector('#request-type');
  const option = [...select.options].find((item) => item.value === request || item.textContent === request);
  if (option) select.value = option.value;
}

function goToEnquiry(request, productName = '') {
  if (request) chooseRequest(request);
  if (productName) {
    const details = document.querySelector('#enquiry-details');
    details.value = `Product: ${productName}`;
  }
  document.querySelector('#contact').scrollIntoView({ behavior: 'smooth' });
  window.setTimeout(() => document.querySelector('#enquiry-form input[name="name"]').focus({ preventScroll: true }), 450);
}

document.body.addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-enquiry]');
  if (!button) return;
  goToEnquiry(button.dataset.request || 'Product enquiry');
});

document.querySelector('#dialog-enquire').addEventListener('click', () => {
  const name = document.querySelector('#dialog-title').textContent;
  dialog.close();
  goToEnquiry(dialog.dataset.group === 'accessory' ? 'RO accessories & spares' : 'Product enquiry', name);
});

const menuButton = document.querySelector('#menu-toggle');
const siteNav = document.querySelector('#site-nav');
menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  menuButton.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  siteNav.classList.toggle('is-open', !expanded);
});
siteNav.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
  siteNav.classList.remove('is-open');
});

// Store status is computed from the clock in India, not the visitor's device timezone.
const istFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function refreshStoreStatus() {
  const parts = Object.fromEntries(istFormatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const minuteOfDay = Number(parts.hour) * 60 + Number(parts.minute);
  const isOpen = parts.weekday !== 'Sunday' && minuteOfDay >= 9 * 60 && minuteOfDay < 20 * 60;
  const openingHint = parts.weekday === 'Sunday' ? 'Opens Monday · 9 AM IST' : minuteOfDay < 9 * 60 ? 'Opens today · 9 AM IST' : parts.weekday === 'Saturday' ? 'Opens Monday · 9 AM IST' : 'Opens tomorrow · 9 AM IST';
  document.querySelectorAll('[data-store-status]').forEach((pill) => {
    pill.classList.toggle('is-open', isOpen);
    pill.classList.toggle('is-closed', !isOpen);
    pill.querySelector('.status-copy').textContent = isOpen ? 'Open now · until 8 PM IST' : `Closed · ${openingHint}`;
    pill.setAttribute('aria-label', isOpen ? 'Store is open now. Closes at 8 PM India Standard Time.' : `Store is closed now. ${openingHint}.`);
  });
}
refreshStoreStatus();
window.setInterval(refreshStoreStatus, 60_000);

const whatsappNumber = '919743928204';
function directWhatsAppUrl(enquiry) {
  const message = [
    'Hello Shree Enterprises, I would like help with a water purifier enquiry.',
    `Name: ${enquiry.name}`,
    `Phone: ${enquiry.phone}`,
    `Address: ${enquiry.address}`,
    `Service required: ${enquiry.request}`,
    enquiry.details ? `Details: ${enquiry.details}` : '',
  ].filter(Boolean).join('\n');
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

const enquiryForm = document.querySelector('#enquiry-form');
const submitButton = document.querySelector('#submit-enquiry');
const formStatus = document.querySelector('#form-status');
enquiryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!enquiryForm.reportValidity()) return;
  const form = new FormData(enquiryForm);
  const enquiry = Object.fromEntries(form.entries());
  enquiry.details = enquiry.details.trim();
  const phoneField = enquiryForm.elements.phone;
  const phoneDigits = String(enquiry.phone).replace(/\D/g, '');
  if (phoneDigits.length < 8 || phoneDigits.length > 15) {
    phoneField.setCustomValidity('Enter a phone number with 8 to 15 digits.');
    phoneField.reportValidity();
    phoneField.setCustomValidity('');
    return;
  }
  enquiry.name = enquiry.name.trim();
  enquiry.address = enquiry.address.trim();
  const originalLabel = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML = 'Saving your enquiry…';
  formStatus.classList.remove('is-error');
  formStatus.textContent = '';
  try {
    const response = await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enquiry),
    });
    if (!response.ok) throw new Error('The online enquiry register is unavailable.');
    const result = await response.json();
    formStatus.textContent = 'Your details are saved. WhatsApp is opening with your message ready to send.';
    window.location.assign(result.whatsappUrl || directWhatsAppUrl(enquiry));
  } catch (error) {
    formStatus.classList.add('is-error');
    formStatus.textContent = 'We could not save this enquiry to the online register. WhatsApp will open; please send the message there, or call us.';
    window.location.assign(directWhatsAppUrl(enquiry));
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalLabel;
  }
});

// Scroll-linked hero image sequence. A 4×6 sheet holds 24 frames; only nearby
// sheets are decoded, keeping the animation crisp without filling device memory.
const heroSection = document.querySelector('.hero-scroll');
const heroCanvas = document.querySelector('#hero-canvas');
const heroContext = heroCanvas.getContext('2d', { alpha: false, desynchronized: true });
const sheetCache = new Map();
const frameCount = 240;
let desiredFrame = 0;
let canvasDpr = 1;
let scrollFramePending = false;

function resizeHeroCanvas() {
  const rect = heroCanvas.getBoundingClientRect();
  canvasDpr = Math.min(window.devicePixelRatio || 1, 1.5);
  heroCanvas.width = Math.max(1, Math.round(rect.width * canvasDpr));
  heroCanvas.height = Math.max(1, Math.round(rect.height * canvasDpr));
  drawHeroFrame(desiredFrame);
}

function loadHeroSheet(sheetNumber) {
  if (sheetNumber < 0 || sheetNumber >= 10) return;
  if (sheetCache.has(sheetNumber)) return;
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    sheetCache.set(sheetNumber, image);
    while (sheetCache.size > 3) {
      const firstKey = sheetCache.keys().next().value;
      if (firstKey === Math.floor(desiredFrame / 24)) break;
      sheetCache.delete(firstKey);
    }
    if (Math.floor(desiredFrame / 24) === sheetNumber) drawHeroFrame(desiredFrame);
    if (sheetNumber < 9) loadHeroSheet(sheetNumber + 1);
  };
  image.onerror = () => {
    sheetCache.delete(sheetNumber);
    window.setTimeout(() => loadHeroSheet(sheetNumber), 1500);
  };
  sheetCache.set(sheetNumber, image);
  image.src = `assets/hero-frames/hero-${String(sheetNumber + 1).padStart(2, '0')}.webp`;
}

function drawHeroFrame(frame) {
  if (!heroCanvas.width || !heroCanvas.height) return;
  const sheetNumber = Math.floor(frame / 24);
  let sheet = sheetCache.get(sheetNumber);
  if (!sheet || !sheet.complete || !sheet.naturalWidth) {
    loadHeroSheet(sheetNumber);
    return;
  }
  const localFrame = frame % 24;
  const sourceX = (localFrame % 4) * 1280;
  const sourceY = Math.floor(localFrame / 4) * 720;
  const scale = Math.max(heroCanvas.width / 1280, heroCanvas.height / 720);
  const width = 1280 * scale;
  const height = 720 * scale;
  const desktopShift = heroCanvas.width > 900 ? heroCanvas.width * 0.105 : 0;
  const x = (heroCanvas.width - width) / 2 + desktopShift;
  const y = (heroCanvas.height - height) / 2;
  heroContext.clearRect(0, 0, heroCanvas.width, heroCanvas.height);
  heroContext.drawImage(sheet, sourceX, sourceY, 1280, 720, x, y, width, height);
  const counter = document.querySelector('.hero-side-note > span:first-child');
  counter.textContent = `${String(frame + 1).padStart(3, '0')} / 240`;
}

function updateHeroFrameFromScroll() {
  if (scrollFramePending) return;
  scrollFramePending = true;
  requestAnimationFrame(() => {
    const sectionTop = heroSection.offsetTop;
    const distance = Math.max(1, heroSection.offsetHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, (window.scrollY - sectionTop) / distance));
    desiredFrame = Math.round(progress * (frameCount - 1));
    drawHeroFrame(desiredFrame);
    scrollFramePending = false;
  });
}

resizeHeroCanvas();
loadHeroSheet(0);
loadHeroSheet(1);
window.addEventListener('resize', resizeHeroCanvas, { passive: true });
window.addEventListener('scroll', updateHeroFrameFromScroll, { passive: true });

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  heroSection.style.height = '100svh';
  window.removeEventListener('scroll', updateHeroFrameFromScroll);
}
