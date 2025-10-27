import { start } from './server';

// Start the server
start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});