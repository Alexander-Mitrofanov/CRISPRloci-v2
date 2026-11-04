import { createApp } from "vue";

import App from "./App.vue";
import { initializeColorScheme } from "./composables/useColorScheme.js";
import { applyFrameBootPolicy } from "./frameGuard.js";
import "./styles/index.css";

if (applyFrameBootPolicy(window, document)) {
  initializeColorScheme();
  createApp(App).mount("#root");
}
