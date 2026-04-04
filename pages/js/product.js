const products = [
  // 👓 Glasses (5)
  {
    name: "Classic Glasses",
    price: 499,
    img: "../assets/glasses/g1.png",
    type: "glasses",
  },
  {
    name: "Round Glasses",
    price: 599,
    img: "assets/glasses/g2.png",
    type: "glasses",
  },
  {
    name: "Black Frame",
    price: 699,
    img: "assets/glasses/g3.png",
    type: "glasses",
  },
  {
    name: "Stylish Glasses",
    price: 799,
    img: "assets/glasses/g4.png",
    type: "glasses",
  },
  {
    name: "Cool Glasses",
    price: 899,
    img: "assets/glasses/g5.png",
    type: "glasses",
  },

  // 🧢 Caps (5)
  { name: "Street Cap", price: 299, img: "assets/caps/c1.png", type: "cap" },
  { name: "Black Cap", price: 349, img: "assets/caps/c2.png", type: "cap" },
  { name: "Sports Cap", price: 399, img: "assets/caps/c3.png", type: "cap" },
  { name: "Snapback", price: 449, img: "assets/caps/c4.png", type: "cap" },
  { name: "Cool Cap", price: 499, img: "assets/caps/c5.png", type: "cap" },

  // 💇 Wigs (5)
  { name: "Curly Wig", price: 999, img: "assets/wigs/w1.png", type: "wig" },
  { name: "Straight Wig", price: 1099, img: "assets/wigs/w2.png", type: "wig" },
  { name: "Short Wig", price: 1199, img: "assets/wigs/w3.png", type: "wig" },
  { name: "Long Wig", price: 1299, img: "assets/wigs/w4.png", type: "wig" },
  { name: "Fashion Wig", price: 1399, img: "assets/wigs/w5.png", type: "wig" },

  // 💍 Earrings (5)
  {
    name: "Gold Earrings",
    price: 199,
    img: "assets/earrings/e1.png",
    type: "earring",
  },
  {
    name: "Silver Earrings",
    price: 249,
    img: "assets/earrings/e2.png",
    type: "earring",
  },
  {
    name: "Stud Earrings",
    price: 299,
    img: "assets/earrings/e3.png",
    type: "earring",
  },
  {
    name: "Hoop Earrings",
    price: 349,
    img: "assets/earrings/e4.png",
    type: "earring",
  },
  {
    name: "Fancy Earrings",
    price: 399,
    img: "assets/earrings/e5.png",
    type: "earring",
  },
];

const container = document.getElementById("product-container");

products.forEach((product) => {
  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <img src="${product.img}" alt="${product.name}">
    <div class="card-content">
      <h3>${product.name}</h3>
      <p class="price">₹${product.price}</p>
      <button class="btn try-btn">Try</button>
      <button class="btn cart-btn">Add to Cart</button>
    </div>
  `;

  // Try Button
  card.querySelector(".try-btn").onclick = () => {
    localStorage.setItem("selectedProduct", product.img);
    localStorage.setItem("productType", product.type);
    window.location.href = "../html/tryon.html";
  };

  // Cart Button
  card.querySelector(".cart-btn").onclick = () => {
    alert(product.name + " added to cart 🛒");
  };

  container.appendChild(card);
});
