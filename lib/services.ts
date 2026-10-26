/**
 * Composition root: wires repositories into services.
 * This is the only module (besides lib/data itself) that knows which data source is used.
 */
import { BackupService } from "@/lib/backup/BackupService";
import { CLOUD_CONFIG } from "@/lib/cloud/config";
import { CloudSyncService } from "@/lib/cloud/CloudSyncService";
import { APP_CONFIG } from "@/lib/config";
import { createCloudStore, createRepositories } from "@/lib/data";
import { DictationService } from "@/lib/dictation/DictationService";
import { PracticeService } from "@/lib/dictation/PracticeService";
import { MistakeService } from "@/lib/mistakes/MistakeService";
import { OcrService } from "@/lib/ocr/OcrService";
import { PlannerService } from "@/lib/planner/PlannerService";
import { PromptService } from "@/lib/prompts/PromptService";
import { KnowledgeService } from "@/lib/knowledge/KnowledgeService";
import { SettingsService } from "@/lib/settings/SettingsService";
import { StatsService } from "@/lib/stats/StatsService";
import { StudentService } from "@/lib/student/StudentService";
import { TTSService, createTTSProvider } from "@/lib/tts/TTSService";

export interface AppServices {
  students: StudentService;
  settings: SettingsService;
  dictation: DictationService;
  mistakes: MistakeService;
  practice: PracticeService;
  stats: StatsService;
  backup: BackupService;
  cloud: CloudSyncService;
  planner: PlannerService;
  prompts: PromptService;
  knowledge: KnowledgeService;
  ocr: OcrService;
  tts: TTSService;
}

let instance: AppServices | null = null;

/** Client-side singleton. Call only from the browser (effects / event handlers). */
export function getServices(): AppServices {
  if (!instance) {
    const repos = createRepositories(APP_CONFIG.dataSource);
    const cloudStore = createCloudStore(CLOUD_CONFIG.url, CLOUD_CONFIG.publishableKey, CLOUD_CONFIG.ocrFunction);
    const cloud = new CloudSyncService(cloudStore, repos.backup, repos.owner, repos.syncState, repos.changes);
    instance = {
      students: new StudentService(repos.students, repos.owner, repos.settings, {
        lists: repos.content,
        mistakes: repos.mistakes,
        sessions: repos.practice,
        tasks: repos.tasks,
        prompts: repos.prompts,
        knowledge: repos.knowledge,
      }),
      settings: new SettingsService(repos.settings),
      dictation: new DictationService(repos.content),
      mistakes: new MistakeService(repos.mistakes),
      practice: new PracticeService(repos.practice, repos.mistakes),
      stats: new StatsService(repos.practice, repos.mistakes, repos.content),
      backup: new BackupService(repos.backup, repos.settings),
      cloud,
      planner: new PlannerService(repos.tasks, repos.planner, repos.practice, repos.content),
      prompts: new PromptService(repos.prompts),
      knowledge: new KnowledgeService(repos.knowledge),
      ocr: new OcrService(cloudStore, cloud),
      tts: new TTSService(createTTSProvider(APP_CONFIG.ttsProvider)),
    };
  }
  return instance;
}
