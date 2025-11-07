import { prisma } from '../db/prisma';

export interface AppSettings {
  id: string;
  registrationEnabled: boolean;
  requireApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateSettingsInput {
  registrationEnabled?: boolean;
  requireApproval?: boolean;
}

export class SettingsService {
  /**
   * Get current app settings
   */
  async getSettings(): Promise<AppSettings> {
    let settings = await prisma.appSettings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          id: 'default',
          registrationEnabled: false,
          requireApproval: true,
        },
      });
    }

    return {
      id: settings.id,
      registrationEnabled: settings.registrationEnabled,
      requireApproval: settings.requireApproval,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Update app settings
   */
  async updateSettings(input: UpdateSettingsInput): Promise<AppSettings> {
    const current = await this.getSettings();

    const updated = await prisma.appSettings.update({
      where: { id: current.id },
      data: {
        ...(input.registrationEnabled !== undefined && {
          registrationEnabled: input.registrationEnabled,
        }),
        ...(input.requireApproval !== undefined && {
          requireApproval: input.requireApproval,
        }),
      },
    });

    return {
      id: updated.id,
      registrationEnabled: updated.registrationEnabled,
      requireApproval: updated.requireApproval,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}

// Singleton instance
let settingsServiceInstance: SettingsService | null = null;

export function getSettingsService(): SettingsService {
  if (!settingsServiceInstance) {
    settingsServiceInstance = new SettingsService();
  }
  return settingsServiceInstance;
}
