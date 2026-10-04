import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import { SettingsService } from "./SettingsService";

describe("SettingsService", () => {
  it("saves cartoon themes", async () => {
    const service = new SettingsService(createLocalRepositories(new MemoryStore()).settings);
    expect((await service.setTheme("dino")).theme).toBe("dino");
    expect((await service.get()).theme).toBe("dino");
  });

  it("falls back to defaults for unknown stored values", async () => {
    const store = new MemoryStore();
    store.write("settings", { locale: "fr", theme: "rainbow", currentStudentId: "s1" });
    const service = new SettingsService(createLocalRepositories(store).settings);
    expect(await service.get()).toEqual({ locale: "zh-HK", theme: "default", currentStudentId: "s1" });
  });
});
