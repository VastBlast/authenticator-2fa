export interface ProtoField {
  fieldNumber: number;
  wireType: number;
  value: bigint | Uint8Array;
}

export function readProtoFields(bytes: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
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
      fields.push({ fieldNumber, wireType, value: value.value });
      continue;
    }

    if (wireType === 2) {
      const length = readVarint(bytes, offset);
      offset = length.nextOffset;
      const endOffset = offset + Number(length.value);
      if (endOffset > bytes.length) {
        throw new Error('Invalid protobuf length-delimited field.');
      }
      fields.push({ fieldNumber, wireType, value: bytes.slice(offset, endOffset) });
      offset = endOffset;
      continue;
    }

    if (wireType === 5) {
      offset += 4;
      continue;
    }

    if (wireType === 1) {
      offset += 8;
      continue;
    }

    throw new Error(`Unsupported protobuf wire type ${wireType}.`);
  }

  return fields;
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
