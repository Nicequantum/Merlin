import { withAuth } from '@/lib/apiRoute';
import { apiError, NOT_FOUND_ERROR } from '@/lib/errors';
import { recordTemplateUsage } from '@/lib/templateLibrary';
import { prisma } from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withAuth(
    request,
    async (session) => {
      const template = await prisma.template.findFirst({
        where: {
          id,
          OR: [{ dealershipId: session.dealershipId }, { dealershipId: '__global__' }],
        },
      });

      if (!template) {
        return apiError(NOT_FOUND_ERROR, 404);
      }

      await recordTemplateUsage(id, session.dealershipId);
      return { ok: true };
    },
    { rateLimitKey: 'templates.use' }
  );
}