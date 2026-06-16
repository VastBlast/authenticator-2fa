<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { IScannerControls } from '@zxing/browser';
  import { Camera, Square } from '@lucide/svelte';
  import { startCameraQrScan } from '../../auth/qr';
  import type { MessageKey } from '../../i18n/messages';

  interface Props {
    tr: (key: MessageKey) => string;
    onscan: (text: string) => void | Promise<void>;
  }

  let { tr, onscan }: Props = $props();
  let video: HTMLVideoElement;
  let controls: IScannerControls | null = null;
  let scanning = $state(false);
  let error = $state('');

  async function start() {
    error = '';
    try {
      controls = await startCameraQrScan(
        video,
        async (text) => {
          scanning = false;
          await onscan(text);
        },
        (message) => {
          error = message;
        }
      );
      scanning = true;
    } catch (scanError) {
      error = scanError instanceof Error ? scanError.message : tr('cameraUnavailable');
      scanning = false;
    }
  }

  function stop() {
    controls?.stop();
    controls = null;
    scanning = false;
  }

  onDestroy(stop);
</script>

<div class="camera-panel">
  <video class="camera-preview" bind:this={video} muted playsinline></video>

  {#if error}
    <div class="alert alert-error" role="alert">{error}</div>
  {/if}

  <div class="dialog-actions">
    {#if scanning}
      <button class="btn" type="button" onclick={stop}>
        <Square size={16} aria-hidden="true" />
        {tr('cancel')}
      </button>
    {:else}
      <button class="btn btn-primary" type="button" onclick={start}>
        <Camera size={16} aria-hidden="true" />
        {tr('camera')}
      </button>
    {/if}
  </div>
</div>
