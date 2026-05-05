# FragVault

CS:GO competitive staking platform. Players verify FaceIT identity, stake 0.5 SOL, winner takes pool (85%), owner takes 15% fee.

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
- Landing page + 5v5 lobby UI (dark esports theme)
- Solana wallet connect (Phantom + Solflare, devnet)
- FaceIT player verification (Data API, Bearer token)
- Real SOL deposit via Phantom signing
- On-chain refund when player leaves
- PostgreSQL + Prisma v5 database
- Anchor smart contract deployed on devnet
- Deployed to Vercel + Railway

## Smart Contract
- Program ID: 3Cj3ZhJsZRhZ1rF8Er2ZnwFY1Xjz2gefnvcHWV1zheu9
- Network: Solana devnet
- Authority: HKL6d8dk8eisJZhSgwAUN8VWe3hrxZR7cEjxf4yeUFw4
- PDA seed: Buffer('lobby') + Buffer(lobbyId.replace(/-/g,''))
- Stake: 0.5 SOL per player, split 85% winners / 15% platform

## Next tasks
1. FaceIT match creation (apply organizer at faceit.com)
2. Match result webhook to backend
3. release_pool() call to pay winners automatically
4. FaceIT OAuth for proper identity verification
5. Mainnet launch
