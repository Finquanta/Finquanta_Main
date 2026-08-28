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
      return reply.send({
        success: true,
        data: await this.service.getBusiness(request.businessId!),
      });
    } catch (error) {
      return this.handleError(error, reply);
    }
  }

  async updateBusiness(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.send({
        success: true,
        data: await this.service.updateBusiness(request.businessId!, request.user!.id, request.body as any),
      });
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
  /**
   * Which owned workspaces would take other people down with them. Read by the
   * delete-account screen so it can ask for a successor BEFORE the confirm
   * button, rather than refusing after the password has been typed.
   */
  async deletionBlockers(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.send({ success: true, data: await this.service.deletionBlockers(request.user!.id) });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: 'Could not check your workspaces' });
    }
  }

  async deleteAccount(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { password, successors } = (request.body as {
        password?: string;
        successors?: Record<string, string>;
      }) || {};
      if (!password) return reply.status(400).send({ success: false, error: 'Missing required field: password' });
      await this.service.deleteAccount(request.user!.id, password, successors || {});
      return reply.send({ success: true });
    } catch (error) {
      /**
       * 409, with the workspaces attached.
       *
       * Not a 400: nothing about the request was malformed, and the client
       * cannot fix it by correcting a field. It has to go and ask the user a
       * question first, so it needs the list to ask it with.
       */
      const withList = error as Error & { businesses?: unknown };
      if (withList?.message === 'SUCCESSOR_REQUIRED') {
        return reply.status(409).send({
          success: false,
          error: 'Choose who should take over your shared workspaces before deleting your account.',
          data: { businesses: withList.businesses ?? [] },
        });
      }
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

    /**
     * LOG IT. This used to return a bare 500 and write nothing anywhere, so a
     * failing profile save produced "Internal server error" on screen and
     * silence in the logs — no way to tell a bad column from a bad constraint
     * without adding a console.log and redeploying.
     */
    // eslint-disable-next-line no-console
    console.error('[profile] request failed:', error);
    return reply.status(500).send({ success: false, error: 'Internal server error' });
  }
}
