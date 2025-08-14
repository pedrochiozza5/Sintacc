// Sintacc/cart.js

const WHATSAPP_NUMBER = "5492241548005"; // Reemplaza con tu número de WhatsApp (código de país + número)

const cartEl = {
  cartButton: document.getElementById('cart-button'),
  cartCount: document.getElementById('cart-count'),
  cartModal: document.getElementById('cart-modal'),
  modalClose: document.querySelector('#cart-modal .modal-close'),
  cartItemsContainer: document.getElementById('cart-items'),
  cartTotal: document.getElementById('cart-total'),
  checkoutButton: document.getElementById('checkout-button'),
  customerInfoForm: document.getElementById('customer-info-form'),
  customerName: document.getElementById('customer-name'),
  customerEmail: document.getElementById('customer-email'),
  customerDNI: document.getElementById('customer-dni'),
  backToCartButton: document.getElementById('back-to-cart-button')
};

let cart = []; // Array para almacenar los productos en el carrito

// Función para guardar el carrito en localStorage
function saveCart() {
  localStorage.setItem('shoppingCart', JSON.stringify(cart));
  updateCartCount();
}

// Función para cargar el carrito desde localStorage
function loadCart() {
  const storedCart = localStorage.getItem('shoppingCart');
  if (storedCart) {
    cart = JSON.parse(storedCart);
  }
  updateCartCount();
}

// Actualiza el contador de ítems en el botón del carrito
function updateCartCount() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartEl.cartCount.textContent = totalItems;
  cartEl.cartCount.style.display = totalItems > 0 ? 'inline-block' : 'none';
}

// Abre el modal del carrito
function openCartModal() {
  renderCartItems();
  cartEl.cartModal.setAttribute('aria-hidden', 'false');
  // Asegurarse de que el formulario de cliente esté oculto al abrir el carrito
  cartEl.customerInfoForm.style.display = 'none';
  cartEl.checkoutButton.textContent = 'Terminar Pedido';
  cartEl.backToCartButton.style.display = 'none';
}

// Cierra el modal del carrito
function closeCartModal() {
  cartEl.cartModal.setAttribute('aria-hidden', 'true');
}

// Agrega un producto al carrito
function addToCart(product) {
  const existingItem = cart.find(item => item.codigo === product.codigo);
  if (existingItem) {
    existingItem.quantity++;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  saveCart();
  renderCartItems(); // Actualiza la vista del carrito si está abierto
}

// Elimina un producto del carrito
function removeFromCart(productCode) {
  cart = cart.filter(item => item.codigo !== productCode);
  saveCart();
  renderCartItems();
}

// Cambia la cantidad de un producto en el carrito
function changeQuantity(productCode, delta) {
  const item = cart.find(item => item.codigo === productCode);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) {
      removeFromCart(productCode);
    } else {
      saveCart();
      renderCartItems();
    }
  }
}

