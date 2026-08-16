import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { BigButton } from "@/components/BigButton";
import { AnimatedBackground } from "@/components/AnimatedBackground";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative">
      <AnimatedBackground />
      <Card className="w-full max-w-md mx-4 bg-white/80 backdrop-blur-xl border-2 border-border shadow-xl">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 text-destructive font-bold text-xl items-center justify-center">
            <AlertCircle className="h-8 w-8" />
            <h1>404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-muted-foreground text-center mb-6">
            Oops! Looks like this page wandered off to another classroom.
          </p>

          <Link href="/">
            <BigButton
              label="Return Home"
              variant="primary"
              size="lg"
              className="w-full"
            />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
