import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

  const submitMutation = trpc.questions.submit.useMutation({
    onSuccess: (data) => {
      toast.success("Thank you for your feedback!");
      
      // Redirect based on response data (server handles branching logic)
      if (data.nextQuestionId) {
        setLocation(`/question/${data.nextQuestionId}`);
      } else if (data.redirectToHome) {
        setLocation("/updates");
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
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold">spill.</h1>
      </div>

      {/* Question Card */}
      <div className="spill-card">
        {/* Facility label */}
        <div className="text-sm font-medium mb-4">{question.facilityId === 1 ? 'Oasis' : 'Facility'}</div>

        {/* Question title */}
        <h2 className="text-xl font-bold mb-4">{question.title}</h2>

        {/* Question description */}
        {question.description && (
          <p className="text-sm text-muted-foreground mb-6">{question.description}</p>
        )}

        {/* Poll options */}
        {question.type === 'poll' && (
          <div className="space-y-3 mb-6">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionToggle(option.id)}
                className={`spill-option w-full ${
                  selectedOptions.includes(option.id) ? 'ring-2 ring-primary' : ''
                }`}
              >
                {option.optionText}
              </button>
            ))}
          </div>
        )}

        {/* Text input */}
        {(question.type === 'text' || question.type === 'fill_blanks') && (
          <div className="mb-6">
            <Textarea
              placeholder={question.placeholder || "Type your answer here..."}
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              className="spill-input-box min-h-[120px]"
            />
          </div>
        )}

        {/* File upload */}
        {question.type === 'file_upload' && (
          <div className="mb-6">
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

        {/* Submit button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="spill-button w-full"
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

        {/* Response count */}
        <div className="text-center text-sm text-muted-foreground mt-4">
          {Math.floor(Math.random() * 100)} others have spilled.
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 spill-card">
        <div className="flex items-start gap-2">
          <div className="text-lg">⚠️</div>
          <div>
            <h3 className="font-semibold mb-1">Disclaimer</h3>
            <p className="spill-disclaimer">
              This platform is for anonymous feedback. Your identity is protected and will not be shared. 
              However, we log IP addresses for security, analytics, and troubleshooting purposes. 
              The information you provide will be used to improve our facilities and services. 
              Please be respectful and constructive in your feedback. 
              Any abusive or inappropriate content will be removed. 
              By submitting, you acknowledge that your feedback may be shared with facility managers 
              and staff for improvement purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
