import { CONTACT } from "./firebase-config.js";

// Saf fonksiyon - form verisinden WhatsApp mesaj metnini üretir. Test edilebilir.
export function whatsappMesaji({ ad, telefon, konu, mesaj }) {
  const satirlar = [
    `Merhaba, ben ${ad}.`,
    telefon ? `Telefon: ${telefon}` : null,
    konu ? `Konu: ${konu}` : null,
    "",
    mesaj || ""
  ].filter((s) => s !== null);
  return satirlar.join("\n");
}

export function whatsappUrl(contact, formData) {
  const metin = whatsappMesaji(formData);
  return `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(metin)}`;
}

function doldurIletisimBilgileri() {
  const telefonlar = document.getElementById("iltTelefonlar");
  if (telefonlar) {
    telefonlar.innerHTML = CONTACT.phones.map((p) => `
      <p>${p.person || p.label}</p>
      <p><a href="tel:${p.tel}">${p.number}</a></p>
    `).join("");
  }

  const eposta = document.getElementById("iltEposta");
  if (eposta) eposta.innerHTML = `<a href="mailto:${CONTACT.email}">${CONTACT.email}</a>`;

  const adres = document.getElementById("iltAdres");
  if (adres) adres.textContent = CONTACT.address;

  document.querySelectorAll("[data-ilt-tel]").forEach((el) => {
    const i = Number(el.getAttribute("data-ilt-tel"));
    const p = CONTACT.phones[i];
    if (!p) return;
    el.href = `tel:${p.tel}`;
    el.textContent = `${p.person ? p.person + " - " : ""}${p.number}`;
  });

  const wa = document.getElementById("iltWhatsapp");
  if (wa) wa.href = `https://wa.me/${CONTACT.whatsapp}`;

  const mail = document.getElementById("iltEpostaLink");
  if (mail) mail.href = `mailto:${CONTACT.email}`;
}

function initForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const url = whatsappUrl(CONTACT, {
      ad: data.get("ad") || "",
      telefon: data.get("telefon") || "",
      konu: data.get("konu") || "",
      mesaj: data.get("mesaj") || ""
    });
    window.open(url, "_blank", "noopener");
  });
}

doldurIletisimBilgileri();
initForm();
