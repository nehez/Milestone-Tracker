// TypeScript's bundled DOM lib doesn't yet include the File System Access API
// (showDirectoryPicker, permission queries, directory iteration). These are
// minimal ambient declarations for the subset this app uses — feature-detected
// at runtime via isFolderPickerSupported(), so browsers without it (Firefox,
// Safari) simply never call into this surface.
export {};

declare global {
  type FileSystemPermissionMode = "read" | "readwrite";

  interface FileSystemHandlePermissionDescriptor {
    mode?: FileSystemPermissionMode;
  }

  interface FileSystemHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>;
    [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
  }

  interface DirectoryPickerOptions {
    id?: string;
    mode?: FileSystemPermissionMode;
    startIn?: FileSystemHandle | string;
  }

  interface Window {
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  }
}
