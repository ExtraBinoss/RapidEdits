<script setup lang="ts">
import { ref } from "vue";
import { useProjectStore } from "../../stores/projectStore";
import { MediaType } from "../../types/Media";
import { Search } from "lucide-vue-next";
import AssetCard from "./AssetCard.vue";
import FileDropZone from "../UI/File/FileDropZone.vue";
import Input from "../UI/Input/Input.vue";
import Tabs from "../UI/Tabs/Tabs.vue";
import TabList from "../UI/Tabs/TabList.vue";
import Tab from "../UI/Tabs/Tab.vue";
import TabPanels from "../UI/Tabs/TabPanels.vue";
import TabPanel from "../UI/Tabs/TabPanel.vue";

const store = useProjectStore();
const searchQuery = ref("");
const activeTab = ref("all");

const mediaTabs = [
    {
        value: "all",
        label: "All",
        activeClass: "bg-canvas-dark text-text-main shadow-sm",
    },
    {
        value: "video",
        label: "Video",
        activeClass:
            "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm",
    },
    {
        value: "image",
        label: "Image",
        activeClass:
            "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm",
    },
    {
        value: "audio",
        label: "Audio",
        activeClass:
            "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm",
    },
];

const filterAssets = (type?: string) => {
    let assets = store.assets;
    // Filter out unknown types if needed, or keeping them in All
    if (type) {
        assets = assets.filter((a: any) => a.type === type);
    } else {
        // for 'all', we generally exclude unknown/deleted if any, but store.assets should be clean
    }

    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        assets = assets.filter((a: any) =>
            a.name.toLowerCase().includes(query),
        );
    }
    return assets.slice().reverse(); // Show newest first
};

const getAssetsForTab = (tabValue: string) => {
    switch (tabValue) {
        case "video":
            return filterAssets(MediaType.VIDEO);
        case "image":
            return filterAssets(MediaType.IMAGE);
        case "audio":
            return filterAssets(MediaType.AUDIO);
        default:
            return filterAssets();
    }
};
</script>

<template>
    <div class="flex flex-col h-full bg-canvas-light text-text-main">
        <!-- Header & Search -->
        <div class="p-4 space-y-4 border-b border-canvas-border shrink-0">
            <h2 class="font-semibold text-lg">Media Library</h2>
            <Input v-model="searchQuery" placeholder="Search assets...">
                <template #prepend>
                    <Search class="w-4 h-4" />
                </template>
            </Input>
        </div>

        <!-- Tabs -->
        <Tabs v-model="activeTab" class="flex-1 overflow-hidden flex flex-col">
            <div class="px-4 pt-2 shrink-0">
                <TabList>
                    <Tab
                        v-for="tab in mediaTabs"
                        :key="tab.value"
                        :value="tab.value"
                        :active-class="tab.activeClass"
                    >
                        {{ tab.label }}
                    </Tab>
                </TabList>
            </div>

            <TabPanels class="flex-1 overflow-hidden relative">
                <TabPanel
                    v-for="tab in mediaTabs"
                    :key="tab.value"
                    :value="tab.value"
                    class="h-full flex flex-col"
                >
                    <div class="flex-1 overflow-y-auto p-4 space-y-4">
                        <FileDropZone />

                        <div
                            class="grid grid-cols-2 gap-3"
                            v-if="getAssetsForTab(tab.value).length > 0"
                        >
                            <AssetCard
                                v-for="asset in getAssetsForTab(tab.value)"
                                :key="asset.id"
                                :asset="asset"
                                @delete="store.deleteAsset"
                            />
                        </div>

                        <div
                            v-else
                            class="text-center py-12 text-text-muted text-sm"
                        >
                            No media found.
                        </div>
                    </div>
                </TabPanel>
            </TabPanels>
        </Tabs>
    </div>
</template>
