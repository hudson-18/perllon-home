export const WHATSAPP = '5584998405201';
export const waUrl = (text) =>
  `https://api.whatsapp.com/send/?phone=${WHATSAPP}&type=phone_number&app_absent=0&text=${encodeURIComponent(text)}`;

export const money = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
