import { ref } from 'vue';

export function useDragDrop(onFilesDropped: (files: FileList) => void) {
  const isDragging = ref(false);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.value = true;
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if we're actually leaving the drop zone or just entering a child
    if (e.currentTarget && (e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
        return;
    }
    isDragging.value = false;
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.value = true;
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.value = false;

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      onFilesDropped(e.dataTransfer.files);
    }
  };

  return {
    isDragging,
    events: {
      dragenter: handleDragEnter,
      dragleave: handleDragLeave,
      dragover: handleDragOver,
      drop: handleDrop
    }
  };
}
