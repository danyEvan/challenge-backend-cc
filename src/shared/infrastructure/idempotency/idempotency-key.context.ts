import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

@Injectable()
export class IdempotencyKeyContext {
  private readonly storage = new AsyncLocalStorage<string>();

  run<T>(key: string, callback: () => T): T {
    return this.storage.run(key, callback);
  }

  get(): string {
    const key = this.storage.getStore();
    if (!key) {
      throw new Error('Idempotency key is not available in this request');
    }

    return key;
  }
}
