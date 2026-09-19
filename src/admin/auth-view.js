import * as admin from '../lib/admin.js';
import logoPerllonUrl from '../assets/images/logo-perllon.svg';
import { toast, beginPending, finishPending, reportAdminError } from './ui.js';

const $ = (s, c = document) => c.querySelector(s);
const root = () => $('#admin-root');

// ---------- Login ----------
export function renderLogin() {
  root().innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <img class="login-logo" src="${logoPerllonUrl}" alt="PERLLON">
        <h1>Acesso administrativo</h1>
        <p class="login-sub">Entre com suas credenciais PERLLON.</p>
        <form id="login-form">
          <div class="field">
            <label for="email">E-mail</label>
            <input type="email" id="email" name="email" autocomplete="username" required>
          </div>
          <div class="field" style="margin-top:12px">
            <label for="password">Senha</label>
            <input type="password" id="password" name="password" autocomplete="current-password" required>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%;margin-top:20px">Entrar</button>
        </form>
        <p class="login-sub" style="margin-top:16px"><a href="/" style="color:var(--navy)">← Voltar ao site</a></p>
      </div>
    </div>`;

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#email').value.trim();
    const password = $('#password').value;
    if (!email || !password) { toast('Informe e-mail e senha.', 'error'); return; }
    const btn = $('#login-form button[type="submit"]');
    if (!beginPending(btn, 'Entrando…')) return;
    try {
      await admin.signIn(email, password);
      location.hash = '#/dashboard';
    } catch (err) {
      reportAdminError(err, 'Não foi possível entrar. Verifique seus dados e tente novamente.');
    } finally {
      finishPending(btn);
    }
  });
}

export function sessionUnavailable() {
  return `
    <div class="login-wrap">
      <div class="login-card">
        <img class="login-logo" src="${logoPerllonUrl}" alt="PERLLON">
        <h1>Não foi possível verificar seu acesso</h1>
        <p class="login-sub">Confira sua conexão e tente novamente.</p>
        <button type="button" class="btn btn-primary" id="retry-session" style="width:100%">Tentar novamente</button>
      </div>
    </div>`;
}

export function accessDenied() {
  return `
    <div class="login-wrap">
      <div class="login-card">
        <img class="login-logo" src="${logoPerllonUrl}" alt="PERLLON">
        <h1>Acesso administrativo não autorizado</h1>
        <p class="login-sub">Sua conta está autenticada, mas não possui um perfil administrativo válido.</p>
        <button type="button" class="btn btn-primary" id="access-denied-logout" style="width:100%">Sair</button>
      </div>
    </div>`;
}

// ---------- Not configured ----------
export function notConfigured() {
  return `
    <div class="login-wrap">
      <div class="login-card">
        <img class="login-logo" src="${logoPerllonUrl}" alt="PERLLON">
        <h1>Administração não configurada</h1>
        <p class="login-sub">
          Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>
          no arquivo <code>.env.local</code> (veja <code>.env.example</code>) e aplique
          as migrations para habilitar o painel.
        </p>
        <a href="/" class="btn btn-primary" style="width:100%">← Voltar ao site</a>
      </div>
    </div>`;
}
