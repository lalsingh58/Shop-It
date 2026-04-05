const elements = document.querySelectorAll(".fade-in");

// Scroll animation function
function showOnScroll() {
  elements.forEach((el) => {
    const position = el.getBoundingClientRect().top;
    const screenHeight = window.innerHeight;

    if (position < screenHeight - 100) {
      el.classList.add("show");
    }
  });
}

// Run on scroll
window.addEventListener("scroll", showOnScroll);

// Run on page load (IMPORTANT FIX)
window.addEventListener("load", showOnScroll);
