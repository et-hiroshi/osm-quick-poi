function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

export function randomUrlSafeString(crypto: Crypto, size = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(size)));
}

export async function createCodeChallenge(
  crypto: Crypto,
  verifier: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
}
