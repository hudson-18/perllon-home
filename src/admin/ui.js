const $ = (s, c = document) => c.querySelector(s);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer = null;
export function toast(msg, type = '') {
  const old = $('.toast-admin');
  if (old) old.remove();
  clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = `toast-admin ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), 3200);
}

export function beginPending(control, pendingText) {
  if (!control || control.dataset.pending === 'true') return false;
  control.dataset.pending = 'true';
  control.disabled = true;
  if (pendingText) {
    control.dataset.idleText = control.textContent;
    control.textContent = pendingText;
  }
  return true;
}

export function finishPending(control) {
  if (!control) return;
  control.disabled = false;
  if (control.dataset.idleText !== undefined) {
    control.textContent = control.dataset.idleText;
    delete control.dataset.idleText;
  }
  delete control.dataset.pending;
}

const SAFE_ADMIN_ERROR_PREFIXES = ['Arquivo ', 'Tipo não permitido:', 'Arquivo muito grande', 'Supabase não configurado.'];

export function reportAdminError(error, fallback, allowSafeMessage = false) {
  console.error(fallback, error);
  const technicalMessage = typeof error?.message === 'string' ? error.message : '';
  const message = allowSafeMessage && SAFE_ADMIN_ERROR_PREFIXES.some((prefix) => technicalMessage.startsWith(prefix))
    ? technicalMessage
    : fallback;
  toast(message, 'error');
}
