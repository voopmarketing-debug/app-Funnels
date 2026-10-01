"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { upload } from "@vercel/blob/client";
import { sendManualMessage } from "@/lib/actions";
import { MAX_ATTACHMENT_BYTES, maxMbFor, resolveMediaType } from "@/lib/attachmentLimits";
import { EmojiPicker } from "@/components/EmojiPicker";

type SendState = { sentCount: number; error: string | null };

const SIZE_HINT = "Imágenes 5 MB · audio/video 16 MB · documentos 20 MB";

// Below this a file can still ride inside the Server Action request itself
// (Next's body limit is 4MB, see next.config.ts) — used only as a fallback
// if the direct-to-storage upload fails for some reason.
const IN_REQUEST_FALLBACK_BYTES = 3.5 * 1024 * 1024;

function safeUploadName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "archivo";
}

function formatMb(bytes: number): string {
  // Rounded UP so a file just over the limit never reads as "20.0 MB".
  return `${(Math.ceil((bytes / (1024 * 1024)) * 10) / 10).toFixed(1)} MB`;
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Re-renders the countdown every 30s; the server snapshot is null so the
// server HTML and hydration never disagree about "now".
function subscribeClock(onChange: () => void) {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}
const getMinuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;

function WindowCountdown({ expiresAt }: { expiresAt: string }) {
  const now = useSyncExternalStore(subscribeClock, getMinuteNow, () => null);
  if (now === null) return null;
  const msLeft = new Date(expiresAt).getTime() - now;
  if (msLeft <= 0) return null;
  const hours = Math.floor(msLeft / 3_600_000);
  const minutes = Math.floor((msLeft % 3_600_000) / 60_000);
  const urgent = msLeft < 2 * 3_600_000;
  return (
    <span
      title="Tiempo que queda para responder con mensajes libres. Después, WhatsApp solo permite plantillas aprobadas."
      className={`whitespace-nowrap text-[13px] ${urgent ? "font-semibold text-error" : "text-ink-faint"}`}
    >
      <span className="hidden 2xl:inline">La ventana de respuesta cierra en </span>
      <span className="2xl:hidden">⏱ </span>
      {hours}h {String(minutes).padStart(2, "0")}m
    </span>
  );
}

const ICON_BUTTON =
  "flex h-9 w-9 flex-none items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-50";

export function ManualMessageForm({
  businessId,
  conversationId,
  windowOpen,
  windowExpiresAt = null,
  recipientLabel,
}: {
  businessId: string;
  conversationId: string;
  windowOpen: boolean;
  windowExpiresAt?: string | null;
  recipientLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Where the caret was last — mobile browsers drop a textarea's selection
  // once it loses focus (tapping the emoji panel), so it's tracked here.
  const caretRef = useRef<{ start: number; end: number } | null>(null);
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
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const isUploading = uploadPercent !== null;
  const isBusy = isPending || isUploading;

  useEffect(() => {
    if (!isPending && !state.error) {
      formRef.current?.reset();
      caretRef.current = null;
      setPendingFileName(null);
    }
  }, [isPending, state.sentCount, state.error]);

  function clearPickedFile() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPendingFileName(null);
  }

  /**
   * Files go straight from the browser to our storage (Vercel Blob) and only
   * their URL is sent to the server — Server Actions can't carry more than
   * ~4MB, while WhatsApp allows up to 16MB (audio/video) and 20MB
   * (documents). The server re-checks the real size and type before sending.
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isBusy) return;
    setLocalError(null);
    const formData = new FormData(e.currentTarget);
    const fileEntry = formData.get("file");
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
    if (!file && !String(formData.get("text") ?? "").trim()) return;

    if (file) {
      const contentType = (file.type || "application/octet-stream").split(";")[0].trim();
      const mediaType = resolveMediaType(contentType);
      if (!mediaType) {
        setLocalError("Ese tipo de archivo no se puede enviar por WhatsApp");
        clearPickedFile();
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES[mediaType]) {
        setLocalError(
          `"${file.name}" pesa ${formatMb(file.size)} y WhatsApp permite máximo ${maxMbFor(mediaType)} MB para este tipo de archivo`,
        );
        clearPickedFile();
        return;
      }

      setUploadPercent(0);
      try {
        const blob = await upload(`chat/${businessId}/${safeUploadName(file.name)}`, file, {
          access: "public",
          handleUploadUrl: "/api/attachments/upload",
          clientPayload: JSON.stringify({ businessId }),
          contentType,
          multipart: file.size > 5 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setUploadPercent(Math.round(percentage)),
        });
        formData.delete("file");
        formData.set("fileUrl", blob.url);
        formData.set("fileName", file.name);
      } catch (err) {
        // Small files can still go the old way, inside the request itself.
        if (file.size > IN_REQUEST_FALLBACK_BYTES) {
          setUploadPercent(null);
          setLocalError(
            `No se pudo subir el archivo (${err instanceof Error ? err.message : "error de conexión"}). Revisa tu internet e intenta de nuevo.`,
          );
          return;
        }
      }
      setUploadPercent(null);
    }

    startTransition(() => formAction(formData));
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = caretRef.current ?? { start: el.value.length, end: el.value.length };
    const start = Math.min(caret.start, el.value.length);
    const end = Math.min(Math.max(caret.end, start), el.value.length);
    el.setRangeText(emoji, start, end, "end");
    caretRef.current = { start: start + emoji.length, end: start + emoji.length };
    // On touch screens focusing would pop the keyboard over the picker.
    if (window.matchMedia("(pointer: fine)").matches) el.focus();
  }

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
    <form ref={formRef} onSubmit={handleSubmit} className="border-t border-border bg-surface p-2 md:p-3">
      {!windowOpen && (
        <p className="mb-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-[13px] text-accent">
          Pasaron más de 24h desde el último mensaje del cliente — usa el botón{" "}
          <span className="font-semibold">📋 Plantilla</span> de arriba para reabrir la conversación.
        </p>
      )}
      <input ref={fileInputRef} type="file" name="file" hidden onChange={handleFilePicked} />
      {/* Kommo-style composer: the text gets the full width, tools sit in a
          quiet row underneath with the 24h window countdown and Enviar. */}
      <div className="rounded-xl border border-border bg-background transition focus-within:border-accent/60">
        {recipientLabel && !isRecording && (
          <p className="hidden truncate px-3 pt-2 text-[13px] text-ink-faint md:block">
            Responder a <span className="font-semibold text-ink-muted">{recipientLabel}</span> por WhatsApp
          </p>
        )}
        {isRecording ? (
          <div className="flex items-center gap-2 px-3 py-3">
            <span className="relative flex h-2.5 w-2.5 flex-none">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-error" />
            </span>
            <span className="text-sm font-semibold text-error">Grabando nota de voz</span>
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
            ref={textareaRef}
            name="text"
            onSelect={(e) => {
              caretRef.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd };
            }}
            rows={2}
            placeholder="Escribe un mensaje…"
            // text-base (16px) on phones: iOS Safari auto-zooms the whole
            // page into any focused field smaller than that.
            className="block max-h-40 min-h-[2.75rem] w-full resize-none bg-transparent px-3 py-2 text-base text-ink outline-none placeholder:text-ink-faint md:min-h-[3.5rem] md:text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
        )}
        <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
          {!isRecording && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              title="Adjuntar archivo o imagen"
              aria-label="Adjuntar archivo o imagen"
              className={ICON_BUTTON}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isBusy}
            title={isRecording ? "Detener y enviar grabación" : "Grabar nota de voz"}
            aria-label={isRecording ? "Detener y enviar grabación" : "Grabar nota de voz"}
            className={isRecording ? `${ICON_BUTTON} !bg-error !text-white` : ICON_BUTTON}
          >
            {isRecording ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
              </svg>
            )}
          </button>
          {!isRecording && <EmojiPicker onPick={insertEmoji} disabled={isBusy} buttonClassName={ICON_BUTTON} />}
          {micDevices.length > 1 && !isRecording && (
            <select
              value={selectedMicId}
              onChange={(e) => handleMicChange(e.target.value)}
              title="Micrófono para las notas de voz"
              aria-label="Micrófono para las notas de voz"
              className="fl-mono ml-1 hidden max-w-[150px] truncate bg-transparent text-[12px] text-ink-faint outline-none hover:text-ink-muted md:block"
            >
              <option value="">🎙️ Micrófono por defecto</option>
              {micDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  🎙️ {d.label || `Micrófono ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          )}
          <div className="ml-auto flex min-w-0 items-center gap-2 pl-2">
            {windowOpen && windowExpiresAt && !isRecording && <WindowCountdown expiresAt={windowExpiresAt} />}
            {!isRecording && (
              <button
                type="submit"
                disabled={isBusy}
                className="flex h-9 flex-none items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
              >
                {isUploading ? `${uploadPercent}%` : isPending ? "Enviando…" : "Enviar"}
                {!isBusy && (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.99.99 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      {isUploading && (
        <div className="mt-1.5 flex items-center gap-2 px-1" role="status" aria-live="polite">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${uploadPercent}%` }} />
          </div>
          <span className="fl-mono flex-none text-[12px] text-ink-muted">
            Subiendo {pendingFileName} · {uploadPercent}%
          </span>
        </div>
      )}
      {localError ? (
        <p className="mt-1.5 px-1 text-xs font-medium text-error">⚠ {localError}</p>
      ) : state.error ? (
        <p className="mt-1.5 px-1 text-xs font-medium text-error">⚠ No se pudo enviar: {state.error}</p>
      ) : isUploading ? null : pendingFileName ? (
        <p className="fl-mono mt-1.5 px-1 text-[12px] text-ink-faint">Adjunto: {pendingFileName}</p>
      ) : (
        <p className="fl-mono mt-1 hidden px-1 text-[12px] text-ink-faint md:block">
          Enter envía · Shift+Enter nueva línea · {SIZE_HINT}
        </p>
      )}
    </form>
  );
}
