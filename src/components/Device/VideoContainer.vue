<script setup lang="ts">
import { ref, onMounted, onUnmounted, provide, computed } from "vue";
import {
  AndroidMotionEventAction,
  AndroidMotionEventButton,
  ScrcpyPointerId,
  type ScrcpySetClipboardControlMessage,
} from "@yume-chan/scrcpy";
import client from "../Scrcpy/client";
import state from "../Scrcpy/scrcpy";

const videoContainer = ref<HTMLDivElement | null>(null);
const videoWrapper = ref<HTMLDivElement | null>(null);
const isVideoContainerFocused = ref(false);
const isCanvasReady = ref(false);
const isFullyRendered = ref(false);

const MOUSE_EVENT_BUTTON_TO_ANDROID_BUTTON = [
  AndroidMotionEventButton.Primary,
  AndroidMotionEventButton.Tertiary,
  AndroidMotionEventButton.Secondary,
  AndroidMotionEventButton.Back,
  AndroidMotionEventButton.Forward,
];

const isReady = computed(
  () =>
    state.scrcpy &&
    state.canvas &&
    isVideoContainerFocused.value &&
    isCanvasReady.value &&
    isFullyRendered.value
);

const isPointInCanvas = (clientX: number, clientY: number): boolean => {
  if (!state.canvas) return false;
  const rect = state.canvas.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
};

const handleWheel = (e: WheelEvent) => {
  if (!isReady.value || !isPointInCanvas(e.clientX, e.clientY)) {
    return;
  }
  videoContainer.value?.focus();
  e.preventDefault();
  e.stopPropagation();

  const { x, y } = state.clientPositionToDevicePosition(e.clientX, e.clientY);
  state.scrcpy?.controller!.injectScroll({
    screenWidth: state.width!,
    screenHeight: state.height!,
    pointerX: x,
    pointerY: y,
    scrollX: -e.deltaX / 100,
    scrollY: -e.deltaY / 100,
    buttons: 0,
  });
};

const injectTouch = (action: AndroidMotionEventAction, e: PointerEvent) => {
  if (
    !isReady.value ||
    !state.hoverHelper ||
    !isPointInCanvas(e.clientX, e.clientY)
  ) {
    return;
  }

  const { pointerType } = e;
  const pointerId: bigint =
    pointerType === "mouse" ? ScrcpyPointerId.Finger : BigInt(e.pointerId);

  const { x, y } = state.clientPositionToDevicePosition(e.clientX, e.clientY);

  const messages = state.hoverHelper.process({
    action,
    pointerId,
    screenWidth: state.width!,
    screenHeight: state.height!,
    pointerX: x,
    pointerY: y,
    pressure: e.pressure,
    actionButton: MOUSE_EVENT_BUTTON_TO_ANDROID_BUTTON[e.button],
    buttons: e.buttons,
  });
  messages.forEach((message) => state.scrcpy?.controller?.injectTouch(message));
};

const handlePointerDown = (e: PointerEvent) => {
  if (!isReady.value || !isPointInCanvas(e.clientX, e.clientY)) return;

  state.fullScreenContainer?.focus();
  e.preventDefault();
  e.stopPropagation();

  (e.currentTarget as HTMLDivElement)?.setPointerCapture(e.pointerId);
  injectTouch(AndroidMotionEventAction.Down, e);
};

const handlePointerMove = (e: PointerEvent) => {
  if (!isReady.value || !isPointInCanvas(e.clientX, e.clientY)) return;

  e.preventDefault();
  e.stopPropagation();
  injectTouch(
    e.buttons === 0
      ? AndroidMotionEventAction.HoverMove
      : AndroidMotionEventAction.Move,
    e
  );
};

const handlePointerUp = (e: PointerEvent) => {
  if (!isReady.value || !isPointInCanvas(e.clientX, e.clientY)) return;

  e.preventDefault();
  e.stopPropagation();
  injectTouch(AndroidMotionEventAction.Up, e);
};

const handlePointerLeave = (e: PointerEvent) => {
  if (!isReady.value || !isPointInCanvas(e.clientX, e.clientY)) return;

  e.preventDefault();
  e.stopPropagation();
  injectTouch(AndroidMotionEventAction.HoverExit, e);
  injectTouch(AndroidMotionEventAction.Up, e);
};

const handleContextMenu = (e: MouseEvent) => {
  if (!isReady.value || !isPointInCanvas(e.clientX, e.clientY)) return;
  e.preventDefault();
};

// 辅助函数：处理可能的 BigInt 转换问题
const sanitizeText = (text: string): string => {
  // 移除可能导致 BigInt 转换问题的内容
  return text.replace(/[nN]$/g, "");
};

