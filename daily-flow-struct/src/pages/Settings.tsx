import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("llm_api_key")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      setApiKey(data?.llm_api_key || "");
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          llm_api_key: apiKey,
        });

      if (error) throw error;

      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="min-h-[100dvh] bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              Manage your LLM API key and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fetching ? (
              <div className="text-center text-muted-foreground">Loading...</div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">LLM API Key (Optional)</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use the built-in Lovable AI service (recommended). 
                    Provide your own OpenAI or Anthropic key for custom LLM usage.
                  </p>
                </div>

                <Button onClick={handleSave} disabled={loading} className="w-full">
                  {loading ? "Saving..." : "Save Settings"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
