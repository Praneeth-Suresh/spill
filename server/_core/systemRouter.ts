import { z } from "zod";
import nodemailer from "nodemailer";
import { adminProcedure, publicProcedure, router } from "./trpc";

// Configure your email transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function notifyOwnerByEmail({ title, content }: { title: string; content: string }) {
  const mailOptions = {
    from: process.env.NOTIFY_FROM_EMAIL,
    to: process.env.NOTIFY_OWNER_EMAIL,
    subject: `[Notification] ${title}`,
    text: content,
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error("Failed to send notification email:", err);
    return false;
  }
}

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwnerByEmail(input);
      return {
        success: delivered,
      } as const;
    }),
});
