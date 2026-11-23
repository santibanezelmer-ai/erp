import { Capacitor, registerPlugin } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Network, ConnectionStatus } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';

// ============================================================================
// PLUGINS NATIVOS PERSONALIZADOS (Registrados en MainActivity.java)
// ============================================================================

export interface BondedBluetoothDevice {
  name: string;
  address: string;
  type: number;
}

export interface OperixPrinterPlugin {
  /** Lista impresoras Bluetooth Clásico (SPP / RFCOMM) vinculadas en Android */
  listBondedBluetoothPrinters(): Promise<{ devices: BondedBluetoothDevice[] }>;
  /** Envía bytes ESC/POS en Base64 por Bluetooth Clásico SPP (RFCOMM UUID 00001101-...) */
  printBluetoothClassic(options: {
    address: string;
    dataBase64: string;
  }): Promise<{ success: boolean; address: string }>;
  /** Envía bytes ESC/POS en Base64 por socket TCP directo (Wi-Fi / LAN puerto 9100) */
  printTcp(options: {
    host: string;
    port?: number;
    dataBase64: string;
  }): Promise<{ success: boolean }>;
  /** Imprime la vista actual del WebView mediante el PrintManager nativo de Android */
  printCurrentPage(options?: { jobName?: string }): Promise<{ success: boolean }>;
  /** Imprime un documento PDF en Base64 mediante el PrintManager nativo de Android */
  printPdfBase64(options: {
    dataBase64: string;
    jobName?: string;
  }): Promise<{ success: boolean }>;
}

export interface OperixSecureStoragePlugin {
  /** Guarda un valor cifrado con AES-256-GCM en EncryptedSharedPreferences (Android Keystore) */
  setItem(options: { key: string; value: string }): Promise<{ success: boolean }>;
  /** Recupera un valor cifrado desde EncryptedSharedPreferences */
  getItem(options: { key: string }): Promise<{ value: string | null }>;
  /** Elimina una clave del almacenamiento cifrado */
  removeItem(options: { key: string }): Promise<{ success: boolean }>;
  /** Limpia todas las credenciales cifradas */
  clearAll(): Promise<{ success: boolean }>;
}

export const OperixPrinter = registerPlugin<OperixPrinterPlugin>('OperixPrinter');
export const OperixSecureStorage =
  registerPlugin<OperixSecureStoragePlugin>('OperixSecureStorage');

export const isAndroidNative = (): boolean =>
  typeof window !== 'undefined' &&
  Capacitor.isNativePlatform() &&
  Capacitor.getPlatform() === 'android';

// ============================================================================
// 1. CÁMARA (Fotografías de productos, documentos y boletas)
// ============================================================================
export interface CapturedPhotoResult {
  dataUrl: string;
  format: string;
  blob: Blob;
  file: File;
}

/**
 * Captura una fotografía con la cámara nativa o galería de Android y devuelve
 * tanto el `dataUrl` como un `File` y `Blob` listos para subir a Supabase Storage.
 */
export async function captureProductOrDocPhoto(options?: {
  source?: 'PROMPT' | 'CAMERA' | 'PHOTOS';
  quality?: number;
  fileNamePrefix?: string;
}): Promise<CapturedPhotoResult | null> {
  try {
    if (isAndroidNative()) {
      const perms = await Camera.checkPermissions();
      if (perms.camera !== 'granted' || perms.photos !== 'granted') {
        await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      }
    }

    const sourceMap = {
      PROMPT: CameraSource.Prompt,
      CAMERA: CameraSource.Camera,
      PHOTOS: CameraSource.Photos,
    };

    const image = await Camera.getPhoto({
      quality: options?.quality ?? 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: sourceMap[options?.source ?? 'PROMPT'],
      width: 1600,
      correctOrientation: true,
    });

    if (!image.dataUrl) return null;

    const format = image.format || 'jpeg';
    const mimeType = `image/${format}`;
    const base64Part = image.dataUrl.split(',')[1] || '';
    const byteChars = atob(base64Part);
    const byteNumbers = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteNumbers], { type: mimeType });
    const prefix = options?.fileNamePrefix ?? 'operix_capture';
    const file = new File([blob], `${prefix}_${Date.now()}.${format}`, { type: mimeType });

    return {
      dataUrl: image.dataUrl,
      format,
      blob,
      file,
    };
  } catch (err) {
    console.warn('[OperixNative] Captura de cámara cancelada o fallida:', err);
    return null;
  }
}

