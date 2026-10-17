import { cp, mkdir, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'public/vad')
await mkdir(output, { recursive: true })
for (const [folder, pattern] of [
  ['@ricky0123/vad-web/dist', /\.(onnx|js)$/],
  ['onnxruntime-web/dist', /\.(wasm|mjs)$/],
]) {
  const source = path.join(root, 'node_modules', folder)
  for (const name of await readdir(source)) {
    if (pattern.test(name)) await cp(path.join(source, name), path.join(output, name))
  }
}
console.log('Local VAD and ONNX runtime assets ready.')
