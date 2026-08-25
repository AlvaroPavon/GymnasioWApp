import cron from "node-cron";
import { reservationService, type ReservationService } from "../services/reservation.service.js";
import { membershipService, type MembershipService } from "../services/membership.service.js";

export function startCronJobs(service: ReservationService = reservationService, memberships: MembershipService = membershipService) {
  const validationTask = cron.schedule("* * * * *", async () => {
    await service.processMissedAttendance();
  }, { name: "reservation-attendance-sweep", noOverlap: true });

  const reminderTask = cron.schedule("* * * * *", async () => {
    await service.sendReservationReminders();
  }, { name: "reservation-reminders", noOverlap: true });

  const membershipExpiryTask = cron.schedule("*/15 * * * *", async () => {
    await memberships.expireOverdueMemberships();
  }, { name: "membership-expiry-sweep", noOverlap: true });

  return () => {
    validationTask.stop();
    reminderTask.stop();
    membershipExpiryTask.stop();
  };
}
