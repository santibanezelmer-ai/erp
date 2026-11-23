import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAP_ENV === 'dev';

const config: CapacitorConfig = {
  appId: 'cloud.operixerp.app',
  appName: 'Operix ERP',
  webDir: 'public',
  server: {
    url: isDev ? 'http://10.0.2.2:3000' : 'https://operixerp.cloud',
    cleartext: true,
    allowNavigation: [
      'operixerp.cloud',
      '*.operixerp.cloud',
      '*.supabase.co',
      '*.mercadopago.com',
      '*.mercadopago.cl',
    ],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#0f172a',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
