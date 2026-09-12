// Favoriler tarayıcıda tutuluyor; sunucu tarafı üyelik sistemi yok.
// ilan-detay.js (ekle/çıkar butonu) ve favoriler.js (liste sayfası) paylaşır.
const KEY = "ee_favoriler";

export function favorileriOku() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function favorideMi(id) {
  return favorileriOku().includes(id);
}

export function favoriToggle(id) {
  let list = favorileriOku();
  list = list.includes(id) ? list.filter((x) => x !== id) : list.concat(id);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* özel sekmede yazılamaz */ }
  return list;
}

export function favorileriYaz(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* özel sekmede yazılamaz */ }
}
