import type { Metadata } from "next";
import { LoginScreen } from "@/components/login/login-screen";

export const metadata: Metadata = {
  title: "Entsperren",
};

export default function LoginPage() {
  return <LoginScreen />;
}
