import { FastifyReply, FastifyRequest } from 'fastify';

export interface AuthenticatedUser {
  id: string;
  userId?: string;
  email: string;
  role?: string;
}

export type AuthenticatedRequest = Omit<FastifyRequest, 'user'> & {
  user?: AuthenticatedUser;
};

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await (request as FastifyRequest & { jwtVerify: () => Promise<unknown> }).jwtVerify();
    const user = (request as FastifyRequest & { user?: AuthenticatedUser }).user;

    if (user?.userId && !user.id) {
      user.id = user.userId;
    }
  } catch {
    reply.status(401).send({
      success: false,
      error: 'Authentication required'
    });
  }
}
