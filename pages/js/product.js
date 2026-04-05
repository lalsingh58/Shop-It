const products = [
  // 👓 Glasses (5)
  {
    name: "Classic Glasses",
    price: 499,
    model: "../assets/models/glasses/g1.glb",
    type: "glasses",
  },
  {
    name: "Round Glasses",
    price: 599,
    model: "../assets/models/glasses/g2.glb",
    type: "glasses",
  },
  {
    name: "Black Frame",
    price: 699,
    model: "../assets/models/glasses/g3.glb",
    type: "glasses",
  },
  {
    name: "Stylish Glasses",
    price: 799,
    model: "../assets/models/glasses/g4.glb",
    type: "glasses",
  },
  {
    name: "Cool Glasses",
    price: 899,
    model: "../assets/models/glasses/g5.glb",
    type: "glasses",
  },

  // 🧢 Caps (5)
  {
    name: "Street Cap",
    price: 299,
    model: "../assets/models/caps/c1.glb",
    type: "cap",
  },
  {
    name: "Black Cap",
    price: 349,
    model: "../assets/models/caps/c2.glb",
    type: "cap",
  },
  {
    name: "Sports Cap",
    price: 399,
    model: "../assets/models/caps/c3.glb",
    type: "cap",
  },
  {
    name: "Snapback Cap",
    price: 449,
    model: "../assets/models/caps/c4.glb",
    type: "cap",
  },
  {
    name: "Cool Cap",
    price: 499,
    model: "../assets/models/caps/c5.glb",
    type: "cap",
  },

  // 💇 Wigs (5)
  {
    name: "Curly Wig",
    price: 999,
    model: "../assets/models/wigs/w1.glb",
    type: "wig",
  },
  {
    name: "Straight Wig",
    price: 1099,
    model: "../assets/models/wigs/w2.glb",
    type: "wig",
  },
  {
    name: "Short Wig",
    price: 1199,
    model: "../assets/models/wigs/w3.glb",
    type: "wig",
  },
  {
    name: "Long Wig",
    price: 1299,
    model: "../assets/models/wigs/w4.glb",
    type: "wig",
  },
  {
    name: "Fashion Wig",
    price: 1399,
    model: "../assets/models/wigs/w5.glb",
    type: "wig",
  },

  // 💍 Earrings (5)
  {
    name: "Gold Earrings",
    price: 199,
    model: "../assets/models/earrings/e1.glb",
    type: "earring",
  },
  {
    name: "Silver Earrings",
    price: 249,
    model: "../assets/models/earrings/e2.glb",
    type: "earring",
  },
  {
    name: "Stud Earrings",
    price: 299,
    model: "../assets/models/earrings/e3.glb",
    type: "earring",
  },
  {
    name: "Hoop Earrings",
    price: 349,
    model: "../assets/models/earrings/e4.glb",
    type: "earring",
  },
  {
    name: "Fancy Earrings",
    price: 399,
    model: "../assets/models/earrings/e5.glb",
    type: "earring",
  },
];

const container = document.getElementById("product-container");

const categories = {
  glasses: "👓 Glasses",
  cap: "🧢 Caps",
  wig: "💇 Wigs",
  earring: "💍 Earrings",
};

// 🛒 CART FUNCTION
function addToCart(product) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  const existing = cart.find((item) => item.name === product.name);

  if (existing) existing.quantity++;
  else {
    cart.push({
      name: product.name,
      price: product.price,
      quantity: 1,
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  alert(product.name + " added 🛒");
}

// 🔥 GROUP PRODUCTS
const grouped = {};
products.forEach((p) => {
  if (!grouped[p.type]) grouped[p.type] = [];
  grouped[p.type].push(p);
});

// 🎯 RENDER
Object.keys(categories).forEach((type) => {
  if (!grouped[type]) return;

  const section = document.createElement("div");
  section.className = "category-section";

  section.innerHTML = `
    <h2 class="category-title">${categories[type]}</h2>
    <div class="product-grid" id="${type}-grid"></div>
  `;

  container.appendChild(section);

  const grid = section.querySelector(".product-grid");

  grouped[type].forEach((product) => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <model-viewer 
        src="${product.model}" 
        alt="${product.name}"
        auto-rotate 
        camera-controls 
        shadow-intensity="1"
      ></model-viewer>

      <div class="card-content">
        <h3>${product.name}</h3>
        <p class="price">₹${product.price}</p>
        <button class="btn try-btn">Try</button>
        <button class="btn cart-btn">Add to Cart</button>
      </div>
    `;

    // TRY BUTTON
    card.querySelector(".try-btn").onclick = () => {
      localStorage.setItem("selectedModel", product.model);
      localStorage.setItem("productType", product.type);
      window.location.href = "../html/tryon.html";
    };

    // CART
    card.querySelector(".cart-btn").onclick = () => addToCart(product);

    grid.appendChild(card);
  });
});
