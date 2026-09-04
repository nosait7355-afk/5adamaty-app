import mongoose from 'mongoose';
import { getEnv } from '@/server/lib/env';
import { logger } from '@/server/lib/logger';

/**
 * اتصال MongoDB Atlas مع تخزين مؤقت عبر `globalThis`.
 *
 * ضروري في Next: الـHot Reload في التطوير و serverless في الإنتاج يعيدان
 * تنفيذ الوحدات، فبلا cache نفتح اتصالًا جديدًا مع كل طلب حتى نستنفد
 * تجمّع الاتصالات في Atlas.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = globalThis.__mongooseCache ?? { conn: null, promise: null };
globalThis.__mongooseCache = cache;

/**
 * حماية من حقن NoSQL على مستوى Mongoose كله:
 * يجرّد أي مُعامل يبدأ بـ`$` من كائنات الاستعلام قبل تنفيذها.
 * (ARCHITECTURE §7 — Input & Injection)
 */
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

/** 1 = connected · 2 = connecting */
const READY_CONNECTED = 1;
const READY_CONNECTING = 2;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  /*
   * اتصال قائم أنشأه طرف آخر — مثل mongodb-memory-server في الاختبارات
   * أو سكربت صيانة. نتبنّاه بدل فتح اتصال ثانٍ أو المطالبة بـMONGODB_URI.
   */
  if (mongoose.connection.readyState === READY_CONNECTED) {
    cache.conn = mongoose;
    return mongoose;
  }
  if (mongoose.connection.readyState === READY_CONNECTING) {
    await mongoose.connection.asPromise();
    cache.conn = mongoose;
    return mongoose;
  }

  if (!cache.promise) {
    const env = getEnv();

    if (!env.MONGODB_URI) {
      throw new Error(
        'MONGODB_URI غير معرّف. أضفه في .env.local — انظر .env.example للتفاصيل.'
      );
    }

    cache.promise = mongoose
      .connect(env.MONGODB_URI, {
        ...(env.MONGODB_DB_NAME ? { dbName: env.MONGODB_DB_NAME } : {}),
        // حدود تجمّع الاتصالات — مناسبة لـ Atlas M0/M10
        maxPoolSize: 10,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        // نبني الفهارس صراحةً عبر سكربت مخصّص، لا تلقائيًا في الإنتاج
        autoIndex: env.NODE_ENV !== 'production',
      })
      .then((instance) => {
        logger.info('تم الاتصال بقاعدة البيانات', { dbName: instance.connection.name });
        return instance;
      })
      .catch((error: unknown) => {
        // نمسح الوعد الفاشل حتى تُعاد المحاولة في الطلب التالي
        cache.promise = null;
        logger.error('فشل الاتصال بقاعدة البيانات', { error });
        throw error;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

/** يُستخدم في الاختبارات وسكربتات الصيانة فقط. */
export async function disconnectFromDatabase(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}

export { mongoose };
