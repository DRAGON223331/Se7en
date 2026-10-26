const productData = {
  zamalek: { name: 'White Line', subtitle: 'Red pinstripe edition', price: 1250, image: '/assets/products/zamalek-inspired.webp' },
  nile: { name: 'Nile Graphite', subtitle: 'Metallic charcoal concept', price: 1400, image: '/assets/products/nile-graphite-concept.webp' },
  ahly: { name: "Pharaoh's Legacy", subtitle: 'Black, red and antique gold', price: 1550, image: '/assets/products/al-ahly-pharaonic.webp' },
  barcelona: { name: 'Barcelona Night', subtitle: 'Stone grey / all black', price: 1350, image: '/assets/products/barcelona-night.webp' },
  argentina: { name: 'Celeste Stripe', subtitle: 'Argentina-inspired sky blue', price: 1300, image: '/assets/products/argentina-inspired.webp' }
};

const cart = new Map();
const bagCount = document.querySelector('#bag-count');
const drawerCount = document.querySelector('#drawer-count');
const subtotal = document.querySelector('#cart-subtotal');
const cartItems = document.querySelector('#cart-items');
const drawer = document.querySelector('#cart-drawer');
const backdrop = document.querySelector('#drawer-backdrop');
const toast = document.querySelector('#toast');
let toastTimer;

function formatPrice(value) {
  return `EGP ${value.toLocaleString('en-US')}`;
}

function itemCount() {
  return [...cart.values()].reduce((sum, item) => sum + item.qty, 0);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2500);
}

function addToBag(id) {
  const product = productData[id];
  if (!product) return;
  const current = cart.get(id);
  cart.set(id, { ...product, id, qty: current ? current.qty + 1 : 1 });
  updateCart();
  showToast(`${product.name} added to your bag`);
}

function changeQuantity(id, amount) {
  const item = cart.get(id);
  if (!item) return;
  item.qty += amount;
  if (item.qty <= 0) cart.delete(id);
  updateCart();
}

function updateCart() {
  const count = itemCount();
  bagCount.textContent = count;
  drawerCount.textContent = `(${count})`;
  const total = [...cart.values()].reduce((sum, item) => sum + item.price * item.qty, 0);
  subtotal.textContent = formatPrice(total);

  if (cart.size === 0) {
    cartItems.innerHTML = `<div class="empty-bag"><span class="empty-bag-mark">S7</span><p>Your bag is waiting.</p><span>Find the piece that moves you.</span><button type="button" class="button button-light" id="empty-shop">Explore collection ↗</button></div>`;
    document.querySelector('#empty-shop')?.addEventListener('click', () => {
      closeCart();
      document.querySelector('#collection').scrollIntoView({ behavior: 'smooth' });
    });
    return;
  }

  cartItems.innerHTML = [...cart.values()].map(item => `
    <div class="cart-row">
      <img src="${item.image}" alt="" />
      <div class="cart-row-main">
        <h3>${item.name}</h3><p>${item.subtitle}</p>
        <div class="quantity-controls">
          <button type="button" data-qty="-1" data-id="${item.id}" aria-label="Remove one ${item.name}">−</button>
          <span>${item.qty}</span>
          <button type="button" data-qty="1" data-id="${item.id}" aria-label="Add one ${item.name}">+</button>
        </div>
      </div>
      <div class="cart-row-price">${formatPrice(item.price * item.qty)}</div>
    </div>`).join('');
  cartItems.querySelectorAll('[data-qty]').forEach(button => {
    button.addEventListener('click', () => changeQuantity(button.dataset.id, Number(button.dataset.qty)));
  });
}

function openCart() {
  drawer.classList.add('is-open');
  backdrop.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  document.querySelector('#close-cart').focus();
}

function closeCart() {
  drawer.classList.remove('is-open');
  backdrop.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
}

document.querySelectorAll('[data-add]').forEach(button => {
  button.addEventListener('click', () => addToBag(button.dataset.add));
});
document.querySelector('#open-cart').addEventListener('click', openCart);
document.querySelector('#close-cart').addEventListener('click', closeCart);
backdrop.addEventListener('click', closeCart);
document.querySelector('#checkout-button').addEventListener('click', () => {
  showToast('Demo checkout only — connect a payment provider before launch.');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && drawer.classList.contains('is-open')) closeCart();
});

// Collection filters
const filterButtons = document.querySelectorAll('[data-filter]');
const productCards = document.querySelectorAll('.product-card');
filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filterButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    productCards.forEach(card => {
      const show = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('is-filtered-out', !show);
    });
  });
});

// Reveal sections as they enter view, with a graceful fallback.
const revealItems = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -20px 0px' });
  revealItems.forEach(item => observer.observe(item));
} else {
  revealItems.forEach(item => item.classList.add('is-visible'));
}

// Subtle pointer tilt on the product cutouts. Disabled on touch / reduced-motion devices.
const canTilt = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (canTilt) {
  document.querySelectorAll('.product-visual').forEach(visual => {
    visual.addEventListener('pointermove', event => {
      const rect = visual.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      visual.style.setProperty('--tilt-y', `${(px - 0.5) * 7}deg`);
      visual.style.setProperty('--tilt-x', `${(0.5 - py) * 6}deg`);
    });
    visual.addEventListener('pointerleave', () => {
      visual.style.setProperty('--tilt-y', '0deg');
      visual.style.setProperty('--tilt-x', '0deg');
    });
  });
}
