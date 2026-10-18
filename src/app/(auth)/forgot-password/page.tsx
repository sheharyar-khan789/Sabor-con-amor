import type { Metadata } from "next";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { AuthHeading } from "@/components/auth/AuthFrame";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Linked from /admin/login with ?for=admin: the reset email and links lead back to the admin sign-in.
  const forAdmin = (await searchParams).for === "admin";
  return (
    <>
      <AuthHeading
        eyebrow="Password recovery"
        title="Reset your password"
        intro="Enter the email you use to sign in and we'll send you a link to choose a new password."
      />
      <ForgotPasswordForm forAdmin={forAdmin} />
    </>
  );
}
