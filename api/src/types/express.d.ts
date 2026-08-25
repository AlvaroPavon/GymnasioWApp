export {};

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: number;
        role: "ADMIN" | "TEACHER" | "CLIENT";
      };
    }
  }
}
