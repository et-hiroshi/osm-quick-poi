import type { LocationReading } from '../types/location';

export interface GeolocationProvider {
  getCurrentPosition(
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ): void;
}

export class LocationError extends Error {
  constructor(
    public readonly kind: 'unsupported' | 'denied' | 'timeout' | 'unavailable',
  ) {
    super(kind);
  }
}

export function getCurrentLocation(
  provider: GeolocationProvider | undefined,
  options: PositionOptions,
): Promise<LocationReading> {
  if (!provider) return Promise.reject(new LocationError('unsupported'));

  return new Promise((resolve, reject) => {
    provider.getCurrentPosition(
      (position) =>
        resolve({
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          accuracy: position.coords.accuracy,
          measuredAt: position.timestamp,
        }),
      (error) => {
        const kind =
          error.code === error.PERMISSION_DENIED
            ? 'denied'
            : error.code === error.TIMEOUT
              ? 'timeout'
              : 'unavailable';
        reject(new LocationError(kind));
      },
      options,
    );
  });
}

export function locationErrorMessage(error: unknown): string {
  if (!(error instanceof LocationError))
    return '現在地を取得できませんでした。もう一度お試しください。';

  switch (error.kind) {
    case 'unsupported':
      return 'このブラウザは位置情報に対応していません。地図を手動で移動できます。';
    case 'denied':
      return '位置情報の利用が許可されていません。設定を確認するか、地図を手動で移動してください。';
    case 'timeout':
      return '現在地の取得が時間切れになりました。空の見える場所で再度お試しください。';
    case 'unavailable':
      return '現在地を取得できませんでした。通信や端末の設定を確認してください。';
  }
}
