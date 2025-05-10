import { useState } from "react";
import Turnstile from "../components/Turnstile";
import s from "./Home.module.css";
import { urlChecksum } from "../url-checksum";
import Progress from "../components/Progress";
import { humanFileSize, maxFileSize } from "../file-size";
import Page from "./Page";

type UploadState =
  | { type: "idle" }
  | { type: "encrypting"; progress: number }
  | { type: "uploading"; progress: number }
  | { type: "success"; downloadUrl: string }
  | { type: "error"; error: string };

async function upload(
  {
    file,
    expiryTimeHours,
    token,
  }: { file: File; expiryTimeHours: number; token: string },
  setUploadState: (state: UploadState) => void
) {
  try {
    if (file.size > maxFileSize) {
      throw new Error("File too large");
    }

    setUploadState({ type: "encrypting", progress: 0 });

    const key = await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ivString = btoa(String.fromCharCode(...iv));
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      await file.arrayBuffer()
    );

    const keyBuffer = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    const keyString = btoa(String.fromCharCode(...new Uint8Array(keyBuffer)));

    setUploadState({ type: "uploading", progress: 0 });

    const createUploadResponse = await fetch("/api/create-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        expiryTimeHours,
        "cf-turnstile-response": token,
      }),
    });
    if (!createUploadResponse.ok) {
      throw new Error("Failed to get upload URL");
    }
    const { id, uploadUrl } = (await createUploadResponse.json()) as {
      id: string;
      uploadUrl: string;
    };

    const xhr = new XMLHttpRequest();
    await new Promise((resolve, reject) => {
      xhr.responseType = "json";

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setUploadState({ type: "uploading", progress: e.loaded / e.total });
        }
      });

      xhr.addEventListener("load", () => {
        resolve(xhr.response);
      });

      xhr.addEventListener("error", () => {
        reject(xhr.response);
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.send(encrypted);
    });

    const checksum = await urlChecksum(id, keyBuffer, iv);
    const checksumString = btoa(
      String.fromCharCode(...new Uint8Array(checksum))
    );
    const downloadUrl = `${window.location.origin}/${encodeURIComponent(
      id
    )}#${keyString}.${ivString}.${checksumString}`;
    setUploadState({
      type: "success",
      downloadUrl,
    });
  } catch (error) {
    setUploadState({ type: "error", error: String(error) });
    throw error;
  }
}

function durationName(hours: number) {
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  } else if (hours < 24 * 7) {
    return `${hours / 24} day${hours === 24 ? "" : "s"}`;
  } else {
    return `${hours / (24 * 7)} week${hours === 24 * 7 ? "" : "s"}`;
  }
}

export default function Home() {
  const [uploadState, setUploadState] = useState<UploadState>({ type: "idle" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryTimeHours, setExpiryTimeHours] = useState(24);
  const [token, setToken] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      return;
    }

    await upload(
      {
        file: selectedFile,
        expiryTimeHours,
        token,
      },
      setUploadState
    );
  };

  return (
    <Page>
      <div className={s.about}>
        <h2>Secure temporary file sharing</h2>
        <p>
          Files are encrypted in your browser before being uploaded, and are
          only decrypted by the recipient.
        </p>
        <p>Each file is deleted after the specified expiry time.</p>
      </div>

      <main>
        {uploadState.type === "idle" || uploadState.type === "error" ? (
          <form className={s.uploadForm} onSubmit={handleSubmit}>
            <h2>⬆️ Upload a file</h2>
            <div>Maximum size: {humanFileSize(maxFileSize, false, 0)}</div>

            <label htmlFor="file">File</label>
            <input
              id="file"
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />

            <label htmlFor="expiryTimeHours">Expires after</label>
            <select
              id="expiryTimeHours"
              value={expiryTimeHours}
              onChange={(e) => setExpiryTimeHours(Number(e.target.value))}
            >
              {[1, 2, 4, 8, 12, 24, 48, 168].map((hours) => (
                <option key={hours} value={hours}>
                  {durationName(hours)}
                </option>
              ))}
            </select>

            <label htmlFor="cf-turnstile">Verification</label>
            <Turnstile id="cf-turnstile" setToken={setToken} />

            <button
              type="submit"
              disabled={
                !selectedFile ||
                !token ||
                (uploadState.type !== "idle" && uploadState.type !== "error")
              }
            >
              Upload
            </button>

            {uploadState.type === "error" && (
              <div>
                <h3>❌ Upload failed</h3>
                <div>{uploadState.error}</div>
              </div>
            )}
          </form>
        ) : uploadState.type === "encrypting" ||
          uploadState.type === "uploading" ? (
          <div>
            <h3>
              ⌛️{" "}
              {uploadState.type === "encrypting"
                ? "Encrypting..."
                : "Uploading..."}
            </h3>
            <Progress value={uploadState.progress} />
          </div>
        ) : (
          uploadState.type === "success" && (
            <div>
              <h3>✅ Upload successful</h3>
              <div>
                The file will be available for {durationName(expiryTimeHours)}.
              </div>
              <div>
                <label htmlFor="downloadUrl">Download link</label>
                <div className={s.downloadUrl}>
                  <input
                    id="downloadUrl"
                    type="text"
                    readOnly
                    value={uploadState.downloadUrl}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(uploadState.downloadUrl)
                    }
                  >
                    Copy
                  </button>
                </div>
                {navigator.canShare?.() && (
                  <button
                    onClick={() => {
                      navigator.share({
                        title: `Download ${selectedFile?.name}`,
                        text: `Download ${selectedFile?.name} from Temporary File Host`,
                        url: uploadState.downloadUrl,
                      });
                    }}
                  >
                    Share
                  </button>
                )}
              </div>

              <a className={s.uploadAnother} href="/">
                Upload another file
              </a>
            </div>
          )
        )}
      </main>
    </Page>
  );
}
