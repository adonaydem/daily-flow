// Encryption / Decryption helpers for user-supplied API keys.
// Relies on Supabase Edge Functions: /encrypt and /decrypt
// These functions should accept { apiKey } and { ciphertext } JSON bodies respectively.

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;

if (!projectRef) {
  // Non-fatal: we'll throw when actually trying to use helpers
  console.warn("VITE_SUPABASE_PROJECT_ID is not defined; encryption helpers will fail.");
}

const baseFnUrl = projectRef ? `https://${projectRef}.functions.supabase.co` : '';

export interface EncryptResponse { ciphertext?: string; error?: string; [k: string]: unknown }
export interface DecryptResponse { apiKey?: string; plaintext?: string; error?: string; [k: string]: unknown }

export async function encryptKey(plain: string): Promise<string> {
  if (!plain.trim()) throw new Error('Empty key cannot be encrypted');
  if (!baseFnUrl) throw new Error('Supabase project ref missing');
  const res = await fetch(`${baseFnUrl}/encrypt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: plain })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`/encrypt failed ${res.status}: ${t}`);
  }
  const data: EncryptResponse = await res.json();
  const cipher = data.ciphertext || (data as any).data || '';
  if (!cipher) throw new Error('Encrypt response missing ciphertext');
  return cipher;
}

export async function decryptKey(ciphertext: string): Promise<string> {
  if (!ciphertext) return '';
  if (!baseFnUrl) throw new Error('Supabase project ref missing');
  const res = await fetch(`${baseFnUrl}/decrypt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ciphertext })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`/decrypt failed ${res.status}: ${t}`);
  }
  const data: DecryptResponse = await res.json();
  const plain = data.apiKey || data.plaintext || (data as any).data || '';
  if (typeof plain !== 'string') throw new Error('Decrypt response missing plaintext');
  return plain;
}
