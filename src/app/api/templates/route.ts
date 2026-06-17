import { withAuth } from '@/lib/apiRoute';
import { prisma } from '@/lib/db';
import { mapTemplate, seedTemplateLibraryIfEmpty } from '@/lib/templateLibrary';

export async function GET(request: Request) {
  return withAuth(
    request,
    async () => {
      await seedTemplateLibraryIfEmpty();

      const { searchParams } = new URL(request.url);
      const category = searchParams.get('category');

      const templates = await prisma.template.findMany({
        where: category ? { category } : undefined,
        orderBy: [{ category: 'asc' }, { title: 'asc' }],
      });

      return { templates: templates.map(mapTemplate) };
    },
    { rateLimitKey: 'templates.list' }
  );
}