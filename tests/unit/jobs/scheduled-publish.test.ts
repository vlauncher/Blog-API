import { describe, it, expect } from "@jest/globals";
import { initScheduledPublishJob, stopScheduledPublishJob } from "../../../src/jobs/scheduled-publish.js";

describe("Scheduled Publish Job Unit Tests", () => {
  it("should initialize and stop scheduled publish cron task", () => {
    const task = initScheduledPublishJob();
    expect(task).toBeDefined();

    stopScheduledPublishJob();
  });
});
