import type { AppStore } from '../app/appState';
import type { AuthController } from '../auth/authController';
import {
  CONVENIENCE_BRANDS,
  convenienceTags,
  type ConvenienceBrand,
} from '../write/convenienceTags';
import { OsmWriteClient, OsmWriteError } from '../write/osmWriteClient';

export function mountRegistrationPanel(
  root: HTMLElement,
  store: AppStore,
  auth: AuthController,
  client: OsmWriteClient,
): void {
  const panel = document.createElement('section');
  panel.className = 'registration-panel';
  panel.setAttribute('aria-labelledby', 'registration-title');
  panel.innerHTML = `
    <h2 id="registration-title">コンビニを登録</h2>
    <div class="registration-controls">
      <label>ブランド
        <select id="registration-brand">
          ${CONVENIENCE_BRANDS.map(({ value, label }) => `<option value="${value}">${label}</option>`).join('')}
        </select>
      </label>
      <label id="other-name-label" hidden>店舗名
        <input id="other-name" type="text" maxlength="255" autocomplete="organization" />
      </label>
      <button id="register-button" type="button">中央ピンへ登録</button>
    </div>
    <p id="registration-message" class="registration-message" role="status" aria-live="assertive">ログイン後に登録できます。</p>`;

  const select = required<HTMLSelectElement>(panel, '#registration-brand');
  const otherLabel = required<HTMLElement>(panel, '#other-name-label');
  const otherName = required<HTMLInputElement>(panel, '#other-name');
  const button = required<HTMLButtonElement>(panel, '#register-button');
  const message = required<HTMLElement>(panel, '#registration-message');
  let authenticated = false;
  let submitting = false;

  const renderButton = () => {
    button.disabled = !authenticated || submitting;
    button.setAttribute('aria-busy', String(submitting));
  };
  auth.subscribe((state) => {
    authenticated = state.status === 'authenticated';
    renderButton();
    if (!authenticated && !submitting) {
      message.textContent =
        state.status === 'expired'
          ? '再度ログインしてから登録してください。'
          : 'ログイン後に登録できます。';
      message.dataset.status = state.status;
    }
  });
  select.addEventListener('change', () => {
    const isOther = select.value === 'other';
    otherLabel.hidden = !isOther;
    otherName.required = isOther;
  });
  button.addEventListener('click', async () => {
    if (submitting) return;
    const token = auth.getAccessToken();
    if (!token) {
      message.textContent = 'OSMへログインしてから登録してください。';
      message.dataset.status = 'error';
      return;
    }
    const brand = select.value as ConvenienceBrand;
    if (brand === 'other' && !otherName.value.trim()) {
      message.textContent = '「その他」は店舗名を入力してください。';
      message.dataset.status = 'error';
      otherName.focus();
      return;
    }

    submitting = true;
    renderButton();
    message.textContent = 'OSMへ登録中…';
    message.dataset.status = 'submitting';
    const coordinates = { ...store.getState().center };
    try {
      const result = await client.createConvenience(
        token,
        coordinates,
        convenienceTags(brand, otherName.value),
      );
      message.textContent = `登録しました（node ${result.nodeId}）。`;
      message.dataset.status = 'success';
    } catch (error) {
      if (error instanceof OsmWriteError && error.status === 401) {
        await auth.handleUnauthorized();
        message.textContent = 'OSMへ再度ログインしてから登録してください。';
      } else {
        message.textContent =
          error instanceof Error
            ? error.message
            : 'OSMへの登録に失敗しました。もう一度お試しください。';
      }
      message.dataset.status = 'error';
    } finally {
      submitting = false;
      renderButton();
    }
  });
  root.append(panel);
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Required registration element: ${selector}`);
  return element;
}
