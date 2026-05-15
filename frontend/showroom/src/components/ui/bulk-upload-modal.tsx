import { useState, useRef } from "react";
import { Button } from "./button";
import { Alert, AlertDescription } from "./alert";
import { FileUp, Download, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { getAuthToken } from "@/lib/auth";

interface BulkUploadResult {
  success: boolean;
  imported: number;
  skipped: number;
  validationErrors?: string[];
  products?: any[];
}

interface BulkUploadModalProps {
  onUploadComplete?: (result: BulkUploadResult) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function BulkUploadModal({ onUploadComplete, isOpen, onClose }: BulkUploadModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch("/api/products/download-template", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to download template");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "products-template.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download template");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);

    const allowedTypes = ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith(".csv") && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setError("Please upload a CSV or Excel file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getAuthToken();

      const response = await fetch("/api/products/bulk-upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Upload failed");
        if (data.details) {
          setError(`${data.error}\n${data.details.join("\n")}`);
        }
        return;
      }

      setResult(data);
      onUploadComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Bulk Upload Products</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
              ×
            </button>
          </div>

          {!result && !error && (
            <div className="space-y-4">
              {/* Drag and Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <FileUp className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 mb-2">Drag and drop your file here or click to browse</p>
                <p className="text-xs text-gray-400">Supported formats: CSV, XLSX, XLS (Max 5MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange}
                  disabled={isLoading}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  Choose File
                </Button>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h3 className="text-sm font-medium text-blue-900 mb-2">File Format Requirements:</h3>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Headers: name, sku, description, price, cost, stock, minStock, categoryId, categoryName, brand, imageUrl, isActive</li>
                  <li>• Required fields: name, sku, price, cost, stock</li>
                  <li>• Prefer categoryName when the file came from another app or database</li>
                  <li>• Each row represents one product</li>
                  <li>• SKUs must be unique</li>
                </ul>
              </div>

              {/* Download Template */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleDownloadTemplate}
                disabled={isLoading}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="text-sm text-gray-600">Processing your file...</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">{error.split("\n")[0]}</p>
                {error.split("\n").slice(1).length > 0 && (
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    {error.split("\n").slice(1).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <p className="font-semibold text-green-900">Upload Successful!</p>
                  <p className="text-sm text-green-800 mt-1">
                    {result.imported} product{result.imported !== 1 ? "s" : ""} imported
                    {result.skipped > 0 && ` • ${result.skipped} skipped`}
                  </p>
                </AlertDescription>
              </Alert>

              {result.validationErrors && result.validationErrors.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription>
                    <p className="font-semibold text-yellow-900">Validation Warnings:</p>
                    <ul className="text-xs text-yellow-800 mt-2 space-y-1">
                      {result.validationErrors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {result.validationErrors.length > 5 && <li>... and {result.validationErrors.length - 5} more</li>}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={onClose} className="w-full">
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
