export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  original_filename: string;
  resource_type: string;
  format: string;
  bytes: number;
}

export const uploadToCloudinary = (
  file: File,
  onProgress?: (percent: number) => void
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "https://api.cloudinary.com/v1_1/dwxfpnhju/upload", true);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            secure_url: response.secure_url,
            public_id: response.public_id,
            original_filename: file.name,
            resource_type: response.resource_type || "raw",
            format: response.format || file.name.split('.').pop() || "",
            bytes: response.bytes || file.size,
          });
        } catch (e) {
          reject(new Error("Failed to parse Cloudinary response"));
        }
      } else {
        reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Cloudinary upload network error"));
    };

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "me3oan2026");

    xhr.send(formData);
  });
};
