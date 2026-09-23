"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendManualMessage } from "@/lib/actions";

type SendState = { sentCount: number; error: string | null };

const SIZE_HINT = "Imágenes hasta 5 MB · audio/video hasta 16 MB · documentos hasta 20 MB";

export function ManualMessageForm({
  businessId,
  conversationId,
}: {
  businessId: string;
  conversationId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [state, formAction, isPending] = useActionState<SendState, FormData>(
    async (prevState, formData) => {
      try {
        await sendManualMessage(businessId, conversationId, formData);
        return { sentCount: prevState.sentCount + 1, error: null };
      } catch (err) {
        // Meta's own rejection reason (token vencido, número fuera de la
        // ventana de 24h, credenciales mal puestas, etc.) — previously this
        // threw uncaught and either vanished silently or crashed the whole
        // page via error.tsx, with no way to tell what actually failed.
        return {
          sentCount: prevState.sentCount,
          error: err instanceof Error ? err.message : "No se pudo enviar el mensaje",
        };
      }
    },
    { sentCount: 0, error: null },
  );

  const [isRecording, setIsRecording] = useState(false);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  // A finished recording waits here so it can be listened to before it goes
  // out — sending is the owner's call, not automatic on "stop".
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !state.error) {
      formRef.current?.reset();
      setPendingFileName(null);
      setRecordingPreviewUrl(null);
    }
  }, [isPending, state.sentCount, state.error]);

  useEffect(() => {
    if (!recordingPreviewUrl) return;
    return () => URL.revokeObjectURL(recordingPreviewUrl);
  }, [recordingPreviewUrl]);

  function discardRecording() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setRecordingPreviewUrl(null);
    setPendingFileName(null);
  }

  function handleFilePicked() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setPendingFileName(file.name);
    formRef.current?.requestSubmit();
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0 || !fileInputRef.current) return;

        // Safari/iOS records audio/mp4, Chrome audio/webm, Firefox audio/ogg —
        // the server transcodes all of them to Ogg/Opus for WhatsApp.
        const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([blob], `nota-de-voz.${extension}`, { type: blob.type }));
        fileInputRef.current.files = dataTransfer.files;
        setPendingFileName("Nota de voz");
        setRecordingPreviewUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      alert(
        "No se pudo acceder al micrófono de este dispositivo. Permite el micrófono para este sitio en el navegador, o adjunta un audio con 📎.",
      );
    }
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-1.5 border-t border-border bg-surface p-3">
      <input ref={fileInputRef} type="file" name="file" hidden onChange={handleFilePicked} />
      {recordingPreviewUrl && (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
          <audio controls src={recordingPreviewUrl} className="h-9 min-w-0 flex-1" />
          <button
            type="button"
            onClick={discardRecording}
            disabled={isPending}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-ink-muted transition hover:border-error hover:text-error disabled:opacity-60"
          >
            Descartar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending ? "Enviando..." : "Enviar nota"}
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending || isRecording}
          title="Adjuntar archivo o imagen"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-border text-ink-muted transition hover:border-accent hover:text-accent disabled:opacity-60"
        >
          📎
        </button>
        <button
          type="button"
          onClick={toggleRecording}
          disabled={isPending || !!recordingPreviewUrl}
          title={isRecording ? "Detener grabación" : "Grabar nota de voz"}
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-full border transition ${
            isRecording
              ? "border-error bg-error/10 text-error"
              : "border-border text-ink-muted hover:border-accent hover:text-accent"
          }`}
        >
          🎤
        </button>
        <textarea
          name="text"
          rows={1}
          placeholder="Escribe como si fueras tú (interviene la conversación)..."
          className="max-h-32 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2 text-sm text-ink outline-none focus:border-accent"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          type="submit"
          disabled={isPending || isRecording}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isPending ? "..." : "Enviar"}
        </button>
      </div>
      {state.error ? (
        <p className="pl-1 text-xs font-medium text-error">⚠ No se pudo enviar: {state.error}</p>
      ) : (
        <p className="fl-mono pl-1 text-[10px] text-ink-faint">
          {pendingFileName ? `Adjunto: ${pendingFileName}` : SIZE_HINT}
        </p>
      )}
    </form>
  );
}
