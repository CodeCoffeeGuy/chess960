# Feature Comparison: Chess960Board vs Lichess

This document compares the features of our `@chess960/board` package with Lichess's board implementation.

## ✅ Implemented Features

### Core Functionality
- ✅ **Piece Move Animations** - Smooth CSS transitions for piece movements
- ✅ **Ghost Piece During Drag** - Semi-transparent piece follows cursor during drag
- ✅ **Configurable Animation Duration** - Can be set to any value or disabled (0ms)
- ✅ **Destination Highlighting** - Shows all legal moves with dots/rings when piece is selected
- ✅ **Arrow Snapping to Valid Moves** - Arrows automatically snap to nearest legal move square
- ✅ **Arrow Drawing** - Right-click drag to draw arrows on the board
- ✅ **Square Highlighting** - Right-click squares to highlight them
- ✅ **Premove Support** - Can make moves when it's not your turn
- ✅ **Promotion Handling** - Custom promotion dialog callback
- ✅ **Check Highlighting** - King in check is highlighted with red border
- ✅ **Last Move Highlighting** - Previous move squares are highlighted
- ✅ **Board Themes** - Customizable board colors
- ✅ **Piece Sets** - Customizable piece images
- ✅ **Coordinates** - File (a-h) and rank (1-8) labels
- ✅ **Read-only Mode** - Disables all moves for spectator view
- ✅ **Chess960 Support** - Proper FEN handling for Fischer Random positions

## ⚠️ Partially Implemented

### Touch/Mobile Support
- ⚠️ **Touch Events** - Basic touch support exists (drag & drop works on mobile)
- ❌ **Touch Ignore Radius** - No specific touch ignore radius like Lichess (`touchIgnoreRadius: 1`)
- ❌ **Touch Optimizations** - No special touch gesture handling (e.g., prevent accidental moves)
- ⚠️ **Mobile Responsive** - CSS responsive design exists but not board-specific optimizations

## ❌ Missing Features

### User Input Methods
- ❌ **Keyboard Move Support** - Cannot input moves using keyboard (e.g., `e2e4`, `Nf3`)
- ❌ **Voice Input** - No voice command support for moves
- ❌ **Click to Move** - Only drag & drop supported, no click-select mode (Lichess has both)

### Advanced UI Features
- ❌ **Rook Castling UI** - No special visual feedback for castling by clicking rook
- ❌ **Resize Handle** - No built-in board resize control
- ❌ **Blindfold Mode** - No option to hide pieces (show only board)
- ❌ **3D Pieces** - No 3D rendering option (`addPieceZIndex`)
- ❌ **Coordinates on Squares** - Coordinates can be shown but not specifically on each square

### Arrow Features
- ❌ **Erase Arrows on Click** - Cannot erase arrows by clicking them
- ⚠️ **Arrow Colors** - Basic arrow color support, but not customizable per arrow type

### Sound & Feedback
- ❌ **Move Sounds** - No sound effects for moves
- ❌ **Sound Themes** - No different sound sets

### Advanced Configuration
- ❌ **Free Mode** - No "free mode" for unrestricted piece movement
- ❌ **View-only Variations** - No special modes for analysis/study
- ❌ **Highlight Preferences** - Basic highlighting exists but not all Lichess options

## Feature Details

### Lichess Features We're Missing

#### 1. Keyboard Move Input
Lichess supports keyboard input like:
- `e2e4` - Move notation
- `Nf3` - SAN (Standard Algebraic Notation)
- Arrow keys for navigation in analysis mode

**Status**: Not implemented in board component. Would require:
- Keyboard event handlers
- Move parsing (UCI, SAN)
- Visual feedback for typed moves

#### 2. Rook Castling UI
Lichess allows castling by clicking the rook instead of the king.

**Status**: Not implemented. Would require:
- Special handling when rook is clicked
- Detection of castling legality
- Visual feedback for castling moves

#### 3. Touch Optimizations
Lichess has `touchIgnoreRadius` to prevent accidental touches near piece boundaries.

**Status**: Partially implemented. We have basic touch support but no:
- Ignore radius configuration
- Touch-specific gesture handling
- Prevent accidental drag starts

#### 4. Move Sounds
Lichess plays sounds for:
- Move made
- Capture
- Check
- Promotion
- Castle

**Status**: Not implemented. Would require:
- Audio file management
- Sound theme system
- Playback on move events

#### 5. Click-to-Move Mode
Lichess supports both drag-and-drop and click-select-then-click-destination modes.

**Status**: Only drag-and-drop supported. Would need:
- Click mode toggle
- Visual selection feedback
- Click destination handling

## Implementation Priority

Based on the original TODO list and Lichess comparison:

### High Priority (From Original List)
1. ✅ Piece move animations - **DONE**
2. ✅ Ghost piece during drag - **DONE**
3. ✅ Configurable animation duration - **DONE**
4. ✅ Destination highlighting - **DONE**
5. ✅ Arrow snapping to valid moves - **DONE**
6. ⏳ Rook castling UI - **TODO**
7. ⏳ Touch/mobile optimizations - **PARTIAL**
8. ⏳ Keyboard move support - **TODO**
9. ⏳ Move sounds - **TODO**

### Medium Priority (Nice to Have)
- Click-to-move mode
- Erase arrows on click
- Touch ignore radius
- Resize handle
- Coordinates on squares option

### Low Priority (Advanced)
- Blindfold mode
- 3D pieces
- Voice input
- Free mode

## Summary

**Core Features**: ✅ 14/14 implemented
**User Input Methods**: ⚠️ 0/3 (keyboard, voice, click-mode)
**Advanced UI**: ❌ 0/5 (rook castling, resize, blindfold, 3D, coordinates-on-squares)
**Polish Features**: ❌ 0/2 (sounds, erase arrows)

**Overall**: We have most of the core board functionality that matches Lichess. The main gaps are in:
1. Alternative input methods (keyboard, voice, click)
2. Advanced UI polish (sounds, rook castling)
3. Mobile-specific optimizations

The board is fully functional for its primary use case (drag & drop with visual feedback), and matches Lichess in most core features.



