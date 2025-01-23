import { WrapReadableStream, WritableStream, ReadableStream } from '@yume-chan/stream-extra';

interface PickFileOptions {
    accept?: string;
}

export function pickFile(options: { multiple: true } & PickFileOptions): Promise<FileList> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = options.multiple;
        if (options.accept) {
            input.accept = options.accept;
        }
        input.onchange = () => {
            if (input.files) {
                resolve(input.files);
            }
        };
        input.click();
    });
}

/**
 * 使用浏览器原生功能下载文件
 * @param buffer 文件内容
 * @param fileName 文件名
 * @param mimeType MIME类型
 */
export function downloadFile(buffer: ArrayBuffer, fileName: string, mimeType: string): void {
    try {
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading file:', error);
        throw error;
    }
}

export function createFileStream(file: File): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            const reader = new FileReader();
            let offset = 0;

            reader.onload = () => {
                if (reader.result instanceof ArrayBuffer) {
                    controller.enqueue(new Uint8Array(reader.result));
                    offset += reader.result.byteLength;
                }

                if (offset >= file.size) {
                    controller.close();
                } else {
                    readNextChunk();
                }
            };

            reader.onerror = () => {
                controller.error(reader.error);
            };

            function readNextChunk() {
                const chunk = file.slice(offset, offset + 64 * 1024);
                reader.readAsArrayBuffer(chunk);
            }

            readNextChunk();
        },
    });
}

export class WrapConsumableStream {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;

    constructor() {
        let controller: ReadableStreamDefaultController<Uint8Array>;
        this.readable = new ReadableStream({
            start(c) {
                controller = c;
            },
        });

        this.writable = new WritableStream({
            write(chunk) {
                controller.enqueue(chunk);
            },
            close() {
                controller.close();
            },
        });
    }
}

export class ProgressStream {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;

    constructor(onProgress: (uploaded: number) => void) {
        let uploaded = 0;
        let controller: ReadableStreamDefaultController<Uint8Array>;

        this.readable = new ReadableStream({
            start(c) {
                controller = c;
            },
        });

        this.writable = new WritableStream({
            write(chunk) {
                uploaded += chunk.byteLength;
                onProgress(uploaded);
                controller.enqueue(chunk);
            },
            close() {
                controller.close();
            },
        });
    }
}
