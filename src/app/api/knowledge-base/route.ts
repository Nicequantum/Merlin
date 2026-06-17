import { withAuth } from '@/lib/apiRoute';
import { prisma } from '@/lib/db';
import { mapKnowledgeBase, seedTemplateLibraryIfEmpty } from '@/lib/templateLibrary';

export async function GET(request: Request) {
  return withAuth(
    request,
    async (session) => {
      await seedTemplateLibraryIfEmpty();

      const { searchParams } = new URL(request.url);
      const category = searchParams.get('category');

      const entries = await prisma.knowledgeBase.findMany({
        where: {
          OR: [{ dealershipId: '__global__' }, { dealershipId: session.dealershipId, source: 'user' }],
          ...(category ? { category } : {}),
        },
        orderBy: [{ source: 'desc' }, { updatedAt: 'desc' }, { title: 'asc' }],
      });

      return { entries: entries.map(mapKnowledgeBase) };
    },
    { rateLimitKey: 'knowledge.list' }
  );
}