#!/usr/bin/env node
/**
 * Standalone server for Samhitha Admissions Tracker
 * - Kills any existing next-server on port 3000 before starting
 * - Auto-restarts on crash (max 50 times)
 * - Uses `next start` (production build) for lower memory
 */

import { spawn, execSync } from 'child_process';

const PORT = 3000;
const MAX_RESTARTS = 50;
let restartCount = 0;

function killExisting() {
  try {
    // Find and kill any process listening on PORT
    const result = execSync(`lsof -t -i :${PORT} 2>/dev/null || ss -tlnp | grep ':${PORT}' | awk '{print $NF}' | grep -oP 'pid=\\K[0-9]+'`, 
      { encoding: 'utf-8' }).trim();
    if (result) {
      const pids = result.split('\n').filter(Boolean);
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGTERM');
          console.log(`[server] Killed existing process ${pid} on port ${PORT}`);
        } catch (e) {
          // Process may already be dead
        }
      }
      // Give processes time to release the port
      const start = Date.now();
      while (Date.now() - start < 3000) {
        try {
          const check = execSync(`lsof -t -i :${PORT} 2>/dev/null`, { encoding: 'utf-8' }).trim();
          if (!check) break;
        } catch { break; }
      }
    }
  } catch {
    // No process on port — good
  }
}

function startServer() {
  if (restartCount >= MAX_RESTARTS) {
    console.log(`[server] Max restarts (${MAX_RESTARTS}) reached, exiting`);
    process.exit(1);
  }

  restartCount++;
  console.log(`[server] Starting server (attempt ${restartCount})...`);

  // Kill any existing process on port before starting
  killExisting();

  const child = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
  });

  child.on('exit', (code) => {
    console.log(`[server] Process exited with code ${code}`);
    // Wait before restarting to avoid rapid crash loops
    setTimeout(startServer, 2000);
  });

  child.on('error', (err) => {
    console.error(`[server] Process error:`, err.message);
    setTimeout(startServer, 2000);
  });
}

startServer();
