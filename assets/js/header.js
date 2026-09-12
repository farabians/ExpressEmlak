// Mobil menü açma/kapama - header'ı kullanan her sayfa bunu yükler.
const btn = document.querySelector(".ee-menu-btn");
const nav = document.querySelector(".ee-nav");

if (btn && nav) {
  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
}
