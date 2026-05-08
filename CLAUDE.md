# FragVault

CS:GO competitive staking platform. Players register with FaceIT identity + Phantom wallet, stake SOL, winner takes pool (85%), owner takes 15% fee.

## Live URLs
- Frontend: https://project-8fyo0.vercel.app
- Backend: https://fragvault-production-7aba.up.railway.app
- GitHub: https://github.com/otarbakh/fragvault

## Stack
- Frontend: Next.js 14 + TypeScript + CSS Modules (Vercel)
- Backend: Fastify + TypeScript + PostgreSQL + Prisma v5 (Railway)
- Blockchain: Solana devnet, Anchor smart contract
- Game API: FaceIT Data API
- Local dev: docker compose up -d

## Working features
- Landing page + lobby UI (dark esports theme)
- User registration + login (FaceIT username + Phantom wallet + password, JWT auth)
- Solana wallet connect (Phantom + Solflare, devnet)
- FaceIT player verification (Data API, Bearer token)
- 1v1 and 5v5 lobby modes (separate lobbies, mode selector in UI)
- Real SOL deposit via Phantom signing (0.001 SOL per player on devnet)
- On-chain refund when player leaves lobby
- Leave lobby working (case-insensitive wallet lookup)
- Both players join same lobby simultaneously
- Lobby goes FULL at 2 players (1v1) with correct prize pool
- Match Found screen appears for both players when lobby fills
- Lobby ID locked when FULL — frontend stays on correct lobby
- PostgreSQL + Prisma v5 database
- Anchor smart contract deployed on devnet
- Deployed to Vercel + Railway
- FaceIT organizer page created (ID: 82272f43-2b72-47d4-9f92-9d8e3a0f76d8)
- FaceIT match creation via organizer API (POST /match/create)
- Auto-triggers when lobby becomes FULL
- Webhook handler for auto SOL payout (POST /webhooks/faceit)
- Admin manual override endpoint (POST /admin/match/release)

## Smart Contract
- Program ID: 3Cj3ZhJsZRhZ1rF8Er2ZnwFY1Xjz2gefnvcHWV1zheu9
- Network: Solana devnet
- Authority: HKL6d8dk8eisJZhSgwAUN8VWe3hrxZR7cEjxf4yeUFw4
- PDA seed: Buffer('lobby') + Buffer(lobbyId.replace(/-/g,''))
- Stake: 0.001 SOL per player on devnet, split 85% winners / 15% platform

## Infrastructure
- Frontend: Vercel (auto-deploys on git push)
- Backend: Railway (auto-deploys on git push)
- Database: PostgreSQL on Railway
- Local dev: docker compose up -d

## Environment Variables (names only — values stored in Railway)
- PORT
- FRONTEND_URL
- JWT_SECRET
- DATABASE_URL
- SOLANA_PRIVATE_KEY
- SOLANA_NETWORK
- PROGRAM_ID
- FACEIT_API_KEY
- FACEIT_ORGANIZER_ID
- FACEIT_APP_ID
- FACEIT_WEBHOOK_SECRET
- ADMIN_SECRET
- BACKEND_URL

## Known issues
- Match Found spinner loops forever — FaceIT match creation fails because players have no real FaceIT IDs linked (needs OAuth)
- Old wallet 5bCr...bohd has PDA conflict on devnet — use 69Ga...397i for testing
- Lobby page accessible without login (auth check needs fix)

## Next tasks
1. Add 30 second timeout on Match Found spinner with friendly error message
2. FaceIT OAuth — proper identity verification, links real FaceIT ID to wallet
3. Fix lobby page auth check (redirect to /login if no JWT)
4. Mainnet launch (change stake back to 0.5 SOL)
