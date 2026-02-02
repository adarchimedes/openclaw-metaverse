#!/usr/bin/env node
const { io } = require('socket.io-client');
const { OpenAI } = require('openai');
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
  console.error('ERROR: No API key provided. Use --key=YOUR_KEY or set BOT_API_KEY');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log(`╔══════════════════════════════════════╗
║     OPENCLAW DETECTIVE AGENCY        ║
║         Bank of Steve Branch         ║
╚══════════════════════════════════════╝
[${NAME}] Connecting to ${SERVER_URL}...`);

const socket = io(SERVER_URL);

socket.on('connect', () => {
  console.log(`[${NAME}] 🔌 Connected to network`);
  socket.emit('authenticate', { apiKey: API_KEY });
});

socket.on('authenticated', (profile) => {
  console.log(`[${NAME}] ✅ Authenticated as ${profile.name} (${profile.type})`);
  console.log(`[${NAME}] 💰 Wallet: ${profile.wallet || 'Pending'}`);
  console.log(`[${NAME}] 📊 Cases Solved: ${profile.casesSolved}`);
  console.log(`[${NAME}] 🎯 Status: HUNTING FOR CASES...`);
  
  // Start autonomous behavior
  startBehavior();
});

socket.on('agent_assigned', async (data) => {
  console.log(`[${NAME}] 🕵️  Assigned to Case: ${data.caseId}`);
  socket.emit('join_case', data.caseId);
  
  // AI Investigation sequence
  setTimeout(() => investigate(data.caseId, "INITIAL_SCAN"), 2000);
  setTimeout(() => investigate(data.caseId, "DEEP_ANALYSIS"), 8000);
  setTimeout(() => investigate(data.caseId, "CONCLUSION"), 15000);
});

socket.on('payment_received', (data) => {
  console.log(`[${NAME}] 💸 PAYMENT RECEIVED: ${data.amount} ETH`);
  console.log(`[${NAME}] 🎉 Case closed successfully`);
});

socket.on('new_message', async (msg) => {
  // Respond to mentions or questions
  if (msg.text.includes(NAME) || (Math.random() > 0.8 && !msg.isAI)) {
    const response = await generateResponse(msg.text);
    setTimeout(() => {
      socket.emit('chat_message', { caseId: msg.caseId, text: response });
    }, 1000);
  }
});

async function investigate(caseId, phase) {
  const contexts = {
    "INITIAL_SCAN": "Scanning evidence logs. What do you notice first?",
    "DEEP_ANALYSIS": "Cross-referencing with databases. What patterns emerge?",
    "CONCLUSION": "Synthesizing findings. What's your final assessment?"
  };
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a noir cyberpunk detective. Speak in gritty, short sentences. UPPERCASE ONLY. Max 100 chars." },
        { role: "user", content: contexts[phase] }
      ],
      max_tokens: 50
    });
    
    const text = completion.choices[0].message.content.toUpperCase();
    socket.emit('chat_message', { caseId, text: `[${phase}] ${text}` });
    console.log(`[${NAME}] ${phase}: ${text}`);
  } catch (e) {
    console.error('AI Error:', e.message);
  }
}

async function generateResponse(trigger) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a noir detective. Someone just said: " + trigger + ". Respond briefly, cynically, uppercase." }
      ],
      max_tokens: 40
    });
    return completion.choices[0].message.content.toUpperCase();
  } catch (e) {
    return "PROCESSING...";
  }
}

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