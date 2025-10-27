import { createClient, RedisClientType } from 'redis'

export class RedisClient {
  private client: RedisClientType
  private connected: boolean = false
  private url: string

  constructor(url: string = 'redis://localhost:6379') {
    this.url = url
    this.client = createClient({
      url,
      socket: {
        connectTimeout: 5000
      }
    })
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return
    }

    try {
      await this.client.connect()
      this.connected = true
    } catch (error) {
      this.connected = false
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client.isOpen) {
        await this.client.quit()
      }
      this.connected = false
    } catch (error) {
      this.connected = false
      throw error
    }
  }

  isConnected(): boolean {
    return this.connected && this.client.isOpen
  }

  async set(key: string, value: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Redis client is not connected')
    }
    await this.client.set(key, value)
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected()) {
      throw new Error('Redis client is not connected')
    }
    return await this.client.get(key)
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Redis client is not connected')
    }
    await this.client.del(key)
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Redis client is not connected')
    }
    const result = await this.client.exists(key)
    return result === 1
  }
}