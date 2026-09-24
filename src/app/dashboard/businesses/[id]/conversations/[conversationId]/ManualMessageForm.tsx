"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendManualMessage } from "@/lib/actions";

type SendState = { sentCount: number; error: string | null };

const SIZE_HINT = "Imágenes hasta 5 MB · audio/video hasta 16 MB · documentos hasta 20 MB";

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ManualMessageForm({
  businessId,
  conversationId,
  windowOpen,
}: {
  businessId: string;
  conversationId: string;
  windowOpen: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardRecordingRef = useRef(false);

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
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  useEffect(() => {
    if (!isPending && !state.error) {
      formRef.current?.reset();
      setPendingFileName(null);
    }
  }, [isPending, state.sentCount, state.error]);

  // Lists available microphones so the person recording can pick their
  // computer's own mic instead of whatever the browser/OS defaults to —
  // on macOS with an iPhone nearby (Continuity), Chrome sometimes defaults
  // getUserMedia to the PHONE's mic instead of the computer's, producing a
  // silent recording since nobody's talking into the phone. Device labels
  // are blank until mic permission has been granted at least once, so the
  // picker only becomes useful after the first recording.
  useEffect(() => {
    let cancelled = false;
    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const mics = devices.filter((d) => d.kind === "audioinput");
        setMicDevices(mics);
        const saved = localStorage.getItem("funnels-preferred-mic");
        if (saved && mics.some((m) => m.deviceId === saved)) setSelectedMicId(saved);
      } catch {
        // enumerateDevices isn't available/blocked — recording still falls
        // back to the browser's default mic, just without a picker.
      }
    }
    loadDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", loadDevices);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", loadDevices);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  function handleMicChange(deviceId: string) {
    setSelectedMicId(deviceId);
    try {
      localStorage.setItem("funnels-preferred-mic", deviceId);
    } catch {
      // Private browsing or storage disabled — the choice just won't persist across reloads.
    }
  }

  function handleFilePicked() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setPendingFileName(file.name);
    formRef.current?.requestSubmit();
  }

  function stopRecordingInterval() {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }

  function cancelRecording() {
    discardRecordingRef.current = true;
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    stopRecordingInterval();
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      stopRecordingInterval();
      return;
    }

    try {
      const audioConstraint = selectedMicId ? { deviceId: { exact: selectedMicId } } : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      discardRecordingRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (discardRecordingRef.current) return;

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
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      alert("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
    }
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-1.5 border-t border-border bg-surface p-3">
      {!windowOpen && (
        <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] text-accent">
          Pasaron más de 24h desde el último mensaje del cliente — usa el botón{" "}
          <span className="font-semibold">📋 Plantilla</span> de arriba para reabrir la conversación.
        </p>
      )}
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
          title={isRecording ? "Detener y enviar grabación" : "Grabar nota de voz"}
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-full border transition ${
            isRecording
              ? "border-error bg-error text-white"
              : "border-border text-ink-muted hover:border-accent hover:text-accent"
          }`}
        >
          🎤
        </button>
        {isRecording ? (
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-error/40 bg-error/10 px-4 py-2">
            <span className="relative flex h-2.5 w-2.5 flex-none">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-error" />
            </span>
            <span className="text-sm font-semibold text-error">Grabando...</span>
            <span className="fl-mono text-xs text-error/80">{formatSeconds(recordingSeconds)}</span>
            <button
              type="button"
              onClick={cancelRecording}
              className="ml-auto text-xs font-medium text-ink-muted hover:text-error"
            >
              Cancelar
            </button>
          </div>
        ) : (
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
        )}
        {!isRecording && (
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending ? "..." : "Enviar"}
          </button>
        )}
      </div>
      {micDevices.length > 1 && !isRecording && (
        <label className="flex items-center gap-1.5 pl-1 text-[10px] text-ink-faint">
          🎙️
          <select
            value={selectedMicId}
            onChange={(e) => handleMicChange(e.target.value)}
            className="fl-mono max-w-[220px] truncate bg-transparent text-[10px] text-ink-muted outline-none"
          >
            <option value="">Micrófono por defecto del navegador</option>
            {micDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Micrófono ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </label>
      )}
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
