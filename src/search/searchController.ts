import type { AppStore } from '../app/appState';
import type { ConveniencePoi } from '../types/convenience';
import type { Coordinates } from '../types/location';
import type { ConvenienceSearchService } from './overpassClient';

export class SearchController {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private activeRequest: AbortController | null = null;
  private requestVersion = 0;

  constructor(
    private readonly store: AppStore,
    private readonly service: ConvenienceSearchService,
    private readonly radiusMeters: number,
    private readonly debounceMilliseconds: number,
    private readonly errorMessage: (error: unknown) => string,
    private readonly onResults: (results: ConveniencePoi[]) => void,
  ) {}

  schedule(center: Coordinates): void {
    this.cancelPending();
    this.store.update({
      convenienceSearch: {
        ...this.store.getState().convenienceSearch,
        status: 'debouncing',
        center,
        message: '地図を動かしたため再検索します',
      },
    });
    this.debounceTimer = globalThis.setTimeout(
      () => void this.execute(center),
      this.debounceMilliseconds,
    );
  }

  retry(): void {
    this.cancelPending();
    void this.execute(this.store.getState().center);
  }

  cancelForUserInteraction(): void {
    this.cancelPending();
    this.store.update({
      convenienceSearch: {
        ...this.store.getState().convenienceSearch,
        status: 'idle',
        message: '地図の操作完了を待っています',
      },
    });
  }

  private cancelPending(): void {
    if (this.debounceTimer !== null)
      globalThis.clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    this.activeRequest?.abort();
    this.activeRequest = null;
    this.requestVersion += 1;
  }

  private async execute(center: Coordinates): Promise<void> {
    this.debounceTimer = null;
    const version = ++this.requestVersion;
    const controller = new AbortController();
    this.activeRequest = controller;
    this.store.update({
      convenienceSearch: {
        ...this.store.getState().convenienceSearch,
        status: 'loading',
        center,
        message: '周辺のコンビニを確認中…',
      },
    });

    try {
      const results = await this.service.search(
        center,
        this.radiusMeters,
        controller.signal,
      );
      if (version !== this.requestVersion) return;
      this.onResults(results);
      this.store.update({
        convenienceSearch: {
          status: 'success',
          center,
          radiusMeters: this.radiusMeters,
          results,
          message:
            results.length === 0
              ? `半径${this.radiusMeters}m以内にコンビニ登録なし`
              : `周辺${this.radiusMeters}mに${results.length}件あります`,
        },
      });
    } catch (error) {
      if (version !== this.requestVersion || controller.signal.aborted) return;
      this.onResults([]);
      this.store.update({
        convenienceSearch: {
          ...this.store.getState().convenienceSearch,
          status: 'error',
          center,
          results: [],
          message: this.errorMessage(error),
        },
      });
    } finally {
      if (version === this.requestVersion) this.activeRequest = null;
    }
  }
}
