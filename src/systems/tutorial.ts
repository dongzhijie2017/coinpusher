import type { TutorialStepConfig } from "../types";

const TUTORIAL_KEY = "coin-pusher-tutorial-v1";

export const tutorialSteps: TutorialStepConfig[] = [
  {
    id: "welcome",
    text: "欢迎来到街机修复计划！\n点击推币按钮投放硬币",
    x: 215,
    y: 694,
    width: 164,
    height: 58
  },
  {
    id: "first_coin",
    text: "硬币会落入推币台，\n推板将它们推向边缘",
    x: 215,
    y: 480,
    width: 300,
    height: 200
  },
  {
    id: "duck_sensor",
    text: "注意中间移动的小黄鸭！\n硬币砸中它会触发机关检索",
    x: 215,
    y: 452,
    width: 120,
    height: 60
  },
  {
    id: "center_slot",
    text: "中间宽槽是中央修复槽，\n掉进去收益更高！",
    x: 215,
    y: 600,
    width: 150,
    height: 58
  },
  {
    id: "upgrade",
    text: "获得 Gold 后，\n打开升级面板提升机器性能",
    x: 386,
    y: 250,
    width: 58,
    height: 38
  },
  {
    id: "mission",
    text: "完成每日任务获得 Gem，\n可在外观商店解锁皮肤",
    x: 386,
    y: 354,
    width: 58,
    height: 38
  }
];

export class TutorialSystem {
  private completed = new Set<string>();
  private currentStep = 0;
  private active = false;

  constructor() {
    this.loadProgress();
  }

  isActive(): boolean {
    return this.active;
  }

  hasCompleted(stepId: string): boolean {
    return this.completed.has(stepId);
  }

  isAllDone(): boolean {
    return tutorialSteps.every((s) => this.completed.has(s.id));
  }

  getNextStep(): TutorialStepConfig | null {
    if (this.isAllDone()) return null;
    for (let i = this.currentStep; i < tutorialSteps.length; i++) {
      if (!this.completed.has(tutorialSteps[i].id)) {
        return tutorialSteps[i];
      }
    }
    return null;
  }

  start(): void {
    if (!this.isAllDone()) {
      this.active = true;
      this.currentStep = 0;
    }
  }

  completeStep(stepId: string): void {
    this.completed.add(stepId);
    this.currentStep++;
    this.saveProgress();
    if (this.isAllDone()) {
      this.active = false;
    }
  }

  skipAll(): void {
    tutorialSteps.forEach((s) => this.completed.add(s.id));
    this.active = false;
    this.saveProgress();
  }

  private loadProgress(): void {
    try {
      const raw = localStorage.getItem(TUTORIAL_KEY);
      if (raw) {
        const data = JSON.parse(raw) as string[];
        data.forEach((id) => this.completed.add(id));
      }
    } catch {
      // ignore
    }
  }

  private saveProgress(): void {
    try {
      localStorage.setItem(TUTORIAL_KEY, JSON.stringify([...this.completed]));
    } catch {
      // ignore
    }
  }
}

export const tutorialSystem = new TutorialSystem();
