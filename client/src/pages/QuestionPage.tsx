import { useEffect, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import PointsBadge from "@/components/PointsBadge";
import Disclaimer from "@/components/Disclaimer";

import { useFeature } from "@/hooks/useGrowthBook";

const GOOGLE_FORM_URL = "https://forms.gle/placeholder";

/**
 * QuestionPage displays a single question and handles user responses.
 * Supports multiple question types: poll, text, fill_blanks, file_upload.
 * Features white input box on lime-green background as per design mockups.
 */
export default function QuestionPage() {
  const [, params] = useRoute("/question/:id");
  const [, setLocation] = useLocation();
  const questionId = params?.id ? parseInt(params.id) : null;

  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [textAnswer, setTextAnswer] = useState("");
  const [fileData, setFileData] = useState<{ fileName: string; data: string; mimeType: string } | null>(null);

  const { data: questionData, isLoading } = trpc.questions.getById.useQuery(
    { id: questionId! },
    { enabled: !!questionId }
  );

  const { data: responseCountData, isLoading: isCountLoading } = trpc.questions.getResponseCount.useQuery(
    { questionId: questionId! },
    { enabled: !!questionId }
  );

  const buttonColor = useFeature("button-color-test", "#CDFF00", "/question");
  const questionRedirectVariant = useFeature<"redirect" | "in-app">(
    "question-redirect-7",
    "in-app",
    "/question",
    questionId ?? undefined
  );
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (questionId !== 7) return;
    if (questionRedirectVariant !== "redirect") return;
    if (isRedirecting) return;
    if (typeof window === "undefined") return;

    const storageKey = "spill-question-7-redirected";
    if (window.sessionStorage.getItem(storageKey)) return;

    window.sessionStorage.setItem(storageKey, new Date().toISOString());

    setIsRedirecting(true);
    console.info("Redirecting user to placeholder Google Form", {
      questionId,
      variant: questionRedirectVariant,
      experiment: "question-redirect-7",
    });
    window.location.replace(GOOGLE_FORM_URL);
  }, [questionId, questionRedirectVariant, isRedirecting]);

  const submitMutation = trpc.questions.submit.useMutation({
    onSuccess: (data) => {
      toast.success("Thank you for your feedback!");
      
      // Redirect based on response data (server handles branching logic)
      if (data.nextQuestionId) {
        setLocation(`/question/${data.nextQuestionId}`);
      } else if (data.redirectToHome) {
        setLocation(`/updates/${questionData?.question.id}`);
      } else {
        setLocation("/results/" + questionData?.question.id);
      }
    },
    onError: (error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });

  const uploadFileMutation = trpc.questions.uploadFile.useMutation();

  const handleOptionToggle = (optionId: number) => {
    if (questionData?.question.allowMultiple) {
      // Multi-select: toggle option
      setSelectedOptions(prev =>
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      // Single select: replace selection
      setSelectedOptions([optionId]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size if limit is set
    if (questionData?.question.maxFileSize && file.size > questionData.question.maxFileSize) {
      toast.error(`File size exceeds ${Math.round(questionData.question.maxFileSize / 1024 / 1024)}MB limit`);
      return;
    }

    // Check file type if restrictions exist
    if (questionData?.question.allowedFileTypes) {
      const allowedTypes = questionData.question.allowedFileTypes.split(',').map(t => t.trim());
      if (!allowedTypes.includes(file.type)) {
        toast.error(`File type ${file.type} is not allowed`);
        return;
      }
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1]; // Remove data URL prefix
      setFileData({
        fileName: file.name,
        data: base64Data,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!questionData) return;

    const answers: Array<{ optionId?: number; textAnswer?: string; fileId?: number }> = [];

    // Validate and prepare answers based on question type
    if (questionData.question.type === 'poll') {
      if (selectedOptions.length === 0 && questionData.question.isRequired) {
        toast.error("Please select an option");
        return;
      }
      answers.push(...selectedOptions.map(optionId => ({ optionId })));
    } else if (questionData.question.type === 'text' || questionData.question.type === 'fill_blanks') {
      if (!textAnswer.trim() && questionData.question.isRequired) {
        toast.error("Please provide an answer");
        return;
      }
      answers.push({ textAnswer: textAnswer.trim() });
    } else if (questionData.question.type === 'file_upload') {
      if (!fileData && questionData.question.isRequired) {
        toast.error("Please upload a file");
        return;
      }
      
      if (fileData) {
        // Upload file first
        const uploadResult = await uploadFileMutation.mutateAsync({
          fileName: fileData.fileName,
          fileData: fileData.data,
          mimeType: fileData.mimeType,
          questionId: questionData.question.id,
          facilityId: questionData.question.facilityId,
        });
        answers.push({ fileId: uploadResult.fileId });
      }
    }

    // Submit response
    submitMutation.mutate({
      questionId: questionData.question.id,
      facilityId: questionData.question.facilityId,
      answers,
    });
  };

  if (isLoading) {
    return (
      <div className="spill-mobile-card flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!questionData) {
    return (
      <div className="spill-mobile-card flex items-center justify-center">
        <div className="spill-card text-center">
          <h2 className="text-xl font-bold mb-4">Question not found</h2>
          <Button onClick={() => setLocation("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const { question, options } = questionData;
  const isSubmitting = submitMutation.isPending || uploadFileMutation.isPending;

  return (
    <div className="spill-mobile-card">
      <div className="flex items-center justify-between mb-6">
        <a href="/" className="text-3xl font-bold hover:underline">spill.</a>
        <PointsBadge />
      </div>

      <div className="spill-card space-y-4 text-center max-w-xl mx-auto">
        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {question.facilityId <= 5 ? 'RC4' : 'General'}
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold leading-tight">{question.title}</h2>

        {question.description && (
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">{question.description}</p>
        )}

        {/* Poll options: auto-submit on click */}
        {question.type === 'poll' && (
          <>
            <div className="space-y-3 mb-6 max-w-md mx-auto w-full">
              {options.map((option) => (
                <button
                  key={option.id}
                  disabled={isSubmitting}
                  className={`spill-option w-full ${selectedOptions.includes(option.id) ? 'ring-2 ring-primary' : ''}`}
                  onClick={async () => {
                    handleOptionToggle(option.id);
                    setTimeout(() => {
                      submitMutation.mutate({
                        questionId: question.id,
                        facilityId: question.facilityId,
                        answers: [{ optionId: option.id }],
                      });
                    }, 0);
                  }}
                >
                  {option.optionText}
                </button>
              ))}
            </div>
            {isSubmitting && (
              <div className="mt-4 flex justify-center">
                <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-muted-foreground">
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Submitting...
                </span>
              </div>
            )}
          </>
        )}

        {/* Text input */}
        {(question.type === 'text') && (
          <div className="mb-6 max-w-md mx-auto w-full">
            <Textarea
              placeholder={question.placeholder || "Type your answer here..."}
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              className="spill-input-box min-h-[120px]"
            />
          </div>
        )}

        {/* Fill-in-the-blanks input */}
        {(question.type === 'fill_blanks') && (
          <div className="mb-6 max-w-md mx-auto w-full">
            <Input
              type="text"
              placeholder={question.placeholder || "Type your answer here..."}
              value={textAnswer}
              maxLength={64}
              onChange={(e) => {
                const value = e.target.value;
                const words = value.trim().split(/\s+/);
                if (words.length <= 2) {
                  setTextAnswer(value);
                } else {
                  setTextAnswer(words.slice(0, 2).join(' '));
                }
              }}
              className="spill-input-box"
              style={{ resize: 'none' }}
            />
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {textAnswer.trim().split(/\s+/).filter(Boolean).length}/2 words
            </div>
          </div>
        )}

        {/* File upload */}
        {question.type === 'file_upload' && (
          <div className="mb-6 max-w-md mx-auto w-full text-left">
            <Input
              type="file"
              onChange={handleFileChange}
              className="spill-input-box"
              accept={question.allowedFileTypes || undefined}
            />
            {fileData && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {fileData.fileName}
              </p>
            )}
          </div>
        )}

        {/* Submit button: only for non-poll questions */}
        {(question.type !== 'poll') && (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ backgroundColor: buttonColor }}
            className="spill-button w-full max-w-md mx-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Submitting...
              </>
            ) : (
              "spill now."
            )}
          </Button>
        )}

        {/* Response count */}
        <div className="text-center text-sm text-muted-foreground mt-2">
          <span className={isCountLoading ? "opacity-0 transition-opacity" : "opacity-100 transition-opacity"}>
            {responseCountData?.count ?? 0} others have spilled.
          </span>
        </div>
      </div>

      <div className="mt-6">
        <Disclaimer />
      </div>
    </div>
  );
}
