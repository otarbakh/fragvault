import type { Metadata } from 'next';
import './globals.css';
import SolanaWalletProvider from '@/components/WalletProvider';

export const metadata: Metadata = {
  title: 'FragVault — Stake. Compete. Win.',
  description: 'CS:GO competitive staking platform. Enter lobbies, stake SOL, and fight for the prize pool.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SolanaWalletProvider>{children}</SolanaWalletProvider>
      </body>
    </html>
  );
}