const handlePaste = async () => {
  if (!isReady.value || !state.scrcpy || !state.scrcpy.controller) return;
  try {
    const clipboardText = await navigator.clipboard.readText();
    const sanitizedText = sanitizeText(clipboardText);

    const clipboardMessage: Omit<ScrcpySetClipboardControlMessage, "type"> = {
      sequence: BigInt(0), // 使用 BigInt(0) 作为序列号
      paste: true, // 设置为 true，因为这是粘贴操作
      content: sanitizedText, // 使用 content 替代 text
    };

    await state.scrcpy.controller.setClipboard(clipboardMessage);
    console.log("已粘贴到设备:", sanitizedText);
  } catch (error) {
    console.error("粘贴到设备失败:", error);
  }
};

const handleKeyEvent = (e: KeyboardEvent) => {
  if (!isReady.value || !state.keyboard) return;
  e.preventDefault();
  e.stopPropagation();

  const { type, code, ctrlKey, metaKey } = e;

  if (type === "keydown" && (ctrlKey || metaKey)) {
    if (code === "KeyV") {
      handlePaste();
      return;
    }
  }

  state.keyboard[type === "keydown" ? "down" : "up"](code);
};

const handleFocus = () => {
  isVideoContainerFocused.value = true;
};

const handleBlur = () => {
  isVideoContainerFocused.value = false;
};

const checkRendering = () => {
  if (state.running) {
    isFullyRendered.value = true;
    clearInterval(renderingCheckInterval);
  }
};

let renderingCheckInterval: number;

// 添加鼠标进入事件处理
const handleMouseEnter = () => {
  if (videoContainer.value) {
    videoContainer.value.focus();
    isVideoContainerFocused.value = true;
  }
};

// 添加鼠标离开事件处理
const handleMouseLeave = () => {
  isVideoContainerFocused.value = false;
};

onMounted(() => {
  if (videoContainer.value) {
    videoContainer.value.addEventListener("wheel", handleWheel, {
      passive: false,
    });
    videoContainer.value.addEventListener("focus", handleFocus);
    videoContainer.value.addEventListener("blur", handleBlur);
    // 添加鼠标进入离开事件监听
    videoContainer.value.addEventListener("mouseenter", handleMouseEnter);
    videoContainer.value.addEventListener("mouseleave", handleMouseLeave);
  }
  if (client.device && videoContainer.value) {
    state.setRendererContainer(videoContainer.value);
    state.start(client.device as any).then(() => {
      isCanvasReady.value = true;
      // 开始检查渲染状态
      renderingCheckInterval = setInterval(checkRendering, 100);
    });
  }
  if ("keyboard" in navigator) {
    // navigator.keyboard.lock();
  }

  window.addEventListener("keydown", handleKeyEvent);
  window.addEventListener("keyup", handleKeyEvent);
});

onUnmounted(() => {
  if (videoContainer.value) {
    videoContainer.value.removeEventListener("wheel", handleWheel);
    videoContainer.value.removeEventListener("focus", handleFocus);
    videoContainer.value.removeEventListener("blur", handleBlur);
    // 移除鼠标进入离开事件监听
    videoContainer.value.removeEventListener("mouseenter", handleMouseEnter);
    videoContainer.value.removeEventListener("mouseleave", handleMouseLeave);
  }
  if ("keyboard" in navigator) {
    // navigator.keyboard.unlock();
  }
  window.removeEventListener("keydown", handleKeyEvent);
  window.removeEventListener("keyup", handleKeyEvent);
  clearInterval(renderingCheckInterval);
});

// 提供一个方法来设置焦点状态，供父组件使用
provide("setVideoContainerFocus", (focused: boolean) => {
  isVideoContainerFocused.value = focused;
});
</script>

<template>
  <div ref="videoWrapper" class="video-wrapper">
    <div
      ref="videoContainer"
      class="video-container"
      tabindex="0"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @pointerleave="handlePointerLeave"
      @contextmenu="handleContextMenu"
      @wheel="handleWheel"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    />
  </div>
</template>

<style scoped>
.video-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: transparent;
}

.loading-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 18px;
  color: #303133;
}

.video-container {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: transparent;
  cursor: crosshair;
  overflow: hidden;
  outline: none;
}

/* 确保 canvas 元素正确显示并添加边框 */
.video-container :deep(canvas) {
  display: block;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: auto !important;
  height: auto !important;
  max-width: calc(100% - 6px);
  max-height: calc(100% - 6px);
  background-color: transparent;
  border: 3px solid #303133;
  border-radius: 16px;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}
</style>
