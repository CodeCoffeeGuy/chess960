# Chess960

<div align="center">

A modern, real-time Chess960 (Fischer Random Chess) platform with tournaments, study mode, opening explorer, puzzles, social features, and advanced gameplay.

[![AGPL License](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Live Demo](https://chess960.game) · [Report Bug](https://github.com/CodeAndCoffeeGuy/Chess960/issues/new?template=bug_report.md) · [Request Feature](https://github.com/CodeAndCoffeeGuy/Chess960/issues/new?template=feature_request.md)

</div>

---

## About

Chess960 is an open-source, real-time platform for Fischer Random Chess. Play online with players worldwide across all time controls—from lightning-fast bullet to classical games. Experience competitive tournaments, build your rating, create and share annotated studies, explore openings, solve puzzles, and enjoy chess without memorization.

### What is Chess960?

Chess960, also known as Fischer Random Chess, is a chess variant invented by Bobby Fischer. Instead of the traditional starting position, the pieces on the back rank are randomly shuffled following specific rules:
- Bishops must be on opposite-colored squares
- The king must be between the rooks
- All 960 possible starting positions are supported

### Key Features

#### Competitive Play
- **Real-time multiplayer** with WebSocket technology
- **All time controls**: Bullet, Blitz, Rapid, and Classical
- **Glicko-2 rating system** with separate ratings per time control
- **Smart matchmaking** with configurable rating ranges
- **Rated and casual games**

#### Tournaments
- **Arena tournaments** with win streak bonuses
- **Team tournaments** for organized competition
- **Tournament calendar** to track upcoming events
- **Performance ratings** and podium displays
- **Real-time leaderboards** during tournaments
- **Anti-ragequit system** for fair play
- **Tournament chat** for real-time communication

#### Game Features
- **Chess960 positions** (all 960 starting positions)
- **Premoves** for lightning-fast play
- **Move arrows** and square highlighting
- **Takeback requests** and draw offers
- **Rematch offers** after games
- **Spectator mode** with live viewer list
- **Game analysis** with Stockfish engine
- **Post-game analysis** with move accuracy and evaluation graphs
- **PGN export** for all games

#### Learning & Training
- **Study Mode** - Create and share annotated game studies
  - Multiple chapters per study
  - Move-by-move annotations with comments
  - Glyphs (!, ?, !!, ??) for move evaluation
  - Variations (alternative lines)
  - Visual annotations (arrows and circles on board)
  - PGN import/export
  - Tags for categorization and search
  - Drag & drop chapter reordering
  - Public and private studies
  - Like and comment system
- **Opening Explorer** - Database of Chess960 opening moves
  - All 960 starting positions
  - Move statistics (win rate, popularity, average rating)
  - Opening lines with move navigation
  - Game linking (played games appear in explorer)
- **Practice Mode** - Interactive lessons (coming soon)
- **Puzzles** - Daily puzzles with rating system
  - Puzzle themes and voting
  - Puzzle dashboard and history
  - Glicko-2 puzzle rating
  - Keyboard navigation for reviewing moves

#### Social Features
- **User profiles** with statistics and rating graphs
- **Follow system** to track favorite players
- **Direct messaging** with followers
- **Friend requests** and management
- **Direct challenges** with custom time controls
- **Global leaderboards** by time control
- **Tournament champions hall**

#### Customization
- **6 board themes** (brown, blue, green, purple, grey, wood)
- **Light and dark modes**
- **Sound effects** toggle
- **Privacy controls** for challenges and messages
- **Keyboard shortcuts** for navigation

#### Lobby System
- **Custom lobbies** with rating filters
- **Browse active lobbies** by speed
- **Create private or public games**
- **Real-time lobby updates**

## Quick Start

### Prerequisites

- **Node.js** 18 or higher
- **pnpm** 8 or higher
- **PostgreSQL** 16
- **Redis** 7

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/CodeAndCoffeeGuy/Chess960.git
   cd Chess960
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and configure:
   - `DATABASE_URL` - PostgreSQL connection string
   - `REDIS_URL` - Redis connection string
   - `JWT_SECRET` - Random secret for JWT tokens (generate with `openssl rand -base64 32`)
   - `NEXTAUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)
   - `NEXT_PUBLIC_WS_URL` - WebSocket server URL

4. **Initialize database**
   ```bash
   pnpm db:generate  # Generate Prisma client
   pnpm db:migrate   # Run migrations
   ```

5. **Start development servers**
   ```bash
   pnpm dev          # Starts web + realtime server
   ```

6. **Access the application**
   - Web: http://localhost:3000
   - WebSocket: ws://localhost:8080
   - Health Check: http://localhost:8081/health

## Architecture

### Project Structure

```
chess960/
├── apps/
│   ├── web/              # Next.js 15 frontend
│   │   ├── src/
│   │   │   ├── app/      # App router pages
│   │   │   ├── components/  # React components
│   │   │   └── hooks/    # Custom React hooks
│   │   └── package.json
│   │
│   └── realtime/         # WebSocket game server
│       ├── src/
│       │   ├── simple-server.ts  # Main server
│       │   └── services/         # Game logic
│       └── package.json
│
├── packages/
│   ├── db/              # Database schema & client
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── index.ts
│   │
│   ├── chess960-board/  # Custom Chess960 board component
│   │   └── src/         # React board component
│   │
│   ├── chess960-puzzle-generator/  # Puzzle generation
│   │   └── src/         # Stockfish-based puzzle generator
│   │
│   ├── proto/           # Shared TypeScript types
│   ├── rating/          # Glicko-2 rating algorithm
│   ├── redis-client/    # Redis operations
│   ├── timer/           # Game clock implementation
│   ├── stockfish/       # Chess engine integration
│   └── utils/           # Chess960 position generation
│
└── package.json         # Root workspace config
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 18, Tailwind CSS |
| **Chess UI** | @chess960/board (custom), chess.js |
| **Backend** | Node.js, WebSocket (ws library) |
| **Database** | PostgreSQL 16 (Prisma ORM) |
| **Cache** | Redis 7 |
| **Auth** | NextAuth.js (email, OAuth) |
| **Analysis** | Stockfish chess engine |
| **Deployment** | Vercel (web), Fly.io (realtime) |

### Data Flow

```
┌─────────────┐
│   Browser   │
│  (Next.js)  │
└──────┬──────┘
       │ HTTP + WebSocket
       ├─────────────────┐
       │                 │
   ┌───▼────┐      ┌────▼────┐
   │ Vercel │      │  Fly.io │
   │  Web   │      │ Realtime│
   └───┬────┘      └────┬────┘
       │                │
       │                │ WebSocket
       │                │
       └────────┬───────┘
                │
         ┌──────▼──────┐
         │ PostgreSQL  │
         │   + Redis   │
         └─────────────┘
```

## Development

### Available Scripts

```bash
# Development
pnpm dev              # Start all services (web + realtime)
pnpm dev:web          # Start frontend only
pnpm dev:realtime     # Start game server only

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Prisma Studio (GUI)
pnpm db:push          # Push schema without migration

# Build & Deploy
pnpm build            # Build all packages
pnpm lint             # Lint all code
pnpm typecheck        # Type check all packages
```

### Environment Variables

See `.env.example` for all available configuration options.

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT token signing
- `NEXTAUTH_SECRET` - NextAuth.js secret
- `NEXT_PUBLIC_WS_URL` - WebSocket server URL

**Optional:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth
- `RESEND_API_KEY` - Email service for magic links
- `STRIPE_SECRET_KEY` - Payment processing
- `NEXT_PUBLIC_POSTHOG_KEY` - Analytics

## Deployment

### Web App (Vercel)

```bash
vercel deploy --prod
```

Environment variables needed:
- `DATABASE_URL`
- `REDIS_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_WS_URL`

### Game Server (Fly.io)

```bash
fly deploy --config apps/realtime/fly.toml
```

Secrets to set:
```bash
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set JWT_SECRET="..."
fly secrets set REDIS_URL="redis://..."
```

## Contributing

We love contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code of Conduct
- Development workflow
- Pull request process
- Coding standards

### Quick Contribution Guide

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Bobby Fischer** for creating Chess960
- [chess.js](https://github.com/jhlywa/chess.js) for chess logic and Chess960 support
- [Stockfish](https://stockfishchess.org/) for the powerful chess engine
- [Glicko-2](http://www.glicko.net/glicko.html) rating system by Mark Glickman
- The open-source chess community for inspiration and feedback

## Community & Support

- **Website**: https://chess960.game
- **Issues**: [GitHub Issues](https://github.com/CodeAndCoffeeGuy/Chess960/issues)
- **Discussions**: [GitHub Discussions](https://github.com/CodeAndCoffeeGuy/Chess960/discussions)
- **Email**: support@chess960.game

---

<div align="center">

Built by [Nikolas Stojak](https://github.com/CodeAndCoffeeGuy)

If you find this project useful, please star it on GitHub!

</div>
