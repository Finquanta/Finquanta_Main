import { createServer as httpCreateServer, IncomingMessage, ServerResponse } from 'http';
import { MockDatabase } from '../../tests/mocks/database.mock';
import { AuthController } from '../modules/auth/auth.controller';
import { AuthService } from '../modules/auth/auth.service';

export interface NativeServer {
  server: any;
  port: number;
  database: MockDatabase;
  close: () => Promise<void>;
}

export async function buildNativeTestServer(): Promise<NativeServer> {
  const database = new MockDatabase();
  await database.connect();
  const authService = new AuthService(database);
  const authController = new AuthController(authService);

  const server = httpCreateServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Only handle auth routes
    if (req.url?.startsWith('/api/v1/auth/') && req.method === 'POST') {
      try {
        // Parse request body
        const body = await new Promise<string>((resolve, reject) => {
          let data = '';
          req.on('data', chunk => data += chunk);
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });

        let parsedBody;
        try {
          parsedBody = body ? JSON.parse(body) : {};
        } catch (parseError) {
          // Handle JSON parsing errors
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
          return;
        }

        // Create mock request/reply objects
        const mockRequest = { body: parsedBody };
        const mockReply = {
          status: (code: number) => ({
            send: (data: any) => {
              res.writeHead(code, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(data));
            }
          }),
          header: (name: string, value: string) => res.setHeader(name, value)
        };

        // Route to appropriate controller method
        if (req.url === '/api/v1/auth/register') {
          await authController.register(mockRequest as any, mockReply as any);
        } else if (req.url === '/api/v1/auth/login') {
          await authController.login(mockRequest as any, mockReply as any);
        } else if (req.url === '/api/v1/auth/refresh') {
          await authController.refreshToken(mockRequest as any, mockReply as any);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    } else if (req.url === '/test') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Test route works' }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  // Find an available port
  const port = await new Promise<number>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve(address.port);
      } else {
        resolve(3001);
      }
    });
  });

  return {
    server,
    port,
    database,
    close: () => new Promise<void>((resolve) => {
      server.close(() => resolve());
    })
  };
}