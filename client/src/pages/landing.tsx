import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, DollarSign, Clock, ChevronRight, Star } from "lucide-react";
import starlingLogo from "@assets/starling-logo-full-colour-digital_1769630846363.png";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <img src={starlingLogo} alt="Starling" className="h-8" />
          <a href="/api/login">
            <Button size="sm" data-testid="button-login-header">
              Sign In
            </Button>
          </a>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 space-y-10">
        <section className="text-center space-y-6">
          <img src={starlingLogo} alt="Starling" className="h-16 mx-auto" />
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            Drive with Starling
          </h1>
          <p className="text-muted-foreground text-base max-w-sm mx-auto">
            Become a Starling Driver Partner and enjoy flexible hours, competitive pay, and the freedom to work when you want.
          </p>
          <div className="pt-4 space-y-3 max-w-xs mx-auto">
            <a href="/api/login" className="block">
              <Button size="lg" className="w-full" data-testid="button-get-started">
                Sign In / Create Account
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Free to join • Start earning today
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-center">Why Drive with Starling?</h2>
          <div className="space-y-3">
            <Card className="hover-elevate">
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium">Competitive Earnings</h3>
                  <p className="text-sm text-muted-foreground">Earn more per delivery with our driver-friendly pay structure and weekly e-transfers.</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium">Flexible Hours</h3>
                  <p className="text-sm text-muted-foreground">Choose when you work. Pick up shifts that fit your schedule and lifestyle.</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium">Driver Support</h3>
                  <p className="text-sm text-muted-foreground">24/7 support team ready to help you succeed. We've got your back on every delivery.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="bg-card rounded-lg border p-6 text-center space-y-4">
          <h2 className="text-xl font-semibold">Ready to Start?</h2>
          <p className="text-muted-foreground text-sm">
            Complete your profile and onboarding in just a few minutes. Start earning as soon as tomorrow.
          </p>
          <a href="/api/login">
            <Button className="w-full" data-testid="button-join-now">
              Join Starling Today
            </Button>
          </a>
        </section>
      </main>

      <footer className="border-t px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Starling Driver Partners. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
