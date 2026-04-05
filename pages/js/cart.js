let cart = JSON.parse(localStorage.getItem("cart")) || [];

const cartContainer = document.getElementById("cart-items");
const totalEl = document.getElementById("total");

// ✅ DO NOT MODIFY PATH
function normalizeModelPath(path) {
  return path;
}

// SAVE
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

// DISPLAY
function displayCart() {
  cartContainer.innerHTML = "";

  if (cart.length === 0) {
    cartContainer.innerHTML = `<h2 class="empty">Your cart is empty 😢</h2>`;
    totalEl.innerText = "0";
    return;
  }

  let total = 0;

  cart.forEach((item, index) => {
    total += item.price * item.quantity;

    const div = document.createElement("div");
    div.className = "cart-item";

    div.innerHTML = `
      <div class="cart-info">
        <model-viewer 
          src="${normalizeModelPath(item.model)}"
          auto-rotate
          camera-controls>
        </model-viewer>

        <div>
          <h4>${item.name}</h4>
          <p>₹${item.price}</p>
        </div>
      </div>

      <div class="cart-actions">
        <button onclick="changeQty(${index}, -1)">−</button>
        <span>${item.quantity}</span>
        <button onclick="changeQty(${index}, 1)">+</button>
        <button class="remove" onclick="removeItem(${index})">❌</button>
      </div>
    `;

    cartContainer.appendChild(div);
  });

  totalEl.innerText = total;
  saveCart();
}

// CHANGE QTY
function changeQty(index, change) {
  cart[index].quantity += change;

  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }

  saveCart();
  displayCart();
}

// REMOVE
function removeItem(index) {
  cart.splice(index, 1);
  saveCart();
  displayCart();
}

// CHECKOUT
document.getElementById("checkoutBtn").onclick = () => {
  if (cart.length === 0) {
    alert("Cart is empty!");
    return;
  }

  alert("✅ Order placed successfully!");

  cart = [];
  saveCart();
  displayCart();
};

// INIT
displayCart();
