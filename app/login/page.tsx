'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../auth.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  const router = useRouter();
  const [faceitUsername, setFaceitUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!faceitUsername || !password) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceitUsername, password }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Login failed');
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
          <h1 className={styles.title}>Log In</h1>

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
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.btn}
            onClick={handleLogin}
            disabled={loading || !faceitUsername || !password}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>

          <p className={styles.foot}>
            No account?{' '}
            <Link href="/register" className={styles.footLink}>Register</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
