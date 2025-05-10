import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Turnstile from "../components/Turnstile";
import { urlChecksum } from "../url-checksum";
import s from "./Download.module.css";
import Progress from "../components/Progress";
import { humanFileSize } from "../file-size";
import Page from "./Page";

type DownloadState =
  | { type: "getting-info" }
  | { type: "idle" }
  | { type: "downloading"; progress: number }
  | { type: "decrypting"; progress: number }
  | { type: "success" }
  | { type: "error"; error: string };

async function getFileInfo(id: string) {
  const response = await fetch("/api/file-info?id=" + encodeURIComponent(id));
  if (!response.ok) {
    if (response.status === 404) throw new Error("File not found");
    else throw new Error("Failed to get file info");
  }

  const { name, size } = (await response.json()) as {
    name: string;
    size: number;
  };

  return { name, size };
}

async function downloadFile(
  id: string,
  name: string,
  token: string,
  setDownloadState: (state: DownloadState) => void
) {
  try {
    setDownloadState({ type: "downloading", progress: 0 });

    const xhr = new XMLHttpRequest();
    const encrypted = await new Promise<ArrayBuffer>((resolve, reject) => {
      xhr.responseType = "arraybuffer";

      xhr.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setDownloadState({
            type: "downloading",
            progress: e.loaded / e.total,
          });
        }
      });

      xhr.addEventListener("load", () => {
        resolve(xhr.response);
      });

      xhr.addEventListener("error", () => {
        reject(xhr.response);
      });

      xhr.open("POST", "/api/download?id=" + encodeURIComponent(id));
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(
        JSON.stringify({
          "cf-turnstile-response": token,
        })
      );
    });

    setDownloadState({ type: "decrypting", progress: 1 });

    const hash = location.hash.slice(1);
    const [keyString, ivString, expectedChecksumString] = hash.split(".");
    const keyBuffer = Uint8Array.from(atob(keyString), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivString), (c) => c.charCodeAt(0));
    const expectedChecksum = Uint8Array.from(
      atob(expectedChecksumString),
      (c) => c.charCodeAt(0)
    );
    const calculatedChecksum = new Uint8Array(
      await urlChecksum(id, keyBuffer, iv)
    );
    for (let i = 0; i < expectedChecksum.length; i++) {
      if (expectedChecksum[i] !== calculatedChecksum[i]) {
        throw new Error("Checksum mismatch");
      }
    }

    const key = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      "AES-GCM",
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      encrypted
    );
    const blob = new Blob([decrypted]);
    const blobUrl = URL.createObjectURL(blob);

    setDownloadState({ type: "success" });

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name;
    a.click();
  } catch (error) {
    setDownloadState({ type: "error", error: String(error) });
  }
}

export default function Download() {
  const [downloadState, setDownloadState] = useState<DownloadState>({
    type: "getting-info",
  });
  const [fileInfo, setFileInfo] = useState<
    { name: string; size: number } | undefined
  >(undefined);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (fileInfo?.name)
      document.title = `Download ${fileInfo.name} - Temporary File Host`;
  }, [fileInfo]);

  const { fileId } = useParams();

  if (!fileId) {
    throw new Error("No file ID");
  }

  useEffect(() => {
    getFileInfo(fileId)
      .then((fileInfo) => {
        setFileInfo(fileInfo);
        setDownloadState({ type: "idle" });
      })
      .catch((error) => {
        setDownloadState({ type: "error", error: String(error) });
      });
  }, [fileId]);

  return (
    <Page>
      <main>
        {downloadState.type === "error" ? (
          <>
            <h2>❌ Error</h2>
            <div>{downloadState.error}</div>
          </>
        ) : downloadState.type === "getting-info" || !fileInfo ? (
          <>Getting file info...</>
        ) : (
          <>
            <div className={s.fileInfo}>
              <h2>📄 {fileInfo.name}</h2>
              <div className={s.fileSize}>{humanFileSize(fileInfo.size)}</div>
            </div>

            {downloadState.type === "idle" ? (
              <>
                <label htmlFor="cf-turnstile">Verification</label>
                <Turnstile id="cf-turnstile" setToken={setToken} />

                <button
                  onClick={() => {
                    downloadFile(
                      fileId,
                      fileInfo.name,
                      token,
                      setDownloadState
                    );
                  }}
                  disabled={downloadState.type !== "idle" || !token}
                >
                  Download
                </button>
              </>
            ) : downloadState.type === "downloading" ||
              downloadState.type === "decrypting" ? (
              <>
                <h3>
                  ⌛️{" "}
                  {downloadState.type === "decrypting"
                    ? "Decrypting..."
                    : "Downloading..."}
                </h3>
                <Progress value={downloadState.progress} />
              </>
            ) : downloadState.type === "success" ? (
              <>
                <h3>✅ Finished downloading</h3>
                <div>The file is being saved.</div>
              </>
            ) : null}
          </>
        )}
      </main>
    </Page>
  );
}
