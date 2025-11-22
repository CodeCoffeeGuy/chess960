# @chess960/puzzle-generator

Generate high-quality Chess960 (Fischer Random Chess) tactical puzzles using Stockfish engine analysis.

## Features

- 🎲 **Random Chess960 Positions**: Generates puzzles from all 960 possible starting positions
- 🧠 **Stockfish Analysis**: Uses Stockfish engine to find tactical opportunities
- 📊 **Automatic Rating**: Assigns difficulty ratings based on puzzle complexity
- 🎯 **Tactical Focus**: Identifies captures, checks, checkmates, and material advantages
- ⚡ **Configurable**: Customize depth, move ranges, and rating bounds

## Installation

```bash
npm install @chess960/puzzle-generator chess.js stockfish
```

## Usage

### Basic Example

```typescript
import { Chess960PuzzleGenerator } from '@chess960/puzzle-generator';
import { StockfishEngine } from '@chess960/stockfish';
import { getChess960Position } from '@chess960/utils';

const engine = new StockfishEngine();
const generator = new Chess960PuzzleGenerator(engine);

const puzzles = await generator.generatePuzzles({
  count: 50,
  getChess960Position,
  onProgress: (current, total, puzzle) => {
    console.log(`Generated ${current}/${total} puzzles`);
    if (puzzle) {
      console.log(`  Rating: ${puzzle.rating}, FEN: ${puzzle.fen}`);
    }
  }
});

console.log(`Generated ${puzzles.length} puzzles!`);
```

### Advanced Options

```typescript
const puzzles = await generator.generatePuzzles({
  count: 100,
  depth: 15,                    // Stockfish analysis depth
  minMoves: 20,                 // Minimum moves before analyzing
  maxMoves: 40,                 // Maximum moves before analyzing
  minRating: 1500,             // Minimum puzzle rating
  maxRating: 2200,             // Maximum puzzle rating
  chess960Position: 518,        // Use specific position (1-960)
  getChess960Position,
  onProgress: (current, total, puzzle) => {
    // Progress callback
  }
});
```

### Generate Single Puzzle

```typescript
const puzzle = await generator.generatePuzzle({
  chess960Position: 518,
  getChess960Position,
  depth: 12,
  minMoves: 15,
  maxMoves: 30
});

if (puzzle) {
  console.log('Puzzle:', puzzle.fen);
  console.log('Solution:', puzzle.solution);
  console.log('Rating:', puzzle.rating);
}
```

## API Reference

### `Chess960PuzzleGenerator`

#### Constructor

```typescript
new Chess960PuzzleGenerator(engine: StockfishEngine)
```

- `engine`: A Stockfish engine instance that implements the `StockfishEngine` interface

#### Methods

##### `generatePuzzles(options)`

Generate multiple puzzles.

**Parameters:**
- `options.count` (number, optional): Number of puzzles to generate (default: 50)
- `options.depth` (number, optional): Stockfish analysis depth (default: 12)
- `options.minMoves` (number, optional): Minimum moves before analyzing (default: 15)
- `options.maxMoves` (number, optional): Maximum moves before analyzing (default: 30)
- `options.minRating` (number, optional): Minimum puzzle rating (default: 1200)
- `options.maxRating` (number, optional): Maximum puzzle rating (default: 2500)
- `options.chess960Position` (number, optional): Specific position number (1-960)
- `options.getChess960Position` (function, required): Function to get Chess960 position
- `options.onProgress` (function, optional): Progress callback

**Returns:** `Promise<Puzzle[]>`

##### `generatePuzzle(options)`

Generate a single puzzle candidate.

**Parameters:**
- `options.chess960Position` (number, optional): Specific position number (1-960)
- `options.getChess960Position` (function, required): Function to get Chess960 position
- `options.depth` (number, optional): Stockfish analysis depth (default: 12)
- `options.minMoves` (number, optional): Minimum moves before analyzing (default: 15)
- `options.maxMoves` (number, optional): Maximum moves before analyzing (default: 30)

**Returns:** `Promise<PuzzleCandidate | null>`

### Types

#### `Puzzle`

```typescript
interface Puzzle {
  fen: string;                    // Position FEN
  solution: string;                // Best move (UCI)
  moves: string[];                // Solution line (UCI moves)
  rating: number;                 // Difficulty rating (1200-2500)
  initialFen?: string;            // Initial Chess960 FEN
  chess960Position?: number;      // Position number (1-960)
}
```

#### `PuzzleCandidate`

```typescript
interface PuzzleCandidate extends Puzzle {
  evaluation: number;             // Stockfish evaluation
}
```

## How It Works

1. **Generate Random Position**: Creates a random Chess960 starting position (1-960)
2. **Play Random Moves**: Plays 15-30 random moves to reach mid-game positions
3. **Stockfish Analysis**: Analyzes the position with Stockfish (depth 12)
4. **Identify Tactics**: Finds tactical moves (captures, checks, checkmates)
5. **Assign Rating**: Calculates difficulty based on complexity
6. **Deduplicate**: Ensures each puzzle is unique

## Puzzle Rating System

- **1200-1400**: Basic tactics (simple captures, checks)
- **1400-1800**: Intermediate tactics (combinations, forks)
- **1800-2200**: Advanced tactics (complex combinations)
- **2200-2500**: Expert tactics (checkmates, deep combinations)

## Requirements

- Node.js 18+
- Stockfish engine (via `stockfish` npm package)
- Chess.js for position handling
- Chess960 position generator (e.g., `@chess960/utils`)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related Projects

- [@chess960/board](https://github.com/CodeAndCoffeeGuy/chess960) - Chess960 board component
- [@chess960/utils](https://github.com/CodeAndCoffeeGuy/chess960) - Chess960 utilities
- [@chess960/stockfish](https://github.com/CodeAndCoffeeGuy/chess960) - Stockfish integration














