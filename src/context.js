import crypto from "node:crypto";

export function updateContext(db, body) {
  const nextContext = { ...db.context, ...body };
  const matchedPlace = inferPlace(db, nextContext);
  if (matchedPlace && (!body.locationTag || body.locationTag === "unknown")) {
    nextContext.placeId = matchedPlace.id;
    nextContext.locationTag = matchedPlace.label;
  }
  db.context = { ...nextContext, lastUpdated: new Date().toISOString() };
  return db.context;
}

export function savePlace(db, body) {
  const label = String(body.label || "").trim();
  const latitude = toFiniteNumber(body.latitude ?? db.context.latitude);
  const longitude = toFiniteNumber(body.longitude ?? db.context.longitude);
  if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Place label and current coordinates are required.");
  }

  const id = slugify(label);
  const place = {
    id,
    label,
    latitude,
    longitude,
    radiusMeters: Number(body.radiusMeters || 180),
    createdAt: new Date().toISOString()
  };

  db.places = (db.places || []).filter((item) => item.id !== id);
  db.places.push(place);
  db.context = {
    ...db.context,
    placeId: place.id,
    locationTag: place.label,
    latitude,
    longitude,
    lastUpdated: new Date().toISOString()
  };
  return place;
}

function inferPlace(db, context) {
  const current = {
    latitude: toFiniteNumber(context.latitude),
    longitude: toFiniteNumber(context.longitude)
  };
  if (!Number.isFinite(current.latitude) || !Number.isFinite(current.longitude)) return null;
  return [...(db.places || [])]
    .map((place) => ({ ...place, distance: distanceMeters(current, place) }))
    .filter((place) => place.distance <= (place.radiusMeters || 180))
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

function distanceMeters(a, b) {
  if (![a.latitude, a.longitude, b.latitude, b.longitude].every((value) => typeof value === "number" && Number.isFinite(value))) return Infinity;
  const earthRadius = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || crypto.randomUUID();
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}
