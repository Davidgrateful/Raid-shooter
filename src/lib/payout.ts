// USDC (or any ERC-20) payout helpers for leaderboard tournament rewards.
//
// SECURITY MODEL (default): no private key ever lives on the server. The
// admin computes who gets paid how much, and this module produces an
// export the operator signs from THEIR OWN wallet:
//   - a Disperse.app-compatible batch (one transaction pays everyone), and
//   - a plain CSV.
// An optional fully-automated path (server signs + sends) is gated behind
// PAYOUT_PRIVATE_KEY and is OFF unless that env var is set, so the safe
// behavior is the default and a misconfig can't move funds.

import { baseNetwork, baseRpcUrl } from '@/lib/market';

export interface PayoutRow {
  address: string;
  amountUsd: number;
}

// Token config. Defaults to Circle's native USDC on the active Base network,
// but every field is overridable so a sponsor's memecoin or a testnet token
// just needs env vars - no code change.
export interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
  network: string;
}

// Circle native USDC addresses.
const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

export function tokenConfig(): TokenConfig {
  const envAddr = (process.env.PAYOUT_TOKEN_ADDRESS || '').trim();
  const defaultAddr = baseNetwork === 'base' ? USDC_BASE_MAINNET : USDC_BASE_SEPOLIA;
  const address = /^0x[0-9a-fA-F]{40}$/.test(envAddr) ? envAddr : defaultAddr;
  const decimals = Number.isFinite(Number(process.env.PAYOUT_TOKEN_DECIMALS))
    ? Number(process.env.PAYOUT_TOKEN_DECIMALS)
    : 6; // USDC has 6 decimals
  const symbol = (process.env.PAYOUT_TOKEN_SYMBOL || 'USDC').trim() || 'USDC';
  return { address, symbol, decimals, network: baseNetwork };
}

// Convert a human dollar amount to integer token base units (string, so big
// numbers never lose precision). e.g. 12.5 USDC -> "12500000" at 6 decimals.
export function toBaseUnits(amountUsd: number, decimals: number): string {
  if (!(amountUsd > 0)) return '0';
  const [whole, frac = ''] = amountUsd.toFixed(decimals).split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const joined = `${whole}${fracPadded}`.replace(/^0+(?=\d)/, '');
  return joined || '0';
}

// Disperse.app batch: parallel arrays of recipients and base-unit amounts,
// plus the token address. The operator pastes these into disperse.app (or a
// Safe) and signs one transaction that pays the whole list.
export function buildDisperse(rows: PayoutRow[], token: TokenConfig) {
  const recipients: string[] = [];
  const amounts: string[] = [];
  for (const r of rows) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(r.address) || !(r.amountUsd > 0)) continue;
    recipients.push(r.address);
    amounts.push(toBaseUnits(r.amountUsd, token.decimals));
  }
  return {
    token: token.address,
    network: token.network,
    recipients,
    amounts,
    // disperse.app's textarea format: "address, amount" per line (human units)
    pasteFormat: rows
      .filter((r) => /^0x[0-9a-fA-F]{40}$/.test(r.address) && r.amountUsd > 0)
      .map((r) => `${r.address}, ${r.amountUsd}`)
      .join('\n'),
  };
}

export function buildCsv(rows: PayoutRow[]): string {
  const header = 'address,amount_usd';
  const lines = rows
    .filter((r) => /^0x[0-9a-fA-F]{40}$/.test(r.address) && r.amountUsd > 0)
    .map((r) => `${r.address},${r.amountUsd}`);
  return [header, ...lines].join('\n');
}

// Whether the fully-automated server-side send is configured. OFF by default.
export function canAutoSend(): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test((process.env.PAYOUT_PRIVATE_KEY || '').trim());
}

export interface SendResult {
  ok: boolean;
  txHashes: { address: string; amountUsd: number; txHash?: string; error?: string }[];
  error?: string;
}

// Optional automated payout. Sends one ERC-20 transfer per recipient from the
// PAYOUT_PRIVATE_KEY wallet. Only callable when canAutoSend() is true; the
// caller (admin route) must additionally require an explicit confirm flag.
// Kept deliberately simple (sequential transfers) so a failure is isolated to
// one recipient and the rest still go through.
export async function sendBatch(rows: PayoutRow[]): Promise<SendResult> {
  if (!canAutoSend()) {
    return { ok: false, txHashes: [], error: 'Automated payouts are not configured (PAYOUT_PRIVATE_KEY unset).' };
  }
  const token = tokenConfig();
  // viem is already a project dependency (wallet login). Imported lazily so a
  // missing key path never pulls signing code into the request.
  const { createWalletClient, http, getContract, parseAbi } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { base, baseSepolia } = await import('viem/chains');

  const account = privateKeyToAccount(
    (process.env.PAYOUT_PRIVATE_KEY as `0x${string}`)
  );
  const chain = token.network === 'base' ? base : baseSepolia;
  const client = createWalletClient({ account, chain, transport: http(baseRpcUrl) });
  const erc20 = getContract({
    address: token.address as `0x${string}`,
    abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
    client,
  });

  const txHashes: SendResult['txHashes'] = [];
  for (const r of rows) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(r.address) || !(r.amountUsd > 0)) continue;
    try {
      const amount = BigInt(toBaseUnits(r.amountUsd, token.decimals));
      const hash = await erc20.write.transfer([r.address as `0x${string}`, amount]);
      txHashes.push({ address: r.address, amountUsd: r.amountUsd, txHash: hash });
    } catch (e) {
      txHashes.push({ address: r.address, amountUsd: r.amountUsd, error: (e as Error).message });
    }
  }
  return { ok: txHashes.every((t) => t.txHash), txHashes };
}
