package cloud.operixerp.app

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object OperixSecureStorage {
    private const val PREFS_FILE = "operix_encrypted_credentials"
    private var securePrefs: SharedPreferences? = null

    @Synchronized
    private fun getEncryptedPrefs(context: Context): SharedPreferences {
        if (securePrefs != null) {
            return securePrefs!!
        }
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        securePrefs = EncryptedSharedPreferences.create(
            context,
            PREFS_FILE,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
        return securePrefs!!
    }

    fun setItem(context: Context, key: String, value: String) {
        getEncryptedPrefs(context).edit().putString(key, value).apply()
    }

    fun getItem(context: Context, key: String): String? {
        return getEncryptedPrefs(context).getString(key, null)
    }

    fun removeItem(context: Context, key: String) {
        getEncryptedPrefs(context).edit().remove(key).apply()
    }

    fun clearAll(context: Context) {
        getEncryptedPrefs(context).edit().clear().apply()
    }
}
