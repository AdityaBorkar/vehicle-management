import { createFileRoute } from "@tanstack/react-router";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const uid = useId();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authClient.phoneNumber.sendOtp({ phoneNumber });
      if (result.error) {
        setError(result.error.message ?? "Failed to send OTP");
      } else {
        setOtpSent(true);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authClient.phoneNumber.verify({
        code,
        phoneNumber,
      });
      if (result.error) {
        setError(result.error.message ?? "Verification failed");
      } else {
        window.location.href = "/";
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          {otpSent
            ? "Enter the OTP sent to your phone"
            : "Enter your phone number to receive an OTP"}
        </CardDescription>
      </CardHeader>
      {otpSent ? (
        <form onSubmit={handleVerifyOtp}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`${uid}-otp`}>OTP</Label>
              <Input
                autoFocus
                id={`${uid}-otp`}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
                type="text"
                value={code}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Verifying..." : "Verify OTP"}
            </Button>
            <button
              className="text-muted-foreground text-sm hover:text-foreground"
              onClick={() => {
                setOtpSent(false);
                setCode("");
                setError("");
              }}
              type="button"
            >
              Use a different phone number
            </button>
          </CardFooter>
        </form>
      ) : (
        <form onSubmit={handleSendOtp}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`${uid}-phone`}>Phone Number</Label>
              <Input
                autoFocus
                id={`${uid}-phone`}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+919876543210"
                required
                type="tel"
                value={phoneNumber}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
