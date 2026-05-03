# FragVault

CS:GO competitive staking platform. Players verify FaceIT identity, stake 0.5 SOL, winner takes the pool (85%), owner takes 15% fee.

## Stack
- Frontend: Next.js 14 + TypeScript + CSS Modules (port 3000)
- Backend: Fastify + TypeScript + PostgreSQL + Prisma (port 4000)
- Blockchain: Solana devnet, Anchor smart contract
- Game API: FaceIT Data API
- Docker: all services run with docker compose up -d

## Structure
- app/ — Next.js pages (landing, lobby)
- components/ — WalletProvider, ConnectWalletButton
- lib/api.ts — getLobby, joinLobby, leaveLobby, verifyFaceit
- backend/src/routes/ — lobby.ts, faceit.ts
- backend/src/lib/ — prisma.ts, solana.ts, contract.ts
- backend/src/store/ — lobby.ts (PostgreSQL via Prisma)
- backend/prisma/schema.prisma — Player, Lobby, LobbySlot, Match, Transaction
- fragvault-contract/ — Anchor smart contract (Rust)
- fragvault-contract/src/generated/ — Codama TypeScript client

## Working features
- Landing page + lobby UI (dark esports theme, CSS Modules)
- Solana wallet connect (Phantom + Solflare, devnet)
- FaceIT player verification (Data API, Bearer token)
- Live 5v5 lobby (Team A vs Team B, 5 slots each)
- Backend API (GET /lobby, POST /lobby/join, POST /lobby/leave)
- FaceIT verification (GET /faceit/verify/:username)
- PostgreSQL database with Prisma (Player, Lobby, LobbySlot, Match, Transaction)
- Docker setup (frontend + backend + postgres, one command)
- Anchor smart contract deployed on Solana devnet
- Codama TypeScript client generated
- Contract wired to backend (initializeLobby, depositPlayer, releasePool, refundLobby)

## Smart Contract
- Program ID: 3Cj3ZhJsZRhZ1rF8Er2ZnwFY1Xjz2gefnvcHWV1zheu9
- Network: Solana devnet
- Authority wallet: HKL6d8dk8eisJZhSgwAUN8VWe3hrxZR7cEjxf4yeUFw4
- Instructions: initialize_lobby, deposit, release_pool, refund
- Stake: 0.5 SOL per player
- Split: 85% winners / 15% platform fee

## Environment variables (backend/.env)
- PORT=4000
- FRONTEND_URL=http://localhost:3000
- JWT_SECRET=fragvault_secret_2024
- FACEIT_API_KEY=your_faceit_key
- DATABASE_URL=postgresql://fragvault:fragvault123@postgres:5432/fragvault
- SOLANA_PRIVATE_KEY=your_base58_private_key
- SOLANA_NETWORK=devnet
- PROGRAM_ID=3Cj3ZhJsZRhZ1rF8Er2ZnwFY1Xjz2gefnvcHWV1zheu9

## Docker commands
- Start: docker compose up -d
- Stop: docker compose down
- Rebuild: docker compose up -d --build
- Logs: docker compose logs -f

## Next task
Fix real SOL deposit flow:
- Frontend builds unsigned transaction using contract IDL
- Phantom popup opens for player to sign
- 0.5 SOL actually moves to contract escrow PDA
- Backend verifies tx confirmed on-chain before saving player to DB
- Show "Signing..." and "Confirming..." states in UI


#aa