import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import starlingLogo from "@assets/starling-logo-full-colour-digital_1769630846363.png";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center space-y-8 max-w-sm mx-auto">
          <img 
            src={starlingLogo} 
            alt="Starling" 
            className="h-24 mx-auto"
          />
          
          <h1 className="text-3xl font-bold tracking-tight">
            Drive with Starling
          </h1>
          
          <p className="text-muted-foreground">
            Become a Starling Driver Partner
          </p>
          
          <div className="space-y-3 pt-4">
            <a href="/api/login" className="block">
              <Button size="lg" className="w-full" data-testid="button-get-started">
                Sign In / Create Account
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
        </div>
      </main>

      <footer className="px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Starling Innovations Inc. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
