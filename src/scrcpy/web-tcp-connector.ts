import type { AdbServerClient } from "@yume-chan/adb";
import { ReadableStream, WritableStream } from "@yume-chan/stream-extra";

export class WebTcpConnector implements AdbServerClient.ServerConnector {
    constructor(private options: { host: string; port: number }) {}

    async connect(
        options?: AdbServerClient.ServerConnectionOptions
    ): Promise<AdbServerClient.ServerConnection> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://${this.options.host}:${this.options.port}`);
            
            // 等待连接建立
            ws.onopen = () => {
                const readable = new ReadableStream({
                    start(controller) {
                        ws.onmessage = (event) => {
                            controller.enqueue(new Uint8Array(event.data));
                        };
                        ws.onclose = () => {
                            try {
                                controller.close();
                            } catch (e) {
                                // 忽略已经关闭的错误
                            }
                        };
                        ws.onerror = (e) => {
                            try {
                                controller.error(e);
                            } catch (e) {
                                // 忽略已经出错的错误
                            }
                        };
                    },
                    cancel() {
                        ws.close();
                    }
                });

                const writable = new WritableStream({
                    write(chunk) {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(chunk);
                        }
                    },
                    close() {
                        ws.close();
                    }
                });

                resolve({
                    readable,
                    writable,
                    close() {
                        return new Promise<void>((resolve) => {
                            ws.onclose = () => resolve();
                            ws.close();
                        });
                    },
                    get closed() {
                        return new Promise<void>((resolve) => {
                            if (ws.readyState === WebSocket.CLOSED) {
                                resolve();
                            } else {
                                ws.onclose = () => resolve();
                            }
                        });
                    }
                });
            };

            ws.onerror = () => {
                reject(new Error("WebSocket connection failed"));
            };
        });
    }

    async addReverseTunnel() { return ""; }
    async removeReverseTunnel() {}
    async clearReverseTunnels() {}
} 