import { useEffect, useState } from "react";
import { enhanceImage } from "../services/imageEnhancementService.js";
import { generateProductListing } from "../services/productGenerationService.js";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder.js";
import { parseNumericValue } from "../utils/parseNumeric.js";
import { saveProduct } from "../utils/productsStorage.js";

// ============================================================================
// KalaLink — product listing form
// ----------------------------------------------------------------------------
// - Photo upload with preview
// - A separate input field for each piece of data: material cost, expected
//   price, quantity. Each field has its own mic button —
//   tap it to record, tap again to stop; the clip is sent to the backend
//   voice-to-text service (backend/voice-to-text) and the transcribed text
//   fills that field.
// - "Process" sends the image to the backend image-enhancement agent
//   (backend/image-enhancement). If the result isn't good enough, "Retry"
//   re-sends the same image with an escalated attempt number, which the
//   agent uses to apply a stronger enhancement strategy.
// - Once enhancement succeeds, the ENHANCED image + the field values
//   are sent to backend/product_generation, which returns a title,
//   description, tags, and price estimate. This only runs after a
//   successful enhancement — it never sees the original image or raw audio.
// ============================================================================

const FIELDS = [
  { key: "materialCost", label: "Raw material cost", placeholder: "e.g. ₹400" },
  { key: "estimatedPrice", label: "Expected price", placeholder: "e.g. ₹1200" },
  { key: "quantity", label: "Quantity available", placeholder: "e.g. 5" },
];

