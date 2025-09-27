import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CircleAlert as AlertCircle, Github, Chrome as Home, Search } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const RepoNotFound = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/p5-logo.png" alt="Player5" width={32} height={32} className="w-8 h-8" />
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Player5
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm">
                <Github className="w-4 h-4" />
                GitHub
              </Button>
              <Link href="/">
                <Button variant="outline" size="sm">
                  <Home className="w-4 h-4" />
                  Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 404 Content */}
      <div className="container mx-auto px-6 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="p-12 bg-gradient-card border-border/40">
            <div className="mb-8">
              <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
              <h1 className="text-4xl font-bold mb-4">Repository Not Found</h1>
              <p className="text-xl text-muted-foreground mb-6">
                The GitHub repository could not be found or has not been initialized with Player5.
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-background/20 rounded-lg p-6 border border-border/20">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Search className="w-5 h-5 text-primary" />
                  Possible Reasons
                </h3>
                <ul className="text-left space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Repository doesn't exist or is private
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Repository hasn't been initialized with P5
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Username or repository name is misspelled
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    P5 integration is not properly configured
                  </li>
                </ul>
              </div>

              <div className="bg-background/20 rounded-lg p-6 border border-border/20">
                <h3 className="text-lg font-semibold mb-3">Initialize Your Repository</h3>
                <p className="text-muted-foreground mb-4">
                  If this is your repository, you can initialize it with P5:
                </p>
                <div className="bg-background/20 rounded-lg p-4 border border-border/20">
                  <code className="text-primary font-mono">
                    cd your-repo && p5 init
                  </code>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/">
                  <Button variant="default" size="lg">
                    <Home className="w-4 h-4" />
                    Go Home
                  </Button>
                </Link>
                <Button variant="outline" size="lg">
                  <Github className="w-4 h-4" />
                  Browse GitHub
                </Button>
                <Link href="/documentation">
                  <Button variant="outline" size="lg">
                    View Documentation
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RepoNotFound;
