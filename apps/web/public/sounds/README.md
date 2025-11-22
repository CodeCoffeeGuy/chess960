# Chess Move Sounds

This directory is for chess move sound files.

## Required Files

To enable move sounds, add the following MP3 files to this directory:

- `move.mp3` - Sound for regular moves
- `capture.mp3` - Sound for capturing pieces
- `check.mp3` - Sound for check moves
- `castle.mp3` - Sound for castling moves
- `promote.mp3` - Sound for pawn promotion moves

## How to Enable

1. Add your sound files to this directory (`/public/sounds/`)
2. Update `PlayPageClient.tsx` and `puzzle/[puzzleId]/page.tsx`:
   - Change `enabled: false` to `enabled: true` in the `sounds` prop

## Sound Sources

You can find royalty-free chess sound effects from:
- Freesound.org (Creative Commons licensed)
- OpenGameArt.org
- Zapsplat.com
- Or create your own

Make sure any sounds you use are properly licensed for your use case.

