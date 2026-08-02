export async function registerServiceWorker(
  onError: () => void,
): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const url = new URL('sw.js', document.baseURI);
    await navigator.serviceWorker.register(url, {
      scope: new URL('.', document.baseURI).pathname,
    });
  } catch {
    onError();
  }
}
