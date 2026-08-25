import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { prisma } from "../db/prisma.js";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export interface PushNotifier {
  sendToUser(userId: number, payload: PushPayload): Promise<void>;
}

export class ExpoPushService implements PushNotifier {
  constructor(
    private readonly expo = new Expo(),
    private readonly db = prisma
  ) {}

  /**
   * Sends a push notification to all valid Expo tokens registered by a user.
   * Invalid Expo tokens are ignored instead of crashing the request flow.
   */
  async sendToUser(userId: number, payload: PushPayload): Promise<void> {
    const devices = await this.db.pushDevice.findMany({ where: { userId } });
    const messages: ExpoPushMessage[] = devices
      .filter((device) => Expo.isExpoPushToken(device.pushToken))
      .map((device) => ({
        to: device.pushToken,
        sound: "default",
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {}
      }));

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await this.expo.sendPushNotificationsAsync(chunk);
    }
  }
}

export const expoPushService = new ExpoPushService();
