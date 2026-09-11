
<template>
  <div class="flex flex-col items-center gap-4">
    <input
      type="file"
      accept="image/jpeg, image/png, image/webp, image/gif"
      @change="handleFileChange"
      ref="fileInputRef"
      class="hidden"
      :disabled="isProcessing"
    />
    
    <button
      type="button"
      @click="emit('takePhoto')"
      :disabled="isProcessing"
      :class="[
        'w-full p-4 border-2 border-dashed rounded-lg transition-colors duration-200 ease-in-out flex items-center justify-center space-x-3',
        isProcessing 
          ? 'border-slate-400 bg-slate-200 text-slate-500 cursor-not-allowed' 
          : 'border-slate-400 hover:border-sky-500 text-slate-500 hover:text-sky-500 focus:border-sky-600 focus:text-sky-600 cursor-pointer'
      ]"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" :class="['w-10 h-10', isProcessing ? 'text-slate-500' : 'text-sky-600']">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.776 48.776 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
      </svg>
      <span class="font-medium">
        {{ isProcessing ? 'Processing...' : 'Take a Photo' }}
      </span>
    </button>

    <div class="w-full flex items-center gap-4">
      <hr class="flex-grow border-t border-slate-300"/>
      <span class="text-slate-500 font-medium">OR</span>
      <hr class="flex-grow border-t border-slate-300"/>
    </div>
    
    <div 
      role="button"
      tabindex="0"
      @click="handleSelectClick"
      @keypress.enter="handleSelectClick"
      @dragover.prevent
      @drop.prevent="handleDrop"
      :class="[
        'w-full p-6 border-2 border-dashed rounded-lg transition-colors duration-200 ease-in-out flex flex-col items-center justify-center space-y-2',
        isProcessing 
          ? 'border-slate-400 bg-slate-200 text-slate-500 cursor-not-allowed' 
          : 'border-slate-400 hover:border-sky-500 text-slate-500 hover:text-sky-500 focus:border-sky-600 focus:text-sky-600 cursor-pointer'
      ]"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" :class="['w-12 h-12', isProcessing ? 'text-slate-500' : 'text-sky-600']">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      <span class="font-medium">
        {{ isProcessing ? 'Processing...' : 'Click to select or drag & drop' }}
      </span>
      <span class="text-xs text-slate-500">PNG, JPG, WEBP, GIF (Max 10MB)</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  isProcessing: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['imageSelected', 'takePhoto']);

const fileInputRef = ref(null);

const handleFileChange = (event) => {
  const target = event.target;
  const file = target.files?.[0];
  if (file) {
    emit('imageSelected', file);
  }
  if (target) {
    target.value = '';
  }
};

const handleSelectClick = () => {
  if (!props.isProcessing) {
    fileInputRef.value?.click();
  }
};

const handleDrop = (event) => {
  if (props.isProcessing) return;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    emit('imageSelected', file);
  }
};
</script>
