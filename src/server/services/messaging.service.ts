import { forbidden, notFound } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';
import {
  countUnreadMessages,
  createMessage,
  findMessages,
  findOrCreateThread,
  findThreadForUser,
  findThreadsForUser,
  markThreadRead,
  type MessageLean,
  type ThreadLean,
} from '@/server/repositories/messaging.repository';
import { findOrderById } from '@/server/repositories/order.repository';
import {
  createNotification,
  findProviderById,
  findUserById,
} from '@/server/repositories/provider.repository';
import { isContactUnlocked } from './order.service';
import type { SendMessageInput } from '@/shared/schemas/account.schema';
import type { SessionUser } from '@/server/middleware/with-auth';

/**
 * المراسلة (Phase 9) — شاشة المحادثة المشتقّة من زرّي «تواصل مع العميل»
 * و«محادثة مع مقدم الخدمة».
 *
 * قاعدتان تحكمان الملف:
 *   1. **لا محادثة بلا طلب.** كل Thread مرتبط بطلب قائم وبمشاركَين بالضبط،
 *      فلا يستطيع أحد فتح محادثة مع من يشاء.
 *   2. **لا محادثة قبل قبول الطلب.** نفس قاعدة كشف الهاتف في Phase 7: قبل
 *      القبول لا التزام بين الطرفين، وفتح قناة حينها يحوّل الطلبات إلى
 *      وسيلة للتواصل بلا عمل.
 */

/* ================================================================== */
/* أشكال الإخراج                                                       */
/* ================================================================== */

export interface ThreadDto {
  id: string;
  orderId: string;
  orderNumber?: number;
  counterpart: { id: string; fullName: string };
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unread: number;
}

export interface MessageDto {
  id: string;
  body: string;
  isMine: boolean;
  isRead: boolean;
  createdAt: string;
}

function toMessageDto(message: MessageLean, userId: string): MessageDto {
  return {
    id: String(message._id),
    body: message.body,
    isMine: String(message.senderId) === userId,
    isRead: message.isRead,
    createdAt: new Date(message.createdAt).toISOString(),
  };
}

/** الطرف الآخر في المحادثة. */
function counterpartId(thread: ThreadLean, userId: string): string {
  const other = thread.participants.find((id) => String(id) !== userId);
  return String(other ?? userId);
}

async function toThreadDto(thread: ThreadLean, userId: string): Promise<ThreadDto> {
  const otherId = counterpartId(thread, userId);
  const [other, order] = await Promise.all([
    findUserById(otherId),
    findOrderById(String(thread.orderId)),
  ]);

  const unreadMap = thread.unread as unknown as Map<string, number> | Record<string, number>;
  const unread =
    unreadMap instanceof Map ? (unreadMap.get(userId) ?? 0) : (unreadMap?.[userId] ?? 0);

  return {
    id: String(thread._id),
    orderId: String(thread.orderId),
    ...(order?.orderNumber != null ? { orderNumber: order.orderNumber } : {}),
    counterpart: { id: otherId, fullName: other?.fullName ?? 'مستخدم' },
    ...(thread.lastMessagePreview ? { lastMessagePreview: thread.lastMessagePreview } : {}),
    ...(thread.lastMessageAt ? { lastMessageAt: new Date(thread.lastMessageAt).toISOString() } : {}),
    unread,
  };
}

/* ================================================================== */
/* المحادثات                                                           */
/* ================================================================== */

export async function listThreads(user: SessionUser, options: { page: number; limit: number }) {
  const { items, total } = await findThreadsForUser(user.id, options);
  const threads = await Promise.all(items.map((thread) => toThreadDto(thread, user.id)));

  return {
    items: threads,
    total,
    page: options.page,
    limit: options.limit,
    hasMore: options.page * options.limit < total,
    unreadTotal: await countUnreadMessages(user.id),
  };
}

/**
 * يفتح محادثة الطلب أو ينشئها.
 *
 * يتحقق أولًا أن المستخدم **طرف في الطلب**، ثم أن الطلب بلغ حالة تسمح
 * بالتواصل. الطرفان يُشتقّان من الطلب نفسه، فلا يمكن حقن مشارك ثالث.
 */
export async function openOrderThread(user: SessionUser, orderId: string): Promise<ThreadDto> {
  const order = await findOrderById(orderId);
  if (!order) throw notFound('الطلب المطلوب غير موجود.');

  const provider = await findProviderById(String(order.providerId));
  if (!provider) throw notFound('الطلب المطلوب غير موجود.');

  const customerId = String(order.customerId);
  const providerUserId = String(provider.userId);

  if (user.id !== customerId && user.id !== providerUserId) {
    logger.warn('محاولة فتح محادثة طلب لا يخصّ المستخدم', { userId: user.id, orderId });
    throw notFound('الطلب المطلوب غير موجود.');
  }

  if (!isContactUnlocked(order.status)) {
    throw forbidden('تُفتح المحادثة بعد قبول مقدم الخدمة للطلب.');
  }

  const thread = await findOrCreateThread({
    orderId,
    participants: [customerId, providerUserId],
  });

  return toThreadDto(thread, user.id);
}

export async function getThreadMessages(
  user: SessionUser,
  threadId: string,
  options: { page: number; limit: number }
) {
  // غير المشارك يحصل على 404 — لا نكشف وجود المحادثة
  const thread = await findThreadForUser(user.id, threadId);
  if (!thread) throw notFound('المحادثة المطلوبة غير موجودة.');

  const { items, total } = await findMessages(threadId, options);

  // فتح المحادثة يعني قراءتها
  await markThreadRead(user.id, threadId);

  return {
    thread: await toThreadDto(thread, user.id),
    items: items.map((message) => toMessageDto(message, user.id)),
    total,
    page: options.page,
    limit: options.limit,
    hasMore: options.page * options.limit < total,
  };
}

export async function sendMessage(
  user: SessionUser,
  threadId: string,
  input: SendMessageInput
): Promise<MessageDto> {
  const thread = await findThreadForUser(user.id, threadId);
  if (!thread) throw notFound('المحادثة المطلوبة غير موجودة.');

  const order = await findOrderById(String(thread.orderId));
  if (!order) throw notFound('الطلب المرتبط بالمحادثة غير موجود.');

  /*
   * الحالة تُفحص عند **كل رسالة** لا عند فتح المحادثة فقط: طلب أُلغي بعد
   * فتح المحادثة يجب أن يغلق القناة، وإلا بقيت مفتوحة بلا سبب.
   */
  if (!isContactUnlocked(order.status)) {
    throw forbidden('لا يمكن إرسال رسائل على طلب غير نشط.');
  }

  const receiverId = counterpartId(thread, user.id);

  const message = await createMessage({
    threadId,
    orderId: String(thread.orderId),
    senderId: user.id,
    receiverId,
    body: input.body.trim(),
  });

  await createNotification({
    userId: receiverId,
    type: 'MESSAGE_RECEIVED',
    title: 'رسالة جديدة',
    body: input.body.trim().slice(0, 120),
    entityType: 'MESSAGE',
    entityId: String(message._id),
    actionUrl: `/messages/${threadId}`,
  });

  logger.info('أُرسلت رسالة', { threadId, orderId: String(thread.orderId) });

  return toMessageDto(message, user.id);
}
