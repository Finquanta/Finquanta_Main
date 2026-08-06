// Jest globals are available globally
import { RedisClient } from '../../src/infrastructure/redis'

/**
 * These talk to a real Redis. Rather than failing on every machine that doesn't
 * happen to have one running, they are opt-in:
 *
 *   docker run -d -p 6379:6379 redis
 *   RUN_REDIS_TESTS=1 npx jest tests/infrastructure/redis.test.ts
 *
 * Gated on a dedicated flag rather than on REDIS_URL, because tests/setup.ts
 * assigns REDIS_URL unconditionally — keying off it would never skip anything.
 *
 * Conditional rather than deleted: the behaviour is worth checking where Redis
 * exists, and a permanently red suite trains everyone to ignore red.
 */
const describeWithRedis = process.env.RUN_REDIS_TESTS ? describe : describe.skip

describeWithRedis('RedisClient', () => {
  let redisClient: RedisClient

  beforeAll(async () => {
    redisClient = new RedisClient()
  })

  afterAll(async () => {
    if (redisClient.isConnected()) {
      await redisClient.disconnect()
    }
  })

  describe('connection management', () => {
    it('should connect to Redis successfully', async () => {
      await expect(redisClient.connect()).resolves.not.toThrow()
      expect(redisClient.isConnected()).toBe(true)
    })

    it('should disconnect from Redis successfully', async () => {
      await redisClient.connect()
      await expect(redisClient.disconnect()).resolves.not.toThrow()
      expect(redisClient.isConnected()).toBe(false)
    })

    it('should handle connection errors gracefully', async () => {
      // Test with invalid Redis URL
      const invalidClient = new RedisClient('redis://invalid:6379')
      await expect(invalidClient.connect()).rejects.toThrow()
    })
  })

  describe('basic operations', () => {
    beforeAll(async () => {
      await redisClient.connect()
    })

    it('should set and get values', async () => {
      await redisClient.set('test:key', 'test:value')
      const value = await redisClient.get('test:key')
      expect(value).toBe('test:value')
    })

    it('should handle non-existent keys', async () => {
      const value = await redisClient.get('non:existent:key')
      expect(value).toBeNull()
    })

    it('should delete keys', async () => {
      await redisClient.set('test:delete', 'value')
      await redisClient.del('test:delete')
      const value = await redisClient.get('test:delete')
      expect(value).toBeNull()
    })

    it('should check if keys exist', async () => {
      await redisClient.set('test:exists', 'value')
      const exists = await redisClient.exists('test:exists')
      expect(exists).toBe(true)

      const notExists = await redisClient.exists('test:not:exists')
      expect(notExists).toBe(false)
    })
  })
})