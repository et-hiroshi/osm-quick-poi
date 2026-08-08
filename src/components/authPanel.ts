import type { AuthController } from '../auth/authController';
import type { AuthState } from '../auth/authTypes';

export function mountAuthPanel(
  root: HTMLElement,
  controller: AuthController,
  redirectUri: () => string,
): void {
  const panel = document.createElement('section');
  panel.className = 'auth-panel';
  panel.setAttribute('aria-label', 'OpenStreetMapログイン');

  const message = document.createElement('p');
  message.className = 'auth-message';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'auth-button';
  panel.append(message, button);
  root.append(panel);

  let authenticated = false;
  button.addEventListener('click', () => {
    if (authenticated) void controller.logout();
    else void controller.login(redirectUri());
  });

  controller.subscribe((state) => {
    authenticated = state.status === 'authenticated';
    renderAuthPanel(state, message, button);
  });
}

function renderAuthPanel(
  state: Readonly<AuthState>,
  message: HTMLElement,
  button: HTMLButtonElement,
): void {
  message.textContent = state.message;
  message.dataset.status = state.status;
  button.textContent =
    state.status === 'authenticated' ? 'ログアウト' : 'OSMへログイン';
  button.disabled =
    state.status === 'loading' || state.status === 'authorizing';
  button.setAttribute('aria-busy', String(button.disabled));
}
