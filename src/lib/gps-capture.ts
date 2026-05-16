export interface GpsLocation {
  lat: number;
  lng: number;
  accuracyMeters: number;
  capturedAt: Date;
  accuracyWarning?: string;
}

export async function captureGPS(opts: { required: boolean }): Promise<GpsLocation | null> {
  if (!navigator.geolocation) {
    if (opts.required) throw new Error('GPS not supported by this device');
    return null;
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const result: GpsLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          capturedAt: new Date(),
        };

        resolve(result);
      },
      (err) => {
        if (opts.required) {
          const messages: Record<number, string> = {
            1: 'Location permission denied. Enable in browser settings to log a visit.',
            2: 'Location unavailable. Move to an open area and retry.',
            3: 'Location request timed out. Retry.',
          };
          reject(new Error(messages[err.code] || 'Failed to get location'));
        } else {
          resolve(null);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}
