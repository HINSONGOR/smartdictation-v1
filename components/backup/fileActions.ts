/** Browser helpers for saving / sharing a text file (UI layer only). */

export function downloadTextFile(fileName: string, text: string, type = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give Safari time to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** True where the system share sheet can take files (iPhone / iPad: AirDrop, Files, Mail…). */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File(["{}"], "test.json", { type: "application/json" })] });
  } catch {
    return false;
  }
}

export async function shareTextFile(fileName: string, text: string, type = "application/json"): Promise<void> {
  await navigator.share({ files: [new File([text], fileName, { type })], title: fileName });
}
