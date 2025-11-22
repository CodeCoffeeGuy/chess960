/**
 * Validates that a puzzle position is realistic for the given rating level.
 * Rejects positions with exposed kings, unrealistic material imbalances, etc.
 */
export declare function validatePuzzlePosition(fen: string, targetRating: number): {
    valid: boolean;
    reason?: string;
};
//# sourceMappingURL=puzzle-position-validator.d.ts.map