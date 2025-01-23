<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { encodeUtf8 } from '@yume-chan/adb';
import client from '../device/adb-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const term = ref<HTMLDivElement | null>(null);

onMounted(async () => {
    try {
        await startTerminal();
    } catch (error) {
        console.error('启动终端时出错:', error);
    }
});

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;

async function startTerminal() {
    if (terminal) {
        terminal.dispose();
        terminal = null;
    }
    if (!client.device) {
        console.error('设备未设置');
        return;
    }
    terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontFamily: 'Roboto Mono, monospace',
        fontSize: 14,
        lineHeight: 1.2,
        allowTransparency: true,
        theme: {
            background: '#2c3e50',
            foreground: '#ecf0f1',
            cursor: '#e74c3c',
            black: '#2c3e50',
            red: '#e74c3c',
            green: '#2ecc71',
            yellow: '#f1c40f',
            blue: '#3498db',
            magenta: '#9b59b6',
            cyan: '#1abc9c',
            white: '#ecf0f1',
        },
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    if (term.value) {
        terminal.open(term.value);
        fitAddon.fit();
    } else {
        console.error('Terminal container not found');
        return;
    }

    const process = await client.device?.subprocess.shell();
    if (!process) {
        console.error('获取 subprocess 失败');
        return;
    }

    process.stdout
        .pipeTo(
            new WritableStream({
                write(chunk) {
                    terminal?.write(chunk);
                },
            }) as any
        )
        .catch((error) => {
            console.error('输出流错误:', error);
        });

    const writer = process.stdin.getWriter();
    terminal.onData((data) => {
        const buffer = encodeUtf8(data);
        writer.write(buffer).catch((error) => {
            console.error('写入流错误:', error);
        });
    });
}

function clearTerminal() {
    if (terminal) {
        terminal.clear();
    }
}
</script>

<template>
    <div class="device-shell-card">
        <v-card-title class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">设备终端器</div>
            <div>
                <v-btn color="primary" variant="text" @click="startTerminal" class="mr-2">
                    <v-icon>mdi-restart</v-icon>
                    重新启动
                </v-btn>
                <v-btn color="secondary" variant="text" @click="clearTerminal">
                    <v-icon>mdi-delete</v-icon>
                    清除
                </v-btn>
            </div>
        </v-card-title>
        <v-card-text>
            <div ref="term" class="terminal-container" />
        </v-card-text>
    </div>
</template>

<style scoped>
.device-shell-card {
    margin: 0 auto;
    transition: all 0.3s ease;
}

.terminal-container {
    border: 1px solid #34495e;
    border-radius: 8px;
    padding: 8px;
    background-color: #2c3e50;
    color: #ecf0f1;
    width: 100%;
    height: auto;
    overflow: hidden;
    box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);
}
</style>
