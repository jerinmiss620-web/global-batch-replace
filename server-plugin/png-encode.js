import { crc32 } from 'crc';

// Encode each already-parsed chunk unchanged, including its original ordering.
export default function encode(chunks) {
    const output = Buffer.alloc(8 + chunks.reduce((sum, chunk) => sum + chunk.data.length + 12, 0));
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(output);
    let offset = 8;
    for (const { name, data } of chunks) {
        if (!/^[A-Za-z]{4}$/.test(name)) throw Error('无效的 PNG 区块类型。');
        output.writeUInt32BE(data.length, offset);
        output.write(name, offset + 4, 4, 'ascii');
        Buffer.from(data).copy(output, offset + 8);
        output.writeUInt32BE(crc32(output.subarray(offset + 4, offset + 8 + data.length)) >>> 0, offset + 8 + data.length);
        offset += data.length + 12;
    }
    return output;
}
