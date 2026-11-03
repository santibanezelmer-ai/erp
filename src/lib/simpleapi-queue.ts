/**
 * ══════════════════════════════════════════════════════════════════════════════
 * COLA DE EMISIÓN Y CONTROL DE CONSUMO (RATE LIMITER) PARA SIMPLEAPI
 * Operix ERP · Gestión de Concurrencia y Resiliencia
 * 
 * Respeta los límites oficiales de SimpleAPI:
 * - API DTE: Máximo 3 consultas / segundo y 40 consultas / minuto.
 * - API Folios & Scraper: Máximo 1 consulta / segundo y 5 consultas / minuto.
 * ══════════════════════════════════════════════════════════════════════════════
 */

interface QueueTask<T> {
  id: string;
  tipo: "dte" | "folio";
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
  intentos: number;
}

class SimpleApiQueueManager {
  private queue: QueueTask<any>[] = [];
  private processing = false;

  // Timestamps para control de rate-limit
  private lastDteCall = 0;
  private lastFolioCall = 0;
  private dteCallsInLastMinute: number[] = [];
  private folioCallsInLastMinute: number[] = [];

  // Límites configurados con margen de seguridad
  private readonly MIN_DTE_INTERVAL_MS = 380; // ~2.6 req/sec (límite: 3/s)
  private readonly MAX_DTE_PER_MINUTE = 36; // límite: 40/min
  private readonly MIN_FOLIO_INTERVAL_MS = 1200; // ~0.8 req/sec (límite: 1/s)
  private readonly MAX_FOLIO_PER_MINUTE = 4; // límite: 5/min

  /**
   * Encola una llamada a SimpleAPI garantizando que no se sobrepasen los rate-limits
   */
  public enqueue<T>(tipo: "dte" | "folio", fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tipo,
        execute: fn,
        resolve,
        reject,
        intentos: 0,
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue[0];
      const now = Date.now();

      // Limpiar llamadas de más de 60 segundos
      this.dteCallsInLastMinute = this.dteCallsInLastMinute.filter((t) => now - t < 60000);
      this.folioCallsInLastMinute = this.folioCallsInLastMinute.filter((t) => now - t < 60000);

      // Calcular espera requerida según tipo de llamada
      let waitMs = 0;

      if (task.tipo === "dte") {
        // 1. Intervalo mínimo entre llamadas (3/seg)
        const timeSinceLast = now - this.lastDteCall;
        if (timeSinceLast < this.MIN_DTE_INTERVAL_MS) {
          waitMs = Math.max(waitMs, this.MIN_DTE_INTERVAL_MS - timeSinceLast);
        }

        // 2. Límite por minuto (40/min)
        if (this.dteCallsInLastMinute.length >= this.MAX_DTE_PER_MINUTE) {
          const oldest = this.dteCallsInLastMinute[0];
          const timeToWaitMinute = 60000 - (now - oldest) + 500;
          waitMs = Math.max(waitMs, timeToWaitMinute);
        }
      } else {
        // Folios
        const timeSinceLast = now - this.lastFolioCall;
        if (timeSinceLast < this.MIN_FOLIO_INTERVAL_MS) {
          waitMs = Math.max(waitMs, this.MIN_FOLIO_INTERVAL_MS - timeSinceLast);
        }

        if (this.folioCallsInLastMinute.length >= this.MAX_FOLIO_PER_MINUTE) {
          const oldest = this.folioCallsInLastMinute[0];
          const timeToWaitMinute = 60000 - (now - oldest) + 1000;
          waitMs = Math.max(waitMs, timeToWaitMinute);
        }
      }

      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      }

      // Remover tarea de la cola para ejecución
      this.queue.shift();

      const execTime = Date.now();
      if (task.tipo === "dte") {
        this.lastDteCall = execTime;
        this.dteCallsInLastMinute.push(execTime);
      } else {
        this.lastFolioCall = execTime;
        this.folioCallsInLastMinute.push(execTime);
      }

      try {
        const result = await task.execute();
        task.resolve(result);
      } catch (err: any) {
        // Si SimpleAPI responde con 429 (Too Many Requests), reintentar hasta 3 veces con backoff
        const isRateLimit =
          err?.status === 429 ||
          err?.message?.includes("429") ||
          err?.message?.includes("Too Many Requests");

        if (isRateLimit && task.intentos < 3) {
          task.intentos++;
          const backoff = 2000 * Math.pow(2, task.intentos);
          await new Promise((r) => setTimeout(r, backoff));
          this.queue.unshift(task); // Reinsertar al inicio
        } else {
          task.reject(err);
        }
      }
    }

    this.processing = false;
  }
}

// Instancia singleton de la cola de emisión
export const simpleApiQueue = new SimpleApiQueueManager();
