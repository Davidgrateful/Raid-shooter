'use client';

import { useEffect } from 'react';
import { useSendTransaction, useConfig, useAccount, useSwitchChain } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { parseEther } from 'viem';
import { base, baseSepolia } from '@reown/appkit/networks';

interface BuyDetail {
  itemId: string;
  priceEth: string;
  treasury: string;
  network: string;
}

// Bridges the canvas game's MARKET screen to the wallet: the game emits
// raidshooter:buy, this sends the Base payment, waits for confirmation,
// has the server verify and grant, then reports back via
// raidshooter:purchase.
export function MarketBridge() {
  const { sendTransactionAsync } = useSendTransaction();
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
        const hash = await sendTransactionAsync({
          to: detail.treasury as `0x${string}`,
          value: parseEther(detail.priceEth),
          chainId: chain.id as number,
        });
        report('pending');
        await waitForTransactionReceipt(config, { hash, chainId: chain.id as number });
        const res = await fetch('/api/market/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: detail.itemId, txHash: hash }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          report('done', { items: data.items });
        } else {
          report('failed');
        }
      } catch {
        report('cancelled');
      }
    };
    window.addEventListener('raidshooter:buy', onBuy);
    return () => window.removeEventListener('raidshooter:buy', onBuy);
  }, [sendTransactionAsync, switchChainAsync, chainId, config]);

  return null;
}
