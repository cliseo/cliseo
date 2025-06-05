import { Helmet } from "react-helmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Badge from "@/components/Badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

// Mock data - replace with actual data fetching
const mockUser = {
  email: "user@example.com",
  subscription: "free", // or "ai"
  lastLogin: new Date(),
  activityLogs: [
    {
      id: 1,
      type: "scan",
      status: "completed",
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      details: "Scanned 127 files, found 23 issues"
    },
    {
      id: 2,
      type: "optimize",
      status: "completed",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      details: "Fixed 15 SEO issues, generated sitemap.xml"
    },
    {
      id: 3,
      type: "scan",
      status: "completed",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      details: "Scanned 98 files, found 12 issues"
    }
  ]
};

const Account = () => {
  return (
    <div className="container mx-auto py-16 px-4 max-w-4xl">
      <Helmet>
        <title>My Account - cliseo</title>
        <meta name="description" content="Manage your cliseo account settings and view activity logs" />
      </Helmet>

      <h1 className="text-4xl font-bold mb-8">My Account</h1>

      {/* User Info Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Email</label>
              <p className="text-lg">{mockUser.email}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Subscription</label>
              <div className="flex items-center gap-2">
                <Badge 
                  type={mockUser.subscription === "ai" ? "ai" : "free"} 
                  value={mockUser.subscription === "ai" ? "AI Mode" : "Free Mode"} 
                />
                {mockUser.subscription === "free" && (
                  <a 
                    href="/pricing" 
                    className="text-sm text-primary hover:underline"
                  >
                    Upgrade to AI Mode
                  </a>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Last Login</label>
              <p className="text-lg">
                {formatDistanceToNow(mockUser.lastLogin, { addSuffix: true })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs Card */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {mockUser.activityLogs.map((log) => (
                <div 
                  key={log.id}
                  className="flex items-start gap-4 p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex-shrink-0">
                    <Badge 
                      type={log.type === "scan" ? "scan" : "optimize"} 
                      value={log.type === "scan" ? "Scan" : "Optimize"} 
                    />
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(log.timestamp, { addSuffix: true })}
                    </p>
                    <p className="mt-1">{log.details}</p>
                  </div>
                  <Badge 
                    type={log.status === "completed" ? "success" : "pending"} 
                    value={log.status} 
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default Account; 