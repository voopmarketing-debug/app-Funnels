"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendManualMessage } from "@/lib/actions";

type SendState = { sentCount: number };

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
      await sendManualMessage(businessId, conversationId, formData);
      return { sentCount: prevState.sentCount + 1 };
    },
    { sentCount: 0 },
  );

  const [isRecording, setIsRecording] = useState(false);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending) {
      formRef.current?.reset();
      setPendingFileName(null);
    }
  }, [isPending, state.sentCount]);

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

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([blob], "nota-de-voz.webm", { type: blob.type }));
        fileInputRef.current.files = dataTransfer.files;
        setPendingFileName("Nota de voz");
        formRef.current?.requestSubmit();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      alert("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
    }
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-1.5 border-t border-border bg-surface p-3">
      <input ref={fileInputRef} type="file" name="file" hidden onChange={handleFilePicked} />
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
          disabled={isPending}
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
      <p className="fl-mono pl-1 text-[10px] text-ink-faint">
        {pendingFileName ? `Adjunto: ${pendingFileName}` : SIZE_HINT}
      </p>
    </form>
  );
}