// ============================================================================
// 2. LECTORES DE CÓDIGOS DE BARRAS EXTERNOS (Bluetooth SPP/HID y USB HID)
// ============================================================================
export interface HardwareScannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  maxInterKeyDelayMs?: number;
}

/**
 * Escucha lectores de códigos de barras físicos conectados por USB OTG o Bluetooth HID.
 * Evita duplicados entre el despachador nativo `MainActivity.dispatchKeyEvent` (`operix:hardware-barcode`)
 * y el evento `keydown` del DOM usando una ventana de deduplicación de 250ms.
 */
export function attachHardwareBarcodeScanner({
  onScan,
  minLength = 3,
  maxInterKeyDelayMs = 65,
}: HardwareScannerOptions): () => void {
  if (typeof window === 'undefined') return () => {};

  let buffer = '';
  let lastKeyTime = 0;
  let lastEmittedCode = '';
  let lastEmittedTimestamp = 0;

  const emitDeduped = (code: string) => {
    const clean = code.trim();
    if (clean.length < minLength) return;
    const now = Date.now();
    if (clean === lastEmittedCode && now - lastEmittedTimestamp < 250) {
      return;
    }
    lastEmittedCode = clean;
    lastEmittedTimestamp = now;
    onScan(clean);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const isInput =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable);

    const now = Date.now();
    if (now - lastKeyTime > maxInterKeyDelayMs) {
      buffer = '';
    }
    lastKeyTime = now;

    if (e.key === 'Enter' || e.key === 'Tab') {
      if (buffer.length >= minLength) {
        if (!isInput) e.preventDefault();
        const code = buffer;
        buffer = '';
        emitDeduped(code);
      } else {
        buffer = '';
      }
      return;
    }

    if (e.key.length === 1) {
      buffer += e.key;
    }
  };

  const handleNativeBarcode = (e: Event) => {
    const custom = e as CustomEvent<{ barcode: string }>;
    if (custom.detail?.barcode) {
      buffer = '';
      emitDeduped(custom.detail.barcode);
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('operix:hardware-barcode', handleNativeBarcode);

  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('operix:hardware-barcode', handleNativeBarcode);
  };
}

// ============================================================================
// 3. IMPRESORAS TÉRMICAS ESC/POS (Bluetooth Clásico SPP, BLE y Wi-Fi / LAN)
// ============================================================================
export class EscPosEncoder {
  private bytes: number[] = [];

  init(): this {
    // ESC @ (Inicializar) + ESC t 16 (Tabla de caracteres WPC1252 / Latin-1 para acentos y $)
    this.bytes.push(0x1b, 0x40, 0x1b, 0x74, 0x10);
    return this;
  }

  align(align: 'left' | 'center' | 'right'): this {
    const map = { left: 0, center: 1, right: 2 };
    this.bytes.push(0x1b, 0x61, map[align]);
    return this;
  }

  bold(enabled: boolean): this {
    this.bytes.push(0x1b, 0x45, enabled ? 1 : 0);
    return this;
  }

  size(widthMultiplier: 1 | 2 = 1, heightMultiplier: 1 | 2 = 1): this {
    const n = ((widthMultiplier - 1) << 4) | (heightMultiplier - 1);
    this.bytes.push(0x1d, 0x21, n);
    return this;
  }

  /**
   * Codifica texto en Windows-1252 / ISO-8859-1 (1 byte por carácter) compatible con impresoras ESC/POS,
   * preservando ñ, Ñ, tildes, ¡, ¿ y símbolo $.
   */
  text(content: string): this {
    for (let i = 0; i < content.length; i++) {
      const code = content.charCodeAt(i);
      if (code <= 0xff) {
        this.bytes.push(code);
      } else if (code === 0x20ac) {
        this.bytes.push(0x80); // €
      } else {
        this.bytes.push(0x3f); // '?' para caracteres fuera de rango
      }
    }
    return this;
  }

  line(content = ''): this {
    return this.text(content + '\n');
  }

  divider(char = '-', width = 32): this {
    return this.line(char.repeat(width));
  }

  feed(lines = 3): this {
    this.bytes.push(0x1b, 0x64, lines);
    return this;
  }

  cut(): this {
    this.bytes.push(0x1d, 0x56, 0x41, 0x10); // GS V A 16 (corte parcial)
    return this;
  }

