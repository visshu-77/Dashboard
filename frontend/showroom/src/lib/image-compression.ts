const MAX_UPLOAD_BYTES = 600 * 1024;
const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024;

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not compress image"));
      },
      "image/jpeg",
      quality,
    );
  });

export async function compressImageForUpload(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES) return file;
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new Error("Image must be 12 MB or smaller");
  }
  if (file.type === "image/svg+xml") {
    throw new Error("SVG image must be under 600 KB");
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not load image"));
      image.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare image compression");

    let scale = Math.min(1, 1600 / Math.max(image.width, image.height));

    for (let resizeAttempt = 0; resizeAttempt < 8; resizeAttempt += 1) {
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.86, 0.78, 0.7, 0.62, 0.54, 0.46]) {
        const blob = await canvasToBlob(canvas, quality);
        if (blob.size <= MAX_UPLOAD_BYTES) {
          const name = file.name.replace(/\.[^.]+$/, "") || "image";
          return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
        }
      }

      scale *= 0.82;
    }

    throw new Error("Image could not be compressed under 600 KB");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export { MAX_UPLOAD_BYTES };
