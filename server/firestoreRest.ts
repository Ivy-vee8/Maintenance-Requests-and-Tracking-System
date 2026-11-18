import { FIREBASE_PROJECT_ID, FIRESTORE_DATABASE_ID } from './authMiddleware.ts';

type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

interface FirestoreDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

export interface BatchWriteOp {
  type: 'create' | 'update' | 'delete';
  collection: string;
  docId: string;
  fields?: Record<string, unknown>;
  serverTimestamps?: string[];
  updateMaskFields?: string[];
}

const BASE_DOC_ROOT = `projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents`;
const BASE_URL = `https://firestore.googleapis.com/v1/${BASE_DOC_ROOT}`;

export function docFullPath(collection: string, docId: string): string {
  return `${BASE_DOC_ROOT}/${collection}/${docId}`;
}

export function encodeValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = encodeValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function decodeValue(val: FirestoreValue | undefined): unknown {
  if (!val) return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      out[k] = decodeValue(v);
    }
    return out;
  }
  return undefined;
}

export function decodeDocument<T>(doc: FirestoreDocument): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    out[k] = decodeValue(v);
  }
  return out as T;
}

export class FirestoreRestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseErrorResponse(res: globalThis.Response): Promise<never> {
  let msg = `Firestore HTTP ${res.status}`;
  try {
    const json = (await res.json()) as { error?: { message?: string; status?: string } };
    if (json?.error?.message) {
      msg = json.error.message;
    }
  } catch {
    // ignore parse failure
  }
  throw new FirestoreRestError(res.status, msg);
}

export async function getDoc<T>(idToken: string, collection: string, docId: string): Promise<T | null> {
  const url = `${BASE_URL}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) await parseErrorResponse(res);
  const data = (await res.json()) as FirestoreDocument;
  return decodeDocument<T>(data);
}

export async function listCollection<T>(idToken: string, collection: string): Promise<T[]> {
  const url = `${BASE_URL}:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseErrorResponse(res);
  const rows = (await res.json()) as Array<{ document?: FirestoreDocument }>;
  return rows.filter((r) => Boolean(r.document)).map((r) => decodeDocument<T>(r.document!));
}

export async function runFieldQuery<T>(
  idToken: string,
  collection: string,
  fieldPath: string,
  op: 'EQUAL' | 'IN',
  value: string | boolean | Array<string | boolean>
): Promise<T[]> {
  const url = `${BASE_URL}:runQuery`;
  const filterValue: FirestoreValue =
    op === 'IN' && Array.isArray(value)
      ? { arrayValue: { values: value.map((v) => encodeValue(v)) } }
      : encodeValue(value);

  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath },
          op,
          value: filterValue,
        },
      },
      limit: 500,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseErrorResponse(res);
  const rows = (await res.json()) as Array<{ document?: FirestoreDocument }>;
  return rows.filter((r) => Boolean(r.document)).map((r) => decodeDocument<T>(r.document!));
}

export async function commitWrites(idToken: string, ops: BatchWriteOp[]): Promise<void> {
  const url = `${BASE_URL}:commit`;
  const writes = ops.map((op) => {
    const name = docFullPath(op.collection, op.docId);
    if (op.type === 'delete') {
      return { delete: name };
    }

    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(op.fields || {})) {
      if (v !== undefined) {
        fields[k] = encodeValue(v);
      }
    }

    const write: Record<string, unknown> = {
      update: { name, fields },
      currentDocument: { exists: op.type === 'update' },
    };

    if (op.type === 'update' && op.updateMaskFields && op.updateMaskFields.length > 0) {
      write.updateMask = { fieldPaths: op.updateMaskFields };
    }

    if (op.serverTimestamps && op.serverTimestamps.length > 0) {
      write.updateTransforms = op.serverTimestamps.map((fieldPath) => ({
        fieldPath,
        setToServerValue: 'REQUEST_TIME',
      }));
    }

    return write;
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });

  if (!res.ok) await parseErrorResponse(res);
}
