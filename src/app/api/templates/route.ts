import { withAuth } from '@/lib/apiRoute';
import { prisma } from '@/lib/db';
import { templatesForDealershipWhere } from '@/lib/saveTemplateFromStory';
import { mapTemplate, seedTemplateLibraryIfEmpty } from '@/lib/templateLibrary';

export async function GET(request: Request) {
  return withAuth(
    request,
    async (session) => {
      await seedTemplateLibraryIfEmpty();

      const { searchParams } = new URL(request.url);
      const category = searchParams.get('category');

      const templates = await prisma.template.findMany({
        where: {
          ...templatesForDealershipWhere(session.dealershipId),
          ...(category ? { category } : {}),
        },
        orderBy: [{ source: 'desc' }, { updatedAt: 'desc' }, { title: 'asc' }],
      });

      return { templates: templates.map(mapTemplate) };
    },
    { rateLimitKey: 'templates.list' }
  );
}