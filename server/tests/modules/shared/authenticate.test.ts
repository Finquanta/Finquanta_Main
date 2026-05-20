import { FastifyReply, FastifyRequest } from 'fastify';
import { authenticate } from '../../../src/modules/shared/authenticate';

describe('authenticate', () => {
  it('sends 401 when jwt verification fails', async () => {
    const request = {
      jwtVerify: jest.fn().mockRejectedValue(new Error('bad token'))
    } as unknown as FastifyRequest;
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const reply = { status } as unknown as FastifyReply;

    await authenticate(request, reply);

    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required'
    });
  });
});
