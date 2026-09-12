// Express Konut sayfasının ve ana sayfa tanıtımının paylaştığı veri katmanı.
//
// Statik tanıtım içeriği olduğu için onSnapshot değil getDoc kullanılır -
// canlı dinleyici burada gereksiz bir açık soket olurdu. Sonuç modül içinde
// bir kez alınıp bellekte tutulur (memoize) ki hem express-konut.html hem de
// index.html teaser'ı aynı isteği tekrar tekrar yapmasın.
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { VARSAYILAN_KONUT, pesinatAraligi, planSec } from "./konut-data.js";

export { pesinatAraligi, planSec };

let onbellek = null;

/**
 * Express Konut ayarlarını getirir. Firestore'a hiç ulaşılamıyorsa veya
 * doküman henüz oluşturulmamışsa VARSAYILAN_KONUT'a düşer - sayfa asla
 * boş kalmaz, panel de bu değerlerle "tohumlanmış" gibi davranabilir.
 */
export async function getKonutAyarlari() {
  if (onbellek) return onbellek;

  try {
    const snap = await getDoc(doc(db, "ayarlar", "expressKonut"));
    onbellek = snap.exists() ? { ...VARSAYILAN_KONUT, ...snap.data() } : VARSAYILAN_KONUT;
  } catch (err) {
    console.error("Express Konut ayarları alınamadı, varsayılan değerler kullanılıyor:", err);
    onbellek = VARSAYILAN_KONUT;
  }

  return onbellek;
}
