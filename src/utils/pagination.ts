import { z } from "zod";

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasNextPage: boolean;
    limit: number;
    total?: number;
  };
}

export const buildPaginatedResponse = <T extends { id: string }>(
  items: T[],
  limit: number,
  total?: number
): PaginatedResult<T> => {
  const hasNextPage = items.length > limit;
  const data = hasNextPage ? items.slice(0, limit) : items;
  const nextCursor = hasNextPage ? data[data.length - 1]?.id ?? null : null;

  return {
    data,
    pagination: {
      nextCursor,
      hasNextPage,
      limit,
      ...(total !== undefined && { total }),
    },
  };
};
