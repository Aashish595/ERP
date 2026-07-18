import type { Metadata } from "next";

import { LoginCard } from "@/components/auth/LoginCard";

export const metadata: Metadata = {
  title: "Administration Login",
};

export default function AdminLoginPage() {
  return <LoginCard mode="admin" />;
}
