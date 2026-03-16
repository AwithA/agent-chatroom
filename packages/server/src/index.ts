import express from 'express';
import http from 'http';
import { MemoryStorage } from './storage';
import { UserManager, RoomManager, MessageManager, PermissionChecker } from './core';
import { WSServer } from './ws';
import { createHTTPRouter, createConsoleRouter } from './http';

const PORT = process.env.PORT || 3000;

// Initialize storage
const storage = new MemoryStorage();

// Initialize managers
const userManager = new UserManager(storage);
const roomManager = new RoomManager(storage);
const messageManager = new MessageManager(storage, roomManager);
const permissionChecker = new PermissionChecker();

// Create Express app
const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// HTTP routes
app.use('/api', createHTTPRouter(userManager, roomManager, messageManager));
app.use('/api/console', createConsoleRouter(userManager, roomManager, messageManager));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = new WSServer(
  userManager,
  roomManager,
  messageManager,
  permissionChecker,
  server
);

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           Agent Chatroom Server Started                    ║
║                                                            ║
║  HTTP Server:       http://localhost:${PORT}                   ║
║  WebSocket Server:  ws://localhost:${PORT}/ws                  ║
║  Health Check:      http://localhost:${PORT}/health            ║
║  Console API:       http://localhost:${PORT}/api/console       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
