import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Chess } from 'chess.js';
import { AnalysisOptions, AnalysisResult, PositionAnalysis, AnalysisMove } from './types';

export class StockfishEngine extends EventEmitter {
  private process: ChildProcess | null = null;
  private engineReady = false;
  private currentAnalysis: Promise<AnalysisResult> | null = null;
  private responseBuffer = '';
  private readyPromise: Promise<void> | null = null;
  private initializationTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super();
    // Increase max listeners to avoid warnings when using multiple engines
    this.setMaxListeners(100);
    this.initialize();
  }

  private initialize(): void {
    try {
      // Use system stockfish binary directly
      // This is more reliable than trying to use the npm package in a spawned process
      this.process = spawn('stockfish', [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.process || !this.process.stdin || !this.process.stdout) {
        throw new Error('Failed to start Stockfish engine: invalid process');
      }

      // Set up initialization timeout (15 seconds - increased for reliability)
      this.initializationTimeout = setTimeout(() => {
        if (!this.engineReady) {
          console.error('Stockfish initialization timeout');
          this.emit('error', new Error('Stockfish initialization timeout'));
          this.destroy();
        }
      }, 15000);

      // Handle stdout
      this.process.stdout.on('data', (data) => {
        this.handleEngineOutput(data.toString());
      });

      // Handle stderr
      this.process.stderr?.on('data', (data) => {
        const errorMsg = data.toString().trim();
        if (errorMsg && !errorMsg.includes('info')) {
          console.error('Stockfish stderr:', errorMsg);
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        console.error('Stockfish process error:', error);
        this.engineReady = false;
        this.emit('error', error);
        if (this.initializationTimeout) {
          clearTimeout(this.initializationTimeout);
          this.initializationTimeout = null;
        }
      });

      // Handle process close
      this.process.on('close', (code) => {
        this.engineReady = false;
        if (code !== 0 && code !== null) {
          console.log(`Stockfish process exited with code ${code}`);
        }
        if (this.initializationTimeout) {
          clearTimeout(this.initializationTimeout);
          this.initializationTimeout = null;
        }
      });

      // Send UCI initialization command
      this.process.stdin.write('uci\n');
      
      // After uciok, send ucinewgame and isready
      // This ensures the engine is fully ready before accepting commands
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to start Stockfish engine: ${errorMsg}`);
    }
  }

  private handleEngineOutput(output: string): void {
    this.responseBuffer += output;
    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine === 'uciok') {
        // After uciok, send ucinewgame and isready to complete initialization
        this.sendCommand('ucinewgame');
        this.sendCommand('isready');
      } else if (trimmedLine === 'readyok') {
        // Engine is fully ready after readyok
        this.engineReady = true;
        if (this.initializationTimeout) {
          clearTimeout(this.initializationTimeout);
          this.initializationTimeout = null;
        }
        this.emit('ready');
      } else if (trimmedLine === 'readyok') {
        // Handle readyok - emit both readyok-received and ready events
        this.emit('readyok-received');
        this.engineReady = true;
        if (this.initializationTimeout) {
          clearTimeout(this.initializationTimeout);
          this.initializationTimeout = null;
        }
        this.emit('ready');
      } else if (trimmedLine.startsWith('info')) {
        this.emit('info', trimmedLine);
      } else if (trimmedLine.startsWith('bestmove')) {
        this.emit('bestmove', trimmedLine);
      }
    }
  }

  private sendCommand(command: string): void {
    if (!this.process || !this.process.stdin) {
      throw new Error('Stockfish engine not available');
    }
    this.process.stdin.write(command + '\n');
  }

  /**
   * Set Stockfish skill level (0-20, where 20 is maximum strength)
   * This allows simulating different playing strengths
   */
  async setSkillLevel(level: number): Promise<void> {
    await this.waitForReady();
    const clampedLevel = Math.max(0, Math.min(20, Math.round(level)));
    this.sendCommand(`setoption name Skill Level value ${clampedLevel}`);
    // Also enable UCI_LimitStrength for weaker play
    if (clampedLevel < 20) {
      this.sendCommand('setoption name UCI_LimitStrength value true');
    } else {
      this.sendCommand('setoption name UCI_LimitStrength value false');
    }
  }

  private waitForReady(timeoutMs: number = 20000): Promise<void> {
    if (this.engineReady) {
      return Promise.resolve();
    }

    // If we already have a ready promise, reuse it
    if (this.readyPromise) {
      return this.readyPromise;
    }

    // Create new ready promise with timeout
    this.readyPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.readyPromise = null;
        reject(new Error('Stockfish engine initialization timeout'));
      }, timeoutMs);

      this.once('ready', () => {
        clearTimeout(timeout);
        this.readyPromise = null;
        resolve();
      });

      this.once('error', (error) => {
        clearTimeout(timeout);
        this.readyPromise = null;
        reject(error);
      });
    });

    return this.readyPromise;
  }

  async analyzePosition(fen: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    // Check if ready, but don't wait too long if already ready
    if (!this.engineReady) {
      try {
        await this.waitForReady(10000); // Shorter timeout for analysis
      } catch {
        // If not ready, try to reset
        if (this.process && !this.process.killed) {
          this.sendCommand('isready');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        // Continue anyway - engine might still work
      }
    }

    // Prevent concurrent analyses - wait for current one to finish
    if (this.currentAnalysis) {
      try {
        await this.currentAnalysis;
      } catch {
        // Ignore errors from previous analysis
      }
    }

    const depth = options.depth || 15;
    const multipv = options.multipv || 1;
    
    // Stop any ongoing search first (don't wait - just send stop)
    this.sendCommand('stop');
    
    // Small delay to ensure stop is processed (reduced from 100ms)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Don't call ucinewgame/isready before every analysis - only when needed
    // This was adding ~300-500ms overhead per analysis!
    
    // Create new analysis promise
    this.currentAnalysis = new Promise<AnalysisResult>((resolve, reject) => {
      let bestMove: string = '';
      let evaluation = 0;
      let analysisDepth = 0;
      let nodes = 0;
      let time = 0;
      const alternatives: AnalysisMove[] = [];
      const multipvResults: Map<number, {
        move: string;
        evaluation: number;
        depth: number;
        pv: string[];
      }> = new Map();

      const timeout = setTimeout(() => {
        this.off('info', handleInfo);
        this.off('bestmove', handleBestMove);
        this.currentAnalysis = null;
        reject(new Error('Analysis timeout'));
      }, options.time || 30000);

      const handleInfo = (info: string) => {
        const parts = info.split(' ');
        
        // Parse MultiPV number
        let pvNum = 1;
        const multipvIndex = parts.indexOf('multipv');
        if (multipvIndex !== -1 && parts[multipvIndex + 1]) {
          pvNum = parseInt(parts[multipvIndex + 1]);
        }

        // Parse depth
        let currentDepth = analysisDepth;
        if (info.includes('depth')) {
          const depthIndex = parts.indexOf('depth');
          if (depthIndex !== -1 && parts[depthIndex + 1]) {
            currentDepth = parseInt(parts[depthIndex + 1]);
            if (currentDepth > analysisDepth) {
              analysisDepth = currentDepth;
            }
          }
        }

        // Parse evaluation (cp = centipawns, mate = checkmate)
        let currentEval = evaluation;
        if (info.includes('cp')) {
          const cpIndex = parts.indexOf('cp');
          if (cpIndex !== -1 && parts[cpIndex + 1]) {
            currentEval = parseInt(parts[cpIndex + 1]);
          }
        } else if (info.includes('mate')) {
          const mateIndex = parts.indexOf('mate');
          if (mateIndex !== -1 && parts[mateIndex + 1]) {
            const mateIn = parseInt(parts[mateIndex + 1]);
            // Convert mate to a very large evaluation
            currentEval = mateIn > 0 ? 30000 - mateIn : -30000 - Math.abs(mateIn);
          }
        }

        // Parse principal variation (pv)
        let pv: string[] = [];
        const pvIndex = parts.indexOf('pv');
        if (pvIndex !== -1) {
          pv = parts.slice(pvIndex + 1);
        }

        // Store MultiPV result
        if (pv.length > 0) {
          multipvResults.set(pvNum, {
            move: pv[0],
            evaluation: currentEval,
            depth: currentDepth,
            pv: pv,
          });

          // Update main evaluation from PV 1
          if (pvNum === 1) {
            evaluation = currentEval;
          }
        }

        // Parse nodes
        if (info.includes('nodes')) {
          const nodesIndex = parts.indexOf('nodes');
          if (nodesIndex !== -1 && parts[nodesIndex + 1]) {
            nodes = parseInt(parts[nodesIndex + 1]);
          }
        }

        // Parse time
        if (info.includes('time')) {
          const timeIndex = parts.indexOf('time');
          if (timeIndex !== -1 && parts[timeIndex + 1]) {
            time = parseInt(parts[timeIndex + 1]);
          }
        }
      };

      const handleBestMove = (bestmove: string) => {
        clearTimeout(timeout);
        this.off('info', handleInfo);
        this.off('bestmove', handleBestMove);

        const parts = bestmove.split(' ');
        if (parts[1]) {
          bestMove = parts[1];
        } else {
          reject(new Error('No best move in response'));
          return;
        }

        try {
          const chess = new Chess(fen);
          const moveObj = this.parseUciMove(chess, bestMove);
          
          // Build alternative moves from MultiPV results
          const bestMoveData = multipvResults.get(1);
          for (let i = 2; i <= multipv; i++) {
            const altData = multipvResults.get(i);
            if (altData && altData.move !== bestMove) {
              const altChess = new Chess(fen);
              const altMoveObj = this.parseUciMove(altChess, altData.move);
              if (altMoveObj) {
                alternatives.push({
                  uci: altData.move,
                  san: altMoveObj.san,
                  evaluation: altData.evaluation,
                  depth: altData.depth,
                  pv: altData.pv,
                });
              }
            }
          }

          // Determine if mate
          const bestMoveDataFinal = bestMoveData || multipvResults.get(1);
          let mate: number | undefined;
          if (bestMoveDataFinal && Math.abs(bestMoveDataFinal.evaluation) > 20000) {
            // Approximate mate distance from extreme evaluation
            mate = bestMoveDataFinal.evaluation > 0 
              ? Math.ceil((30000 - bestMoveDataFinal.evaluation) / 100)
              : Math.ceil((-30000 - bestMoveDataFinal.evaluation) / 100);
          }

          resolve({
            bestMove: {
              uci: bestMove,
              san: moveObj?.san || bestMove,
              evaluation: bestMoveDataFinal?.evaluation || evaluation,
              depth: bestMoveDataFinal?.depth || analysisDepth,
              pv: bestMoveDataFinal?.pv || [bestMove],
              mate: mate,
            },
            alternativeMoves: alternatives,
            evaluation: bestMoveDataFinal?.evaluation || evaluation,
            depth: bestMoveDataFinal?.depth || analysisDepth,
            time: time,
            nodes: nodes
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to parse analysis result'));
        }
      };

      // Remove any existing listeners to prevent interference
      this.removeAllListeners('info');
      this.removeAllListeners('bestmove');

      this.on('info', handleInfo);
      this.on('bestmove', handleBestMove);

      // Now set up position and start analysis
      // (stop, ucinewgame, isready already handled above)
      this.sendCommand(`position fen ${fen}`);
      if (multipv > 1) {
        this.sendCommand(`setoption name MultiPV value ${multipv}`);
      }
      this.sendCommand(`go depth ${depth}`);
    });

    try {
      const result = await this.currentAnalysis;
      this.currentAnalysis = null;
      return result;
    } catch (error) {
      this.currentAnalysis = null;
      throw error;
    }
  }

  private parseUciMove(chess: Chess, uci: string) {
    try {
      const from = uci.substring(0, 2);
      const to = uci.substring(2, 4);
      const promotion = uci.length === 5 ? uci[4] : undefined;

      return chess.move({
        from,
        to,
        promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined
      });
    } catch {
      return null;
    }
  }

  async getPositionEvaluation(fen: string, depth: number = 15): Promise<PositionAnalysis> {
    const result = await this.analyzePosition(fen, { depth });
    
    return {
      fen,
      evaluation: result.evaluation,
      bestMove: result.bestMove.uci,
      pv: result.bestMove.pv,
      depth: result.depth,
      mate: result.bestMove.mate
    };
  }

  async findBestMove(fen: string, timeMs?: number): Promise<string> {
    await this.waitForReady();

    // Wait for any ongoing analysis to complete
    if (this.currentAnalysis) {
      try {
        await this.currentAnalysis;
      } catch {
        // Ignore errors
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off('bestmove', handleBestMove);
        reject(new Error('Best move search timeout'));
      }, (timeMs || 5000) + 1000); // Add buffer for timeout

      const handleBestMove = (bestmove: string) => {
        clearTimeout(timeout);
        this.off('bestmove', handleBestMove);

        const parts = bestmove.split(' ');
        if (parts[1] && parts[1] !== '(none)') {
          resolve(parts[1]);
        } else {
          reject(new Error('No best move found'));
        }
      };

      // Remove any existing listeners
      this.removeAllListeners('bestmove');
      this.on('bestmove', handleBestMove);

      // Stop any ongoing search first
      this.sendCommand('stop');
      
      // Small delay to ensure stop command is processed
      setTimeout(() => {
        this.sendCommand(`position fen ${fen}`);
        if (timeMs) {
          this.sendCommand(`go movetime ${timeMs}`);
        } else {
          this.sendCommand(`go depth 15`);
        }
      }, 50);
    });
  }

  async isReady(): Promise<boolean> {
    if (!this.process) return false;
    if (this.engineReady) return true;
    
    try {
      // Use longer timeout for isReady check
      await this.waitForReady(20000);
      return this.engineReady;
    } catch {
      // If timeout, try to reset and check again
      if (this.process && !this.process.killed) {
        try {
          this.sendCommand('isready');
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.engineReady;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  destroy(): void {
    if (this.initializationTimeout) {
      clearTimeout(this.initializationTimeout);
      this.initializationTimeout = null;
    }

    if (this.process) {
      try {
        // Try to send quit command gracefully
        if (this.process.stdin && !this.process.stdin.destroyed) {
          this.process.stdin.write('quit\n');
        }
      } catch (error) {
        // Ignore errors when sending quit
      }

      // Kill process if still running
      if (this.process.killed === false) {
        try {
          this.process.kill('SIGTERM');
          // Force kill after 1 second if still running
          setTimeout(() => {
            if (this.process && !this.process.killed) {
              this.process.kill('SIGKILL');
            }
          }, 1000);
        } catch (error) {
          // Ignore kill errors
        }
      }

      this.process = null;
    }

    this.engineReady = false;
    this.readyPromise = null;
    this.removeAllListeners();
  }
}