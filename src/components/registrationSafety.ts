import type { Coordinates } from '../types/location';

export class RegistrationSafety {
  private lockedCenter: Coordinates | null = null;
  private readonly blockedSubmissions = new Set<string>();

  isLocked(): boolean {
    return this.lockedCenter !== null;
  }

  canSubmit(submissionKey: string): boolean {
    return !this.blockedSubmissions.has(submissionKey);
  }

  lock(center: Coordinates, submissionKey: string): void {
    this.lockedCenter = { ...center };
    this.blockedSubmissions.add(submissionKey);
  }

  unlock(): void {
    this.lockedCenter = null;
  }

  unlockIfCenterMoved(center: Coordinates): boolean {
    if (
      !this.lockedCenter ||
      (center.latitude === this.lockedCenter.latitude &&
        center.longitude === this.lockedCenter.longitude)
    ) {
      return false;
    }
    this.unlock();
    return true;
  }
}
