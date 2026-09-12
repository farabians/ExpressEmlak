// Favoriler sayfası: localStorage'daki id'lere karşılık gelen ilanları tek
// tek getDoc ile çeker (tüm koleksiyonu çekip client-side filtrelemek yerine -
// favori sayısı tipik olarak küçük, ilanlar.js'in "tümünü çek" deseni burada gereksiz).
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { renderKart } from "./ilan-kart.js";
import { $ } from "./utils.js";
import { favorileriOku, favorileriYaz } from "./favoriler-store.js";

async function baslat() {
  const grid = $("#favoriGrid");
  const bosDurum = $("#favoriBos");
  if (!grid) return;

  const idler = favorileriOku();

  if (!idler.length) {
    grid.hidden = true;
    if (bosDurum) bosDurum.hidden = false;
    return;
  }

  const sonuclar = await Promise.allSettled(
    idler.map((id) => getDoc(doc(db, "ilanlar", id)))
  );

  const gecerliIdler = [];
  const kartlar = [];

  sonuclar.forEach((sonuc, i) => {
    if (sonuc.status !== "fulfilled") return;
    const snap = sonuc.value;
    if (!snap.exists()) return; // silinmiş ilan - listeden sessizce düşer
    gecerliIdler.push(idler[i]);
    kartlar.push(renderKart({ id: snap.id, ...snap.data() }));
  });

  // Silinmiş ilanları localStorage'dan da temizle - liste kendi kendini onarır.
  if (gecerliIdler.length !== idler.length) favorileriYaz(gecerliIdler);

  if (!kartlar.length) {
    grid.hidden = true;
    if (bosDurum) bosDurum.hidden = false;
    return;
  }

  grid.innerHTML = kartlar.join("");
}

baslat();