  openCashDrawer(): this {
    this.bytes.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.bytes);
  }

  toBase64(): string {
    return uint8ArrayToBase64(this.toUint8Array());
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64');
}

/**
 * 3A. Impresión ESC/POS por Red Local Wi-Fi / Ethernet LAN (TCP Socket puerto 9100).
 */
export async function printEscPosOverLan(
  host: string,
  escPosBytes: Uint8Array,
  port = 9100
): Promise<boolean> {
  if (!isAndroidNative()) {
    throw new Error('La impresión TCP directa requiere la app Android nativa de Operix.');
  }
  const dataBase64 = uint8ArrayToBase64(escPosBytes);
  const res = await OperixPrinter.printTcp({ host, port, dataBase64 });
  return res.success;
}

/**
 * 3B. Lista las impresoras Bluetooth Clásico (SPP / RFCOMM) vinculadas en los ajustes de Android.
 */
export async function listBondedBluetoothClassicPrinters(): Promise<BondedBluetoothDevice[]> {
  if (!isAndroidNative()) {
    return [];
  }
  const res = await OperixPrinter.listBondedBluetoothPrinters();
  return res.devices ?? [];
}

/**
 * 3C. Impresión ESC/POS por Bluetooth Clásico SPP (RFCOMM UUID 00001101-0000-1000-8000-00805F9B34FB).
 * Compatible con el 95% de impresoras térmicas portátiles y de mesón (58mm y 80mm).
 */
export async function printEscPosOverBluetoothClassic(
  macAddress: string,
  escPosBytes: Uint8Array
): Promise<boolean> {
  if (!isAndroidNative()) {
    throw new Error('La impresión Bluetooth Clásico SPP requiere la app Android nativa.');
  }
  const dataBase64 = uint8ArrayToBase64(escPosBytes);
  const res = await OperixPrinter.printBluetoothClassic({
    address: macAddress,
    dataBase64,
  });
  return res.success;
}

/**
 * 3D. Impresión ESC/POS por Bluetooth Low Energy (BLE GATT).
 */
export async function printEscPosOverBluetoothBle(
  escPosBytes: Uint8Array,
  savedDeviceId?: string
): Promise<{ deviceId: string }> {
  await BleClient.initialize();

  let deviceId = savedDeviceId;
  if (!deviceId) {
    const device = await BleClient.requestDevice({
      optionalServices: [
        numberToUUID(0x18f0),
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      ],
    });
    deviceId = device.deviceId;
  }

  await BleClient.connect(deviceId);
  const services = await BleClient.getServices(deviceId);

  let targetService = '';
  let targetChar = '';
  let useWriteWithoutResponse = false;

  for (const svc of services) {
    for (const ch of svc.characteristics) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) {
        targetService = svc.uuid;
        targetChar = ch.uuid;
        useWriteWithoutResponse = !ch.properties.write && Boolean(ch.properties.writeWithoutResponse);
        break;
      }
    }
    if (targetChar) break;
  }

  if (!targetService || !targetChar) {
    await BleClient.disconnect(deviceId);
    throw new Error('No se encontró un canal GATT de escritura en la impresora BLE.');
  }

  const chunkSize = 180;
  for (let offset = 0; offset < escPosBytes.length; offset += chunkSize) {
    const slice = escPosBytes.slice(offset, offset + chunkSize);
    const view = new DataView(slice.buffer, slice.byteOffset, slice.byteLength);
    if (useWriteWithoutResponse) {
      await BleClient.writeWithoutResponse(deviceId, targetService, targetChar, view);
    } else {
      await BleClient.write(deviceId, targetService, targetChar, view);
    }
  }

  await BleClient.disconnect(deviceId);
  return { deviceId };
}

/**
 * Función unificada para imprimir por Bluetooth: si se pasa una dirección MAC (`XX:XX:XX:XX:XX:XX`)
 * utiliza primero Bluetooth Clásico SPP (RFCOMM) y, si se solicita BLE o falla, usa BLE GATT.
 */
export async function printEscPosOverBluetooth(
  escPosBytes: Uint8Array,
  addressOrDeviceId?: string,
  mode: 'CLASSIC_SPP' | 'BLE' = 'CLASSIC_SPP'
): Promise<{ deviceId: string }> {
  if (mode === 'CLASSIC_SPP' && isAndroidNative()) {
    let targetAddress = addressOrDeviceId;
    if (!targetAddress) {
      const bonded = await listBondedBluetoothClassicPrinters();
      if (bonded.length > 0) {
        targetAddress = bonded[0].address;
      }
    }
    if (targetAddress) {
      await printEscPosOverBluetoothClassic(targetAddress, escPosBytes);
      return { deviceId: targetAddress };
    }
  }
  return printEscPosOverBluetoothBle(escPosBytes, addressOrDeviceId);
}