// Renderiza los ítems en el modal del carrito
function renderCartItems() {
  if (cart.length === 0) {
    cartEl.cartItemsContainer.innerHTML = '<p class="empty-cart-message">El carrito está vacío.</p>';
    cartEl.cartTotal.textContent = '$ 0.00';
    cartEl.checkoutButton.disabled = true; // Deshabilita el botón si el carrito está vacío
    return;
  }

  cartEl.checkoutButton.disabled = false; // Habilita el botón si hay ítems

  let total = 0;
  const itemsHtml = cart.map(item => {
    const itemTotal = item.precio * item.quantity;
    total += itemTotal;
    return `
      <div class="cart-item">
        
        <div class="item-details">
          <div class="item-title">${escapeHtml(item.producto)}</div>
          <div class="item-meta">Código: ${escapeHtml(item.codigo)}</div>
          <div class="item-price">$ ${Number(item.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })} c/u</div>
        </div>
        <div class="item-quantity-controls">
          <button class="quantity-btn" data-code="${escapeHtml(item.codigo)}" data-delta="-1">-</button>
          <span class="quantity">${item.quantity}</span>
          <button class="quantity-btn" data-code="${escapeHtml(item.codigo)}" data-delta="1">+</button>
        </div>
        <div class="item-subtotal">$ ${Number(itemTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        <button class="remove-item-btn" data-code="${escapeHtml(item.codigo)}" aria-label="Eliminar ${escapeHtml(item.producto)}">×</button>
      </div>
    `;
  }).join('');

  cartEl.cartItemsContainer.innerHTML = itemsHtml;
  cartEl.cartTotal.textContent = `$ ${Number(total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  // Añadir event listeners a los botones de cantidad y eliminar
  cartEl.cartItemsContainer.querySelectorAll('.quantity-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const code = e.target.dataset.code;
      const delta = Number(e.target.dataset.delta);
      changeQuantity(code, delta);
    });
  });

  cartEl.cartItemsContainer.querySelectorAll('.remove-item-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const code = e.target.dataset.code;
      removeFromCart(code);
    });
  });
}

// Maneja el proceso de checkout
function handleCheckout() {
  if (cartEl.customerInfoForm.style.display === 'none') {
    // Primera etapa: mostrar formulario de datos
    cartEl.customerInfoForm.style.display = 'block';
    cartEl.cartItemsContainer.style.display = 'none';
    cartEl.cartTotal.parentElement.style.display = 'none'; // Ocultar el total
    cartEl.checkoutButton.textContent = 'Enviar Pedido por WhatsApp';
    cartEl.backToCartButton.style.display = 'inline-block';
  } else {
    // Segunda etapa: validar datos y enviar a WhatsApp
    const name = cartEl.customerName.value.trim();
    const email = cartEl.customerEmail.value.trim();
    const dni = cartEl.customerDNI.value.trim();

    if (!name || !email || !dni) {
      alert('Por favor, completa todos tus datos para continuar.');
      return;
    }

    sendOrderToWhatsApp(name, email, dni);
  }
}

// Vuelve a la vista del carrito desde el formulario de datos
function backToCartView() {
  cartEl.customerInfoForm.style.display = 'none';
  cartEl.cartItemsContainer.style.display = 'block';
  cartEl.cartTotal.parentElement.style.display = 'block'; // Mostrar el total
  cartEl.checkoutButton.textContent = 'Terminar Pedido';
  cartEl.backToCartButton.style.display = 'none';
}

// Genera el mensaje de WhatsApp y redirige
function sendOrderToWhatsApp(name, email, dni) {
  let message = `¡Hola! Me gustaría hacer un pedido.\n\n`;
  message += `*Datos del Cliente:*\n`;
  message += `Nombre: ${name}\n`;
  message += `Correo: ${email}\n`;
  message += `DNI: ${dni}\n\n`;
  message += `*Detalle del Pedido:*\n`;

  let totalOrderPrice = 0;
  cart.forEach(item => {
    const itemTotalPrice = item.precio * item.quantity;
    totalOrderPrice += itemTotalPrice;
    message += `- ${item.producto} (Código: ${item.codigo}) x ${item.quantity} unidades. Precio unitario: $${Number(item.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}. Subtotal: $${Number(itemTotalPrice).toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n`;
  });

  message += `\n*Total del Pedido: $${Number(totalOrderPrice).toLocaleString('es-AR', { minimumFractionDigits: 2 })}*\n\n`;
  message += `¡Gracias!`;

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

  window.open(whatsappUrl, '_blank');

  // Opcional: Limpiar el carrito después de enviar el pedido
  cart = [];
  saveCart();
  closeCartModal();
}

// Función auxiliar para escapar HTML (ya presente en script.js, pero la duplicamos para asegurar independencia)
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }


// Event Listeners
cartEl.cartButton.addEventListener('click', openCartModal);
cartEl.modalClose.addEventListener('click', closeCartModal);
cartEl.cartModal.addEventListener('click', (e) => {
  if (e.target === cartEl.cartModal) closeCartModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && cartEl.cartModal.getAttribute('aria-hidden') === 'false') {
    closeCartModal();
  }
});

cartEl.checkoutButton.addEventListener('click', handleCheckout);
cartEl.backToCartButton.addEventListener('click', backToCartView);

// Integración con el catálogo existente (modificar script.js)
// Necesitamos una forma de que los productos del catálogo puedan ser añadidos al carrito.
// Esto se hará modificando la función renderPage en script.js.

// Cargar el carrito al iniciar
loadCart();

// Exportar addToCart para que script.js pueda usarla
window.addToCart = addToCart;
