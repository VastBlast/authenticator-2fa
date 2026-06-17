export interface ProtoField {
  fieldNumber: number;
  wireType: number;
  value: bigint | Uint8Array;
}

export function readProtoFields(
  bytes: Uint8Array,
  limits: { maxFields?: number; maxLengthDelimitedBytes?: number } = {}
): ProtoField[] {
  const fields: ProtoField[] = [];
  const maxFields = limits.maxFields ?? Number.POSITIVE_INFINITY;
  const maxLengthDelimitedBytes = limits.maxLengthDelimitedBytes ?? Number.POSITIVE_INFINITY;
  let offset = 0;

  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    offset = tag.nextOffset;
    const fieldNumber = Number(tag.value >> 3n);
    const wireType = Number(tag.value & 7n);

    if (fieldNumber <= 0) {
      throw new Error('Invalid protobuf field number.');
    }

    if (wireType === 0) {
      const value = readVarint(bytes, offset);
      offset = value.nextOffset;
      pushField(fields, { fieldNumber, wireType, value: value.value }, maxFields);
      continue;
    }

    if (wireType === 2) {
      const length = readVarint(bytes, offset);
      offset = length.nextOffset;
      if (length.value > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error('Invalid protobuf length-delimited field.');
      }
      const byteLength = Number(length.value);
      if (byteLength > maxLengthDelimitedBytes) {
        throw new Error('Protobuf length-delimited field is too large.');
      }
      const endOffset = offset + byteLength;
      if (endOffset > bytes.length) {
        throw new Error('Invalid protobuf length-delimited field.');
      }
      pushField(fields, { fieldNumber, wireType, value: bytes.slice(offset, endOffset) }, maxFields);
      offset = endOffset;
      continue;
    }

    if (wireType === 5) {
      if (offset + 4 > bytes.length) {
        throw new Error('Invalid protobuf fixed32 field.');
      }
      offset += 4;
      continue;
    }

    if (wireType === 1) {
      if (offset + 8 > bytes.length) {
        throw new Error('Invalid protobuf fixed64 field.');
      }
      offset += 8;
      continue;
    }

    throw new Error(`Unsupported protobuf wire type ${wireType}.`);
  }

  return fields;
}

function pushField(fields: ProtoField[], field: ProtoField, maxFields: number): void {
  if (fields.length >= maxFields) {
    throw new Error('Protobuf message has too many fields.');
  }
  fields.push(field);
}

function readVarint(bytes: Uint8Array, startOffset: number): { value: bigint; nextOffset: number } {
  let value = 0n;
  let shift = 0n;
  let offset = startOffset;

  while (offset < bytes.length) {
    const byte = bytes[offset];
    value |= BigInt(byte & 0x7f) << shift;
    offset += 1;

    if ((byte & 0x80) === 0) {
      return { value, nextOffset: offset };
    }

    shift += 7n;
    if (shift > 63n) {
      throw new Error('Protobuf varint is too large.');
    }
  }

  throw new Error('Unexpected end of protobuf varint.');
}
