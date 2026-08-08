import type { AppStore } from '../app/appState';
import type { AuthController } from '../auth/authController';
import type { ConveniencePoi, SearchStatus } from '../types/convenience';
import {
  CONVENIENCE_BRANDS,
  convenienceTags,
  type ConvenienceBrand,
} from '../write/convenienceTags';
import { OsmWriteClient, OsmWriteError } from '../write/osmWriteClient';

const SHORT_LABELS: Record<ConvenienceBrand, string> = {
  'seven-eleven': 'セブン',
  familymart: 'ファミマ',
  lawson: 'ローソン',
  ministop: 'ミニストップ',
  other: 'その他',
};

export function nearbyConveniencesForWarning(
  status: SearchStatus,
  results: readonly ConveniencePoi[],
): readonly ConveniencePoi[] {
  return status === 'success'
    ? results.filter(({ distanceMeters }) => distanceMeters <= 50)
    : [];
}

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
    <div class="brand-buttons">
      ${CONVENIENCE_BRANDS.map(({ value }) => `<button type="button" data-brand="${value}">${SHORT_LABELS[value]}</button>`).join('')}
    </div>
    <p id="registration-message" class="registration-message" role="status" aria-live="assertive">ログイン後に登録できます。</p>`;

  const overlay = document.createElement('div');
  overlay.className = 'confirmation-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="confirmation-sheet" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
      <div class="sheet-handle" aria-hidden="true"></div>
      <h2 id="confirmation-title">登録内容の確認</h2>
      <p class="selected-brand"><span>ブランド</span><strong id="selected-brand"></strong></p>
      <p class="pin-confirmation">地図の<strong>中央ピン位置</strong>へ登録します</p>
      <label class="store-name-label" for="store-name">店舗名 <span id="store-name-requirement"></span></label>
      <input id="store-name" type="text" maxlength="255" autocomplete="organization" />
      <div id="duplicate-warning" class="duplicate-warning" role="alert" hidden></div>
      <p id="confirmation-message" class="confirmation-message" role="status" aria-live="assertive"></p>
      <div class="confirmation-actions">
        <button id="cancel-registration" class="cancel-button" type="button">キャンセル</button>
        <button id="confirm-registration" class="confirm-button" type="button">登録する</button>
      </div>
    </section>`;

  const brandButtons = Array.from(
    panel.querySelectorAll<HTMLButtonElement>('[data-brand]'),
  );
  const panelMessage = required<HTMLElement>(panel, '#registration-message');
  const selectedBrand = required<HTMLElement>(overlay, '#selected-brand');
  const nameInput = required<HTMLInputElement>(overlay, '#store-name');
  const nameRequirement = required<HTMLElement>(
    overlay,
    '#store-name-requirement',
  );
  const warning = required<HTMLElement>(overlay, '#duplicate-warning');
  const confirmationMessage = required<HTMLElement>(
    overlay,
    '#confirmation-message',
  );
  const cancelButton = required<HTMLButtonElement>(
    overlay,
    '#cancel-registration',
  );
  const confirmButton = required<HTMLButtonElement>(
    overlay,
    '#confirm-registration',
  );
  let authenticated = false;
  let submitting = false;
  let activeBrand: ConvenienceBrand | null = null;
  let opener: HTMLButtonElement | null = null;

  const renderControls = () => {
    brandButtons.forEach((button) => {
      button.disabled = !authenticated || submitting;
    });
    confirmButton.disabled = submitting;
    confirmButton.setAttribute('aria-busy', String(submitting));
    cancelButton.disabled = submitting;
  };

  const renderWarning = () => {
    const search = store.getState().convenienceSearch;
    const nearby = nearbyConveniencesForWarning(search.status, search.results);
    warning.hidden = nearby.length === 0;
    warning.replaceChildren();
    if (nearby.length === 0) return;
    const heading = document.createElement('strong');
    heading.textContent =
      '近くにコンビニがあります。重複登録に注意してください。';
    const list = document.createElement('ul');
    nearby.forEach((poi) => {
      const item = document.createElement('li');
      item.textContent = `${poi.name}（約${Math.round(poi.distanceMeters)}m）`;
      list.append(item);
    });
    warning.append(heading, list);
  };

  const closeConfirmation = () => {
    overlay.hidden = true;
    activeBrand = null;
    nameInput.value = '';
    confirmationMessage.textContent = '';
    opener?.focus();
    opener = null;
  };

  const openConfirmation = (
    brand: ConvenienceBrand,
    button: HTMLButtonElement,
  ) => {
    activeBrand = brand;
    opener = button;
    selectedBrand.textContent = SHORT_LABELS[brand];
    const isOther = brand === 'other';
    nameRequirement.textContent = isOther ? '（必須）' : '（任意）';
    nameInput.required = isOther;
    confirmationMessage.textContent = '';
    renderWarning();
    overlay.hidden = false;
    nameInput.focus();
  };

  auth.subscribe((state) => {
    authenticated = state.status === 'authenticated';
    renderControls();
    if (!authenticated && !submitting) {
      panelMessage.textContent =
        state.status === 'expired'
          ? '再度ログインしてから登録してください。'
          : 'ログイン後に登録できます。';
      panelMessage.dataset.status = state.status;
    } else if (authenticated && !submitting) {
      panelMessage.textContent = 'ブランドを選んでください。';
      panelMessage.dataset.status = 'authenticated';
    }
  });
  store.subscribe(() => {
    if (!overlay.hidden) renderWarning();
  });
  brandButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const brand = button.dataset.brand as ConvenienceBrand;
      openConfirmation(brand, button);
    });
  });
  cancelButton.addEventListener('click', closeConfirmation);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay && !submitting) closeConfirmation();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !submitting) closeConfirmation();
  });
  confirmButton.addEventListener('click', async () => {
    if (submitting || !activeBrand) return;
    const token = auth.getAccessToken();
    if (!token) {
      confirmationMessage.textContent = 'OSMへ再度ログインしてください。';
      confirmationMessage.dataset.status = 'error';
      return;
    }
    const storeName = nameInput.value.trim();
    if (activeBrand === 'other' && !storeName) {
      confirmationMessage.textContent =
        '「その他」は店舗名を入力してください。';
      confirmationMessage.dataset.status = 'error';
      nameInput.focus();
      return;
    }

    // The coordinate snapshot is intentionally taken at the moment submission starts.
    const coordinates = { ...store.getState().center };
    const brand = activeBrand;
    submitting = true;
    renderControls();
    confirmationMessage.textContent = 'OSMへ登録中…';
    confirmationMessage.dataset.status = 'submitting';
    try {
      const result = await client.createConvenience(
        token,
        coordinates,
        convenienceTags(brand, storeName),
      );
      closeConfirmation();
      panelMessage.textContent = `登録しました（node ${result.nodeId}）。`;
      panelMessage.dataset.status = 'success';
    } catch (error) {
      if (error instanceof OsmWriteError && error.status === 401) {
        await auth.handleUnauthorized();
        confirmationMessage.textContent = 'OSMへ再度ログインしてください。';
      } else {
        confirmationMessage.textContent =
          error instanceof Error
            ? error.message
            : 'OSMへの登録に失敗しました。もう一度お試しください。';
      }
      confirmationMessage.dataset.status = 'error';
    } finally {
      submitting = false;
      renderControls();
    }
  });
  root.append(panel, overlay);
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Required registration element: ${selector}`);
  return element;
}
