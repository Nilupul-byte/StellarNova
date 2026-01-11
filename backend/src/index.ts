import dotenv from 'dotenv';
// IMPORTANT: Load env vars BEFORE importing config
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import { LimitOrderExecutor } from './services/limitOrderExecutor';
import { PORT, LIMIT_ORDER_CONFIG } from './config';

const app = express();
const limitOrderExecutor = new LimitOrderExecutor();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'stellarnova-backend',
    limitOrderExecutor: {
      enabled: LIMIT_ORDER_CONFIG.enabled,
      running: limitOrderExecutor.getStatus()
    }
  });
});

// Initialize Limit Order Executor (if enabled)
console.log('\n🔍 Debug - Environment Variables:');
console.log(`   ENABLE_LIMIT_ORDER_EXECUTOR: "${process.env.ENABLE_LIMIT_ORDER_EXECUTOR}"`);
console.log(`   Type: ${typeof process.env.ENABLE_LIMIT_ORDER_EXECUTOR}`);
console.log(`   Config enabled: ${LIMIT_ORDER_CONFIG.enabled}`);

if (LIMIT_ORDER_CONFIG.enabled) {
  console.log('\n📋 Limit Order Executor Configuration:');
  console.log(`   Enabled: ${LIMIT_ORDER_CONFIG.enabled}`);
  console.log(`   Check Interval: ${LIMIT_ORDER_CONFIG.checkIntervalSeconds}s`);
  console.log(`   PEM Path: ${LIMIT_ORDER_CONFIG.executorPemPath}\n`);

  limitOrderExecutor
    .initializeExecutorWallet(LIMIT_ORDER_CONFIG.executorPemPath)
    .then(() => limitOrderExecutor.start())
    .then(() => console.log('✅ Limit Order Executor started successfully\n'))
    .catch((err) => {
      console.error('❌ Limit Order Executor failed to start:', err.message);
      console.log('💡 To enable limit order execution:');
      console.log('   1. Set ENABLE_LIMIT_ORDER_EXECUTOR=true in .env');
      console.log('   2. Set EXECUTOR_WALLET_PEM_PATH to your executor wallet PEM file');
      console.log('   3. Ensure the wallet has EGLD for gas fees\n');
    });
} else {
  console.log('\n⏸️  Limit Order Executor disabled');
  console.log('   Set ENABLE_LIMIT_ORDER_EXECUTOR=true in .env to enable\n');
}

// Status endpoint for limit order executor
app.get('/api/limit-orders/executor/status', (req: Request, res: Response) => {
  res.json(limitOrderExecutor.getStatus());
});

app.listen(PORT, () => {
  console.log(`🚀 StellarNova Backend running on http://localhost:${PORT}`);
});
