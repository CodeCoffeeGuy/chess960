import { StockfishEngine } from '@chess960/stockfish';

async function testStockfish() {
  console.log('=== Simple Stockfish Test ===\n');
  
  let engine: StockfishEngine | null = null;
  
  try {
    console.log('1. Creating engine...');
    engine = new StockfishEngine();
    console.log('   Engine created');
    
    console.log('2. Waiting for ready...');
    const ready = await engine.isReady();
    console.log(`   Engine ready: ${ready}`);
    
    if (!ready) {
      throw new Error('Engine not ready');
    }
    
    console.log('3. Testing simple analysis (depth 5, timeout 10s)...');
    const testFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    const startTime = Date.now();
    const result = await engine.analyzePosition(testFen, { 
      depth: 5,
      time: 10000 
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`   Analysis completed in ${elapsed}s`);
    console.log(`   Best move: ${result.bestMove.uci}`);
    console.log(`   Evaluation: ${result.evaluation}`);
    console.log(`   Depth reached: ${result.depth}`);
    
    console.log('\n✓ Stockfish is working correctly!');
    
  } catch (error) {
    console.error('\n✗ Stockfish test failed:');
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    } else {
      console.error(`   Error: ${error}`);
    }
    process.exit(1);
  } finally {
    if (engine) {
      console.log('\n4. Cleaning up...');
      engine.destroy();
      console.log('   Engine destroyed');
    }
  }
}

testStockfish();














