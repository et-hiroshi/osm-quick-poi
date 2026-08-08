import { describe, expect, it } from 'vitest';
import { RegistrationSafety } from './registrationSafety';

const center = { latitude: 35.123, longitude: 139.456 };

describe('RegistrationSafety', () => {
  it('登録成功後は同じ内容を再送できず、完了状態をロックする', () => {
    const safety = new RegistrationSafety();

    safety.lock(center, 'same-store');

    expect(safety.isLocked()).toBe(true);
    expect(safety.canSubmit('same-store')).toBe(false);
  });

  it('別の店舗を選ぶと完了状態は解除するが送信済み内容は再送させない', () => {
    const safety = new RegistrationSafety();
    safety.lock(center, 'same-store');

    safety.unlock();

    expect(safety.isLocked()).toBe(false);
    expect(safety.canSubmit('same-store')).toBe(false);
    expect(safety.canSubmit('different-store')).toBe(true);
  });

  it('中心座標が明確に変わった場合だけ完了状態を解除する', () => {
    const safety = new RegistrationSafety();
    safety.lock(center, 'same-store');

    expect(safety.unlockIfCenterMoved({ ...center })).toBe(false);
    expect(safety.isLocked()).toBe(true);
    expect(safety.unlockIfCenterMoved({ ...center, longitude: 139.457 })).toBe(
      true,
    );
    expect(safety.isLocked()).toBe(false);
  });
});
