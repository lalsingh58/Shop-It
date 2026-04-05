let cart = JSON.parse(localStorage.getItem("cart")) || [];

function displayCart() {
  const container = document.getElementById("cart-items");
  const totalEl = document.getElementById("total");

  container.innerHTML = "";
  let total = 0;

  if (cart.length === 0) {
    container.innerHTML = "<p>Your cart is empty 😢</p>";
    totalEl.innerText = 0;
    return;
  }

  cart.forEach((item, index) => {
    total += item.price * item.quantity;

    container.innerHTML += `
      <div class="cart-item">
        <div class="cart-info">
          <img src="${item.image}" />
          <div>
            <h4>${item.name}</h4>
            <p>₹${item.price}</p>
          </div>
        </div>

        <div class="cart-actions">
          <button onclick="changeQty(${index}, -1)">-</button>
          ${item.quantity}
          <button onclick="changeQty(${index}, 1)">+</button>
          <button onclick="removeItem(${index})">❌</button>
        </div>
      </div>
    `;
  });

  totalEl.innerText = total;
  localStorage.setItem("cart", JSON.stringify(cart));
}

function changeQty(index, change) {
  cart[index].quantity += change;

  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }

  displayCart();
}

function removeItem(index) {
  cart.splice(index, 1);
  displayCart();
}

displayCart();
