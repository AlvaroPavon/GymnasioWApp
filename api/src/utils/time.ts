import { addMinutes, subMinutes } from "date-fns";

export { addMinutes, subMinutes };

export function minutesBefore(date: Date, minutes: number) {
  return subMinutes(date, minutes);
}
