import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { AuthHeading } from "@/components/auth/AuthFrame";
import { safeNextPath } from "@/lib/auth/constants";
import { getSessionUser } from "@/lib/auth/server";
import { business } from "@/lib/config";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : undefined);
  if (await getSessionUser()) redirect(nextPath);

  return (
    <>
      <AuthHeading
        eyebrow="Customer account"
        title="Welcome back"
        intro={`Sign in to your ${business.name} account.`}
      />
      <LoginForm next={nextPath} />
    </>
  );
}
