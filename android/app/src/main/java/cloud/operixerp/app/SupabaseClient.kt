package cloud.operixerp.app

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.gotrue.Auth
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.storage.Storage

object SupabaseManager {
    // Estas credenciales se recuperan del entorno de producción actual (.env.local)
    private const val SUPABASE_URL = "https://rgyqtxoagsmkleebrmza.supabase.co"
    private const val SUPABASE_ANON_KEY = "sb_publishable_k0bBLskc6mpWH4rrkKYeeA_mIB9cPkk"

    val client: SupabaseClient by lazy {
        createSupabaseClient(
            supabaseUrl = SUPABASE_URL,
            supabaseKey = SUPABASE_ANON_KEY
        ) {
            install(Postgrest)
            install(Auth)
            install(Storage)
        }
    }
}
