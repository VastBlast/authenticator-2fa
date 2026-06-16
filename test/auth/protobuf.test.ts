import { describe, expect, test } from 'vitest';
import { readProtoFields } from '../../src/lib/auth/protobuf';

describe('protobuf reader', () => {
  test('rejects truncated fixed-width fields', () => {
    expect(() => readProtoFields(Uint8Array.from([(1 << 3) | 5, 0x00]))).toThrow(
      'Invalid protobuf fixed32 field.'
    );
    expect(() => readProtoFields(Uint8Array.from([(1 << 3) | 1, 0x00]))).toThrow(
      'Invalid protobuf fixed64 field.'
    );
  });
});
