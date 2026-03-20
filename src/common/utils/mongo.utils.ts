import { Types } from 'mongoose';

/**
 * Serializes a single MongoDB document (or plain object from lean())
 * to a plain object with 'id' instead of '_id'.
 * Handles arrays and nested objects recursively.
 */
export function serializeMongo<T>(doc: any): T {
  if (!doc) return doc;

  // Handle arrays
  if (Array.isArray(doc)) {
    return doc.map((item) => serializeMongo(item)) as any;
  }

  // Handle MongoDB ObjectId
  if (doc instanceof Types.ObjectId || doc?._bsontype === 'ObjectId') {
    return doc.toString();
  }

  // If it's not an object, return as is
  if (typeof doc !== 'object' || doc === null) {
    return doc;
  }

  // If it's a Mongoose document, convert to plain object
  const obj = doc.toObject ? doc.toObject() : { ...doc };

  if (obj._id) {
    obj.id = obj._id.toString();
    delete obj._id;
  }

  if (obj.__v !== undefined) {
    delete obj.__v;
  }

  // Recurse over keys to serialize nested objects/arrays
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = serializeMongo(obj[key]);
    }
  }

  return obj as T;
}

/**
 * Serializes an array of MongoDB documents (or plain objects from lean())
 */
export function serializeMongoArray<T>(docs: any[]): T[] {
  return serializeMongo<T[]>(docs);
}
