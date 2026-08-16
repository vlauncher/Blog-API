import { describe, it, expect } from "@jest/globals";
import { buildPaginatedResponse } from "../../../src/utils/pagination.js";

describe("Pagination Utility", () => {
  it("should build paginated response with hasNextPage and nextCursor", () => {
    const items = [
      { id: "item-1", name: "A" },
      { id: "item-2", name: "B" },
      { id: "item-3", name: "C" }, // extra item indicates hasNextPage
    ];

    const result = buildPaginatedResponse(items, 2);

    expect(result.data).toHaveLength(2);
    expect(result.pagination.hasNextPage).toBe(true);
    expect(result.pagination.nextCursor).toBe("item-2");
    expect(result.pagination.limit).toBe(2);
  });

  it("should handle last page where count <= limit", () => {
    const items = [
      { id: "item-1", name: "A" },
      { id: "item-2", name: "B" },
    ];

    const result = buildPaginatedResponse(items, 5, 2);

    expect(result.data).toHaveLength(2);
    expect(result.pagination.hasNextPage).toBe(false);
    expect(result.pagination.nextCursor).toBe(null);
    expect(result.pagination.total).toBe(2);
  });
});
