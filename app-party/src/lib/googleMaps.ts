import { PROVIDER_GOOGLE } from 'react-native-maps';

import { getRequiredEnv } from './env';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type GoogleMapsStatusResponse = {
  status: string;
  error_message?: string;
};

export type GoogleGeocodeResponse = GoogleMapsStatusResponse & {
  results: {
    formatted_address: string;
    place_id: string;
    types: string[];
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }[];
};

export type GooglePlaceSearchResponse = GoogleMapsStatusResponse & {
  results: {
    name: string;
    place_id: string;
    formatted_address?: string;
    vicinity?: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    rating?: number;
    user_ratings_total?: number;
    types?: string[];
  }[];
};

export type GoogleDirectionsResponse = GoogleMapsStatusResponse & {
  routes: {
    summary: string;
    overview_polyline: {
      points: string;
    };
    legs: {
      distance: {
        text: string;
        value: number;
      };
      duration: {
        text: string;
        value: number;
      };
    }[];
  }[];
};

export const reactNativeMapsProvider = PROVIDER_GOOGLE;

export const googleMapsConfig = {
  apiKey: getRequiredEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'),
  geocodingApiUrl: getRequiredEnv('EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_URL'),
  placesApiUrl: getRequiredEnv('EXPO_PUBLIC_GOOGLE_MAPS_PLACES_API_URL'),
  directionsApiUrl: getRequiredEnv('EXPO_PUBLIC_GOOGLE_MAPS_DIRECTIONS_API_URL'),
};

function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function coordinateParam(coordinates: Coordinates): string {
  return `${coordinates.latitude},${coordinates.longitude}`;
}

async function requestGoogleMaps<TResponse extends GoogleMapsStatusResponse>(
  endpoint: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<TResponse> {
  const response = await fetch(
    `${endpoint}?${toQueryString({
      ...params,
      key: googleMapsConfig.apiKey,
    })}`,
  );
  const payload = (await response.json()) as TResponse;
  const validStatuses = ['OK', 'ZERO_RESULTS'];

  if (!response.ok || !validStatuses.includes(payload.status)) {
    throw new Error(payload.error_message ?? `Google Maps request failed: ${payload.status}`);
  }

  return payload;
}

export function geocodeAddress(address: string, language = 'pt-BR'): Promise<GoogleGeocodeResponse> {
  return requestGoogleMaps<GoogleGeocodeResponse>(googleMapsConfig.geocodingApiUrl, {
    address,
    language,
  });
}

export function reverseGeocode(
  coordinates: Coordinates,
  language = 'pt-BR',
): Promise<GoogleGeocodeResponse> {
  return requestGoogleMaps<GoogleGeocodeResponse>(googleMapsConfig.geocodingApiUrl, {
    latlng: coordinateParam(coordinates),
    language,
  });
}

export function searchPlaces(
  query: string,
  options: {
    location?: Coordinates;
    radius?: number;
    language?: string;
  } = {},
): Promise<GooglePlaceSearchResponse> {
  const placesEndpoint = `${googleMapsConfig.placesApiUrl}/textsearch/json`;

  return requestGoogleMaps<GooglePlaceSearchResponse>(placesEndpoint, {
    query,
    location: options.location ? coordinateParam(options.location) : undefined,
    radius: options.radius,
    language: options.language ?? 'pt-BR',
  });
}

export function getDirections(
  origin: string | Coordinates,
  destination: string | Coordinates,
  mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving',
  language = 'pt-BR',
): Promise<GoogleDirectionsResponse> {
  return requestGoogleMaps<GoogleDirectionsResponse>(googleMapsConfig.directionsApiUrl, {
    origin: typeof origin === 'string' ? origin : coordinateParam(origin),
    destination: typeof destination === 'string' ? destination : coordinateParam(destination),
    mode,
    language,
  });
}
