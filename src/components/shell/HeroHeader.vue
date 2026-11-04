<script setup>
import BrandMark from "../common/BrandMark.vue";
import ColorSchemeToggle from "./ColorSchemeToggle.vue";
import ServiceStatus from "./ServiceStatus.vue";

defineProps({
  service: { type: Object, required: true },
  databaseActive: { type: Boolean, default: false },
});
defineEmits(["analyze", "database", "references"]);
</script>

<template>
  <header
    id="top"
    class="hero"
  >
    <div class="nav-shell">
      <BrandMark @click.prevent="$emit('analyze')" />
      <nav aria-label="Primary navigation">
        <a
          href="?"
          @click.prevent="$emit('analyze')"
          >Methods</a
        ><a
          href="?view=database"
          @click.prevent="$emit('database')"
          >Database</a
        ><a
          href="#references"
          @click.prevent="$emit('references')"
          >References</a
        ><ColorSchemeToggle /><ServiceStatus
          :service="service"
          :analysis-context="databaseActive"
        />
      </nav>
    </div>
  </header>
</template>
