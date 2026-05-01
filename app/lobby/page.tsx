'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { getLobby, joinLobby, leaveLobby, verifyFaceit } from '@/lib/api';
import type { LobbyState, FaceitProfile } from '@/lib/api';
import styles from './lobby.module.css';

const STAKE_PER_PLAYER = 0.5;
const TOTAL_SLOTS = 8;

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

  const [faceitInput, setFaceitInput] = useState('');
  const [faceitBusy, setFaceitBusy] = useState(false);
  const [faceitError, setFaceitError] = useState<string | null>(null);
  const [faceitProfile, setFaceitProfile] = useState<FaceitProfile | null>(null);

  const fetchLobby = useCallback(async () => {
    try {
      const data: LobbyState = await getLobby();
      setLobby(data);
    } catch (err) {
      console.error('fetchLobby error:', err);
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

  async function handleVerify() {
    const username = faceitInput.trim();
    if (!username) return;
    setFaceitBusy(true);
    setFaceitError(null);
    setFaceitProfile(null);
    try {
      const res = await verifyFaceit(username);
      if (res.error || !res.verified) {
        setFaceitError(res.error ?? 'Player not found');
      } else {
        setFaceitProfile(res);
      }
    } catch {
      setFaceitError('Could not reach verification service');
    } finally {
      setFaceitBusy(false);
    }
  }

  async function handleJoin() {
    if (!publicKey || !faceitProfile) return;
    const addr = publicKey.toBase58();
    setBusy(true);
    setError(null);
    try {
      const res = await joinLobby(addr, faceitProfile.nickname);
      if (res.error) { setError(res.error); return; }
      setLobby(res.lobby);
      await fetchLobby();
    } catch {
      setError('Failed to join lobby. Is the backend running?');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!publicKey) return;
    const addr = publicKey.toBase58();
    setBusy(true);
    setError(null);
    try {
      const res = await leaveLobby(addr);
      if (res.error) { setError(res.error); return; }
      setLobby(res.lobby);
      await fetchLobby();
    } catch {
      setError('Failed to leave lobby. Is the backend running?');
    } finally {
      setBusy(false);
    }
  }

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

        {!isInLobby && publicKey && (
          <div className={styles.faceitSection}>
            <p className={styles.faceitLabel}>FaceIT Verification</p>
            <div className={styles.faceitRow}>
              <input
                className={styles.faceitInput}
                type="text"
                placeholder="FaceIT username"
                value={faceitInput}
                onChange={(e) => {
                  setFaceitInput(e.target.value);
                  setFaceitProfile(null);
                  setFaceitError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                disabled={faceitBusy}
              />
              <button
                className={styles.verifyBtn}
                onClick={handleVerify}
                disabled={faceitBusy || !faceitInput.trim()}
              >
                {faceitBusy ? 'Checking...' : 'Verify'}
              </button>
            </div>

            {faceitError && <p className={styles.faceitError}>{faceitError}</p>}

            {faceitProfile && (
              <div className={styles.faceitCard}>
                {faceitProfile.avatar && (
                  <Image
                    src={faceitProfile.avatar}
                    alt={faceitProfile.nickname}
                    width={40}
                    height={40}
                    className={styles.faceitAvatar}
                    unoptimized
                  />
                )}
                <div className={styles.faceitInfo}>
                  <span className={styles.faceitNickname}>{faceitProfile.nickname}</span>
                  <span className={styles.faceitStats}>
                    Level {faceitProfile.skillLevel} &middot; {faceitProfile.elo} ELO
                  </span>
                </div>
                <span className={styles.faceitVerifiedBadge}>✓ Verified</span>
              </div>
            )}
          </div>
        )}

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
              disabled={busy || loading || !faceitProfile}
            >
              {busy ? 'Joining...' : 'Join Lobby'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
