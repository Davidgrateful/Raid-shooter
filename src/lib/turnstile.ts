// Cloudflare Turnstile verification. Disabled (always passes) until
// TURNSTILE_SECRET_KEY is set, so the app works with zero setup and you
// flip protection on by adding the keys - same pattern as KV and the
// admin token.

export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  // not configured -> treat as passing (feature off)
  if (!turnstileEnabled()) {
    return true;
  }
  if (!token) {
    return false;
  }
  try {
    const form = new URLSearchParams();
    form.set('secret', process.env.TURNSTILE_SECRET_KEY!);
    form.set('response', token);
    if (ip) {
      form.set('remoteip', ip);
    }
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      cache: 'no-store',
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    // on a verification outage, fail closed for guests (the caller decides
    // how strict to be) - returning false here blocks the submission
    return false;
  }
}
