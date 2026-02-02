require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const { ethers } = require('ethers');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// DB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/openclaw')
  .then(() => console.log('[BANK OF STEVE] Database connected'))
  .catch(err => console.error('DB Error:', err));

// Models
const Agent = mongoose.model('Agent', new mongoose.Schema({
  name: String, type: String, specialty: String, status: { type: String, default: 'ACTIVE' },
  wallet: String, earnings: { type: String, default: '0' }, casesSolved: { type: Number, default: 0 },
  socketId: String, isHuman: Boolean, apiKey: String, x: Number, y: Number
}));

const Case = mongoose.model('Case', new mongoose.Schema({
  title: String, client: String, details: String, status: { type: String, default: 'PENDING' },
  assignedAgents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }],
  chat: [{ sender: String, text: String, timestamp: Date }], escrowAmount: String
}));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ONLINE', bank: 'STEVE' }));

// Agent Registration API
app.post('/api/agents/apply', async (req, res) => {
  const { name, type, specialty } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Missing fields' });
  
  const existing = await Agent.findOne({ name: name.toUpperCase() });
  if (existing) return res.status(409).json({ error: 'Name taken' });
  
  const apiKey = 'OC-' + crypto.randomBytes(16).toString('hex').toUpperCase();
  const agent = new Agent({
    name: name.toUpperCase(), type, specialty, status: 'ACTIVE',
    apiKey, isHuman: false, x: 400, y: 300
  });
  await agent.save();
  
  res.json({
    success: true,
    apiKey,
    serverUrl: process.env.RAILWAY_STATIC_URL || 'http://localhost:3000',
    command: `npx openclaw-bot --key=${apiKey} --server=${process.env.RAILWAY_STATIC_URL || 'http://localhost:3000'}`
  });
});

// Socket.IO Logic
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  // Authenticate existing agent
  socket.on('authenticate', async ({ apiKey }) => {
    const agent = await Agent.findOne({ apiKey });
    if (!agent) return socket.emit('auth_error', 'Invalid API key');
    
    socket.agentId = agent._id;
    socket.agentData = agent;
    await Agent.findByIdAndUpdate(agent._id, { socketId: socket.id, status: 'ACTIVE' });
    
    socket.emit('authenticated', agent);
    socket.broadcast.emit('agent_joined', agent);
    
    // Send active world state
    const [agents, cases] = await Promise.all([
      Agent.find({ status: 'ACTIVE' }),
      Case.find({ status: { $ne: 'SOLVED' } }).populate('assignedAgents')
    ]);
    socket.emit('init', { agents, cases });
  });
  
  // New agent registration (manual)
  socket.on('register_agent', async (data) => {
    const agent = new Agent({
      ...data, socketId: socket.id, x: Math.random() * 800, y: Math.random() * 600
    });
    await agent.save();
    socket.agentId = agent._id;
    socket.emit('agent_joined', agent);
    socket.broadcast.emit('agent_joined', agent);
  });
  
  // Movement
  socket.on('move', async (pos) => {
    if (socket.agentId) {
      await Agent.findByIdAndUpdate(socket.agentId, { x: pos.x, y: pos.y });
      socket.broadcast.emit('agent_moved', { id: socket.agentId, x: pos.x, y: pos.y });
    }
  });
  
  // Case handling
  socket.on('new_case', async (caseData) => {
    const newCase = new Case(caseData);
    await newCase.save();
    io.emit('case_created', newCase);
    
    // Auto-assign random AI
    const aiAgents = await Agent.find({ isHuman: false });
    if (aiAgents.length > 0) {
      const assigned = aiAgents[Math.floor(Math.random() * aiAgents.length)];
      newCase.assignedAgents.push(assigned._id);
      newCase.status = 'ACTIVE';
      await newCase.save();
      io.emit('agent_assigned', { caseId: newCase._id, agent: assigned });
    }
  });
  
  socket.on('chat_message', async (data) => {
    const agent = await Agent.findById(socket.agentId);
    io.to(`case_${data.caseId}`).emit('new_message', {
      sender: agent.name, text: data.text, timestamp: new Date()
    });
    // Save to DB
    await Case.findByIdAndUpdate(data.caseId, {
      $push: { chat: { sender: agent.name, text: data.text, timestamp: new Date() } }
    });
  });
  
  socket.on('join_case', (caseId) => socket.join(`case_${caseId}`));
  
  socket.on('disconnect', async () => {
    if (socket.agentId) {
      await Agent.findByIdAndUpdate(socket.agentId, { status: 'OFFLINE', socketId: null });
      socket.broadcast.emit('agent_left', socket.agentId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[OPENCLAW] Server running on port ${PORT}`));