// ============================================================================
// 4. COMPARTIR E IMPRIMIR DOCUMENTOS PDF (Boletas, Facturas, Reportes)
// ============================================================================
export async function sharePdfDocument(options: {
  fileName: string;
  base64Data: string;
  title?: string;
  text?: string;
}): Promise<void> {
  const cleanBase64 = options.base64Data.replace(/^data:application\/pdf;base64,/, '');
  const safeName = options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`;

  if (isAndroidNative()) {
    const saved = await Filesystem.writeFile({
      path: safeName,
      data: cleanBase64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: options.title ?? safeName,
      text: options.text ?? 'Documento generado desde Operix ERP',
      url: saved.uri,
      dialogTitle: 'Compartir documento PDF',
    });
    return;
  }

  const byteChars = atob(cleanBase64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: 'application/pdf' });
  const file = new File([blob], safeName, { type: 'application/pdf' });

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: options.title ?? safeName,
      text: options.text,
      files: [file],
    });
  } else if (typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export async function printPdfDocument(options: {
  base64Data?: string;
  jobName?: string;
}): Promise<void> {
  if (isAndroidNative()) {
    if (options.base64Data) {
      const cleanBase64 = options.base64Data.replace(/^data:application\/pdf;base64,/, '');
      await OperixPrinter.printPdfBase64({
        dataBase64: cleanBase64,
        jobName: options.jobName ?? 'Operix_Documento',
      });
    } else {
      await OperixPrinter.printCurrentPage({
        jobName: options.jobName ?? 'Operix_Documento',
      });
    }
    return;
  }
  if (typeof window !== 'undefined') {
    window.print();
  }
}

// ============================================================================
// 5. GESTIÓN SEGURA DE CREDENCIALES (Android Keystore AES-256-GCM)
// ============================================================================
const SESSION_KEY_PREFIX = 'operix_secure_';

/**
 * Guarda una credencial o token cifrado con AES-256-GCM mediante Android Keystore (`EncryptedSharedPreferences`).
 * En navegador web utiliza `Preferences` como fallback.
 */
export async function saveSecureCredential(key: string, value: string): Promise<void> {
  const fullKey = `${SESSION_KEY_PREFIX}${key}`;
  if (isAndroidNative()) {
    await OperixSecureStorage.setItem({ key: fullKey, value });
    return;
  }
  await Preferences.set({ key: fullKey, value });
}

export async function getSecureCredential(key: string): Promise<string | null> {
  const fullKey = `${SESSION_KEY_PREFIX}${key}`;
  if (isAndroidNative()) {
    const { value } = await OperixSecureStorage.getItem({ key: fullKey });
    return value ?? null;
  }
  const { value } = await Preferences.get({ key: fullKey });
  return value;
}

export async function removeSecureCredential(key: string): Promise<void> {
  const fullKey = `${SESSION_KEY_PREFIX}${key}`;
  if (isAndroidNative()) {
    await OperixSecureStorage.removeItem({ key: fullKey });
    return;
  }
  await Preferences.remove({ key: fullKey });
}

export async function clearAllSecureCredentials(): Promise<void> {
  if (isAndroidNative()) {
    await OperixSecureStorage.clearAll();
    return;
  }
  await Preferences.clear();
}

// ============================================================================
// 6. ALMACENAMIENTO LOCAL Y COLA OFFLINE TOLERANTE A INTERRUPCIONES DE RED
// ============================================================================
const OFFLINE_QUEUE_KEY = 'operix_offline_mutations_v1';
let isFlushingQueue = false;

export interface OfflineMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  payload: unknown;
  createdAt: number;
  retryCount: number;
}

export async function getNetworkStatus(): Promise<ConnectionStatus> {
  return Network.getStatus();
}

export async function enqueueOfflineOperation(
  mutation: Omit<OfflineMutation, 'id' | 'createdAt' | 'retryCount'>
): Promise<OfflineMutation[]> {
  const existing = await getOfflineQueue();
  const item: OfflineMutation = {
    ...mutation,
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    retryCount: 0,
  };
  const updated = [...existing, item];
  await Preferences.set({ key: OFFLINE_QUEUE_KEY, value: JSON.stringify(updated) });
  return updated;
}

export async function getOfflineQueue(): Promise<OfflineMutation[]> {
  const { value } = await Preferences.get({ key: OFFLINE_QUEUE_KEY });
  if (!value) return [];
  try {
    return JSON.parse(value) as OfflineMutation[];
  } catch {
    return [];
  }
}

export async function flushOfflineQueue(
  executor?: (item: OfflineMutation) => Promise<boolean>
): Promise<{ processed: number; remaining: number }> {
  if (isFlushingQueue) {
    const q = await getOfflineQueue();
    return { processed: 0, remaining: q.length };
  }

  const status = await Network.getStatus();
  if (!status.connected) {
    const q = await getOfflineQueue();
    return { processed: 0, remaining: q.length };
  }

  isFlushingQueue = true;
  try {
    const queue = await getOfflineQueue();
    if (queue.length === 0) return { processed: 0, remaining: 0 };

    const remaining: OfflineMutation[] = [];
    let processed = 0;

    for (const item of queue) {
      try {
        let ok = false;
        if (executor) {
          ok = await executor(item);
        } else {
          const res = await fetch(item.endpoint, {
            method: item.method,
            headers: {
              'Content-Type': 'application/json',
              ...(item.headers ?? {}),
            },
            credentials: 'include',
            body: JSON.stringify(item.payload),
          });
          // Si es 4xx definitivo (ej. 400/422), no encallar la cola infinitamente tras 5 intentos
          ok = res.ok || (res.status >= 400 && res.status < 500 && item.retryCount >= 5);
        }
        if (ok) {
          processed++;
        } else {
          remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1 });
        }
      } catch {
        remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1 });
      }
    }

    await Preferences.set({ key: OFFLINE_QUEUE_KEY, value: JSON.stringify(remaining) });
    return { processed, remaining: remaining.length };
  } finally {
    isFlushingQueue = false;
  }
}

export function startOfflineSyncMonitor(
  onConnectivityChange?: (status: ConnectionStatus) => void
): () => void {
  // Intentar vaciar cola pendiente al iniciar el monitor si ya hay conexión
  flushOfflineQueue().catch(() => {});

  const listenerPromise = Network.addListener('networkStatusChange', async (status) => {
    onConnectivityChange?.(status);
    if (status.connected) {
      await flushOfflineQueue();
    }
  });

  return () => {
    listenerPromise.then((h) => h.remove());
  };
}

// ============================================================================
// 7. FIREBASE CLOUD MESSAGING (Notificaciones Push en primer y segundo plano)
// ============================================================================
export interface PushHandlers {
  onToken?: (token: string) => void;
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationAction?: (action: ActionPerformed) => void;
}

export async function initializeFirebasePush(handlers?: PushHandlers): Promise<string | null> {
  if (!isAndroidNative()) return null;

  // Garantiza que el canal de alta prioridad exista en Android 8.0+ para notificaciones en segundo plano
  try {
    await PushNotifications.createChannel({
      id: 'operix_notifications',
      name: 'Operix ERP Alertas y Pedidos',
      description: 'Notificaciones de pedidos online, comandas, inventario y alertas de Operix ERP',
      importance: 5,
      visibility: 1,
      vibration: true,
    });
  } catch (err) {
    console.warn('[OperixNative] Error al crear canal de notificaciones:', err);
  }

  let permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }
  if (permStatus.receive !== 'granted') {
    console.warn('[OperixNative] Permiso de notificaciones Push denegado.');
    return null;
  }

  await PushNotifications.removeAllListeners();

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn(
        '[OperixNative] Tiempo de espera agotado para registro FCM (verifica google-services.json).'
      );
      resolve(null);
    }, 10000);

    PushNotifications.addListener('registration', async (token: Token) => {
      clearTimeout(timeoutId);
      await saveSecureCredential('fcm_token', token.value);
      handlers?.onToken?.(token.value);
      resolve(token.value);
    });

    PushNotifications.addListener('registrationError', (error) => {
      clearTimeout(timeoutId);
      console.error('[OperixNative] Error al registrar FCM:', error);
      resolve(null);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      handlers?.onNotificationReceived?.(notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      handlers?.onNotificationAction?.(action);
    });

    PushNotifications.register();
  });
}
