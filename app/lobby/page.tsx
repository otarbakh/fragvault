'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { getLobby, joinLobby, leaveLobby, verifyFaceit, getDepositInfo } from '@/lib/api';
import type { LobbyState, LobbySlot, Team, FaceitProfile, GameMode } from '@/lib/api';
import styles from './lobby.module.css';

// deposit instruction discriminator from the IDL
const DEPOSIT_DISC = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);

function truncate(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function emptyTeam(size: number, team: Team): LobbySlot[] {
  return Array.from({ length: size }, (_, i) => ({ slot: i + 1, team, player: null }));
}

function padTeam(slots: LobbySlot[], team: Team, size: number): LobbySlot[] {
  return Array.from({ length: size }, (_, i) => {
    const slotNum = i + 1;
    return slots.find((s) => s.slot === slotNum) ?? { slot: slotNum, team, player: null };
  });
}

// Borsh string: 4-byte LE length prefix + UTF-8 bytes
function borshStr(s: string): Buffer {
  const utf8 = Buffer.from(s, 'utf8');
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32LE(utf8.length, 0);
  return Buffer.concat([len, utf8]);
}

type JoinStep = 'preparing' | 'signing' | 'confirming' | null;

export default function LobbyPage() {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinStep, setJoinStep] = useState<JoinStep>(null);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [faceitInput, setFaceitInput] = useState('');
  const [faceitBusy, setFaceitBusy] = useState(false);
  const [faceitError, setFaceitError] = useState<string | null>(null);
  const [faceitProfile, setFaceitProfile] = useState<FaceitProfile | null>(null);
  const [mode, setMode] = useState<GameMode>('1v1');

  const fetchLobby = useCallback(async () => {
    try {
      const data: LobbyState = await getLobby(mode);
      setLobby(data);
    } catch (err) {
      console.error('fetchLobby error:', err);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!localStorage.getItem('fv_token')) router.push('/login');
  }, [router]);

  useEffect(() => {
    fetchLobby();
    const interval = setInterval(fetchLobby, 3000);
    return () => clearInterval(interval);
  }, [fetchLobby]);

  const walletAddress = publicKey?.toBase58() ?? null;
  const allSlots = [...(lobby?.teamA ?? []), ...(lobby?.teamB ?? [])];
  const mySlot = walletAddress
    ? allSlots.find((s) => s.player?.walletAddress.toLowerCase() === walletAddress.toLowerCase())
    : undefined;
  const isInLobby = !!mySlot;
  const prizePool = lobby?.prizePool ?? 0;

  const maxSlots = mode === '1v1' ? 1 : 5;
  const teamASlots = lobby ? padTeam(lobby.teamA, 'TEAM_A', maxSlots) : emptyTeam(maxSlots, 'TEAM_A');
  const teamBSlots = lobby ? padTeam(lobby.teamB, 'TEAM_B', maxSlots) : emptyTeam(maxSlots, 'TEAM_B');

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

  async function handleJoin(team: Team) {
    if (!publicKey || !faceitProfile) return;
    const addr = publicKey.toBase58();
    setError(null);

    try {
      // Step 1: ensure lobby PDA is initialized on-chain, get IDs
      setJoinStep('preparing');
      const depositInfo = await getDepositInfo(mode);
      if (depositInfo.error) throw new Error(depositInfo.error);

      const { lobbyId, pdaAddress, programId } = depositInfo;
      const programIdPk = new PublicKey(programId);
      const pda = new PublicKey(pdaAddress);
      const teamIndex = team === 'TEAM_A' ? 0 : 1;

      // Step 2: build the deposit instruction
      const data = Buffer.concat([
        DEPOSIT_DISC,
        borshStr(lobbyId),
        Buffer.from([teamIndex]),
      ]);

      const ix = new TransactionInstruction({
        programId: programIdPk,
        keys: [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      tx.add(ix);

      // Step 3: open Phantom for player signature
      setJoinStep('signing');
      let signature: string;
      try {
        signature = await sendTransaction(tx, connection, {
          skipPreflight: true,
          preflightCommitment: 'confirmed',
        });
      } catch (err: unknown) {
        const e = err as Record<string, unknown>;
        console.error('Full sendTransaction error:', JSON.stringify(err, null, 2));
        console.error('Error message:', e?.message);
        console.error('Error logs:', e?.logs);
        const logs = (e?.logs as string[] | undefined)?.join('\n') ?? '';
        if (logs.includes('AlreadyDeposited')) {
          throw new Error('You already deposited for this lobby. Leave first.');
        }
        if (logs.includes('TeamFull')) {
          throw new Error('That team is full!');
        }
        if (logs.includes('InvalidStatus')) {
          throw new Error('Lobby is not accepting deposits right now.');
        }
        throw new Error((e?.message as string) || 'Transaction failed - check console');
      }

      // Step 4: wait for on-chain confirmation
      setJoinStep('confirming');
      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      console.log('Confirmation:', JSON.stringify(confirmation, null, 2));
      if (confirmation.value.err) {
        console.error('Transaction failed with:', confirmation.value.err);
        throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
      }

      // Step 5: register in backend (backend re-verifies the tx)
      const res = await joinLobby(addr, team, faceitProfile.nickname, signature, mode);
      if (res.error) { setError(res.error); return; }
      await fetchLobby();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to join lobby';
      // "User rejected" comes from wallet adapters when player dismisses Phantom
      setError(msg.toLowerCase().includes('reject') ? 'Transaction rejected' : msg);
    } finally {
      setJoinStep(null);
    }
  }

  async function handleLeave() {
    if (!publicKey) return;
    const addr = mySlot?.player?.walletAddress ?? publicKey.toBase58();
    setError(null);
    setLeaving(true);
    try {
      const res = await leaveLobby(addr);
      if (res.error) { setError(res.error); return; }
      await fetchLobby();
    } catch {
      setError('Failed to leave lobby. Is the backend running?');
    } finally {
      setLeaving(false);
    }
  }

  function renderTeamRows(slots: LobbySlot[]) {
    return slots.map((row) => {
      const isMe = !!row.player && !!walletAddress &&
        row.player.walletAddress.toLowerCase() === walletAddress.toLowerCase();
      return (
        <tr
          key={`${row.team}-${row.slot}`}
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
    });
  }

  const busy = joinStep !== null;
  const joinLabel = (team: string) => {
    if (joinStep === 'preparing') return 'Preparing...';
    if (joinStep === 'signing') return 'Signing...';
    if (joinStep === 'confirming') return 'Confirming...';
    return `Join ${team}`;
  };

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
          {mounted && <ConnectWalletButton />}
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.topBar}>
          <h1 className={styles.title}>Match Lobby</h1>
          <div className={styles.prizePool}>
            <span className={styles.prizeLabel}>Prize Pool</span>
            <span className={styles.prizeValue}>
              {parseFloat(prizePool.toFixed(3))}
              <span className={styles.prizeUnit}> SOL</span>
            </span>
          </div>
        </div>

        <div className={styles.modeBar}>
          {(['1v1', '5v5'] as GameMode[]).map((m) => (
            <button
              key={m}
              className={`${styles.modeBtn}${mode === m ? ` ${styles.modeBtnActive}` : ''}`}
              onClick={() => setMode(m)}
              disabled={isInLobby}
            >
              {m}
            </button>
          ))}
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
                <>
                  <tr className={styles.teamHeader}>
                    <td colSpan={4} className={styles.teamHeaderCell}>Team A</td>
                  </tr>
                  {renderTeamRows(teamASlots)}
                  <tr className={styles.teamHeader}>
                    <td colSpan={4} className={styles.teamHeaderCell}>Team B</td>
                  </tr>
                  {renderTeamRows(teamBSlots)}
                </>
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
              disabled={busy || loading || leaving}
            >
              {leaving ? 'Leaving...' : 'Leave Lobby'}
            </button>
          ) : (
            <div className={styles.teamButtons}>
              <button
                className={styles.joinBtn}
                onClick={() => handleJoin('TEAM_A')}
                disabled={busy || loading || !faceitProfile}
              >
                {joinLabel('Team A')}
              </button>
              <button
                className={styles.joinBtn}
                onClick={() => handleJoin('TEAM_B')}
                disabled={busy || loading || !faceitProfile}
              >
                {joinLabel('Team B')}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
