import { use } from 'react';
import { ThreadScreen } from '@/components/features/messaging/thread-screen';

/** المحادثة — جانب العميل. */
export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ThreadScreen threadId={id} />;
}
