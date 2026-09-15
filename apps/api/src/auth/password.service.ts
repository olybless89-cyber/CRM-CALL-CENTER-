import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Isolates password hashing so the algorithm/parameters are changeable
 * in one place and independently unit-testable. See ADR-0004 for why
 * argon2id was chosen over bcrypt.
 */
@Injectable()
export class PasswordService {
  async hash(plainText: string): Promise<string> {
    return argon2.hash(plainText, { type: argon2.argon2id });
  }

  async verify(hash: string, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainText);
    } catch {
      return false;
    }
  }
}
