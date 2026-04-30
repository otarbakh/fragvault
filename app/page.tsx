import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.noise} aria-hidden="true" />

      <div className={styles.hero}>
        <div className={styles.badge}>CS:GO Competitive Staking</div>

        <h1 className={styles.title}>
          Frag<span className={styles.accent}>Vault</span>
        </h1>

        <p className={styles.tagline}>Stake. Compete. Win.</p>

        <p className={styles.sub}>
          Enter a lobby, stake your SOL, and prove you&apos;re the last one standing.
          The prize pool goes to the top fragment.
        </p>

        <Link href="/lobby" className={styles.cta}>
          Join Lobby
        </Link>
      </div>

      <footer className={styles.footer}>
        <span>FragVault &copy; 2026</span>
        <span className={styles.footerDot}>·</span>
        <span>Powered by Solana</span>
      </footer>
    </main>
  );
}
