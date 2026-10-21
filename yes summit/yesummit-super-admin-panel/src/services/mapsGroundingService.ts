export interface MapPlaceLink {
  title: string;
  uri: string;
}

export interface MapsGroundingResponse {
  text: string;
  groundingChunks: any[];
  mapPlaces: MapPlaceLink[];
  webSearchQueries?: string[];
  error?: string;
  quotaExceededNotice?: string;
  isFallback?: boolean;
}

export async function queryGoogleMapsGrounding(
  prompt: string,
  coords?: { latitude: number; longitude: number }
): Promise<MapsGroundingResponse> {
  const payload: any = { prompt };

  if (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
    payload.latitude = coords.latitude;
    payload.longitude = coords.longitude;
  } else {
    try {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator && navigator.geolocation) {
        const position = await new Promise<GeolocationPosition | null>((resolve) => {
          try {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve(pos),
              () => resolve(null),
              { timeout: 2000 }
            );
          } catch {
            resolve(null);
          }
        });
        if (position && position.coords) {
          payload.latitude = position.coords.latitude;
          payload.longitude = position.coords.longitude;
        } else {
          payload.latitude = 1.2838;
          payload.longitude = 103.8591;
        }
      } else {
        payload.latitude = 1.2838;
        payload.longitude = 103.8591;
      }
    } catch {
      payload.latitude = 1.2838;
      payload.longitude = 103.8591;
    }
  }

  const response = await fetch('/api/maps-grounding', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server responded with ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
