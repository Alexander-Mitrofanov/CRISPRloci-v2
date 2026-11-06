<script setup>
import { computed } from "vue";
import { formatNumber } from "../../utils/formatting.js";
const props = defineProps({
  available: Boolean,
  groups: { type: Array, required: true },
  counts: { type: Object, required: true },
  reads: { type: Number, default: null },
  bases: { type: Number, default: null },
  warnings: { type: Array, default: () => [] },
  truncated: Boolean,
  compact: Boolean,
});
const visibleGroups = computed(() => (props.compact ? props.groups.slice(0, 3) : props.groups));
</script>
<template>
  <section
    class="result-section metagenomic-results"
    aria-label="Metagenomic CRISPR groups"
  >
    <h3>MCAAT repeat and spacer groups</h3>
    <p v-if="!available">Completed metagenomic CRISPR evidence is unavailable.</p>
    <template v-else>
      <p>
        <strong>{{ formatNumber(counts.groups) }} graph groups</strong> ·
        {{ formatNumber(counts.spacers) }} reported spacers · {{ formatNumber(reads) }} reads ·
        {{ formatNumber(bases) }} input bases
      </p>
      <p>
        Groups describe repeat and spacer evidence in the read graph. Genomic coordinates are
        unavailable; host identity, array order, orientation and evolutionary history are not
        inferred.
      </p>
      <p>
        Reads are processed as one single-end pool. Quality scores are retained with the input;
        quality filtering is not performed.
      </p>
      <p
        v-for="warning in warnings"
        :key="warning"
        role="note"
      >
        {{ warning }}
      </p>
      <p
        v-if="truncated"
        role="note"
      >
        <strong>Preview truncated.</strong> Up to 50 groups and 50 spacers per group are shown.
        Download the complete metagenomic.json from Files &amp; methods.
      </p>
      <p v-if="compact && groups.length">
        Open Read groups for repeat variants and spacer sequences.
      </p>
      <p v-if="!groups.length && counts.groups === 0">
        MCAAT reported no repeat and spacer groups in this read pool.
      </p>
      <p v-else-if="!groups.length">
        No groups are included in this preview; consult the complete report.
      </p>
      <article
        v-for="(group, index) in visibleGroups"
        :key="group.id || index"
        class="repeat-instance read-group"
      >
        <h4>{{ group.id || "Unnamed graph group" }}</h4>
        <p>Consensus repeat</p>
        <code>{{ group.consensusRepeat ?? "Not reported" }}</code>
        <template v-if="!compact">
          <p>
            Spacer rows retain the report's display sequence; they do not establish genomic order.
          </p>
          <p v-if="group.truncated">
            Spacer preview truncated; complete evidence is in metagenomic.json.
          </p>
          <table v-if="group.spacers.length">
            <caption>
              Repeat variants and spacers for
              {{
                group.id || "this group"
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">Repeat variant</th>
                <th scope="col">Spacer sequence</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(spacer, spacerIndex) in group.spacers"
                :key="spacerIndex"
              >
                <td>
                  <code>{{ spacer.repeatVariant ?? "Not reported" }}</code>
                </td>
                <td>
                  <code>{{ spacer.sequence ?? "Not reported" }}</code>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else>No spacer sequences are included in this group preview.</p>
        </template>
      </article>
    </template>
  </section>
</template>
<style scoped>
.metagenomic-results,
.read-group {
  min-width: 0;
  overflow-wrap: anywhere;
}
.read-group code {
  white-space: normal;
  overflow-wrap: anywhere;
}
.read-group table {
  width: 100%;
  table-layout: fixed;
  margin-top: 1rem;
}
.read-group caption {
  text-align: left;
  margin-bottom: 0.5rem;
}
.read-group th,
.read-group td {
  vertical-align: top;
  padding: 0.6rem;
  text-align: left;
}
.read-group th {
  border-bottom: 1px solid var(--line);
}
@media (max-width: 480px) {
  .read-group th,
  .read-group td {
    padding: 0.4rem 0.25rem;
  }
}
</style>