export default function KalaLinkForm({ onNavChange }) {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [values, setValues] = useState({
    materialCost: "",
    estimatedPrice: "",
    quantity: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null); // { image, plan, quality, elapsed_seconds }

  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState("");
  const [listing, setListing] = useState(null); // { title, description, tags, price_estimation, price_breakdown }

  // The backend's price estimate is a starting point — the user can edit it
  // before saving. Re-seeded whenever a fresh listing comes back.
  const [editablePrice, setEditablePrice] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (listing) {
      setEditablePrice(String(listing.price_estimation ?? ""));
      setSaved(false);
      setSaveError("");
    }
  }, [listing]);

  const { activeField, status: voiceStatus, toggleRecording } = useVoiceRecorder({
    onTranscribed: (key, text) => handleValueChange(key, text),
    onError: (message) => setError(message),
  });

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    // A brand-new photo starts a fresh enhancement session.
    setAttempt(0);
    setResult(null);
    setError("");
    // A new photo invalidates any listing generated for the old one.
    setListing(null);
    setListingError("");
  }

  function handleValueChange(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleMicClick(key) {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Voice input isn't supported in this browser — try Chrome, or just type instead.");
      return;
    }
    toggleRecording(key);
  }

  const allFieldsFilled = Object.values(values).every((v) => v.trim());

  async function runEnhancement(nextAttempt) {
    if (!imageFile) return;
    setLoading(true);
    setError("");
    // A fresh enhancement pass invalidates any listing built from the old image.
    setListing(null);
    setListingError("");
    try {
      const data = await enhanceImage(imageFile, nextAttempt);
      setAttempt(data.attempt);
      setResult(data);
      // Enhancement succeeded — now generate the listing from the enhanced
      // image. If this stage fails, the enhancement result above is kept
      // (the user doesn't lose it), and they can retry just this stage.
      await runListingGeneration(data.image);
    } catch (err) {
      setError(err.message || "Something went wrong while enhancing the image.");
    } finally {
      setLoading(false);
    }
  }

  async function runListingGeneration(enhancedImage) {
    // Never proceed with a required field missing or unparseable — the
    // backend would reject it anyway, but failing fast here gives a
    // clearer, field-specific message instead of a generic HTTP error.
    const materialCostNum = parseNumericValue(values.materialCost);
    const quantityNum = parseNumericValue(values.quantity);
    const referencePriceNum = parseNumericValue(values.estimatedPrice); // optional

    if (materialCostNum === null) {
      setListingError('Could not read a number from "Raw material cost" — please check that field.');
      return;
    }
    if (quantityNum === null) {
      setListingError('Could not read a number from "Quantity available" — please check that field.');
      return;
    }

    setListingLoading(true);
    setListingError("");
    try {
      const data = await generateProductListing({
        image: enhancedImage,
        materialCost: materialCostNum,
        quantity: quantityNum,
        referencePrice: referencePriceNum, // null is fine — backend treats it as "not provided"
      });
      setListing(data);
    } catch (err) {
      setListingError(err.message || "Something went wrong while generating the product listing.");
    } finally {
      setListingLoading(false);
    }
  }

  function handleProcess() {
    if (!imageFile || !allFieldsFilled) return;
    runEnhancement(1);
  }

  function handleRetry() {
    runEnhancement(attempt + 1);
  }

  function handleRetryListing() {
    if (!result?.image) return;
    runListingGeneration(result.image);
  }

  function handleDownload() {
    if (!result?.image) return;
    const link = document.createElement("a");
    link.href = result.image;
    link.download = "kalalink_enhanced.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function formatPriceForDisplay(rawPrice) {
    const trimmed = String(rawPrice ?? "").trim();
    if (!trimmed) return "₹0";
    return trimmed.startsWith("₹") ? trimmed : `₹${trimmed}`;
  }

  // localStorage has a small size cap, and the enhanced photo is stored as
  // a base64 string — a few full-size photos can hit that cap fast. Shrink
  // the photo down to a thumbnail-sized JPEG before it's saved, so many
  // products can be stored without silently failing.
  function compressImageDataUrl(dataUrl, maxDimension = 480, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Could not process the image for saving."));
      img.src = dataUrl;
    });
  }

  async function handleSaveProduct() {
    if (!listing) return;
    setSaving(true);
    setSaveError("");
    try {
      const compressedImage = result?.image
        ? await compressImageDataUrl(result.image)
        : null;
      saveProduct({
        image: compressedImage,
        title: listing.title,
        description: listing.description,
        tags: listing.tags || [],
        price: formatPriceForDisplay(editablePrice),
      });
      setSaved(true);
    } catch (err) {
      setSaved(false);
      setSaveError(err.message || "Something went wrong while saving this product.");
    } finally {
      setSaving(false);
    }
  }

  function handleGoHome() {
    onNavChange?.("home");
  }

    return (
    <div style={styles.wrap}>
      <style>{`
        @keyframes kalalink-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={styles.topBar}>
        <h2 style={styles.heading}>KalaLink</h2>
        <button type="button" onClick={handleGoHome} style={styles.backLink}>
          ← Home
        </button>
      </div>

      <label style={styles.label}>Photo</label>
      <input type="file" accept="image/*" onChange={handleImageChange} />
      {imagePreview && <img src={imagePreview} alt="preview" style={styles.preview} />}

      {FIELDS.map(({ key, label, placeholder }) => {
        const isRecording = activeField === key && voiceStatus === "recording";
        const isTranscribing = activeField === key && voiceStatus === "transcribing";
        return (
          <div key={key}>
            <label style={styles.label}>{label}</label>
            <div style={styles.inputRow}>
                            <input
                type="text"
                value={values[key]}
                onChange={(e) => handleValueChange(key, e.target.value)}
                placeholder={isTranscribing ? "Transcribing your voice..." : placeholder}
                disabled={isTranscribing}
                style={{
                  ...styles.input,
                  background: isTranscribing ? "#f2ede8" : "white",
                  color: isTranscribing ? "#999" : "#000",
                }}
              />
              <button
                type="button"
                onClick={() => handleMicClick(key)}
                disabled={isTranscribing}
                title={isRecording ? "Tap to stop recording" : "Tap to record"}
                style={{
                  ...styles.micBtn,
                  background: isRecording ? "#8f4230" : "#b5563c",
                  opacity: isTranscribing ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isRecording ? (
                  "● Stop"
                ) : isTranscribing ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "kalalink-spin 0.7s linear infinite",
                    }}
                  />
                ) : (
                  "🎤"
                )}
              </button>
            </div>
            {isRecording && <p style={styles.voiceNote}>🔴 Recording — tap Stop when done</p>}
            {isTranscribing && (
              <p style={styles.voiceNote}>⏳ Transcribing your voice — this can take a few seconds…</p>
            )}
          </div>
        );
      })}

      {error && <p style={styles.error}>{error}</p>}

      <button
        type="button"
        onClick={handleProcess}
        disabled={!imageFile || !allFieldsFilled || loading}
        style={styles.processBtn}
      >
        {listingLoading ? "Generating listing..." : loading ? "Enhancing..." : "Process"}
      </button>

      {result && (
        <div style={styles.result}>
          <img src={result.image} alt="enhanced" style={styles.preview} />

          <div style={styles.resultActions}>
            <button type="button" onClick={handleDownload} style={styles.downloadBtn}>
              ⬇ Download
            </button>
            <button
              type="button"
              onClick={handleRetry}
              disabled={loading}
              style={styles.retryBtn}
            >
              {loading ? "Retrying..." : "🔁 Not satisfied — Retry"}
            </button>
          </div>

          {result.plan && (
            <details style={styles.reasoning}>
              <summary style={styles.reasoningSummary}>
                What the agent did (attempt {result.attempt})
              </summary>
              <p style={styles.reasoningText}>{result.plan.reason}</p>
              <p style={styles.reasoningMeta}>
                backend: {result.plan.backend} · scale: {result.plan.scale}x ·
                {" "}took {result.elapsed_seconds}s
              </p>
            </details>
          )}

          <p><strong>Material cost:</strong> {values.materialCost}</p>
          <p><strong>Estimated price:</strong> {values.estimatedPrice}</p>
          <p><strong>Quantity:</strong> {values.quantity}</p>

          {listingLoading && <p style={styles.stageNote}>Generating product listing…</p>}

          {listingError && (
            <div>
              <p style={styles.error}>{listingError}</p>
              <button
                type="button"
                onClick={handleRetryListing}
                disabled={listingLoading}
                style={styles.retryBtn}
              >
                🔁 Retry listing generation
              </button>
            </div>
          )}

          {listing && (
            <div style={styles.listing}>
              <label style={styles.label}>Estimated price (editable)</label>
              <div style={styles.priceEditRow}>
                <span style={styles.priceCurrency}>₹</span>
                <input
                  type="text"
                  value={editablePrice}
                  onChange={(e) => {
                    setEditablePrice(e.target.value);
                    setSaved(false);
                  }}
                  style={styles.priceInput}
                />
              </div>
              <h3 style={styles.listingTitle}>{listing.title}</h3>
              <p style={styles.listingDescription}>{listing.description}</p>
              <div style={styles.tagContainer}>
                {listing.tags?.map((tag, idx) => (
                  <span key={idx} style={styles.tag}>#{tag}</span>
                ))}
              </div>
              <button
                type="button"
                onClick={handleRetryListing}
                disabled={listingLoading}
                style={styles.downloadBtn}
              >
                🔁 Regenerate listing
              </button>
              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={listingLoading || saving}
                style={styles.saveBtn}
              >
                {saving ? "Saving..." : saved ? "✔ Saved" : "Save Product"}
              </button>
              {saveError && <p style={styles.error}>{saveError}</p>}
              {saved && (
                <button type="button" onClick={handleGoHome} style={styles.goHomeBtn}>
                  Go to Homepage
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { maxWidth: 420, margin: "0 auto", padding: 20, fontFamily: "sans-serif" },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  heading: { color: "#8f4230", margin: 0 },
  backLink: {
    border: "none",
    background: "none",
    color: "#8f4230",
    fontSize: 14,
    cursor: "pointer",
    padding: "6px 4px",
  },
  label: { display: "block", marginTop: 16, marginBottom: 6, fontSize: 14, color: "#555" },
  preview: { width: "100%", borderRadius: 8, marginTop: 10, maxHeight: 260, objectFit: "cover" },
  inputRow: { display: "flex", gap: 8 },
  input: { flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ccc", fontSize: 14 },
  micBtn: { border: "none", borderRadius: 6, color: "white", padding: "0 14px", cursor: "pointer" },
  error: { color: "#a13c2f", fontSize: 13 },
  voiceNote: { color: "#8f4230", fontSize: 12, marginTop: 4, fontStyle: "italic" },
  processBtn: {
    marginTop: 16,
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: "#b5563c",
    color: "white",
    fontSize: 15,
    cursor: "pointer",
  },
  result: { marginTop: 20, borderTop: "1px solid #eee", paddingTop: 16 },
  resultActions: { display: "flex", gap: 8, marginTop: 10 },
  downloadBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    border: "1px solid #b5563c",
    background: "white",
    color: "#b5563c",
    fontSize: 14,
    cursor: "pointer",
  },
  retryBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    border: "none",
    background: "#8f4230",
    color: "white",
    fontSize: 14,
    cursor: "pointer",
  },
  reasoning: { marginTop: 12, fontSize: 13, color: "#555" },
  reasoningSummary: { cursor: "pointer", color: "#8f4230" },
  reasoningText: { marginTop: 6 },
  reasoningMeta: { color: "#888", fontSize: 12 },
  stageNote: { marginTop: 10, fontSize: 13, color: "#8f4230" },
  listing: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    border: "1px solid #eee",
    background: "#fdfaf7",
  },
  priceBadge: {
    display: "inline-block",
    background: "#e6f4ea",
    color: "#1e7a34",
    padding: "6px 12px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 12,
  },
  priceEditRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  priceCurrency: { fontSize: 16, fontWeight: 700, color: "#1e7a34" },
  priceInput: {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #b7dcc2",
    background: "#e6f4ea",
    color: "#1e7a34",
    fontSize: 16,
    fontWeight: 700,
    width: 140,
  },
  saveBtn: {
    marginTop: 10,
    width: "100%",
    padding: 10,
    borderRadius: 6,
    border: "none",
    background: "#1e7a34",
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  goHomeBtn: {
    marginTop: 8,
    width: "100%",
    padding: 10,
    borderRadius: 6,
    border: "1px solid #8f4230",
    background: "white",
    color: "#8f4230",
    fontSize: 14,
    cursor: "pointer",
  },
  listingTitle: { margin: "0 0 8px 0", color: "#333", fontSize: 17 },
  listingDescription: { color: "#555", fontSize: 14, lineHeight: 1.5, marginBottom: 12 },
  tagContainer: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 },
  tag: {
    background: "#f1e4dc",
    color: "#8f4230",
    padding: "4px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
  },
};
