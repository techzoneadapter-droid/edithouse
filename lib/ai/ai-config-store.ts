import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Config } from './types';
function secretDirectory() { return path.join(process.cwd(), '.edithouse'); }
async function encryptionKey() {
  const directory = secretDirectory();
  await fs.mkdir(directory, {recursive: true, mode: 0o700});
  const file = path.join(directory, 'secret.key');
  try { return await fs.readFile(file); } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    try { await fs.writeFile(file, randomBytes(32), {flag: 'wx', mode: 0o600}); } catch (err) { if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err; }
    return fs.readFile(file);
  }
}
export async function readConfig(): Promise<Config> {
  try {
    const bytes = await fs.readFile(path.join(secretDirectory(), 'settings.enc'));
    const decipher = createDecipheriv('aes-256-gcm', await encryptionKey(), bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(12,28));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Không đọc được cấu hình AI mã hóa.'); }
  return {mode: 'balanced', overrides: {}};
}
export async function writeConfig(config: Config) {
  const directory = secretDirectory();
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', await encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(config)), cipher.final()]);
  const temp = path.join(directory, `settings-${randomBytes(8).toString('hex')}.tmp`);
  await fs.writeFile(temp, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), {mode: 0o600});
  await fs.rename(temp, path.join(directory, 'settings.enc'));
}
export function resolveKey(config: Config) { return config.apiKey || process.env.EXPLABS_API_KEY || ''; }
export function keyPreview(key: string) { return key ? 'xpl_••••••••' + key.slice(-4) : ''; }
