let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

export async function startRecording(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.start();
  } catch (error) {
    console.error("Error starting recording:", error);
    throw error;
  }
}

export async function stopRecording(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      reject(new Error("No active recording"));
      return;
    }

    mediaRecorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.webm");
        formData.append("model", "whisper-1");

        const response = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error(`Transcription failed: ${response.statusText}`);
        }

        const result = await response.json();
        resolve(result.text);

        // Clean up
        mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
        mediaRecorder = null;
        audioChunks = [];
      } catch (error) {
        console.error("Error processing audio:", error);
        reject(error);
      }
    };

    mediaRecorder.stop();
  });
}

export function isRecording(): boolean {
  return mediaRecorder?.state === "recording";
}

export const runRecognition = (setCurrentText: (text: string) => void) => {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (SpeechRecognition) {
    const recognition = new SpeechRecognition() as Recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => (result as any)[0])
        .map((result) => result.transcript)
        .join("");
      setCurrentText(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
    };

    return recognition;
  }
  return null;
};
