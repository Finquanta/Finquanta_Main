// Jest globals are available globally
import { RedisClient } from '../../src/infrastructure/redis'

describe('RedisClient', () => {
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