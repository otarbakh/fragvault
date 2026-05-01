# FragVault

CS:GO competitive staking platform. Players verify FaceIT identity, stake 0.5 SOL, winner takes the pool (85%), owner takes 15% fee.

## Stack
- Frontend: Next.js 14 + TypeScript + CSS Modules (port 3000)
- Backend: Fastify + TypeScript (port 4000)
- Blockchain: Solana devnet, Anchor smart contracts (coming)
- Game API: FaceIT API

## Structure
- `app/` — Next.js pages (landing, lobby)
- `components/` — WalletProvider, ConnectWalletButton
- `lib/api.ts` — getLobby, joinLobby, leaveLobby
- `backend/src/` — Fastify server, routes, in-memory lobby store

## Working features
- Landing page + lobby UI (dark esports theme)
- Solana wallet connect (Phantom + Solflare, devnet)
- Live lobby (8 slots, polls every 3s, prize pool counter)
- Backend API (GET /lobby, POST /lobby/join, POST /lobby/leave)


## Next task
FaceIT player verification using Data API (Bearer token, no OAuth needed)
- GET /faceit/verify/:username → checks player exists via FaceIT Data API
- Frontend: username input + verify button → unlocks Join Lobby
- Store faceitUsername in lobby slot alongside wallet address
- FACEIT_API_KEY is already in backend/.env