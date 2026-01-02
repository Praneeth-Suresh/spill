import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import PointsBadge from "@/components/PointsBadge";
import Disclaimer from "@/components/Disclaimer";

/**
 * HomePage displays the generic feedback form (home question).
 * This is the default landing page where users can submit general comments.
 * Questions can redirect here after submission based on their settings.
 */
export default function HomePage() {
  const [, setLocation] = useLocation();
  const [feedback, setFeedback] = useState("");
  const utils = trpc.useUtils();

  // Home question is typically ID 1 (created in seed data)
  const { data: questionData } = trpc.questions.getById.useQuery({ id: 1 });

  const submitMutation = trpc.questions.submit.useMutation({
    onSuccess: () => {
      toast.success("Thank you for your feedback!");
      setFeedback("");
      void utils.points.current.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!feedback.trim()) {
      toast.error("Please enter your feedback");
      return;
    }

    if (!questionData) {
      toast.error("Question not available");
      return;
    }

    submitMutation.mutate({
      questionId: questionData.question.id,
      facilityId: questionData.question.facilityId,
      answers: [{ textAnswer: feedback.trim() }],
    });
  };

  return (
    <div className="spill-mobile-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <a href="/" className="text-3xl font-bold hover:underline">spill.</a>
        <PointsBadge />
      </div>

      {/* Feedback Card */}
      <div className="spill-card">
        <h2 className="text-xl font-bold mb-4">Tell us anything!</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Your thoughts help us make this better.
        </p>

        <Textarea
          placeholder="Type your feedback here..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="spill-input-box min-h-[150px] mb-6"
        />

        <Button
          onClick={handleSubmit}
          disabled={submitMutation.isPending}
          className="spill-button w-full"
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Submitting...
            </>
          ) : (
            "spill now."
          )}
        </Button>
      </div>

      {/* Quick Links */}
      <div className="mt-6 space-y-3">
        <div className="spill-card">
          <h3 className="font-semibold mb-3">Quick Feedback</h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setLocation("/question/2")}
            >
              🎬 Vote for next movie
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setLocation("/question/3")}
            >
              🔧 Report equipment issue
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setLocation("/question/4")}
            >
              🎨 Suggest activities
            </Button>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-6">
        <Disclaimer />
      </div>
    </div>
  );
}
