package cloud.operixerp.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import android.view.InputDevice
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

class MainActivity : ComponentActivity() {

    companion object {
        const val DEFAULT_NOTIFICATION_CHANNEL_ID = "operix_notifications"
        private const val MAX_SCAN_INTERVAL_MS = 85L

        private val _barcodeScannedFlow = MutableSharedFlow<String>(extraBufferCapacity = 1)
        val barcodeScannedFlow = _barcodeScannedFlow.asSharedFlow()
    }

    private val scannerBuffer = java.lang.StringBuilder()
    private var lastKeyTimestamp = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createDefaultNotificationChannel()

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    Text(text = "Operix ERP Android")
                }
            }
        }
    }

    @android.annotation.SuppressLint("RestrictedApi")
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val device = event.device
        val isExternalScanner = device != null && !device.isVirtual &&
            (device.sources and InputDevice.SOURCE_KEYBOARD) == InputDevice.SOURCE_KEYBOARD

        if (isExternalScanner && event.action == KeyEvent.ACTION_DOWN) {
            val now = System.currentTimeMillis()
            if (now - lastKeyTimestamp > MAX_SCAN_INTERVAL_MS) {
                scannerBuffer.setLength(0)
            }
            lastKeyTimestamp = now

            val keyCode = event.keyCode
            if (keyCode == KeyEvent.KEYCODE_ENTER ||
                keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER ||
                keyCode == KeyEvent.KEYCODE_TAB
            ) {
                if (scannerBuffer.length >= 3) {
                    val barcode = scannerBuffer.toString().trim()
                    scannerBuffer.setLength(0)
                    _barcodeScannedFlow.tryEmit(barcode)
                }
            } else {
                val unicodeChar = event.unicodeChar
                if (unicodeChar > 0 && !Character.isISOControl(unicodeChar)) {
                    scannerBuffer.append(unicodeChar.toChar())
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun createDefaultNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java) ?: return
            val channel = NotificationChannel(
                DEFAULT_NOTIFICATION_CHANNEL_ID,
                "Operix ERP Alertas y Pedidos",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notificaciones de nuevos pedidos online, comandas, stock e impresiones de Operix ERP"
                enableVibration(true)
            }
            manager.createNotificationChannel(channel)
        }
    }
}
