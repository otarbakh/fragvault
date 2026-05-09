'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import styles from '../auth.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function RegisterPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [faceitUsername, setFaceitUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  const walletAddress = publicKey?.toBase58() ?? '';

  async function handleRegister() {
    if (!walletAddress || !faceitUsername || !password) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceitUsername, walletAddress, password }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Registration failed');
        return;
      }
      localStorage.setItem('fv_token', data.token ?? '');
      router.push('/lobby');
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <span className={styles.logoText}>
          Frag<span className={styles.logoAccent}>Vault</span>
        </span>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Create Account</h1>

          <a href={`${API_URL}/auth/faceit`} className={styles.faceitBtn}>
            Connect with FaceIT
          </a>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            or
            <span className={styles.dividerLine} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>FaceIT Username</label>
            <input
              className={styles.input}
              type="text"
              placeholder="your_faceit_name"
              value={faceitUsername}
              onChange={(e) => setFaceitUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Wallet</label>
            {mounted && !publicKey && <ConnectWalletButton />}
            {walletAddress && (
              <input
                className={`${styles.input} ${styles.readOnly}`}
                type="text"
                value={walletAddress}
                readOnly
              />
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.btn}
            onClick={handleRegister}
            disabled={loading || !walletAddress || !faceitUsername || password.length < 8}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>

          <p className={styles.foot}>
            Already have an account?{' '}
            <Link href="/login" className={styles.footLink}>Log in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
