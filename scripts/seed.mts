#!/usr/bin/env node
/**
 * سكربت البذر — يملأ MongoDB Atlas ببيانات الفيوم الواقعية.
 *
 * الاستخدام:
 *   npm run db:seed          # يضيف فوق الموجود
 *   npm run db:seed -- --clear   # يمسح ثم يبذر
 *
 * حماية: يرفض العمل على الإنتاج.
 */

import { config } from 'dotenv';
import mongoose from 'mongoose';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const { runSeed } = await import('../src/server/db/seed/seed');
const { connectToDatabase, disconnectFromDatabase } = await import('../src/server/db/mongoose');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ممنوع تشغيل البذر على بيئة الإنتاج.');
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI غير معرّف. أضفه في .env.local — انظر .env.example.');
    process.exit(1);
  }

  const clear = process.argv.includes('--clear');

  console.log('⏳ الاتصال بقاعدة البيانات...');
  await connectToDatabase();

  if (clear) console.log('🗑️  مسح البيانات الحالية...');
  console.log('🌱 بدء البذر...');

  const result = await runSeed({ clear });

  console.log('\n✅ اكتمل البذر:');
  console.log(`   التصنيفات:      ${result.categories}`);
  console.log(`   المهن:          ${result.professions}`);
  console.log(`   المستخدمون:     ${result.users}`);
  console.log(`   مقدمو الخدمات:  ${result.providers}`);
  console.log(`   الخدمات:        ${result.services}`);
  console.log(`   الأسئلة الشائعة: ${result.faqs}`);
  console.log(`   الإعدادات:      ${result.settings}`);

  console.log('\n⏳ بناء الفهارس...');
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
  console.log('✅ تم بناء الفهارس.');

  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error('❌ فشل البذر:', error);
  await disconnectFromDatabase().catch(() => undefined);
  process.exit(1);
});
