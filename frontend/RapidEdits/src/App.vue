<script setup lang="ts">
import Header from "./components/Header.vue";
import Sidebar from "./components/Sidebar.vue";
import Timeline from "./components/Timeline.vue";
import Preview from "./components/Preview.vue";
import Properties from "./components/Properties.vue";
</script>

<template>
  <div class="flex flex-col h-screen w-full bg-gray-950 text-white font-sans">
    <!-- Top Header -->
    <Header />

    <!-- Main Content Area -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left Sidebar (Assets) -->
      <Sidebar />

      <!-- Center Workspace -->
      <div class="flex-1 flex flex-col min-w-0 bg-gray-900">
        <!-- Upper Workspace: Preview & Properties -->
        <div class="flex flex-1 min-h-0">
          <!-- Preview Area (PixiJS) -->
          <div
            class="flex-1 relative bg-black/50 flex items-center justify-center overflow-hidden p-4"
          >
            <Preview />
          </div>

          <!-- Right Sidebar (Properties) -->
          <Properties />
        </div>

        <!-- Bottom: Timeline -->
        <div class="h-72 border-t border-gray-800 bg-gray-900 flex flex-col">
          <Timeline />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
