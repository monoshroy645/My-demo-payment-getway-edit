declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const FBP_COOKIE = '_fbp';
const FBC_COOKIE = '_fbc';

function getCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

function genEventId(): string {
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

export type PixelEvent =
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'PageView'
  | 'Lead'
  | 'CompleteRegistration'
  | 'ViewContent';

export interface UserData {
  phone?: string;
  external_id?: string;
}

export interface CustomData {
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
  [key: string]: any;
}

export function trackEvent(
  eventName: PixelEvent,
  userData: UserData = {},
  customData: CustomData = {}
) {
  const eventId = genEventId();
  const eventTime = Math.floor(Date.now() / 1000);

  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq('track', eventName, customData, { eventID: eventId });
    }
  } catch (e) {}

  const payload = {
    event_name: eventName,
    event_id: eventId,
    event_time: eventTime,
    event_source_url: typeof window !== 'undefined' ? window.location.href : '',
    user_data: {
      ph: userData.phone || '',
      external_id: userData.external_id || '',
      fbp: getCookie(FBP_COOKIE),
      fbc: getCookie(FBC_COOKIE),
      client_user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent : '',
    },
    custom_data: customData,
  };

  try {
    fetch('/api/capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}
}
