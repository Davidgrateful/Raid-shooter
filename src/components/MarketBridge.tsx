'use client';

import { useEffect } from 'react';
import { useSendTransaction, useWriteContract, useConfig, useAccount, useSwitchChain } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { erc20Abi, parseEther, parseUnits } from 'viem';
import { base, baseSepolia } from '@reown/appkit/networks';

interface BuyDetail {
  itemId: string;
  priceEth: string;
  treasury: string;
  network: string;
  /** 'token' pays in $RAIDSHOOTER (an ERC-20 transfer); default ETH */
  currency?: 'eth' | 'token';
  tokenAddress?: string;
  /** whole tokens, as quoted by /api/market */
  priceToken?: string;
}

// Bridges the canvas game's MARKET screen to the wallet: the game emits
// raidshooter:buy, this sends the Base payment, waits for confirmation,
// has the server verify and grant, then reports back via
// raidshooter:purchase.
export function MarketBridge() {
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const { chainId } = useAccount();
  const config = useConfig();

  useEffect(() => {
    const onBuy = async (e: Event) => {
      const detail = (e as CustomEvent<BuyDetail>).detail;
      const report = (status: string, extra: Record<string, unknown> = {}) =>
        window.dispatchEvent(
          new CustomEvent('raidshooter:purchase', { detail: { itemId: detail.itemId, status, ...extra } })
        );
      try {
        const chain = detail.network === 'base' ? base : baseSepolia;
        if (chainId !== chain.id) {
          report('switching');
          await switchChainAsync({ chainId: chain.id as number });
        }
        report('confirm');
        const payToken = detail.currency === 'token' && !!detail.tokenAddress && !!detail.priceToken;
        const hash = payToken
          ? await writeContractAsync({
              address: detail.tokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: 'transfer',
              args: [detail.treasury as `0x${string}`, parseUnits(detail.priceToken!, 18)],
              chainId: chain.id as number,
            })
          : await sendTransactionAsync({
              to: detail.treasury as `0x${string}`,
              value: parseEther(detail.priceEth),
              chainId: chain.id as number,
            });
        report('pending');
        await waitForTransactionReceipt(config, { hash, chainId: chain.id as number });
        const res = await fetch('/api/market/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: detail.itemId, txHash: hash, currency: payToken ? 'token' : 'eth' }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          report('done', { items: data.items });
        } else {
          report('failed');
        }
      } catch (err) {
        // surface the real failure instead of a blanket "cancelled" so a
        // wallet rejection, an empty balance, and an RPC hiccup don't all
        // look identical to the player (or to us, debugging this).
        const message = err instanceof Error ? err.message : String(err);
        console.error('[market] purchase failed:', message);
        const lower = message.toLowerCase();
        let reason = 'failed';
        if (lower.includes('reject') || lower.includes('denied') || lower.includes('user rejected')) {
          reason = 'cancelled';
        } else if (detail.currency === 'token' && lower.includes('exceeds balance')) {
          // the token's own revert; "insufficient funds" below is ETH for gas
          reason = 'insufficient_token';
        } else if (lower.includes('insufficient')) {
          reason = 'insufficient_funds';
        } else if (lower.includes('chain') || lower.includes('network')) {
          reason = 'wrong_network';
        }
        report(reason, { message });
      }
    };
    window.addEventListener('raidshooter:buy', onBuy);
    return () => window.removeEventListener('raidshooter:buy', onBuy);
  }, [sendTransactionAsync, writeContractAsync, switchChainAsync, chainId, config]);

  return null;
}
