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
- lib/api.ts — getLobby, joinLobby, leaveLobby, verifyFaceit, getDepositInfo
- backend/src/routes/ — lobby.ts, faceit.ts
- backend/src/lib/ — prisma.ts, solana.ts, contract.ts
- backend/src/store/ — lobby.ts (PostgreSQL via Prisma)
- backend/prisma/schema.prisma — Player, Lobby, LobbySlot, Match, Transaction
- fragvault-contract/ — Anchor smart contract (Rust)
- fragvault-contract/src/generated/ — Codama TypeScript client

## Working features
- Landing page + lobby UI (dark esports theme)
- Solana wallet connect (Phantom + Solflare, devnet)
- FaceIT player verification (Data API, Bearer token)
- Live 5v5 lobby (Team A vs Team B, 5 slots each)
- Backend API (GET /lobby, POST /lobby/join, POST /lobby/leave)
- GET /lobby/deposit-info — returns PDA address for frontend tx building
- PostgreSQL database with Prisma
- Docker setup (frontend + backend + postgres)
- Anchor smart contract deployed on Solana devnet
- Real SOL deposit flow — Phantom signs 0.5 SOL transaction
- On-chain refund when player leaves lobby
- Codama TypeScript client generated

## Smart Contract
- Program ID: 3Cj3ZhJsZRhZ1rF8Er2ZnwFY1Xjz2gefnvcHWV1zheu9
- Network: Solana devnet
- Authority wallet: HKL6d8dk8eisJZhSgwAUN8VWe3hrxZR7cEjxf4yeUFw4
- Instructions: initialize_lobby, deposit, release_pool, refund, refund_single_player
- Stake: 0.5 SOL per player
- Split: 85% winners / 15% platform fee
- PDA seed: Buffer('lobby') + Buffer(lobbyId.replace(/-/g,''))

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
Fix Railway deployment - Prisma v7 client error:
- Error: Cannot find module '.prisma/client/default'
- Fix: add previewFeatures = ["driverAdapters"] to prisma/schema.prisma
- Fix: rewrite backend/src/lib/prisma.ts to use PrismaPg adapter properly
- nixpacks.toml already exists in backend/ with correct build order
- After fix: commit, push, Railway auto-redeploys