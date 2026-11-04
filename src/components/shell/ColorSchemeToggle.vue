<script setup>
import { computed } from "vue";

import AppIcon from "../common/AppIcon.vue";
import { useColorScheme } from "../../composables/useColorScheme.js";

const { scheme, toggle } = useColorScheme();
const dark = computed(() => scheme.value === "dark");
const label = computed(() => `Switch to ${dark.value ? "light" : "dark"} mode`);
</script>

<template>
  <button
    class="color-scheme-toggle"
    type="button"
    :aria-label="label"
    :title="label"
    :aria-pressed="dark"
    @click="toggle"
  >
    <AppIcon
      :name="dark ? 'sun' : 'moon'"
      :size="18"
    />
    <span class="color-scheme-label">{{ dark ? "Light" : "Dark" }}</span>
  </button>
</template>
