#!/usr/bin/env node
/**
 * قاعدة بيانات تطوير مؤقتة في الذاكرة.
 *
 * تتيح تشغيل التطبيق ومعاينته بلا Atlas — مفيدة للتطوير المحلي والمراجعة
 * البصرية. البيانات مؤقتة وتزول عند إيقاف العملية.
 *
 * الاستخدام:  node scripts/dev-db.mjs
 * ثم في نافذة أخرى: MONGODB_URI=<الرابط المطبوع> npm run dev
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { writeFileSync } from 'node:fs';

const server = await MongoMemoryServer.create({
  instance: { dbName: 'khadamaty_dev', port: 27077 },
});

const uri = server.getUri();
writeFileSync('.dev-db-uri', uri, 'utf8');

console.log('✅ قاعدة بيانات التطوير تعمل');
console.log(`   URI: ${uri}`);
console.log('   (محفوظ أيضًا في .dev-db-uri)');
console.log('\nاضغط Ctrl+C للإيقاف.');

const shutdown = async () => {
  await server.stop();
  console.log('\n🛑 تم إيقاف قاعدة بيانات التطوير.');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// إبقاء العملية حيّة
setInterval(() => undefined, 1 << 30);
