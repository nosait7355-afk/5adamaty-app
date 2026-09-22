import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/**
 * قاعدة بيانات في الذاكرة للاختبارات.
 * تعمل بلا اتصال بالإنترنت وبلا Atlas، وتُقلع في ~2 ثانية.
 *
 * ملاحظة بيئة: mongod يكتب ملفاته المؤقتة افتراضيًا في `os.tmpdir()`
 * (عادة قرص C على ويندوز)، وقد يفشل الإقلاع بخطأ "available disk space"
 * إن كان ذلك القرص شبه ممتلئ رغم وجود مساحة كافية على قرص المشروع.
 * نوجّه `dbPath` صراحةً داخل المشروع لتفادي الاعتماد على قرص النظام.
 */

let server: MongoMemoryServer | null = null;
let dbPath: string | null = null;

export async function startTestDb(): Promise<string> {
  dbPath = path.join(process.cwd(), '.tmp-test-db', randomUUID());
  mkdirSync(dbPath, { recursive: true });

  server = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: 'wiredTiger', launchTimeout: 60_000 },
  });
  const uri = server.getUri();
  await mongoose.connect(uri, { dbName: 'khadamaty_test' });
  return uri;
}

export async function stopTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await server?.stop();
  server = null;
  // نمسح الاتصال المخزّن حتى لا يتسرّب بين ملفات الاختبار
  const { disconnectFromDatabase } = await import('@/server/db/mongoose');
  await disconnectFromDatabase().catch(() => undefined);

  if (dbPath) {
    const { rm } = await import('node:fs/promises');
    await rm(dbPath, { recursive: true, force: true }).catch(() => undefined);
    dbPath = null;
  }
}

/** يمسح كل المجموعات بين الاختبارات مع إبقاء الفهارس. */
export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
}

/** يبني كل الفهارس المعرّفة في الـSchemas — للتحقق منها في الاختبارات. */
export async function buildAllIndexes(): Promise<void> {
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.createIndexes())
  );
}
