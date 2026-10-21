const { Client } = require('pg');

async function run() {
  const hosts = [
    'db.rgyqtxoagsmkleebrmza.supabase.co',
    'aws-0-sa-east-1.pooler.supabase.com',
    'aws-0-us-east-1.pooler.supabase.com'
  ];

  let connected = false;

  for (const host of hosts) {
    console.log(`Intentando conectar a ${host}...`);
    const isPooler = host.includes('pooler');
    const client = new Client({
      host,
      port: isPooler ? 6543 : 5432,
      user: isPooler ? 'postgres.rgyqtxoagsmkleebrmza' : 'postgres',
      password: 'CrsgOVZf1qj7SZx3',
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`¡Conectado exitosamente a ${host}!`);
      connected = true;

      const sql = `
        ALTER TABLE public.configuracion 
          ADD COLUMN IF NOT EXISTS plantilla_id TEXT NOT NULL DEFAULT 'beauty',
          ADD COLUMN IF NOT EXISTS plantilla_config JSONB NOT NULL DEFAULT '{}'::jsonb,
          ADD COLUMN IF NOT EXISTS plantilla_draft JSONB DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS plantilla_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

        CREATE INDEX IF NOT EXISTS idx_configuracion_plantilla_id 
          ON public.configuracion(plantilla_id);

        NOTIFY pgrst, 'reload schema';
      `;
      await client.query(sql);
      console.log('¡Columnas agregadas con éxito y caché de PostgREST recargada!');
      await client.end();
      return true;
    } catch (err) {
      console.log(`Fallo con ${host}:`, err.message);
      try { await client.end(); } catch (e) {}
    }
  }

  if (!connected) {
    console.error('No se pudo conectar directamente por PG.');
    return false;
  }
}

run();
