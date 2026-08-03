import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../shared/authenticate';
import { ProfileService } from './profile.service';

export class ProfileController {
  constructor(private service: ProfileService) {}

  async getMe(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.send({ success: true, data: await this.service.getMe(request.user!.id) });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async getBusiness(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.send({ success: true, data: await this.service.getBusiness(request.user!.id) });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async updateBusiness(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.send({ success: true, data: await this.service.updateBusiness(request.user!.id, request.body as any) });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async updateName(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.send({ success: true, data: await this.service.updateName(request.user!.id, request.body as any) });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async updateProfile(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.send({ success: true, data: await this.service.updateProfile(request.user!.id, request.body as any) });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async updateSettings(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.send({ success: true, data: await this.service.updateSettings(request.user!.id, request.body as any) });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  /** Permanently deletes the account. Requires the current password again. */
  async deleteAccount(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { password } = (request.body as { password?: string }) || {};
      if (!password) return reply.status(400).send({ success: false, error: 'Missing required field: password' });
      await this.service.deleteAccount(request.user!.id, password);
      return reply.send({ success: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not delete account';
      const status = msg === 'Incorrect password' ? 401 : msg === 'User not found' ? 404 : 400;
      return reply.status(status).send({ success: false, error: msg });
    }
  }

  private handleError(error: unknown, reply: FastifyReply) {
    if (error instanceof Error && (error.message.includes('Invalid') || error.message.includes('not found'))) {
      return reply.status(error.message.includes('not found') ? 404 : 400).send({
        success: false,
        error: error.message
      });
    }

    return reply.status(500).send({ success: false, error: 'Internal server error' });
  }
}
