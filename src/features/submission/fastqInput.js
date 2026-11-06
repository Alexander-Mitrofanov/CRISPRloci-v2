const MAX_BYTES = 20_000_000;
const MAX_READS = 100_000;

// The API independently validates and canonicalizes the complete read pool.
export function inspectFastq(text, { maxHeaderCharacters = 200 } = {}) {
  const invalid = (message) => ({
    valid: false,
    records: [],
    recordCount: 0,
    baseCount: 0,
    errors: [message],
  });
  if (typeof text !== "string" || !text) return invalid("Add at least one single-end FASTQ read.");
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES)
    return invalid("FASTQ input exceeds the 20 MB text limit.");
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.length % 4 !== 0)
    return invalid("Use plain FASTQ with exactly four lines per read, including quality scores.");
  if (lines.length / 4 > MAX_READS) return invalid("FASTQ input exceeds the 100,000 read limit.");
  const records = [];
  const identifiers = new Set();
  let baseCount = 0;
  for (let offset = 0; offset < lines.length; offset += 4) {
    const [headerLine, sequence, separator, quality] = lines.slice(offset, offset + 4);
    const header = headerLine.slice(1);
    const identifier = header.split(" ")[0];
    const read = offset / 4 + 1;
    if (
      !headerLine.startsWith("@") ||
      !identifier ||
      !/^[\x20-\x7e]+$/.test(header) ||
      header.length > Math.min(maxHeaderCharacters, 200)
    )
      return invalid(
        `Read ${read}: use a nonempty printable ASCII FASTQ header of at most ${Math.min(maxHeaderCharacters, 200)} characters.`,
      );
    if (identifiers.has(identifier))
      return invalid(`Read identifier “${identifier}” is duplicated.`);
    if (!/^[ACGTNacgtn]{30,500}$/.test(sequence))
      return invalid(`Read ${read}: DNA reads must contain 30–500 A/C/G/T/N bases.`);
    if (separator !== "+" && separator !== `+${header}`)
      return invalid(`Read ${read}: use a bare + separator or repeat the complete header after +.`);
    if (quality.length !== sequence.length || !/^[!-~]+$/.test(quality))
      return invalid(
        `Read ${read}: quality scores must match the DNA length and use ASCII characters 33–126.`,
      );
    records.push({ header, identifier, sequence: sequence.toUpperCase() });
    identifiers.add(identifier);
    baseCount += sequence.length;
  }
  return { valid: records.length > 0, records, recordCount: records.length, baseCount, errors: [] };
}
