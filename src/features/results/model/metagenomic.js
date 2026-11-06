import { asList, asRecord } from "./values.js";

const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
const dna = (value) => (typeof value === "string" && /^[ACGTN]+$/.test(value) ? value : null);
export function normalizeMetagenomic(value) {
  const doc = asRecord(value) || {};
  const sourceGroups = asList(doc.groups).filter(asRecord);
  const groups = sourceGroups.slice(0, 50).map((group) => {
    const sourceSpacers = asList(group.spacers).filter(asRecord);
    return {
      id: typeof group.id === "string" ? group.id : null,
      consensusRepeat: dna(group.consensus_repeat),
      spacers: sourceSpacers.slice(0, 50).map((spacer) => ({
        repeatVariant: dna(spacer.repeat_variant),
        sequence: dna(spacer.sequence),
      })),
      truncated: group.spacers_truncated === true || sourceSpacers.length > 50,
    };
  });
  return {
    available: doc.available === true && doc.status === "completed",
    groups,
    counts: { groups: count(doc.counts?.groups), spacers: count(doc.counts?.spacers) },
    reads: count(doc.input?.reads),
    bases: count(doc.input?.bases),
    truncated:
      doc.groups_truncated === true ||
      sourceGroups.length > 50 ||
      groups.some((group) => group.truncated),
    warnings: asList(doc.warnings).filter((warning) => typeof warning === "string"),
  };
}
