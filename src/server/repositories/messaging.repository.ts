import { Types } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import { Message, Thread } from '@/server/db/models';
import type { MessageDocument, ThreadDocument } from '@/server/db/models/message.model';

export type ThreadLean = Omit<ThreadDocument, '_id'> & { _id: Types.ObjectId };
export type MessageLean = Omit<MessageDocument, '_id'> & { _id: Types.ObjectId };

/**
 * طبقة الوصول للمراسلة (Phase 9).
 *
 * كل محادثة **مرتبطة بطلب** ولها مشاركان بالضبط، فلا توجد رسائل خارج سياق
 * عمل قائم — ولا يمكن لمستخدم أن يفتح محادثة مع أي شخص يختاره.
 */

/**
 * يجلب محادثة الطلب أو ينشئها.
 *
 * `upsert` ذرّي مع الفهرس الفريد على `orderId`: لو ضغط الطرفان «محادثة» في
 * نفس اللحظة، ينشأ Thread واحد لا اثنان.
 */
export async function findOrCreateThread(data: {
  orderId: string;
  participants: [string, string];
}): Promise<ThreadLean> {
  await connectToDatabase();

  const orderId = new Types.ObjectId(data.orderId);
  const participants = data.participants.map((id) => new Types.ObjectId(id));

  const thread = await Thread.findOneAndUpdate(
    { orderId },
    { $setOnInsert: { orderId, participants } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
  ).lean<ThreadLean>();

  return thread;
}

/** محادثات المستخدم — أحدث نشاطًا أولًا. */
export async function findThreadsForUser(
  userId: string,
  options: { page: number; limit: number }
): Promise<{ items: ThreadLean[]; total: number }> {
  await connectToDatabase();

  const filter = { participants: new Types.ObjectId(userId) };
  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    Thread.find(filter)
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip(skip)
      .limit(options.limit)
      .lean<ThreadLean[]>(),
    Thread.countDocuments(filter),
  ]);

  return { items, total };
}

/**
 * محادثة بعينها — **بشرط أن يكون المستخدم مشاركًا فيها**.
 * يعيد `null` لغير المشارك فيُترجم إلى 404، فلا يُكشف وجودها أصلًا.
 */
export async function findThreadForUser(
  userId: string,
  threadId: string
): Promise<ThreadLean | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(threadId)) return null;

  return Thread.findOne({
    _id: new Types.ObjectId(threadId),
    participants: new Types.ObjectId(userId),
  }).lean<ThreadLean | null>();
}

export async function findMessages(
  threadId: string,
  options: { page: number; limit: number }
): Promise<{ items: MessageLean[]; total: number }> {
  await connectToDatabase();

  const filter = { threadId: new Types.ObjectId(threadId) };
  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(options.limit)
      .lean<MessageLean[]>(),
    Message.countDocuments(filter),
  ]);

  // نقرأ من الأحدث للأقدم (للترقيم) ونعرض من الأقدم للأحدث
  return { items: items.reverse(), total };
}

export async function createMessage(data: {
  threadId: string;
  orderId: string;
  senderId: string;
  receiverId: string;
  body: string;
}): Promise<MessageLean> {
  await connectToDatabase();

  const created = await Message.create({
    threadId: new Types.ObjectId(data.threadId),
    orderId: new Types.ObjectId(data.orderId),
    senderId: new Types.ObjectId(data.senderId),
    receiverId: new Types.ObjectId(data.receiverId),
    body: data.body,
  });

  /*
   * ملخّص المحادثة يُحدَّث في نفس العملية المنطقية: عدّاد غير المقروء
   * للمستقبِل وحده يزيد، فلا يرى المرسِل رسالته «غير مقروءة».
   */
  await Thread.updateOne(
    { _id: new Types.ObjectId(data.threadId) },
    {
      $set: {
        lastMessageAt: created.createdAt,
        lastMessagePreview: data.body.slice(0, 120),
      },
      $inc: { [`unread.${data.receiverId}`]: 1 },
    }
  );

  return created.toObject() as MessageLean;
}

/** يعلّم رسائل المحادثة الواردة للمستخدم مقروءة ويصفّر عدّاده. */
export async function markThreadRead(userId: string, threadId: string): Promise<void> {
  await connectToDatabase();

  await Message.updateMany(
    {
      threadId: new Types.ObjectId(threadId),
      receiverId: new Types.ObjectId(userId),
      isRead: false,
    },
    { $set: { isRead: true, readAt: new Date() } }
  );

  await Thread.updateOne(
    { _id: new Types.ObjectId(threadId) },
    { $set: { [`unread.${userId}`]: 0 } }
  );
}

/** إجمالي الرسائل غير المقروءة — شارة تبويب «الرسائل». */
export async function countUnreadMessages(userId: string): Promise<number> {
  await connectToDatabase();
  return Message.countDocuments({
    receiverId: new Types.ObjectId(userId),
    isRead: false,
  });
}
