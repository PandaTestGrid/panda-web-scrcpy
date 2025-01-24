<script setup lang="ts">
import { ref, onMounted, onUnmounted, provide, computed } from "vue";
import {
  AndroidMotionEventAction,
  AndroidMotionEventButton,
  ScrcpyPointerId,
  type ScrcpySetClipboardControlMessage,
} from "@yume-chan/scrcpy";
import { DEVICES_STATE, SCRCPY_STATE } from "../state";

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

const props = defineProps<{
  deviceSerial: string;
  isMainControl?: boolean; // 是否是主控设备
}>();

const state = computed(() => {
  return SCRCPY_STATE.getScrcpyState(props.deviceSerial);
});

const isReady = computed(
  () =>
    state.value?.scrcpy &&
    state.value?.canvas &&
    isVideoContainerFocused.value &&
    isCanvasReady.value &&
    isFullyRendered.value
);

const isPointInCanvas = (clientX: number, clientY: number): boolean => {
  if (!state.value?.canvas) return false;
  const rect = state.value.canvas.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
};

const isGroupControl = ref(false); // 是否开启群控模式

const allDeviceStates = computed(() => {
  return SCRCPY_STATE.getAllConnections().filter(
    (conn) => conn.adb.serial !== props.deviceSerial // 排除自身
  );
});

const syncEventToOtherDevices = (eventType: string, eventData: any) => {
  if (!isGroupControl.value || !props.isMainControl) return;

  allDeviceStates.value.forEach(({ state }) => {
    switch (eventType) {
      case "touch":
        state?.scrcpy?.controller?.injectTouch(eventData);
        break;
      case "scroll":
        state?.scrcpy?.controller?.injectScroll(eventData);
        break;
      case "keyboard":
        state?.keyboard?.[eventData.type](eventData.code);
        break;
    }
  });
};

const handleWheel = (e: WheelEvent) => {
  if (!isReady.value || !isPointInCanvas(e.clientX, e.clientY)) {
    return;
  }
  videoContainer.value?.focus();
  e.preventDefault();
  e.stopPropagation();

  const { x, y } = state.value!.clientPositionToDevicePosition(
    e.clientX,
    e.clientY
  );

  const scrollData = {
    screenWidth: state.value!.width!,
    screenHeight: state.value!.height!,
    pointerX: x,
    pointerY: y,
    scrollX: -e.deltaX / 100,
    scrollY: -e.deltaY / 100,
    buttons: 0,
  };

  state.value?.scrcpy?.controller!.injectScroll(scrollData);

  // 同步滚动事件
  syncEventToOtherDevices("scroll", scrollData);
};

const injectTouch = (action: AndroidMotionEventAction, e: PointerEvent) => {
  if (
    !isReady.value ||
    !state.value?.hoverHelper ||
    !isPointInCanvas(e.clientX, e.clientY)
  ) {
    return;
  }

  const { pointerType } = e;
  const pointerId: bigint =
    pointerType === "mouse" ? ScrcpyPointerId.Finger : BigInt(e.pointerId);

  const { x, y } = state.value!.clientPositionToDevicePosition(
    e.clientX,
    e.clientY
  );

  const touchData = {
    action,
    pointerId,
    screenWidth: state.value!.width!,
    screenHeight: state.value!.height!,
    pointerX: x,
    pointerY: y,
    pressure: e.pressure,
    actionButton: MOUSE_EVENT_BUTTON_TO_ANDROID_BUTTON[e.button],
    buttons: e.buttons,
  };

  const messages = state.value?.hoverHelper.process(touchData);
  messages.forEach((message) => {
    state.value?.scrcpy?.controller?.injectTouch(message);
    // 同步触摸事件
    syncEventToOtherDevices("touch", message);
  });
};

const handlePointerDown = (e: PointerEvent) => {
  if (!isReady.value || !isPointInCanvas(e.clientX, e.clientY)) return;

  state.value!.fullScreenContainer?.focus();
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
  if (!isReady.value || !state.value?.scrcpy || !state.value?.scrcpy.controller)
    return;
  try {
    const clipboardText = await navigator.clipboard.readText();
    const sanitizedText = sanitizeText(clipboardText);

    const clipboardMessage: Omit<ScrcpySetClipboardControlMessage, "type"> = {
      sequence: BigInt(0), // 使用 BigInt(0) 作为序列号
      paste: true, // 设置为 true，因为这是粘贴操作
      content: sanitizedText, // 使用 content 替代 text
    };

    await state.value.scrcpy.controller.setClipboard(clipboardMessage);
    console.log("已粘贴到设备:", sanitizedText);
  } catch (error) {
    console.error("粘贴到设备失败:", error);
  }
};

const handleKeyEvent = (e: KeyboardEvent) => {
  if (!isReady.value || !state.value?.keyboard) return;
  e.preventDefault();
  e.stopPropagation();

  const { type, code, ctrlKey, metaKey } = e;

  if (type === "keydown" && (ctrlKey || metaKey)) {
    if (code === "KeyV") {
      handlePaste();
      return;
    }
  }

  state.value.keyboard[type === "keydown" ? "down" : "up"](code);

  // 同步键盘事件
  syncEventToOtherDevices("keyboard", {
    type: type === "keydown" ? "down" : "up",
    code,
  });
};

const handleFocus = () => {
  isVideoContainerFocused.value = true;
};

const handleBlur = () => {
  isVideoContainerFocused.value = false;
};

const checkRendering = () => {
  if (state.value?.running) {
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
  const adb = DEVICES_STATE.getAdb(props.deviceSerial);
  console.log(adb?.getProp("ro.product.model"));
  if (adb && videoContainer.value) {
    SCRCPY_STATE.addConnection(adb, videoContainer.value)
      .then(() => {
        isCanvasReady.value = true;
        renderingCheckInterval = setInterval(checkRendering, 100);
      })
      .catch((error) => {
        console.error("启动投屏失败:", error);
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
    <!-- 添加群控模式控制按钮 -->
    <div class="control-panel" v-if="props.isMainControl">
      <v-switch
        v-model="isGroupControl"
        :label="isGroupControl ? '群控已开启' : '群控已关闭'"
        color="primary"
        hide-details
        dense
      />
    </div>

    <!-- 显示设备状态标签 -->
    <div class="device-status">
      <v-chip
        :color="props.isMainControl ? 'primary' : 'default'"
        small
        class="ma-2"
      >
        {{ props.isMainControl ? "主控设备" : "从控设备" }}
      </v-chip>
      <v-chip
        v-if="isGroupControl && props.isMainControl"
        color="success"
        small
        class="ma-2"
      >
        群控模式
      </v-chip>
    </div>

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

/* 添加新的样式 */
.control-panel {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 100;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px;
  border-radius: 4px;
}

.device-status {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 100;
}
</style>
