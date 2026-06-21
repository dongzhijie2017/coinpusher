import type { TutorialStepConfig } from "../types";

const TUTORIAL_KEY = "coin-pusher-tutorial-v2";

export const tutorialSteps: TutorialStepConfig[] = [
  {
    id: "welcome",
    text: "先看顶部摆臂左右移动，\n点击按钮会按当前角度出币",
    x: 215,
    y: 254,
    width: 214,
    height: 112
  },
  {
    id: "first_coin",
    text: "点击推币投放硬币，\n金币会先碰导片和上方柱点",
    x: 215,
    y: 702,
    width: 164,
    height: 58
  },
  {
    id: "duck_sensor",
    text: "小黄鸭沿底部轨道移动，\n新投金币碰到它会触发机关滚动",
    x: 215,
    y: 486,
    width: 142,
    height: 74
  },
  {
    id: "center_slot",
    text: "底部发亮的是中央奖励槽，\n推下去落中间收益更高",
    x: 215,
    y: 646,
    width: 166,
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
