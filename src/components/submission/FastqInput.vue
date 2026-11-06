<script setup>
import { ref } from "vue";
import { readableBytes } from "../../utils/formatting.js";
import AppIcon from "../common/AppIcon.vue";

const props = defineProps({
  sequence: { type: String, required: true },
  filename: { type: String, required: true },
  inspection: { type: Object, required: true },
  maxRequestBytes: { type: Number, default: 0 },
});
const emit = defineEmits(["update:sequence", "update:filename"]);
const fileInput = ref(null);
const fileError = ref("");
function updateSequence(value) {
  emit("update:sequence", value);
  emit("update:filename", "pasted-reads.fastq");
  fileError.value = "";
}
async function onFile(event) {
  const [file] = event.target.files || [];
  event.target.value = "";
  if (!file) return;
  const limit = Math.min(20_000_000, props.maxRequestBytes || 20_000_000);
  if (file.size > limit) {
    fileError.value = `The selected file exceeds the ${readableBytes(limit)} input limit.`;
    return;
  }
  if (/\.(?:gz|bz2|xz|zip)$/i.test(file.name)) {
    fileError.value = "Upload an uncompressed plain-text FASTQ file.";
    return;
  }
  try {
    emit("update:sequence", await file.text());
    emit("update:filename", file.name);
    fileError.value = "";
  } catch {
    fileError.value = "The selected file could not be read as plain text.";
  }
}
</script>
<template>
  <div class="input-panel">
    <div class="input-heading">
      <div>
        <label for="fasta-input">Single-end DNA reads</label>
        <p>Plain FASTQ with four lines per read and matching quality scores.</p>
      </div>
    </div>
    <div class="upload-strip">
      <button
        class="upload-button"
        type="button"
        @click="fileInput?.click()"
      >
        <AppIcon
          name="upload"
          :size="18"
        />
        Upload FASTQ
      </button>
      <input
        ref="fileInput"
        type="file"
        tabindex="-1"
        accept=".fastq,.fq,.txt,text/plain"
        aria-label="Upload FASTQ file"
        @change="onFile"
      />
      <span class="filename">{{ sequence ? filename : "No file selected" }}</span>
      <span class="input-stats"
        ><b>{{ inspection.recordCount.toLocaleString() }}</b> reads</span
      >
    </div>
    <p class="input-limits">
      <strong>DNA</strong> · 1–100,000 reads · 30–500 nt per read · 20 MB text maximum
    </p>
    <textarea
      id="fasta-input"
      spellcheck="false"
      :value="sequence"
      placeholder="@read_1&#10;ACGTACGTACGTACGTACGTACGTACGTACGT&#10;+&#10;IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII"
      aria-describedby="fastq-help fasta-errors"
      :aria-invalid="sequence && !inspection.valid ? 'true' : undefined"
      @input="updateSequence($event.target.value)"
    />
    <div
      id="fastq-help"
      class="input-foot"
    >
      <span
        >A/C/G/T/N accepted. Supply one single-end read pool; paired-end relationships are not used.
        Input stays local until submission.</span
      >
    </div>
    <div
      id="fasta-errors"
      class="field-errors"
      role="alert"
    >
      <p v-if="fileError">{{ fileError }}</p>
      <p
        v-for="item in sequence ? inspection.errors.slice(0, 3) : []"
        :key="item"
      >
        {{ item }}
      </p>
    </div>
  </div>
</template>
