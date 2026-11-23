package cloud.operixerp.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.PrintManager
import android.util.Base64
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.FileOutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.util.UUID

data class BluetoothPrinter(val name: String, val address: String, val type: Int)

object OperixPrinterService {

    private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    fun hasBluetoothConnectPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.BLUETOOTH_CONNECT
            ) == PackageManager.PERMISSION_GRANTED
        }
        return true
    }

    @SuppressLint("MissingPermission")
    fun listBondedBluetoothPrinters(context: Context): List<BluetoothPrinter> {
        if (!hasBluetoothConnectPermission(context)) {
            throw SecurityException("Permiso BLUETOOTH_CONNECT no concedido")
        }

        val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val adapter = btManager?.adapter
            ?: throw Exception("Este dispositivo no cuenta con adaptador Bluetooth.")

        val bonded = adapter.bondedDevices ?: emptySet()
        return bonded.map { device ->
            BluetoothPrinter(
                name = device.name ?: "Impresora Bluetooth",
                address = device.address,
                type = device.type
            )
        }
    }

    @SuppressLint("MissingPermission")
    suspend fun printBluetoothClassic(context: Context, address: String, dataBase64: String): Boolean = withContext(Dispatchers.IO) {
        if (address.isEmpty() || dataBase64.isEmpty()) {
            throw IllegalArgumentException("address (MAC) y dataBase64 son requeridos.")
        }
        if (!hasBluetoothConnectPermission(context)) {
            throw SecurityException("Permiso BLUETOOTH_CONNECT no concedido")
        }

        val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val adapter = btManager?.adapter
            ?: throw Exception("Bluetooth no disponible.")

        if (!adapter.isEnabled) {
            throw Exception("Bluetooth está desactivado.")
        }

        if (adapter.isDiscovering) {
            adapter.cancelDiscovery()
        }

        val device = adapter.getRemoteDevice(address)
        val bytes = Base64.decode(dataBase64, Base64.DEFAULT)
        var socket: BluetoothSocket? = null

        try {
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            socket.connect()
        } catch (e: Exception) {
            try {
                socket?.close()
            } catch (ignored: Exception) {}
            
            socket = device.javaClass.getMethod("createRfcommSocket", Int::class.java).invoke(device, 1) as BluetoothSocket
            socket.connect()
        }

        try {
            val out = socket.outputStream
            out.write(bytes)
            out.flush()
            Thread.sleep(250)
            true
        } catch (e: Exception) {
            throw Exception("Error al imprimir por Bluetooth Clásico SPP: ${e.message}", e)
        } finally {
            try {
                socket?.close()
            } catch (ignored: Exception) {}
        }
    }

    suspend fun printTcp(host: String, port: Int = 9100, dataBase64: String): Boolean = withContext(Dispatchers.IO) {
        if (host.isEmpty() || dataBase64.isEmpty()) {
            throw IllegalArgumentException("Host y dataBase64 son requeridos.")
        }

        var socket: Socket? = null
        try {
            val bytes = Base64.decode(dataBase64, Base64.DEFAULT)
            socket = Socket()
            socket.connect(InetSocketAddress(host, port), 5000)
            socket.soTimeout = 5000
            val out = socket.getOutputStream()
            out.write(bytes)
            out.flush()
            true
        } catch (e: Exception) {
            throw Exception("Error al imprimir por red TCP/IP: ${e.message}", e)
        } finally {
            try {
                socket?.close()
            } catch (ignored: Exception) {}
        }
    }

    fun printPdfBase64(activity: Activity, dataBase64: String, jobName: String = "Operix_ERP_PDF") {
        if (dataBase64.isEmpty()) {
            throw IllegalArgumentException("dataBase64 es requerido")
        }

        val pdfBytes = Base64.decode(dataBase64, Base64.DEFAULT)
        val printManager = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager

        val adapter = object : PrintDocumentAdapter() {
            override fun onLayout(
                oldAttributes: PrintAttributes?,
                newAttributes: PrintAttributes?,
                cancellationSignal: CancellationSignal?,
                callback: LayoutResultCallback?,
                extras: Bundle?
            ) {
                if (cancellationSignal?.isCanceled == true) {
                    callback?.onLayoutCancelled()
                    return
                }
                val info = PrintDocumentInfo.Builder("$jobName.pdf")
                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                    .build()
                callback?.onLayoutFinished(info, true)
            }

            override fun onWrite(
                pages: Array<out PageRange>?,
                destination: ParcelFileDescriptor?,
                cancellationSignal: CancellationSignal?,
                callback: WriteResultCallback?
            ) {
                try {
                    destination?.fileDescriptor?.let { fd ->
                        FileOutputStream(fd).use { out ->
                            out.write(pdfBytes)
                            out.flush()
                        }
                    }
                    callback?.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
                } catch (e: Exception) {
                    callback?.onWriteFailed(e.message)
                }
            }
        }
        printManager.print(jobName, adapter, null)
    }
}
