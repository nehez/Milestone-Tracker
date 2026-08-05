const SPREADSHEET_EXT = /\.(xlsx|xls|csv)$/i;

/** Chrome/Edge only (Firefox and Safari don't implement the File System Access API) — every
 *  call site feature-detects via this before touching window.showDirectoryPicker. */
export function isFolderPickerSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/** Top-level spreadsheet files in a folder (e.g. a local OneDrive/SharePoint sync folder) as
 *  ordinary File objects, ready to feed into the same pipeline as a manual upload. */
export async function scanFolderForFiles(dirHandle: FileSystemDirectoryHandle): Promise<File[]> {
  const files: File[] = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file" && SPREADSHEET_EXT.test(entry.name)) {
      files.push(await (entry as FileSystemFileHandle).getFile());
    }
  }
  return files;
}
