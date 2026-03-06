/**
 * useAiChat - Custom hook encapsulating all AI chat state and logic.
 * Extracted from the monolithic ai-chat.tsx page component.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { storage } from "@/lib/supabase-storage";
import { groqAPI, ChatMessage as GroqChatMessage } from "@/lib/groq";
import { useToast } from "@/hooks/use-toast";
import { useActivity } from "@/contexts/ActivityContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/contexts/AppStateContext";
import { getYouTubeTranscriptSafe } from "@/lib/youtubeTranscript";
import { Bot } from "lucide-react";
import { SYSTEM_PROMPT_SUFFIX } from "./constants";
import type {
  ChatMessage,
  UploadedDocument,
  Summary,
  SummaryType,
  ActiveTab,
} from "./types";

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [inputText, setInputText] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [summaryType, setSummaryType] = useState<SummaryType>("quick");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [showNoteSelector, setShowNoteSelector] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { addActivity } = useActivity();
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const isDockNav = preferences.navigationStyle === 'dock' || !preferences.navigationStyle;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    loadNotes();
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const loadNotes = async () => {
    try {
      if (!user?.uid) {
        setNotes([]);
        return;
      }
      const data = await storage.getNotesByUserId(user.uid);
      setNotes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load notes:", error);
      setNotes([]);
    }
  };

  const addMessage = (
    type: "user" | "assistant",
    content: string,
    summaryType?: SummaryType,
    model?: string
  ) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      summaryType,
      model,
    };
    setMessages((prev) => [...prev, message]);
  };

  const saveSummaryToDatabase = async (summary: Summary) => {
    if (!user?.uid) return;
    try {
      await storage.createAiSummary({
        userId: user.uid,
        title: summary.title,
        summary: summary.summary,
        originalContent: summary.content,
        summaryType: summary.summaryType,
        fileType: summary.fileType,
      });
    } catch (error) {
      console.error("Error saving AI summary to database:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Text copied to clipboard" });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getUserName = () => {
    return user?.displayName || user?.email?.split("@")[0] || "User";
  };

  // ─── Actions ──────────────────────────────────────────────────────────────

  const stopResponse = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
      toast({
        title: "Response Stopped",
        description: "AI response has been stopped",
      });
    }
  };

  const handleStarterPrompt = (prompt: string) => {
    setChatInput(prompt);
    setTimeout(() => {
      handleChatMessage();
    }, 100);
  };

  const handleChatMessage = async () => {
    if (!chatInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setIsLoading(true);
    addMessage("user", chatInput);

    try {
      let systemContext = `You are a helpful AI assistant designed to help students with their academic work. Provide clear, educational, and constructive responses using rich Markdown formatting.`;

      const readyDocuments = uploadedDocuments.filter(
        (doc) => doc.status === "ready"
      );
      if (readyDocuments.length > 0) {
        systemContext += `\n\n**IMPORTANT CONTEXT:** The user has uploaded ${readyDocuments.length} document(s):`;
        readyDocuments.forEach((doc, index) => {
          systemContext += `\n\n--- Document ${index + 1}: "${doc.fileName}" (${doc.kind.toUpperCase()}) ---`;
          if (doc.extractedContent) {
            systemContext += `\n${doc.extractedContent}`;
          }
        });
        systemContext += `\n\n**INSTRUCTIONS:** When answering questions, reference the above document content directly. Provide specific information from the documents, quote relevant sections when helpful, and help the user understand the content thoroughly.`;
      }

      const chatHistory: GroqChatMessage[] = [
        {
          role: "system" as const,
          content: systemContext + SYSTEM_PROMPT_SUFFIX,
        },
        ...messages
          .filter((msg) => msg.type !== "assistant" || !msg.summaryType)
          .map((msg) => ({
            role:
              msg.type === "user"
                ? ("user" as const)
                : ("assistant" as const),
            content: msg.content,
          })),
        { role: "user" as const, content: chatInput },
      ];

      const response = await groqAPI.chat({
        messages: chatHistory,
        maxTokens: 1000,
        temperature: 0.7,
      });

      if (!controller.signal.aborted) {
        addMessage("assistant", response.content, undefined, response.model);
        setChatInput("");
        toast({ title: "Success", description: "Message sent successfully!" });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;

      console.error("Chat error:", error);
      let errorMessage =
        "Sorry, I encountered an error while processing your message. Please try again.";

      if (error instanceof Error) {
        if (
          error.message.includes("Invalid API key") ||
          error.message.includes("401")
        ) {
          errorMessage =
            " **API Configuration Issue**\n\nThe Groq API key needs to be configured. Please check your settings and try again.";
        } else if (
          error.message.includes("404") ||
          error.message.includes("model")
        ) {
          errorMessage =
            " **Model Issue**\n\nThe AI model is currently unavailable. Please try again in a moment.";
        } else if (
          error.message.includes("rate limit") ||
          error.message.includes("429")
        ) {
          errorMessage =
            " **Rate Limit**\n\nToo many requests. Please wait a moment and try again.";
        } else if (
          error.message.includes("Network error") ||
          error.message.includes("fetch")
        ) {
          errorMessage =
            " **Connection Issue**\n\nUnable to connect to the AI service. Please check your internet connection and try again.";
        } else if (
          error.message.includes("Bad request") ||
          error.message.includes("400")
        ) {
          errorMessage =
            " **Request Error**\n\nThere was an issue with the request format. Please try rephrasing your message.";
        } else if (
          error.message.includes("500") ||
          error.message.includes("server error")
        ) {
          errorMessage =
            " **Server Error**\n\nThe AI service is temporarily unavailable. Please try again later.";
        } else {
          errorMessage = ` **Unexpected Error**\n\n${error.message}\n\nPlease try again or contact support if the issue persists.`;
        }
      }

      addMessage("assistant", errorMessage);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const handleTextSummarize = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text to summarize",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setProcessingStatus("Generating summary...");
    addMessage(
      "user",
      `Summarize this text (${summaryType}): ${inputText.substring(0, 100)}...`
    );

    try {
      const response = await groqAPI.summarizeContent({
        content: inputText,
        type: summaryType,
        fileType: "text",
      });

      addMessage("assistant", response.summary, summaryType);

      const summary: Summary = {
        id: Date.now().toString(),
        title: `Text Summary - ${summaryType}`,
        content: inputText,
        summary: response.summary,
        summaryType,
        fileType: "text",
        timestamp: new Date(),
      };
      setSummaries((prev) => [summary, ...prev]);
      await saveSummaryToDatabase(summary);

      addActivity({
        label: `AI summarized text content`,
        icon: Bot,
        tone: "text-indigo-400",
        type: "ai",
        relatedId: summary.id,
        route: "/ai-chat",
      });

      setInputText("");
      toast({ title: "Success", description: "Text summarized successfully!" });
    } catch (error) {
      console.error("Summarization error:", error);
      addMessage(
        "assistant",
        "Sorry, I encountered an error while summarizing the text. Please try again."
      );
      toast({
        title: "Error",
        description: "Failed to summarize text. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setProcessingStatus(null);
    }
  };

  const handleNoteSummarize = async () => {
    if (!selectedNote) {
      toast({
        title: "Error",
        description: "Please select a note to summarize",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setProcessingStatus("Generating note summary...");
    const stripHtmlTags = (html: string) => html.replace(/<[^>]+>/g, "");
    const cleanContent = stripHtmlTags(selectedNote.content);

    addMessage(
      "user",
      `Summarize note "${selectedNote.title}" (${summaryType})`
    );

    try {
      const response = await groqAPI.summarizeContent({
        content: `Title: ${selectedNote.title}\n\nContent: ${cleanContent}`,
        type: summaryType,
        fileType: "text",
      });

      addMessage("assistant", response.summary, summaryType);

      const summary: Summary = {
        id: Date.now().toString(),
        title: `Note: ${selectedNote.title} - ${summaryType}`,
        content: cleanContent,
        summary: response.summary,
        summaryType,
        fileType: "text",
        timestamp: new Date(),
      };
      setSummaries((prev) => [summary, ...prev]);
      await saveSummaryToDatabase(summary);

      addActivity({
        label: `AI summarized note: ${selectedNote.title}`,
        icon: Bot,
        tone: "text-indigo-400",
        type: "ai",
        relatedId: summary.id,
        route: "/ai-chat",
      });

      setSelectedNote(null);
      setShowNoteSelector(false);
      toast({
        title: "Success",
        description: "Note summarized successfully!",
      });
    } catch (error) {
      console.error("Note summarization error:", error);
      addMessage(
        "assistant",
        "Sorry, I encountered an error while summarizing the note. Please try again."
      );
      toast({
        title: "Error",
        description: "Failed to summarize note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setProcessingStatus(null);
    }
  };

  const handleYoutubeSummarize = async () => {
    if (!youtubeUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a YouTube URL",
        variant: "destructive",
      });
      return;
    }

    if (!user?.uid) {
      toast({
        title: "Error",
        description: "Please sign in to use this feature",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    addMessage(
      "user",
      `Summarize YouTube video (${summaryType}): ${youtubeUrl}`
    );

    try {
      const transcript = await getYouTubeTranscriptSafe(youtubeUrl, user.uid);
      const MAX_CHARS = 15000;
      const trimmedTranscript =
        transcript.length > MAX_CHARS
          ? transcript.slice(0, MAX_CHARS)
          : transcript;

      const response = await groqAPI.summarizeContent({
        content: trimmedTranscript,
        type: summaryType,
        fileType: "youtube",
      });

      addMessage("assistant", response.summary, summaryType);

      const summary: Summary = {
        id: Date.now().toString(),
        title: `YouTube Summary - ${summaryType}`,
        content: transcript,
        summary: response.summary,
        summaryType,
        fileType: "youtube",
        timestamp: new Date(),
      };
      setSummaries((prev) => [summary, ...prev]);
      await saveSummaryToDatabase(summary);

      addActivity({
        label: `AI summarized YouTube video`,
        icon: Bot,
        tone: "text-indigo-400",
        type: "ai",
        relatedId: summary.id,
        route: "/ai-chat",
      });

      setYoutubeUrl("");
      toast({
        title: "Success",
        description: "YouTube video summarized successfully!",
      });
    } catch (error) {
      console.error("YouTube summarization error:", error);
      const msg =
        error instanceof Error
          ? error.message
          : "Please check the URL and try again.";

      if (msg.includes("Transcript is disabled")) {
        addMessage(
          "assistant",
          ` **YouTube Transcript Issue**\n\n${msg}\n\n**Demo Mode Available:** Would you like me to show you how the summarization works? You can:\n\n1. **Copy and paste video content** into the text input above\n2. **Upload a text file** with content you want summarized\n3. **Try the AI chat** for educational assistance\n\n**When transcripts work again:** This feature will automatically extract and summarize YouTube video content.\n\n**Alternative:** If you have access to the video's transcript or captions, you can copy and paste that text into the "Direct Text Input" field above for summarization.`
        );
      } else {
        addMessage(
          "assistant",
          `Sorry, I couldn't fetch or summarize the YouTube video. ${msg}`
        );
      }

      toast({
        title: "Transcript Unavailable",
        description:
          "Try educational videos or paste transcript text directly",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];

    const validFiles = Array.from(files).filter((file) =>
      allowedTypes.includes(file.type)
    );

    if (validFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please upload PDF or PPTX files",
        variant: "destructive",
      });
      return;
    }

    if (validFiles.length < files.length) {
      toast({
        title: "Warning",
        description: `${files.length - validFiles.length} file(s) skipped - only PDF, PPTX allowed`,
      });
    }

    setIsUploadingDoc(true);

    for (const file of validFiles) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/document-intel/sessions", {
          method: "POST",
          headers: { "x-user-id": user?.uid || "anonymous" },
          body: formData,
        });

        if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
        const data = await response.json();

        const doc: UploadedDocument = {
          jobId: data.jobId,
          fileName: file.name,
          kind: file.type.includes("pdf") ? "pdf" : "pptx",
          phase: data.phase,
          status: "processing",
        };

        setUploadedDocuments((prev) => [...prev, doc]);
        pollDocumentStatus(data.jobId);
      } catch (error) {
        console.error(`Document upload error for ${file.name}:`, error);
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }

    toast({
      title:
        validFiles.length > 1 ? "Documents Uploaded" : "Document Uploaded",
      description: `Processing ${validFiles.length} file(s)...`,
    });

    setIsUploadingDoc(false);
    if (documentInputRef.current) documentInputRef.current.value = "";
  };

  const pollDocumentStatus = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/document-intel/sessions?sessionId=${jobId}&action=content`,
          { headers: { "x-user-id": user?.uid || "" } }
        );

        if (response.ok) {
          const data = await response.json();
          clearInterval(pollInterval);
          setUploadedDocuments((prev) =>
            prev.map((doc) =>
              doc.jobId === jobId
                ? {
                    ...doc,
                    status: "ready" as const,
                    phase: "completed",
                    extractedContent: data.content,
                  }
                : doc
            )
          );
        } else if (response.status !== 404) {
          console.error("Error fetching document:", response.statusText);
          clearInterval(pollInterval);
          setUploadedDocuments((prev) =>
            prev.map((doc) =>
              doc.jobId === jobId
                ? { ...doc, status: "error" as const }
                : doc
            )
          );
        }
      } catch (error) {
        console.error("Error polling document status:", error);
      }
    }, 2000);
  };

  const removeDocument = (jobId: string) => {
    setUploadedDocuments((prev) =>
      prev.filter((doc) => doc.jobId !== jobId)
    );
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "text/plain",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Please upload a PDF, PPTX, or TXT file",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setProcessingStatus("Uploading document...");
    addMessage("user", `Summarize file (${summaryType}): ${file.name}`);

    try {
      let content = "";
      let fileType: "pdf" | "text" | "audio" | "youtube" = "text";

      if (file.type === "text/plain") {
        setProcessingStatus("Reading text file...");
        content = await file.text();
        fileType = "text";
      } else {
        setProcessingStatus("Uploading document...");
        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await fetch("/api/document-intel/sessions", {
          method: "POST",
          headers: { "x-user-id": user?.uid || "" },
          body: formData,
        });

        if (!uploadResponse.ok) throw new Error("Failed to upload document");
        const uploadData = await uploadResponse.json();
        const jobId = uploadData.jobId;

        setProcessingStatus("Processing document...");

        let documentReady = false;
        let attempts = 0;
        const maxAttempts = 30;

        while (!documentReady && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          attempts++;
          setProcessingStatus(
            `Extracting content... (${Math.round((attempts / maxAttempts) * 100)}%)`
          );

          try {
            const contentResponse = await fetch(
              `/api/document-intel/sessions?sessionId=${jobId}&action=content`,
              { headers: { "x-user-id": user?.uid || "" } }
            );

            if (contentResponse.ok) {
              const contentData = await contentResponse.json();
              content = contentData.content;
              documentReady = true;
              fileType = file.type === "application/pdf" ? "pdf" : "pdf";
            }
          } catch (err) {
            console.log("Still processing...", err);
          }
        }

        if (!documentReady) {
          throw new Error(
            "Document processing timeout. Please try again."
          );
        }
      }

      setProcessingStatus("Generating summary...");
      const response = await groqAPI.summarizeContent({
        content,
        type: summaryType,
        fileType,
      });

      addMessage("assistant", response.summary, summaryType);

      const summary: Summary = {
        id: Date.now().toString(),
        title: `${file.name} - ${summaryType}`,
        content,
        summary: response.summary,
        summaryType,
        fileType,
        timestamp: new Date(),
      };
      setSummaries((prev) => [summary, ...prev]);
      await saveSummaryToDatabase(summary);

      toast({
        title: "Success",
        description: "File summarized successfully!",
      });
    } catch (error) {
      console.error("File summarization error:", error);
      addMessage(
        "assistant",
        "Sorry, I encountered an error while processing the file. Please try again."
      );
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to process file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setProcessingStatus(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return {
    // State
    messages,
    summaries,
    inputText,
    setInputText,
    youtubeUrl,
    setYoutubeUrl,
    chatInput,
    setChatInput,
    summaryType,
    setSummaryType,
    isLoading,
    activeTab,
    setActiveTab,
    notes,
    selectedNote,
    setSelectedNote,
    showNoteSelector,
    setShowNoteSelector,
    uploadedDocuments,
    isUploadingDoc,
    processingStatus,
    isDockNav,
    user,
    // Refs
    fileInputRef,
    documentInputRef,
    messagesEndRef,
    // Actions
    stopResponse,
    handleStarterPrompt,
    handleChatMessage,
    handleTextSummarize,
    handleNoteSummarize,
    handleYoutubeSummarize,
    handleDocumentUpload,
    handleFileUpload,
    removeDocument,
    copyToClipboard,
    getGreeting,
    getUserName,
    loadNotes,
    // Utility
    getSummaryTypeIcon,
    getSummaryTypeColor,
  };
}

// Summary type display helpers (kept here to avoid circular deps)
import { Zap, FileCheck, List } from "lucide-react";
import React from "react";

function getSummaryTypeIcon(type: SummaryType) {
  switch (type) {
    case "quick":
      return <Zap className="h-4 w-4" />;
    case "detailed":
      return <FileCheck className="h-4 w-4" />;
    case "bullet":
      return <List className="h-4 w-4" />;
  }
}

function getSummaryTypeColor(type: SummaryType) {
  switch (type) {
    case "quick":
      return "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200";
    case "detailed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200";
    case "bullet":
      return "bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200";
  }
}
