'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { getLobby, joinLobby, leaveLobby } from '@/lib/api';
import type { LobbyState } from '@/lib/api';
import styles from './lobby.module.css';

const STAKE_PER_PLAYER = 0.5;
const TOTAL_SLOTS = 8;

// Guaranteed 8-row fallback used before/if the API responds
const EMPTY_SLOTS = Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
  slot: i + 1,
  player: null as null,
}));

function truncate(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function LobbyPage() {
  const { publicKey } = useWallet();
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLobby = useCallback(async () => {
    try {
      const data: LobbyState = await getLobby();
      console.log('lobby:', data);
      setLobby(data);
    } catch (err) {
      console.error('fetchLobby error:', err);
      // silent on poll failures — avoids flashing error every 3 s
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLobby();
    const interval = setInterval(fetchLobby, 3000);
    return () => clearInterval(interval);
  }, [fetchLobby]);

  const walletAddress = publicKey?.toBase58() ?? null;
  const isInLobby =
    !!walletAddress &&
    !!lobby?.slots.some((s) => s.player?.walletAddress === walletAddress);
  const filledCount = lobby?.slots.filter((s) => s.player !== null).length ?? 0;
  const prizePool = filledCount * STAKE_PER_PLAYER;

  async function handleJoin() {
    console.log('Join clicked, wallet:', publicKey?.toString());
    if (!publicKey) return;                        // (b) guard against missing key
    const addr = publicKey.toBase58();
    setBusy(true);
    setError(null);
    try {
      const res = await joinLobby(addr);
      console.log('Join response:', res);          // (a) confirm handler fired + response
      if (res.error) { setError(res.error); return; }
      setLobby(res.lobby);
      await fetchLobby();                          // (c) immediate refresh after join
    } catch (err) {
      console.error('Join error:', err);           // (a) surface the real error
      setError('Failed to join lobby. Is the backend running?');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    console.log('Leave clicked, wallet:', publicKey?.toString());
    if (!publicKey) return;
    const addr = publicKey.toBase58();
    setBusy(true);
    setError(null);
    try {
      const res = await leaveLobby(addr);
      console.log('Leave response:', res);
      if (res.error) { setError(res.error); return; }
      setLobby(res.lobby);
      await fetchLobby();                          // (c) immediate refresh after leave
    } catch (err) {
      console.error('Leave error:', err);
      setError('Failed to leave lobby. Is the backend running?');
    } finally {
      setBusy(false);
    }
  }

  // (3) log button state on every render so DevTools shows what the button sees
  console.log('Button state:', {
    connected: !!publicKey,
    publicKey: publicKey?.toString(),
    isInLobby,
    busy,
  });

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          ← Back
        </Link>
        <div className={styles.headerCenter}>
          <span className={styles.logoText}>
            Frag<span className={styles.logoAccent}>Vault</span>
          </span>
          <span className={styles.headerLabel}>Lobby</span>
        </div>
        <div className={styles.headerRight}>
          <ConnectWalletButton />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.topBar}>
          <h1 className={styles.title}>Match Lobby</h1>
          <div className={styles.prizePool}>
            <span className={styles.prizeLabel}>Prize Pool</span>
            <span className={styles.prizeValue}>
              {prizePool.toFixed(1)}
              <span className={styles.prizeUnit}> SOL</span>
            </span>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Slot</th>
                <th className={styles.th}>Player</th>
                <th className={styles.th}>Wallet</th>
                <th className={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className={styles.tr}>
                  <td colSpan={4} className={styles.loadingRow}>
                    Loading lobby...
                  </td>
                </tr>
              ) : (
                (lobby?.slots ?? EMPTY_SLOTS).map((row) => {
                  const isMe = row.player?.walletAddress === walletAddress;
                  return (
                    <tr
                      key={row.slot}
                      className={`${styles.tr}${isMe ? ` ${styles.mySlot}` : ''}`}
                    >
                      <td className={styles.tdSlot}>#{row.slot}</td>

                      <td className={styles.tdPlayer}>
                        {row.player ? (
                          <span className={isMe ? styles.myAddress : undefined}>
                            {truncate(row.player.walletAddress)}
                            {isMe && <span className={styles.youTag}>you</span>}
                          </span>
                        ) : (
                          <span className={styles.waiting}>Waiting...</span>
                        )}
                      </td>

                      <td className={styles.tdWallet}>
                        {row.player ? (
                          truncate(row.player.walletAddress)
                        ) : (
                          <span className={styles.waiting}>—</span>
                        )}
                      </td>

                      <td className={styles.tdStatus}>
                        <span
                          className={styles.statusBadge}
                          data-status={row.player ? row.player.status : 'waiting'}
                        >
                          {row.player ? row.player.status : 'Open'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <div className={styles.actions}>
          {!publicKey ? (
            <button className={`${styles.joinBtn} ${styles.disabledBtn}`} disabled>
              Connect Wallet First
            </button>
          ) : isInLobby ? (
            <button
              className={styles.leaveBtn}
              onClick={handleLeave}
              disabled={busy || loading}
            >
              {busy ? 'Leaving...' : 'Leave Lobby'}
            </button>
          ) : (
            <button
              className={styles.joinBtn}
              onClick={handleJoin}
              disabled={busy || loading}
            >
              {busy ? 'Joining...' : 'Join Lobby'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
