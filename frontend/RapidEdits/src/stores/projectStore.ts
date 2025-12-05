import { defineStore } from 'pinia';
import { ref } from 'vue';
import { editorEngine } from '../core/EditorEngine';
import { globalEventBus } from '../core/EventBus';
import type { Asset } from '../types/Media';

export const useProjectStore = defineStore('project', () => {
  const assets = ref<Asset[]>([]);

  // Sync state with Engine events
  globalEventBus.on('ASSET_ADDED', (asset: Asset) => {
    assets.value.push(asset);
  });

  globalEventBus.on('ASSET_REMOVED', (id: string) => {
    assets.value = assets.value.filter(a => a.id !== id);
  });

  // Actions
  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      await editorEngine.addAsset(file);
    }
  };

  const deleteAsset = (id: string) => {
    editorEngine.removeAsset(id);
  };

  return {
    assets,
    uploadFiles,
    deleteAsset
  };
});
