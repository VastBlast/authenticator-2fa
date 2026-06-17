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

  test('enforces configured field and length limits', () => {
    expect(() => readProtoFields(Uint8Array.from([1 << 3, 1, 1 << 3, 2]), { maxFields: 1 })).toThrow(
      'Protobuf message has too many fields.'
    );
    expect(() => readProtoFields(Uint8Array.from([(1 << 3) | 2, 2, 0, 1]), {
      maxLengthDelimitedBytes: 1
    })).toThrow('Protobuf length-delimited field is too large.');
  });
});
