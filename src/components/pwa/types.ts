export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type InstallOutcome = "accepted" | "dismissed" | "ios_guide" | "browser_guide" | "unavailable";

export type InstallContextValue = {
  /** Whether Cooky is already installed or running in standalone display mode. */
  isInstalled: boolean;
  /** Whether the current platform is iOS/iPadOS Safari. */
  isIos: boolean;
  /** Whether installation can be triggered (either through native prompt or iOS guide). */
  canInstall: boolean;
  /** Whether the user has dismissed the install banner in the last 14 days. */
  isDismissed: boolean;
  /** Whether the iOS step-by-step guidance dialog is currently open. */
  iosDialogOpen: boolean;
  /** Toggle or set the iOS dialog open state. */
  setIosDialogOpen: (open: boolean) => void;
  /** Whether the desktop browser guidance dialog is currently open. */
  browserDialogOpen: boolean;
  /** Toggle or set the desktop browser guidance dialog open state. */
  setBrowserDialogOpen: (open: boolean) => void;
  /** Prompts native installation or opens the appropriate guidance dialog. */
  promptToInstall: () => Promise<InstallOutcome>;
  /** Dismisses the banner and remembers the choice in localStorage. */
  dismissBanner: () => void;
};
