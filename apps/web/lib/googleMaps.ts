export function googleMapsSearchUrl(address?: string | null) {
  if (!address) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function googleMapsDirectionsUrl(destination?: string | null, origin = '') {
  if (!destination) return '';
  const params = new URLSearchParams({ api: '1', destination });
  if (origin) params.set('origin', origin);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
