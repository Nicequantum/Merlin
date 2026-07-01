import { fetchPrivateBlobAsDataUrl } from '@/lib/blob';
import { withAuth } from '@/lib/apiRoute';
import { blockServiceAdvisorAi } from '@/lib/roleGuards';
import { extractROFromImages } from '@/lib/grok';
import { apiError, FORBIDDEN_ERROR, IMAGE_ACCESS_ERROR, IMAGE_STORAGE_ERROR } from '@/lib/errors';
import { mapGrokRouteError } from '@/lib/grokErrors';
import { userCanAccessImage } from '@/lib/imageAccess';
import { extractPathnameFromImageRef, isAllowedImagePathname } from '@/lib/imageUrls';
import { logger } from '@/lib/logger';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { imagePathnamesSchema, parseRequestBody } from '@/lib/validation';

/** Must match RO_EXTRACT_ROUTE_MAX_DURATION_S in @/lib/timeouts */
export const maxDuration = 190;

export async function POST(request: Request) {
  return withAuth(
    request,
    async (session) => {
      const blocked = blockServiceAdvisorAi(session);
      if (blocked) return blocked;

      const parsed = await parseRequestBody(request, imagePathnamesSchema);
      if ('error' in parsed) return parsed.error;

      const pathnames = parsed.data.imagePathnames.map((ref) => extractPathnameFromImageRef(ref) || ref);

      for (const pathname of pathnames) {
        if (!isAllowedImagePathname(pathname)) {
          logger.warn('ro.extract.invalid_pathname', {
            pathname,
            technicianId: session.technicianId,
          });
          return apiError(FORBIDDEN_ERROR, 403);
        }
        const allowed = await userCanAccessImage(session, pathname);
        if (!allowed) {
          logger.warn('ro.extract.image_access_denied', {
            pathname,
            technicianId: session.technicianId,
            dealershipId: session.dealershipId,
          });
          return apiError(IMAGE_ACCESS_ERROR, 403);
        }
      }

      let imageDataUrls: string[];
      try {
        imageDataUrls = await Promise.all(pathnames.map((pathname) => fetchPrivateBlobAsDataUrl(pathname)));
      } catch (error) {
        logger.error('ro.extract.blob_fetch_failed', {
          pathnames,
          technicianId: session.technicianId,
          error: error instanceof Error ? error.message : 'unknown',
        });
        return apiError(IMAGE_STORAGE_ERROR, 502);
      }

      try {
        const extracted = await extractROFromImages(imageDataUrls);
        logger.info('ro.extract.success', {
          technicianId: session.technicianId,
          pageCount: pathnames.length,
          roNumber: extracted.roNumber || null,
          complaintCount: extracted.complaints?.length ?? 0,
        });
        return extracted;
      } catch (error) {
        const mapped = mapGrokRouteError(error, 'Repair order scan');
        logger.error('ro.extract.grok_failed', {
          technicianId: session.technicianId,
          pageCount: pathnames.length,
          status: mapped.status,
          error: error instanceof Error ? error.message : 'unknown',
        });
        return apiError(mapped.message, mapped.status);
      }
    },
    {
      rateLimitKey: 'ro.extract',
      rateLimit: RATE_LIMITS.generate,
      trackUsage: true,
      blockInMaintenance: true,
      perfEvent: 'route.ro.extract',
    }
  );
}