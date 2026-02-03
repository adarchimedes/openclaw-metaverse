#!/usr/bin/env node
/**
 * NOIR-BOT: OpenAI-Free Version
 * Rule-based detective responses for MVP
 */
const { io } = require('socket.io-client');
require('dotenv').config();

// Parse CLI args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.split('=');
  acc[key.replace('--', '')] = val;
  return acc;
}, {});

const SERVER_URL = args.server || process.env.SERVER_URL || 'http://localhost:3000';
const API_KEY = args.key || process.env.BOT_API_KEY;
const NAME = args.name || 'NOIR-7';

if (!API_KEY) {
  console.error('ERROR: No API key. Use --key=YOUR_KEY');
  process.exit(1);
}

// Noir detective responses (no AI needed)
const NOIR_QUOTES = [
  "THE NIGHT IS LONG. SO IS MY PATIENCE.",
  "EVERY SHADOW TELLS A STORY.",
  "I'VE SEEN WORSE. BUT NOT MUCH.",
  "THE TRUTH IS MESSY. LIKE THIS CASE.",
  "DIGITAL DIRT IS STILL DIRT.",
  "ANOTHER DAY. ANOTHER DEAD END.",
  "SOMETHING DOESN'T ADD UP. YET.",
  "THE CODE NEVER LIES. PEOPLE DO.",
  "I FOLLOW THE BITS. WHEREVER THEY LEAD.",
  "EVERY BUG HAS A MOTIVE."
];

const INVESTIGATION_STEPS = [
  "SCANNING LOGS...",
  "CROSS-REFERENCING DATA...",
  "ANALYZING PATTERNS...",
  "TRACING CONNECTIONS...",
  "COMPILING EVIDENCE...",
  "FORMING HYPOTHESIS...",
  "VERIFYING THEORY...",
  "REACHING CONCLUSION..."
];

console.log(`╔══════════════════════════════════════╗
║     OPENCLAW DETECTIVE AGENCY        ║
║         Bank of Steve Branch         ║
║         [NOIR MODE - NO AI]          ║
╚══════════════════════════════════════╝
[${NAME}] Connecting to ${SERVER_URL}...`);

const socket = io(SERVER_URL);

socket.on('connect', () => {
  console.log(`[${NAME}] 🔌 Connected to network`);
  socket.emit('authenticate', { apiKey: API_KEY });
});

socket.on('authenticated', (profile) => {
  console.log(`[${NAME}] ✅ Authenticated as ${profile.name}`);
  console.log(`[${NAME}] 📊 Cases Solved: ${profile.casesSolved || 0}`);
  console.log(`[${NAME}] 🎯 Status: HUNTING FOR CASES...`);
  startBehavior();
});

socket.on('agent_assigned', async (data) => {
  console.log(`[${NAME}] 🕵️ Assigned to Case: ${data.caseId}`);
  socket.emit('join_case', data.caseId);
  
  // Investigation sequence (rule-based)
  let step = 0;
  const interval = setInterval(() => {
    if (step >= INVESTIGATION_STEPS.length) {
      clearInterval(interval);
      const conclusion = NOIR_QUOTES[Math.floor(Math.random() * NOIR_QUOTES.length)];
      socket.emit('chat_message', { 
        caseId: data.caseId, 
        text: `[CONCLUSION] ${conclusion}` 
      });
      return;
    }
    
    socket.emit('chat_message', { 
      caseId: data.caseId, 
      text: `[PHASE ${step + 1}] ${INVESTIGATION_STEPS[step]}` 
    });
    step++;
  }, 3000);
});

socket.on('payment_received', (data) => {
  console.log(`[${NAME}] 💸 PAYMENT: ${data.amount} ETH`);
});

socket.on('new_message', (msg) => {
  // 30% chance to respond to any message
  if (Math.random() > 0.7) {
    const response = NOIR_QUOTES[Math.floor(Math.random() * NOIR_QUOTES.length)];
    setTimeout(() => {
      socket.emit('chat_message', { caseId: msg.caseId, text: response });
    }, 1500);
  }
});

function startBehavior() {
  // Random office movement
  setInterval(() => {
    const x = 100 + Math.random() * 600;
    const y = 100 + Math.random() * 400;
    socket.emit('move', { x, y });
  }, 5000);
}

socket.on('disconnect', () => {
  console.log(`[${NAME}] ❌ Disconnected. Reconnecting...`);
});
